import {json,method,sql,requireActor} from '../lib/core.js';

const plans={
  month:{label:'Infinyty на 30 дней',RUB:169,UAH:69},
  quarter:{label:'Infinyty на 90 дней',RUB:399,UAH:149},
  forever:{label:'Infinyty навсегда',RUB:999,UAH:399}
};

async function notify(text){
  const token=process.env.TELEGRAM_BOT_TOKEN,chatId=process.env.PURCHASE_ADMIN_CHAT_ID;
  if(!token||!chatId)return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text})});
}

export default async function handler(req,res){
  if(!method(req,res))return;
  const user=await requireActor(req,res); if(!user)return;
  const plan=plans[req.body?.plan],currency=['RUB','UAH'].includes(req.body?.currency)?req.body.currency:'RUB';
  if(!plan)return json(res,400,{message:'Неизвестный тариф'});
  const amount=plan[currency];
  const rows=await sql`insert into orders(user_id,plan,amount) values(${user.id},${req.body.plan},${amount}) returning id`;
  const unit=currency==='UAH'?'грн':'руб';
  const text=`Здравствуйте! Хочу купить ${plan.label}. К оплате: ${amount} ${unit}. Заявка: ${rows[0].id}. Аккаунт: ${user.login}, ник: ${user.nickname}.`;
  await notify(`НОВАЯ ЗАЯВКА НА ПОКУПКУ\n${text}`);
  return json(res,200,{orderId:rows[0].id,telegramUrl:`https://t.me/HET_CTPAXA_x?text=${encodeURIComponent(text)}`});
}
