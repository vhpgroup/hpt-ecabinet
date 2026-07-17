#!/usr/bin/env node
// ============================================================
// eCabinet — KIỂM TRA TẢI (loadtest.mjs)
// Mô phỏng ≥500 người dùng / 90 CCU (concurrent users) đồng thời thao tác,
// đo thời gian phản hồi để đối chiếu với SLA hiệu năng của HSMT:
//   "Đáp ứng thao tác <5 giây, ≥500 user/90 CCU đồng thời" (HSMT mục 3.1 dòng 62)
//
// KHÔNG PHỤ THUỘC NPM — chỉ dùng Node.js thuần (fetch built-in từ Node ≥18,
// WebSocket built-in từ Node ≥22 nếu cần mở rộng sau; script này chỉ dùng
// HTTP fetch). Chạy trực tiếp:
//   node scripts/loadtest.mjs
//
// CẤU HÌNH QUA BIẾN MÔI TRƯỜNG:
//   BASE_URL      — gốc API, ví dụ http://localhost:8080 hoặc https://<domain>
//                   (mặc định http://localhost:8080 — bản Node/pilot; đổi
//                   thành http://localhost:8081 cho biến thể .NET)
//   CCU           — số người dùng đồng thời mô phỏng (mặc định 90, khớp SLA)
//   DURATION_S    — thời gian chạy tải liên tục sau khi đăng nhập, tính bằng
//                   giây (mặc định 120 = 2 phút)
//   RAMP_UP_MS    — thời gian trải đều việc bắt đầu CCU "phiên" ảo, tránh dồn
//                   toàn bộ request đăng nhập vào đúng 1 khoảnh khắc gây
//                   spike giả tạo không phản ánh tải thực tế (mặc định 5000ms)
//   ACCOUNTS      — danh sách tài khoản demo dùng để đăng nhập, phân tách bằng
//                   dấu phẩy, dạng user:pass (mặc định dùng đúng bộ tài khoản
//                   demo có sẵn trong seed — xem README mục 2); nếu số CCU lớn
//                   hơn số tài khoản, các "phiên ảo" sẽ dùng lại tài khoản
//                   theo vòng (round-robin) — hợp lý vì SLA đo tải hệ thống,
//                   không đo số tài khoản duy nhất.
//   MEETING_ID    — id cuộc họp dùng để test chi tiết/tài liệu (mặc định 'm1'
//                   — khớp seed mẫu trong src/data/seed.ts)
//   VOTE_ID       — id nội dung biểu quyết dùng để test bước biểu quyết
//                   (mặc định 'v1' — khớp seed mẫu, thuộc meeting 'm1')
//   OUT_JSON      — đường dẫn file JSON xuất kết quả chi tiết (mặc định
//                   ./loadtest-result.json ở thư mục hiện hành khi chạy)
//   REQUEST_TIMEOUT_MS — timeout mỗi request (mặc định 10000ms)
//
// KỊCH BẢN MỖI "PHIÊN ẢO" (đại diện 1 người dùng thật đang dùng ứng dụng),
// lặp lại liên tục cho đến hết DURATION_S — đúng luồng nghiệp vụ chính của
// HSMT mục 3.4 (điều hành họp) + mục 3.1 (tra cứu):
//   1) POST /api/auth/login              — đăng nhập
//   2) GET  /api/meetings                — danh sách phiên họp (dashboard)
//   3) GET  /api/meetings/:id            — chi tiết 1 phiên họp
//   4) GET  /api/documents?meetingId=:id — tài liệu của phiên họp đó
//   5) POST /api/actions/vote/:id/ballot — thử biểu quyết (nếu phiếu đang mở;
//      lỗi nghiệp vụ 400/403 — vd "đã biểu quyết"/"chưa mở" — KHÔNG tính là
//      lỗi tải, chỉ 5xx/timeout/network error mới tính lỗi — xem "phân loại
//      lỗi" dưới đây)
//   6) GET  /api/open/v1/spec            — tra cứu (đại diện endpoint tra cứu/
//      catalog, không cần khóa API, luôn khả dụng để đo độ trễ tra cứu)
//   (quay lại bước 2, lặp cho đến hết DURATION_S)
//
// PHÂN LOẠI LỖI: bước 5 (biểu quyết) rất dễ trả lỗi NGHIỆP VỤ hợp lệ (phiếu đã
// đóng, đã bỏ phiếu rồi, không thuộc thành phần...) khi chạy lặp lại nhiều lần
// với cùng seed — đây KHÔNG phải lỗi hạ tầng. Script tách riêng "lỗi HTTP 4xx
// dự kiến" (không tính vào error rate) và "lỗi thật" (5xx, timeout, network,
// hoặc 401/403 KHÔNG mong đợi) để error rate phản ánh đúng SỨC CHỊU TẢI của hệ
// thống, không lẫn với logic nghiệp vụ của demo seed cố định.
//
// ĐO & IN: p50/p95/p99 (ms) theo từng loại thao tác + tổng thể, RPS
// (requests/second), tỷ lệ lỗi (%), số request, kèm bảng đối chiếu ngưỡng SLA
// HSMT (<5s/thao tác). Xuất JSON đầy đủ (mọi sample) ra OUT_JSON để đưa vào
// hồ sơ SLA / báo cáo nghiệm thu — xem docs/loadtest.md.
//
// GIỚI HẠN QUAN TRỌNG: đây là load test tầng HTTP đơn giản (không phải công
// cụ chuyên dụng như k6/Gatling/JMeter) — đủ để có SỐ LIỆU THẬT thay cho
// "chưa đo" hoàn toàn (đúng khuyến nghị trong báo cáo đánh giá nội bộ), nhưng
// KHÔNG mô phỏng WebSocket realtime, KHÔNG mô phỏng trình duyệt thật (không
// tải JS/CSS/ảnh), và chạy trên 1 máy Node đơn luồng nên ở CCU rất cao chính
// Node loadtest có thể là nút cổ chai trước cả server đích — xem docs/loadtest.md
// mục "Giới hạn của công cụ" để biết khi nào cần công cụ chuyên dụng hơn.
//
// CHƯA CHẠY THỬ TRONG SANDBOX (không có docker/server đang chạy để nhắm tới,
// nền tảng chặn mở HTTP server/tiến trình dài) — chỉ kiểm `node --check`. Cần
// chạy thật trên máy triển khai có server đang phục vụ (xem docs/loadtest.md).
// ============================================================

'use strict';

// ---------- cấu hình từ biến môi trường ----------
const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:8080').replace(/\/+$/, '');
const CCU = Math.max(1, Number(process.env.CCU ?? 90));
const DURATION_S = Math.max(1, Number(process.env.DURATION_S ?? 120));
const RAMP_UP_MS = Math.max(0, Number(process.env.RAMP_UP_MS ?? 5000));
const MEETING_ID = process.env.MEETING_ID ?? 'm1';
const VOTE_ID = process.env.VOTE_ID ?? 'v1';
const OUT_JSON = process.env.OUT_JSON ?? './loadtest-result.json';
const REQUEST_TIMEOUT_MS = Math.max(1000, Number(process.env.REQUEST_TIMEOUT_MS ?? 10000));

// Bộ tài khoản demo mặc định — khớp README mục 2 / src/data/seed.ts. Cho phép
// override qua ACCOUNTS="user1:pass1,user2:pass2,...".
const DEFAULT_ACCOUNTS = [
  'chutich:123456', 'thuky:123456', 'phochutich:123456', 'quantri:123456',
  'qtdonvi:123456', 'sokhdt:123456', 'sotc:123456', 'soxd:123456',
  'sotnmt:123456', 'sogtvt:123456', 'soyt:123456', 'sogddt:123456', 'sotttt:123456',
];
const ACCOUNTS = (process.env.ACCOUNTS ?? DEFAULT_ACCOUNTS.join(','))
  .split(',').map((s) => s.trim()).filter(Boolean)
  .map((pair) => {
    const [username, password] = pair.split(':');
    return { username, password: password ?? '123456' };
  });

if (ACCOUNTS.length === 0) {
  console.error('✗ ACCOUNTS trống — cần ít nhất 1 tài khoản dạng user:pass.');
  process.exit(1);
}

// ---------- tiện ích đo & thu thập số liệu ----------
/** @typedef {{ op: string, ms: number, ok: boolean, status: number, expectedBusinessError: boolean, at: number }} Sample */
/** @type {Sample[]} */
const samples = [];
let totalRequests = 0;
let hardErrors = 0;       // lỗi tính vào error rate (5xx/timeout/network/401-403 bất ngờ)
let businessErrors = 0;   // lỗi nghiệp vụ dự kiến (không tính vào error rate)

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

async function timedFetch(op, url, options, { expectedBusinessStatuses = [], parseJson = false } = {}) {
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let status = 0;
  let ok = false;
  let expectedBusinessError = false;
  let json = null;
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    status = res.status;
    if (parseJson) {
      // Đọc & parse JSON luôn (thay vì arrayBuffer rồi bỏ) — dùng ngay kết quả
      // (vd token đăng nhập) mà KHÔNG cần gọi fetch lần 2 chỉ để lấy dữ liệu,
      // tránh tính sai số liệu tải (mỗi thao tác nghiệp vụ chỉ 1 request thật).
      json = await res.json().catch(() => null);
    } else {
      // Vẫn đọc hết body để tính đúng thời gian round-trip đầy đủ (không chỉ header).
      await res.arrayBuffer().catch(() => {});
    }
    ok = res.ok;
    if (!ok && expectedBusinessStatuses.includes(status)) {
      expectedBusinessError = true;
    }
  } catch (err) {
    status = err?.name === 'AbortError' ? 0 /* timeout */ : -1 /* network error */;
    ok = false;
  } finally {
    clearTimeout(timer);
  }
  const ms = performance.now() - start;
  totalRequests += 1;
  if (!ok) {
    if (expectedBusinessError) businessErrors += 1;
    else hardErrors += 1;
  }
  samples.push({ op, ms, ok: ok || expectedBusinessError, status, expectedBusinessError, at: Date.now() });
  return { ok, status, ms, json };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 1 "phiên ảo" — mô phỏng 1 người dùng lặp kịch bản liên tục ----------
async function virtualUserLoop(userIdx, stopAt) {
  const account = ACCOUNTS[userIdx % ACCOUNTS.length];
  let token = null;

  // 1) Đăng nhập — DUY NHẤT 1 request (parseJson: true để lấy token luôn, không
  //    gọi lại lần 2). 429 (rate-limit login) được coi là lỗi nghiệp vụ dự kiến,
  //    không phải lỗi tải: LOGIN_RATE_MAX đang hoạt động đúng thiết kế khi nhiều
  //    phiên ảo dùng CÙNG tài khoản đăng nhập gần nhau (round-robin ACCOUNTS ít
  //    hơn CCU) — xem docs/loadtest.md mục "Đọc kết quả" để biết cách diễn giải.
  const loginRes = await timedFetch('login', `${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: account.username, password: account.password }),
  }, { expectedBusinessStatuses: [429], parseJson: true });
  if (loginRes.ok && loginRes.status === 200) {
    token = loginRes.json?.token ?? null;
  }

  if (!token) {
    // Không đăng nhập được — vẫn tính các request tiếp theo (sẽ trả 401, tính lỗi
    // thật) để phản ánh đúng việc "phiên ảo này không hoạt động được", không âm
    // thầm bỏ qua khiến báo cáo tải bị lạc quan giả.
  }

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  while (Date.now() < stopAt) {
    // 2) Danh sách phiên họp
    await timedFetch('list_meetings', `${BASE_URL}/api/meetings`, { headers: authHeaders });

    // 3) Chi tiết 1 phiên họp
    await timedFetch('meeting_detail', `${BASE_URL}/api/meetings/${MEETING_ID}`, {
      headers: authHeaders,
    }, { expectedBusinessStatuses: [404] }); // 404 nếu MEETING_ID không tồn tại trên máy đích — coi là lỗi cấu hình đã biết, không phải lỗi tải

    // 4) Tài liệu của phiên họp
    await timedFetch('documents', `${BASE_URL}/api/documents?meetingId=${encodeURIComponent(MEETING_ID)}`, {
      headers: authHeaders,
    });

    // 5) Thử biểu quyết — chỉ mang tính đại diện thao tác WRITE nặng nhất
    //    (đi qua mutateDoc/CAS); rất nhiều status 400 dự kiến (phiếu đã đóng/đã
    //    bỏ phiếu) khi seed cố định + nhiều vòng lặp — KHÔNG tính lỗi tải.
    await timedFetch('vote_ballot', `${BASE_URL}/api/actions/vote/${VOTE_ID}/ballot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ optionId: 'agree' }),
    }, { expectedBusinessStatuses: [400, 403, 404] });

    // 6) Tra cứu (đặc tả OpenAPI công khai — luôn khả dụng, không cần khóa API)
    await timedFetch('open_spec', `${BASE_URL}/api/open/v1/spec`, {});

    // Nghỉ ngắn ngẫu nhiên giữa 2 vòng lặp để mô phỏng người dùng thật (không
    // spam request liên tục vô hạn — cũng tránh 1 phiên ảo tự đụng rate-limit
    // toàn cục RATE_LIMIT_MAX của chính nó).
    await sleep(300 + Math.random() * 700);
  }
}

// ---------- điều phối CCU phiên ảo, đo RPS theo thời gian thực ----------
async function main() {
  console.log('============================================================');
  console.log('eCabinet — KIỂM TRA TẢI (loadtest.mjs)');
  console.log(`  BASE_URL     : ${BASE_URL}`);
  console.log(`  CCU          : ${CCU}`);
  console.log(`  DURATION_S   : ${DURATION_S}s`);
  console.log(`  RAMP_UP_MS   : ${RAMP_UP_MS}ms`);
  console.log(`  MEETING_ID   : ${MEETING_ID}`);
  console.log(`  VOTE_ID      : ${VOTE_ID}`);
  console.log(`  Số tài khoản dùng: ${ACCOUNTS.length} (round-robin nếu CCU > số tài khoản)`);
  console.log('============================================================\n');

  const overallStart = Date.now();
  const stopAt = overallStart + RAMP_UP_MS + DURATION_S * 1000;

  // Ramp-up: trải đều thời điểm bắt đầu của từng phiên ảo trong RAMP_UP_MS để
  // tránh 1 spike đăng nhập đồng thời tuyệt đối (không phản ánh tải thực tế —
  // người dùng thật không bấm nút cùng 1 milli-giây).
  const tasks = [];
  for (let i = 0; i < CCU; i++) {
    const delay = CCU > 1 ? (i / (CCU - 1)) * RAMP_UP_MS : 0;
    tasks.push(
      sleep(delay).then(() => virtualUserLoop(i, stopAt)),
    );
  }

  // In tiến độ mỗi 10 giây trong lúc chạy để biết script không bị treo.
  const progressTimer = setInterval(() => {
    const elapsedS = ((Date.now() - overallStart) / 1000).toFixed(0);
    const rps = totalRequests / Math.max(1, (Date.now() - overallStart) / 1000);
    console.log(`  … đang chạy: ${elapsedS}s trôi qua · ${totalRequests} request · ~${rps.toFixed(1)} req/s · lỗi thật: ${hardErrors} · lỗi nghiệp vụ (bỏ qua): ${businessErrors}`);
  }, 10000);

  await Promise.all(tasks);
  clearInterval(progressTimer);

  const totalDurationS = (Date.now() - overallStart) / 1000;

  // ---------- tổng hợp kết quả ----------
  const byOp = {};
  for (const s of samples) {
    if (!byOp[s.op]) byOp[s.op] = [];
    byOp[s.op].push(s.ms);
  }

  const overallMs = samples.map((s) => s.ms);
  const rps = totalRequests / totalDurationS;
  const errorRatePct = totalRequests > 0 ? (hardErrors / totalRequests) * 100 : 0;

  console.log('\n============================================================');
  console.log('KẾT QUẢ TỔNG HỢP');
  console.log('============================================================');
  console.log(`  Tổng thời gian chạy   : ${totalDurationS.toFixed(1)}s`);
  console.log(`  Tổng số request       : ${totalRequests}`);
  console.log(`  RPS (requests/giây)   : ${rps.toFixed(2)}`);
  console.log(`  Lỗi thật (5xx/timeout/network/401-403 bất ngờ): ${hardErrors} (${errorRatePct.toFixed(2)}%)`);
  console.log(`  Lỗi nghiệp vụ dự kiến (bỏ qua, không tính lỗi tải): ${businessErrors}`);
  console.log('');
  console.log('BẢNG ĐỘ TRỄ THEO THAO TÁC (ms) — đối chiếu ngưỡng HSMT <5000ms/thao tác');
  const header = ['Thao tác', 'Số lần', 'p50', 'p95', 'p99', 'max', 'Đạt <5s?'];
  console.log('  ' + header.map((h, i) => h.padEnd(i === 0 ? 16 : 10)).join(''));
  console.log('  ' + '-'.repeat(16 + 10 * 6));
  const opSummary = {};
  for (const [op, arr] of Object.entries(byOp)) {
    const p50 = percentile(arr, 50);
    const p95 = percentile(arr, 95);
    const p99 = percentile(arr, 99);
    const max = Math.max(...arr);
    const pass = p95 < 5000 ? 'ĐẠT' : 'RỚT';
    opSummary[op] = { count: arr.length, p50, p95, p99, max };
    console.log(
      '  ' +
      [op, String(arr.length), p50.toFixed(0), p95.toFixed(0), p99.toFixed(0), max.toFixed(0), pass]
        .map((v, i) => String(v).padEnd(i === 0 ? 16 : 10)).join(''),
    );
  }
  console.log('');
  const overallP50 = percentile(overallMs, 50);
  const overallP95 = percentile(overallMs, 95);
  const overallP99 = percentile(overallMs, 99);
  console.log(`  TỔNG THỂ: p50=${overallP50.toFixed(0)}ms · p95=${overallP95.toFixed(0)}ms · p99=${overallP99.toFixed(0)}ms`);
  console.log(`  SLA HSMT "<5s/thao tác": ${overallP95 < 5000 ? 'ĐẠT (p95 tổng thể < 5000ms)' : 'RỚT (p95 tổng thể >= 5000ms — cần điều tra)'}`);
  console.log(`  SLA HSMT "${CCU} CCU đồng thời không lỗi hàng loạt": ${errorRatePct < 1 ? 'ĐẠT (error rate < 1%)' : 'CẦN XEM LẠI (error rate >= 1% — kiểm log server)'}`);
  console.log('============================================================\n');

  // ---------- xuất JSON đầy đủ ----------
  const result = {
    config: { BASE_URL, CCU, DURATION_S, RAMP_UP_MS, MEETING_ID, VOTE_ID, accountsUsed: ACCOUNTS.length },
    startedAt: new Date(overallStart).toISOString(),
    finishedAt: new Date().toISOString(),
    totalDurationS,
    totalRequests,
    rps,
    hardErrors,
    businessErrors,
    errorRatePct,
    overall: { p50: overallP50, p95: overallP95, p99: overallP99, max: Math.max(...overallMs, 0) },
    byOperation: opSummary,
    slaChecks: {
      p95Under5s: overallP95 < 5000,
      errorRateUnder1pct: errorRatePct < 1,
    },
    // Toàn bộ sample thô — hữu ích để vẽ biểu đồ/đối chiếu chi tiết trong hồ sơ SLA.
    samples,
  };

  const fs = await import('node:fs/promises');
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 2), 'utf8');
  console.log(`✔ Đã xuất kết quả chi tiết ra: ${OUT_JSON}`);

  // Exit code khác 0 nếu không đạt ngưỡng SLA cơ bản — hữu ích khi gọi từ CI/script khác.
  if (!result.slaChecks.p95Under5s || !result.slaChecks.errorRateUnder1pct) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('✗ Lỗi khi chạy loadtest:', err);
  process.exit(1);
});
