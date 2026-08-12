import {json,method,sql,requireActor,newLicenseKey,sha256} from '../lib/core.js';

export default async function handler(req,res){
  if(!method(req,res))return;
  const user=await requireActor(req,res); if(!user)return;
  const old=await sql`select 1 from free_key_claims where user_id=${user.id} and claim_date=current_date limit 1`;
  const used=await sql`select count(*)::int as n from free_key_claims where claim_date=current_date`;
  const remaining=Math.max(0,3-used[0].n);
  const next=await sql`select extract(epoch from (date_trunc('day',now())+interval '1 day'))*1000 as ms`;
  if(req.body?.action==='status')return json(res,200,{available:!old[0]&&remaining>0,claimedByAccount:Boolean(old[0]),remaining,nextAt:Number(next[0].ms)});
  if(!old[0]&&remaining<1)return json(res,429,{message:'Все 3 бесплатных ключа на сегодня уже разобраны.',remaining:0,nextAt:Number(next[0].ms)});
  if(old[0])return json(res,429,{message:'Бесплатный ключ уже получен сегодня. Следующий доступен после завершения таймера.',nextAt:Number(next[0].ms)});
  const key=newLicenseKey();
  try{
    const claims=await sql`insert into free_key_claims(user_id,daily_slot) select ${user.id},slot from generate_series(1,3) slot where not exists(select 1 from free_key_claims where claim_date=current_date and daily_slot=slot) order by slot limit 1 returning id`;
    if(!claims[0])return json(res,429,{message:'Все 3 бесплатных ключа на сегодня уже разобраны.',remaining:0,nextAt:Number(next[0].ms)});
    const licenses=await sql`insert into licenses(key_hash,key_cipher,key_hint,duration_days,user_id,max_activations) values(${sha256(key)},${key},${key.slice(-6)},1,${user.id},1) returning id`;
    await sql`update free_key_claims set license_id=${licenses[0].id} where id=${claims[0].id}`;
    return json(res,200,{key,message:'Ключ на 24 часа создан.',remaining:remaining-1,nextAt:Number(next[0].ms)});
  }catch(error){
    if(String(error?.code)==='23505')return json(res,429,{message:'Бесплатный ключ уже получен сегодня.'});
    return json(res,500,{message:'Не удалось создать ключ'});
  }
}
