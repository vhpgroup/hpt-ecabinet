// ============================================================
// DANH MỤC CHUNG (E-HSMT mục 6, 7, 10) + TÀI LIỆU HDSD (mục 4)
// CRUD danh mục chức vụ / loại phiên họp / cơ quan ban hành và
// tài liệu hướng dẫn sử dụng. Chỉ Quản trị hệ thống thao tác ghi
// (ACL server đã siết); đọc thì mọi người (guides lọc theo vai trò).
// ============================================================
import { db } from '../data/db';
import { uid, type CatalogItem, type CatalogType, type GuideDoc, type Role, type User } from '../domain/types';
import { audit } from './adminService';

const nowIso = () => new Date().toISOString();

// ----- Danh mục chung -----
/** Lọc + sắp xếp danh mục theo loại (nhỏ order trước, rồi theo tên). */
export function catalogsByType(items: CatalogItem[], type: CatalogType, onlyActive = false): CatalogItem[] {
  return items
    .filter((c) => c.type === type && (!onlyActive || c.active !== false))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
}

/** Danh sách TÊN gợi ý cho dropdown nghiệp vụ (chỉ mục đang bật). */
export function catalogNames(items: CatalogItem[], type: CatalogType): string[] {
  return catalogsByType(items, type, true).map((c) => c.name);
}

export async function saveCatalog(actor: User, data: Partial<CatalogItem> & { id?: string; type: CatalogType }): Promise<CatalogItem> {
  if (data.id) {
    const updated = await db.catalogs.update(data.id, data);
    await audit(actor, 'Cập nhật danh mục', `Cập nhật danh mục ${data.type ?? ''}: ${updated.name}`);
    return updated;
  }
  const item: CatalogItem = {
    id: uid(), type: data.type, name: (data.name ?? '').trim(),
    description: data.description, order: data.order ?? 99,
    active: data.active ?? true, createdAt: nowIso(),
  };
  await db.catalogs.create(item);
  await audit(actor, 'Thêm danh mục', `Thêm danh mục ${item.type}: ${item.name}`);
  return item;
}

export async function toggleCatalog(actor: User, item: CatalogItem): Promise<void> {
  await db.catalogs.update(item.id, { active: !(item.active ?? true) });
  await audit(actor, 'Cập nhật danh mục', `${item.active === false ? 'Bật' : 'Tắt'} sử dụng "${item.name}"`);
}

export async function removeCatalog(actor: User, item: CatalogItem): Promise<void> {
  await db.catalogs.remove(item.id);
  await audit(actor, 'Xóa danh mục', `Xóa "${item.name}"`);
}

// ----- Tài liệu hướng dẫn sử dụng -----
/** HDSD mà một vai trò được xem (mirror access.js canReadGuide phía client). */
export function visibleGuides(guides: GuideDoc[], role: Role | undefined, isAdmin = false): GuideDoc[] {
  return guides
    .filter((g) => isAdmin || !g.roleScope || g.roleScope.length === 0 || (role && g.roleScope.includes(role)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveGuide(actor: User, data: Partial<GuideDoc> & { id?: string }): Promise<GuideDoc> {
  if (data.id) {
    const updated = await db.guides.update(data.id, { ...data, updatedAt: nowIso() });
    await audit(actor, 'Cập nhật HDSD', `Cập nhật tài liệu hướng dẫn "${updated.title}"`);
    return updated;
  }
  const g: GuideDoc = {
    id: uid(), title: (data.title ?? '').trim(),
    content: data.content, fileName: data.fileName, fileData: data.fileData,
    roleScope: data.roleScope ?? [], createdAt: nowIso(), updatedAt: nowIso(),
  };
  await db.guides.create(g);
  await audit(actor, 'Thêm HDSD', `Thêm tài liệu hướng dẫn "${g.title}"`);
  return g;
}

export async function removeGuide(actor: User, g: GuideDoc): Promise<void> {
  await db.guides.remove(g.id);
  await audit(actor, 'Xóa HDSD', `Xóa tài liệu hướng dẫn "${g.title}"`);
}
