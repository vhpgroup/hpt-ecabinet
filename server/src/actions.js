// ============================================================
// ENDPOINT NGHIỆP VỤ /api/actions (GĐ4)
// Kiểm tra sâu phía server cho các mutation nhạy cảm:
//   POST /api/actions/vote/:id/ballot      — bỏ phiếu / cho ý kiến
//   POST /api/actions/vote/:id/open        — mở biểu quyết
//   POST /api/actions/vote/:id/close       — đóng biểu quyết / kết thúc lấy ý kiến
//   POST /api/actions/meetings/:id/checkin — điểm danh (hộ: chủ trì/thư ký)
//   POST /api/actions/meetings/:id/invite  — gửi giấy mời
//   POST /api/actions/meetings/:id/start   — khai mạc
//   POST /api/actions/meetings/:id/end     — bế mạc
//   POST /api/actions/meetings/:id/sign    — ký số biên bản (mô phỏng CA)
// Danh tính LUÔN lấy từ JWT — client không thể mạo danh.
// Ghi audit + tạo thông báo + phát realtime ngay tại server.
// ============================================================
import crypto from 'node:crypto';
import { query, mutateDoc } from './db.js';
import { readBody, send } from './util.js';
import { requireAuth } from './auth.js';
import { broadcast } from './ws.js';

const MANAGE = ['admin', 'secretary', 'chairman'];
const nowIso = () => new Date().toISOString();
const sha256 = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');

// ---------- helpers ----------
async function getDoc(table, id) {
  const r = await query(`SELECT data FROM ${table} WHERE id = $1`, [id]);
  return r.rows[0]?.data;
}
async function saveDoc(table, id, data) {
  await query(`UPDATE ${table} SET data = $2::jsonb, updated_at = now() WHERE id = $1`, [id, JSON.stringify(data)]);
}
async function audit(user, action, detail) {
  const id = crypto.randomUUID();
  await query(`INSERT INTO c_audit (id, data) VALUES ($1, $2::jsonb)`, [id, JSON.stringify({
    id, userId: user.sub, userName: user.name, action, detail, at: nowIso(),
  })]);
  broadcast({ type: 'change', collection: 'audit', action: 'create', id, at: nowIso() });
}
async function notifyUsers(userIds, title, body, type, link) {
  for (const userId of userIds) {
    const id = crypto.randomUUID();
    await query(`INSERT INTO c_notifications (id, data) VALUES ($1, $2::jsonb)`, [id, JSON.stringify({
      id, userId, title, body, type, read: false, createdAt: nowIso(), link,
    })]);
  }
  if (userIds.length) broadcast({ type: 'change', collection: 'notifications', action: 'create', id: '*', at: nowIso() });
}
const changed = (collection, id) => broadcast({ type: 'change', collection, action: 'update', id, at: nowIso() });

/** Quyền điều hành phiên họp: chủ trì / thư ký của phiên, hoặc admin */
const chairCtl = (m, user) => user.sub === m.chairId || user.sub === m.secretaryId || user.role === 'admin';

export function registerActions(app) {
  // ---------------- BỎ PHIẾU / CHO Ý KIẾN ----------------
  // GĐ8 (vá P0): ghi phiếu NGUYÊN TỬ bằng mutateDoc (CAS) — chống mất phiếu khi
  // nhiều đại biểu bỏ phiếu ĐỒNG THỜI (trước đây read-modify-write ghi đè nhau).
  app.add('POST', '/api/actions/vote/:id/ballot', requireAuth, async (req, res) => {
    const body = (await readBody(req)) ?? {};
    const userId = req.user.sub;
    const result = await mutateDoc('c_votes', req.params.id, (v) => {
      if (v.status !== 'open') return { __error: 'Nội dung này chưa mở hoặc đã đóng biểu quyết', __status: 400 };
      if (!v.eligibleIds.includes(userId)) return { __error: 'Bạn không thuộc thành phần biểu quyết', __status: 403 };
      if (v.ballots.some((b) => b.userId === userId)) return { __error: 'Bạn đã biểu quyết nội dung này', __status: 400 };
      if (!v.options.some((o) => o.id === body.optionId)) return { __error: 'Phương án biểu quyết không hợp lệ', __status: 400 };
      const comment = typeof body.comment === 'string' && body.comment.trim() ? body.comment.trim().slice(0, 2000) : undefined;
      v.ballots.push({ userId, optionId: body.optionId, comment, castAt: nowIso() });
      return v;
    });
    if (!result.ok) {
      if (result.reason === 'not_found') return send(res, 404, { error: 'Không tìm thấy nội dung biểu quyết' });
      return send(res, result.status ?? 400, { error: result.error });
    }
    changed('votes', req.params.id);
    send(res, 200, { ok: true }); // FE tự refresh qua GET (đã lọc/ẩn danh); không trả full vote
  });

  // ---------------- MỞ / ĐÓNG BIỂU QUYẾT ----------------
  app.add('POST', '/api/actions/vote/:id/open', requireAuth, async (req, res) => {
    const vote = await getDoc('c_votes', req.params.id);
    if (!vote) return send(res, 404, { error: 'Không tìm thấy nội dung biểu quyết' });
    if (!MANAGE.includes(req.user.role) && vote.createdBy !== req.user.sub) {
      return send(res, 403, { error: 'Bạn không có quyền mở biểu quyết này' });
    }
    if (vote.status !== 'pending') return send(res, 400, { error: 'Chỉ mở được nội dung chưa biểu quyết' });
    vote.status = 'open';
    vote.openedAt = nowIso();
    await saveDoc('c_votes', vote.id, vote);
    await notifyUsers(
      vote.eligibleIds.filter((x) => x !== req.user.sub),
      'Biểu quyết đang mở',
      `Biểu quyết "${vote.title}" đang chờ ý kiến của bạn.`,
      'vote',
      vote.meetingId ? `#/meetings/${vote.meetingId}/live` : '#/polls',
    );
    await audit(req.user, 'Mở biểu quyết', `Mở "${vote.title}"`);
    changed('votes', vote.id);
    send(res, 200, vote);
  });

  app.add('POST', '/api/actions/vote/:id/close', requireAuth, async (req, res) => {
    const vote = await getDoc('c_votes', req.params.id);
    if (!vote) return send(res, 404, { error: 'Không tìm thấy nội dung biểu quyết' });
    if (!MANAGE.includes(req.user.role) && vote.createdBy !== req.user.sub) {
      return send(res, 403, { error: 'Bạn không có quyền đóng biểu quyết này' });
    }
    if (vote.status !== 'open') return send(res, 400, { error: 'Nội dung này không ở trạng thái đang mở' });
    vote.status = 'closed';
    vote.closedAt = nowIso();
    await saveDoc('c_votes', vote.id, vote);
    await audit(req.user, 'Đóng biểu quyết', `Đóng "${vote.title}" — ${vote.ballots.length}/${vote.eligibleIds.length} phiếu`);
    changed('votes', vote.id);
    send(res, 200, vote);
  });

  // ---------------- ĐIỂM DANH ----------------
  // GĐ8 (vá P0): điểm danh NGUYÊN TỬ (CAS) — chống mất điểm danh khi nhiều
  // đại biểu điểm danh đồng thời (cùng ghi mảng participants).
  app.add('POST', '/api/actions/meetings/:id/checkin', requireAuth, async (req, res) => {
    const body = (await readBody(req)) ?? {};
    const targetId = body.userId ?? req.user.sub;
    const result = await mutateDoc('c_meetings', req.params.id, (m) => {
      if (m.status !== 'live') return { __error: 'Phiên họp chưa diễn ra hoặc đã kết thúc', __status: 400 };
      if (targetId !== req.user.sub && !chairCtl(m, req.user)) {
        return { __error: 'Chỉ chủ trì/thư ký được điểm danh hộ đại biểu', __status: 403 };
      }
      const row = m.participants.find((p) => p.userId === targetId);
      if (!row) return { __error: 'Người này không thuộc thành phần phiên họp', __status: 400 };
      if (row.checkedInAt) return null; // đã điểm danh -> no-op
      row.checkedInAt = nowIso();
      row.attendStatus = 'accepted';
      return m;
    });
    if (!result.ok) {
      if (result.reason === 'not_found') return send(res, 404, { error: 'Không tìm thấy phiên họp' });
      return send(res, result.status ?? 400, { error: result.error });
    }
    if (!result.noop) {
      await audit(req.user, 'Điểm danh', `Điểm danh ${targetId === req.user.sub ? 'cá nhân' : 'hộ đại biểu'} tại "${result.data.title}"`);
      changed('meetings', req.params.id);
    }
    send(res, 200, { ok: true });
  });

  // ---------------- GỬI GIẤY MỜI ----------------
  app.add('POST', '/api/actions/meetings/:id/invite', requireAuth, async (req, res) => {
    const m = await getDoc('c_meetings', req.params.id);
    if (!m) return send(res, 404, { error: 'Không tìm thấy phiên họp' });
    if (!MANAGE.includes(req.user.role)) return send(res, 403, { error: 'Bạn không có quyền gửi giấy mời' });
    if (!['draft', 'invited'].includes(m.status)) return send(res, 400, { error: 'Phiên họp không ở trạng thái gửi được giấy mời' });
    m.status = 'invited';
    m.invitedAt = nowIso();
    await saveDoc('c_meetings', m.id, m);
    await notifyUsers(
      m.participants.map((p) => p.userId).filter((x) => x !== req.user.sub),
      'Giấy mời họp',
      `Bạn được mời dự "${m.title}" — ${new Date(m.startTime).toLocaleString('vi-VN')}. Vui lòng xác nhận tham dự.`,
      'meeting', `#/meetings/${m.id}`,
    );
    await audit(req.user, 'Gửi giấy mời', `Gửi giấy mời "${m.title}" đến ${m.participants.length} đại biểu (email + SMS)`);
    changed('meetings', m.id);
    send(res, 200, m);
  });

  // ---------------- KHAI MẠC ----------------
  app.add('POST', '/api/actions/meetings/:id/start', requireAuth, async (req, res) => {
    const m = await getDoc('c_meetings', req.params.id);
    if (!m) return send(res, 404, { error: 'Không tìm thấy phiên họp' });
    if (!chairCtl(m, req.user)) return send(res, 403, { error: 'Chỉ chủ trì/thư ký của phiên họp được khai mạc' });
    if (!['draft', 'invited'].includes(m.status)) return send(res, 400, { error: 'Phiên họp không ở trạng thái bắt đầu được' });
    m.status = 'live';
    m.currentAgendaItemId = m.agenda[0]?.id ?? null;
    await saveDoc('c_meetings', m.id, m);
    await notifyUsers(
      m.participants.map((p) => p.userId).filter((x) => x !== req.user.sub),
      'Phiên họp bắt đầu',
      `"${m.title}" đã khai mạc. Mời đại biểu điểm danh và vào phòng họp.`,
      'meeting', `#/meetings/${m.id}/live`,
    );
    await audit(req.user, 'Bắt đầu phiên họp', `Khai mạc "${m.title}"`);
    changed('meetings', m.id);
    send(res, 200, m);
  });

  // ---------------- BẾ MẠC ----------------
  app.add('POST', '/api/actions/meetings/:id/end', requireAuth, async (req, res) => {
    const m = await getDoc('c_meetings', req.params.id);
    if (!m) return send(res, 404, { error: 'Không tìm thấy phiên họp' });
    if (!chairCtl(m, req.user)) return send(res, 403, { error: 'Chỉ chủ trì/thư ký của phiên họp được kết thúc' });
    if (m.status !== 'live') return send(res, 400, { error: 'Phiên họp không ở trạng thái đang diễn ra' });
    m.status = 'finished';
    await saveDoc('c_meetings', m.id, m);
    await audit(req.user, 'Kết thúc phiên họp', `Bế mạc "${m.title}"`);
    changed('meetings', m.id);
    send(res, 200, m);
  });

  // ---------------- KÝ SỐ BIÊN BẢN ----------------
  app.add('POST', '/api/actions/meetings/:id/sign', requireAuth, async (req, res) => {
    const m = await getDoc('c_meetings', req.params.id);
    if (!m) return send(res, 404, { error: 'Không tìm thấy phiên họp' });
    if (!m.minutes) return send(res, 400, { error: 'Chưa có biên bản để ký' });
    // CHỈ chủ trì hoặc thư ký CỦA PHIÊN HỌP NÀY — kiểm tra phía server
    if (req.user.sub !== m.chairId && req.user.sub !== m.secretaryId) {
      return send(res, 403, { error: 'Chỉ chủ trì hoặc thư ký của phiên họp được ký biên bản' });
    }
    if (m.minutes.signatures.some((s) => s.signerId === req.user.sub)) {
      return send(res, 400, { error: 'Bạn đã ký biên bản này' });
    }
    const body = (await readBody(req)) ?? {};
    if (!/^\d{6}$/.test(String(body.pin ?? ''))) {
      return send(res, 400, { error: 'Mã PIN chứng thư số phải gồm 6 chữ số' });
    }
    // GĐ sau: gọi dịch vụ CA thật (VNPT SmartCA / USB token) tại đây
    const signer = await getDoc('c_users', req.user.sub);
    const userId = req.user.sub;
    // GĐ8 (vá P0): ký NGUYÊN TỬ (CAS) — chống mất chữ ký khi chủ trì & thư ký ký đồng thời
    const result = await mutateDoc('c_meetings', req.params.id, (m) => {
      if (!m.minutes) return { __error: 'Chưa có biên bản để ký', __status: 400 };
      if (userId !== m.chairId && userId !== m.secretaryId) {
        return { __error: 'Chỉ chủ trì hoặc thư ký của phiên họp được ký biên bản', __status: 403 };
      }
      if (m.minutes.signatures.some((s) => s.signerId === userId)) {
        return { __error: 'Bạn đã ký biên bản này', __status: 400 };
      }
      m.minutes.signatures.push({
        signerId: userId,
        signerName: signer?.fullName ?? req.user.name,
        signerTitle: signer?.title ?? '',
        signedAt: nowIso(),
        serial: `VN-DEMO-CA:${Math.floor(1000 + Math.random() * 9000)}:${crypto.randomBytes(3).toString('hex')}`,
        hash: sha256(m.minutes.content), // hash tính PHÍA SERVER trên nội dung đang lưu
      });
      m.minutes.locked =
        m.minutes.signatures.some((s) => s.signerId === m.chairId) &&
        m.minutes.signatures.some((s) => s.signerId === m.secretaryId);
      return m;
    });
    if (!result.ok) {
      if (result.reason === 'not_found') return send(res, 404, { error: 'Không tìm thấy phiên họp' });
      return send(res, result.status ?? 400, { error: result.error });
    }
    const sig = result.data.minutes.signatures.find((s) => s.signerId === userId);
    await audit(req.user, 'Ký số biên bản', `Ký số biên bản "${result.data.title}" (serial ${sig.serial})`);
    changed('meetings', req.params.id);
    send(res, 200, sig);
  });
}
