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
import { guardPatch, validatePatch } from './guard.js';
import { filterList, readOne } from './access.js';
import { clientIp, hit } from './ratelimit.js';
import { issueRefreshToken, revokeRefreshToken, rotateRefreshToken } from './sessions.js';
import { mintLiveKitToken, rtcConfigured, rtcUrl } from './rtc.js';

// GĐ4: rate-limit
const RATE_MAX = Number(process.env.RATE_LIMIT_MAX ?? 300);            // yêu cầu / IP / cửa sổ
const RATE_WINDOW = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000); // 60 giây
const LOGIN_MAX = Number(process.env.LOGIN_RATE_MAX ?? 10);            // lần đăng nhập sai / IP+tài khoản
const LOGIN_WINDOW = Number(process.env.LOGIN_RATE_WINDOW_MS ?? 15 * 60000);

/** GĐ3: đẩy sự kiện realtime sau mỗi thao tác ghi (poke-then-pull) */
const notifyChange = (collection, action, id) =>
  broadcast({ type: 'change', collection, action, id, at: new Date().toISOString() });

const PORT = Number(process.env.PORT ?? 3000);
const MANAGE = ['admin', 'secretary', 'chairman'];

// ---------------- Ma trận phân quyền theo bộ dữ liệu ----------------
// 'any'            : mọi người dùng đã đăng nhập
// [roles]          : vai trò trong danh sách
// 'adminOrSelf'    : admin hoặc chính chủ (users)
// 'ownerOrManage'  : chủ sở hữu bản ghi (ownerId) hoặc admin/thư ký/chủ trì
// 'owner:<field>'  : bản ghi có <field> === user hiện tại
// 'ownerOrManage:<field>' : bản ghi có <field> === user hiện tại HOẶC quản lý
// 'self:<field>'   : dữ liệu gửi lên có <field> === user hiện tại
// 'assigneeOrManage': người được giao (assigneeId) hoặc quản lý
// 'none'           : cấm qua API chung
const ACL = {
  // Quản trị đơn vị (unit_admin) được tạo/sửa người dùng TRONG đơn vị mình.
  // Kiểm tra sâu (cùng đơn vị, không đụng admin, không tự đổi unitId) nằm ở
  // enforceUserWrite() — đọc unitId từ DB, KHÔNG tin body. Xóa vẫn CHỈ admin.
  users:         { create: ['admin', 'unit_admin'], update: 'adminOrSelfOrUnitAdmin', remove: ['admin'] },
  units:         { create: ['admin'], update: ['admin'], remove: ['admin'] },
  rooms:         { create: ['admin'], update: ['admin'], remove: ['admin'] },
  meetings:      { create: MANAGE, update: 'any', remove: MANAGE },
  documents:     { create: 'any', update: 'ownerOrManage', remove: 'ownerOrManage' },
  annotations:   { create: 'self:userId', update: 'owner:userId', remove: 'owner:userId' },
  votes:         { create: MANAGE, update: 'any', remove: MANAGE },
  speakRequests: { create: 'self:userId', update: 'any', remove: 'any' },
  // Chất vấn: đại biểu tạo cho CHÍNH MÌNH; cập nhật 'any' nhưng guard siết
  // (chỉ manage đổi trạng thái gọi/xong/từ chối, chính chủ chỉ sửa nội dung khi
  // đang chờ); xóa = chính chủ (hủy đăng ký) HOẶC quản lý.
  questions:     { create: 'self:userId', update: 'any', remove: 'ownerOrManage:userId' },
  messages:      { create: 'self:fromId', update: 'none', remove: 'none' },
  tasks:         { create: MANAGE, update: 'assigneeOrManage', remove: MANAGE },
  notifications: { create: 'any', update: 'owner:userId', remove: 'owner:userId' },
  audit:         { create: 'any', update: 'none', remove: 'none' },
};

const sanitizeUser = (u) => { const { password, ...rest } = u ?? {}; return { ...rest, password: '' }; };

function allowed(rule, req, existing, body) {
  const { sub, role } = req.user;
  if (rule === 'any') return true;
  if (rule === 'none') return false;
  if (Array.isArray(rule)) return rule.includes(role);
  if (rule === 'adminOrSelf') return role === 'admin' || existing?.id === sub;
  // Quản trị đơn vị: admin | chính chủ | unit_admin (phạm vi đơn vị kiểm sâu ở enforceUserWrite)
  if (rule === 'adminOrSelfOrUnitAdmin') return role === 'admin' || existing?.id === sub || role === 'unit_admin';
  if (rule === 'ownerOrManage') return MANAGE.includes(role) || existing?.ownerId === sub;
  if (rule === 'assigneeOrManage') return MANAGE.includes(role) || existing?.assigneeId === sub;
  if (rule.startsWith('ownerOrManage:')) return MANAGE.includes(role) || existing?.[rule.slice(14)] === sub;
  if (rule.startsWith('owner:')) return existing?.[rule.slice(6)] === sub;
  if (rule.startsWith('self:')) return body?.[rule.slice(5)] === sub;
  return false;
}

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
  const readable = await readOne(col, col === 'users' ? sanitizeUser(data) : data, req.user);
  if (!readable) return send(res, 404, { error: 'Không tìm thấy bản ghi' });
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
  validatePatch(col, body); // GĐ6 (P0-2): chặn kiểu sai ngay khi tạo
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
  if (!allowed(ACL[col].update, req, existing, patch)) {
    return send(res, 403, { error: 'Bạn không có quyền cập nhật bản ghi này' });
  }
  // Quản trị đơn vị: kiểm tra sâu phạm vi đơn vị khi sửa người dùng (đọc unitId từ DB)
  if (col === 'users') {
    const chk = await enforceUserWrite(req, 'update', existing, patch);
    if (!chk.ok) return send(res, chk.status, { error: chk.error });
  }
  validatePatch(col, patch); // GĐ6 (P0-2): chặn kiểu sai trước khi ghi (tránh hỏng bản ghi + sập 500)
  // GĐ4: khóa cứng trường nhạy cảm — chỉ đổi được qua /api/actions
  patch = guardPatch(col, existing, patch, req.user);

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
  await query(`UPDATE ${table} SET data = $2::jsonb, updated_at = now() WHERE id = $1`, [req.params.id, JSON.stringify(merged)]);
  notifyChange(col, 'update', req.params.id);
  send(res, 200, merged);
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
