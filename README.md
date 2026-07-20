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
| **Trình – duyệt tài liệu** | Quy trình duyệt tài liệu họp: người trình **Trình duyệt** (Nháp → Chờ duyệt), chủ trì/thư ký **Duyệt** hoặc **Từ chối kèm lý do** (yêu cầu làm lại); badge trạng thái (Nháp / Chờ duyệt / Đã duyệt / Từ chối); **đại biểu chỉ thấy tài liệu đã duyệt**; hàng đợi duyệt cho quản lý. |
| **Sơ đồ phòng họp & vị trí đại biểu** | Quản trị cập nhật **sơ đồ phòng họp** (lưới ghế, đánh dấu lối đi); chủ trì/thư ký **gán vị trí đại biểu** theo sơ đồ; phòng họp trực tiếp hiển thị sơ đồ với **màu điểm danh trực tiếp** (có mặt / chưa điểm danh / vắng) và viền nổi bật người đang phát biểu. |
| **Điểm danh** | Tự điểm danh khi họp, thư ký điểm danh hộ, mã QR điểm danh (mô phỏng), thống kê có mặt/vắng theo thời gian thực. |
| **Đăng ký phát biểu** | Đại biểu đăng ký kèm chủ đề; chủ tọa mời phát biểu theo hàng đợi, kết thúc/từ chối lượt. |
| **Chất vấn** | Đại biểu đăng ký/hủy chất vấn (người được chất vấn, chủ đề, nội dung), xem danh sách & nội dung chất vấn; chủ tọa điều hành phiên chất vấn (bắt đầu/tạm dừng/kết thúc), duyệt danh sách đã gọi/chưa gọi, gọi/từ chối chất vấn — hiển thị người đang chất vấn trên màn hình TV. |
| **Biểu quyết** | Tạo nội dung biểu quyết theo mục họp, phương án tùy chỉnh, biểu quyết kín/công khai, mở–đóng biểu quyết, kết quả cột phần trăm **cập nhật trực tiếp**, tổng hợp ý kiến kèm theo. |
| **Lấy ý kiến (ngoài họp)** | Phiếu xin ý kiến kèm tài liệu + hạn phản hồi, **nút gửi nhắc người chưa phản hồi**, cảnh báo sắp đến hạn trên trang chủ, tổng hợp ý kiến góp ý tự động. |
| **Trao đổi** | Nhắn tin chung cả phòng họp hoặc riêng từng đại biểu ngay trong phiên họp. |
| **Kết luận & Biên bản** | Ghi kết luận theo mục; **tự sinh dự thảo biên bản** từ dữ liệu phiên họp (thành phần, biểu quyết, tổng hợp góp ý trên tài liệu, kết luận); **ghi biên bản bằng giọng nói** tiếng Việt (Web Speech API — Chrome/Edge); **ký số mô phỏng** (PIN USB-token, serial, hash SHA-256, khóa biên bản khi đủ chữ ký); in / xuất PDF theo thể thức văn bản. |
| **Nhiệm vụ sau họp** | Giao việc từ kết luận, người phụ trách, hạn xử lý, cập nhật tiến độ %, cảnh báo quá hạn. |
| **Họp trực tuyến** | Giao diện điểm cầu video (mô phỏng WebRTC), chia sẻ tài liệu đang thảo luận. |
| **Màn hình TV phòng họp** | Chế độ trình chiếu toàn màn hình cho màn hình lớn tại phòng họp: nội dung đang thảo luận, người phát biểu, kết quả biểu quyết trực tiếp, mã QR điểm danh, số đại biểu có mặt. |

### Phân hệ quản trị
- Quản lý **người dùng** + phân quyền **5 vai trò**: Quản trị hệ thống / Chủ trì / Thư ký / Thành viên dự họp / **Quản trị đơn vị**
- **Quản trị đơn vị** (unit_admin): quản lý người dùng **trong phạm vi đơn vị mình** (tạo/sửa/khóa – mở), không xóa tài khoản, không đụng vai trò/tài khoản Quản trị hệ thống, không đổi đơn vị của mình — siết chặt phía máy chủ (đọc đơn vị từ CSDL, không tin dữ liệu gửi lên)
- Quản lý **đơn vị**, **phòng họp** (thiết bị, sức chứa, **sơ đồ phòng họp** cấu hình được)
- **Quản trị danh mục** (E-HSMT mục 6, 7, 10): danh mục **chức vụ / loại phiên họp / cơ quan ban hành** — CRUD, bật-tắt, sắp thứ tự; gắn thẳng vào nghiệp vụ (chức vụ người dùng, loại phiên họp trên lịch/danh sách, cơ quan ban hành trên tài liệu)
- **Tài liệu hướng dẫn sử dụng** (E-HSMT mục 4): admin soạn nội dung/tải tệp, giới hạn theo vai trò; người dùng xem HDSD dành cho vai trò mình tại menu **Hướng dẫn sử dụng**
- **API & Tích hợp** (E-HSMT mục 54–59): quản lý **khóa API** cấp cho hệ thống bên thứ 3, **danh mục mô tả API** (quản lý mô tả API) và hướng dẫn **đấu nối LGSP** — xem mục [10](#10-api-công-bố-cho-bên-thứ-3-lgsp-ready)
- **Nhật ký hệ thống** (audit log) lưu vết mọi thao tác — lọc theo **tài khoản** + **khoảng thời gian**, admin **xóa nhật ký** (E-HSMT mục 3)
- **Báo cáo thống kê**: số phiên họp theo tháng, tỷ lệ tham dự, lượt biểu quyết, nhiệm vụ, ước tính giấy/chi phí tiết kiệm

### Khác
- **Thư mục tài liệu cá nhân** (E-HSMT mục 14); view **"Đơn vị tôi chuẩn bị tài liệu"** kèm trạng thái duyệt (mục 23)
- Trong phòng họp: **đếm ngược thời gian còn lại** của mục chương trình (mục 27); chủ tọa xem **đại biểu đã/chưa biểu quyết** (mục 42); **xuất CSV** danh sách điểm danh (mục 36) và ý kiến tài liệu (mục 31)
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
| `qtdonvi` | Nguyễn Quản Trị | **Quản trị đơn vị** — Sở KH&ĐT (quản lý người dùng trong đơn vị) |
| `sokhdt`, `sotc`, `soxd`, `sotnmt`, `sogtvt`, `soyt`, `sogddt`, `sotttt` | Giám đốc các Sở | **Thành viên dự họp** |

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

Sao lưu: `docker compose exec db pg_dump -U ecabinet ecabinet > backup.sql` (hoặc dùng script có sẵn `./deploy/backup.sh` — tự nén, xoay vòng; `./deploy/restore.sh` để khôi phục). Biến thể SQL Server (mục 11) dùng `deploy/backup-mssql.sh`/`restore-mssql.sh`. Diễn tập khôi phục đo RTO thật + quy trình DR đầy đủ: **[`docs/dr-runbook.md`](docs/dr-runbook.md)**. Kiểm tra tải theo SLA 500 user/90 CCU: **[`docs/loadtest.md`](docs/loadtest.md)** (`node scripts/loadtest.mjs`).
Khôi phục dữ liệu mẫu: nút ↻ trong app (chỉ quản trị viên) hoặc `POST /api/admin/reset`.

### Triển khai bằng Coolify (VPS đã có Coolify + Traefik)

Dùng file riêng **`docker-compose.coolify.yml`** — không mở cổng ra host (tránh đụng 80/443/8080 của Traefik), Coolify tự route domain và cấp HTTPS:

1. DNS: bản ghi A `ecabinet.<domain>` → IP VPS
2. Coolify → Project → **+ New → Docker Compose** → repo GitHub này (nhánh `main`)
3. **Docker Compose Location**: `/docker-compose.coolify.yml`
4. **Environment Variables**: đặt `DB_PASSWORD`, `JWT_SECRET` (bấm Generate)
5. Service `web` → **Domains**: `https://ecabinet.<domain>` (cổng container: 80) → **Deploy**
6. Bật webhook auto-deploy: push GitHub là Coolify tự build lại

WebSocket realtime đi qua Traefik tự động. Muốn bật họp video thật: thêm 3 biến `LIVEKIT_*` (mục 6).

## 6. Họp trực tuyến WebRTC (LiveKit)

Trang **Họp trực tuyến** hỗ trợ WebRTC thật (âm thanh + hình ảnh + chia sẻ màn hình) qua [LiveKit](https://livekit.io) — một SFU (Selective Forwarding Unit) mã nguồn mở.

> **Đối chiếu HSMT "không chia sẻ dữ liệu cho bên thứ 3"**: LiveKit Cloud (Cách 1 dưới đây) cho media đi qua hạ tầng bên thứ 3 — chỉ dùng cho pilot/demo. Self-host (Cách 2) là phương án khuyến nghị khi vận hành chính thức. Đối chiếu chi tiết + khuyến nghị hành động: **[`docs/livekit-va-du-lieu.md`](docs/livekit-va-du-lieu.md)**.

**Cơ chế bật/tắt (GATED bằng cấu hình):**
- **Chưa cấu hình LiveKit** (mặc định) → trang giữ **giao diện mô phỏng** như cũ. Demo trình duyệt (localStorage) **luôn** là mô phỏng.
- **Đã cấu hình** (đặt 3 biến `LIVEKIT_*` cho backend, chạy chế độ máy chủ) → tự chuyển sang họp thật.
- Nếu người dùng **từ chối quyền camera/micro**, không có thiết bị, hoặc trình duyệt chặn (vd nhúng iframe sandbox) → hiện thông báo (toast) và **tự quay lại giao diện mô phỏng**, không crash.

**Bật bằng biến môi trường** (đặt cho service `api`, vd trong `deploy/.env`):

```env
LIVEKIT_URL=wss://<host-livekit>       # URL WSS trình duyệt kết nối
LIVEKIT_API_KEY=<api-key>              # backend dùng để MINT access token
LIVEKIT_API_SECRET=<api-secret>        # ký JWT HS256 (KHÔNG lộ ra frontend)
```

Kiểm tra nhanh: `GET /api/rtc/config` trả `{"enabled":true}` khi đã cấu hình; frontend tự tải `livekit-client` (UMD) qua CDN lúc chạy, xin token tại `POST /api/rtc/token {meetingId}` rồi vào phòng `meeting-<meetingId>`.

### Cách 1 — LiveKit Cloud (khuyến nghị cho pilot)

Nhanh nhất, **không phải tự lo cổng UDP/TURN/TLS**:
1. Tạo project tại <https://cloud.livekit.io> (có mức dùng thử miễn phí).
2. Lấy **Project URL** (dạng `wss://<project>.livekit.cloud`) + **API Key/Secret**.
3. Điền 3 biến trên vào `deploy/.env`, khởi động lại `api`. Xong — không cần chạy service media nào.

### Cách 2 — Tự host LiveKit (self-host)

Bỏ comment service `livekit` trong `deploy/docker-compose.pilot.yml`, tạo `deploy/livekit.yaml`:

```yaml
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true          # cần khi máy chủ sau NAT/cloud
keys:
  # PHẢI trùng LIVEKIT_API_KEY/SECRET mà backend dùng để mint token
  <api-key>: <api-secret>
turn:
  enabled: true                  # TURN tích hợp cho client sau NAT chặt
```

Rồi:
- Trỏ **subdomain riêng** (vd `rtc.<domain>`) về máy chủ và đặt `LIVEKIT_URL=wss://rtc.<domain>`.
- **Mở firewall**: `7880/tcp` (signaling), `7881/tcp` (TURN/TLS), và **dải `50000-60000/udp`** (luồng media). Đây là điểm khác biệt lớn so với web thường — media UDP **không** đi qua reverse proxy được.
- Khuyến nghị chạy LiveKit với `network_mode: host` để nắm dải cổng UDP hiệu quả.

### Giới hạn / lưu ý

- **Cổng UDP + TURN**: WebRTC cần media UDP; máy trạm sau NAT/tường lửa chặt phải có TURN (LiveKit Cloud lo sẵn; self-host bật `turn.enabled`).
- **WSS bắt buộc**: trình duyệt chỉ cho camera/micro trên ngữ cảnh bảo mật (HTTPS/WSS) — dùng domain có TLS.
- **Bản demo nhúng (sandbox/iframe) vẫn là mô phỏng**: môi trường phát triển nhúng chặn `getUserMedia`; do đó video đa điểm cầu **không** kiểm thử được trong sandbox — chỉ chạy thật khi triển khai có LiveKit + trình duyệt cho phép camera.
- Backend **không thêm dependency npm**: access token LiveKit được tự ký (JWT HS256) bằng `node:crypto` trong `server/src/rtc.js`.

## 7. PWA (cài như ứng dụng)

Truy cập bằng Chrome/Edge → biểu tượng **Cài đặt** trên thanh địa chỉ → app chạy cửa sổ riêng trên máy tính/máy tính bảng. (`manifest.webmanifest` + `sw.js`; service worker chỉ kích hoạt khi chạy HTTPS.)

## 8. Lộ trình tiếp theo (đề xuất)

| Hạng mục | Giải pháp đề xuất |
|---|---|
| ~~Realtime đẩy sự kiện~~ | ✅ **ĐÃ CÓ (GĐ3)** — WebSocket RFC 6455 tự viết, poke-then-pull, keepalive, tự kết nối lại |
| ~~Endpoint nghiệp vụ + rate-limit + refresh token~~ | ✅ **ĐÃ CÓ (GĐ4)** — /api/actions kiểm tra sâu, guard CRUD, chống brute-force, phiên xoay vòng |
| Chuẩn hóa CSDL | Tách dần bảng JSONB thành bảng quan hệ cho thực thể nóng (ballots, participants) khi quy mô lớn |
| Lưu trữ tài liệu lớn | MinIO (S3-compatible), virus scan, streaming (thay base64 trong JSONB) |
| Đăng nhập nâng cao | Refresh token, SSO/LDAP cơ quan, 2FA |
| Ký số thật | VNPT SmartCA / USB token (plugin ký hash phía client), chữ ký chuẩn PAdES |
| ~~Họp trực tuyến~~ | ✅ **ĐÃ CÓ** — WebRTC thật qua LiveKit (SFU): camera/mic/chia sẻ màn hình, gated bằng cấu hình, fallback mô phỏng an toàn (xem mục 6) |
| Thông báo đa kênh | Email (SMTP), SMS Brandname, Web Push |
| Bảo mật | Phân quyền chi tiết theo tài liệu mật, mã hóa at-rest, nhật ký bất biến, rate-limit |

## 9. Giới hạn hiện tại

- **Chế độ demo trình duyệt**: dữ liệu mỗi máy một bộ (localStorage), tệp ≤ 1,5MB, realtime giả lập; họp trực tuyến luôn là mô phỏng
- **Chế độ máy chủ (GĐ2–GĐ4)**: dữ liệu tập trung PostgreSQL, JWT 1h + refresh token xoay vòng, phân quyền server-side + endpoint nghiệp vụ kiểm tra sâu + guard CRUD + rate-limit; **realtime WebSocket** (polling chỉ là dự phòng); tệp ≤ 15MB (base64 trong JSONB)
- **Họp trực tuyến WebRTC (LiveKit)**: hoạt động thật khi đã cấu hình `LIVEKIT_*` + trình duyệt cho phép camera/micro (xem mục 6). Chưa cấu hình / bị chặn quyền → tự dùng giao diện mô phỏng.
- Ký số/QR vẫn là mô phỏng ở cả hai chế độ (GĐ3)
- **API công bố cho bên thứ 3**: hoạt động ở **chế độ máy chủ** (cần `VITE_API_URL`); chế độ demo trình duyệt chỉ minh họa quản lý khóa cục bộ, không phục vụ endpoint mở

### Sẵn sàng IPv6

| Tầng | Trạng thái | Ghi chú |
|---|---|---|
| `nginx.conf` (frontend + proxy `/api`) | ✅ Dual-stack | Đã thêm `listen [::]:80;` cạnh `listen 80;`. |
| Caddy (`deploy/Caddyfile`, `deploy/Caddyfile.internal`, và service `caddy` mới trong `docker-compose.dotnet.yml` mục 11) | ✅ Dual-stack (mặc định) | Caddy tự lắng nghe mọi interface (gồm IPv6) khi site block không chỉ định host cụ thể — không cần cấu hình thêm. |
| API Node (`server/src/index.js`, `server.listen(PORT)`) | ✅ Dual-stack (mặc định Node) | Không truyền host cụ thể → Node bind `::` theo mặc định trên hầu hết hệ điều hành. |
| **API .NET (`server-dotnet/ECabinet.Api/Program.cs`)** | 🔴 **IPv4-only tường minh** | `Environment.SetEnvironmentVariable("ASPNETCORE_URLS", $"http://0.0.0.0:{port}")` ép Kestrel chỉ bind IPv4 — **không tự động dual-stack**. Vì `api` thường chỉ được `web`/nginx hoặc Caddy gọi nội bộ (không expose thẳng ra ngoài trong cấu hình mặc định), tác động tới client bên ngoài là thấp, nhưng đây là gap thật cần khắc phục trong `server-dotnet/` (ngoài phạm vi sửa của cập nhật này) trước khi công bố "IPv6-ready toàn hệ thống" — thay `0.0.0.0` bằng `[::]` hoặc bỏ trống `ASPNETCORE_URLS` cụ thể hostbind để Kestrel tự dual-stack. |
| Cổng publish Docker (`ports: "8080:80"` v.v.) | 🟡 Phụ thuộc Docker daemon | Docker publish cổng ra cả IPv4 và IPv6 chỉ khi daemon có bật IPv6 (`ipv6: true` trong `/etc/docker/daemon.json`) — đây là cấu hình hạ tầng máy chủ, không phải thứ compose file tự quyết định được. |

---

## 10. API công bố cho bên thứ 3 (LGSP-ready)

Bộ API REST chia sẻ **dữ liệu cuộc họp** cho các hệ thống khác của thành phố (E-HSMT mục **54–59**), sẵn sàng đấu nối **Nền tảng tích hợp và chia sẻ dữ liệu LGSP**. Quản trị tại menu **Quản trị hệ thống → API & Tích hợp** (3 tab: Khóa API · Danh mục API · Đấu nối LGSP). *Chỉ phục vụ ở chế độ máy chủ.*

### Xác thực
Mọi endpoint nghiệp vụ yêu cầu **khóa API** gửi qua header:

```
X-API-Key: ecab_xxxxxxxx...            # hoặc:  Authorization: ApiKey ecab_xxxx...
```

Khóa do admin cấp (endpoint `POST /api/apikeys/create`, key sinh **phía máy chủ**, chỉ hiện **1 lần** — hệ thống chỉ lưu **SHA-256**, không lưu key thô). Mỗi khóa có phạm vi (**scope**): `meetings` và/hoặc `documents`; có thể **thu hồi** tức thời. Rate-limit theo khóa (mặc định 120 lượt/phút — env `OPEN_RATE_MAX`). Phản hồi **JSON UTF-8**, thời gian **ISO 8601**, phân trang `?page=1&size=20` (tối đa 100/trang), CORS mở cho GET.

### 6 endpoint (mục 54–59)

| Mục | Method | Đường dẫn | Quyền | Mô tả |
|---|---|---|---|---|
| 54 | GET | `/api/open/v1/units/{unitId}/meetings/upcoming` | meetings | DS cuộc họp **đơn vị sắp diễn ra** |
| 55 | GET | `/api/open/v1/users/{userId}/meetings/upcoming` | meetings | DS cuộc họp **cá nhân sắp diễn ra** |
| 56 | GET | `/api/open/v1/units/{unitId}/meetings/past` | meetings | DS cuộc họp **đơn vị đã diễn ra** |
| 57 | GET | `/api/open/v1/users/{userId}/meetings/past` | meetings | DS cuộc họp **cá nhân đã diễn ra** |
| 58 | GET | `/api/open/v1/meetings/{id}` | meetings | **Thông tin cuộc họp** (meta + chương trình + thành phần + thống kê biểu quyết) |
| 59 | GET | `/api/open/v1/meetings/{id}/documents` | documents | **DS tài liệu** đã duyệt & không mật (kèm `contentUrl`) |

Phụ trợ: `GET /api/open/v1/documents/{id}/content` (tải nội dung tài liệu — scope `documents`); `GET /api/open/v1/spec` (**OpenAPI 3.0** tự sinh, công khai — đăng ký dịch vụ trên LGSP); `GET /api/open/v1/health` (thăm dò, cần khóa).

> Mục 58 (58) còn gồm **"quản lý mô tả API"** — trang **Danh mục API** hiển thị mô tả/tham số từng endpoint + ví dụ curl + nút tải OpenAPI JSON.

### Bảo mật dữ liệu
API **KHÔNG** trả biên bản, kết luận chi tiết hay phiếu biểu quyết cá nhân; tài liệu chỉ gồm bản **đã duyệt** và **không mật**.

### Ví dụ (curl)

```bash
curl -H "X-API-Key: ecab_demo_qlvb_2026" \
  "https://<host>/api/open/v1/units/un-vp/meetings/upcoming?page=1&size=20"

curl -H "X-API-Key: ecab_demo_qlvb_2026" \
  "https://<host>/api/open/v1/meetings/m1/documents"

# Đặc tả OpenAPI (không cần khóa):
curl "https://<host>/api/open/v1/spec"
```

*(Khóa demo `ecab_demo_qlvb_2026` chỉ dùng thử — cấp khóa mới khi triển khai thật.)*

---

## 11. Backend .NET 8 + SQL Server (đáp ứng nền tảng E-HSMT)

Bên cạnh backend Node.js (`server/`), dự án có **backend thứ hai viết bằng ASP.NET Core 8 + Microsoft SQL Server** tại thư mục **`server-dotnet/`**, port **1:1** từ bản Node hướng tới đáp ứng yêu cầu nền tảng của E-HSMT (**.NET + SQL Server 2022 + Windows Server**). Ba yêu cầu nền tảng này đang ở **3 mức kiểm chứng khác nhau** — trình bày tách riêng để tránh gộp chung thành một câu khẳng định:

| Nền tảng yêu cầu (E-HSMT) | Trạng thái | Bằng chứng / việc cần làm thêm |
|---|---|---|
| **.NET 8** | ✅ **Đã có, đã kiểm chứng** | Build 0 lỗi + **143/143 test PASS** qua `Microsoft.AspNetCore.TestHost` (in-memory, không mở socket) — xem mục "Kiểm thử". Đã chạy thật tại `https://ecabinet.vhpdata.com`. |
| **MS SQL Server 2022** | ✅ **Đã chạy thật, đã kiểm chứng (20/07/2026)** | Triển khai thật tại `https://ecabinet.vhpdata.com` — `/health` trả `{"db":"sqlserver","realtimeClients":2}` (chạy `SqlServerDocStore` trên SQL Server 2022 thật, KHÔNG phải InMemory); đăng nhập JWT + realtime WebSocket hoạt động; chủ dự án báo load test 90 CCU PASS. Chạy bằng `DB_PASSWORD='...' docker compose -f docker-compose.dotnet.yml up -d --build`. |
| **Windows Server + IIS** | 🟡 **Nền tảng .NET+MSSQL đã chạy thật (qua Docker); IIS chưa kiểm chứng** | Bản `ecabinet.vhpdata.com` chạy Docker Compose .NET (Linux image). Nếu HSMT bắt buộc ĐÚNG Windows Server + IIS: mục "Triển khai Windows Server + IIS" dưới đây là 6 bước outline, cần triển khai thử trên Windows thật để có `web.config`/publish profile làm bằng chứng. |

**Cách đọc bảng trên:** ".NET ✅" là phần đã có bằng chứng thực thi mạnh nhất (build + test tự động). "MSSQL 🟡" và "Windows Server 🔴" là phần **framework/code đã viết đúng theo tài liệu kỹ thuật** nhưng **chưa có lần chạy thành công nào được ghi nhận** trên đúng hạ tầng đó — đây là khoảng cách giữa "code tương thích" và "đã triển khai/kiểm thử" cần làm rõ với chủ đầu tư trước khi coi là "đáp ứng đầy đủ".

### Vì sao có 2 backend?
- **`server/` (Node.js + PostgreSQL/PGlite)** — bản gốc, dùng làm **nguồn chân lý** hợp đồng API.
- **`server-dotnet/` (ASP.NET Core 8 + SQL Server 2022)** — bản port đáp ứng hạ tầng bắt buộc của hồ sơ mời thầu (E-HSMT): nền tảng .NET, CSDL MS SQL Server 2022, chạy trên Windows Server.

**API contract giống hệt nhau** (đường dẫn, method, mã lỗi + thông điệp tiếng Việt, shape JSON, đường WebSocket `/api/realtime` + message `{type:'change',collection,action,id,at}`). **Frontend React không đổi một dòng** — chỉ đổi backend phía sau. Chọn **một** backend để chạy (không chạy song song cùng dữ liệu).

### Kiến trúc `server-dotnet/`
```
server-dotnet/
├── ECabinet.sln
├── ECabinet.Api/                # API (gói NuGet ngoài shared framework: CHỈ Microsoft.Data.SqlClient)
│   ├── Program.cs               # entrypoint (listen 0.0.0.0:PORT, mặc định 3000)
│   ├── App.cs                   # lắp ráp pipeline + route (port index.js)
│   ├── Http/{HttpUtil,Router}.cs# router tối giản (port router.js) + tiện ích HTTP
│   ├── Auth.cs                  # JWT HS256 + mật khẩu PBKDF2 (port auth.js)
│   ├── Sessions.cs              # refresh token xoay vòng (port sessions.js)
│   ├── RateLimit.cs             # rate-limit cửa sổ trong bộ nhớ (port ratelimit.js)
│   ├── Acl.cs                   # ma trận ACL + allowed() (port acl.js)
│   ├── Access.cs                # lọc quyền đọc theo bản ghi (port access.js)
│   ├── Guard.cs                 # validatePatch + guardPatch (port guard.js)
│   ├── Actions.cs               # /api/actions nghiệp vụ + CAS (port actions.js)
│   ├── Rtc.cs                   # /api/rtc config + mint LiveKit token (port rtc.js)
│   ├── OpenApiCatalog.cs        # CATALOG + OpenAPI 3.0 (port openapi.js)
│   ├── OpenRoutes.cs            # bộ API mở /api/open/v1 (port open.js)
│   ├── Ws.cs                    # WebSocket /api/realtime (port ws.js)
│   ├── Seed.cs                  # nạp seed.json (dùng chung nội dung với frontend)
│   ├── Store/                   # IDocStore + InMemoryDocStore + SqlServerDocStore + CAS
│   └── seed.json               # sinh từ server/src/seed.mjs
└── ECabinet.Tests/              # runner console (TestHost in-memory) — `dotnet run`
```

### Chạy nhanh (dev — InMemory, không cần SQL Server)
```bash
export PATH=/path/to/.dotnet:$PATH        # cần .NET SDK 8
cd server-dotnet
dotnet run --project ECabinet.Api          # API tại http://localhost:3000 (kho InMemory + seed)
```
Không đặt `DATABASE_URL` → chạy kho **InMemory** (parity chế độ PGlite của bản Node; dev/test không cần cài DB). `/health` trả `"db":"inmemory"`.

### Chạy với SQL Server thật
```bash
DATABASE_URL="Server=localhost,1433;Database=ecabinet;User Id=sa;Password=<mật-khẩu-mạnh>;TrustServerCertificate=True" \
  JWT_SECRET='chuoi-bi-mat-dai' dotnet run --project ECabinet.Api
```
`/health` trả `"db":"sqlserver"`. Ứng dụng **tự tạo bảng + nạp seed** lần đầu.

**Chuỗi kết nối** (SqlClient): `Server=<host>,1433;Database=ecabinet;User Id=sa;Password=<...>;TrustServerCertificate=True`. Dùng `TrustServerCertificate=True` với chứng thư tự ký nội bộ; triển khai thật nên cấp chứng thư hợp lệ và cân nhắc tài khoản SQL riêng thay `sa`.

### Docker Compose (biến thể .NET + SQL Server)
```bash
DB_PASSWORD='Ecabinet#2026' docker compose -f docker-compose.dotnet.yml up -d --build
# → http://localhost:8081   (đăng nhập chutich / 123456)
```
3 service mặc định (không đổi so với trước): `web` (frontend build `VITE_API_URL=/api`, nginx proxy `/api` → `api:3000`, cổng **8081**), `api` (ASP.NET Core 8), `db` (**mcr.microsoft.com/mssql/server:2022-latest**, Express, volume `ecabinet_mssql`, healthcheck `sqlcmd -C`). **Lưu ý: SQL Server 2022 cần ~2GB RAM cho container `db`.**

### TLS cho biến thể .NET (tùy chọn — service `caddy`, profile `tls`)

Mặc định `docker-compose.dotnet.yml` phục vụ **HTTP thuần** qua cổng 8081 (phù hợp dev/demo nội bộ). Để bật **HTTPS tự động** (Let's Encrypt hoặc TLS tự ký nội bộ) cho môi trường production, file compose có thêm service `caddy` mô phỏng đúng cơ chế của `deploy/Caddyfile` (bản pilot Node) — **tắt theo mặc định** qua [Docker Compose profile](https://docs.docker.com/compose/how-tos/profiles/) `tls`, không ảnh hưởng gì khi không bật:

```bash
# Bật TLS (Let's Encrypt — cần DOMAIN công khai trỏ về máy chủ, mở cổng 80/443):
DOMAIN=ecabinet.example.gov.vn ACME_EMAIL=cntt@example.gov.vn \
  DB_PASSWORD='Ecabinet#2026' \
  docker compose -f docker-compose.dotnet.yml --profile tls up -d --build
# → https://ecabinet.example.gov.vn (Caddy tự xin/gia hạn chứng chỉ)

# Mạng nội bộ / air-gapped (không có Internet để xin Let's Encrypt) — TLS tự ký:
DOMAIN=ecabinet.noi-bo.local CADDY_TLS_MODE=internal \
  DB_PASSWORD='Ecabinet#2026' \
  docker compose -f docker-compose.dotnet.yml --profile tls up -d --build
```

Caddy reverse proxy vào `web:80`, hỗ trợ nâng cấp **WebSocket** (`/api/realtime`) mặc định (không cần khai báo thêm — nginx trong `web` đã có location xử lý header `Upgrade`, xem `nginx.conf`). Không truyền `--profile tls` → service `caddy` **không được tạo**, hành vi & cổng 8081 HTTP thuần giữ **nguyên như trước**.

### Bảng parity (Node ⇄ .NET)
| Thành phần | `server/` (Node) | `server-dotnet/` (.NET) |
|---|---|---|
| Runtime | Node.js ≥ 20 | ASP.NET Core 8 |
| CSDL | PostgreSQL / PGlite | SQL Server 2022 / InMemory |
| Lưu trữ | bảng JSONB `(id,data,updated_at)` | bảng `NVARCHAR(MAX)` `ISJSON` + `(id,data,updated_at)` |
| CAS chống mất ghi | `UPDATE … WHERE data = data_cũ` (jsonb) | `UPDATE … WHERE data = @old` (chuỗi JSON) + retry |
| JWT | HS256 (node:crypto) | HS256 (HMACSHA256 + base64url) — **tương thích** |
| Mật khẩu | scrypt | **PBKDF2-SHA256** (xem ghi chú độ lệch) |
| Refresh token | băm SHA-256, xoay vòng | băm SHA-256, xoay vòng |
| WebSocket | RFC 6455 tự viết | WebSocket tích hợp ASP.NET — **cùng đường `/api/realtime`, cùng message** |
| Rate-limit | cửa sổ trong bộ nhớ | cửa sổ trong bộ nhớ |
| API mở /health db | `postgresql`/`pglite` | `sqlserver`/`inmemory` |

### Ghi chú độ lệch chủ đích: mật khẩu PBKDF2 (thay scrypt)
.NET BCL không có `scrypt`, nên bản .NET băm mật khẩu bằng **PBKDF2-SHA256** (`Rfc2898DeriveBytes`, **210.000 vòng**, salt 16 byte), định dạng lưu `pbkdf2$<số-vòng>$<saltBase64>$<hashBase64>`. Vì **seed hash lại mật khẩu** bằng chính hàm này khi nạp, **không cần migrate** — hai backend có CSDL độc lập. Phần JWT vẫn **tương thích** (cùng HS256). Đây là **độ lệch có chủ đích duy nhất** so với bản Node.

### CORS cho ứng dụng di động (Capacitor/Ionic)
Ngoài hành vi CORS như bản Node (`CORS_ORIGIN`, mặc định `*`), bản .NET còn cho phép thêm origin qua **`CORS_ORIGINS`** (nhiều origin, phân tách bằng dấu phẩy) và **mặc định cho phép** các origin app di động **`capacitor://localhost`, `ionic://localhost`, `http://localhost`** (echo lại đúng origin). Tắt phần mobile bằng **`MOBILE_CORS=off`**.

### Kiểm thử (tiêu chí nghiệm thu)
```bash
cd server-dotnet
dotnet build ECabinet.sln                   # 0 error
dotnet run --project ECabinet.Tests         # in bảng PASS/FAIL 7 nhóm; exit != 0 nếu có ca lỗi
```
Test chạy **in-memory bằng Microsoft.AspNetCore.TestHost** (KHÔNG mở socket) — bao phủ 7 nhóm: AUTH, ACL, ACCESS, GUARD, ACTIONS/CAS, OPEN+RTC, WS (≥55 ca). Kho `InMemoryDocStore` được dùng cho test; lớp `SqlServerDocStore` viết theo cú pháp SqlClient chuẩn nhưng **chưa kiểm thử trên SQL Server thật** trong môi trường sandbox (không có sẵn instance MSSQL) — cần chạy compose để kiểm thử tích hợp thật.

### Triển khai Windows Server + IIS + SQL Server (outline)
1. Cài **.NET 8 Hosting Bundle** (ASP.NET Core Module) + **IIS** (role Web Server) trên Windows Server.
2. Cài **SQL Server 2022** (Standard cho sản xuất, hoặc Express cho quy mô nhỏ); tạo database `ecabinet` + tài khoản SQL (khuyến nghị tài khoản riêng, không dùng `sa`).
3. `dotnet publish ECabinet.Api -c Release -o C:\inetpub\ecabinet-api` (hoặc build từ `server-dotnet/Dockerfile`).
4. Tạo IIS **Site/App Pool** (No Managed Code) trỏ vào thư mục publish; đặt biến môi trường `DATABASE_URL`, `JWT_SECRET`, `LIVEKIT_*` (Configuration Editor hoặc `web.config`/`environmentVariables`).
5. Reverse proxy: IIS phục vụ frontend build (`dist/`) + proxy `/api` (kể cả nâng cấp **WebSocket** — bật tính năng *WebSocket Protocol* của IIS) sang site API.
6. Sản xuất: cấp **chứng thư TLS hợp lệ** (bỏ `TrustServerCertificate` nếu dùng CA nội bộ tin cậy), bật sao lưu SQL định kỳ, chạy API dưới tài khoản dịch vụ tối thiểu quyền.

### Sao lưu / phục hồi SQL Server (biến thể .NET)

Đối tác của `deploy/backup.sh`/`restore.sh` (PostgreSQL, mục 5) cho biến thể MSSQL — vá gap "sao lưu/phục hồi chỉ có cho PostgreSQL":

```bash
# Sao lưu (BACKUP DATABASE qua sqlcmd trong container `db`, copy .bak ra host, nén,
# xoay vòng giữ KEEP bản — mặc định 14):
DB_PASSWORD='Ecabinet#2026' ./deploy/backup-mssql.sh
# → deploy/backups-mssql/ecabinet-YYYYmmdd-HHMMSS.bak.gz

# Khôi phục (RESTORE DATABASE ... WITH REPLACE — CẢNH BÁO ghi đè toàn bộ dữ liệu hiện tại):
DB_PASSWORD='Ecabinet#2026' ./deploy/restore-mssql.sh deploy/backups-mssql/ecabinet-YYYYmmdd-HHMMSS.bak.gz
```

Biến môi trường: `DB_PASSWORD` (mật khẩu SA, bắt buộc), `KEEP` (số bản giữ lại, mặc định 14), `DB_NAME` (mặc định `ecabinet`), `COMPOSE_FILE` (mặc định `docker-compose.dotnet.yml`). Cài cron sao lưu tự động tương tự bản Postgres (xem `deploy/pilot.sh`):
```bash
(crontab -l 2>/dev/null; echo "0 2 * * * DB_PASSWORD='Ecabinet#2026' $(pwd)/deploy/backup-mssql.sh >> $(pwd)/deploy/backups-mssql/backup.log 2>&1") | crontab -
```

**Diễn tập khôi phục (DR drill) — chứng minh RTO ≤24h bằng số liệu:** `deploy/test-restore.sh mssql` (hoặc `postgres` cho bản Node) tự sao lưu → khôi phục vào database TẠM riêng (không đụng DB đang chạy) → đối chiếu số bản ghi từng bảng → in PASS/FAIL kèm thời gian từng bước. Quy trình DR đầy đủ (phát hiện → phân tích ≤8h → khôi phục ≤24h → báo cáo) và lịch diễn tập định kỳ: xem **[`docs/dr-runbook.md`](docs/dr-runbook.md)**.

> **Chưa chạy thử trong sandbox** (không có Docker daemon) — cả 2 script mới (`backup-mssql.sh`, `restore-mssql.sh`) và `test-restore.sh` chỉ đã kiểm `bash -n` (cú pháp hợp lệ). Cần chạy thật trên máy có Docker + SQL Server để xác nhận logic T-SQL (`RESTORE FILELISTONLY`, `WITH MOVE`) — xem `docs/dr-runbook.md` mục "Chưa kiểm chứng".

### Giới hạn HA hiện tại

Hai cơ chế sau đang dùng **state tĩnh trong 1 tiến trình** (per-process), KHÔNG chia sẻ giữa nhiều instance:

- **Rate-limit** (`RateLimit.cs` bản .NET / `ratelimit.js` bản Node): đếm request theo IP bằng cấu trúc trong bộ nhớ (`ConcurrentDictionary`/`Map`), không qua DB/cache chia sẻ.
- **WebSocket realtime** (`Ws.cs` / `ws.js`): danh sách client đang kết nối lưu trong bộ nhớ của đúng tiến trình đó.

**Hệ quả khi triển khai nhiều instance Web/App-Server sau load balancer** (đúng mô hình HA mà HSMT đề xuất — "Web-Server ×2", "App-Server ×2"):
1. Rate-limit theo IP không đồng bộ giữa các instance — giảm hiệu quả chống brute-force (không phải lỗi nghiệp vụ, chỉ giảm mức bảo vệ khi client bị load-balance sang các instance khác nhau).
2. **Client A kết nối WebSocket vào instance 1 sẽ không nhận được broadcast từ một ghi CRUD xảy ra ở instance 2** — tính năng realtime "đẩy sự kiện" hoạt động không đầy đủ trong cấu hình multi-instance.

Refresh-token/session (`Sessions.cs`/`sessions.js`) **không có gap này** vì đã lưu qua CSDL (`IDocStore`/`c_sessions`), không phải state trong bộ nhớ.

**Đường nâng cấp đề xuất (chưa triển khai — cần thực hiện trước khi chạy đa instance thật):**
- Chuyển rate-limit sang lưu đếm trong **Redis** (hoặc cache chia sẻ tương đương) thay cho bộ nhớ tiến trình.
- Chuyển WebSocket broadcast sang **Redis Pub/Sub** (mỗi instance subscribe kênh chung, publish khi có thay đổi) — hoặc dùng **sticky session** ở load balancer làm giải pháp tạm (đơn giản hơn nhưng không giải quyết tận gốc: client vẫn chỉ nhận realtime từ đúng 1 instance, các ghi từ instance khác cần cơ chế đồng bộ riêng nếu không dùng Pub/Sub).

*(Mục này chỉ ghi nhận hiện trạng và đường nâng cấp — không sửa code trong lần cập nhật này.)*

---

© 2026 — eCabinet demo, xây dựng theo mô hình chức năng VNPT eCabinet (phòng họp không giấy).
