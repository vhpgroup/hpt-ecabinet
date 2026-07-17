// ============================================================
// LocalStorageAdapter — nguồn dữ liệu giai đoạn 1 (demo).
// Có fallback bộ nhớ trong (khi chạy trong iframe bị chặn storage).
// ============================================================
import type { DataSource, Repo } from './repository';
import { createRestDataSource } from './restAdapter';
import { getApiBase, getServerUrl } from './apiBase';
import { buildSeed } from './seed';

const PREFIX = 'ecab.';
const memory = new Map<string, string>();

const storage = {
  get(key: string): string | null {
    try { return localStorage.getItem(PREFIX + key); } catch { return memory.get(key) ?? null; }
  },
  set(key: string, value: string) {
    try { localStorage.setItem(PREFIX + key, value); } catch { /* quota/sandbox */ }
    memory.set(key, value);
  },
  remove(key: string) {
    try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
    memory.delete(key);
  },
};

class LocalRepo<T extends { id: string }> implements Repo<T> {
  constructor(private key: string) {}

  private read(): T[] {
    const raw = storage.get(this.key);
    if (!raw) return [];
    try { return JSON.parse(raw) as T[]; } catch { return []; }
  }
  private write(items: T[]) {
    storage.set(this.key, JSON.stringify(items));
  }

  async list(): Promise<T[]> { return this.read(); }
  async get(id: string): Promise<T | undefined> { return this.read().find((x) => x.id === id); }
  async create(item: T): Promise<T> {
    const items = this.read();
    items.push(item);
    this.write(items);
    return item;
  }
  async update(id: string, patch: Partial<T>): Promise<T> {
    const items = this.read();
    const idx = items.findIndex((x) => x.id === id);
    if (idx < 0) throw new Error('Không tìm thấy bản ghi ' + id);
    items[idx] = { ...items[idx], ...patch };
    this.write(items);
    return items[idx];
  }
  async remove(id: string): Promise<void> {
    this.write(this.read().filter((x) => x.id !== id));
  }
  async saveAll(items: T[]): Promise<void> { this.write(items); }
}

const COLLECTIONS = [
  'users', 'units', 'rooms', 'meetings', 'documents', 'annotations',
  'votes', 'speakRequests', 'questions', 'messages', 'tasks', 'notifications', 'audit',
  'catalogs', 'guides', // ĐỢT 3: danh mục chung + tài liệu HDSD
  'apiKeys',            // RỔ B: khóa API bên thứ 3
] as const;

function seedIfEmpty(force = false) {
  if (!force && storage.get('seeded') === '1') return;
  const seed = buildSeed();
  for (const col of COLLECTIONS) {
    storage.set(col, JSON.stringify((seed as any)[col] ?? []));
  }
  storage.set('seeded', '1');
}

export function createDataSource(): DataSource {
  seedIfEmpty();
  const ds: DataSource = {
    users: new LocalRepo('users'),
    units: new LocalRepo('units'),
    rooms: new LocalRepo('rooms'),
    meetings: new LocalRepo('meetings'),
    documents: new LocalRepo('documents'),
    annotations: new LocalRepo('annotations'),
    votes: new LocalRepo('votes'),
    speakRequests: new LocalRepo('speakRequests'),
    questions: new LocalRepo('questions'),
    messages: new LocalRepo('messages'),
    tasks: new LocalRepo('tasks'),
    notifications: new LocalRepo('notifications'),
    audit: new LocalRepo('audit'),
    catalogs: new LocalRepo('catalogs'),
    guides: new LocalRepo('guides'),
    apiKeys: new LocalRepo('apiKeys'),
    async reset() {
      seedIfEmpty(true);
    },
    getSession() { return storage.get('session'); },
    setSession(userId) {
      if (userId) storage.set('session', userId);
      else storage.remove('session');
    },
  };
  return ds;
}

// ------------------------------------------------------------
// FACTORY CHỌN NGUỒN DỮ LIỆU (GĐ2 + APP NATIVE)
// Nguồn địa chỉ máy chủ được phân giải LÚC CHẠY qua apiBase.getApiBase():
//   1) localStorage['ecabinet.serverUrl']  (người dùng nhập trong app native)
//   2) import.meta.env.VITE_API_URL         (đóng cứng lúc build, nếu có)
//   3) '' (rỗng)                             -> LocalStorageAdapter (demo cục bộ)
//
// Nhờ (1): app Capacitor build MỘT lần (không cần đặt VITE_API_URL) vẫn có thể
// trỏ tới BẤT KỲ máy chủ nào — chỉ cần người dùng nhập URL trong app rồi reload.
// Đổi máy chủ = apiBase.setServerUrl(url) + location.reload() (khởi động lại app).
// ------------------------------------------------------------
const API_URL: string = getApiBase();

export const db: DataSource = API_URL ? createRestDataSource(API_URL) : createDataSource();

if (API_URL) {
  const via = getServerUrl() ? 'người dùng chọn' : 'cấu hình build';
  console.info(`[eCabinet] Chế độ máy chủ (REST) [${via}]:`, API_URL);
}
