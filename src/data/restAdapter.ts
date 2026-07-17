// ============================================================
// REST API ADAPTER — GIAI ĐOẠN 2
// Implement đúng interface DataSource: UI và services KHÔNG đổi,
// chỉ khác nguồn dữ liệu (máy chủ + PostgreSQL + JWT thay localStorage).
// Kích hoạt bằng biến build VITE_API_URL (vd "/api").
// ============================================================
import type { DataSource, Repo } from './repository';
import type { User } from '../domain/types';

const TOKEN_KEY = 'ecab.jwt';
const REFRESH_KEY = 'ecab.refresh';
const UID_KEY = 'ecab.uid';

class AuthError extends Error {
  auth = true as const;
}

// storage an toàn khi chạy trong iframe bị chặn localStorage
const mem = new Map<string, string>();
const store = {
  get(k: string): string | null {
    try { return localStorage.getItem(k) ?? mem.get(k) ?? null; } catch { return mem.get(k) ?? null; }
  },
  set(k: string, v: string) {
    try { localStorage.setItem(k, v); } catch { /* sandbox */ }
    mem.set(k, v);
  },
  remove(k: string) {
    try { localStorage.removeItem(k); } catch { /* sandbox */ }
    mem.delete(k);
  },
};

export function createRestDataSource(baseUrl: string): DataSource {
  const base = baseUrl.replace(/\/+$/, '');

  const clearSession = () => { store.remove(TOKEN_KEY); store.remove(REFRESH_KEY); store.remove(UID_KEY); };

  const headers = (): Record<string, string> => {
    const t = store.get(TOKEN_KEY);
    return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
  };

  // ---------- GĐ4: tự gia hạn access token bằng refresh token (xoay vòng) ----------
  let refreshing: Promise<boolean> | null = null;

  async function tryRefresh(): Promise<boolean> {
    if (!refreshing) {
      refreshing = (async () => {
        const rt = store.get(REFRESH_KEY);
        if (!rt) return false;
        try {
          const res = await fetch(`${base}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: rt }),
          });
          if (!res.ok) return false;
          const d = (await res.json()) as { token?: string; refreshToken?: string };
          if (!d.token || !d.refreshToken) return false;
          store.set(TOKEN_KEY, d.token);
          store.set(REFRESH_KEY, d.refreshToken);
          return true;
        } catch {
          return false;
        }
      })().finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const doFetch = () => fetch(`${base}${path}`, {
      method,
      headers: headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    let res = await doFetch();
    // 401: thử gia hạn phiên MỘT lần rồi gọi lại
    if (res.status === 401 && (await tryRefresh())) {
      res = await doFetch();
    }
    if (res.status === 401) {
      clearSession();
      throw new AuthError('Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại');
    }
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      const e = new Error(err.error ?? `Lỗi máy chủ (HTTP ${res.status})`);
      (e as Error & { status?: number }).status = res.status;
      throw e;
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  class RestRepo<T extends { id: string }> implements Repo<T> {
    constructor(private col: string) {}

    async list(): Promise<T[]> {
      try {
        return await call<T[]>('GET', `/${this.col}`);
      } catch (e) {
        if ((e as AuthError).auth) return []; // chưa đăng nhập -> app điều hướng về login
        throw e;
      }
    }

    async get(id: string): Promise<T | undefined> {
      try {
        return await call<T>('GET', `/${this.col}/${encodeURIComponent(id)}`);
      } catch (e) {
        if ((e as AuthError).auth) return undefined;
        if ((e as Error & { status?: number }).status === 404) return undefined;
        throw e;
      }
    }

    create(item: T): Promise<T> {
      return call<T>('POST', `/${this.col}`, item);
    }

    update(id: string, patch: Partial<T>): Promise<T> {
      return call<T>('PATCH', `/${this.col}/${encodeURIComponent(id)}`, patch);
    }

    async remove(id: string): Promise<void> {
      await call('DELETE', `/${this.col}/${encodeURIComponent(id)}`);
    }

    async saveAll(items: T[]): Promise<void> {
      await call('PUT', `/${this.col}`, items);
    }
  }

  return {
    remote: true,
    realtimePath: `${base}/realtime`,
    getToken() {
      return store.get(TOKEN_KEY);
    },
    users: new RestRepo('users'),
    units: new RestRepo('units'),
    rooms: new RestRepo('rooms'),
    meetings: new RestRepo('meetings'),
    documents: new RestRepo('documents'),
    annotations: new RestRepo('annotations'),
    votes: new RestRepo('votes'),
    speakRequests: new RestRepo('speakRequests'),
    questions: new RestRepo('questions'),
    messages: new RestRepo('messages'),
    tasks: new RestRepo('tasks'),
    notifications: new RestRepo('notifications'),
    audit: new RestRepo('audit'),
    catalogs: new RestRepo('catalogs'), // ĐỢT 3: danh mục chung
    guides: new RestRepo('guides'),     // ĐỢT 3: tài liệu HDSD

    async reset() {
      await call('POST', '/admin/reset', {});
    },

    /** GĐ4: gọi endpoint nghiệp vụ /api/actions/... — server kiểm tra sâu */
    action(path: string, body?: unknown) {
      return call('POST', `/actions${path}`, body ?? {});
    },

    /** Họp trực tuyến WebRTC: server có bật LiveKit không */
    rtcConfig() {
      return call<{ enabled: boolean }>('GET', '/rtc/config');
    },

    /** Họp trực tuyến WebRTC: xin access token + URL LiveKit cho phiên họp */
    rtcToken(meetingId: string) {
      return call<{ url: string; token: string; room?: string; identity?: string }>('POST', '/rtc/token', { meetingId });
    },

    getSession() {
      return store.get(UID_KEY);
    },

    setSession(userId) {
      if (userId) {
        store.set(UID_KEY, userId);
      } else {
        // đăng xuất: thu hồi refresh token phía server (fire-and-forget)
        const rt = store.get(REFRESH_KEY);
        if (rt) {
          fetch(`${base}/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: rt }),
          }).catch(() => { /* offline cũng không sao */ });
        }
        clearSession();
      }
    },

    /** Đăng nhập phía máy chủ: nhận JWT + hồ sơ người dùng (mật khẩu không rời server) */
    async login(username: string, password: string): Promise<User> {
      const res = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { token?: string; refreshToken?: string; user?: User; error?: string };
      if (!res.ok || !data.token || !data.user) {
        throw new Error(data.error ?? 'Đăng nhập thất bại');
      }
      store.set(TOKEN_KEY, data.token);
      if (data.refreshToken) store.set(REFRESH_KEY, data.refreshToken); // GĐ4
      store.set(UID_KEY, data.user.id);
      return data.user;
    },
  };
}
