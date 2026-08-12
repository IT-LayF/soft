import {json,sql,sha256} from '../lib/core.js';

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{message:'POST required'});
  const key=String(req.body?.key||'').trim().toUpperCase(),nickname=String(req.body?.nickname||'').slice(0,32),server=String(req.body?.server||'Unknown').slice(0,180);
  if(!key)return json(res,400,{message:'Key required'});
  const rows=await sql`select user_id from licenses where key_hash=${sha256(key)} and revoked=false and user_id is not null and (expires_at is null or expires_at>now()) limit 1`;
  if(!rows[0])return json(res,403,{message:'Invalid license'});
  await sql`insert into telemetry_sessions(user_id,nickname,server_address,last_seen) values(${rows[0].user_id},${nickname},${server},now()) on conflict(user_id) do update set nickname=excluded.nickname,server_address=excluded.server_address,last_seen=now()`;
  return json(res,200,{ok:true});
}
