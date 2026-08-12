import {json,sql,newLicenseKey,sha256} from '../lib/core.js';

async function send(chatId,text){
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token)return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text})});
}

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false});
  const configuredSecret=String(process.env.TELEGRAM_WEBHOOK_SECRET||'').replace(/\//g,'_').replace(/\+/g,'-').replace(/=+$/,'');
  if(configuredSecret&&req.headers['x-telegram-bot-api-secret-token']!==configuredSecret)return json(res,401,{ok:false});
  const message=req.body?.message,chatId=message?.chat?.id,text=String(message?.text||'').trim();
  if(!chatId)return json(res,200,{ok:true});
  const admins=String(process.env.TELEGRAM_ADMIN_IDS||'').split(',').map(v=>v.trim()).filter(Boolean);
  if(!admins.includes(String(message.from?.id))){await send(chatId,'Нет доступа.');return json(res,200,{ok:true});}
  const parts=text.split(/\s+/),command=parts[0].toLowerCase().replace(/@[^\s]+$/,'');

  if(['/give','/выдать','give','выдать'].includes(command)){
    const login=String(parts[1]||'').replace(/^@/,'').trim(),rawDays=String(parts[2]||'');
    const days=rawDays.toLowerCase()==='forever'||rawDays.toLowerCase()==='навсегда'?null:Number(rawDays);
    if(!login||(!Number.isFinite(days)&&days!==null)||days!==null&&(days<1||days>3650)){
      await send(chatId,'Использование: /выдать @логин 7 или /выдать @логин навсегда');return json(res,200,{ok:true});
    }
    const users=await sql`select id,login,nickname from users where lower(login)=lower(${login}) limit 1`;
    if(!users[0]){await send(chatId,`Пользователь @${login} не найден на сайте.`);return json(res,200,{ok:true});}
    const key=newLicenseKey(),user=users[0];
    await sql`insert into licenses(key_hash,key_cipher,key_hint,duration_days,user_id,max_activations) values(${sha256(key)},${key},${key.slice(-6)},${days},${user.id},1)`;
    await send(chatId,`Ключ выдан пользователю @${user.login}\nНик Minecraft: ${user.nickname}\nСрок: ${days?days+' дней':'Навсегда'}\nКлюч: ${key}\n\nКлюч уже появился в кабинете и лаунчере.`);
  } else if(command==='/key'){
    const raw=String(parts[1]||'forever'),days=raw.toLowerCase()==='forever'?null:Number(raw);
    if(days!==null&&(!Number.isFinite(days)||days<1||days>3650)){await send(chatId,'Использование: /key 30 или /key forever');return json(res,200,{ok:true});}
    const key=newLicenseKey();await sql`insert into licenses(key_hash,key_cipher,key_hint,duration_days) values(${sha256(key)},${key},${key.slice(-6)},${days})`;
    await send(chatId,`Ключ: ${key}\nСрок: ${days?days+' дней':'Навсегда'}`);
  } else if(command==='/revoke'&&parts[1]){
    const rows=await sql`update licenses set revoked=true where key_hash=${sha256(parts[1].toUpperCase())} returning id`;await send(chatId,rows.length?'Ключ отозван.':'Ключ не найден.');
  } else if(command==='/reset'&&parts[1]){
    const rows=await sql`select id from licenses where key_hash=${sha256(parts[1].toUpperCase())}`;if(rows[0])await sql`delete from license_activations where license_id=${rows[0].id}`;await send(chatId,rows.length?'Активации ключа сброшены.':'Ключ не найден.');
  } else await send(chatId,'Команды:\n/выдать @логин 7\n/выдать @логин навсегда\n/key 30\n/key forever\n/revoke KEY\n/reset KEY');
  return json(res,200,{ok:true});
}
