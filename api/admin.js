import {json,method,sql,requireActor,newLicenseKey,sha256} from '../lib/core.js';
export default async function handler(req,res){
  if(!method(req,res))return;
  const admin=await requireActor(req,res,true); if(!admin)return;
  const b=req.body||{};
  if(b.action==='create'){
    const key=newLicenseKey(), days=b.durationDays==null?null:Math.max(1,Math.min(3650,Number(b.durationDays)));
    await sql`insert into licenses(key_hash,key_cipher,key_hint,duration_days) values(${sha256(key)},${key},${key.slice(-6)},${days})`;
    return json(res,200,{key});
  }
  if(b.action==='list'){
    const rows=await sql`select key_cipher as key,key_hint as hint,duration_days as "durationDays",activated_at as "activatedAt",expires_at as "expiresAt",(hwid_hash is not null) as "hwidBound",revoked from licenses order by created_at desc limit 500`;
    return json(res,200,{licenses:rows});
  }
  if(['reset','revoke','delete'].includes(b.action)){
    const hash=sha256(String(b.key||'').toUpperCase());
    let rows;
    if(b.action==='reset'){rows=await sql`select id from licenses where key_hash=${hash}`;if(rows[0])await sql`delete from license_activations where license_id=${rows[0].id}`;}
    else rows=b.action==='delete'?await sql`delete from licenses where key_hash=${hash} returning id`:await sql`update licenses set revoked=true where key_hash=${hash} returning id`;
    return json(res,200,{changed:rows.length>0});
  }
  if(b.action==='assign'){
    const login=String(b.login||'').replace(/^@/,'').trim(),hash=sha256(String(b.key||'').toUpperCase());
    const users=await sql`select id from users where lower(login)=lower(${login}) or lower(nickname)=lower(${login}) limit 1`;
    if(!users[0])return json(res,404,{message:'Пользователь не найден'});
    const rows=await sql`update licenses set user_id=${users[0].id} where key_hash=${hash} returning id`;
    return json(res,200,{changed:rows.length>0});
  }
  if(b.action==='users') return json(res,200,{users:await sql`select id,login,nickname,role,blocked,created_at as "createdAt" from users order by created_at desc limit 500`});
  if(b.action==='set-user'){
    const rows=await sql`update users set blocked=${Boolean(b.blocked)},role=${b.role==='admin'?'admin':'user'} where id=${b.id} returning id`;
    return json(res,200,{changed:rows.length>0});
  }
  return json(res,400,{message:'Неизвестное действие'});
}
