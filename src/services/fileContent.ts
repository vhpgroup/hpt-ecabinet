// ============================================================
// fileContent.ts — LẤY NỘI DUNG TỆP CHO ĐƯỜNG XEM (ĐỢT 3 object storage)
//
// VÌ SAO CÓ FILE NÀY (cạm bẫy trung tâm):
//   `<iframe src>` / `<img src>` / `<a href download>` KHÔNG gửi được header
//   Authorization -> KHÔNG thể trỏ thẳng vào endpoint `/api/documents/:id/download`
//   (endpoint cần Bearer JWT). Giải pháp: FETCH nội dung có kèm Authorization ->
//   fetch TỰ THEO 302 sang presigned URL của MinIO (hop này không cần auth vì đã
//   ký sẵn) -> nhận Blob -> URL.createObjectURL(blob) -> dùng làm src cho iframe/img/a.
//
//   FALLBACK BẮT BUỘC: nếu hop trình duyệt→MinIO lỗi (MinIO CHƯA mở CORS, hoặc mạng
//   chặn endpoint S3 công khai) thì fetch-theo-redirect ném -> ta gọi lại cùng endpoint
//   với `?mode=stream` (same-origin, backend TỰ kéo bytes từ S3 rồi trả) -> luôn xem được.
//
// TƯƠNG THÍCH NGƯỢC (KHÔNG phá trải nghiệm cũ):
//   - Demo cục bộ / bản ghi cũ / khi bật S3_INLINE_READ=on: server vẫn trả `dataUrl`
//     (document) hoặc `fileData` (guide) base64 -> dùng THẲNG, KHÔNG fetch (giữ hành vi cũ).
//   - Chỉ khi bản ghi có `contentUrl` (đường XEM đợt 3, đã externalize sang S3) mới fetch.
//
// QUẢN LÝ VÒNG ĐỜI objectURL: cache theo id+version (tránh fetch lại + tránh tạo trùng
//   objectURL gây rò bộ nhớ). revoke(key)/revokeAll() để dọn khi đóng modal/thoát trang.
// ============================================================
import { db } from '../data/db';
import { getServerOrigin } from '../data/apiBase';
import type { DocFile, GuideDoc } from '../domain/types';

/** Kết quả nội dung tệp: URL dùng cho iframe/img/a + cờ có phải objectURL (cần revoke) không. */
export interface FileContent {
  /** URL dùng làm src/href (dataUrl base64 hoặc blob: objectURL). */
  url: string;
  /** true nếu là objectURL (blob:) -> cần revoke khi không dùng nữa. */
  isObjectUrl: boolean;
  /** mime (nếu biết) — dùng quyết định xem trước inline (pdf/ảnh). */
  mime?: string;
}

// Cache objectURL đã tạo theo khóa (id@version). Giữ để tái dùng + revoke đúng.
const cache = new Map<string, FileContent>();

/** Khóa cache của 1 document: id + version (version đổi khi tải lại tệp -> URL mới). */
function docKey(doc: Pick<DocFile, 'id' | 'version'>): string {
  return `doc:${doc.id}@${doc.version ?? 1}`;
}

/** Khóa cache của 1 guide: id + updatedAt (guide không có version; updatedAt đổi khi sửa tệp). */
function guideKey(guide: Pick<GuideDoc, 'id' | 'updatedAt'>): string {
  return `guide:${guide.id}@${guide.updatedAt ?? ''}`;
}

/**
 * Dựng URL tuyệt đối cho contentUrl (đường tương đối same-origin "/api/...").
 * - Bản web (base tương đối): getServerOrigin() = location.origin -> "https://web/api/...".
 * - App native (base tuyệt đối "https://host/api"): getServerOrigin() = "https://host"
 *   -> "https://host/api/..." (đúng máy chủ, KHÔNG trỏ vào app).
 * contentUrl luôn bắt đầu bằng "/api/" nên chỉ cần ghép origin.
 */
function absolute(contentUrl: string): string {
  if (/^https?:\/\//i.test(contentUrl)) return contentUrl; // đã tuyệt đối (phòng xa)
  const origin = getServerOrigin();
  const path = contentUrl.startsWith('/') ? contentUrl : '/' + contentUrl;
  return origin ? origin.replace(/\/+$/, '') + path : path;
}

/** Header Authorization từ JWT hiện tại (tái dùng cơ chế token của restAdapter qua db.getToken). */
function authHeaders(): Record<string, string> {
  const token = db.getToken?.() ?? null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Fetch nội dung tệp từ contentUrl -> Blob -> objectURL.
 * Bước 1: fetch(contentUrl) kèm Authorization; fetch TỰ THEO 302 sang presigned MinIO.
 * Bước 2 (FALLBACK): nếu bước 1 ném (CORS/mạng chặn hop→MinIO) -> thử lại `?mode=stream`
 *         (same-origin, backend kéo bytes) -> luôn lấy được nội dung.
 * Ném Error tiếng Việt nếu cả 2 đường đều lỗi (nơi gọi hiện toast + nút thử lại).
 */
async function fetchBlobUrl(contentUrl: string): Promise<FileContent> {
  const base = absolute(contentUrl);
  const headers = authHeaders();

  const toObjectUrl = async (res: Response): Promise<FileContent> => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return { url: URL.createObjectURL(blob), isObjectUrl: true, mime: blob.type || undefined };
  };

  // Bước 1: mặc định (server redirect 302 -> presigned MinIO; fetch tự follow).
  try {
    return await toObjectUrl(await fetch(base, { headers, redirect: 'follow' }));
  } catch {
    // Bước 2 (FALLBACK): ép backend stream bytes qua same-origin (không cần CORS MinIO).
    const sep = base.includes('?') ? '&' : '?';
    const res = await fetch(`${base}${sep}mode=stream`, { headers, redirect: 'follow' });
    return toObjectUrl(res);
  }
}

/**
 * Lấy URL hiển thị/tải nội dung 1 TÀI LIỆU (đường XEM).
 *   (a) doc.dataUrl sẵn (demo / bản ghi cũ / S3_INLINE_READ=on) -> trả thẳng (KHÔNG fetch).
 *   (b) doc.contentUrl có (đã externalize S3) -> fetch (auth) -> Blob -> objectURL, có cache;
 *       lỗi hop→MinIO -> tự thử ?mode=stream.
 * Không có gì để hiển thị (tài liệu soạn tay) -> trả null (nơi gọi hiển thị content text).
 */
export async function getDocContentUrl(doc: DocFile): Promise<FileContent | null> {
  if (doc.dataUrl) return { url: doc.dataUrl, isObjectUrl: false, mime: doc.mime };
  if (!doc.contentUrl) return null;
  const key = docKey(doc);
  const hit = cache.get(key);
  if (hit) return hit;
  const fc = await fetchBlobUrl(doc.contentUrl);
  const withMime: FileContent = { ...fc, mime: doc.mime || fc.mime };
  cache.set(key, withMime);
  return withMime;
}

/**
 * Lấy URL hiển thị/tải nội dung 1 tài liệu HDSD (guide).
 *   (a) guide.fileData sẵn -> trả thẳng. (b) guide.contentUrl -> fetch (auth) -> objectURL.
 */
export async function getGuideContentUrl(guide: GuideDoc): Promise<FileContent | null> {
  if (guide.fileData) return { url: guide.fileData, isObjectUrl: false };
  if (!guide.contentUrl) return null;
  const key = guideKey(guide);
  const hit = cache.get(key);
  if (hit) return hit;
  const fc = await fetchBlobUrl(guide.contentUrl);
  cache.set(key, fc);
  return fc;
}

/** Dọn 1 objectURL đã cache (gọi khi đóng modal xem tài liệu). Bỏ qua nếu không phải objectURL. */
export function revokeDocContent(doc: Pick<DocFile, 'id' | 'version'>): void {
  revokeKey(docKey(doc));
}

export function revokeGuideContent(guide: Pick<GuideDoc, 'id' | 'updatedAt'>): void {
  revokeKey(guideKey(guide));
}

function revokeKey(key: string): void {
  const fc = cache.get(key);
  if (fc?.isObjectUrl) {
    try { URL.revokeObjectURL(fc.url); } catch { /* đã revoke/không hợp lệ */ }
  }
  cache.delete(key);
}

/** Dọn TẤT CẢ objectURL đang cache (vd đăng xuất / rời màn hình lớn). */
export function revokeAllContent(): void {
  for (const fc of cache.values()) {
    if (fc.isObjectUrl) { try { URL.revokeObjectURL(fc.url); } catch { /* ignore */ } }
  }
  cache.clear();
}
