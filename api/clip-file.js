import {json,sql} from '../lib/core.js';

export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{message:'GET required'});
  const id=String(req.query?.id||'').trim();
  if(!id)return json(res,400,{message:'Clip id required'});
  const rows=await sql`select telegram_file_id from pvp_clips where id=${id} and status='public' limit 1`;
  const fileId=rows[0]?.telegram_file_id;
  if(!fileId)return json(res,404,{message:'Clip not found'});
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token)return json(res,503,{message:'Telegram bot token is not configured'});

  const meta=await fetch(`https://api.telegram.org/bot${token}/getFile`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({file_id:fileId})
  }).then(r=>r.json()).catch(()=>null);
  const filePath=meta?.result?.file_path;
  if(!filePath)return json(res,502,{message:'Telegram file is not available'});

  const video=await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if(!video.ok)return json(res,502,{message:'Telegram file download failed'});
  res.status(200);
  res.setHeader('Content-Type',video.headers.get('content-type')||'video/mp4');
  res.setHeader('Cache-Control','public, max-age=3600');
  const reader=video.body.getReader();
  while(true){
    const {done,value}=await reader.read();
    if(done)break;
    res.write(Buffer.from(value));
  }
  res.end();
}
