// ============================================================
// CHẤT VẤN — nghiệp vụ theo E-HSMT (mục 34/45/46 web, 80/89/90 mobile).
// - Đại biểu: đăng ký / hủy đăng ký / xem danh sách & nội dung chất vấn.
// - Chủ tọa (chủ trì/thư ký): điều hành phiên chất vấn (bắt đầu/tạm dừng/
//   kết thúc) và duyệt danh sách (gọi / từ chối, theo dõi đã gọi/chưa gọi).
//
// Tầng này KHÔNG phụ thuộc UI. Dùng CRUD chung (db.questions / db.meetings)
// giống hệt nghiệp vụ "đăng ký phát biểu": bảo mật do server thực thi ở
// guard.js/access.js/ACL; realtime tự đẩy qua notifyChange sau mỗi ghi.
// ============================================================
import { db } from '../data/db';
import { uid, type Meeting, type QuestionRequest, type User } from '../domain/types';
import { audit } from './adminService';
import { notify } from './notificationService';

const nowIso = () => new Date().toISOString();

// ---------------- Bộ chọn (selector) dùng chung UI ----------------

/** Toàn bộ lượt chất vấn của 1 phiên họp. */
export function questionsOf(all: QuestionRequest[], meetingId: string): QuestionRequest[] {
  return all.filter((q) => q.meetingId === meetingId);
}

/** Danh sách CHƯA GỌI (đang chờ) — sắp theo thứ tự đăng ký. */
export function pendingQuestions(all: QuestionRequest[], meetingId: string): QuestionRequest[] {
  return questionsOf(all, meetingId)
    .filter((q) => q.status === 'pending')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt));
}

/** Danh sách ĐÃ GỌI (đang chất vấn / đã xong / bị từ chối) — mới nhất trước. */
export function calledQuestions(all: QuestionRequest[], meetingId: string): QuestionRequest[] {
  return questionsOf(all, meetingId)
    .filter((q) => q.status === 'called' || q.status === 'done' || q.status === 'rejected')
    .sort((a, b) => (b.calledAt ?? b.createdAt).localeCompare(a.calledAt ?? a.createdAt));
}

/** Lượt đang được gọi chất vấn (tối đa 1 tại một thời điểm). */
export function activeQuestion(all: QuestionRequest[], meetingId: string): QuestionRequest | undefined {
  return questionsOf(all, meetingId).find((q) => q.status === 'called');
}

/** Trạng thái phiên chất vấn (mặc định 'closed' khi chưa đặt). */
export function sessionState(m: Meeting): 'closed' | 'open' | 'paused' {
  return m.questionSession ?? 'closed';
}

// ---------------- Đại biểu: đăng ký / hủy ----------------

/**
 * Đăng ký chất vấn (E-HSMT mục 34/80). Điều kiện: phiên họp ĐANG diễn ra
 * và phiên chất vấn ĐANG MỞ ('open'). Server guard chặn tạo hộ người khác.
 */
export async function registerQuestion(
  actor: User,
  meetingId: string,
  input: { targetName?: string; topic: string; content?: string },
): Promise<QuestionRequest> {
  const m = await db.meetings.get(meetingId);
  if (!m) throw new Error('Không tìm thấy phiên họp');
  if (m.status !== 'live') throw new Error('Chỉ đăng ký chất vấn khi phiên họp đang diễn ra');
  if (sessionState(m) !== 'open') throw new Error('Phiên chất vấn chưa mở — vui lòng chờ chủ tọa');
  const topic = input.topic.trim();
  if (!topic) throw new Error('Vui lòng nhập chủ đề chất vấn');

  const all = await db.questions.list();
  const mine = all.filter((q) => q.meetingId === meetingId && q.userId === actor.id);
  if (mine.some((q) => q.status === 'pending' || q.status === 'called')) {
    throw new Error('Bạn đang có lượt đăng ký chất vấn chờ xử lý');
  }
  // thứ tự = số lượt đã đăng ký trong phiên (dự phòng sắp xếp ổn định)
  const order = all.filter((q) => q.meetingId === meetingId).length + 1;

  const q: QuestionRequest = {
    id: uid(),
    meetingId,
    userId: actor.id,
    targetName: input.targetName?.trim() || undefined,
    topic,
    content: input.content?.trim() || undefined,
    status: 'pending',
    order,
    createdAt: nowIso(),
  };
  await db.questions.create(q);
  // thông báo thư ký để theo dõi danh sách chất vấn
  await notify([m.secretaryId].filter((idX) => idX !== actor.id),
    'Đăng ký chất vấn',
    `${actor.fullName} đã đăng ký chất vấn: "${topic}".`,
    'meeting', `#/meetings/${meetingId}/live`);
  await audit(actor, 'Đăng ký chất vấn', `Đăng ký chất vấn "${topic}" tại "${m.title}"`);
  return q;
}

/** Hủy đăng ký chất vấn của CHÍNH MÌNH khi còn 'pending' (E-HSMT mục 34/80). */
export async function cancelQuestion(actor: User, id: string): Promise<void> {
  const q = await db.questions.get(id);
  if (!q) throw new Error('Không tìm thấy lượt đăng ký chất vấn');
  if (q.userId !== actor.id) throw new Error('Chỉ được hủy đăng ký chất vấn của chính mình');
  if (q.status !== 'pending') throw new Error('Chỉ hủy được khi đang chờ gọi');
  await db.questions.remove(id);
  await audit(actor, 'Hủy đăng ký chất vấn', `Hủy đăng ký chất vấn "${q.topic}"`);
}

// ---------------- Chủ tọa: duyệt danh sách (gọi / từ chối) ----------------

/**
 * Gọi chất vấn (E-HSMT mục 46/90): chuyển pending -> called, ghi calledAt.
 * Chỉ 1 lượt 'called' tại một thời điểm — tự kết thúc lượt đang gọi trước đó.
 */
export async function callQuestion(actor: User, id: string): Promise<void> {
  const q = await db.questions.get(id);
  if (!q) throw new Error('Không tìm thấy lượt đăng ký chất vấn');
  if (q.status !== 'pending') throw new Error('Chỉ gọi được lượt đang chờ');
  // kết thúc lượt đang chất vấn trước đó (nếu có) trong cùng phiên họp
  const all = await db.questions.list();
  for (const other of all.filter((x) => x.meetingId === q.meetingId && x.status === 'called')) {
    await db.questions.update(other.id, { status: 'done', endedAt: nowIso() });
  }
  await db.questions.update(id, { status: 'called', calledAt: nowIso() });
  await notify([q.userId].filter((idX) => idX !== actor.id),
    'Mời chất vấn',
    `Chủ tọa mời bạn chất vấn: "${q.topic}".`,
    'meeting', `#/meetings/${q.meetingId}/live`);
  await audit(actor, 'Gọi chất vấn', `Gọi chất vấn "${q.topic}"`);
}

/** Kết thúc lượt đang chất vấn (called -> done). */
export async function endQuestion(actor: User, id: string): Promise<void> {
  const q = await db.questions.get(id);
  if (!q) throw new Error('Không tìm thấy lượt đăng ký chất vấn');
  if (q.status !== 'called') throw new Error('Lượt này không ở trạng thái đang chất vấn');
  await db.questions.update(id, { status: 'done', endedAt: nowIso() });
  await audit(actor, 'Kết thúc chất vấn', `Kết thúc lượt chất vấn "${q.topic}"`);
}

/** Từ chối một lượt đăng ký đang chờ (pending -> rejected). */
export async function rejectQuestion(actor: User, id: string): Promise<void> {
  const q = await db.questions.get(id);
  if (!q) throw new Error('Không tìm thấy lượt đăng ký chất vấn');
  if (q.status !== 'pending') throw new Error('Chỉ từ chối được lượt đang chờ');
  await db.questions.update(id, { status: 'rejected', endedAt: nowIso() });
  await audit(actor, 'Từ chối chất vấn', `Từ chối lượt chất vấn "${q.topic}"`);
}

// ---------------- Chủ tọa: điều hành phiên chất vấn ----------------

/** Bắt đầu (mở) phiên chất vấn — E-HSMT mục 45/89 "Bắt đầu cho phép chất vấn". */
export async function openSession(actor: User, meetingId: string): Promise<void> {
  await setSession(actor, meetingId, 'open', 'Bắt đầu chất vấn', 'Bắt đầu cho phép chất vấn');
  const m = await db.meetings.get(meetingId);
  if (m) {
    await notify(m.participants.map((p) => p.userId).filter((idX) => idX !== actor.id),
      'Bắt đầu chất vấn',
      `Chủ tọa đã mở phiên chất vấn tại "${m.title}". Mời đại biểu đăng ký chất vấn.`,
      'meeting', `#/meetings/${meetingId}/live`);
  }
}

/** Tạm dừng phiên chất vấn — E-HSMT mục 45/89 "Dừng cho phép chất vấn". */
export async function pauseSession(actor: User, meetingId: string): Promise<void> {
  await setSession(actor, meetingId, 'paused', 'Tạm dừng chất vấn', 'Dừng cho phép chất vấn');
}

/**
 * Kết thúc phiên chất vấn — E-HSMT mục 45/89 "Kết thúc chất vấn".
 * Đóng phiên đồng thời kết thúc lượt đang được gọi (nếu có).
 */
export async function closeSession(actor: User, meetingId: string): Promise<void> {
  const all = await db.questions.list();
  for (const q of all.filter((x) => x.meetingId === meetingId && x.status === 'called')) {
    await db.questions.update(q.id, { status: 'done', endedAt: nowIso() });
  }
  await setSession(actor, meetingId, 'closed', 'Kết thúc chất vấn', 'Kết thúc chất vấn');
}

/** Đổi trạng thái phiên chất vấn của meeting (dùng chung bởi 3 hàm trên). */
async function setSession(
  actor: User, meetingId: string,
  state: 'closed' | 'open' | 'paused',
  action: string, detail: string,
): Promise<void> {
  const m = await db.meetings.get(meetingId);
  if (!m) throw new Error('Không tìm thấy phiên họp');
  if (m.status !== 'live') throw new Error('Chỉ điều hành chất vấn khi phiên họp đang diễn ra');
  await db.meetings.update(meetingId, { questionSession: state });
  await audit(actor, action, `${detail} — "${m.title}"`);
}
