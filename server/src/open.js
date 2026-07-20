// ============================================================
// BỘ API CÔNG BỐ CHO BÊN THỨ 3 (E-HSMT Hải Phòng mục 54–59)
// Mount tại /api/open/v1/... — TRƯỚC route CRUD chung /api/:collection.
//
// Xác thực: header "X-API-Key: <key>" hoặc "Authorization: ApiKey <key>".
//   sha256(key) -> tìm apiKeys active có keyHash khớp -> gắn req.apiKey.
//   Sai/thiếu -> 401. /spec: công khai. /health: vẫn cần khóa.
// Rate-limit theo prefix khóa. Ghi nhận sử dụng (lastUsedAt + callCount)
//   fire-and-forget, không chặn response.
// CORS: cho phép mọi origin GET (Access-Control-Allow-Origin: *) trên /api/open/*.
//
// THIẾT KẾ TEST ĐƯỢC: toàn bộ nghiệp vụ tách thành HÀM THUẦN
//   handleXxx(params, query, accessors) -> { status, body }
// (accessors: { meetings, meeting(id), users, user(id), units, unit(id),
//   rooms, room(id), documents, meetingDocs(id), document(id), votes,
//   meetingVotes(id) }). Router chỉ nạp accessors từ DB rồi gọi hàm thuần.
// ============================================================
import crypto from 'node:crypto';
import { query } from './db.js';
import { hit } from './ratelimit.js';
import { buildOpenApiSpec, OPEN_API_VERSION, SERVICE_NAME } from './openapi.js';
import { blobStore, encodeDataUri, downloadModeFrom, presignTtlSec, mimeFromKey } from './blob.js';

const sha256 = (t) => crypto.createHash('sha256').update(String(t), 'utf8').digest('hex');

// Rate-limit riêng cho API mở (mặc định 120 req/phút theo prefix)
const OPEN_RATE_MAX = Number(process.env.OPEN_RATE_MAX ?? 120);
const OPEN_RATE_WINDOW = Number(process.env.OPEN_RATE_WINDOW_MS ?? 60000);

const BASE = `/api/open/${OPEN_API_VERSION}`;

// ---------------- Tiện ích phản hồi JSON UTF-8 + CORS mở ----------------
function sendOpen(res, status, obj) {
  if (res.writableEnded) return;
  const body = JSON.stringify(obj ?? {});
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    // Open API phục vụ máy-máy: cho phép mọi origin GET (khác CORS_ORIGIN của app)
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'X-API-Key, Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

// ---------------- Phân trang ----------------
/** Chuẩn hóa page/size từ query (?page=1&size=20, size tối đa 100). */
export function parsePaging(query) {
  const rawPage = Number(query?.get ? query.get('page') : query?.page);
  const rawSize = Number(query?.get ? query.get('size') : query?.size);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  let size = Number.isFinite(rawSize) && rawSize >= 1 ? Math.floor(rawSize) : 20;
  if (size > 100) size = 100;
  return { page, size };
}

/** Cắt trang cho 1 mảng đã sắp xếp -> gói {page,size,total,totalPages,items}. */
function paginate(all, page, size) {
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const start = (page - 1) * size;
  return { page, size, total, totalPages, items: all.slice(start, start + size) };
}

// ---------------- Suy diễn thời gian / phạm vi ----------------
const isFinished = (m) => m.status === 'finished' || m.status === 'cancelled';

/**
 * "Sắp diễn ra" = chưa kết thúc VÀ (đang diễn ra HOẶC thời gian bắt đầu >= now HOẶC chưa qua thời gian kết thúc).
 * Dùng cả trạng thái nghiệp vụ (status) lẫn mốc thời gian để bao trọn dữ liệu.
 */
function isUpcoming(m, now) {
  if (isFinished(m)) return false;
  if (m.status === 'live') return true;
  const end = m.endTime ? Date.parse(m.endTime) : NaN;
  const start = m.startTime ? Date.parse(m.startTime) : NaN;
  if (Number.isFinite(end)) return end >= now;          // chưa qua giờ kết thúc
  if (Number.isFinite(start)) return start >= now;      // hoặc chưa tới giờ bắt đầu
  return true;                                          // thiếu mốc -> coi như sắp tới
}

/** "Đã diễn ra" = đã kết thúc HOẶC đã qua thời gian kết thúc. */
function isPast(m, now) {
  if (isFinished(m)) return true;
  const end = m.endTime ? Date.parse(m.endTime) : NaN;
  if (Number.isFinite(end)) return end < now && m.status !== 'live';
  return false;
}

const byStartAsc = (a, b) => String(a.startTime ?? '').localeCompare(String(b.startTime ?? ''));
const byStartDesc = (a, b) => String(b.startTime ?? '').localeCompare(String(a.startTime ?? ''));

/**
 * Đơn vị có liên quan cuộc họp: chủ trì/thư ký thuộc đơn vị HOẶC có thành phần thuộc đơn vị.
 * EXPORT (P0-1): tái sử dụng ở access.js để cô lập dữ liệu theo đơn vị ở API nội bộ
 * (không chỉ Open API bên thứ 3) — tránh viết lại logic 2 nơi, tránh trôi (drift) hành vi.
 */
export function meetingInvolvesUnit(m, unitId, unitOfUser) {
  if (!unitId) return false;
  if (unitOfUser(m.chairId) === unitId) return true;
  if (unitOfUser(m.secretaryId) === unitId) return true;
  return (m.participants ?? []).some((p) => unitOfUser(p.userId) === unitId);
}

/** Cá nhân là thành phần cuộc họp (chủ trì/thư ký cũng nằm trong participants ở dữ liệu này). */
function meetingInvolvesUser(m, userId) {
  if (m.chairId === userId || m.secretaryId === userId) return true;
  return (m.participants ?? []).some((p) => p.userId === userId);
}

// ---------------- Chiếu payload gọn cho item cuộc họp ----------------
function meetingItem(m, ctx) {
  return {
    id: m.id,
    title: m.title,
    meetingType: m.meetingType ?? null,
    status: m.status,
    startTime: m.startTime,
    endTime: m.endTime,
    room: ctx.roomName(m.roomId) ?? null,
    chairName: ctx.userName(m.chairId) ?? null,
    hostUnit: ctx.unitName(ctx.unitOfUser(m.chairId)) ?? null,
    participantCount: (m.participants ?? []).length,
  };
}

/** Ngữ cảnh tra cứu tên (đơn vị/người/phòng) dựng từ accessors đồng bộ. */
function buildLookup(accessors) {
  const users = accessors.users;
  const units = accessors.units;
  const rooms = accessors.rooms;
  const userById = new Map(users.map((u) => [u.id, u]));
  const unitById = new Map(units.map((u) => [u.id, u]));
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  return {
    unitOfUser: (uid) => userById.get(uid)?.unitId ?? null,
    userName: (uid) => userById.get(uid)?.fullName ?? null,
    unitName: (unitId) => (unitId ? unitById.get(unitId)?.name ?? null : null),
    unitShort: (unitId) => (unitId ? unitById.get(unitId)?.short ?? null : null),
    roomName: (roomId) => roomById.get(roomId)?.name ?? null,
    userById,
    unitById,
  };
}

// ============================================================
// HÀM THUẦN — NGHIỆP VỤ (test không cần HTTP)
// ============================================================

/** 54/56: danh sách cuộc họp của ĐƠN VỊ (upcoming|past). */
export function handleUnitMeetings(kind, params, query, accessors) {
  const now = accessors.now ?? Date.now();
  const lk = buildLookup(accessors);
  const unitId = params.unitId;
  if (!lk.unitById.has(unitId)) return { status: 404, body: { error: 'Không tìm thấy đơn vị' } };
  const { page, size } = parsePaging(query);
  const pred = kind === 'past' ? isPast : isUpcoming;
  const sorter = kind === 'past' ? byStartDesc : byStartAsc;
  const all = accessors.meetings
    .filter((m) => pred(m, now) && meetingInvolvesUnit(m, unitId, lk.unitOfUser))
    .sort(sorter)
    .map((m) => meetingItem(m, lk));
  return { status: 200, body: paginate(all, page, size) };
}

/** 55/57: danh sách cuộc họp của CÁ NHÂN (upcoming|past). */
export function handleUserMeetings(kind, params, query, accessors) {
  const now = accessors.now ?? Date.now();
  const lk = buildLookup(accessors);
  const userId = params.userId;
  if (!lk.userById.has(userId)) return { status: 404, body: { error: 'Không tìm thấy người dùng' } };
  const { page, size } = parsePaging(query);
  const pred = kind === 'past' ? isPast : isUpcoming;
  const sorter = kind === 'past' ? byStartDesc : byStartAsc;
  const all = accessors.meetings
    .filter((m) => pred(m, now) && meetingInvolvesUser(m, userId))
    .sort(sorter)
    .map((m) => meetingItem(m, lk));
  return { status: 200, body: paginate(all, page, size) };
}

/**
 * 58: thông tin đầy đủ 1 cuộc họp — meta + agenda + participants + thống kê biểu quyết.
 * KHÔNG kèm minutes/conclusions chi tiết/ballots cá nhân.
 */
export function handleMeetingDetail(params, query, accessors) {
  const m = accessors.meeting(params.id);
  if (!m) return { status: 404, body: { error: 'Không tìm thấy cuộc họp' } };
  const lk = buildLookup(accessors);

  // Chương trình: tiêu đề, thời lượng, trạng thái (dựa currentAgendaItemId).
  const curId = m.currentAgendaItemId ?? null;
  const orderOfCur = (m.agenda ?? []).find((a) => a.id === curId)?.order ?? null;
  const agenda = (m.agenda ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((a) => {
      let status = 'pending';
      if (m.status === 'finished') status = 'done';
      else if (curId && a.id === curId) status = 'current';
      else if (orderOfCur != null && (a.order ?? 0) < orderOfCur) status = 'done';
      return { id: a.id, order: a.order ?? 0, title: a.title, durationMinutes: a.durationMinutes ?? 0, status };
    });

  // Thành phần: tên, đơn vị, vai trò, trạng thái xác nhận, điểm danh.
  const participants = (m.participants ?? []).map((p) => ({
    userId: p.userId,
    name: lk.userName(p.userId) ?? p.userId,
    unit: lk.unitShort(lk.unitOfUser(p.userId)) ?? null,
    role: p.meetingRole,
    attendStatus: p.attendStatus,
    checkedIn: !!p.checkedInAt,
  }));

  // Thống kê biểu quyết TỔNG HỢP (không lộ phiếu cá nhân).
  const votes = accessors.meetingVotes(m.id);
  const voteItems = votes.map((v) => ({
    id: v.id,
    title: v.title,
    status: v.status,
    eligibleCount: (v.eligibleIds ?? []).length,
    ballotCount: (v.ballots ?? []).length,
    outcome: summarizeOutcome(v),
  }));
  const voteSummary = {
    total: votes.length,
    open: votes.filter((v) => v.status === 'open').length,
    closed: votes.filter((v) => v.status === 'closed').length,
    pending: votes.filter((v) => v.status === 'pending').length,
    items: voteItems,
  };

  const body = {
    id: m.id,
    code: m.code,
    title: m.title,
    description: m.description ?? '',
    meetingType: m.meetingType ?? null,
    status: m.status,
    startTime: m.startTime,
    endTime: m.endTime,
    room: lk.roomName(m.roomId) ?? null,
    isOnline: !!m.isOnline,
    chairName: lk.userName(m.chairId) ?? null,
    secretaryName: lk.userName(m.secretaryId) ?? null,
    hostUnit: lk.unitName(lk.unitOfUser(m.chairId)) ?? null,
    agenda,
    participants,
    voteSummary,
  };
  return { status: 200, body };
}

/**
 * Kết quả tổng hợp 1 biểu quyết ĐÃ ĐÓNG (chuỗi mô tả gọn); chưa đóng -> null.
 * Ngưỡng: majority (mặc định) / two_thirds / all. approve = approveOptionId hoặc options[0].
 */
function summarizeOutcome(v) {
  if (v.status !== 'closed') return null;
  const total = (v.eligibleIds ?? []).length;
  const approveId = v.approveOptionId ?? v.options?.[0]?.id;
  const approve = (v.ballots ?? []).filter((b) => b.optionId === approveId).length;
  const threshold = v.passThreshold ?? 'majority';
  let need;
  if (threshold === 'all') need = total;
  else if (threshold === 'two_thirds') need = Math.ceil((total * 2) / 3);
  else need = Math.floor(total / 2) + 1;
  const passed = total > 0 && approve >= need;
  return `${passed ? 'Thông qua' : 'Không thông qua'} (${approve}/${total} tán thành)`;
}

/** Lọc tài liệu công bố được: ĐÃ DUYỆT (approved|undefined) và KHÔNG MẬT. */
export function isPublishableDoc(d) {
  if (d.secret) return false;
  if (d.reviewStatus !== undefined && d.reviewStatus !== 'approved') return false;
  return true;
}

/** 59: danh sách tài liệu ĐÃ DUYỆT + KHÔNG MẬT của cuộc họp (metadata + contentUrl). */
export function handleMeetingDocuments(params, query, accessors) {
  const m = accessors.meeting(params.id);
  if (!m) return { status: 404, body: { error: 'Không tìm thấy cuộc họp' } };
  const docs = accessors.meetingDocs(m.id).filter(isPublishableDoc);
  const items = docs.map((d) => ({
    id: d.id,
    name: d.name,
    kind: d.kind,
    agendaItemId: d.agendaItemId ?? null,
    issuingBody: d.issuingBody ?? null,
    version: d.version ?? 1,
    size: typeof d.size === 'number' ? d.size : null,
    mime: d.mime ?? null,
    contentUrl: `${BASE}/documents/${encodeURIComponent(d.id)}/content`,
  }));
  return { status: 200, body: { meetingId: m.id, total: items.length, items } };
}

/** 59: nội dung 1 tài liệu (cùng điều kiện lọc: đã duyệt + không mật). */
export function handleDocumentContent(params, query, accessors) {
  const d = accessors.document(params.id);
  if (!d || !isPublishableDoc(d)) return { status: 404, body: { error: 'Không tìm thấy tài liệu' } };
  return {
    status: 200,
    body: {
      id: d.id,
      name: d.name,
      mime: d.mime ?? null,
      content: d.content ?? null,
      dataUrl: d.dataUrl ?? null,
      // Tách file (GĐ3): storageKey NỘI BỘ — router sẽ dựng lại dataUrl từ S3 rồi
      // XÓA field này trước khi trả cho bên thứ 3 (KHÔNG lộ khóa S3 ra ngoài).
      storageKey: d.storageKey ?? null,
    },
  };
}

// ============================================================
// XÁC THỰC KHÓA API (tách hàm thuần để test)
// ============================================================
/** Trích key thô từ header. Ưu tiên X-API-Key; hoặc "Authorization: ApiKey <key>". */
export function extractApiKey(headers) {
  const x = headers['x-api-key'] ?? headers['X-API-Key'];
  if (x) return String(x).trim();
  const auth = headers['authorization'] ?? '';
  const m = /^ApiKey\s+(.+)$/i.exec(String(auth).trim());
  return m ? m[1].trim() : null;
}

/**
 * Đối chiếu key thô với danh sách apiKeys. Trả { ok, record?, status?, error? }.
 * - thiếu key -> 401
 * - không khớp / không active -> 401 (không phân biệt để tránh dò)
 * - thiếu scope yêu cầu -> 403
 */
export function authenticateApiKey(rawKey, apiKeys, requiredScope) {
  if (!rawKey) return { ok: false, status: 401, error: 'Thiếu khóa API (header X-API-Key)' };
  const hash = sha256(rawKey);
  const record = apiKeys.find((k) => k.active && k.keyHash === hash);
  if (!record) return { ok: false, status: 401, error: 'Khóa API không hợp lệ hoặc đã bị thu hồi' };
  if (requiredScope && !(record.scopes ?? []).includes(requiredScope)) {
    return { ok: false, status: 403, error: `Khóa API không có quyền "${requiredScope}"` };
  }
  return { ok: true, record };
}

// ============================================================
// NẠP ACCESSORS TỪ DB (dùng cho router thật)
// ============================================================
async function loadAccessors() {
  const [mres, ures, unres, rres, dres, vres] = await Promise.all([
    query('SELECT data FROM c_meetings'),
    query('SELECT data FROM c_users'),
    query('SELECT data FROM c_units'),
    query('SELECT data FROM c_rooms'),
    query('SELECT data FROM c_documents'),
    query('SELECT data FROM c_votes'),
  ]);
  const meetings = mres.rows.map((r) => r.data);
  const users = ures.rows.map((r) => r.data);
  const units = unres.rows.map((r) => r.data);
  const rooms = rres.rows.map((r) => r.data);
  const documents = dres.rows.map((r) => r.data);
  const votes = vres.rows.map((r) => r.data);
  const meetingById = new Map(meetings.map((m) => [m.id, m]));
  const docById = new Map(documents.map((d) => [d.id, d]));
  return {
    now: Date.now(),
    meetings, users, units, rooms, documents, votes,
    meeting: (id) => meetingById.get(id),
    document: (id) => docById.get(id),
    meetingDocs: (id) => documents.filter((d) => d.meetingId === id),
    meetingVotes: (id) => votes.filter((v) => v.meetingId === id),
  };
}

/** Nạp riêng danh sách khóa API (dùng cho xác thực). */
async function loadApiKeys() {
  const r = await query('SELECT data FROM c_apikeys');
  return r.rows.map((x) => x.data);
}

/** Ghi nhận sử dụng khóa (fire-and-forget): lastUsedAt + callCount++. */
function recordUsage(record) {
  const next = {
    ...record,
    lastUsedAt: new Date().toISOString(),
    callCount: (Number(record.callCount) || 0) + 1,
  };
  query('UPDATE c_apikeys SET data = $2::jsonb, updated_at = now() WHERE id = $1', [record.id, JSON.stringify(next)])
    .catch(() => { /* không chặn response nếu ghi lỗi */ });
}

// ============================================================
// WIRE ROUTER — chỉ nối HTTP, nghiệp vụ ở hàm thuần trên
// ============================================================
export function registerOpenApi(app) {
  // Bảng route mở: path dùng cú pháp :param của router; router tự trích req.params.
  // LƯU Ý thứ tự: '/meetings/:id/documents' đăng ký TRƯỚC '/meetings/:id' để không bắt nhầm.
  const routes = [
    { path: `${BASE}/units/:unitId/meetings/upcoming`, scope: 'meetings', fn: (p, q, a) => handleUnitMeetings('upcoming', p, q, a) },
    { path: `${BASE}/units/:unitId/meetings/past`, scope: 'meetings', fn: (p, q, a) => handleUnitMeetings('past', p, q, a) },
    { path: `${BASE}/users/:userId/meetings/upcoming`, scope: 'meetings', fn: (p, q, a) => handleUserMeetings('upcoming', p, q, a) },
    { path: `${BASE}/users/:userId/meetings/past`, scope: 'meetings', fn: (p, q, a) => handleUserMeetings('past', p, q, a) },
    { path: `${BASE}/meetings/:id/documents`, scope: 'documents', fn: handleMeetingDocuments },
    { path: `${BASE}/meetings/:id`, scope: 'meetings', fn: handleMeetingDetail },
    { path: `${BASE}/documents/:id/content`, scope: 'documents', fn: handleDocumentContent },
  ];

  // Handler chung: xác thực khóa + rate-limit theo prefix + ghi nhận + gọi hàm thuần.
  const makeHandler = (route) => async (req, res) => {
    const rawKey = extractApiKey(req.headers);
    const apiKeys = await loadApiKeys();
    const auth = authenticateApiKey(rawKey, apiKeys, route.scope);
    if (!auth.ok) return sendOpen(res, auth.status, { error: auth.error });

    // Rate-limit theo prefix khóa (chống lạm dụng 1 khóa cụ thể)
    const rl = hit(`open:${auth.record.prefix ?? auth.record.id}`, OPEN_RATE_MAX, OPEN_RATE_WINDOW);
    if (!rl.ok) {
      res.setHeader?.('Retry-After', String(rl.retryAfterSec));
      return sendOpen(res, 429, { error: 'Vượt giới hạn số lượt gọi — vui lòng thử lại sau' });
    }
    recordUsage(auth.record); // fire-and-forget, không chặn response

    const accessors = await loadAccessors();
    const out = route.fn(req.params, req.query, accessors);
    // Tách file (GĐ3 + TỐI ƯU 1): endpoint nội dung tài liệu. storageKey NỘI BỘ — LUÔN xóa
    // khỏi phản hồi (không lộ khóa S3 ra bên thứ 3). Lọc quyền (isPublishableDoc: đã duyệt +
    // KHÔNG mật) đã chạy trong hàm thuần TRƯỚC bước này -> tài liệu mật vẫn 404, chưa cấp gì.
    if (out.status === 200 && out.body && 'storageKey' in out.body) {
      const key = out.body.storageKey;
      delete out.body.storageKey;
      if (key && !out.body.dataUrl && blobStore.configured()) {
        // TỐI ƯU 1 — redirect (mặc định): 302 tới presigned URL, LGSP tải THẲNG từ S3
        // (backend KHÔNG nạp tệp vào RAM). stream: dựng lại dataUrl JSON như cũ (tương thích
        // môi trường không cho client tới S3 trực tiếp / giữ đúng spec dataUrl đã công bố).
        // ĐỢT 3 — chế độ theo QUERY ?mode=stream|redirect (ưu tiên query > env) cho parity đường tải.
        if (downloadModeFrom(req.query) === 'redirect') {
          try {
            const url = blobStore.presignGetUrl(key, presignTtlSec(), {
              filename: out.body.name, contentType: out.body.mime || mimeFromKey(key),
            });
            if (res.writableEnded) return;
            res.writeHead(302, { Location: url, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
            return res.end(); // KHÔNG log URL (chứa chữ ký)
          } catch {
            return sendOpen(res, 502, { error: 'Không tạo được liên kết tải tệp từ kho lưu trữ' });
          }
        }
        try {
          const bytes = await blobStore.get(key);
          out.body.dataUrl = encodeDataUri(bytes, out.body.mime);
        } catch {
          return sendOpen(res, 502, { error: 'Không đọc được nội dung tệp từ kho lưu trữ' });
        }
      }
    }
    sendOpen(res, out.status, out.body);
  };

  for (const route of routes) app.add('GET', route.path, makeHandler(route));

  // ---- /spec: OpenAPI 3.0 JSON, CÔNG KHAI (LGSP đăng ký dịch vụ) ----
  app.add('GET', `${BASE}/spec`, async (req, res) => {
    const proto = (req.headers['x-forwarded-proto'] ?? 'http').split(',')[0];
    const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? '';
    const serverUrl = host ? `${proto}://${host}` : '/';
    sendOpen(res, 200, buildOpenApiSpec(serverUrl));
  });

  // ---- /health: cần khóa (để LGSP thăm dò có khóa) ----
  app.add('GET', `${BASE}/health`, async (req, res) => {
    const rawKey = extractApiKey(req.headers);
    const apiKeys = await loadApiKeys();
    const auth = authenticateApiKey(rawKey, apiKeys, null);
    if (!auth.ok) return sendOpen(res, auth.status, { error: auth.error });
    recordUsage(auth.record);
    sendOpen(res, 200, { ok: true, service: SERVICE_NAME, version: OPEN_API_VERSION });
  });
}
