// ============================================================
// apiBase.ts — GIẢI QUYẾT ĐỊA CHỈ MÁY CHỦ LÚC CHẠY (RUNTIME).
//
// Vì sao cần: bản web chạy CÙNG origin với máy chủ nên base "/api"
// tương đối và URL WebSocket suy từ location.origin đều đúng. Nhưng
// app native (Capacitor) nạp từ capacitor://localhost / https://localhost
// — KHÔNG cùng origin với máy chủ — nên "/api" và WS suy từ location
// sẽ trỏ vào chính app, gây HỎNG. Do đó địa chỉ máy chủ phải cấu hình
// được LÚC CHẠY, không đóng cứng lúc build.
//
// Thứ tự ưu tiên khi phân giải base:
//   1) localStorage['ecabinet.serverUrl']  (người dùng nhập trong app)
//   2) import.meta.env.VITE_API_URL         (đóng cứng lúc build, nếu có)
//   3) ''                                    (rỗng = demo cục bộ, cùng origin)
//
// CONTRACT KHÔNG ĐỔI: path "/api/...", header Authorization, shape body,
// path WebSocket "/realtime" giữ nguyên — file này CHỈ đổi cách RESOLVE
// base URL, không đổi giao thức.
// ============================================================

/** Khóa lưu địa chỉ máy chủ do người dùng chọn (namespace riêng, khác ecab.*) */
export const SERVER_URL_KEY = 'ecabinet.serverUrl';

// Giá trị VITE_API_URL đóng cứng lúc build. Viết ĐÚNG member-expression
// "import.meta.env.VITE_API_URL" để esbuild thay bằng --define lúc build
// (scripts/build-cdn.mjs). Nếu không đặt -> esbuild làm rỗng "import.meta" ({}),
// nên bọc try/catch + optional chaining để runtime không ném lỗi.
function buildTimeApiUrl(): string {
  try {
    // @ts-expect-error: import.meta.env do bundler chèn (không có kiểu ở es2018)
    const v = import.meta.env.VITE_API_URL;
    return typeof v === 'string' ? v : '';
  } catch {
    return '';
  }
}

/** true khi bản build KHÔNG đóng cứng máy chủ (VITE_API_URL rỗng) — tức bản demo cục bộ. */
export function isLocalBuild(): boolean {
  return !buildTimeApiUrl();
}

// storage an toàn: một số WebView/iframe chặn localStorage -> đọc/ghi không được ném lỗi
function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* sandbox/quota */ }
}
function lsRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/**
 * Chuẩn hóa địa chỉ máy chủ người dùng nhập về dạng base "/api":
 *  - trim khoảng trắng, bỏ mọi dấu "/" ở cuối
 *  - nếu ĐÃ kết thúc bằng "/api" (hoặc "/api/…") -> giữ tới "/api"
 *  - nếu chỉ là gốc domain (vd https://host) -> tự thêm "/api"
 *  - chuỗi rỗng -> trả '' (demo cục bộ)
 *
 * Ví dụ:
 *   "https://ecab.gov.vn/"      -> "https://ecab.gov.vn/api"
 *   "https://ecab.gov.vn/api"   -> "https://ecab.gov.vn/api"
 *   "https://ecab.gov.vn/api/"  -> "https://ecab.gov.vn/api"
 *   "http://192.168.1.9:8080"   -> "http://192.168.1.9:8080/api"
 */
export function normalizeServerUrl(raw: string | null | undefined): string {
  if (!raw) return '';
  let u = String(raw).trim();
  if (!u) return '';
  // bỏ dấu "/" thừa ở cuối
  u = u.replace(/\/+$/, '');
  if (!u) return '';
  // đã kết thúc bằng /api (không phân biệt hoa thường) -> chuẩn về đúng "…/api"
  const m = u.match(/^(.*?)(\/api)(\/.*)?$/i);
  if (m) return m[1] + '/api';
  // chỉ là gốc -> thêm /api
  return u + '/api';
}

/** Địa chỉ máy chủ THÔ do người dùng lưu (đã chuẩn hóa về "…/api"), hoặc null nếu chưa đặt. */
export function getServerUrl(): string | null {
  const v = normalizeServerUrl(lsGet(SERVER_URL_KEY));
  return v || null;
}

/** Lưu (chuẩn hóa) hoặc xóa địa chỉ máy chủ. Gọi xong nên location.reload(). */
export function setServerUrl(url: string | null): void {
  if (url == null) { lsRemove(SERVER_URL_KEY); return; }
  const norm = normalizeServerUrl(url);
  if (!norm) { lsRemove(SERVER_URL_KEY); return; }
  lsSet(SERVER_URL_KEY, norm);
}

/**
 * Base URL dùng cho REST (đúng chuẩn "/api" tương đối HOẶC "https://host/api").
 * Ưu tiên: localStorage > VITE_API_URL (build) > '' (demo cùng origin).
 */
export function getApiBase(): string {
  const fromLs = getServerUrl();
  if (fromLs) return fromLs;
  const fromEnv = buildTimeApiUrl();
  if (fromEnv) return fromEnv;
  // hỗ trợ chèn runtime qua biến toàn cục (giữ tương thích db.ts cũ)
  const g = (globalThis as Record<string, unknown>).__ECABINET_API_URL__;
  if (typeof g === 'string' && g) return g;
  return '';
}

/** true khi base là địa chỉ TUYỆT ĐỐI (http/https) — tức đang trỏ máy chủ khác origin (app native). */
export function isRemote(): boolean {
  return /^https?:\/\//i.test(getApiBase());
}

/** Gốc (origin) của máy chủ, KHÔNG kèm "/api" — dùng cho các endpoint ở gốc như /health. */
export function getServerOrigin(): string {
  const base = getApiBase();
  if (!base) return typeof location !== 'undefined' ? location.origin : '';
  const m = base.match(/^(https?:\/\/[^/]+)/i);
  if (m) return m[1];            // base tuyệt đối -> lấy scheme://host:port
  return typeof location !== 'undefined' ? location.origin : ''; // base tương đối -> origin hiện tại
}

/**
 * Dựng URL WebSocket realtime từ base + path (mặc định "/realtime").
 *  - base tuyệt đối "https://host/api" -> "wss://host/api/realtime"
 *  - base tuyệt đối "http://host/api"  -> "ws://host/api/realtime"
 *  - base tương đối "/api" (hoặc rỗng) -> GIỮ HÀNH VI CŨ: suy từ location.origin
 *    ("/api/realtime" tương đối, realtime.ts sẽ ghép location.origin + đổi http->ws)
 *
 * Trả về CHUỖI có thể truyền thẳng cho WebSocket. Với base tương đối, trả về
 * đường tương đối "/api/realtime" để realtime.ts giữ nguyên logic location cũ.
 */
export function wsUrl(path = '/realtime'): string {
  const base = getApiBase();
  const p = path.startsWith('/') ? path : '/' + path;
  if (/^https?:\/\//i.test(base)) {
    // tuyệt đối: đổi http(s) -> ws(s), giữ nguyên host + "/api" + path
    const full = base.replace(/\/+$/, '') + p;
    return full.replace(/^http/i, 'ws');
  }
  // tương đối: giữ hành vi cũ — realtime.ts sẽ tự ghép location.origin
  const rel = (base || '').replace(/\/+$/, '') + p; // vd "/api" + "/realtime" = "/api/realtime"
  return rel || p;
}
