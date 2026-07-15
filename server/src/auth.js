// ============================================================
// XÁC THỰC — JWT HS256 + băm mật khẩu scrypt (node:crypto thuần,
// không phụ thuộc thư viện ngoài).
// ============================================================
import crypto from 'node:crypto';
import { send } from './util.js';

const SECRET = process.env.JWT_SECRET || 'ecabinet-dev-secret-change-me';
// GĐ4: access token ngắn hạn (1 giờ) — gia hạn bằng refresh token xoay vòng
const TTL = Number(process.env.JWT_TTL || 3600);

if (!process.env.JWT_SECRET) {
  console.warn('[auth] ⚠ Chưa đặt JWT_SECRET — đang dùng khóa dev. BẮT BUỘC đổi khi triển khai thật.');
}

// ---------- Mật khẩu (scrypt) ----------
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored ?? '').split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(String(password), salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
  } catch {
    return false;
  }
}

// ---------- JWT HS256 ----------
const b64u = (input) => Buffer.from(input).toString('base64url');

export function signToken(payload) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ ...payload, iat: now, exp: now + TTL }));
  const sig = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token) {
  const [h, b, s] = String(token ?? '').split('.');
  if (!h || !b || !s) return null;
  const expect = crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expect))) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload; // { sub, role, name, iat, exp }
  } catch {
    return null;
  }
}

// ---------- Middleware ----------
export function requireAuth(req, res) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    send(res, 401, { error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn' });
    return;
  }
  req.user = payload;
}

export function requireAdmin(req, res) {
  if (req.user?.role !== 'admin') {
    send(res, 403, { error: 'Chỉ quản trị viên được thực hiện thao tác này' });
  }
}
