// ============================================================
// DỊCH VỤ KHÓA API BÊN THỨ 3 (RỔ B — E-HSMT mục 54–59)
// - Chế độ MÁY CHỦ: gọi endpoint nghiệp vụ /api/apikeys/... (key sinh server-side).
// - Chế độ DEMO cục bộ: sinh key + sha256 PHÍA CLIENT (không có server),
//   lưu vào localStorage; key thô chỉ hiện 1 lần.
// Trả về key THÔ đúng 1 lần khi tạo (createApiKey.key).
// ============================================================
import { db } from '../data/db';
import { uid, type ApiKey, type ApiScope } from '../domain/types';
import { sha256Hex } from './sha256';
import { audit } from './adminService';
import type { User } from '../domain/types';

/** Sinh key thô ngẫu nhiên phía client (chế độ demo). Định dạng ecab_<base64url>. */
function randomKeyLocal(): string {
  const bytes = new Uint8Array(24);
  (globalThis.crypto ?? ({} as Crypto)).getRandomValues?.(bytes);
  // base64url không padding
  let b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `ecab_${b64}`;
}

export interface CreateResult {
  /** Key THÔ — chỉ trả về đúng 1 lần này, KHÔNG lưu lại được sau đó */
  key: string;
  record: ApiKey;
}

/** Tạo khóa API mới. Trả về key thô (1 lần) + bản ghi (không kèm keyHash). */
export async function createApiKey(
  actor: User,
  input: { name: string; scopes: ApiScope[]; note?: string },
): Promise<CreateResult> {
  const name = input.name.trim();
  if (!name) throw new Error('Vui lòng nhập tên hệ thống/đơn vị tích hợp');
  if (!input.scopes || input.scopes.length === 0) throw new Error('Chọn ít nhất một phạm vi (meetings / documents)');

  // Chế độ máy chủ: key sinh server-side (an toàn nhất)
  if (db.remote && db.apiKeyCreate) {
    const res = await db.apiKeyCreate({ name, scopes: input.scopes, note: input.note });
    return { key: res.key, record: res.record as ApiKey };
  }

  // Chế độ demo cục bộ: sinh key + hash phía client
  const raw = randomKeyLocal();
  const record: ApiKey = {
    id: uid(),
    name,
    prefix: raw.slice(0, 8),
    keyHash: sha256Hex(raw),
    scopes: input.scopes,
    active: true,
    createdAt: new Date().toISOString(),
    createdById: actor.id,
    callCount: 0,
    note: input.note?.trim() || undefined,
  };
  await db.apiKeys.create(record);
  await audit(actor, 'Tạo khóa API', `Cấp khóa API cho "${name}" (prefix ${record.prefix}…, scope ${input.scopes.join(', ')})`);
  return { key: raw, record };
}

/** Thu hồi khóa (active=false). */
export async function revokeApiKey(actor: User, key: ApiKey): Promise<void> {
  if (db.remote && db.apiKeyRevoke) {
    await db.apiKeyRevoke(key.id);
    return;
  }
  await db.apiKeys.update(key.id, { active: false });
  await audit(actor, 'Thu hồi khóa API', `Thu hồi khóa API "${key.name}" (prefix ${key.prefix}…)`);
}

/** Kích hoạt lại khóa (active=true). */
export async function enableApiKey(actor: User, key: ApiKey): Promise<void> {
  if (db.remote && db.apiKeyEnable) {
    await db.apiKeyEnable(key.id);
    return;
  }
  await db.apiKeys.update(key.id, { active: true });
  await audit(actor, 'Kích hoạt khóa API', `Kích hoạt lại khóa API "${key.name}" (prefix ${key.prefix}…)`);
}

/** Xóa hẳn khóa (ACL server: chỉ admin). */
export async function removeApiKey(actor: User, key: ApiKey): Promise<void> {
  await db.apiKeys.remove(key.id);
  await audit(actor, 'Xóa khóa API', `Xóa khóa API "${key.name}" (prefix ${key.prefix}…)`);
}

/** Cập nhật ghi chú/tên khóa (không đổi keyHash/prefix — server guard chặn). */
export async function updateApiKeyMeta(actor: User, key: ApiKey, patch: Partial<Pick<ApiKey, 'name' | 'note' | 'scopes'>>): Promise<void> {
  await db.apiKeys.update(key.id, patch);
  await audit(actor, 'Cập nhật khóa API', `Cập nhật khóa API "${key.name}"`);
}
