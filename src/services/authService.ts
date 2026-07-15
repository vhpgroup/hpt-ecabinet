// ============================================================
// AUTH — mô phỏng đăng nhập/phiên làm việc.
// Giai đoạn 2: thay bằng JWT/OAuth phía server, giữ nguyên chữ ký hàm.
// ============================================================
import { db } from '../data/db';
import type { User } from '../domain/types';
import { audit } from './adminService';

export async function login(username: string, password: string): Promise<User> {
  // GĐ2 — chế độ máy chủ: xác thực JWT phía server, mật khẩu không rời server
  if (db.login) {
    const user = await db.login(username.trim().toLowerCase(), password);
    db.setSession(user.id);
    return user; // server tự ghi nhật ký đăng nhập
  }
  // Chế độ demo cục bộ (GĐ1)
  const users = await db.users.list();
  const user = users.find((u) => u.username === username.trim().toLowerCase());
  if (!user) throw new Error('Tài khoản không tồn tại');
  if (user.status !== 'active') throw new Error('Tài khoản đã bị khóa');
  if (user.password !== password) throw new Error('Mật khẩu không đúng');
  db.setSession(user.id);
  await audit(user, 'Đăng nhập', 'Đăng nhập hệ thống thành công');
  return user;
}

export function logout(): void {
  db.setSession(null);
}

export async function currentUser(): Promise<User | null> {
  const id = db.getSession();
  if (!id) return null;
  try {
    return (await db.users.get(id)) ?? null;
  } catch {
    return null; // máy chủ không phản hồi / token hết hạn -> về trang đăng nhập
  }
}

// Phân quyền tập trung — UI và services cùng dùng
export const can = {
  manageMeetings: (u: User | null) => !!u && ['admin', 'secretary', 'chairman'].includes(u.role),
  manageSystem: (u: User | null) => !!u && u.role === 'admin',
  chairControls: (u: User | null, chairId: string, secretaryId: string) =>
    !!u && (u.id === chairId || u.id === secretaryId || u.role === 'admin'),
  signMinutes: (u: User | null, chairId: string, secretaryId: string) =>
    !!u && (u.id === chairId || u.id === secretaryId),
};
