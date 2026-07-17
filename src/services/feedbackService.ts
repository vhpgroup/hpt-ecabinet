// ============================================================
// PHẢN HỒI / GÓP Ý NGƯỜI DÙNG (HSMT tiêu chí 5.1–5.4 "Sự hài lòng người sử dụng")
// Form gửi trong app + danh sách theo dõi trạng thái/trả lời của người dùng;
// khu quản trị: danh sách toàn bộ, đổi trạng thái, nhập nội dung trả lời.
// ============================================================
import { db } from '../data/db';
import { uid, type Feedback, type FeedbackCategory, type FeedbackStatus, type User } from '../domain/types';
import { audit } from './adminService';
import { notify } from './notificationService';

const nowIso = () => new Date().toISOString();

/** Gửi phản hồi/góp ý mới — bất kỳ người dùng đăng nhập. */
export async function submitFeedback(
  actor: User, category: FeedbackCategory, content: string,
): Promise<Feedback> {
  if (!content.trim()) throw new Error('Vui lòng nhập nội dung phản hồi');
  const fb: Feedback = {
    id: uid(),
    userId: actor.id,
    unitId: actor.unitId,
    category,
    content: content.trim(),
    status: 'new',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await db.feedbacks.create(fb);
  await audit(actor, 'Gửi phản hồi/góp ý', `Gửi phản hồi (${category})`);
  return fb;
}

/** Phản hồi của TÔI, mới nhất trước. */
export function myFeedbacks(all: Feedback[], userId: string): Feedback[] {
  return all.filter((f) => f.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Xử lý phản hồi: đổi trạng thái + (tùy chọn) nhập nội dung trả lời cùng lúc.
 * Quản trị hệ thống (toàn bộ) hoặc Quản trị đơn vị (phản hồi TRONG ĐƠN VỊ MÌNH)
 * — mirror guardFeedbacks phía server (vai trò HSMT "nhận & phân phối yêu cầu");
 * chủ trì/thư ký KHÔNG xử lý phản hồi (vá QA 18/07).
 */
export async function updateFeedback(
  actor: User, id: string, patch: { status?: FeedbackStatus; response?: string },
): Promise<Feedback> {
  if (actor.role !== 'admin' && actor.role !== 'unit_admin') {
    throw new Error('Bạn không có quyền xử lý phản hồi');
  }
  if (actor.role === 'unit_admin') {
    const target = await db.feedbacks.get(id);
    if (!target || target.unitId !== actor.unitId) {
      throw new Error('Quản trị đơn vị chỉ xử lý phản hồi trong đơn vị mình');
    }
  }
  const updated = await db.feedbacks.update(id, {
    ...patch,
    handledBy: actor.id,
    updatedAt: nowIso(),
  });
  await audit(actor, 'Xử lý phản hồi', `Cập nhật phản hồi #${id}${patch.status ? ` -> ${patch.status}` : ''}`);
  if (patch.response && patch.response.trim()) {
    await notify([updated.userId], 'Phản hồi của bạn đã được trả lời',
      `Phản hồi/góp ý của bạn đã có phản hồi từ bộ phận hỗ trợ: ${patch.response.trim().slice(0, 160)}`,
      'system', '#/support');
  }
  return updated;
}
