import {json,sql} from '../lib/core.js';
export default async function handler(req,res){
  const kind=req.query?.kind==='mod'?'mod':'launcher';
  if(req.method==='GET'){
    const rows=await sql`select id,version,filename,sha256,size_bytes as size,chunk_count from releases where kind=${kind} and published=true order by created_at desc limit 1`;
    return json(res,200,{release:rows[0]||null});
  }
  if(req.method==='POST'&&req.body?.action==='chunk'){
    const rows=await sql`select encode(data,'base64') as data from release_chunks where release_id=${req.body.releaseId} and chunk_index=${Number(req.body.index)} limit 1`;
    return rows[0]?json(res,200,rows[0]):json(res,404,{message:'Фрагмент не найден'});
  }
  return json(res,405,{message:'Метод не поддерживается'});
}
