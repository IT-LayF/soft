import {json,method,requireActor,sql} from '../lib/core.js';

async function ensureClipsTable(){
  await sql`
    create table if not exists pvp_clips (
      id uuid primary key default gen_random_uuid(),
      title text not null default 'PvP moment',
      player_name text,
      server_address text,
      telegram_file_id text,
      telegram_message_id bigint,
      video_url text,
      youtube_url text,
      status text not null default 'pending' check (status in ('pending','public','rejected')),
      created_at timestamptz not null default now(),
      published_at timestamptz
    )
  `;
  await sql`create index if not exists pvp_clips_status_created on pvp_clips(status, created_at desc)`;
}

function clipRow(row){
  return {
    id: row.id,
    title: row.title,
    player: row.player_name,
    server: row.server_address,
    videoUrl: row.video_url,
    youtubeUrl: row.youtube_url,
    telegramUrl: row.telegram_file_id ? `/api/clip-file?id=${row.id}` : null,
    status: row.status,
    createdAt: row.created_at,
    publishedAt: row.published_at
  };
}

export default async function handler(req,res){
  await ensureClipsTable();
  if(req.method==='GET'){
    const rows=await sql`
      select id,title,player_name,server_address,telegram_file_id,video_url,youtube_url,status,created_at,published_at
      from pvp_clips
      where status='public'
      order by published_at desc nulls last, created_at desc
      limit 24
    `;
    return json(res,200,{clips:rows.map(clipRow)});
  }
  if(!method(req,res))return;
  const body=req.body||{};
  if(body.action==='list'){
    const admin=await requireActor(req,res,true); if(!admin)return;
    const rows=await sql`
      select id,title,player_name,server_address,telegram_file_id,video_url,youtube_url,status,created_at,published_at
      from pvp_clips
      order by created_at desc
      limit 100
    `;
    return json(res,200,{clips:rows.map(clipRow)});
  }
  if(body.action==='publish'||body.action==='reject'){
    const admin=await requireActor(req,res,true); if(!admin)return;
    const status=body.action==='publish'?'public':'rejected';
    const rows=await sql`
      update pvp_clips
      set status=${status}, published_at=case when ${status}='public' then now() else published_at end
      where id=${String(body.id||'')}
      returning id
    `;
    return json(res,rows[0]?200:404,{ok:Boolean(rows[0])});
  }
  return json(res,400,{message:'Unknown action'});
}
