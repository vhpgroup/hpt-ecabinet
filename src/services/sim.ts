// ============================================================
// MÔ PHỎNG THỜI GIAN THỰC — tạo cảm giác "phòng họp sống":
// đại biểu khác lần lượt điểm danh, biểu quyết, nhắn tin.
// Giai đoạn 2: thay bằng WebSocket/SSE từ server.
// ============================================================
import { db } from '../data/db';
import { uid } from '../domain/types';

const chance = (p: number) => Math.random() < p;

const SAMPLE_MSGS = [
  'Đề nghị bổ sung số liệu so sánh cùng kỳ vào phụ lục.',
  'Thống nhất với phương án của cơ quan trình.',
  'Đề nghị gửi thêm bản thuyết minh chi tiết sau phiên họp.',
  'Nội dung này cần xin ý kiến Thường trực trước khi ban hành.',
  'Nhất trí, đề nghị triển khai sớm trong quý III.',
];

/** Gọi định kỳ (2–4s/lần) khi đang ở màn hình phiên họp trực tiếp */
export async function simulateLiveTick(meetingId: string, excludeUserId: string): Promise<boolean> {
  // Chế độ máy chủ (GĐ2): dữ liệu thật do nhiều người dùng tạo ra — không mô phỏng.
  // Trang live vẫn tự refresh định kỳ (polling); GĐ3 nâng cấp WebSocket đẩy sự kiện.
  if (db.remote) return true;
  let changed = false;
  const meeting = await db.meetings.get(meetingId);
  if (!meeting || meeting.status !== 'live') return false;

  // 1) Đại biểu chưa điểm danh lần lượt điểm danh
  if (chance(0.35)) {
    const pending = meeting.participants.filter(
      (p) => !p.checkedInAt && p.userId !== excludeUserId && p.attendStatus === 'accepted',
    );
    if (pending.length) {
      const pick = pending[Math.floor(Math.random() * pending.length)];
      await db.meetings.update(meetingId, {
        participants: meeting.participants.map((p) =>
          p.userId === pick.userId ? { ...p, checkedInAt: new Date().toISOString() } : p,
        ),
      });
      changed = true;
    }
  }

  // 2) Biểu quyết đang mở: đại biểu khác bỏ phiếu dần
  const votes = (await db.votes.list()).filter((v) => v.meetingId === meetingId && v.status === 'open');
  for (const v of votes) {
    if (!chance(0.45)) continue;
    const notVoted = v.eligibleIds.filter(
      (idX) => idX !== excludeUserId && !v.ballots.some((b) => b.userId === idX),
    );
    if (!notVoted.length) continue;
    const userId = notVoted[Math.floor(Math.random() * notVoted.length)];
    // 80% đồng ý, 12% ý kiến khác, 8% không đồng ý (nếu đủ 3 phương án)
    const r = Math.random();
    const optionId = v.options[r < 0.8 ? 0 : r < 0.92 ? Math.min(2, v.options.length - 1) : Math.min(1, v.options.length - 1)].id;
    await db.votes.update(v.id, {
      ballots: [...v.ballots, { userId, optionId, castAt: new Date().toISOString() }],
    });
    changed = true;
  }

  // 3) Thi thoảng có tin nhắn trao đổi chung
  if (chance(0.12)) {
    const candidates = meeting.participants.filter((p) => p.userId !== excludeUserId && p.checkedInAt);
    if (candidates.length) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      await db.messages.create({
        id: uid(), meetingId, fromId: pick.userId, toId: null,
        content: SAMPLE_MSGS[Math.floor(Math.random() * SAMPLE_MSGS.length)],
        sentAt: new Date().toISOString(),
      });
      changed = true;
    }
  }

  return changed;
}
