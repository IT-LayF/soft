import {json,method,sql,sha256} from '../lib/core.js';
export default async function handler(req,res){
  if(!method(req,res))return;
  const key=String(req.body?.key||'').trim().toUpperCase(), hwid=String(req.body?.hwid||'').trim();
  if(!key||!hwid)return json(res,400,{valid:false,message:'Укажите ключ и HWID'});
  const rows=await sql`select * from licenses where key_hash=${sha256(key)} limit 1`;
  const lic=rows[0];
  if(!lic||lic.revoked)return json(res,403,{valid:false,message:'Ключ недействителен'});
  const hw=sha256(hwid), now=new Date();
  if(lic.hwid_hash&&lic.hwid_hash!==hw)return json(res,403,{valid:false,message:'Ключ привязан к другому компьютеру'});
  let expires=lic.expires_at;
  if(!lic.activated_at){
    expires=lic.duration_days?new Date(now.getTime()+lic.duration_days*86400000):null;
    await sql`update licenses set activated_at=now(),expires_at=${expires},hwid_hash=${hw} where id=${lic.id}`;
  } else if(!lic.hwid_hash) await sql`update licenses set hwid_hash=${hw} where id=${lic.id}`;
  if(expires&&new Date(expires)<=now)return json(res,403,{valid:false,message:'Подписка закончилась'});
  return json(res,200,{valid:true,expiresAt:expires});
}
