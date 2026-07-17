// ============================================================
// ACCESS — LỌC QUYỀN ĐỌC THEO BẢN GHI (GĐ6, vá P0-1)
// Đường GET /api/:collection và /api/:collection/:id KHÔNG được trả
// nguyên dữ liệu cho mọi người đăng nhập. Module này mirror đúng
// quy tắc hiển thị của frontend (documentService.visibleDocs,
// chatService.visibleMessages) NHƯNG thực thi PHÍA SERVER.
//
// Lưu ý: "quản lý" ở đây là vai trò toàn cục (admin/secretary/chairman)
// — thống nhất với ACL sẵn có.
//
// P0-1 (rủi ro R1 — CAO NHẤT): trước đây user thường thấy TIÊU ĐỀ/lịch/chương
// trình của MỌI phiên họp ở MỌI đơn vị (chỉ lọc theo "có phải thành phần phiên"
// — không có điều kiện đơn vị nào). Với ≥500 user từ HÀNG CHỤC xã/phường/đặc khu
// độc lập, đây là rò rỉ thông tin chéo đơn vị. Vá: tái sử dụng đúng logic
// meetingInvolvesUnit() đã có ở open.js (đã dùng cho Open API bên thứ 3) để mở
// rộng "thấy được" sang CÙNG ĐƠN VỊ (không chỉ participant trực tiếp), rồi ẨN
// HẲN khỏi danh sách + GET theo id trả 404 nếu không thỏa — không chỉ ẩn minutes.
// ============================================================
import { query } from './db.js';
import { meetingInvolvesUnit } from './open.js';

const MANAGE = ['admin', 'secretary', 'chairman'];
const isManage = (user) => MANAGE.includes(user.role);

// Các bộ dữ liệu cần lọc quyền đọc (còn lại: reference/không nhạy cảm)
const SENSITIVE = new Set([
  'documents', 'votes', 'messages', 'notifications', 'annotations',
  'meetings', 'tasks', 'speakRequests', // GĐ8 (vá P0): chống rò biên bản/kết luận & dữ liệu ngoài phiên
  'questions', // chất vấn: chỉ thành phần phiên họp (hoặc quản lý) mới đọc được
  'guides',    // ĐỢT 3: tài liệu HDSD lọc theo roleScope (vai trò người đọc)
  'apiKeys',   // RỔ B: khóa API — CHỈ admin đọc (chứa keyHash nhạy cảm)
  'feedbacks', // P1-6: phản hồi người dùng — của mình + admin/unit_admin phạm vi phù hợp
]);

export const needsAccessFilter = (collection) => SENSITIVE.has(collection);

/**
 * Nạp ngữ cảnh phân quyền 1 lần cho mỗi request:
 *  - myMeetingIds     : phiên mình LÀ thành phần/khách mời/chủ trì/thư ký (participant trực tiếp)
 *  - myUnitMeetingIds : phiên "thuộc đơn vị mình" (P0-1) — chủ trì HOẶC thư ký HOẶC bất kỳ
 *                        thành phần nào cùng đơn vị (unitId) với mình, dùng meetingInvolvesUnit
 *                        (KHÔNG cần thêm field Meeting.unitId — suy ra động từ users, giống Open API)
 *  - myUnitId         : đơn vị của CHÍNH user đang gọi (đọc từ DB, JWT không mang unitId)
 *  - unitOfUser(uid)  : tra đơn vị của 1 user khác (dùng cho votes/feedbacks)
 */
export async function buildAccessCtx(user) {
  const [mres, dres, ures] = await Promise.all([
    query('SELECT data FROM c_meetings'),
    query('SELECT data FROM c_documents'),
    query('SELECT data FROM c_users'),
  ]);
  const meetings = mres.rows.map((r) => r.data);
  const userById = new Map(ures.rows.map((r) => [r.data.id, r.data]));
  const unitOfUser = (uid) => userById.get(uid)?.unitId ?? null;
  const myUnitId = unitOfUser(user.sub);
  const myMeetingIds = new Set(
    meetings.filter((m) => (m.participants ?? []).some((p) => p.userId === user.sub)).map((m) => m.id),
  );
  const myUnitMeetingIds = new Set(
    meetings.filter((m) => meetingInvolvesUnit(m, myUnitId, unitOfUser)).map((m) => m.id),
  );
  const docById = new Map(dres.rows.map((r) => [r.data.id, r.data]));
  return { myMeetingIds, myUnitMeetingIds, myUnitId, unitOfUser, docById };
}

// ---------------- Quy tắc từng bộ dữ liệu ----------------

export function canReadDoc(doc, user, ctx) {
  if (isManage(user)) return true;                         // thư ký/chủ trì/admin: phục vụ chuẩn bị & duyệt tài liệu
  if (doc.ownerId === user.sub) return true;               // người trình: xem mọi trạng thái (kể cả nháp/chờ/từ chối)
  if (Array.isArray(doc.sharedWith) && doc.sharedWith.includes(user.sub)) return true;
  if (doc.kind === 'personal') return false;               // cá nhân: chỉ owner/được chia sẻ
  const inMeeting = !doc.meetingId || ctx.myMeetingIds.has(doc.meetingId);
  if (!inMeeting) return false;                            // tài liệu họp: phải là thành phần
  if (doc.secret) return false;                            // tài liệu MẬT: đại biểu thường không đọc
  // E-HSMT mục 24: đại biểu thường CHỈ đọc tài liệu ĐÃ DUYỆT (undefined coi như đã duyệt — tương thích cũ)
  if (doc.reviewStatus !== undefined && doc.reviewStatus !== 'approved') return false;
  return true;
}

/**
 * Biểu quyết/phiếu lấy ý kiến — quyền ĐỌC (P0-1, rà thêm votes):
 *  - quản lý / người tạo / trong danh sách xin ý kiến (eligibleIds): luôn thấy.
 *  - biểu quyết TRONG PHIÊN HỌP (meetingId != null): thấy nếu phiên đó thuộc đơn vị mình
 *    (myUnitMeetingIds — participant hoặc cùng đơn vị với chủ trì/thư ký/thành phần).
 *  - phiếu lấy ý kiến NGOÀI HỌP (meetingId == null, "poll"): TRƯỚC ĐÂY luôn hiển thị cho
 *    MỌI người đăng nhập bất kể đơn vị (bug tương đương R1 cho votes) — NAY chỉ hiển thị
 *    thêm nếu CÙNG ĐƠN VỊ với người tạo (createdBy) — không rò rỉ chéo đơn vị.
 * Không thỏa điều kiện nào -> null (ẩn khỏi danh sách, 404 khi GET theo id).
 * Biểu quyết kín: giữ phiếu của CHÍNH MÌNH, ẩn danh phiếu người khác (bỏ userId + comment +
 * signature — object ẩn danh chỉ dựng lại đúng 2 trường optionId/castAt nên chữ ký mô phỏng
 * của người khác KHÔNG rò theo, cùng chỗ ẩn userId, phủ P0-4).
 */
export function projectVote(vote, user, ctx) {
  const eligible = Array.isArray(vote.eligibleIds) && vote.eligibleIds.includes(user.sub);
  const inUnitViaMeeting = vote.meetingId ? ctx.myUnitMeetingIds.has(vote.meetingId) : false;
  const sameUnitAsCreator = !vote.meetingId && ctx.myUnitId != null && ctx.unitOfUser(vote.createdBy) === ctx.myUnitId;
  if (!(isManage(user) || vote.createdBy === user.sub || eligible || inUnitViaMeeting || sameUnitAsCreator)) {
    return null;
  }

  if (vote.secret && !(isManage(user) || vote.createdBy === user.sub)) {
    return {
      ...vote,
      ballots: (vote.ballots ?? []).map((b) =>
        b.userId === user.sub ? b : { optionId: b.optionId, castAt: b.castAt },
      ),
    };
  }
  return vote;
}

export function canReadMessage(msg, user, ctx) {
  if (msg.fromId === user.sub || msg.toId === user.sub) return true; // liên quan trực tiếp
  if (msg.toId == null) return isManage(user) || ctx.myMeetingIds.has(msg.meetingId); // tin chung phòng
  return false; // tin riêng giữa hai người khác
}

export function canReadNotification(n, user) {
  return n.userId === user.sub; // kể cả admin cũng không xem thông báo cá nhân người khác
}

export function canReadAnnotation(a, user, ctx) {
  if (a.userId === user.sub) return true;      // của mình (cả công khai lẫn cá nhân)
  if (!a.isPublic) return false;               // ghi chú cá nhân người khác: không
  if (isManage(user)) return true;             // góp ý công khai
  const doc = ctx.docById.get(a.docId);
  if (!doc) return false;
  if (doc.ownerId === user.sub || (doc.sharedWith ?? []).includes(user.sub)) return true;
  return doc.meetingId ? ctx.myMeetingIds.has(doc.meetingId) : true;
}

const isMeetingMember = (m, user) =>
  isManage(user) || (m.participants ?? []).some((p) => p.userId === user.sub);

/**
 * P0-1 (R1): phiên họp có "thấy được" HAY KHÔNG (khác với "thấy được BAO NHIÊU" của
 * projectMeeting bên dưới). Thấy được nếu: quản lý HOẶC LÀ thành phần/khách mời/chủ
 * trì/thư ký của phiên (participant trực tiếp, tức isMeetingMember) HOẶC phiên đó
 * thuộc đơn vị mình (ctx.myUnitMeetingIds — chủ trì/thư ký/thành phần khác cùng đơn vị,
 * suy ra động qua meetingInvolvesUnit, KHÔNG cần field Meeting.unitId).
 * Không thỏa -> ẨN KHỎI DANH SÁCH hoàn toàn; GET theo id -> 404.
 */
export function canSeeMeetingList(m, user, ctx) {
  return isMeetingMember(m, user) || ctx.myUnitMeetingIds.has(m.id);
}

/**
 * Phiên họp: người NGOÀI THÀNH PHẦN TRỰC TIẾP (participant/chủ trì/thư ký/quản lý) —
 * dù thấy được lịch nhờ "cùng đơn vị" (canSeeMeetingList) hay không — vẫn thấy tiêu đề,
 * thời gian, phòng, chương trình, NHƯNG KHÔNG đọc được BIÊN BẢN và KẾT LUẬN (nội dung
 * nghị sự nhạy cảm). Thành phần/quản lý: xem đầy đủ. (Không đổi so với trước P0-1 —
 * P0-1 chỉ siết THÊM một lớp lọc TRƯỚC bước này, không đổi mức độ chiếu (redaction).)
 */
export function projectMeeting(m, user) {
  if (isMeetingMember(m, user)) return m;
  return { ...m, minutes: null, conclusions: [] };
}

/** Nhiệm vụ: quản lý xem tất cả; còn lại chỉ nhiệm vụ của mình hoặc thuộc phiên mình dự */
export function canReadTask(t, user, ctx) {
  if (isManage(user)) return true;
  if (t.assigneeId === user.sub) return true;
  return t.meetingId ? ctx.myMeetingIds.has(t.meetingId) : false;
}

/** Đăng ký phát biểu: quản lý / người đăng ký / thành phần phiên đó */
export function canReadSpeak(s, user, ctx) {
  if (isManage(user) || s.userId === user.sub) return true;
  return ctx.myMeetingIds.has(s.meetingId);
}

/** Đăng ký chất vấn: quản lý / người đăng ký / thành phần phiên đó */
export function canReadQuestion(q, user, ctx) {
  if (isManage(user) || q.userId === user.sub) return true;
  return ctx.myMeetingIds.has(q.meetingId);
}

/**
 * Tài liệu HDSD (E-HSMT mục 4): nếu đặt roleScope thì CHỈ vai trò trong danh sách
 * mới đọc được; trống/undefined = mọi người đăng nhập. Admin luôn đọc được (quản trị).
 */
export function canReadGuide(g, user) {
  if (user.role === 'admin') return true;
  if (!Array.isArray(g.roleScope) || g.roleScope.length === 0) return true;
  return g.roleScope.includes(user.role);
}

/** RỔ B: khóa API — CHỈ Quản trị hệ thống đọc được (chứa dữ liệu nhạy cảm). */
export function canReadApiKey(user) {
  return user.role === 'admin';
}

/**
 * P1-6 — Phản hồi/góp ý người dùng (feedbacks): của MÌNH luôn thấy; admin thấy TẤT CẢ;
 * unit_admin thấy phản hồi CÙNG ĐƠN VỊ mình (f.unitId do server ép lúc tạo — đáng tin,
 * không phải giá trị client tự khai). Vai trò khác chỉ thấy phản hồi của chính mình.
 */
export function canReadFeedback(f, user, ctx) {
  if (user.role === 'admin') return true;
  if (f.userId === user.sub) return true;
  if (user.role === 'unit_admin' && f.unitId != null && f.unitId === ctx.myUnitId) return true;
  return false;
}

// ---------------- Bộ lọc chung ----------------

/** Lọc danh sách theo quyền đọc (async vì cần ctx). Trả về mảng đã lọc/chiếu. */
export async function filterList(collection, rows, user) {
  if (!needsAccessFilter(collection)) return rows;
  const ctx = await buildAccessCtx(user);
  return applyFilter(collection, rows, user, ctx);
}

/** Kiểm tra một bản ghi có đọc được không; trả bản (đã chiếu) hoặc null. */
export async function readOne(collection, row, user) {
  if (!needsAccessFilter(collection)) return row;
  const ctx = await buildAccessCtx(user);
  const [out] = applyFilter(collection, [row], user, ctx);
  return out ?? null;
}

function applyFilter(collection, rows, user, ctx) {
  switch (collection) {
    case 'documents':
      return rows.filter((d) => canReadDoc(d, user, ctx));
    case 'votes':
      return rows.map((v) => projectVote(v, user, ctx)).filter(Boolean);
    case 'messages':
      return rows.filter((m) => canReadMessage(m, user, ctx));
    case 'notifications':
      return rows.filter((n) => canReadNotification(n, user));
    case 'annotations':
      return rows.filter((a) => canReadAnnotation(a, user, ctx));
    case 'meetings':
      // P0-1: ẨN HẲN phiên không thuộc phạm vi (không chỉ redact minutes) trước khi chiếu.
      return rows.filter((m) => canSeeMeetingList(m, user, ctx)).map((m) => projectMeeting(m, user));
    case 'tasks':
      return rows.filter((t) => canReadTask(t, user, ctx));
    case 'speakRequests':
      return rows.filter((s) => canReadSpeak(s, user, ctx));
    case 'questions':
      return rows.filter((q) => canReadQuestion(q, user, ctx));
    case 'guides':
      return rows.filter((g) => canReadGuide(g, user));
    case 'apiKeys':
      // RỔ B: khóa API chỉ dành cho Quản trị hệ thống. Người khác nhận [].
      return canReadApiKey(user) ? rows : [];
    case 'feedbacks':
      return rows.filter((f) => canReadFeedback(f, user, ctx));
    default:
      return rows;
  }
}
