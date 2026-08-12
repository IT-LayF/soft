import {json,method,sql,requireActor} from '../lib/core.js';
export const config={api:{bodyParser:{sizeLimit:'3mb'}}};
export default async function handler(req,res){
  if(!method(req,res))return; const admin=await requireActor(req,res,true); if(!admin)return; const b=req.body||{};
  if(b.action==='begin'){
    const rows=await sql`insert into releases(kind,version,filename,sha256,size_bytes,chunk_count) values(${b.kind},${b.version},${b.filename},${b.sha256},${Number(b.size)},${Number(b.chunkCount)}) returning id`;
    return json(res,200,{releaseId:rows[0].id});
  }
  if(b.action==='chunk'){
    const data=Buffer.from(String(b.data||''),'base64'); if(data.length>2100000)return json(res,413,{message:'Фрагмент слишком большой'});
    await sql`insert into release_chunks(release_id,chunk_index,data) values(${b.releaseId},${Number(b.index)},${data}) on conflict(release_id,chunk_index) do update set data=excluded.data`;
    return json(res,200,{ok:true});
  }
  if(b.action==='publish'){
    const count=await sql`select count(*)::int as n from release_chunks where release_id=${b.releaseId}`;
    const rel=await sql`select chunk_count,kind from releases where id=${b.releaseId}`;
    if(!rel[0]||count[0].n!==rel[0].chunk_count)return json(res,400,{message:'Загружены не все фрагменты'});
    await sql`update releases set published=false where kind=${rel[0].kind}`;
    await sql`update releases set published=true where id=${b.releaseId}`;
    return json(res,200,{ok:true});
  }

  if(b.action==='list') return json(res,200,{releases:await sql`select id,kind,version,filename,size_bytes as size,published,created_at as "createdAt" from releases order by created_at desc limit 100`});
  return json(res,400,{message:'Неизвестное действие'});
}
