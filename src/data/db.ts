// ============================================================
// LocalStorageAdapter — nguồn dữ liệu giai đoạn 1 (demo).
// Có fallback bộ nhớ trong (khi chạy trong iframe bị chặn storage).
// ============================================================
import type { DataSource, Repo } from './repository';
import { createRestDataSource } from './restAdapter';
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
  'votes', 'speakRequests', 'messages', 'tasks', 'notifications', 'audit',
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
    messages: new LocalRepo('messages'),
    tasks: new LocalRepo('tasks'),
    notifications: new LocalRepo('notifications'),
    audit: new LocalRepo('audit'),
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
// FACTORY CHỌN NGUỒN DỮ LIỆU (GĐ2)
// - Đặt VITE_API_URL (vd "/api") lúc build  -> RestApiAdapter (máy chủ + JWT)
// - Không đặt                                -> LocalStorageAdapter (demo)
// ------------------------------------------------------------
const API_URL: string | undefined =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_URL)
  ?? ((globalThis as Record<string, unknown>).__ECABINET_API_URL__ as string | undefined);

export const db: DataSource = API_URL ? createRestDataSource(API_URL) : createDataSource();

if (API_URL) console.info('[eCabinet] Chế độ máy chủ (REST):', API_URL);
