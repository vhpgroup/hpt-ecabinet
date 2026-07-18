// ============================================================
// AUTH — mô phỏng đăng nhập/phiên làm việc.
// Giai đoạn 2: thay bằng JWT/OAuth phía server, giữ nguyên chữ ký hàm.
// ============================================================
import { db } from '../data/db';
import type { Role, User } from '../domain/types';
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
  /**
   * P0-1 (dungthu-tester.md) + HSMT dòng 354-355 "Quản trị đơn vị nhập thông tin cuộc họp":
   * unit_admin được TẠO phiên họp mới, ngoài nhóm quản lý sẵn có (mirror ACL server —
   * `meetings.create = [...MANAGE, 'unit_admin']`). KHÔNG mở rộng quyền SỬA/XÓA — đó vẫn
   * chỉ dành cho MANAGE (đúng phạm vi vá P0-2 phía backend, xem `index.js enforceMeetingWrite`).
   */
  createMeeting: (u: User | null) => !!u && (['admin', 'secretary', 'chairman'].includes(u.role) || u.role === 'unit_admin'),
  /**
   * Gửi giấy mời: quản lý toàn cục HOẶC unit_admin với phiên THUỘC ĐƠN VỊ MÌNH (đơn vị của
   * phiên = đơn vị của chủ trì — cùng khái niệm dùng lúc tạo phiên). Mirror
   * `POST /api/actions/meetings/:id/invite` phía server (P0-2).
   */
  sendInvitations: (actor: User | null, chairUnitId: string | undefined) =>
    !!actor && (['admin', 'secretary', 'chairman'].includes(actor.role)
      || (actor.role === 'unit_admin' && !!actor.unitId && actor.unitId === chairUnitId)),
  // ---- Quản trị đơn vị (unit_admin) — E-HSMT vai trò thứ 5 ----
  /** Được vào phân hệ quản trị (admin toàn quyền; unit_admin CHỈ thấy tab Người dùng). */
  openAdmin: (u: User | null) => !!u && (u.role === 'admin' || u.role === 'unit_admin'),
  /** Quản trị NGƯỜI DÙNG: admin toàn hệ thống; unit_admin trong phạm vi đơn vị mình. */
  manageUsers: (u: User | null) => !!u && (u.role === 'admin' || u.role === 'unit_admin'),
  /**
   * unit_admin có được thao tác trên MỘT người dùng cụ thể không?
   * Ràng buộc (mirror đúng kiểm tra sâu phía server):
   *  - phải CÙNG đơn vị (unitId) với chính unit_admin;
   *  - KHÔNG được đụng tài khoản có vai trò 'admin';
   *  - KHÔNG được thao tác trên chính mình qua màn quản trị (tránh tự đổi unitId/role).
   * admin thì luôn được.
   */
  manageThisUser: (actor: User | null, target: User) => {
    if (!actor) return false;
    if (actor.role === 'admin') return true;
    if (actor.role !== 'unit_admin') return false;
    if (target.role === 'admin') return false;      // không quản trị được quản trị hệ thống
    if (target.id === actor.id) return false;        // không tự sửa mình ở màn quản trị
    return target.unitId === actor.unitId;           // chỉ trong đơn vị mình
  },
  /** unit_admin KHÔNG được đặt vai trò 'admin' cho ai; admin thì được. */
  canAssignRole: (actor: User | null, role: Role) =>
    !!actor && (actor.role === 'admin' || (actor.role === 'unit_admin' && role !== 'admin')),
  /** Xóa người dùng: CHỈ admin (unit_admin không được xóa — mirror ACL server). */
  removeUser: (u: User | null) => !!u && u.role === 'admin',
};
