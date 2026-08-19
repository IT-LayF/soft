import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const [kind, version, inputPath] = process.argv.slice(2);
if (!['mod', 'launcher'].includes(kind) || !version || !inputPath) {
  throw new Error('Usage: node scripts/publish-release.mjs <mod|launcher> <version> <file>');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

const sql = neon(process.env.DATABASE_URL);
const filePath = resolve(inputPath);
const file = await readFile(filePath);
const sha256 = createHash('sha256').update(file).digest('hex');
const chunkSize = 512 * 1024;
const chunkCount = Math.ceil(file.length / chunkSize);

const previous = await sql`select id from releases where kind=${kind} and version=${version} limit 1`;
if (previous[0]) await sql`delete from releases where id=${previous[0].id}`;

const rows = await sql`
  insert into releases(kind, version, filename, sha256, size_bytes, chunk_count)
  values(${kind}, ${version}, ${basename(filePath)}, ${sha256}, ${file.length}, ${chunkCount})
  returning id
`;
const releaseId = rows[0].id;

for (let index = 0; index < chunkCount; index += 1) {
  const chunk = file.subarray(index * chunkSize, Math.min(file.length, (index + 1) * chunkSize));
  await sql`
    insert into release_chunks(release_id, chunk_index, data)
    values(${releaseId}, ${index}, ${chunk})
  `;
  process.stdout.write(`chunk ${index + 1}/${chunkCount}\n`);
}

const stored = await sql`select count(*)::int as count from release_chunks where release_id=${releaseId}`;
if (stored[0].count !== chunkCount) throw new Error('Not all chunks were stored');

await sql`update releases set published=false where kind=${kind}`;
await sql`update releases set published=true where id=${releaseId}`;
process.stdout.write(`published ${kind} ${version} ${file.length} bytes sha256=${sha256}\n`);
