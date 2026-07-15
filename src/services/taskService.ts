// ============================================================
// NHIỆM VỤ SAU HỌP — giao việc từ kết luận, theo dõi tiến độ
// ============================================================
import { db } from '../data/db';
import { uid, type TaskItem, type User } from '../domain/types';
import { audit } from './adminService';
import { notify } from './notificationService';

const nowIso = () => new Date().toISOString();

export async function createTask(
  actor: User,
  data: { title: string; description?: string; assigneeId: string; deadline: string; meetingId?: string | null },
): Promise<TaskItem> {
  const task: TaskItem = {
    id: uid(), meetingId: data.meetingId ?? null,
    title: data.title, description: data.description,
    assigneeId: data.assigneeId, deadline: data.deadline,
    status: 'open', progress: 0, createdAt: nowIso(), updatedAt: nowIso(),
  };
  await db.tasks.create(task);
  await notify([data.assigneeId], 'Nhiệm vụ mới',
    `Bạn được giao nhiệm vụ "${task.title}" — hạn ${new Date(task.deadline).toLocaleDateString('vi-VN')}.`, 'task', '#/tasks');
  await audit(actor, 'Giao nhiệm vụ', `"${task.title}" → ${data.assigneeId}`);
  return task;
}

export async function updateTaskProgress(actor: User, id: string, progress: number) {
  const status = progress >= 100 ? 'done' : progress > 0 ? 'doing' : 'open';
  await db.tasks.update(id, { progress: Math.min(100, Math.max(0, progress)), status, updatedAt: nowIso() });
  await audit(actor, 'Cập nhật nhiệm vụ', `Tiến độ ${progress}% — nhiệm vụ ${id}`);
}

export async function removeTask(actor: User, id: string) {
  await db.tasks.remove(id);
  await audit(actor, 'Xóa nhiệm vụ', `Xóa nhiệm vụ ${id}`);
}

export const isOverdue = (t: TaskItem) => t.status !== 'done' && new Date(t.deadline).getTime() < Date.now();
