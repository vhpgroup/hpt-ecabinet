// ============================================================
// THÔNG BÁO — trong ứng dụng (mô phỏng thêm kênh email/SMS ở GĐ2)
// ============================================================
import { db } from '../data/db';
import { uid, type Notification } from '../domain/types';

export async function notify(
  userIds: string[],
  title: string,
  body: string,
  type: Notification['type'] = 'system',
  link?: string,
) {
  const now = new Date().toISOString();
  for (const userId of userIds) {
    await db.notifications.create({ id: uid(), userId, title, body, type, read: false, createdAt: now, link });
  }
}

export async function markRead(id: string) {
  await db.notifications.update(id, { read: true });
}

export async function markAllRead(userId: string) {
  const all = await db.notifications.list();
  const mine = all.filter((n) => n.userId === userId && !n.read);
  for (const n of mine) await db.notifications.update(n.id, { read: true });
}
