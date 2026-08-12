import {json,sql,newLicenseKey,sha256} from '../lib/core.js';

async function ensureClipsTable(){
  await sql`
    create table if not exists pvp_clips (
      id uuid primary key default gen_random_uuid(),
      title text not null default 'PvP moment',
      player_name text,
      server_address text,
      telegram_file_id text,
      telegram_message_id bigint,
      video_url text,
      youtube_url text,
      status text not null default 'pending' check (status in ('pending','public','rejected')),
      created_at timestamptz not null default now(),
      published_at timestamptz
    )
  `;
  await sql`create index if not exists pvp_clips_telegram_message on pvp_clips(telegram_message_id)`;
}

function botToken(){ return process.env.TELEGRAM_BOT_TOKEN; }
function adminIds(){
  return String(process.env.TELEGRAM_ADMIN_IDS||'').split(',').map(v=>v.trim()).filter(Boolean);
}
function isAdmin(id){ return adminIds().includes(String(id)); }

async function telegram(method,payload){
  const token=botToken();
  if(!token)return null;
  const response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(payload)
  });
  return response.json().catch(()=>null);
}

async function send(chatId,text,extra={}){
  return telegram('sendMessage',{chat_id:chatId,text,...extra});
}

function parseClipMeta(caption){
  const text=String(caption||'');
  const player=(text.match(/(?:игрок|ник|player)\s*:\s*([^\n]+)/i)||[])[1]?.trim();
  const server=(text.match(/(?:сервер|server)\s*:\s*([^\n]+)/i)||[])[1]?.trim();
  const title=(text.match(/(?:title|название)\s*:\s*([^\n]+)/i)||[])[1]?.trim() || 'PvP момент Infinyty';
  return {title:title.slice(0,120),player:player?.slice(0,64),server:server?.slice(0,180)};
}

async function queueClipFromVideo(message){
  await ensureClipsTable();
  const chatId=message.chat.id, meta=parseClipMeta(message.caption);
  const rows=await sql`
    insert into pvp_clips(title,player_name,server_address,telegram_file_id,telegram_message_id,status)
    values(${meta.title},${meta.player||null},${meta.server||null},${message.video.file_id},${message.message_id},'pending')
    returning id,title,player_name,server_address
  `;
  const clip=rows[0];
  await send(chatId,
    `Момент добавлен на проверку.\nID: ${clip.id}\nИгрок: ${clip.player_name||'не указан'}\nСервер: ${clip.server_address||'не указан'}\n\nОтветь на видео словом: опубликовать`,
    {reply_markup:{inline_keyboard:[[
      {text:'Опубликовать',callback_data:`clip:publish:${clip.id}`},
      {text:'Отклонить',callback_data:`clip:reject:${clip.id}`}
    ]]}}
  );
}

async function setClipStatus(id,status){
  await ensureClipsTable();
  const rows=await sql`
    update pvp_clips
    set status=${status}, published_at=case when ${status}='public' then now() else published_at end
    where id=${id}
    returning id,title
  `;
  return rows[0]||null;
}

async function publishByReply(message){
  await ensureClipsTable();
  const replied=message.reply_to_message;
  if(!replied)return null;
  let rows=[];
  if(replied.video){
    rows=await sql`select id from pvp_clips where telegram_message_id=${replied.message_id} order by created_at desc limit 1`;
  }
  if(!rows[0]){
    const id=(String(replied.text||replied.caption||'').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)||[])[0];
    if(id)rows=await sql`select id from pvp_clips where id=${id} limit 1`;
  }
  return rows[0] ? setClipStatus(rows[0].id,'public') : null;
}

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false});
  const configuredSecret=String(process.env.TELEGRAM_WEBHOOK_SECRET||'').replace(/\//g,'_').replace(/\+/g,'-').replace(/=+$/,'');
  if(configuredSecret&&req.headers['x-telegram-bot-api-secret-token']!==configuredSecret)return json(res,401,{ok:false});

  const callback=req.body?.callback_query;
  if(callback){
    if(!isAdmin(callback.from?.id)){
      await telegram('answerCallbackQuery',{callback_query_id:callback.id,text:'Нет доступа'});
      return json(res,200,{ok:true});
    }
    const [,action,id]=String(callback.data||'').split(':');
    if(action==='publish'||action==='reject'){
      const clip=await setClipStatus(id,action==='publish'?'public':'rejected');
      await telegram('answerCallbackQuery',{callback_query_id:callback.id,text:clip?(action==='publish'?'Опубликовано':'Отклонено'):'Момент не найден'});
      if(clip)await send(callback.message.chat.id,action==='publish'?`Момент опубликован на сайте: ${clip.title}`:`Момент отклонён: ${clip.title}`);
    }
    return json(res,200,{ok:true});
  }

  const message=req.body?.message,chatId=message?.chat?.id,text=String(message?.text||'').trim();
  if(!chatId)return json(res,200,{ok:true});
  if(!isAdmin(message.from?.id)){await send(chatId,'Нет доступа.');return json(res,200,{ok:true});}

  if(message.video){
    await queueClipFromVideo(message);
    return json(res,200,{ok:true});
  }

  if(/^опубликовать$/i.test(text)){
    const clip=await publishByReply(message);
    await send(chatId,clip?`Момент опубликован на сайте: ${clip.title}`:'Не нашёл момент в сообщении, на которое ты ответил.');
    return json(res,200,{ok:true});
  }

  const parts=text.split(/\s+/),command=parts[0].toLowerCase().replace(/@[^\s]+$/,'');
  if(['/give','/выдать','give','выдать'].includes(command)){
    const login=String(parts[1]||'').replace(/^@/,'').trim(),rawDays=String(parts[2]||'');
    const days=rawDays.toLowerCase()==='forever'||rawDays.toLowerCase()==='навсегда'?null:Number(rawDays);
    if(!login||(!Number.isFinite(days)&&days!==null)||days!==null&&(days<1||days>3650)){
      await send(chatId,'Использование: /выдать @логин 7 или /выдать @логин навсегда');return json(res,200,{ok:true});
    }
    const users=await sql`select id,login,nickname from users where lower(login)=lower(${login}) or lower(nickname)=lower(${login}) limit 1`;
    if(!users[0]){await send(chatId,`Пользователь @${login} не найден на сайте.`);return json(res,200,{ok:true});}
    const key=newLicenseKey(),user=users[0];
    await sql`insert into licenses(key_hash,key_cipher,key_hint,duration_days,user_id,max_activations) values(${sha256(key)},${key},${key.slice(-6)},${days},${user.id},1)`;
    await send(chatId,`Ключ выдан пользователю @${user.login}\nНик Minecraft: ${user.nickname}\nСрок: ${days?days+' дней':'Навсегда'}\nКлюч: ${key}\n\nКлюч уже появился в кабинете и лаунчере.`);
  } else if(['/assign','/привязать'].includes(command)&&parts[1]&&parts[2]){
    const key=String(parts[1]).toUpperCase(),login=String(parts[2]).replace(/^@/,'');
    const users=await sql`select id,login,nickname from users where lower(login)=lower(${login}) or lower(nickname)=lower(${login}) limit 1`;
    if(!users[0]){await send(chatId,`Пользователь @${login} не найден.`);return json(res,200,{ok:true});}
    const rows=await sql`update licenses set user_id=${users[0].id} where key_hash=${sha256(key)} returning id`;
    await send(chatId,rows.length?`Ключ привязан к @${users[0].login} (${users[0].nickname}) и появился в кабинете.`:'Ключ не найден.');
  } else if(command==='/key'){
    const raw=String(parts[1]||'forever'),days=raw.toLowerCase()==='forever'?null:Number(raw);
    if(days!==null&&(!Number.isFinite(days)||days<1||days>3650)){await send(chatId,'Использование: /key 30 или /key forever');return json(res,200,{ok:true});}
    const key=newLicenseKey();await sql`insert into licenses(key_hash,key_cipher,key_hint,duration_days) values(${sha256(key)},${key},${key.slice(-6)},${days})`;
    await send(chatId,`Ключ: ${key}\nСрок: ${days?days+' дней':'Навсегда'}\nВладелец не назначен. Для кабинета: /привязать ${key} @логин`);
  } else if(command==='/revoke'&&parts[1]){
    const rows=await sql`update licenses set revoked=true where key_hash=${sha256(parts[1].toUpperCase())} returning id`;await send(chatId,rows.length?'Ключ отозван.':'Ключ не найден.');
  } else if(command==='/reset'&&parts[1]){
    const rows=await sql`select id from licenses where key_hash=${sha256(parts[1].toUpperCase())}`;if(rows[0])await sql`delete from license_activations where license_id=${rows[0].id}`;await send(chatId,rows.length?'Активации ключа сброшены.':'Ключ не найден.');
  } else await send(chatId,'Команды:\n/выдать @логин 7\n/выдать @логин навсегда\n/привязать KEY @логин\n/key 30 (без владельца)\n/key forever\n/revoke KEY\n/reset KEY\n\nВидео в бот = добавить PvP момент на проверку. Ответ на видео словом "опубликовать" = показать момент на сайте.');
  return json(res,200,{ok:true});
}
