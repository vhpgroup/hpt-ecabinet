// ============================================================
// QUẢN TRỊ — người dùng, đơn vị, phòng họp + nhật ký hệ thống
// ============================================================
import { db } from '../data/db';
import { uid, type AuditEntry, type Room, type Unit, type User } from '../domain/types';

export async function audit(user: User | { id: string; fullName: string } | null, action: string, detail: string) {
  const entry: AuditEntry = {
    id: uid(),
    userId: user?.id ?? 'system',
    userName: (user as User)?.fullName ?? 'Hệ thống',
    action,
    detail,
    at: new Date().toISOString(),
  };
  await db.audit.create(entry);
}

// ----- Người dùng -----
export async function saveUser(actor: User, data: Partial<User> & { id?: string }): Promise<User> {
  if (data.id) {
    const updated = await db.users.update(data.id, data);
    await audit(actor, 'Cập nhật người dùng', `Cập nhật tài khoản ${updated.username} (${updated.fullName})`);
    return updated;
  }
  const user: User = {
    id: uid(), username: '', password: '123456', fullName: '', title: '', unitId: '',
    role: 'delegate', email: '', phone: '', avatarColor: '#0f4c92', status: 'active',
    ...data,
  } as User;
  await db.users.create(user);
  await audit(actor, 'Tạo người dùng', `Tạo tài khoản ${user.username} (${user.fullName})`);
  return user;
}

export async function removeUser(actor: User, id: string) {
  const u = await db.users.get(id);
  await db.users.remove(id);
  await audit(actor, 'Xóa người dùng', `Xóa tài khoản ${u?.username ?? id}`);
}

// ----- Đơn vị -----
export async function saveUnit(actor: User, data: Partial<Unit> & { id?: string }): Promise<Unit> {
  if (data.id) {
    const updated = await db.units.update(data.id, data);
    await audit(actor, 'Cập nhật đơn vị', `Cập nhật đơn vị ${updated.name}`);
    return updated;
  }
  const unit: Unit = { id: uid(), name: '', short: '', order: 99, ...data } as Unit;
  await db.units.create(unit);
  await audit(actor, 'Tạo đơn vị', `Tạo đơn vị ${unit.name}`);
  return unit;
}

export async function removeUnit(actor: User, id: string) {
  await db.units.remove(id);
  await audit(actor, 'Xóa đơn vị', `Xóa đơn vị ${id}`);
}

// ----- Phòng họp -----
export async function saveRoom(actor: User, data: Partial<Room> & { id?: string }): Promise<Room> {
  if (data.id) {
    const updated = await db.rooms.update(data.id, data);
    await audit(actor, 'Cập nhật phòng họp', `Cập nhật ${updated.name}`);
    return updated;
  }
  const room: Room = {
    id: uid(), name: '', location: '', capacity: 20, equipment: [], supportsOnline: false, status: 'active',
    ...data,
  } as Room;
  await db.rooms.create(room);
  await audit(actor, 'Tạo phòng họp', `Tạo ${room.name}`);
  return room;
}

export async function removeRoom(actor: User, id: string) {
  await db.rooms.remove(id);
  await audit(actor, 'Xóa phòng họp', `Xóa phòng họp ${id}`);
}

export async function resetAllData() {
  await db.reset();
}

// ----- Nhật ký hệ thống (E-HSMT mục 3) -----
/**
 * Xóa các bản ghi nhật ký theo danh sách id (kết quả đang lọc trên UI).
 * CHỈ admin (ACL server 'remove: [admin]'); local demo xóa trực tiếp.
 * Ghi 1 dòng nhật ký tổng kết SAU khi xóa (không tự xóa dòng này).
 */
export async function clearAuditLogs(actor: User, ids: string[]): Promise<number> {
  let n = 0;
  for (const id of ids) {
    try { await db.audit.remove(id); n++; } catch { /* bỏ qua bản ghi lỗi/không quyền */ }
  }
  if (n > 0) await audit(actor, 'Xóa nhật ký', `Xóa ${n} bản ghi nhật ký hệ thống`);
  return n;
}
