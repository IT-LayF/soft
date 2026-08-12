import {json,method,sql,sha256,modDownloadToken} from '../lib/core.js';

export default async function handler(req,res){
  if(!method(req,res))return;
  const requiredVersion='1.6.4';
  const clientVersion=String(req.body?.clientVersion||'').trim();
  if(clientVersion!==requiredVersion)return json(res,426,{valid:false,updateRequired:true,minimumVersion:requiredVersion,message:'Обновите лаунчер до версии '+requiredVersion});
  const key=String(req.body?.key||'').trim().toUpperCase(),hwid=String(req.body?.hwid||'').trim();
  if(!key||!hwid)return json(res,400,{valid:false,message:'Укажите ключ и HWID'});
  const rows=await sql`select * from licenses where key_hash=${sha256(key)} limit 1`,lic=rows[0];
  if(!lic||lic.revoked)return json(res,403,{valid:false,message:'Ключ недействителен'});
  const now=new Date(); let expires=lic.expires_at;
  if(!lic.activated_at){expires=lic.duration_days?new Date(now.getTime()+lic.duration_days*86400000):null;await sql`update licenses set activated_at=now(),expires_at=${expires} where id=${lic.id}`;}
  if(expires&&new Date(expires)<=now)return json(res,403,{valid:false,message:'Подписка закончилась'});
  const hw=sha256(hwid),existing=await sql`select 1 from license_activations where license_id=${lic.id} and hwid_hash=${hw}`;
  if(!existing[0]){
    const count=await sql`select count(*)::int as n from license_activations where license_id=${lic.id}`;
    if(count[0].n>=Number(lic.max_activations||1))return json(res,403,{valid:false,message:`Лимит активаций исчерпан (${lic.max_activations||1})`});
    await sql`insert into license_activations(license_id,hwid_hash) values(${lic.id},${hw}) on conflict do nothing`;
  }
  return json(res,200,{valid:true,expiresAt:expires,maxActivations:Number(lic.max_activations||1),downloadToken:modDownloadToken(lic.id,hw)});
}
