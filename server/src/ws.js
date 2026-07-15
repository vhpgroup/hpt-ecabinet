// ============================================================
// REALTIME — WebSocket server thuần theo RFC 6455 (GIAI ĐOẠN 3)
// Không phụ thuộc thư viện ngoài, nhất quán với kiến trúc backend.
//
// - Bắt tay: Sec-WebSocket-Accept = base64(SHA1(key + GUID))
// - Xác thực: JWT qua query ?token=... tại thời điểm nâng cấp
// - Server đẩy sự kiện dạng "poke-then-pull": chỉ báo {collection,
//   action, id} — client tự refresh qua REST có phân quyền,
//   nên không rò rỉ dữ liệu qua kênh đẩy.
// - Ping/pong giữ kết nối qua proxy (mặc định 30s, env WS_PING_MS)
// ============================================================
import crypto from 'node:crypto';
import { verifyToken } from './auth.js';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const PING_MS = Number(process.env.WS_PING_MS ?? 30000);

/** @type {Set<{socket: import('node:net').Socket, alive: boolean, user: object}>} */
const clients = new Set();

export const clientCount = () => clients.size;

/** Phát một sự kiện tới toàn bộ client đang kết nối */
export function broadcast(event) {
  if (!clients.size) return;
  const msg = Buffer.from(JSON.stringify(event), 'utf8');
  for (const c of clients) sendFrame(c.socket, 0x1, msg);
}

export function attachRealtime(server, path = '/api/realtime') {
  server.on('upgrade', (req, socket) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { socket.destroy(); return; }
    if (url.pathname !== path) { socket.destroy(); return; }

    // Xác thực JWT trước khi chấp nhận nâng cấp
    const payload = verifyToken(url.searchParams.get('token'));
    if (!payload) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const key = req.headers['sec-websocket-key'];
    if (!key || String(req.headers.upgrade ?? '').toLowerCase() !== 'websocket') {
      socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n` +
      '\r\n',
    );
    socket.setNoDelay(true);

    const client = { socket, alive: true, user: payload };
    clients.add(client);

    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        buffer = consumeFrames(buffer, client);
      } catch {
        cleanup();
      }
    });
    const cleanup = () => { clients.delete(client); try { socket.destroy(); } catch { /* ignore */ } };
    socket.on('close', cleanup);
    socket.on('error', cleanup);
    socket.on('end', cleanup);

    sendFrame(socket, 0x1, Buffer.from(JSON.stringify({ type: 'hello', name: payload.name, at: new Date().toISOString() }), 'utf8'));
  });

  // Heartbeat: ping định kỳ; client không trả pong 2 nhịp liền -> ngắt
  const timer = setInterval(() => {
    for (const c of clients) {
      if (!c.alive) {
        clients.delete(c);
        try { c.socket.destroy(); } catch { /* ignore */ }
        continue;
      }
      c.alive = false;
      sendFrame(c.socket, 0x9, Buffer.alloc(0)); // ping
    }
  }, PING_MS);
  timer.unref?.();
}

/** Phân tích các khung client gửi lên (đã mask theo RFC). Trả lại phần buffer chưa đủ khung. */
function consumeFrames(buffer, client) {
  for (;;) {
    if (buffer.length < 2) return buffer;
    const opcode = buffer[0] & 0x0f;
    const masked = (buffer[1] & 0x80) !== 0;
    let len = buffer[1] & 0x7f;
    let offset = 2;
    if (len === 126) {
      if (buffer.length < 4) return buffer;
      len = buffer.readUInt16BE(2);
      offset = 4;
    } else if (len === 127) {
      if (buffer.length < 10) return buffer;
      len = Number(buffer.readBigUInt64BE(2));
      offset = 10;
    }
    const maskLen = masked ? 4 : 0;
    if (buffer.length < offset + maskLen + len) return buffer;

    let payload = buffer.subarray(offset + maskLen, offset + maskLen + len);
    if (masked) {
      const mask = buffer.subarray(offset, offset + 4);
      payload = Buffer.from(payload);
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    }

    if (opcode === 0x8) { // close từ client -> đáp close, đóng
      sendFrame(client.socket, 0x8, Buffer.alloc(0));
      clients.delete(client);
      try { client.socket.destroy(); } catch { /* ignore */ }
      return Buffer.alloc(0);
    }
    if (opcode === 0x9) sendFrame(client.socket, 0xA, payload); // ping -> pong
    if (opcode === 0xA) client.alive = true; // pong
    // opcode 0x1/0x2 (client gửi dữ liệu): kênh này chỉ đẩy xuống — bỏ qua

    buffer = buffer.subarray(offset + maskLen + len);
  }
}

/** Gửi 1 khung từ server (không mask theo RFC) */
function sendFrame(socket, opcode, payload) {
  try {
    let header;
    if (payload.length < 126) {
      header = Buffer.from([0x80 | opcode, payload.length]);
    } else if (payload.length < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(payload.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(payload.length), 2);
    }
    socket.write(Buffer.concat([header, payload]));
  } catch { /* socket đã đóng */ }
}
