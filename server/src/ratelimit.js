// ============================================================
// RATE LIMIT — cửa sổ trượt đơn giản trong bộ nhớ (GĐ4).
// Toàn cục theo IP + giới hạn riêng cho đăng nhập (chống brute-force).
// Triển khai nhiều instance: thay bằng Redis, giữ nguyên interface hit().
// ============================================================

const buckets = new Map(); // key -> { count, resetAt }

export function hit(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return {
    ok: b.count <= max,
    remaining: Math.max(0, max - b.count),
    retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
  };
}

export function clientIp(req) {
  const fwd = req.headers['x-real-ip'] ?? req.headers['x-forwarded-for'];
  const raw = fwd ? String(fwd) : (req.socket?.remoteAddress ?? 'unknown');
  return raw.split(',')[0].trim();
}

// dọn bucket hết hạn định kỳ
const gc = setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}, 60000);
gc.unref?.();
