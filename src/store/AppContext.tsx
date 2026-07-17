// ============================================================
// STORE — Context toàn cục: người dùng hiện tại + snapshot dữ liệu.
// Mọi mutation gọi service xong thì gọi refresh() để cập nhật UI.
// ============================================================
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../data/db';
import { realtime } from '../data/realtime';
import type { Snapshot, User } from '../domain/types';
import * as authService from '../services/authService';

export interface Toast { id: number; msg: string; type: 'success' | 'error' | 'info' }

interface AppCtxType {
  user: User | null;
  s: Snapshot;
  ready: boolean;
  /** Kênh realtime WebSocket đang kết nối (chỉ có ý nghĩa ở chế độ máy chủ) */
  rt: boolean;
  login(username: string, password: string): Promise<void>;
  logout(): void;
  refresh(): Promise<void>;
  toast(msg: string, type?: Toast['type']): void;
  toasts: Toast[];
}

const emptySnapshot: Snapshot = {
  users: [], units: [], rooms: [], meetings: [], documents: [], annotations: [],
  votes: [], speakRequests: [], questions: [], messages: [], tasks: [], notifications: [], audit: [],
  catalogs: [], guides: [], // ĐỢT 3
  apiKeys: [],             // RỔ B
  feedbacks: [],           // Phản hồi/góp ý người dùng
};

const Ctx = createContext<AppCtxType>(null as unknown as AppCtxType);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [s, setS] = useState<Snapshot>(emptySnapshot);
  const [ready, setReady] = useState(false);
  const [rt, setRt] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const tid = useRef(1);

  const refresh = useCallback(async () => {
    const [users, units, rooms, meetings, documents, annotations, votes, speakRequests, questions, messages, tasks, notifications, audit, catalogs, guides, apiKeys, feedbacks] =
      await Promise.all([
        db.users.list(), db.units.list(), db.rooms.list(), db.meetings.list(),
        db.documents.list(), db.annotations.list(), db.votes.list(), db.speakRequests.list(),
        db.questions.list(), db.messages.list(), db.tasks.list(), db.notifications.list(), db.audit.list(),
        db.catalogs.list(), db.guides.list(), // ĐỢT 3
        db.apiKeys.list(),                    // RỔ B
        db.feedbacks.list(),                  // Phản hồi/góp ý người dùng
      ]);
    setS({ users, units, rooms, meetings, documents, annotations, votes, speakRequests, questions, messages, tasks, notifications, audit, catalogs, guides, apiKeys, feedbacks });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const u = await authService.currentUser();
        setUser(u);
        await refresh();
      } catch (e) {
        console.error('[eCabinet] Không nạp được dữ liệu ban đầu:', e);
      } finally {
        setReady(true);
      }
    })();
  }, [refresh]);

  // GĐ3: kênh realtime — kết nối khi đã đăng nhập ở chế độ máy chủ;
  // sự kiện đến thì refresh (gộp nhịp 250ms tránh dồn dập).
  useEffect(() => {
    if (!db.remote || !user || !db.realtimePath || !db.getToken) return;
    realtime.connect(db.realtimePath, () => db.getToken?.() ?? null);
    let pending: number | null = null;
    const offEvents = realtime.on((e) => {
      if (e.type !== 'change' || pending !== null) return;
      pending = window.setTimeout(async () => {
        pending = null;
        try { await refresh(); } catch { /* mạng chập chờn — lần sau */ }
      }, 250);
    });
    const offStatus = realtime.onStatus(setRt);
    setRt(realtime.connected);
    return () => {
      offEvents();
      offStatus();
      if (pending !== null) window.clearTimeout(pending);
      realtime.disconnect();
      setRt(false);
    };
  }, [user, refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const u = await authService.login(username, password);
    setUser(u);
    await refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  const toast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = tid.current++;
    setToasts((t) => [...t, { id, msg, type }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const value = useMemo(
    () => ({ user, s, ready, rt, login, logout, refresh, toast, toasts }),
    [user, s, ready, rt, login, logout, refresh, toast, toasts],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
