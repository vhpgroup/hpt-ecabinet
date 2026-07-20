// ============================================================
// eCabinet API Server — Giai đoạn 2
// Node.js thuần + PostgreSQL/PGlite + JWT.
//
// Endpoint:
//   GET    /health                      — kiểm tra sống
//   POST   /api/auth/login              — {username,password} -> {token,user}
//   GET    /api/auth/me                 — thông tin người dùng từ token
//   GET    /api/:collection             — danh sách
//   GET    /api/:collection/:id         — 1 bản ghi
//   POST   /api/:collection             — tạo
//   PATCH  /api/:collection/:id         — cập nhật một phần
//   PUT    /api/:collection             — thay toàn bộ (admin)
//   DELETE /api/:collection/:id         — xóa
//   POST   /api/admin/reset             — khôi phục dữ liệu mẫu (admin)
// ============================================================
import http from 'node:http';
import crypto from 'node:crypto';
import { Router } from './router.js';
import { readBody, send } from './util.js';
import { hashPassword, requireAuth, requireAdmin, signToken, verifyPassword } from './auth.js';
import { COLLECTIONS, initDb, query, seedIfEmpty } from './db.js';
import { attachRealtime, broadcast, clientCount } from './ws.js';
import { registerActions } from './actions.js';
import { canReviewDocumentAsMeetingMember, guardPatch, validatePatch } from './guard.js';
import { filterList, readOne } from './access.js';
import { ACL, MANAGE, allowed } from './acl.js';
import { clientIp, hit } from './ratelimit.js';
import { issueRefreshToken, revokeRefreshToken, rotateRefreshToken } from './sessions.js';
import { mintLiveKitToken, rtcConfigured, rtcUrl } from './rtc.js';
import { registerOpenApi } from './open.js';
import {
  blobConfigured, externalizeDocumentWrite, externalizeGuideWrite,
  inlineDocumentRead, inlineGuideRead,
} from './blob.js';

// GĐ4: rate-limit
const RATE_MAX = Number(process.env.RATE_LIMIT_MAX ?? 300);            // yêu cầu / IP / cửa sổ
const RATE_WINDOW = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000); // 60 giây
const LOGIN_MAX = Number(process.env.LOGIN_RATE_MAX ?? 10);            // lần đăng nhập sai / IP+tài khoản
const LOGIN_WINDOW = Number(process.env.LOGIN_RATE_WINDOW_MS ?? 15 * 60000);

/** GĐ3: đẩy sự kiện realtime sau mỗi thao tác ghi (poke-then-pull) */
const notifyChange = (collection, action, id) =>
  broadcast({ type: 'change', collection, action, id, at: new Date().toISOString() });

const PORT = Number(process.env.PORT ?? 3000);

// Ma trận phân quyền (ACL) + hàm allowed() ĐÃ TÁCH sang server/src/acl.js
// để kiểm thử mức hàm (index.js có side-effect khởi động server). Logic giữ nguyên.

const sanitizeUser = (u) => { const { password, ...rest } = u ?? {}; return { ...rest, password: '' }; };
// RỔ B: KHÔNG trả keyHash ra ngoài (kể cả cho admin UI) — chỉ cần prefix để nhận diện.
const sanitizeApiKey = (k) => { const { keyHash, ...rest } = k ?? {}; return rest; };

function tableOf(req, res) {
  const table = COLLECTIONS[req.params.collection];
  if (!table) send(res, 404, { error: `Bộ dữ liệu "${req.params.collection}" không tồn tại` });
  return table;
}

async function getExisting(table, id) {
  const r = await query(`SELECT data FROM ${table} WHERE id = $1`, [id]);
  return r.rows[0]?.data;
}

/**
 * KIỂM TRA SÂU thao tác trên bộ dữ liệu users cho QUẢN TRỊ ĐƠN VỊ (unit_admin).
 * An ninh: JWT chỉ mang { sub, role, name } — unitId của unit_admin phải ĐỌC TỪ DB,
 * KHÔNG tin body. Trả về { ok:true } nếu hợp lệ, hoặc { status, error } để chặn.
 *
 * op = 'create' | 'update'. existing = bản ghi hiện có (update). body = dữ liệu gửi lên.
 * Quy tắc unit_admin (E-HSMT: quản lý người dùng phạm vi đơn vị mình):
 *  (a) đơn vị của đối tượng (existing.unitId khi sửa, body.unitId khi tạo) PHẢI === unitId của unit_admin;
 *  (b) KHÔNG được đặt role 'admin' cho bất kỳ ai; KHÔNG được sửa user đang có role 'admin';
 *  (c) KHÔNG tự hạ/đổi unitId của chính mình (không thao tác trên chính mình qua đường này);
 *  (d) khi tạo/sửa, unitId đích (nếu có trong body) cũng phải trùng đơn vị mình (không "chuyển" người sang đơn vị khác).
 * admin: bỏ qua (toàn quyền như cũ). Vai trò khác đã bị ACL chặn từ trước.
 */
async function enforceUserWrite(req, op, existing, body) {
  if (req.user.role !== 'unit_admin') return { ok: true };
  // đọc đơn vị của CHÍNH unit_admin từ DB (nguồn tin cậy duy nhất)
  const self = await getExisting('c_users', req.user.sub);
  const myUnit = self?.unitId;
  if (!myUnit) return { status: 403, error: 'Không xác định được đơn vị của bạn' };

  // (b) không được gán vai trò admin cho bất kỳ ai
  if (body && body.role === 'admin') {
    return { status: 403, error: 'Quản trị đơn vị không được cấp vai trò Quản trị hệ thống' };
  }

  if (op === 'update') {
    // (c) TỰ SỬA hồ sơ của chính mình: cho phép như đại biểu thường NHƯNG
    // KHÔNG được tự đổi đơn vị (unitId) hay tự nâng vai trò (role) của mình.
    if (existing?.id === req.user.sub) {
      if (body.unitId !== undefined && body.unitId !== myUnit) {
        return { status: 403, error: 'Không được tự đổi đơn vị của mình' };
      }
      if (body.role !== undefined && body.role !== existing.role) {
        return { status: 403, error: 'Không được tự đổi vai trò của mình' };
      }
      return { ok: true };
    }
    // (b) không sửa tài khoản đang là admin
    if (existing?.role === 'admin') {
      return { status: 403, error: 'Không được sửa tài khoản Quản trị hệ thống' };
    }
    // (a) đối tượng phải thuộc đơn vị mình
    if (existing?.unitId !== myUnit) {
      return { status: 403, error: 'Bạn chỉ quản lý người dùng trong đơn vị của mình' };
    }
    // (d) nếu body cố đổi unitId sang đơn vị khác -> chặn
    if (body.unitId !== undefined && body.unitId !== myUnit) {
      return { status: 403, error: 'Không được chuyển người dùng sang đơn vị khác' };
    }
  } else { // create
    // (a)(d) người dùng mới phải thuộc đơn vị mình (đọc từ body nhưng ràng buộc === myUnit)
    if (body.unitId !== myUnit) {
      return { status: 403, error: 'Chỉ được tạo người dùng trong đơn vị của mình' };
    }
  }
  return { ok: true };
}

/** Trạng thái phiên coi là "CHƯA diễn ra" (đủ điều kiện cho unit_admin XÓA) — draft/invited. */
const NOT_STARTED_STATUSES = ['draft', 'invited'];

/**
 * Đơn vị của MỘT phiên họp — suy từ đơn vị của chủ trì HOẶC thư ký (Meeting KHÔNG có field
 * unitId riêng). Cùng khái niệm với meetingInvolvesUnit() (open.js/access.js) nhưng đơn giản
 * hơn (chỉ cần "đơn vị chủ trì/thư ký", không cần quét participants — khớp đúng cách
 * enforceMeetingWrite('create') VÀ can.sendInvitations()/sendInvitations() phía FE đã dùng
 * "đơn vị của chủ trì" làm chuẩn "đơn vị của phiên"). Trả null nếu không xác định được.
 */
async function unitOfMeeting(m) {
  const chair = m?.chairId ? await getExisting('c_users', m.chairId) : null;
  if (chair?.unitId) return chair.unitId;
  const sec = m?.secretaryId ? await getExisting('c_users', m.secretaryId) : null;
  return sec?.unitId ?? null;
}

/**
 * P0-2 (mở rộng đợt vá 2026-07-18, khuyến nghị 1) — KIỂM TRA SÂU khi QUẢN TRỊ ĐƠN VỊ
 * (unit_admin) TẠO/SỬA/XÓA phiên họp (HSMT dòng 354-355: "Quản trị đơn vị nhập thông tin
 * cuộc họp... quản lý phiên họp trong phạm vi đơn vị mình"). Meeting KHÔNG có field unitId
 * riêng — "đơn vị của phiên" suy từ đơn vị của chủ trì/thư ký (unitOfMeeting(), giống
 * meetingInvolvesUnit() ở open.js/access.js). An ninh: unitId của unit_admin ĐỌC TỪ DB
 * (không tin body); chairId/secretaryId (hiện có LẪN gửi lên trong body) cũng tra unitId
 * THẬT từ DB (không tin nhãn/role trong body).
 * admin/secretary/chairman: bỏ qua hoàn toàn (đã được ACL cho tự do như trước — không đổi
 * hành vi MANAGE ở bất kỳ op nào).
 *
 * op = 'create' | 'update' | 'delete'.
 *  - create : chairId/secretaryId trong `body` PHẢI thuộc đơn vị mình (giữ nguyên logic cũ).
 *  - update : đơn vị của phiên HIỆN TẠI (existing) PHẢI thuộc đơn vị mình; nếu body cố đổi
 *             chairId/secretaryId sang người KHÁC đơn vị -> chặn (chống "chuyển" phiên sang
 *             đơn vị khác — kiểm chair/secretary MỚI trong body, không chỉ existing).
 *  - delete : đơn vị của phiên (existing) PHẢI thuộc đơn vị mình; VÀ status phải CHƯA diễn ra
 *             (draft/invited — NOT_STARTED_STATUSES) để tránh mất dữ liệu phiên 'live'/'finished'.
 */
async function enforceMeetingWrite(req, op, existing, body) {
  if (req.user.role !== 'unit_admin') return { ok: true };
  const self = await getExisting('c_users', req.user.sub);
  const myUnit = self?.unitId;
  if (!myUnit) return { status: 403, error: 'Không xác định được đơn vị của bạn' };

  if (op === 'create') {
    const chair = body.chairId ? await getExisting('c_users', body.chairId) : null;
    if (!chair || chair.unitId !== myUnit) {
      return { status: 403, error: 'Chủ trì phiên họp phải thuộc đơn vị của bạn' };
    }
    if (body.secretaryId) {
      const sec = await getExisting('c_users', body.secretaryId);
      if (!sec || sec.unitId !== myUnit) {
        return { status: 403, error: 'Thư ký phiên họp phải thuộc đơn vị của bạn' };
      }
    }
    return { ok: true };
  }

  // update/delete: phiên HIỆN TẠI phải thuộc đơn vị mình
  const currentUnit = await unitOfMeeting(existing);
  if (currentUnit !== myUnit) {
    return { status: 403, error: 'Bạn chỉ quản lý phiên họp trong phạm vi đơn vị của mình' };
  }

  if (op === 'delete') {
    if (!NOT_STARTED_STATUSES.includes(existing?.status)) {
      return { status: 403, error: 'Chỉ xóa được phiên họp CHƯA diễn ra (nháp/đã gửi giấy mời)' };
    }
    return { ok: true };
  }

  // op === 'update': nếu body cố đổi chủ trì/thư ký -> người MỚI cũng phải thuộc đơn vị mình
  // (chống "chuyển" phiên sang đơn vị khác qua PATCH chairId/secretaryId).
  if (body.chairId !== undefined && body.chairId !== existing?.chairId) {
    const newChair = await getExisting('c_users', body.chairId);
    if (!newChair || newChair.unitId !== myUnit) {
      return { status: 403, error: 'Chủ trì mới phải thuộc đơn vị của bạn' };
    }
  }
  if (body.secretaryId !== undefined && body.secretaryId !== existing?.secretaryId) {
    const newSec = await getExisting('c_users', body.secretaryId);
    if (!newSec || newSec.unitId !== myUnit) {
      return { status: 403, error: 'Thư ký mới phải thuộc đơn vị của bạn' };
    }
  }
  return { ok: true };
}

/**
 * Khuyến nghị 1 (2026-07-18, chốt code chéo) — QUẢN TRỊ ĐƠN VỊ (unit_admin) THÊM/GẮN TÀI
 * LIỆU VÀO PHIÊN HỌP: chỉ được thao tác cho phiên THUỘC ĐƠN VỊ MÌNH (không phải MỌI phiên
 * nhìn thấy được). ACL `documents.create = 'any'` vốn cho MỌI vai trò đăng nhập tạo tài
 * liệu (kể cả không gắn phiên — tài liệu tham khảo/cá nhân, KHÔNG bị ràng buộc này); nhánh
 * này SIẾT THÊM riêng cho unit_admin khi `body.meetingId` khác null — tra đơn vị của phiên
 * đó (chairId/secretaryId, unitOfMeeting) và so với đơn vị của unit_admin (đọc từ DB).
 * delegate/MANAGE không bị ảnh hưởng (giữ hành vi cũ — MANAGE toàn quyền, delegate vẫn theo
 * ACL/guardDocuments hiện có, không liên quan phạm vi đơn vị).
 * Chỉ áp cho op 'create' (gắn phiên NGAY LÚC TẠO) — sửa/trình-duyệt tài liệu ĐÃ TỒN TẠI
 * đi qua ACL `ownerOrManage` (chỉ owner/MANAGE mới update nội dung); vì lúc TẠO đã bị chặn
 * theo đơn vị, tài liệu unit_admin tạo/sở hữu vốn đã nằm trong đúng phạm vi đơn vị mình.
 */
async function enforceDocumentWrite(req, op, body) {
  if (req.user.role !== 'unit_admin' || op !== 'create' || !body.meetingId) return { ok: true };
  const self = await getExisting('c_users', req.user.sub);
  const myUnit = self?.unitId;
  if (!myUnit) return { status: 403, error: 'Không xác định được đơn vị của bạn' };
  const meeting = await getExisting('c_meetings', body.meetingId);
  if (!meeting) return { status: 404, error: 'Không tìm thấy phiên họp' };
  const meetingUnit = await unitOfMeeting(meeting);
  if (meetingUnit !== myUnit) {
    return { status: 403, error: 'Bạn chỉ được thêm tài liệu cho phiên họp thuộc đơn vị của mình' };
  }
  return { ok: true };
}

const app = new Router();

// ---------------- Health ----------------
app.add('GET', '/health', async (req, res) => {
  try {
    await query('SELECT 1');
    send(res, 200, {
      ok: true,
      service: 'ecabinet-api',
      db: process.env.DATABASE_URL ? 'postgresql' : 'pglite',
      realtimeClients: clientCount(),
    });
  } catch {
    send(res, 503, { ok: false });
  }
});

// ---------------- Auth ----------------
app.add('POST', '/api/auth/login', async (req, res) => {
  const body = (await readBody(req)) ?? {};
  const username = String(body.username ?? '').trim().toLowerCase();

  // GĐ4: chống brute-force — giới hạn theo IP + tài khoản
  const rl = hit(`login:${clientIp(req)}:${username}`, LOGIN_MAX, LOGIN_WINDOW);
  if (!rl.ok) {
    return send(res, 429, { error: `Đăng nhập sai quá nhiều lần — thử lại sau ${Math.ceil(rl.retryAfterSec / 60)} phút` });
  }

  const r = await query('SELECT id, data, password_hash FROM c_users WHERE username = $1', [username]);
  const row = r.rows[0];
  if (!row) return send(res, 401, { error: 'Tài khoản không tồn tại' });
  if (row.data.status !== 'active') return send(res, 401, { error: 'Tài khoản đã bị khóa' });
  if (!verifyPassword(body.password, row.password_hash)) return send(res, 401, { error: 'Mật khẩu không đúng' });

  const user = sanitizeUser(row.data);
  const token = signToken({ sub: row.id, role: user.role, name: user.fullName });
  const refreshToken = await issueRefreshToken(row.id); // GĐ4
  await query(`INSERT INTO c_audit (id, data) VALUES ($1, $2::jsonb)`, [
    crypto.randomUUID(),
    JSON.stringify({
      id: crypto.randomUUID(), userId: row.id, userName: user.fullName,
      action: 'Đăng nhập', detail: 'Đăng nhập hệ thống thành công (JWT)', at: new Date().toISOString(),
    }),
  ]);
  send(res, 200, { token, refreshToken, user });
});

// GĐ4: gia hạn phiên — refresh token XOAY VÒNG (dùng 1 lần)
app.add('POST', '/api/auth/refresh', async (req, res) => {
  const body = (await readBody(req)) ?? {};
  const userId = await rotateRefreshToken(body.refreshToken);
  if (!userId) return send(res, 401, { error: 'Phiên gia hạn không hợp lệ hoặc đã hết hạn — vui lòng đăng nhập lại' });
  const data = await getExisting('c_users', userId);
  if (!data || data.status !== 'active') return send(res, 401, { error: 'Tài khoản không còn hiệu lực' });
  const user = sanitizeUser(data);
  const token = signToken({ sub: userId, role: user.role, name: user.fullName });
  const refreshToken = await issueRefreshToken(userId);
  send(res, 200, { token, refreshToken, user });
});

// GĐ4: đăng xuất — thu hồi refresh token
app.add('POST', '/api/auth/logout', async (req, res) => {
  const body = (await readBody(req)) ?? {};
  if (body.refreshToken) await revokeRefreshToken(body.refreshToken);
  send(res, 200, { ok: true });
});

app.add('GET', '/api/auth/me', requireAuth, async (req, res) => {
  const data = await getExisting('c_users', req.user.sub);
  if (!data) return send(res, 401, { error: 'Tài khoản không còn tồn tại' });
  send(res, 200, sanitizeUser(data));
});

// ---------------- Họp trực tuyến WebRTC (LiveKit) ----------------
// GATED: chỉ hoạt động khi đã đặt LIVEKIT_URL/API_KEY/API_SECRET.
// Frontend hỏi /api/rtc/config để biết có bật RTC không; nếu chưa -> giữ
// giao diện mô phỏng. KHÔNG bao giờ lộ secret ra ngoài.
// LƯU Ý thứ tự đăng ký: các route /api/rtc/* PHẢI nằm TRƯỚC CRUD chung
// /api/:collection(/:id) để router (khớp theo thứ tự) không bắt nhầm.
app.add('GET', '/api/rtc/config', requireAuth, async (req, res) => {
  send(res, 200, { enabled: rtcConfigured() });
});

app.add('POST', '/api/rtc/token', requireAuth, async (req, res) => {
  if (!rtcConfigured()) {
    return send(res, 501, { error: 'RTC chưa cấu hình' });
  }
  const body = (await readBody(req)) ?? {};
  const meetingId = String(body.meetingId ?? '').trim();
  if (!meetingId) return send(res, 400, { error: 'Thiếu meetingId' });

  const meeting = await getExisting('c_meetings', meetingId);
  if (!meeting) return send(res, 404, { error: 'Không tìm thấy phiên họp' });

  // Kiểm quyền: người gọi PHẢI là thành phần phiên họp (participants có
  // userId = req.user.sub) HOẶC có vai trò quản lý (admin/thư ký/chủ trì).
  const isMember = (meeting.participants ?? []).some((p) => p.userId === req.user.sub);
  const isManage = MANAGE.includes(req.user.role);
  if (!isMember && !isManage) {
    return send(res, 403, { error: 'Bạn không thuộc thành phần phiên họp này' });
  }

  // Lấy tên hiển thị từ hồ sơ người dùng (fallback về name trong JWT)
  const profile = await getExisting('c_users', req.user.sub);
  const name = profile?.fullName ?? req.user.name ?? req.user.sub;

  const room = `meeting-${meetingId}`;
  const token = mintLiveKitToken({ identity: req.user.sub, name, room });
  send(res, 200, { url: rtcUrl(), token, room, identity: req.user.sub });
});

// ---------------- Khóa API cho bên thứ 3 (RỔ B — E-HSMT mục 54–59) ----------------
// Endpoint NGHIỆP VỤ tạo/thu hồi/kích hoạt khóa API. Key thô sinh SERVER-SIDE,
// CHỈ trả về đúng 1 lần lúc tạo; DB chỉ lưu SHA-256 (keyHash) + prefix.
// LƯU Ý thứ tự: đăng ký TRƯỚC CRUD chung /api/:collection để không bị bắt nhầm.
const genApiKeyRaw = () => `ecab_${crypto.randomBytes(24).toString('base64url')}`;
const sha256hex = (t) => crypto.createHash('sha256').update(String(t), 'utf8').digest('hex');

app.add('POST', '/api/apikeys/create', requireAuth, requireAdmin, async (req, res) => {
  const body = (await readBody(req)) ?? {};
  const name = String(body.name ?? '').trim();
  if (!name) return send(res, 400, { error: 'Vui lòng nhập tên hệ thống/đơn vị tích hợp' });
  const scopes = Array.isArray(body.scopes) ? body.scopes.filter((s) => s === 'meetings' || s === 'documents') : [];
  if (scopes.length === 0) return send(res, 400, { error: 'Chọn ít nhất một phạm vi (meetings / documents)' });

  const raw = genApiKeyRaw();
  const record = {
    id: crypto.randomUUID(),
    name,
    prefix: raw.slice(0, 8),          // 8 ký tự đầu để nhận diện
    keyHash: sha256hex(raw),          // TUYỆT ĐỐI không lưu key thô
    scopes,
    active: true,
    createdAt: new Date().toISOString(),
    createdById: req.user.sub,
    callCount: 0,
    note: typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : undefined,
  };
  await query(`INSERT INTO c_apikeys (id, data) VALUES ($1, $2::jsonb)`, [record.id, JSON.stringify(record)]);
  await query(`INSERT INTO c_audit (id, data) VALUES ($1, $2::jsonb)`, [
    crypto.randomUUID(),
    JSON.stringify({ id: crypto.randomUUID(), userId: req.user.sub, userName: req.user.name, action: 'Tạo khóa API', detail: `Cấp khóa API cho "${name}" (prefix ${record.prefix}…, scope ${scopes.join(', ')})`, at: new Date().toISOString() }),
  ]);
  notifyChange('apiKeys', 'create', record.id);
  // Trả key THÔ đúng 1 lần + bản ghi (không kèm keyHash để tránh lộ thừa)
  const { keyHash, ...safe } = record;
  send(res, 201, { key: raw, record: safe });
});

app.add('POST', '/api/apikeys/:id/revoke', requireAuth, requireAdmin, async (req, res) => {
  const data = await getExisting('c_apikeys', req.params.id);
  if (!data) return send(res, 404, { error: 'Không tìm thấy khóa API' });
  const next = { ...data, active: false };
  await query(`UPDATE c_apikeys SET data = $2::jsonb, updated_at = now() WHERE id = $1`, [req.params.id, JSON.stringify(next)]);
  await query(`INSERT INTO c_audit (id, data) VALUES ($1, $2::jsonb)`, [
    crypto.randomUUID(),
    JSON.stringify({ id: crypto.randomUUID(), userId: req.user.sub, userName: req.user.name, action: 'Thu hồi khóa API', detail: `Thu hồi khóa API "${data.name}" (prefix ${data.prefix}…)`, at: new Date().toISOString() }),
  ]);
  notifyChange('apiKeys', 'update', req.params.id);
  const { keyHash, ...safe } = next;
  send(res, 200, safe);
});

app.add('POST', '/api/apikeys/:id/enable', requireAuth, requireAdmin, async (req, res) => {
  const data = await getExisting('c_apikeys', req.params.id);
  if (!data) return send(res, 404, { error: 'Không tìm thấy khóa API' });
  const next = { ...data, active: true };
  await query(`UPDATE c_apikeys SET data = $2::jsonb, updated_at = now() WHERE id = $1`, [req.params.id, JSON.stringify(next)]);
  await query(`INSERT INTO c_audit (id, data) VALUES ($1, $2::jsonb)`, [
    crypto.randomUUID(),
    JSON.stringify({ id: crypto.randomUUID(), userId: req.user.sub, userName: req.user.name, action: 'Kích hoạt khóa API', detail: `Kích hoạt lại khóa API "${data.name}" (prefix ${data.prefix}…)`, at: new Date().toISOString() }),
  ]);
  notifyChange('apiKeys', 'update', req.params.id);
  const { keyHash, ...safe } = next;
  send(res, 200, safe);
});

// ---------------- BỘ API CÔNG BỐ CHO BÊN THỨ 3 (mục 54–59) ----------------
// Mount /api/open/v1/... TRƯỚC CRUD chung /api/:collection (router khớp theo thứ tự).
registerOpenApi(app);

// ---------------- Quản trị ----------------
app.add('POST', '/api/admin/reset', requireAuth, requireAdmin, async (req, res) => {
  await seedIfEmpty(true);
  notifyChange('*', 'reset', '*');
  send(res, 200, { ok: true, message: 'Đã khôi phục dữ liệu mẫu' });
});

// ---------------- CRUD chung ----------------
app.add('GET', '/api/:collection', requireAuth, async (req, res) => {
  const col = req.params.collection;
  const table = tableOf(req, res);
  if (!table) return;
  // audit chỉ admin xem; người khác nhận mảng rỗng (không lỗi để UI nạp bình thường)
  if (col === 'audit' && req.user.role !== 'admin') return send(res, 200, []);
  const r = await query(`SELECT data FROM ${table} ORDER BY updated_at ASC, id ASC`);
  let rows = r.rows.map((x) => x.data);
  if (col === 'users') rows = rows.map(sanitizeUser);
  if (col === 'apiKeys') rows = rows.map(sanitizeApiKey); // RỔ B: ẩn keyHash
  // GĐ6 (P0-1): lọc quyền đọc theo bản ghi phía server
  rows = await filterList(col, rows, req.user);
  send(res, 200, rows);
});

app.add('GET', '/api/:collection/:id', requireAuth, async (req, res) => {
  const col = req.params.collection;
  const table = tableOf(req, res);
  if (!table) return;
  if (col === 'audit' && req.user.role !== 'admin') return send(res, 404, { error: 'Không tìm thấy bản ghi' });
  const data = await getExisting(table, req.params.id);
  if (!data) return send(res, 404, { error: 'Không tìm thấy bản ghi' });
  // GĐ6 (P0-1): kiểm quyền đọc; không có quyền -> 404 để không lộ tồn tại
  const projected = col === 'users' ? sanitizeUser(data) : col === 'apiKeys' ? sanitizeApiKey(data) : data;
  const readable = await readOne(col, projected, req.user);
  if (!readable) return send(res, 404, { error: 'Không tìm thấy bản ghi' });
  // Tách file (GĐ3): nếu bản ghi đã externalize sang S3 (có storageKey) -> dựng lại
  // dataUrl/fileData từ S3 để FE hiển thị y như cũ (S3 key KHÔNG lộ ra client).
  // S3 tắt hoặc bản ghi cũ (chỉ có dataUrl) -> trả nguyên (tương thích ngược).
  try {
    if (col === 'documents') return send(res, 200, await inlineDocumentRead(readable));
    if (col === 'guides') return send(res, 200, await inlineGuideRead(readable));
  } catch (e) {
    return send(res, 502, { error: `Không đọc được nội dung tệp từ kho lưu trữ: ${e?.message ?? 'lỗi S3'}` });
  }
  send(res, 200, readable);
});

app.add('POST', '/api/:collection', requireAuth, async (req, res) => {
  const col = req.params.collection;
  const table = tableOf(req, res);
  if (!table) return;
  const body = await readBody(req);
  if (!body?.id) return send(res, 400, { error: 'Thiếu id bản ghi' });
  if (!allowed(ACL[col].create, req, null, body)) {
    return send(res, 403, { error: 'Bạn không có quyền tạo dữ liệu này' });
  }
  // Quản trị đơn vị: kiểm tra sâu phạm vi đơn vị khi tạo người dùng
  if (col === 'users') {
    const chk = await enforceUserWrite(req, 'create', null, body);
    if (!chk.ok) return send(res, chk.status, { error: chk.error });
  }
  // P0-2: quản trị đơn vị tạo phiên họp — chủ trì/thư ký PHẢI thuộc đơn vị mình
  if (col === 'meetings') {
    const chk = await enforceMeetingWrite(req, 'create', null, body);
    if (!chk.ok) return send(res, chk.status, { error: chk.error });
  }
  // Khuyến nghị 1 (2026-07-18): unit_admin thêm tài liệu gắn phiên họp — CHỈ phiên thuộc đơn vị mình.
  if (col === 'documents') {
    const chk = await enforceDocumentWrite(req, 'create', body);
    if (!chk.ok) return send(res, chk.status, { error: chk.error });
  }
  // P1-6 — Phản hồi/góp ý: SERVER ép danh tính người gửi + phạm vi đơn vị (KHÔNG tin
  // client) — chống giả danh gửi hộ người khác hoặc gán nhầm/lách phạm vi đơn vị.
  if (col === 'feedbacks') {
    body.userId = req.user.sub;
    const self = await getExisting('c_users', req.user.sub);
    body.unitId = self?.unitId ?? null;
    if (body.status === undefined) body.status = 'new';
  }
  validatePatch(col, body); // GĐ6 (P0-2): chặn kiểu sai ngay khi tạo
  // Tách file (GĐ3): nếu S3 bật và payload có dataUrl/fileData base64 -> PUT lên S3,
  // set storageKey, XÓA base64 khỏi bản ghi lưu DB (chống phình DB). S3 tắt -> no-op.
  try {
    if (col === 'documents') await externalizeDocumentWrite(body);
    if (col === 'guides') await externalizeGuideWrite(body);
  } catch (e) {
    return send(res, 502, { error: `Không lưu được tệp lên kho lưu trữ: ${e?.message ?? 'lỗi S3'}` });
  }
  try {
    if (col === 'users') {
      const { password, ...rest } = body;
      await query(
        `INSERT INTO c_users (id, data, username, password_hash) VALUES ($1, $2::jsonb, $3, $4)`,
        [body.id, JSON.stringify({ ...rest, password: '' }), String(body.username ?? '').toLowerCase(), hashPassword(password || '123456')],
      );
      notifyChange(col, 'create', body.id);
      return send(res, 201, sanitizeUser(body));
    }
    await query(`INSERT INTO ${table} (id, data) VALUES ($1, $2::jsonb)`, [body.id, JSON.stringify(body)]);
    notifyChange(col, 'create', body.id);
    send(res, 201, body);
  } catch (e) {
    if (String(e?.message ?? '').includes('duplicate') || String(e?.code) === '23505') {
      return send(res, 400, { error: col === 'users' ? 'Tên đăng nhập hoặc id đã tồn tại' : 'Bản ghi đã tồn tại' });
    }
    throw e;
  }
});

app.add('PATCH', '/api/:collection/:id', requireAuth, async (req, res) => {
  const col = req.params.collection;
  const table = tableOf(req, res);
  if (!table) return;
  const existing = await getExisting(table, req.params.id);
  if (!existing) return send(res, 404, { error: 'Không tìm thấy bản ghi' });
  let patch = (await readBody(req)) ?? {};
  let aclOk = allowed(ACL[col].update, req, existing, patch);
  // P0-3: tài liệu — ACL thô 'ownerOrManage' sẽ chặn "Thành viên dự họp" (không phải
  // owner/MANAGE) TRƯỚC KHI guardDocuments có cơ hội chạy. Mở lối đi HẸP: cho qua ACL
  // NẾU đây đúng là 1 yêu cầu DUYỆT hợp lệ của thành phần phiên (xem canReviewDocumentAsMeetingMember).
  let meetingForDocs;
  if (!aclOk && col === 'documents' && existing.meetingId) {
    meetingForDocs = await getExisting('c_meetings', existing.meetingId);
    aclOk = canReviewDocumentAsMeetingMember(existing, patch, req.user, meetingForDocs);
  }
  if (!aclOk) {
    return send(res, 403, { error: 'Bạn không có quyền cập nhật bản ghi này' });
  }
  // Quản trị đơn vị: kiểm tra sâu phạm vi đơn vị khi sửa người dùng (đọc unitId từ DB)
  if (col === 'users') {
    const chk = await enforceUserWrite(req, 'update', existing, patch);
    if (!chk.ok) return send(res, chk.status, { error: chk.error });
  }
  // Khuyến nghị 1 (2026-07-18): unit_admin SỬA phiên họp — chỉ trong phạm vi đơn vị mình,
  // không "chuyển" phiên sang đơn vị khác qua đổi chairId/secretaryId (xem enforceMeetingWrite).
  if (col === 'meetings') {
    const chk = await enforceMeetingWrite(req, 'update', existing, patch);
    if (!chk.ok) return send(res, chk.status, { error: chk.error });
  }
  validatePatch(col, patch, existing); // GĐ6 (P0-2)/P1-7: chặn kiểu sai + định dạng tệp trước khi ghi
  // P0-3: tài liệu gắn phiên họp — nạp phiên đó (tái dùng nếu đã nạp ở bước ACL trên) để
  // guardDocuments biết ai là "thành phần phiên" được phép duyệt, không chỉ MANAGE toàn cục.
  // guardDocuments ĐỘC LẬP kiểm tra lại toàn bộ điều kiện (defense-in-depth, không chỉ tin ACL).
  let extra;
  if (col === 'documents' && existing.meetingId) {
    extra = { meeting: meetingForDocs ?? (await getExisting('c_meetings', existing.meetingId)) };
  }
  // P1-6 (vá QA 18/07): Quản trị đơn vị xử lý phản hồi TRONG ĐƠN VỊ MÌNH — unitId của
  // người gọi đọc từ DB (JWT không mang unitId); guardFeedbacks đối chiếu existing.unitId.
  if (col === 'feedbacks' && req.user.role === 'unit_admin') {
    const self = await getExisting('c_users', req.user.sub);
    extra = { actorUnitId: self?.unitId ?? null };
  }
  // Khuyến nghị 1 (2026-07-18): unit_admin SỬA phiên — guardMeetings cần biết đơn vị của
  // CHÍNH unit_admin (actorUnitId) + đơn vị của phiên ĐANG SỬA (meetingUnitId, suy từ
  // chairId/secretaryId HIỆN CÓ) để coi unit_admin-cùng-đơn-vị như MANAGE cho field nội
  // dung. enforceMeetingWrite() ở trên đã chặn 403 nếu KHÔNG cùng đơn vị — nhánh này chỉ
  // tính GIÁ TRỊ để guardMeetings tự kiểm tra lại độc lập (defense-in-depth).
  if (col === 'meetings' && req.user.role === 'unit_admin') {
    const self = await getExisting('c_users', req.user.sub);
    extra = { actorUnitId: self?.unitId ?? null, meetingUnitId: await unitOfMeeting(existing) };
  }
  // GĐ4: khóa cứng trường nhạy cảm — chỉ đổi được qua /api/actions
  patch = guardPatch(col, existing, patch, req.user, extra);

  if (col === 'users') {
    // đại biểu thường tự sửa hồ sơ: KHÔNG được đổi vai trò/trạng thái/tên đăng nhập.
    // admin + quản trị đơn vị (đã qua enforceUserWrite) được đổi các trường này.
    if (req.user.role !== 'admin' && req.user.role !== 'unit_admin') {
      delete patch.role; delete patch.status; delete patch.username;
    }
    let passwordHash = null;
    if (patch.password) { passwordHash = hashPassword(patch.password); delete patch.password; }
    const merged = { ...existing, ...patch, password: '' };
    await query(
      `UPDATE c_users SET data = $2::jsonb, username = $3, updated_at = now()${passwordHash ? ', password_hash = $4' : ''} WHERE id = $1`,
      passwordHash
        ? [req.params.id, JSON.stringify(merged), String(merged.username ?? '').toLowerCase(), passwordHash]
        : [req.params.id, JSON.stringify(merged), String(merged.username ?? '').toLowerCase()],
    );
    notifyChange(col, 'update', req.params.id);
    return send(res, 200, sanitizeUser(merged));
  }

  const merged = { ...existing, ...patch };
  // Tách file (GĐ3): nếu PATCH mang dataUrl/fileData base64 MỚI (tải lại tệp) và S3 bật
  // -> PUT lên S3, set storageKey, xóa base64 khỏi bản ghi. Nếu patch KHÔNG đụng tệp thì
  // merged giữ nguyên storageKey (đã externalize trước đó) — no-op. S3 tắt -> giữ base64.
  try {
    if (col === 'documents') await externalizeDocumentWrite(merged);
    if (col === 'guides') await externalizeGuideWrite(merged);
  } catch (e) {
    return send(res, 502, { error: `Không lưu được tệp lên kho lưu trữ: ${e?.message ?? 'lỗi S3'}` });
  }
  await query(`UPDATE ${table} SET data = $2::jsonb, updated_at = now() WHERE id = $1`, [req.params.id, JSON.stringify(merged)]);
  notifyChange(col, 'update', req.params.id);
  // Trả bản ghi cho FE: nếu đã externalize thì dựng lại dataUrl/fileData (FE hiển thị như cũ).
  if (col === 'documents') return send(res, 200, await inlineDocumentRead(merged).catch(() => merged));
  if (col === 'guides') return send(res, 200, await inlineGuideRead(merged).catch(() => merged));
  send(res, 200, col === 'apiKeys' ? sanitizeApiKey(merged) : merged); // RỔ B: ẩn keyHash
});

app.add('DELETE', '/api/:collection/:id', requireAuth, async (req, res) => {
  const col = req.params.collection;
  const table = tableOf(req, res);
  if (!table) return;
  const existing = await getExisting(table, req.params.id);
  if (!existing) return send(res, 404, { error: 'Không tìm thấy bản ghi' });
  if (!allowed(ACL[col].remove, req, existing, null)) {
    return send(res, 403, { error: 'Bạn không có quyền xóa bản ghi này' });
  }
  if (col === 'users' && req.params.id === req.user.sub) {
    return send(res, 400, { error: 'Không thể tự xóa tài khoản đang đăng nhập' });
  }
  // Khuyến nghị 1 (2026-07-18): unit_admin XÓA phiên họp — chỉ đơn vị mình + CHƯA diễn ra
  // (draft/invited) để tránh mất dữ liệu phiên 'live'/'finished'. admin/MANAGE bỏ qua.
  if (col === 'meetings') {
    const chk = await enforceMeetingWrite(req, 'delete', existing, null);
    if (!chk.ok) return send(res, chk.status, { error: chk.error });
  }
  await query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
  notifyChange(col, 'remove', req.params.id);
  send(res, 200, { ok: true });
});

app.add('PUT', '/api/:collection', requireAuth, requireAdmin, async (req, res) => {
  const col = req.params.collection;
  const table = tableOf(req, res);
  if (!table) return;
  const items = (await readBody(req)) ?? [];
  if (!Array.isArray(items)) return send(res, 400, { error: 'Body phải là mảng' });
  await query(`DELETE FROM ${table}`);
  for (const item of items) {
    if (col === 'users') {
      const { password, ...rest } = item;
      await query(`INSERT INTO c_users (id, data, username, password_hash) VALUES ($1,$2::jsonb,$3,$4)`,
        [item.id, JSON.stringify({ ...rest, password: '' }), String(item.username ?? '').toLowerCase(), hashPassword(password || '123456')]);
    } else {
      await query(`INSERT INTO ${table} (id, data) VALUES ($1, $2::jsonb)`, [item.id, JSON.stringify(item)]);
    }
  }
  notifyChange(col, 'replace', '*');
  send(res, 200, { ok: true, count: items.length });
});

// ---------------- Khởi động ----------------
// GĐ4: endpoint nghiệp vụ chuyên biệt
registerActions(app);

initDb()
  .then(() => {
    const server = http.createServer((req, res) => {
      // GĐ4: rate-limit toàn cục theo IP (trừ health check)
      if (req.url !== '/health') {
        const rl = hit('ip:' + clientIp(req), RATE_MAX, RATE_WINDOW);
        if (!rl.ok) {
          res.writeHead(429, {
            'Content-Type': 'application/json; charset=utf-8',
            'Retry-After': String(rl.retryAfterSec),
            'Access-Control-Allow-Origin': process.env.CORS_ORIGIN ?? '*',
          });
          res.end(JSON.stringify({ error: 'Quá nhiều yêu cầu — vui lòng thử lại sau' }));
          return;
        }
      }
      app.handle(req, res);
    });
    attachRealtime(server, '/api/realtime'); // GĐ3: WebSocket đẩy sự kiện
    server.listen(PORT, () => {
      console.log(`[server] eCabinet API chạy tại http://localhost:${PORT} — ${Object.keys(COLLECTIONS).length} bộ dữ liệu`);
      console.log(`[server] Realtime WebSocket: ws://localhost:${PORT}/api/realtime?token=<JWT>`);
      console.log(`[server] Bảo vệ: rate-limit ${RATE_MAX} req/${RATE_WINDOW / 1000}s/IP · login ${LOGIN_MAX} lần/${LOGIN_WINDOW / 60000} phút · refresh token xoay vòng`);
    });
  })
  .catch((e) => {
    console.error('[server] Không khởi động được:', e);
    process.exit(1);
  });
