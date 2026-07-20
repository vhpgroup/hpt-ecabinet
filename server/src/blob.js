// ============================================================
// TẦNG OBJECT STORAGE (S3/MinIO) — tách nội dung tệp base64 ra khỏi CSDL.
//
// TRIẾT LÝ (giống rtc.js mint JWT LiveKit): KHÔNG thêm dependency npm.
// Ký AWS Signature V4 TỰ VIẾT bằng node:crypto, gọi S3 REST qua fetch().
//
// GATED — TƯƠNG THÍCH NGƯỢC TUYỆT ĐỐI:
//   - KHÔNG đặt đủ env S3 -> configured()=false -> tầng ghi/đọc GIỮ NGUYÊN hành
//     vi cũ (dataUrl base64 nằm trong cột JSON của DB). Demo/dev/test cũ KHÔNG vỡ.
//   - Đặt đủ env (S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY;
//     S3_REGION mặc định 'us-east-1'; S3_FORCE_PATH_STYLE=true cho MinIO)
//     -> file MỚI được PUT lên S3, DB chỉ lưu `storageKey` thay cho `dataUrl`.
//   - Bản ghi CŨ đã có dataUrl base64 vẫn đọc bình thường (không bắt buộc migrate).
//
// API CONTRACT giữ nguyên với frontend: FE vẫn POST/PATCH kèm `dataUrl` base64;
// BACKEND quyết định tách sang S3 (khi bật) rồi dựng lại dataUrl khi FE đọc.
// ============================================================
import crypto from 'node:crypto';

// ---------------- Cấu hình (đọc động từ env — parity rtc.js) ----------------
export function s3Config() {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  if (!endpoint || !bucket || !accessKey || !secretKey) return null;
  return {
    endpoint: endpoint.replace(/\/+$/, ''), // bỏ '/' cuối
    bucket,
    accessKey,
    secretKey,
    region: process.env.S3_REGION || 'us-east-1',
    // MinIO gần như luôn cần path-style (endpoint/bucket/key thay vì bucket.endpoint)
    forcePathStyle: String(process.env.S3_FORCE_PATH_STYLE ?? 'true') !== 'false',
    service: 's3',
  };
}

/** Object storage đã cấu hình đầy đủ chưa? (gate mọi nhánh tách file) */
export function blobConfigured() {
  return s3Config() !== null;
}

// ============================================================
// DATA URI <-> BYTES — HÀM THUẦN, TEST ĐƯỢC KHÔNG CẦN S3.
// dataUrl dạng: "data:<mime>;base64,<payload>"
// ============================================================
const DATA_URI_RE = /^data:([^;,]*)(;[^,]*)?,(.*)$/s;

/** true nếu chuỗi là data URI base64 (điều kiện để tách sang S3). */
export function isDataUri(s) {
  if (typeof s !== 'string' || s.length < 6) return false;
  const m = DATA_URI_RE.exec(s);
  if (!m) return false;
  // chỉ tách khi là base64 (nhị phân tệp) — data:text/plain,abc (không base64) bỏ qua
  return /;base64/i.test(m[2] ?? '');
}

/**
 * Tách data URI base64 -> { mime, bytes(Buffer) }. Ném lỗi nếu không hợp lệ.
 * (dùng khi ghi: decode để PUT lên S3.)
 */
export function decodeDataUri(dataUrl) {
  const m = DATA_URI_RE.exec(String(dataUrl));
  if (!m || !/;base64/i.test(m[2] ?? '')) throw new Error('Không phải data URI base64 hợp lệ');
  const mime = m[1] || 'application/octet-stream';
  const bytes = Buffer.from(m[3], 'base64');
  return { mime, bytes };
}

/** Dựng lại data URI base64 từ bytes + mime (dùng khi đọc: trả cho FE y như cũ). */
export function encodeDataUri(bytes, mime) {
  const b64 = Buffer.from(bytes).toString('base64');
  return `data:${mime || 'application/octet-stream'};base64,${b64}`;
}

/** Phần mở rộng suy từ tên tệp; fallback theo mime; cuối cùng 'bin'. */
export function extFor(name, mime) {
  if (typeof name === 'string') {
    const m = /\.([a-zA-Z0-9]+)$/.exec(name.trim());
    if (m) return m[1].toLowerCase();
  }
  const map = {
    'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg',
    'image/gif': 'gif', 'text/plain': 'txt', 'application/zip': 'zip',
  };
  return map[String(mime)] ?? 'bin';
}

/**
 * Khóa lưu trữ gợi ý cho 1 tài liệu: documents/<docId>/v<version>.<ext>.
 * Ổn định theo version -> lịch sử version không đè nhau (E-HSMT có versioning).
 */
export function documentKey(docId, version, name, mime) {
  const v = Number.isFinite(version) ? version : 1;
  return `documents/${docId}/v${v}.${extFor(name, mime)}`;
}

/** Khóa lưu trữ cho tệp HDSD (guides): guides/<docId>/<ext>. */
export function guideKey(docId, name, mime) {
  return `guides/${docId}/file.${extFor(name, mime)}`;
}

// ============================================================
// AWS SIGNATURE V4 — TỰ VIẾT (node:crypto). CHUẨN AWS.
// Tham chiếu: docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html
// Test bằng TEST VECTOR CHÍNH THỨC (aws-sig-v4-test-suite) — assert từng chuỗi.
// ============================================================
const sha256hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data, 'utf8').digest();

/** RFC 3986 encode cho từng segment (S3 SigV4: KHÔNG encode dấu '/'; encode ~ để nguyên). */
export function uriEncode(str, encodeSlash = true) {
  let out = '';
  for (const ch of Buffer.from(String(str), 'utf8')) {
    const c = String.fromCharCode(ch);
    if ((ch >= 0x41 && ch <= 0x5a) || (ch >= 0x61 && ch <= 0x7a) || (ch >= 0x30 && ch <= 0x39)
        || c === '-' || c === '_' || c === '.' || c === '~') {
      out += c;
    } else if (c === '/') {
      out += encodeSlash ? '%2F' : '/';
    } else {
      out += '%' + ch.toString(16).toUpperCase().padStart(2, '0');
    }
  }
  return out;
}

/** yyyymmdd + iso8601 basic (yyyymmddTHHMMSSZ) từ Date. */
export function amzDates(date) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, ''); // 20130524T000000Z
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

/** Khóa ký phái sinh SigV4 (kDate->kRegion->kService->kSigning). */
export function signingKey(secretKey, dateStamp, region, service) {
  const kDate = hmac('AWS4' + secretKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

/**
 * Ký 1 request S3 (SigV4, header-based). HÀM THUẦN (không I/O) -> test vector được.
 * @param {object} o
 *   method, canonicalUri (đã là path tuyệt đối, vd '/bucket/key'), query{},
 *   headers{} (LOWERCASE keys; phải gồm host), payloadHash (hex sha256 body hoặc 'UNSIGNED-PAYLOAD'),
 *   accessKey, secretKey, region, service, date(Date)
 * @returns {{ authorization, amzDate, signedHeaders, canonicalRequest, stringToSign, signature }}
 */
export function signRequestV4(o) {
  const { amzDate, dateStamp } = amzDates(o.date);
  const headers = { ...o.headers };

  // Canonical headers: sort theo tên (lowercase), trim value, gộp khoảng trắng trong.
  const sortedKeys = Object.keys(headers).map((k) => k.toLowerCase()).sort();
  const canonicalHeaders = sortedKeys
    .map((k) => `${k}:${String(headers[k]).trim().replace(/\s+/g, ' ')}\n`)
    .join('');
  const signedHeaders = sortedKeys.join(';');

  // Canonical query string: encode key & value, sort theo key đã encode.
  const q = o.query ?? {};
  const canonicalQuery = Object.keys(q)
    .map((k) => [uriEncode(k), uriEncode(q[k])])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const canonicalRequest = [
    o.method,
    o.canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    o.payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${o.region}/${o.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256hex(canonicalRequest),
  ].join('\n');

  const key = signingKey(o.secretKey, dateStamp, o.region, o.service);
  const signature = crypto.createHmac('sha256', key).update(stringToSign, 'utf8').digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${o.accessKey}/${scope}, `
    + `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { authorization, amzDate, signedHeaders, canonicalRequest, stringToSign, signature };
}

// ============================================================
// S3 REST CLIENT (fetch) — dùng SigV4 ở trên. GET/PUT/DELETE object.
// ============================================================
/** Dựng URL + canonicalUri (path-style) cho 1 key. */
function s3Target(cfg, key) {
  const u = new URL(cfg.endpoint);
  // path-style: <endpoint>/<bucket>/<key>. (virtual-host style hiếm dùng với MinIO.)
  const bucketSeg = cfg.forcePathStyle ? `/${cfg.bucket}` : '';
  const host = cfg.forcePathStyle ? u.host : `${cfg.bucket}.${u.host}`;
  // encode từng segment của key nhưng GIỮ '/'
  const encKey = key.split('/').map((s) => uriEncode(s, false)).join('/');
  const canonicalUri = `${bucketSeg}/${encKey}`;
  const href = `${u.protocol}//${host}${canonicalUri}`;
  return { host, canonicalUri, href };
}

async function s3Fetch(method, key, { body, contentType } = {}) {
  const cfg = s3Config();
  if (!cfg) throw new Error('S3 chưa cấu hình');
  const { host, canonicalUri, href } = s3Target(cfg, key);
  const payload = body ?? Buffer.alloc(0);
  const payloadHash = sha256hex(payload);
  const date = new Date();
  const headers = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDates(date).amzDate,
  };
  if (method === 'PUT' && contentType) headers['content-type'] = contentType;

  const { authorization } = signRequestV4({
    method, canonicalUri, query: {}, headers, payloadHash,
    accessKey: cfg.accessKey, secretKey: cfg.secretKey,
    region: cfg.region, service: cfg.service, date,
  });

  const fetchHeaders = { ...headers, Authorization: authorization };
  const res = await fetch(href, {
    method,
    headers: fetchHeaders,
    body: method === 'GET' || method === 'DELETE' ? undefined : payload,
  });
  return res;
}

/**
 * blobStore — hợp đồng tầng lưu trữ nhị phân.
 *   configured() -> boolean
 *   put(key, bytes, contentType) -> void (ném nếu lỗi)
 *   get(key) -> Buffer (ném nếu 404/lỗi)
 *   delete(key) -> void (idempotent — 404 coi như OK)
 * Khi S3 tắt: configured()=false; các hàm put/get/delete KHÔNG được gọi (điểm móc
 * kiểm configured() trước) — gọi nhầm sẽ ném để lộ lỗi lập trình sớm.
 */
export const blobStore = {
  configured: blobConfigured,

  async put(key, bytes, contentType) {
    const res = await s3Fetch('PUT', key, { body: Buffer.from(bytes), contentType });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`S3 PUT ${key} thất bại: ${res.status} ${text.slice(0, 200)}`);
    }
  },

  async get(key) {
    const res = await s3Fetch('GET', key);
    if (!res.ok) {
      throw new Error(`S3 GET ${key} thất bại: ${res.status}`);
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  },

  async delete(key) {
    const res = await s3Fetch('DELETE', key);
    // S3 trả 204 khi xóa thành công; 404 (không tồn tại) cũng coi như đã xóa.
    if (!res.ok && res.status !== 404) {
      throw new Error(`S3 DELETE ${key} thất bại: ${res.status}`);
    }
  },
};

// ============================================================
// TÁCH / DỰNG — HÀM THUẦN dùng blobStore (bơm store để test in-memory).
// KHÔNG phụ thuộc trực tiếp S3 -> unit test round-trip không cần mạng.
// ============================================================

/**
 * Khi GHI 1 document: nếu S3 bật và bản ghi có dataUrl base64 -> PUT lên S3,
 * set storageKey + size, XÓA dataUrl khỏi bản ghi lưu DB. Trả về bản ghi ĐÃ SỬA
 * (đột biến tại chỗ để dùng chung đường ghi hiện có).
 * store: mặc định blobStore thật; test truyền store in-memory.
 * doc PHẢI có id (để dựng key). Không có dataUrl/không phải data URI -> trả nguyên.
 */
export async function externalizeDocumentWrite(doc, store = blobStore) {
  if (!store.configured() || !doc || typeof doc !== 'object') return doc;
  if (!isDataUri(doc.dataUrl)) return doc;
  const { mime, bytes } = decodeDataUri(doc.dataUrl);
  const key = documentKey(doc.id, doc.version, doc.name, doc.mime || mime);
  await store.put(key, bytes, doc.mime || mime);
  doc.storageKey = key;
  if (typeof doc.size !== 'number' || doc.size <= 0) doc.size = bytes.length;
  delete doc.dataUrl; // KHÔNG lưu base64 trong DB nữa
  return doc;
}

/**
 * Khi ĐỌC 1 document: nếu bản ghi có storageKey (đã tách sang S3) và CHƯA có dataUrl
 * -> GET từ S3, dựng lại dataUrl base64 cho client (FE hiển thị y như cũ).
 * Trả BẢN SAO (không đột biến bản ghi trong DB/cache). Lỗi S3 -> ném (nơi gọi xử lý).
 * Bản ghi cũ (chỉ có dataUrl, không storageKey) -> trả nguyên (tương thích ngược).
 */
export async function inlineDocumentRead(doc, store = blobStore) {
  if (!doc || typeof doc !== 'object') return doc;
  if (!doc.storageKey || doc.dataUrl) return doc;
  if (!store.configured()) return doc; // S3 tắt: không dựng được -> trả metadata (dataUrl vắng)
  const bytes = await store.get(doc.storageKey);
  const out = { ...doc };
  out.dataUrl = encodeDataUri(bytes, doc.mime);
  return out;
}

/** Guides: song song document nhưng dùng field fileData/fileName (E-HSMT mục 4). */
export async function externalizeGuideWrite(guide, store = blobStore) {
  if (!store.configured() || !guide || typeof guide !== 'object') return guide;
  if (!isDataUri(guide.fileData)) return guide;
  const { mime, bytes } = decodeDataUri(guide.fileData);
  const key = guideKey(guide.id, guide.fileName, mime);
  await store.put(key, bytes, mime);
  guide.storageKey = key;
  delete guide.fileData;
  return guide;
}

export async function inlineGuideRead(guide, store = blobStore) {
  if (!guide || typeof guide !== 'object') return guide;
  if (!guide.storageKey || guide.fileData) return guide;
  if (!store.configured()) return guide;
  const bytes = await store.get(guide.storageKey);
  const out = { ...guide };
  // mime của guide không lưu riêng -> suy từ đuôi storageKey (đủ để FE tải xuống)
  out.fileData = encodeDataUri(bytes, mimeFromKey(guide.storageKey));
  return out;
}

function mimeFromKey(key) {
  const ext = /\.([a-zA-Z0-9]+)$/.exec(String(key))?.[1]?.toLowerCase();
  const map = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain', zip: 'application/zip' };
  return map[ext] ?? 'application/octet-stream';
}
