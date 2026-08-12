import {json,method,sql} from '../lib/core.js';
export default async function handler(req,res){
  if(!method(req,res))return; const b=req.body||{};
  if(b.action==='manifest'){
    const rows=await sql`select id,version,filename,sha256,size_bytes as size,chunk_count from releases where kind='mod' and published=true order by created_at desc limit 1`;
    return json(res,200,{release:rows[0]||null});
  }
  if(b.action==='chunk'){
    const rows=await sql`select encode(data,'base64') as data from release_chunks where release_id=${b.releaseId} and chunk_index=${Number(b.index)} limit 1`;
    if(!rows[0])return json(res,404,{message:'Фрагмент не найден'}); return json(res,200,rows[0]);
  }
  return json(res,400,{message:'Неизвестное действие'});
}
