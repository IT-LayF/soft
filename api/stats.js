import {json,sql} from '../lib/core.js';

export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{message:'GET required'});
  const [users,downloads,online,servers]=await Promise.all([
    sql`select count(*)::int as n from users where role='user'`,
    sql`select count(*)::int as n from download_events where kind='launcher'`,
    sql`select count(*)::int as n from telemetry_sessions where last_seen>now()-interval '90 seconds'`,
    sql`select server_address as server,count(*)::int as players from telemetry_sessions where last_seen>now()-interval '90 seconds' and server_address<>'Singleplayer' group by server_address order by players desc,server_address limit 7`
  ]);
  res.setHeader('Cache-Control','public, max-age=10, s-maxage=10');
  return json(res,200,{registrations:users[0].n,downloads:downloads[0].n,online:online[0].n,servers});
}
