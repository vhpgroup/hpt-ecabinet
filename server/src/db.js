// ============================================================
// TẦNG CSDL — PostgreSQL (production, qua DATABASE_URL) hoặc
// PGlite (Postgres nhúng chạy trong Node — dev/demo, không cần cài DB).
// Cùng một mã SQL cho cả hai vì PGlite là Postgres thật (WASM).
//
// Mô hình lưu trữ GĐ2: mỗi bộ dữ liệu 1 bảng JSONB
//   (id TEXT PK, data JSONB, updated_at TIMESTAMPTZ)
// — khớp 1:1 với hợp đồng Repo<T> của frontend, giữ nguyên services.
// GĐ3 có thể chuẩn hóa dần các thực thể nóng (meetings, votes).
// ============================================================
import { hashPassword } from './auth.js';
import { buildSeed } from './seed.mjs';

export const COLLECTIONS = {
  users: 'c_users',
  units: 'c_units',
  rooms: 'c_rooms',
  meetings: 'c_meetings',
  documents: 'c_documents',
  annotations: 'c_annotations',
  votes: 'c_votes',
  speakRequests: 'c_speak_requests',
  questions: 'c_questions',
  messages: 'c_messages',
  tasks: 'c_tasks',
  notifications: 'c_notifications',
  audit: 'c_audit',
  catalogs: 'c_catalogs', // ĐỢT 3: danh mục chung (E-HSMT mục 6, 7, 10)
  guides: 'c_guides',     // ĐỢT 3: tài liệu hướng dẫn sử dụng (E-HSMT mục 4)
  apiKeys: 'c_apikeys',   // RỔ B: khóa API cấp cho bên thứ 3 (E-HSMT mục 54–59)
};

let _query = null;

export const query = (text, params = []) => _query(text, params);

/**
 * CẬP NHẬT NGUYÊN TỬ 1 bản ghi JSONB bằng optimistic locking (CAS) — GĐ8 (vá P0).
 * Chống lost-update khi nhiều người ghi ĐỒNG THỜI (vd cùng bỏ phiếu 1 nội dung):
 *   đọc data hiện tại -> mutate(bản sao) -> UPDATE ... WHERE data = data_cũ.
 * Nếu giữa chừng có người ghi khác (WHERE không khớp) -> đọc lại & thử lại.
 *
 * mutate(current) trả về:
 *   - object mới                 -> ghi đè
 *   - { __error, __status }      -> lỗi nghiệp vụ, DỪNG ngay (không retry)
 *   - null/undefined             -> không đổi gì (no-op), coi như thành công
 * LƯU Ý: mutate PHẢI thuần (không side-effect) vì có thể chạy lại nhiều lần.
 *
 * Trả về { ok, data?, error?, status?, reason, noop? }.
 */
export async function mutateDoc(table, id, mutate, retries = 8) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const r = await query(`SELECT data FROM ${table} WHERE id = $1`, [id]);
    if (!r.rows[0]) return { ok: false, reason: 'not_found' };
    const current = r.rows[0].data;
    let next;
    try {
      next = mutate(JSON.parse(JSON.stringify(current)));
    } catch (e) {
      return { ok: false, reason: 'error', error: e?.message ?? 'Lỗi xử lý', status: 400 };
    }
    if (next && next.__error) return { ok: false, reason: 'error', error: next.__error, status: next.__status ?? 400 };
    if (next == null) return { ok: true, data: current, noop: true };
    // CAS: chỉ ghi nếu data CHƯA đổi kể từ lúc đọc (so khớp jsonb ngữ nghĩa)
    const upd = await query(
      `UPDATE ${table} SET data = $2::jsonb, updated_at = now() WHERE id = $1 AND data = $3::jsonb RETURNING id`,
      [id, JSON.stringify(next), JSON.stringify(current)],
    );
    if (upd.rows && upd.rows.length === 1) return { ok: true, data: next };
    // else: có ghi đồng thời -> vòng lặp đọc lại (retry)
  }
  return { ok: false, reason: 'conflict', status: 409, error: 'Hệ thống bận do nhiều thao tác đồng thời, vui lòng thử lại' };
}

export async function initDb() {
  if (process.env.DATABASE_URL) {
    const pgMod = await import('pg');
    const Pool = pgMod.default?.Pool ?? pgMod.Pool;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
    _query = (t, p) => pool.query(t, p);
    // chờ DB sẵn sàng (compose khởi động song song)
    for (let i = 0; i < 30; i++) {
      try { await _query('SELECT 1'); break; }
      catch (e) { if (i === 29) throw e; await new Promise((r) => setTimeout(r, 2000)); }
    }
    console.log('[db] Kết nối PostgreSQL:', process.env.DATABASE_URL.replace(/:\/\/.*@/, '://***@'));
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = process.env.PGLITE_DIR ?? './data/ecabinet-db';
    const pg = new PGlite(dir);
    await pg.waitReady;
    _query = (t, p) => pg.query(t, p);
    console.log('[db] PGlite (Postgres nhúng) tại', dir, '— đặt DATABASE_URL để dùng PostgreSQL thật');
  }
  await migrate();
  await seedIfEmpty();
}

async function migrate() {
  for (const table of Object.values(COLLECTIONS)) {
    await query(`CREATE TABLE IF NOT EXISTS ${table} (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  }
  await query(`ALTER TABLE c_users ADD COLUMN IF NOT EXISTS username TEXT`);
  await query(`ALTER TABLE c_users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON c_users (username)`);
  // GĐ4: phiên refresh token (lưu băm SHA-256, không lộ token gốc)
  await query(`CREATE TABLE IF NOT EXISTS c_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON c_sessions (user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_meetings_status ON c_meetings ((data->>'status'))`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notif_user ON c_notifications ((data->>'userId'))`);
}

export async function seedIfEmpty(force = false) {
  const r = await query('SELECT COUNT(*)::int AS n FROM c_users');
  if (!force && r.rows[0].n > 0) return false;

  if (force) {
    for (const table of Object.values(COLLECTIONS)) {
      await query(`DELETE FROM ${table}`);
    }
  }

  const seed = buildSeed();
  for (const [col, table] of Object.entries(COLLECTIONS)) {
    const items = seed[col] ?? [];
    for (const item of items) {
      if (col === 'users') {
        const { password, ...rest } = item;
        await query(
          `INSERT INTO c_users (id, data, username, password_hash) VALUES ($1, $2::jsonb, $3, $4)`,
          [item.id, JSON.stringify({ ...rest, password: '' }), item.username, hashPassword(password ?? '123456')],
        );
      } else {
        await query(
          `INSERT INTO ${table} (id, data) VALUES ($1, $2::jsonb)`,
          [item.id, JSON.stringify(item)],
        );
      }
    }
  }
  console.log('[db] Đã nạp dữ liệu mẫu (seed dùng chung với frontend)');
  return true;
}
