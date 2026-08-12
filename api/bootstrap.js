import {json,method,sql,hashPassword} from '../lib/core.js';
export default async function handler(req,res){
  if(!method(req,res))return;
  if(!process.env.BOOTSTRAP_SECRET||req.body?.secret!==process.env.BOOTSTRAP_SECRET)return json(res,401,{message:'Нет доступа'});
  const count=await sql`select count(*)::int as n from users where role='admin'`;
  if(count[0].n>0)return json(res,409,{message:'Администратор уже создан'});
  const login=String(process.env.ADMIN_LOGIN||'').trim(), password=String(process.env.ADMIN_PASSWORD||'');
  if(!login||password.length<12)return json(res,500,{message:'Настройте ADMIN_LOGIN и новый ADMIN_PASSWORD'});
  const hash=await hashPassword(password);
  await sql`insert into users(login,password_hash,nickname,role) values(${login},${hash},${login},'admin')`;
  return json(res,200,{ok:true});
}
