# eCabinet — Phần mềm Phòng họp không giấy

Hệ thống phòng họp không giấy đầy đủ chức năng theo mô hình **VNPT eCabinet**: quản lý toàn bộ vòng đời cuộc họp trên môi trường số — từ giấy mời, tài liệu, điểm danh, phát biểu, biểu quyết đến biên bản ký số và nhiệm vụ sau họp.

> **Giai đoạn 1:** Web app demo chạy hoàn toàn trên trình duyệt — dữ liệu mẫu lưu tại localStorage.
> **Giai đoạn 2 (ĐÃ CÓ trong bản này):** Backend Node.js + PostgreSQL + đăng nhập JWT thật + phân quyền phía máy chủ + RestApiAdapter. Ký số PKI thật và WebRTC thuộc giai đoạn 3.
>
> Hai chế độ chạy từ cùng một mã nguồn:
> | Chế độ | Cách bật | Dùng khi |
> |---|---|---|
> | **Demo trình duyệt** | build không đặt `VITE_API_URL` | xem thử nhanh, không cần máy chủ |
> | **Máy chủ (full-stack)** | build với `VITE_API_URL=/api` (compose làm sẵn) | triển khai thật nhiều người dùng |

---

## 1. Chức năng

### Nghiệp vụ họp
| Nhóm | Chi tiết |
|---|---|
| **Điều hành cuộc họp** | Vòng đời phiên họp: Nháp → Gửi giấy mời → Đang diễn ra → Kết thúc. Chủ trì chuyển mục chương trình, mời phát biểu, mở/đóng biểu quyết, ghi kết luận, kết thúc phiên họp. |
| **Lịch công tác** | Lịch tháng của đơn vị / lịch cá nhân, danh sách cuộc họp trong tháng, trạng thái màu. |
| **Giấy mời & xác nhận** | Gửi giấy mời (mô phỏng email/SMS), đại biểu xác nhận tham dự / báo vắng kèm lý do / ủy quyền cho người khác; **thành phần khách mời** (tham dự, không biểu quyết). |
| **Quản lý tài liệu** | Tài liệu chính theo từng mục chương trình, tài liệu tham khảo, tài liệu cá nhân; tải tệp lên hoặc soạn nội dung; đánh dấu tài liệu **Mật**; phiên bản; chia sẻ có kiểm soát; **ghi chú cá nhân** và **góp ý công khai** trên từng tài liệu; **tự động thông báo khi có tài liệu mới cần xử lý**. |
| **Điểm danh** | Tự điểm danh khi họp, thư ký điểm danh hộ, mã QR điểm danh (mô phỏng), thống kê có mặt/vắng theo thời gian thực. |
| **Đăng ký phát biểu** | Đại biểu đăng ký kèm chủ đề; chủ tọa mời phát biểu theo hàng đợi, kết thúc/từ chối lượt. |
| **Biểu quyết** | Tạo nội dung biểu quyết theo mục họp, phương án tùy chỉnh, biểu quyết kín/công khai, mở–đóng biểu quyết, kết quả cột phần trăm **cập nhật trực tiếp**, tổng hợp ý kiến kèm theo. |
| **Lấy ý kiến (ngoài họp)** | Phiếu xin ý kiến kèm tài liệu + hạn phản hồi, **nút gửi nhắc người chưa phản hồi**, cảnh báo sắp đến hạn trên trang chủ, tổng hợp ý kiến góp ý tự động. |
| **Trao đổi** | Nhắn tin chung cả phòng họp hoặc riêng từng đại biểu ngay trong phiên họp. |
| **Kết luận & Biên bản** | Ghi kết luận theo mục; **tự sinh dự thảo biên bản** từ dữ liệu phiên họp (thành phần, biểu quyết, tổng hợp góp ý trên tài liệu, kết luận); **ghi biên bản bằng giọng nói** tiếng Việt (Web Speech API — Chrome/Edge); **ký số mô phỏng** (PIN USB-token, serial, hash SHA-256, khóa biên bản khi đủ chữ ký); in / xuất PDF theo thể thức văn bản. |
| **Nhiệm vụ sau họp** | Giao việc từ kết luận, người phụ trách, hạn xử lý, cập nhật tiến độ %, cảnh báo quá hạn. |
| **Họp trực tuyến** | Giao diện điểm cầu video (mô phỏng WebRTC), chia sẻ tài liệu đang thảo luận. |
| **Màn hình TV phòng họp** | Chế độ trình chiếu toàn màn hình cho màn hình lớn tại phòng họp: nội dung đang thảo luận, người phát biểu, kết quả biểu quyết trực tiếp, mã QR điểm danh, số đại biểu có mặt. |

### Phân hệ quản trị
- Quản lý **người dùng** + phân quyền 4 vai trò: Quản trị viên / Chủ trì / Thư ký / Đại biểu
- Quản lý **đơn vị**, **phòng họp** (thiết bị, sức chứa, sơ đồ chỗ ngồi)
- **Nhật ký hệ thống** (audit log) lưu vết mọi thao tác
- **Báo cáo thống kê**: số phiên họp theo tháng, tỷ lệ tham dự, lượt biểu quyết, nhiệm vụ, ước tính giấy/chi phí tiết kiệm

### Khác
- Trung tâm **thông báo** trong ứng dụng (giấy mời, biểu quyết, nhiệm vụ, tài liệu chia sẻ)
- **PWA**: cài biểu tượng lên máy tính/máy tính bảng, service worker cache
- **Mô phỏng thời gian thực**: khi vào phòng họp trực tiếp, các đại biểu khác tự động điểm danh, biểu quyết, nhắn tin (demo sinh động; giai đoạn 2 thay bằng WebSocket)

---

## 2. Tài khoản demo

Mật khẩu chung: **123456**

| Tài khoản | Họ tên | Vai trò |
|---|---|---|
| `chutich` | Trần Đại Nghĩa | Chủ tịch UBND tỉnh — **Chủ trì** |
| `thuky` | Phạm Văn Thư | Chánh Văn phòng — **Thư ký** |
| `phochutich` | Lê Minh Khuê | Phó Chủ tịch — Chủ trì |
| `quantri` | Đỗ Quang Trị | **Quản trị hệ thống** (mở phân hệ quản trị) |
| `sokhdt`, `sotc`, `soxd`, `sotnmt`, `sogtvt`, `soyt`, `sogddt`, `sotttt` | Giám đốc các Sở | **Đại biểu** |

Dữ liệu mẫu luôn có sẵn: 1 phiên họp **đang diễn ra**, phiên sắp tới chờ xác nhận, phiên đã kết thúc (biên bản đã ký số), phiếu lấy ý kiến đang mở, nhiệm vụ sau họp. Nút **↻** trên thanh công cụ khôi phục dữ liệu mẫu bất kỳ lúc nào.

---

## 3. Công nghệ & kiến trúc

**React 18 + TypeScript + Vite** — không phụ thuộc framework UI ngoài (CSS tự viết ~ design system riêng).

```
src/
├── domain/          # Thực thể nghiệp vụ + nhãn tiếng Việt (không phụ thuộc UI/data)
│   ├── types.ts
│   └── labels.ts
├── data/            # TẦNG DỮ LIỆU — trừu tượng hóa nguồn dữ liệu
│   ├── repository.ts   # interface Repo<T> + DataSource (hợp đồng)
│   ├── db.ts           # LocalStorageAdapter (giai đoạn 1)
│   └── seed.ts         # Dữ liệu mẫu (ngày giờ tương đối — demo luôn "sống")
├── services/        # LOGIC NGHIỆP VỤ (không phụ thuộc UI)
│   ├── authService.ts      # đăng nhập + ma trận phân quyền `can`
│   ├── meetingService.ts   # vòng đời họp, điểm danh, phát biểu, biên bản, ký số
│   ├── voteService.ts      # biểu quyết + lấy ý kiến + tổng hợp kết quả
│   ├── documentService.ts  # tài liệu, chia sẻ, ghi chú
│   ├── chatService.ts      # trao đổi riêng/nhóm
│   ├── taskService.ts      # nhiệm vụ sau họp
│   ├── notificationService.ts
│   ├── adminService.ts     # người dùng/đơn vị/phòng họp + audit log
│   └── sim.ts              # mô phỏng realtime (GĐ2: thay bằng WebSocket)
├── store/           # AppContext — user hiện tại + snapshot dữ liệu + toast
└── ui/              # React UI (chỉ gọi services, không đụng localStorage)
    ├── MainLayout.tsx, components.tsx, format.ts, styles.css
    └── pages/ (+ pages/admin/)
```

### Giai đoạn 2 — ĐÃ THỰC HIỆN đúng cam kết kiến trúc
1. ✅ `data/restAdapter.ts` — RestApiAdapter implement đúng interface `DataSource` (đã kiểm thử 10/10 hợp đồng với server thật).
2. ✅ `data/db.ts` — factory tự chọn adapter theo `VITE_API_URL`; **UI và services không đổi một dòng nghiệp vụ nào**.
3. ✅ `authService` — chế độ máy chủ dùng JWT (mật khẩu không rời server); chế độ demo giữ nguyên.
4. ✅ `sim.ts` — tự tắt mô phỏng khi chạy máy chủ.
5. ✅ **GĐ3** `data/realtime.ts` — client WebSocket tự kết nối lại lũy tiến; AppContext nhận sự kiện là refresh (gộp nhịp 250ms); chỉ báo "● Thời gian thực" trên thanh công cụ; trang phòng họp trực tiếp và màn hình TV **bỏ polling** khi WebSocket hoạt động và tự quay về polling 3s khi rớt kết nối.

### Backend (thư mục `server/`)
- **Node.js thuần** (không framework nặng — tự viết router ~50 dòng), ESM, Node ≥ 20
- **Xác thực**: JWT HS256 (node:crypto), mật khẩu băm **scrypt**, token TTL cấu hình được
- **CSDL**: PostgreSQL — mô hình bảng JSONB (`id, data, updated_at`) khớp 1:1 hợp đồng `Repo<T>`;
  không đặt `DATABASE_URL` thì server tự chạy bằng **PGlite** (Postgres nhúng trong Node — dev/demo không cần cài DB, cùng một mã SQL)
- **Phân quyền phía máy chủ** theo ma trận ACL: admin (users/đơn vị/phòng/reset), chủ trì+thư ký (tạo/xóa phiên họp, biểu quyết, nhiệm vụ), kiểm tra **chủ sở hữu** (ghi chú, thông báo, tin nhắn — chặn giả mạo `userId`), audit chỉ admin xem, mật khẩu không bao giờ trả về client
- **API**: `POST /api/auth/login` · `GET /api/auth/me` · CRUD chung `GET/POST/PATCH/PUT/DELETE /api/:collection[/:id]` cho 12 bộ dữ liệu · `POST /api/admin/reset` · `GET /health`
- **Realtime WebSocket (GĐ3)**: `ws(s)://…/api/realtime?token=<JWT>` — server tự viết theo **RFC 6455** (không thư viện ngoài): bắt tay Sec-WebSocket-Accept, xác thực JWT lúc nâng cấp, ping/pong giữ kết nối (env `WS_PING_MS`, mặc định 30s). Mô hình **poke-then-pull**: mỗi thao tác ghi thành công phát `{type:'change', collection, action, id}` tới mọi client; client tự refresh qua REST có phân quyền → kênh đẩy không rò rỉ dữ liệu. Điểm danh, biểu quyết, đăng ký phát biểu, trao đổi… hiển thị **tức thời trên mọi thiết bị**.
- **Endpoint nghiệp vụ + hardening (GĐ4)** — các mutation nhạy cảm KHÔNG đi qua CRUD chung nữa:
  | Endpoint `/api/actions/...` | Kiểm tra sâu phía server |
  |---|---|
  | `vote/:id/ballot` | phiếu đang mở · đúng thành phần · chưa bỏ · phương án hợp lệ · danh tính từ JWT |
  | `vote/:id/open` · `/close` | đúng vai trò quản lý hoặc người tạo · đúng chuyển trạng thái |
  | `meetings/:id/checkin` | phiên đang diễn ra · đúng thành phần · điểm danh hộ chỉ chủ trì/thư ký/admin |
  | `meetings/:id/invite` · `/start` · `/end` | đúng vai trò trong CHÍNH phiên họp đó · đúng vòng đời trạng thái |
  | `meetings/:id/sign` | chỉ chủ trì/thư ký của phiên · PIN 6 số · **hash SHA-256 tính tại server** · khóa khi đủ chữ ký · biên bản đã khóa bất biến |

  **Guard CRUD chung**: PATCH `votes` cấm đại biểu, và ngay cả quản lý cũng bị bảo toàn `ballots/status`; PATCH `meetings` bảo toàn `status`, `checkedInAt`, chữ ký/khóa biên bản với mọi vai trò; đại biểu chỉ sửa được dòng tham dự của chính mình (+ thêm khách mời khi ủy quyền). Thông báo & audit ghi tại server, phát realtime.
- **Lọc quyền đọc theo bản ghi (GĐ6, vá P0)** — `server/src/access.js`: GET `/api/:collection[/:id]` KHÔNG trả nguyên dữ liệu cho mọi người đăng nhập nữa mà lọc phía server:
  - `documents`: tài liệu **Mật** chỉ owner / được chia sẻ / quản lý; tài liệu họp cần là thành phần; tài liệu cá nhân chỉ owner/được chia sẻ.
  - `votes`: **biểu quyết kín** ẩn danh phiếu của người khác (bỏ `userId`), giữ phiếu của chính mình — người tạo/quản lý mới thấy đầy đủ để tổng hợp.
  - `messages`: tin riêng chỉ người gửi/nhận; tin chung chỉ thành phần cuộc họp.
  - `notifications`: chỉ của chính mình (admin cũng không xem của người khác). `annotations`: ghi chú cá nhân chỉ của mình, góp ý công khai cho thành phần cuộc họp.
  - Bản ghi không có quyền đọc trả **404** (không lộ tồn tại).
- **Kiểm kiểu dữ liệu đầu vào (GĐ6, vá P0)** — `validatePatch` trong `guard.js`: PATCH/POST sai kiểu (vd `participants` là số/null/chuỗi, phần tử thiếu `userId`, `minutes` không phải object, `progress` ngoài 0–100) trả **400 và KHÔNG lưu** — chống làm hỏng bản ghi và sập 500 dây chuyền.
- **Rate-limit (GĐ4)**: toàn cục theo IP (`RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS`, mặc định 300 req/60s, trả 429 + `Retry-After`; `/health` miễn trừ) và **riêng cho đăng nhập** theo IP+tài khoản (`LOGIN_RATE_MAX`, mặc định 10 lần/15 phút — chống brute-force).
- **Refresh token xoay vòng (GĐ4)**: access token rút còn **1 giờ** (`JWT_TTL`); refresh token 256-bit lưu **băm SHA-256** trong bảng `c_sessions` (`REFRESH_TTL_SEC`, mặc định 7 ngày), **dùng một lần — mỗi lần refresh cấp cặp mới** (chống replay), thu hồi khi đăng xuất. Frontend tự gia hạn khi gặp 401 rồi thử lại (single-flight), kênh realtime luôn lấy token mới nhất khi kết nối lại.
- **Seed dùng chung**: `server/src/seed.mjs` được sinh tự động từ `src/data/seed.ts` (một nguồn dữ liệu mẫu duy nhất)

```bash
# Chạy backend độc lập (không cần PostgreSQL — dùng PGlite):
cd server && node scripts/fetch-deps.mjs   # hoặc: npm install
node src/index.js                          # API tại http://localhost:3000

# Dùng PostgreSQL thật:
DATABASE_URL=postgres://user:pass@host:5432/ecabinet JWT_SECRET=bi-mat node src/index.js
```

---

## 4. Chạy dự án

### Cách chuẩn (có mạng npm)
```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # xuất dist/ (single-file HTML)
```

### Cách dự phòng (mạng nội bộ không truy cập được registry.npmjs.org)
```bash
node scripts/fetch-deps.mjs   # tải deps runtime từ CDN unpkg
node scripts/build-cdn.mjs    # build bằng binary esbuild tải từ jsdelivr
# kết quả: dist/index.html (không cần npm install)
```

## 5. Đóng gói Docker (full-stack — GĐ2)

```bash
docker compose up -d --build
# → http://localhost:8080  (đăng nhập chutich / 123456)

# Triển khai thật — đổi bí mật:
DB_PASSWORD='mat-khau-manh' JWT_SECRET='chuoi-bi-mat-dai' docker compose up -d --build
```

3 service:
- `web` — frontend build với `VITE_API_URL=/api`, phục vụ qua nginx (proxy `/api` → `api:3000`, gzip, SPA fallback, body 25MB)
- `api` — backend Node.js (JWT, ACL, REST) — tự tạo bảng + nạp seed lần đầu chạy
- `db` — PostgreSQL 16 + volume `ecabinet_pgdata` + healthcheck

Sao lưu: `docker compose exec db pg_dump -U ecabinet ecabinet > backup.sql`
Khôi phục dữ liệu mẫu: nút ↻ trong app (chỉ quản trị viên) hoặc `POST /api/admin/reset`.

## 6. PWA (cài như ứng dụng)

Truy cập bằng Chrome/Edge → biểu tượng **Cài đặt** trên thanh địa chỉ → app chạy cửa sổ riêng trên máy tính/máy tính bảng. (`manifest.webmanifest` + `sw.js`; service worker chỉ kích hoạt khi chạy HTTPS.)

## 7. Lộ trình tiếp theo (đề xuất)

| Hạng mục | Giải pháp đề xuất |
|---|---|
| ~~Realtime đẩy sự kiện~~ | ✅ **ĐÃ CÓ (GĐ3)** — WebSocket RFC 6455 tự viết, poke-then-pull, keepalive, tự kết nối lại |
| ~~Endpoint nghiệp vụ + rate-limit + refresh token~~ | ✅ **ĐÃ CÓ (GĐ4)** — /api/actions kiểm tra sâu, guard CRUD, chống brute-force, phiên xoay vòng |
| Chuẩn hóa CSDL | Tách dần bảng JSONB thành bảng quan hệ cho thực thể nóng (ballots, participants) khi quy mô lớn |
| Lưu trữ tài liệu lớn | MinIO (S3-compatible), virus scan, streaming (thay base64 trong JSONB) |
| Đăng nhập nâng cao | Refresh token, SSO/LDAP cơ quan, 2FA |
| Ký số thật | VNPT SmartCA / USB token (plugin ký hash phía client), chữ ký chuẩn PAdES |
| Họp trực tuyến | LiveKit hoặc Jitsi self-host (WebRTC SFU) |
| Thông báo đa kênh | Email (SMTP), SMS Brandname, Web Push |
| Bảo mật | Phân quyền chi tiết theo tài liệu mật, mã hóa at-rest, nhật ký bất biến, rate-limit |

## 8. Giới hạn hiện tại

- **Chế độ demo trình duyệt**: dữ liệu mỗi máy một bộ (localStorage), tệp ≤ 1,5MB, realtime giả lập
- **Chế độ máy chủ (GĐ2–GĐ4)**: dữ liệu tập trung PostgreSQL, JWT 1h + refresh token xoay vòng, phân quyền server-side + endpoint nghiệp vụ kiểm tra sâu + guard CRUD + rate-limit; **realtime WebSocket** (polling chỉ là dự phòng); tệp ≤ 15MB (base64 trong JSONB)
- Ký số/QR/video vẫn là mô phỏng ở cả hai chế độ (GĐ3)

---

© 2026 — eCabinet demo, xây dựng theo mô hình chức năng VNPT eCabinet (phòng họp không giấy).
