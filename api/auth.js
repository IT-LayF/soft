import {json,method,sql,actor,tokenFor,publicUser,hashPassword,verifyPassword,validLogin,validNickname} from '../lib/core.js';

export default async function handler(req,res) {
  if (!method(req,res)) return;
  try {
    const body=req.body||{}, action=body.action;
    if (action==='register') {
      const login=String(body.login||'').trim(), nickname=String(body.nickname||'').trim(), password=String(body.password||'');
      if(!validLogin(login)||!validNickname(nickname)||password.length<8) return json(res,400,{message:'Логин 3–32, ник 3–16, пароль минимум 8 символов'});
      const exists=await sql`select 1 from users where lower(login)=lower(${login})`;
      if(exists.length) return json(res,409,{message:'Логин уже занят'});
      const passwordHash=await hashPassword(password);
      const rows=await sql`insert into users(login,password_hash,nickname) values(${login},${passwordHash},${nickname}) returning id,login,nickname,role`;
      return json(res,200,{token:tokenFor(rows[0]),user:publicUser(rows[0])});
    }
    if(action==='login') {
      const requestedLogin=String(body.login||'').trim(),requestedPassword=String(body.password||'');
      let rows=await sql`select * from users where lower(login)=lower(${requestedLogin}) limit 1`;
      if(!rows[0]&&requestedLogin===process.env.ADMIN_LOGIN&&requestedPassword===process.env.ADMIN_PASSWORD){
        const passwordHash=await hashPassword(requestedPassword);
        rows=await sql`insert into users(login,password_hash,nickname,role) values(${requestedLogin},${passwordHash},${requestedLogin},'admin') returning *`;
      }
      const u=rows[0];
      if(!u||u.blocked||!await verifyPassword(requestedPassword,u.password_hash)) return json(res,401,{message:'Неверный логин или пароль'});
      return json(res,200,{token:tokenFor(u),user:publicUser(u)});
    }
    const u=await actor(req);
    if(!u) return json(res,401,{message:'Сессия истекла'});
    if(action==='nickname') {
      if(!validNickname(body.nickname)) return json(res,400,{message:'Некорректный ник'});
      const rows=await sql`update users set nickname=${body.nickname} where id=${u.id} returning id,login,nickname,role`;
      return json(res,200,{user:publicUser(rows[0])});
    }
    if(action==='profile') {
      const licenses=await sql`select key_cipher as key,duration_days as "durationDays",activated_at as "activatedAt",expires_at as "expiresAt",revoked from licenses where user_id=${u.id} order by created_at desc`;
      return json(res,200,{user:publicUser(u),licenses});
    }
    return json(res,400,{message:'Неизвестное действие'});
  } catch(e) { return json(res,500,{message:'Ошибка сервера', detail:process.env.NODE_ENV==='development'?e.message:undefined}); }
}
