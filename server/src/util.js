// ============================================================
// Tiện ích HTTP — gửi JSON, CORS, đọc body an toàn
// ============================================================

const corsHeaders = () => ({
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN ?? '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'Access-Control-Max-Age': '86400',
});

export function send(res, status, obj) {
  if (res.writableEnded) return;
  if (status === 204) {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }
  const body = JSON.stringify(obj ?? {});
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...corsHeaders(),
  });
  res.end(body);
}

/** Đọc body JSON với giới hạn kích thước (mặc định 25MB — đủ cho tài liệu base64) */
export function readBody(req, limitBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) {
        reject(Object.assign(new Error('Dữ liệu gửi lên quá lớn (giới hạn 25MB)'), { status: 413 }));
        req.destroy();
      } else {
        chunks.push(c);
      }
    });
    req.on('end', () => {
      if (!chunks.length) return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('JSON không hợp lệ'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}
