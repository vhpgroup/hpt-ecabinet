// ============================================================
// ACCESS — LỌC QUYỀN ĐỌC THEO BẢN GHI (GĐ6, vá P0-1)
// Đường GET /api/:collection và /api/:collection/:id KHÔNG được trả
// nguyên dữ liệu cho mọi người đăng nhập. Module này mirror đúng
// quy tắc hiển thị của frontend (documentService.visibleDocs,
// chatService.visibleMessages) NHƯNG thực thi PHÍA SERVER.
//
// Lưu ý: "quản lý" ở đây là vai trò toàn cục (admin/secretary/chairman)
// — thống nhất với ACL sẵn có. Siết quyền theo TỪNG phiên họp là P1.
// ============================================================
import { query } from './db.js';

const MANAGE = ['admin', 'secretary', 'chairman'];
const isManage = (user) => MANAGE.includes(user.role);

// Các bộ dữ liệu cần lọc quyền đọc (còn lại: reference/không nhạy cảm)
const SENSITIVE = new Set([
  'documents', 'votes', 'messages', 'notifications', 'annotations',
  'meetings', 'tasks', 'speakRequests', // GĐ8 (vá P0): chống rò biên bản/kết luận & dữ liệu ngoài phiên
]);

export const needsAccessFilter = (collection) => SENSITIVE.has(collection);

/** Nạp ngữ cảnh phân quyền 1 lần cho mỗi request (thành phần cuộc họp của user) */
export async function buildAccessCtx(user) {
  const [mres, dres] = await Promise.all([
    query('SELECT data FROM c_meetings'),
    query('SELECT data FROM c_documents'),
  ]);
  const meetings = mres.rows.map((r) => r.data);
  const myMeetingIds = new Set(
    meetings.filter((m) => (m.participants ?? []).some((p) => p.userId === user.sub)).map((m) => m.id),
  );
  const docById = new Map(dres.rows.map((r) => [r.data.id, r.data]));
  return { myMeetingIds, docById };
}

// ---------------- Quy tắc từng bộ dữ liệu ----------------

export function canReadDoc(doc, user, ctx) {
  if (isManage(user)) return true;                         // thư ký/chủ trì/admin: phục vụ chuẩn bị tài liệu
  if (doc.ownerId === user.sub) return true;
  if (Array.isArray(doc.sharedWith) && doc.sharedWith.includes(user.sub)) return true;
  if (doc.kind === 'personal') return false;               // cá nhân: chỉ owner/được chia sẻ
  const inMeeting = !doc.meetingId || ctx.myMeetingIds.has(doc.meetingId);
  if (!inMeeting) return false;                            // tài liệu họp: phải là thành phần
  if (doc.secret) return false;                            // tài liệu MẬT: đại biểu thường không đọc
  return true;
}

/** Biểu quyết kín: giữ phiếu của CHÍNH MÌNH, ẩn danh phiếu người khác (bỏ userId + comment) */
export function projectVote(vote, user, ctx) {
  const eligible = Array.isArray(vote.eligibleIds) && vote.eligibleIds.includes(user.sub);
  const inMeeting = vote.meetingId ? ctx.myMeetingIds.has(vote.meetingId) : true;
  if (!(isManage(user) || vote.createdBy === user.sub || eligible || inMeeting)) return null;

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
 * Phiên họp: người NGOÀI phiên vẫn thấy lịch (tiêu đề, thời gian, phòng, chương trình)
 * nhưng KHÔNG đọc được BIÊN BẢN và KẾT LUẬN (nội dung nghị sự nhạy cảm).
 * Thành phần/quản lý: xem đầy đủ.
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
      return rows.map((m) => projectMeeting(m, user));
    case 'tasks':
      return rows.filter((t) => canReadTask(t, user, ctx));
    case 'speakRequests':
      return rows.filter((s) => canReadSpeak(s, user, ctx));
    default:
      return rows;
  }
}
