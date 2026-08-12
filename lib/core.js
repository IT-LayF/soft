import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

export const sql = neon(process.env.DATABASE_URL || '');
const secret = () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET is not configured');
  return process.env.JWT_SECRET;
};

export function json(res, status, value) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(value));
}
export function method(req, res) {
  if (req.method !== 'POST') { json(res, 405, {message:'POST required'}); return false; }
  return true;
}
export function tokenFor(user) { return jwt.sign({sub:user.id, role:user.role}, secret(), {expiresIn:'30d', issuer:'infinyty'}); }
export function modDownloadToken(licenseId, hwidHash) {
  return jwt.sign({licenseId, hwidHash, scope:'mod-download'}, secret(), {expiresIn:'10m', issuer:'infinyty'});
}
export function verifyModDownloadToken(raw) {
  try {
    const payload=jwt.verify(String(raw||''),secret(),{issuer:'infinyty'});
    return payload.scope==='mod-download' ? payload : null;
  } catch { return null; }
}
export async function actor(req) {
  const raw = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!raw) return null;
  try {
    const payload = jwt.verify(raw, secret(), {issuer:'infinyty'});
    const rows = await sql`select id,login,nickname,role,blocked from users where id=${payload.sub} limit 1`;
    return rows[0] && !rows[0].blocked ? rows[0] : null;
  } catch { return null; }
}
export async function requireActor(req, res, admin=false) {
  const user = await actor(req);
  if (!user || (admin && user.role !== 'admin')) { json(res, 401, {message:'Нет доступа'}); return null; }
  return user;
}
export const hashPassword = value => bcrypt.hash(value, 12);
export const verifyPassword = (value, hash) => bcrypt.compare(value, hash);
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
export function newLicenseKey() {
  const raw = crypto.randomBytes(18).toString('base64url').toUpperCase();
  return `INF-${raw.slice(0,6)}-${raw.slice(6,12)}-${raw.slice(12,18)}-${raw.slice(18,24)}`;
}
export function publicUser(u) { return {id:u.id, login:u.login, nickname:u.nickname, admin:u.role === 'admin', role:u.role}; }
export function validLogin(v) { return /^[A-Za-z0-9_]{3,32}$/.test(String(v || '')); }
export function validNickname(v) { return /^[A-Za-z0-9_]{3,16}$/.test(String(v || '')); }
