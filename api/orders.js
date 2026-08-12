import {json,method,sql,requireActor} from '../lib/core.js';

const plans={
  month:{days:30,RUB:169,UAH:69},
  quarter:{days:90,RUB:399,UAH:149},
  forever:{days:null,RUB:999,UAH:399}
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
  const amount=plan[currency],currencyName=currency==='UAH'?'Гривны':'Рубли',symbol=currency==='UAH'?'₴':'₽',days=plan.days?`${plan.days} дней`:'Навсегда';
  const rows=await sql`insert into orders(user_id,plan,amount) values(${user.id},${req.body.plan},${amount}) returning id`;
  const text=`Чит Infinity\nВалюта: ${currencyName}\nСумма: ${amount} ${symbol}\nКоличество дней: ${days}\nПользователь: @${user.login}\nНик Minecraft: ${user.nickname}`;
  await notify(text);
  return json(res,200,{orderId:rows[0].id,telegramUrl:`https://t.me/HET_CTPAXA_x?text=${encodeURIComponent(text)}`});
}
