// ============================================================
// PHIÊN REFRESH TOKEN (GĐ4)
// - Token ngẫu nhiên 256-bit, chỉ lưu BĂM SHA-256 trong bảng c_sessions
//   -> lộ CSDL cũng không dùng lại được token
// - XOAY VÒNG: mỗi lần refresh, token cũ bị xóa và cấp token mới
// - Thu hồi được khi đăng xuất; tự dọn phiên hết hạn
// ============================================================
import crypto from 'node:crypto';
import { query } from './db.js';

const REFRESH_TTL_SEC = Number(process.env.REFRESH_TTL_SEC ?? 7 * 24 * 3600); // mặc định 7 ngày

const hashToken = (t) => crypto.createHash('sha256').update(String(t ?? '')).digest('hex');

export async function issueRefreshToken(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000).toISOString();
  await query(
    `INSERT INTO c_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
    [hashToken(token), userId, expiresAt],
  );
  return token;
}

/**
 * Đổi refresh token lấy phiên mới (rotation).
 * Trả về userId nếu hợp lệ; null nếu sai/hết hạn/đã dùng.
 */
export async function rotateRefreshToken(token) {
  const id = hashToken(token);
  const r = await query(`SELECT user_id, expires_at FROM c_sessions WHERE id = $1`, [id]);
  const row = r.rows[0];
  // dù hợp lệ hay không cũng xóa: token chỉ dùng một lần
  await query(`DELETE FROM c_sessions WHERE id = $1`, [id]);
  await query(`DELETE FROM c_sessions WHERE expires_at < now()`); // dọn rác
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row.user_id;
}

export async function revokeRefreshToken(token) {
  await query(`DELETE FROM c_sessions WHERE id = $1`, [hashToken(token)]);
}

export async function revokeAllSessions(userId) {
  await query(`DELETE FROM c_sessions WHERE user_id = $1`, [userId]);
}
