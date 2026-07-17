// ============================================================
// REALTIME CLIENT (GĐ3) — nhận sự kiện WebSocket từ server.
// Mô hình poke-then-pull: server chỉ báo "bộ dữ liệu X vừa đổi",
// app gọi refresh() qua REST có phân quyền.
// Tự kết nối lại lũy tiến khi rớt; phát trạng thái cho UI hiển thị.
// ============================================================

export interface RealtimeEvent {
  type: string; // 'change' | 'hello'
  collection?: string;
  action?: string;
  id?: string;
  at?: string;
}

type EventListener = (e: RealtimeEvent) => void;
type StatusListener = (connected: boolean) => void;

class RealtimeClient {
  connected = false;

  private ws: WebSocket | null = null;
  private listeners = new Set<EventListener>();
  private statusListeners = new Set<StatusListener>();
  private path: string | null = null;
  /** GĐ4: lấy token ĐỘNG mỗi lần mở kết nối — sau khi refresh xoay vòng vẫn đúng */
  private tokenSource: (() => string | null) | null = null;
  private retry = 0;
  private timer: number | null = null;
  private manualClose = false;

  /** Kết nối (tokenSource được gọi lại ở mỗi lần mở/kết nối lại) */
  connect(path: string, tokenSource: () => string | null) {
    this.path = path;
    this.tokenSource = tokenSource;
    this.manualClose = false;
    this.retry = 0;
    this.open();
  }

  disconnect() {
    this.manualClose = true;
    if (this.timer) { window.clearTimeout(this.timer); this.timer = null; }
    try { this.ws?.close(); } catch { /* ignore */ }
    this.ws = null;
    this.setConnected(false);
  }

  on(l: EventListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  onStatus(l: StatusListener): () => void {
    this.statusListeners.add(l);
    return () => this.statusListeners.delete(l);
  }

  private open() {
    const token = this.tokenSource?.() ?? null;
    if (!this.path || !token || typeof WebSocket === 'undefined') return;
    try { this.ws?.close(); } catch { /* ignore */ }

    // this.path có thể ở 3 dạng (do apiBase.wsUrl() / restAdapter dựng):
    //  - "ws(s)://host/api/realtime" : app native, base tuyệt đối -> DÙNG NGUYÊN
    //  - "http(s)://host/api/realtime": tuyệt đối scheme http -> đổi sang ws(s)
    //  - "/api/realtime"              : web cùng origin -> ghép location.origin (hành vi cũ)
    let abs: string;
    if (/^wss?:\/\//i.test(this.path)) {
      abs = this.path;                                   // đã là ws/wss tuyệt đối
    } else if (/^https?:\/\//i.test(this.path)) {
      abs = this.path.replace(/^http/i, 'ws');           // http(s) tuyệt đối -> ws(s)
    } else {
      abs = (location.origin + this.path).replace(/^http/i, 'ws'); // tương đối -> suy từ location
    }
    const wsUrl = abs + '?token=' + encodeURIComponent(token);

    let ws: WebSocket;
    try { ws = new WebSocket(wsUrl); } catch { this.scheduleReconnect(); return; }
    this.ws = ws;

    ws.onopen = () => {
      this.retry = 0;
      this.setConnected(true);
    };
    ws.onmessage = (ev) => {
      try {
        const e = JSON.parse(String(ev.data)) as RealtimeEvent;
        this.listeners.forEach((l) => l(e));
      } catch { /* bỏ qua khung không hợp lệ */ }
    };
    ws.onclose = () => {
      this.setConnected(false);
      if (!this.manualClose) this.scheduleReconnect();
    };
    ws.onerror = () => { /* onclose sẽ xử lý */ };
  }

  private scheduleReconnect() {
    if (this.timer || this.manualClose) return;
    const delay = Math.min(15000, 1500 * Math.pow(1.7, this.retry++));
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.open();
    }, delay);
  }

  private setConnected(v: boolean) {
    if (this.connected === v) return;
    this.connected = v;
    this.statusListeners.forEach((l) => l(v));
  }
}

export const realtime = new RealtimeClient();
