// ============================================================
// Router tối giản — không phụ thuộc framework ngoài.
// Cú pháp path kiểu '/api/:collection/:id'; handler dạng middleware
// chạy tuần tự, dừng khi response đã kết thúc.
// ============================================================
import { send } from './util.js';

export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, path, ...handlers) {
    const keys = [];
    const pattern = new RegExp(
      '^' + path.replace(/:[^/]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '/?$',
    );
    this.routes.push({ method, pattern, keys, handlers });
  }

  async handle(req, res) {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'OPTIONS') {
      send(res, 204);
      return;
    }

    for (const r of this.routes) {
      if (r.method !== req.method) continue;
      const m = r.pattern.exec(url.pathname);
      if (!m) continue;
      req.params = {};
      r.keys.forEach((k, i) => { req.params[k] = decodeURIComponent(m[i + 1]); });
      req.query = url.searchParams;
      try {
        for (const h of r.handlers) {
          await h(req, res);
          if (res.writableEnded) break;
        }
        if (!res.writableEnded) send(res, 500, { error: 'Handler không trả về phản hồi' });
      } catch (e) {
        send(res, e?.status ?? 500, { error: e?.message ?? 'Lỗi máy chủ' });
      }
      return;
    }
    send(res, 404, { error: 'Không tìm thấy endpoint' });
  }
}
