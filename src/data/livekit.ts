// ============================================================
// LIVEKIT LOADER — tải thư viện livekit-client UMD lúc CHẠY qua CDN.
//
// TẠI SAO không import tĩnh/động: scripts/build-cdn.mjs bundle offline từ
// node_modules (không có gói livekit-client) và esbuild sẽ cố resolve mọi
// `import`/`import('...')` lúc build -> vỡ build offline. Vì vậy ta chèn thẻ
// <script src="…umd…"> lúc chạy rồi đọc global window.LivekitClient.
//
// Loader: cache Promise (chỉ tải 1 lần), timeout, và báo lỗi tải sạch để
// OnlineMeetingPage bắt được và fallback về giao diện mô phỏng.
// ============================================================

// URL UMD ổn định trên jsDelivr (khóa major 2 để tương thích API Room/Track).
const LIVEKIT_CDN_URL = 'https://cdn.jsdelivr.net/npm/livekit-client@2/dist/livekit-client.umd.min.js';
const LOAD_TIMEOUT_MS = 15000;

// Kiểu tối giản cho phần API livekit-client mà ta dùng (tránh phụ thuộc @types).
export interface LivekitClientLib {
  Room: new (opts?: unknown) => LkRoom;
  RoomEvent: Record<string, string>;
  Track: { Source: Record<string, string>; Kind: Record<string, string> };
  [k: string]: unknown;
}

export interface LkTrack {
  kind: string;
  source?: string;
  sid?: string;
  attach(el?: HTMLMediaElement): HTMLMediaElement;
  detach(el?: HTMLMediaElement): HTMLMediaElement[];
  mediaStreamTrack?: MediaStreamTrack;
}

export interface LkPublication {
  trackSid?: string;
  source?: string;
  kind?: string;
  isSubscribed?: boolean;
  track?: LkTrack | null;
}

export interface LkParticipant {
  identity: string;
  name?: string;
  sid?: string;
  isLocal?: boolean;
  trackPublications?: Map<string, LkPublication>;
  getTrackPublications?(): LkPublication[];
}

export interface LkRoom {
  localParticipant: LkParticipant & {
    setCameraEnabled(enabled: boolean): Promise<unknown>;
    setMicrophoneEnabled(enabled: boolean): Promise<unknown>;
    setScreenShareEnabled(enabled: boolean): Promise<unknown>;
    isCameraEnabled?: boolean;
    isMicrophoneEnabled?: boolean;
    isScreenShareEnabled?: boolean;
  };
  remoteParticipants: Map<string, LkParticipant>;
  connect(url: string, token: string, opts?: unknown): Promise<unknown>;
  disconnect(stopTracks?: boolean): Promise<void> | void;
  on(event: string, cb: (...args: unknown[]) => void): LkRoom;
  off(event: string, cb: (...args: unknown[]) => void): LkRoom;
}

declare global {
  interface Window {
    LivekitClient?: LivekitClientLib;
    // một số bản UMD phơi bày dạng LiveKitClient / livekit
    LiveKitClient?: LivekitClientLib;
    livekit?: LivekitClientLib;
  }
}

let cached: Promise<LivekitClientLib> | null = null;

function readGlobal(): LivekitClientLib | null {
  if (typeof window === 'undefined') return null;
  return window.LivekitClient ?? window.LiveKitClient ?? window.livekit ?? null;
}

/**
 * Tải livekit-client (UMD) và trả global. Cache kết quả; nếu đã có sẵn thì
 * trả ngay. Ném Error khi hết thời gian chờ hoặc script lỗi.
 */
export function loadLivekit(): Promise<LivekitClientLib> {
  if (cached) return cached;

  const existing = readGlobal();
  if (existing) {
    cached = Promise.resolve(existing);
    return cached;
  }

  cached = new Promise<LivekitClientLib>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Không có môi trường trình duyệt để tải livekit-client'));
      return;
    }

    // Nếu thẻ đã tồn tại (lần trước đang tải dở), gắn thêm listener.
    let script = document.querySelector<HTMLScriptElement>('script[data-livekit-loader]');
    let timer: number | undefined;

    const cleanup = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      script?.removeEventListener('load', onLoad);
      script?.removeEventListener('error', onError);
    };
    const onLoad = () => {
      const lib = readGlobal();
      cleanup();
      if (lib) resolve(lib);
      else reject(new Error('Tải livekit-client xong nhưng không tìm thấy window.LivekitClient'));
    };
    const onError = () => {
      cleanup();
      cached = null; // cho phép thử lại lần sau
      reject(new Error('Không tải được livekit-client từ CDN (kiểm tra mạng/CSP)'));
    };

    timer = window.setTimeout(() => {
      cleanup();
      cached = null;
      reject(new Error('Hết thời gian chờ tải livekit-client từ CDN'));
    }, LOAD_TIMEOUT_MS);

    if (!script) {
      script = document.createElement('script');
      script.src = LIVEKIT_CDN_URL;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.setAttribute('data-livekit-loader', '1');
      script.addEventListener('load', onLoad);
      script.addEventListener('error', onError);
      document.head.appendChild(script);
    } else {
      script.addEventListener('load', onLoad);
      script.addEventListener('error', onError);
      // trường hợp script đã load xong trước khi ta gắn listener
      if (readGlobal()) onLoad();
    }
  });

  return cached;
}
