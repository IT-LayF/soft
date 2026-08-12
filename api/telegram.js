import {json,sql,newLicenseKey,sha256} from '../lib/core.js';

async function send(chatId,text){
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token)return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text})});
}
export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false});
  if(process.env.TELEGRAM_WEBHOOK_SECRET&&req.headers['x-telegram-bot-api-secret-token']!==process.env.TELEGRAM_WEBHOOK_SECRET)return json(res,401,{ok:false});
  const message=req.body?.message, chatId=message?.chat?.id, text=String(message?.text||'').trim();
  if(!chatId)return json(res,200,{ok:true});
  const admins=String(process.env.TELEGRAM_ADMIN_IDS||'').split(',').map(v=>v.trim()).filter(Boolean);
  if(!admins.includes(String(message.from?.id))){await send(chatId,'Нет доступа.');return json(res,200,{ok:true});}
  const [command,arg]=text.split(/\s+/,2);
  if(command==='/key'){
    const days=arg&&arg.toLowerCase()!=='forever'?Math.max(1,Math.min(3650,Number(arg))):null;
    if(arg&&arg.toLowerCase()!=='forever'&&!Number.isFinite(days)){await send(chatId,'Использование: /key 30 или /key forever');return json(res,200,{ok:true});}
    const key=newLicenseKey(); await sql`insert into licenses(key_hash,key_cipher,key_hint,duration_days) values(${sha256(key)},${key},${key.slice(-6)},${days})`;
    await send(chatId,`Ключ: ${key}\nСрок: ${days?days+' дней':'навсегда'}`);
  } else if(command==='/revoke'&&arg){const rows=await sql`update licenses set revoked=true where key_hash=${sha256(arg.toUpperCase())} returning id`;await send(chatId,rows.length?'Ключ отозван.':'Ключ не найден.');}
  else if(command==='/reset'&&arg){const rows=await sql`update licenses set hwid_hash=null where key_hash=${sha256(arg.toUpperCase())} returning id`;await send(chatId,rows.length?'HWID сброшен.':'Ключ не найден.');}
  else await send(chatId,'Команды:\n/key 30\n/key forever\n/revoke KEY\n/reset KEY');
  return json(res,200,{ok:true});
}
