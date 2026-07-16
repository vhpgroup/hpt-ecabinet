// ============================================================
// RTC — Mint LiveKit access token (JWT HS256) bằng node:crypto THUẦN.
// KHÔNG cài livekit-server-sdk (giữ nguyên nguyên tắc "không thêm dep npm").
//
// LiveKit access token là JWT HS256, ký bằng LIVEKIT_API_SECRET, payload:
//   iss  = LIVEKIT_API_KEY
//   sub  = identity (định danh người tham gia trong phòng)
//   name = tên hiển thị
//   nbf  = thời điểm bắt đầu hiệu lực (unix giây)
//   exp  = thời điểm hết hạn (unix giây)
//   video = { roomJoin, room, canPublish, canSubscribe, canPublishData }
// Tham khảo cách ký HS256 base64url trong auth.js (signToken).
// ============================================================
import crypto from 'node:crypto';

const b64u = (input) => Buffer.from(input).toString('base64url');

/** Đã cấu hình LiveKit đầy đủ (URL + API key + secret) chưa? */
export function rtcConfigured() {
  return Boolean(
    process.env.LIVEKIT_URL &&
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET,
  );
}

export function rtcUrl() {
  return process.env.LIVEKIT_URL ?? '';
}

/**
 * Ký LiveKit access token (JWT HS256).
 * @param {object} o
 * @param {string} o.identity  định danh người tham gia (bắt buộc, = userId)
 * @param {string} [o.name]    tên hiển thị
 * @param {string} o.room      tên phòng (bắt buộc)
 * @param {number} [o.ttlSec]  thời hạn token (giây), mặc định 6 giờ
 * @returns {string} JWT
 */
export function mintLiveKitToken({ identity, name, room, ttlSec = 6 * 3600 }) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error('RTC chưa cấu hình (thiếu LIVEKIT_API_KEY/SECRET)');
  if (!identity) throw new Error('Thiếu identity');
  if (!room) throw new Error('Thiếu room');

  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = {
    iss: apiKey,
    sub: identity,
    // LiveKit dùng `name` làm tên hiển thị của participant
    ...(name ? { name } : {}),
    nbf: now,
    iat: now,
    exp: now + Math.max(60, ttlSec),
    // Cấu trúc grant BẮT BUỘC đúng của LiveKit
    video: {
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  };
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', apiSecret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}
