// ============================================================
// REDIS BACKPLANE — client RESP tối giản TỰ VIẾT (GIAI ĐOẠN "scale ngang").
//
// MỤC ĐÍCH: chạy được App×2 sau cân bằng tải (mô hình 4 cụm HSMT) bằng cách đồng
// bộ 2 thứ đang là state per-process:
//   (1) WebSocket realtime broadcast  -> Redis Pub/Sub (kênh `ecabinet:changes`)
//   (2) rate-limit theo IP            -> Redis INCR + PEXPIRE (đếm CHUNG toàn cụm)
//
// TRIẾT LÝ (giống blob.js/rtc.js/ws.js): KHÔNG thêm dependency npm. Nói giao thức
// RESP (REdis Serialization Protocol) TRỰC TIẾP qua `node:net` (TCP socket).
//
// GATED — TƯƠNG THÍCH NGƯỢC TUYỆT ĐỐI:
//   - KHÔNG đặt REDIS_URL -> configured()=false -> KHÔNG mở kết nối nào; ws.js phát
//     local trong RAM và ratelimit.js đếm bằng Map như cũ. Demo/dev/test cũ KHÔNG đổi.
//   - Đặt REDIS_URL=redis://[:password@]host:port[/db] -> bật backplane.
//
// FALLBACK AN TOÀN (bắt buộc): Redis đang bật mà mất kết nối ->
//   (a) WS tự quay về fanout local-only + tự kết nối lại lũy tiến (backoff);
//   (b) rate-limit fail-open (cho qua, KHÔNG chặn toàn hệ) + log cảnh báo.
//   Không để lỗi Redis làm sập request nghiệp vụ. Ping keepalive định kỳ.
//
// TEST: không chạy được Redis thật trong sandbox (chặn socket) -> lớp giao thức
// RESP (encode/parse) là HÀM THUẦN test-vector; backplane/rate-limit test bằng
// fake Redis in-process injectable (makeFakeRedis). Kiểm chứng thật: xem README /
// docs/HUONG-DAN-TRIEN-KHAI-VA-HSMT.md mục A3.2.
// ============================================================
import net from 'node:net';
import tls from 'node:tls';

// ============================================================
// PHẦN 1 — RESP encode/parse: HÀM THUẦN (không I/O, test-vector byte).
// RESP v2: Simple String "+OK\r\n" · Error "-ERR ...\r\n" · Integer ":10\r\n"
//          Bulk String "$3\r\nfoo\r\n" (hoặc "$-1\r\n" = null) · Array "*2\r\n...".
// ============================================================
const CRLF = '\r\n';

/**
 * Mã hóa 1 lệnh Redis theo RESP làm MẢNG các Bulk String (dạng lệnh chuẩn mọi
 * server Redis chấp nhận). vd encodeCommand(['PUBLISH','ch','msg']).
 * Trả về Buffer sẵn sàng ghi xuống socket.
 */
export function encodeCommand(args) {
  const parts = [`*${args.length}${CRLF}`];
  for (const a of args) {
    const s = Buffer.isBuffer(a) ? a : Buffer.from(String(a), 'utf8');
    parts.push(`$${s.length}${CRLF}`);
    parts.push(s);
    parts.push(CRLF);
  }
  // ghép: các phần chuỗi + Buffer -> 1 Buffer
  const bufs = parts.map((p) => (Buffer.isBuffer(p) ? p : Buffer.from(p, 'utf8')));
  return Buffer.concat(bufs);
}

/**
 * Phân tích MỘT reply RESP từ đầu buffer. Trả { value, rest } khi đủ 1 reply,
 * hoặc null nếu chưa đủ byte (cần chờ thêm dữ liệu từ socket).
 *
 * Kiểu trả:
 *   +Simple  -> string
 *   -Error   -> { error: '<message>' }  (KHÔNG throw ở tầng parse — để tầng trên quyết)
 *   :Integer -> number
 *   $Bulk    -> string | null
 *   *Array   -> Array<...> | null
 */
export function parseReply(buf) {
  if (buf.length < 1) return null;
  const type = String.fromCharCode(buf[0]);
  const nl = indexOfCRLF(buf, 1);
  if (nl === -1) return null; // chưa đủ dòng đầu
  const line = buf.toString('utf8', 1, nl);
  const afterLine = nl + 2;

  switch (type) {
    case '+':
      return { value: line, rest: buf.subarray(afterLine) };
    case '-':
      return { value: { error: line }, rest: buf.subarray(afterLine) };
    case ':':
      return { value: Number(line), rest: buf.subarray(afterLine) };
    case '$': {
      const len = Number(line);
      if (len === -1) return { value: null, rest: buf.subarray(afterLine) };
      const end = afterLine + len;
      if (buf.length < end + 2) return null; // chưa đủ payload + CRLF
      const value = buf.toString('utf8', afterLine, end);
      return { value, rest: buf.subarray(end + 2) };
    }
    case '*': {
      const count = Number(line);
      if (count === -1) return { value: null, rest: buf.subarray(afterLine) };
      const arr = [];
      let rest = buf.subarray(afterLine);
      for (let i = 0; i < count; i++) {
        const item = parseReply(rest);
        if (item === null) return null; // chưa đủ cho phần tử -> chờ thêm
        arr.push(item.value);
        rest = item.rest;
      }
      return { value: arr, rest };
    }
    default:
      // Giao thức lạ (RESP3?) — coi như lỗi để tầng trên bỏ qua/đóng kết nối.
      return { value: { error: `RESP không nhận dạng: ${type}` }, rest: buf.subarray(afterLine) };
  }
}

/** Tìm vị trí '\r\n' bắt đầu từ `from`. -1 nếu chưa có. */
function indexOfCRLF(buf, from) {
  for (let i = from; i < buf.length - 1; i++) {
    if (buf[i] === 0x0d && buf[i + 1] === 0x0a) return i;
  }
  return -1;
}

// ============================================================
// PHẦN 2 — Phân tích REDIS_URL: redis://[:password@]host:port[/db]  (+ rediss:// TLS)
// ============================================================
/** @returns {null | {host,port,password,db,tls}} — null nếu không đặt/không hợp lệ. */
export function parseRedisUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  const proto = u.protocol.replace(':', '');
  if (proto !== 'redis' && proto !== 'rediss') return null;
  const db = u.pathname && u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0;
  return {
    host: u.hostname || '127.0.0.1',
    port: Number(u.port || 6379),
    // password: hỗ trợ cả dạng :pass@ (chỉ password) lẫn user:pass@ (Redis 6 ACL — dùng phần password)
    password: u.password ? decodeURIComponent(u.password) : (u.username && !u.password ? decodeURIComponent(u.username) : ''),
    username: u.password && u.username ? decodeURIComponent(u.username) : '',
    db: Number.isFinite(db) ? db : 0,
    tls: proto === 'rediss',
  };
}

/** Redis đã cấu hình (có REDIS_URL hợp lệ)? — gate mọi nhánh backplane. */
export function redisConfigured() {
  return parseRedisUrl(process.env.REDIS_URL) !== null;
}

// ============================================================
// PHẦN 3 — KẾT NỐI RESP đơn (1 socket). Xử lý AUTH/SELECT lúc handshake, gửi lệnh
// và ghép reply theo FIFO (Redis trả reply đúng thứ tự lệnh gửi). Chế độ SUBSCRIBE:
// sau khi subscribe, mọi message đẩy về onPush thay vì hàng chờ reply.
// ============================================================
class RespConnection {
  /**
   * @param {object} cfg  từ parseRedisUrl
   * @param {object} opts { onPush?(arr), onClose?(err), label?, connect?, ping? }
   *   connect: hàm tạo socket (bơm được cho test). Mặc định net/tls thật.
   */
  constructor(cfg, opts = {}) {
    this.cfg = cfg;
    this.opts = opts;
    this.label = opts.label || 'redis';
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.waiters = [];   // hàng chờ reply cho lệnh thường (FIFO)
    this.subscribed = false;
    this.ready = false;
    this.closed = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (err) => { if (!settled) { settled = true; err ? reject(err) : resolve(this); } };
      try {
        const factory = this.opts.connect;
        if (factory) {
          this.socket = factory(this.cfg);
        } else if (this.cfg.tls) {
          this.socket = tls.connect({ host: this.cfg.host, port: this.cfg.port, servername: this.cfg.host });
        } else {
          this.socket = net.connect({ host: this.cfg.host, port: this.cfg.port });
        }
        // Gắn NGƯỢC con trỏ để fake Redis nhận diện được kết nối (đẩy push, dọn subscribe).
        // Với socket thật của net/tls, gán field phụ này vô hại.
        this.socket._conn = this;
      } catch (e) { return done(e); }

      const onConnected = async () => {
        try {
          this.socket.setNoDelay?.(true);
          // handshake: AUTH (nếu có password) rồi SELECT db (nếu != 0)
          if (this.cfg.password) {
            const authArgs = this.cfg.username
              ? ['AUTH', this.cfg.username, this.cfg.password]
              : ['AUTH', this.cfg.password];
            const r = await this.command(authArgs);
            if (r && r.error) throw new Error(`AUTH thất bại: ${r.error}`);
          }
          if (this.cfg.db && this.cfg.db > 0) {
            const r = await this.command(['SELECT', String(this.cfg.db)]);
            if (r && r.error) throw new Error(`SELECT ${this.cfg.db} thất bại: ${r.error}`);
          }
          this.ready = true;
          done();
        } catch (e) { this.destroy(e); done(e); }
      };

      // net.Socket phát 'connect'; tls.TLSSocket phát 'secureConnect'; fake tự gọi.
      this.socket.on('connect', () => { if (!this.cfg.tls) onConnected(); });
      this.socket.on('secureConnect', () => { if (this.cfg.tls) onConnected(); });
      this.socket.on('data', (chunk) => this._onData(chunk));
      this.socket.on('error', (err) => this.destroy(err));
      this.socket.on('close', () => this.destroy(new Error('kết nối Redis đóng')));
    });
  }

  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const parsed = parseReply(this.buffer);
      if (parsed === null) break; // chưa đủ 1 reply
      this.buffer = Buffer.isBuffer(parsed.rest) ? parsed.rest : Buffer.from(parsed.rest);
      this._dispatch(parsed.value);
    }
  }

  _dispatch(value) {
    // Trong chế độ subscribe: reply mảng dạng ['message', channel, payload] / ['subscribe',...]
    // được đẩy về onPush. Nhưng lệnh SUBSCRIBE cũng nhận 1 xác nhận -> vẫn trả cho waiter đầu tiên.
    if (this.subscribed && Array.isArray(value) && value[0] === 'message') {
      this.opts.onPush?.(value);
      return;
    }
    const waiter = this.waiters.shift();
    if (waiter) waiter(value);
    else if (Array.isArray(value)) this.opts.onPush?.(value); // push ngoài dự kiến
  }

  /** Gửi 1 lệnh, chờ đúng 1 reply (FIFO). Trả value (string/number/array/{error}). */
  command(args) {
    return new Promise((resolve, reject) => {
      if (this.closed) return reject(new Error('kết nối đã đóng'));
      this.waiters.push(resolve);
      try {
        this.socket.write(encodeCommand(args));
      } catch (e) {
        // rút waiter vừa đẩy
        const i = this.waiters.indexOf(resolve);
        if (i >= 0) this.waiters.splice(i, 1);
        reject(e);
      }
    });
  }

  /** Bật chế độ subscribe cho 1 channel (message sau đó đẩy về onPush). */
  async subscribe(channel) {
    this.subscribed = true;
    const r = await this.command(['SUBSCRIBE', channel]);
    if (r && r.error) throw new Error(`SUBSCRIBE ${channel} thất bại: ${r.error}`);
    return r;
  }

  destroy(err) {
    if (this.closed) return;
    this.closed = true;
    this.ready = false;
    // giải phóng mọi waiter đang chờ (fail-safe: không treo Promise)
    const waiters = this.waiters.splice(0);
    for (const w of waiters) { try { w({ error: 'kết nối Redis mất' }); } catch { /* ignore */ } }
    try { this.socket?.destroy?.(); } catch { /* ignore */ }
    this.opts.onClose?.(err);
  }
}

// ============================================================
// PHẦN 4 — REDIS BACKPLANE: 2 kết nối (1 blocking SUBSCRIBE, 1 cho PUBLISH + lệnh
// rate-limit) + tự kết nối lại lũy tiến + ping keepalive + fanout callback.
// ============================================================
const CHANGES_CHANNEL = 'ecabinet:changes';
const PING_MS = Number(process.env.REDIS_PING_MS ?? 30000);
const RECONNECT_MAX_MS = 15000;

export class RedisBackplane {
  /**
   * @param {object} opts
   *   onMessage(event): nhận sự kiện change từ SUBSCRIBE -> fanout tới WS local.
   *   connect: factory socket (test bơm fake). now(): giờ (test).
   *   log: hàm log (mặc định console.warn/log).
   */
  constructor(opts = {}) {
    this.cfg = opts.cfg ?? parseRedisUrl(process.env.REDIS_URL);
    this.opts = opts;
    this.onMessage = opts.onMessage ?? (() => {});
    this.log = opts.log ?? ((lvl, ...a) => (lvl === 'warn' ? console.warn(...a) : console.log(...a)));
    this.pub = null;   // kết nối lệnh (PUBLISH/INCR/PEXPIRE/PING)
    this.sub = null;   // kết nối blocking SUBSCRIBE
    this.up = false;   // cả 2 kết nối sẵn sàng?
    this.retry = 0;
    this.stopped = false;
    this._reconnectTimer = null;
    this._pingTimer = null;
  }

  configured() { return this.cfg !== null; }

  /** Khởi động backplane: mở 2 kết nối + subscribe + ping. An toàn gọi 1 lần lúc boot. */
  async start() {
    if (!this.configured() || this.stopped) return;
    await this._openBoth();
  }

  async _openBoth() {
    if (this.stopped) return;
    try {
      const factory = this.opts.connect;
      this.pub = new RespConnection(this.cfg, { connect: factory, label: 'redis-pub',
        onClose: () => this._onDrop('pub') });
      this.sub = new RespConnection(this.cfg, { connect: factory, label: 'redis-sub',
        onClose: () => this._onDrop('sub'),
        onPush: (arr) => this._onPush(arr) });
      await this.pub.connect();
      await this.sub.connect();
      await this.sub.subscribe(CHANGES_CHANNEL);
      this.up = true;
      this.retry = 0;
      this.log('log', `[redis] backplane BẬT — pub/sub ${this.cfg.host}:${this.cfg.port} db=${this.cfg.db} kênh=${CHANGES_CHANNEL}`);
      this._startPing();
    } catch (e) {
      this.up = false;
      this.log('warn', `[redis] không kết nối được (${e?.message ?? e}) — WS về fanout LOCAL, rate-limit fail-open; sẽ thử lại`);
      this._scheduleReconnect();
    }
  }

  /** Message từ kênh: ['message', channel, payloadJson] -> parse -> onMessage(event). */
  _onPush(arr) {
    if (!Array.isArray(arr) || arr[0] !== 'message') return;
    const payload = arr[2];
    try {
      const event = JSON.parse(payload);
      this.onMessage(event); // fanout tới WS local đúng 1 lần cho client của instance này
    } catch { /* payload lạ — bỏ qua */ }
  }

  _onDrop(which) {
    if (this.stopped) return;
    if (this.up) this.log('warn', `[redis] mất kết nối (${which}) — CHUYỂN fanout LOCAL-only + rate-limit fail-open; tự kết nối lại`);
    this.up = false;
    this._stopPing();
    try { this.pub?.destroy?.(); } catch { /* ignore */ }
    try { this.sub?.destroy?.(); } catch { /* ignore */ }
    this._scheduleReconnect();
  }

  _scheduleReconnect() {
    if (this.stopped || this._reconnectTimer) return;
    // backoff lũy tiến giống client WS FE: min(15s, 1500 * 1.7^retry)
    const delay = Math.min(RECONNECT_MAX_MS, 1500 * Math.pow(1.7, this.retry++));
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._openBoth();
    }, delay);
    this._reconnectTimer.unref?.();
  }

  _startPing() {
    this._stopPing();
    this._pingTimer = setInterval(async () => {
      if (!this.up || !this.pub) return;
      try {
        const r = await this.pub.command(['PING']);
        if (r && r.error) throw new Error(r.error);
      } catch (e) {
        this.log('warn', `[redis] PING lỗi (${e?.message ?? e}) — coi như mất kết nối`);
        this._onDrop('ping');
      }
    }, PING_MS);
    this._pingTimer.unref?.();
  }

  _stopPing() { if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null; } }

  /**
   * PHÁT sự kiện change: khi backplane BẬT -> chỉ PUBLISH (KHÔNG gửi local trực tiếp);
   * handler onPush của SUBSCRIBE sẽ nhận lại và fanout local ĐÚNG 1 LẦN (chống double-send).
   * @returns {boolean} true nếu đã publish (caller KHÔNG broadcast local); false nếu Redis
   *   không sẵn sàng (caller tự broadcast local — fallback).
   */
  async publishChange(event) {
    if (!this.up || !this.pub) return false; // fallback: caller lo local
    try {
      const r = await this.pub.command(['PUBLISH', CHANGES_CHANNEL, JSON.stringify(event)]);
      if (r && r.error) throw new Error(r.error);
      return true;
    } catch (e) {
      this.log('warn', `[redis] PUBLISH lỗi (${e?.message ?? e}) — fallback fanout LOCAL`);
      this._onDrop('publish');
      return false;
    }
  }

  /**
   * RATE-LIMIT dùng chung: INCR key; nếu là lần đầu (==1) đặt PEXPIRE window.
   * Atomic đủ dùng (INCR nguyên tử; cửa sổ cố định theo key). Trả cùng shape hit().
   * @returns {null | {ok, remaining, retryAfterSec}} — null nếu Redis không sẵn sàng
   *   (caller fail-open hoặc dùng Map như cũ).
   */
  async rateHit(key, max, windowMs) {
    if (!this.up || !this.pub) return null;
    try {
      const n = await this.pub.command(['INCR', key]);
      if (n && n.error) throw new Error(n.error);
      const count = Number(n);
      let ttlMs = windowMs;
      if (count === 1) {
        const px = await this.pub.command(['PEXPIRE', key, String(windowMs)]);
        if (px && px.error) throw new Error(px.error);
      } else {
        // lấy TTL còn lại cho retryAfter chính xác (best-effort; lỗi -> dùng window)
        const pttl = await this.pub.command(['PTTL', key]);
        const v = Number(pttl);
        if (Number.isFinite(v) && v > 0) ttlMs = v;
      }
      return {
        ok: count <= max,
        remaining: Math.max(0, max - count),
        retryAfterSec: Math.max(1, Math.ceil(ttlMs / 1000)),
      };
    } catch (e) {
      this.log('warn', `[redis] rate-limit INCR lỗi (${e?.message ?? e}) — FAIL-OPEN (cho qua)`);
      this._onDrop('ratelimit');
      return null;
    }
  }

  /** Dừng backplane (đóng kết nối, hủy timer). Dùng test/tắt máy. */
  stop() {
    this.stopped = true;
    this.up = false;
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
    this._stopPing();
    try { this.pub?.destroy?.(); } catch { /* ignore */ }
    try { this.sub?.destroy?.(); } catch { /* ignore */ }
  }
}

// ============================================================
// PHẦN 5 — SINGLETON tiện dùng trong index.js/ws.js. Tạo LƯỜI khi gọi initBackplane.
// ============================================================
/** @type {RedisBackplane|null} */
let _instance = null;

/** Backplane hiện hành (null nếu chưa init / không cấu hình). */
export function backplane() { return _instance; }

/**
 * Khởi tạo backplane 1 lần lúc boot (gọi từ index.js). onMessage: fanout tới WS local.
 * KHÔNG cấu hình REDIS_URL -> trả null (không mở kết nối) — tương thích ngược.
 */
export async function initBackplane(onMessage) {
  if (!redisConfigured()) { _instance = null; return null; }
  _instance = new RedisBackplane({ onMessage });
  await _instance.start();
  return _instance;
}

// ============================================================
// PHẦN 6 — FAKE REDIS in-process cho TEST (giả pub/sub + INCR/PEXPIRE/PTTL/PING).
// Trả về { makeConnect(), publishExternal(), state } để mô phỏng NHIỀU instance
// nối CÙNG 1 "server" giả (chia sẻ pub/sub + keyspace) mà KHÔNG cần socket thật.
// ============================================================
import { EventEmitter } from 'node:events';

/**
 * Tạo 1 "server Redis giả" dùng chung cho nhiều RespConnection giả.
 * @returns {{ connect, keyspace, bus, subscribers, calls }}
 *   connect(cfg): factory socket giả (truyền vào RedisBackplane opts.connect).
 */
export function makeFakeRedis(options = {}) {
  const keyspace = new Map();      // key -> { value:number, expireAt:number|null }
  const expiry = new Map();        // key -> setTimeout id (mô phỏng PEXPIRE)
  const bus = new EventEmitter();  // kênh -> phát message tới mọi subscriber
  bus.setMaxListeners(0);
  const calls = [];                // nhật ký lệnh (assert trong test)
  const now = options.now ?? (() => Date.now());
  const failOn = options.failOn ?? null; // vd 'PUBLISH' để mô phỏng lỗi

  function runCommand(args, conn) {
    const cmd = String(args[0]).toUpperCase();
    calls.push(args.map(String));
    if (failOn && cmd === failOn) return { error: `giả lập lỗi ${cmd}` };
    switch (cmd) {
      case 'AUTH': return 'OK';
      case 'SELECT': return 'OK';
      case 'PING': return 'PONG';
      case 'PUBLISH': {
        const [, channel, payload] = args;
        // phát bất đồng bộ tới mọi subscriber (giống Redis: sub connection nhận 'message')
        queueMicrotask(() => bus.emit(String(channel), payload));
        return bus.listenerCount(String(channel)); // số client nhận
      }
      case 'SUBSCRIBE': {
        const channel = String(args[1]);
        // đẩy 'message' vào đúng đường parse của RespConnection (như thể đến từ 'data')
        const handler = (payload) => { if (!conn.closed) conn._dispatch(['message', channel, payload]); };
        bus.on(channel, handler);
        conn._subHandlers = conn._subHandlers || [];
        conn._subHandlers.push({ channel, handler });
        return ['subscribe', channel, 1];
      }
      case 'INCR': {
        const key = String(args[1]);
        const e = keyspace.get(key);
        const alive = e && (e.expireAt === null || e.expireAt > now());
        const value = (alive ? e.value : 0) + 1;
        keyspace.set(key, { value, expireAt: alive ? e.expireAt : null });
        return value;
      }
      case 'PEXPIRE': {
        const key = String(args[1]);
        const ms = Number(args[2]);
        const e = keyspace.get(key);
        if (!e) return 0;
        e.expireAt = now() + ms;
        keyspace.set(key, e);
        return 1;
      }
      case 'PTTL': {
        const key = String(args[1]);
        const e = keyspace.get(key);
        if (!e) return -2;
        if (e.expireAt === null) return -1;
        return Math.max(0, e.expireAt - now());
      }
      default:
        return { error: `lệnh giả chưa hỗ trợ: ${cmd}` };
    }
  }

  /** Factory socket giả — trả 1 EventEmitter đóng vai net.Socket cho RespConnection. */
  function connect(_cfg) {
    const sock = new EventEmitter();
    sock.setNoDelay = () => {};
    sock.destroyed = false;
    sock._conn = null; // RespConnection sẽ tự gắn qua monkey-patch bên dưới
    sock.write = (buf) => {
      // Giải mã lệnh RESP mà RespConnection vừa ghi, chạy trên server giả, trả reply.
      const args = decodeCommandForFake(buf);
      if (!args) return true;
      const conn = sock._conn;
      const reply = runCommand(args, conn);
      // trả reply bất đồng bộ (giống mạng) — RespConnection nhận qua 'data'
      queueMicrotask(() => {
        if (sock.destroyed) return;
        sock.emit('data', encodeReplyForFake(reply));
      });
      return true;
    };
    sock.destroy = () => {
      if (sock.destroyed) return;
      sock.destroyed = true;
      // gỡ mọi subscribe handler của kết nối này khỏi bus
      const hs = sock._conn?._subHandlers ?? [];
      for (const { channel, handler } of hs) bus.off(channel, handler);
      queueMicrotask(() => sock.emit('close'));
    };
    // mở kết nối ngay ở microtask kế (giống net.connect phát 'connect')
    queueMicrotask(() => { if (!sock.destroyed) sock.emit('connect'); });
    return sock;
  }

  return { connect, keyspace, bus, calls, runCommand };
}

/** Giải mã Buffer lệnh RESP (mảng bulk string) -> ['CMD', ...args]. Chỉ dùng trong fake. */
export function decodeCommandForFake(buf) {
  const parsed = parseReply(buf);
  if (!parsed) return null;
  const v = parsed.value;
  if (Array.isArray(v)) return v.map(String);
  return null;
}

/** Mã hóa 1 reply JS -> Buffer RESP. Chỉ dùng trong fake (đối xứng parseReply). */
export function encodeReplyForFake(reply) {
  if (reply === null || reply === undefined) return Buffer.from('$-1\r\n');
  if (typeof reply === 'number') return Buffer.from(`:${reply}\r\n`);
  if (typeof reply === 'string') return Buffer.from(`+${reply}\r\n`);
  if (Array.isArray(reply)) {
    const parts = [Buffer.from(`*${reply.length}\r\n`)];
    for (const item of reply) parts.push(encodeReplyForFake(item));
    return Buffer.concat(parts);
  }
  if (reply && reply.error) return Buffer.from(`-${reply.error}\r\n`);
  return Buffer.from('$-1\r\n');
}
