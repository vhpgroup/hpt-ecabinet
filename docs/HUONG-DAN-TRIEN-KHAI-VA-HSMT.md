# HƯỚNG DẪN TRIỂN KHAI TRÊN MÁY THẬT + CHECKLIST ĐÁP ỨNG HSMT
*eCabinet (HPT TECH) — cập nhật 20/07/2026. Dùng cho đội triển khai/vận hành.*

> Gói tham chiếu: "Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu" (HSMT Sở KH&CN Hải Phòng). Yêu cầu nền tảng: **.NET + MS SQL Server 2022 + Windows Server**, đặt tại Trung tâm dữ liệu TP, ≥500 user/90 CCU, ATTT cấp độ 3, HTTPS TLS 1.2+.

---

## PHẦN A — CHẠY TRÊN MÁY THẬT

### A0. Yêu cầu tối thiểu máy chủ
| Thành phần | Tối thiểu (pilot 1 đơn vị) | Khuyến nghị (toàn TP, 500 user/90 CCU) |
|---|---|---|
| CPU | 4 vCPU | 8–16 vCPU (API) + 8–16 vCPU (SQL) |
| RAM | 8 GB (riêng SQL Server 2022 cần ≥2GB) | 32–64 GB |
| Ổ đĩa | 100 GB SSD | 500 GB–1 TB SSD (tài liệu + video tích lũy 60 tháng) |
| HĐH | Ubuntu 22.04 (Docker) hoặc Windows Server 2019+ | Theo HSMT: Windows Server + SQL Server 2022 |
| Phần mềm | Docker + Docker Compose (bản Linux) HOẶC .NET 8 Hosting Bundle + IIS + SQL Server (bản Windows) | — |

### A1. Cách nhanh nhất — Docker Compose bản .NET + SQL Server 2022 (ĐÚNG nền tảng HSMT)
Trên máy đã cài Docker:
```bash
git clone https://github.com/vhpgroup/hpt-ecabinet.git
cd hpt-ecabinet

# Chạy full-stack .NET 8 + SQL Server 2022 (KHÔNG TLS, cổng 8081 HTTP):
DB_PASSWORD='Ecabinet#2026_DoiMatKhauNay' \
JWT_SECRET='chuoi-bi-mat-that-dai-ngau-nhien-64-ky-tu' \
  docker compose -f docker-compose.dotnet.yml up -d --build
```
- Truy cập: `http://<IP-máy-chủ>:8081` — đăng nhập `chutich / 123456` (đổi mật khẩu ngay sau khi chạy thật).
- 3 service: `web` (nginx + React), `api` (ASP.NET Core 8), `db` (SQL Server 2022 Express, volume `ecabinet_mssql`).
- Lần đầu chạy: API **tự tạo bảng + nạp dữ liệu mẫu**. SQL Server 2022 cần ~2GB RAM cho container `db`.
- Kiểm tra sức khỏe: `curl http://localhost:8081/api/health` → phải trả `"db":"sqlserver"`.

> **Đây là bước bắt buộc để biến "🟡 MSSQL mã sẵn sàng" thành "✅ đã kiểm chứng trên instance thật"** — môi trường phát triển không có Docker/MSSQL nên chưa chạy được; chạy lệnh trên là xác nhận `SqlServerDocStore` hoạt động đúng (tạo bảng, CAS chống mất phiếu, seed).

*(Bản demo nhanh Node + PostgreSQL — chỉ để xem thử, KHÔNG dùng dự thầu: `docker compose up -d --build` → cổng 8080.)*

### A2. Bật HTTPS (bắt buộc theo HSMT — TLS 1.2+)
Có tên miền trỏ về máy chủ (vd `ecabinet.haiphong.gov.vn`):
```bash
DOMAIN=ecabinet.haiphong.gov.vn ACME_EMAIL=cntt@haiphong.gov.vn \
DB_PASSWORD='...' JWT_SECRET='...' \
  docker compose -f docker-compose.dotnet.yml --profile tls up -d --build
```
- Caddy tự xin chứng chỉ Let's Encrypt, tự gia hạn, hỗ trợ WebSocket. Truy cập `https://<DOMAIN>`.
- Nếu dùng chứng chỉ do TP cấp (CA nội bộ): thay cấu hình trong `deploy/Caddyfile` hoặc đặt sau thiết bị cân bằng tải/WAF của Trung tâm dữ liệu.
- Sau khi TLS chạy ổn, có thể gỡ cổng 8081 HTTP thuần (khối `ports` của service `web`) để chỉ còn HTTPS.

### A3. Bật họp trực tuyến LiveKit (video thật — ĐÃ kiểm chứng kết nối 18/07)
Mặc định trang Họp trực tuyến chạy mô phỏng. Để bật video THẬT, đặt 3 biến môi trường cho service `api`:
```bash
LIVEKIT_URL=wss://<project>.livekit.cloud
LIVEKIT_API_KEY=<api-key>
LIVEKIT_API_SECRET=<api-secret>
```
- Nhanh nhất: tạo project miễn phí tại https://cloud.livekit.io (không phải tự lo cổng UDP/TURN).
- Kiểm tra: `GET /api/rtc/config` trả `{"enabled":true}`. Hai người ở 2 thiết bị có camera vào cùng phiên họp → trang Họp trực tuyến → cấp quyền camera/mic.
- Self-host tại TTDL TP (khuyến nghị vận hành chính thức để không gửi media qua bên thứ 3 — xem `docs/livekit-va-du-lieu.md`): mở cổng `7880/tcp`, `7881/tcp`, dải `50000-60000/udp`.
- ⚠️ Nếu đã từng dán API secret ở đâu (chat/email) → **xoay key mới** trên LiveKit Cloud trước khi vận hành.

### A3.1. Bật object storage MinIO/S3 — tách tệp đính kèm khỏi CSDL (mô hình "Cụm Server-File" của HSMT)
Mặc định nội dung tệp lưu base64 ngay trong CSDL (tương thích ngược). Để **tách tệp sang object storage** (chống phình DB, đúng mô hình Cụm Server-File tách khỏi Cụm Server-Database), tạo file `.env` cạnh `docker-compose*.yml`:
```env
MINIO_USER=ecabinet
MINIO_PASSWORD=<mật-khẩu-mạnh>
S3_ENDPOINT=http://minio:9000
S3_BUCKET=ecabinet-docs
S3_ACCESS_KEY=ecabinet            # = MINIO_USER
S3_SECRET_KEY=<mật-khẩu-mạnh>     # = MINIO_PASSWORD
S3_FORCE_PATH_STYLE=true
# CORS cho hop TRÌNH DUYỆT→MinIO (đường XEM tài liệu — xem giải thích 2 chế độ bên dưới).
# Mặc định '*' (dễ dựng); VẬN HÀNH nên đặt = origin THẬT của web:
MINIO_CORS_ORIGIN=https://ecabinet.<tỉnh>.gov.vn
```
- Compose (Node hoặc .NET) sẽ khởi động thêm `minio` + `minio-init` (tạo bucket **private** một lần). Console MinIO: `http://<máy-chủ>:9001`. Service `minio` nhận `MINIO_API_CORS_ALLOW_ORIGIN=${MINIO_CORS_ORIGIN:-*}`.
- **GATED**: bỏ trống các biến `S3_*` → giữ hành vi base64-trong-DB như cũ (KHÔNG vỡ demo/dev). Điền đủ → tệp MỚI tách sang S3, DB chỉ lưu `storageKey`; bản ghi cũ vẫn đọc được.
- **Đường TẢI/XEM tệp — 2 chế độ (điểm chốt đợt 3):**
  - **`redirect` (mặc định):** endpoint `GET /api/documents/:id/download` (và `/api/guides/:id/download`, LGSP `/content`) trả **302 → presigned URL** để trình duyệt/consumer tải **THẲNG từ MinIO** — backend **0 byte** tệp vào RAM (tối ưu băng thông). Hop trình duyệt→MinIO là **cross-origin** nên MinIO PHẢI mở **CORS** (`MINIO_CORS_ORIGIN`) thì `fetch` của FE mới đọc được Blob.
  - **`stream`:** backend tự kéo bytes từ MinIO rồi trả (same-origin, KHÔNG cần CORS MinIO). Dùng khi MinIO chỉ nằm trong mạng nội bộ/sau proxy (client không tới được S3 trực tiếp), hoặc khi chưa kịp mở CORS. Bật toàn cục bằng `S3_DOWNLOAD_MODE=stream`, hoặc theo từng yêu cầu bằng query `?mode=stream` (query **ưu tiên hơn** env).
  - **FE tự chống lỗi:** đường XEM (`src/services/fileContent.ts`) fetch `/download` kèm `Authorization`, tự theo 302 sang MinIO; nếu hop→MinIO lỗi (chưa mở CORS/mạng chặn) → **tự fallback** gọi lại `?mode=stream` (same-origin) nên **luôn xem được**, kể cả khi CORS chưa cấu hình.
- **Đường XEM dùng `contentUrl` (không base64):** khi bật S3, `GET /api/documents/:id` và danh sách trả field **`contentUrl`** (vd `/api/documents/<id>/download`) thay cho `dataUrl` base64 → backend KHÔNG dựng lại base64 lúc mở tài liệu (đỡ RAM). Khóa S3 (`storageKey`) không lộ ra client. **Escape khẩn** `S3_INLINE_READ=on` → khôi phục hành vi cũ (GET dựng lại `dataUrl`) cho tình huống cần. Bản ghi cũ còn `dataUrl` trong DB vẫn trả `dataUrl` (tương thích).
- **Bảo mật giữ nguyên:** endpoint tải kiểm quyền đọc Y HỆT `GET :id` (tài liệu mật/lọc quyền → 404) **trước** khi cấp presigned; TTL presigned ngắn (mặc định 300s, `S3_PRESIGN_TTL`); KHÔNG log URL đã ký.
- **Kiểm chứng nhanh** (sau khi tải 1 tài liệu): bản ghi trong DB có `storageKey` và KHÔNG có `dataUrl`; `GET :id` trả `contentUrl`; đối tượng có thật trong bucket; mở tài liệu trong app hiển thị/tải bình thường. Lệnh cụ thể: `README.md` mục **6.1** + báo cáo `docs/ra-soat/2026-07-20/tach-file-object-storage.md`.
- Không thêm dependency: chữ ký AWS SigV4 (header + presigned query) tự viết (`server/src/blob.js`, `server-dotnet/.../Store/BlobStore.cs`) — kiểm bằng test-vector chính thức của AWS.
- **Sao lưu**: khi bật S3, thêm lịch backup riêng cho bucket (MinIO `mc mirror`/snapshot volume `ecabinet_minio`) **độc lập** với backup DB — đúng mô hình 4 cụm.

### A3.2. Bật Redis backplane để chạy App×2 sau cân bằng tải (mô hình HSMT "App-Server ×2")
Mặc định, backend chạy **1 tiến trình** (realtime broadcast + rate-limit là state trong RAM tiến trình — xem README "Giới hạn HA"). Để chạy **≥2 instance API sau cân bằng tải** (đúng mô hình 4 cụm HSMT "Web-Server ×2 / App-Server ×2") mà realtime vẫn đồng bộ và rate-limit vẫn đếm chung, **bật Redis backplane** (đã tích hợp sẵn, GATED qua `REDIS_URL`, parity cả Node lẫn .NET).

**Bước 1 — bật service `redis` + đặt `REDIS_URL`** (service `redis` gated qua **profile `scale`** → `up` thường KHÔNG tạo nó, hành vi mặc định giữ nguyên):
```bash
# Bản Node + PostgreSQL:
REDIS_URL=redis://redis:6379 \
  docker compose --profile scale up -d --build

# Bản .NET + SQL Server (đúng nền tảng HSMT):
REDIS_URL=redis://redis:6379 DB_PASSWORD='<mật-khẩu-SA-mạnh>' \
  docker compose -f docker-compose.dotnet.yml --profile scale up -d --build
```
> Đặt `REDIS_URL` trong file `.env` cạnh `docker-compose*.yml` để cố định. Hỗ trợ `redis://[:password@]host:port[/db]`; TLS dùng `rediss://` (nếu Redis bật TLS). Có mật khẩu: thêm `--requirepass` cho service `redis` rồi dùng `REDIS_URL=redis://:<mật-khẩu>@redis:6379`.

**Bước 2 — chạy 2 instance API sau cân bằng tải.** Cách nhanh nhất để nhân bản trong 1 host:
```bash
docker compose --profile scale up -d --build --scale api=2
# (bỏ container_name của service `api` nếu compose báo trùng tên khi --scale — hoặc
#  triển khai 2 node riêng cùng trỏ 1 Redis, đặt LB/nginx phía trước phân tải sang cả hai.)
```
Cân bằng tải phía trước (nginx/HAProxy/thiết bị của TTDL) trỏ vào cả 2 instance. **Khi đã bật Redis backplane, KHÔNG cần sticky session** cho realtime (client nối instance nào cũng nhận đủ sự kiện).

**Bước 3 — kiểm chứng THẬT (2 việc cần xác minh):**
1. **Realtime đồng bộ 2 instance** (client nối A nhận được ghi phát từ B):
   - Mở 2 tab trình duyệt, đăng nhập; xác định (qua log/LB) chúng nối **2 instance khác nhau**. Ở tab 1 tạo/sửa 1 cuộc họp (ghi CRUD) → tab 2 phải **tự cập nhật** (nhận sự kiện `change`). Trước khi có backplane, tab nối instance khác sẽ **không** cập nhật.
   - Kiểm ở tầng Redis: `docker exec -it ecabinet-redis redis-cli SUBSCRIBE ecabinet:changes` → mỗi lần ghi CRUD thấy đúng **1** message JSON `{"type":"change",...}` (không nhân đôi).
   - Kiểm log API: mỗi instance in `[redis] backplane BẬT — pub/sub redis:6379 ... kênh=ecabinet:changes` lúc khởi động.
2. **Rate-limit đếm chung toàn cụm** (không lách được bằng đổi instance):
   - Bắn vượt ngưỡng request rải qua LB (tổng > `RATE_LIMIT_MAX`, mặc định 300/60s/IP) → phải nhận **429** dù request rơi vào các instance khác nhau. Kiểm khóa đếm: `docker exec -it ecabinet-redis redis-cli GET "ip:<IP-client>"` tăng dần và **dùng chung** giữa các instance; `PTTL "ip:<IP>"` cho thấy cửa sổ còn lại.
   - Thử **đăng nhập sai** nhiều lần từ cùng IP+tài khoản qua 2 instance → khóa `login:<IP>:<user>` đếm chung, chặn đúng ngưỡng `LOGIN_RATE_MAX`.

**Fallback (không cần thao tác):** nếu Redis mất kết nối lúc đang chạy → realtime tự về **fanout local-only** + tự kết nối lại lũy tiến (log cảnh báo `[redis] mất kết nối ...`); rate-limit **fail-open** (cho qua, không chặn toàn hệ). Lỗi Redis **không làm sập** request nghiệp vụ. Khi Redis trở lại, backplane tự nối lại và đồng bộ tiếp.

- **GATED — tương thích ngược:** bỏ trống `REDIS_URL` (và không truyền `--profile scale`) → hành vi Y HỆT trước đây (1 instance, broadcast local, rate-limit in-RAM). Demo/dev/pilot 1-node **không đổi**.
- **Không thêm dependency:** client Redis nói giao thức RESP tự viết (`server/src/redis.js` qua `node:net`; `server-dotnet/.../Store/RedisBackplane.cs` qua `System.Net.Sockets.TcpClient`) — kiểm bằng test-vector + fake Redis in-process (Node smoke nhóm `12-REDIS-BACKPLANE`, .NET nhóm `12-REDIS`). Thiết kế + chống double-send + fallback chi tiết: `docs/ra-soat/2026-07-21/redis-backplane.md`.
- **Redis là backplane thuần** (pub/sub + đếm rate-limit): không lưu dữ liệu nghiệp vụ, không cần bền vững (service mẫu tắt `save`/`appendonly`). Có thể dùng Redis Sentinel/Cluster để HA chính Redis nếu cần (không bắt buộc ở quy mô gói thầu).

### A4. Sao lưu / phục hồi + diễn tập DR (chứng minh RTO ≤24h theo HSMT)
```bash
# Sao lưu SQL Server (giữ 14 bản gần nhất, đổi qua env KEEP):
DB_PASSWORD='...' bash deploy/backup-mssql.sh

# Phục hồi từ bản .bak:
DB_PASSWORD='...' bash deploy/restore-mssql.sh <đường-dẫn-file.bak>

# Diễn tập khôi phục end-to-end (khôi phục vào DB tạm, đối chiếu số bản ghi, đo thời gian):
DB_PASSWORD='...' bash deploy/test-restore.sh mssql
```
- Đặt lịch `backup-mssql.sh` chạy hằng ngày qua cron/Task Scheduler.
- Quy trình DR đầy đủ (phát hiện → phân tích ≤8h → khôi phục ≤24h → báo cáo) + lịch diễn tập: `docs/dr-runbook.md`.
- (Bản Node/PostgreSQL dùng `deploy/backup.sh` / `restore.sh`.)

### A5. Kiểm tra tải 90 CCU (chứng minh SLA <5s/thao tác)
```bash
BASE_URL=https://<DOMAIN> CCU=90 DURATION_S=120 node scripts/loadtest.mjs
```
- Đo p50/p95/p99, RPS, tỷ lệ lỗi. Ngưỡng đạt + cách đưa số liệu vào hồ sơ SLA: `docs/loadtest.md`.
- Chạy TRƯỚC giai đoạn vận hành thử để có số liệu thật cam kết trong hồ sơ.

### A6. Triển khai Windows Server + IIS (nếu HSMT bắt buộc đúng văn bản)
Outline 6 bước (`README` mục 11 — CẦN thực thi thật để biến thành bằng chứng):
1. Cài **.NET 8 Hosting Bundle** (ASP.NET Core Module) + **IIS** (role Web Server) + bật tính năng **WebSocket Protocol**.
2. Cài **SQL Server 2022** (Standard cho sản xuất), tạo database `ecabinet` + tài khoản SQL riêng (không dùng `sa`).
3. `dotnet publish server-dotnet/ECabinet.Api -c Release -o C:\inetpub\ecabinet-api`.
4. Tạo IIS Site/App Pool (No Managed Code) trỏ thư mục publish; đặt env `DATABASE_URL`, `JWT_SECRET`, `LIVEKIT_*`.
5. Reverse proxy: IIS phục vụ frontend `dist/` + proxy `/api` (kể cả nâng cấp WebSocket) sang site API.
6. Cấp chứng chỉ TLS hợp lệ; bật sao lưu SQL định kỳ; chạy API dưới tài khoản dịch vụ tối thiểu quyền.

### A7. Coolify trên VPS (nhanh cho pilot/demo, không phải hạ tầng TP)
Dùng `docker-compose.coolify.yml`: Coolify → New → Docker Compose → repo này → đặt env `DB_PASSWORD` + `JWT_SECRET` → gán domain cho service `web` → Deploy. Coolify tự cấp HTTPS.

---

## PHẦN B — CẦN GÌ ĐỂ ĐÁP ỨNG HSMT

### B1. ✅ Đã xong ở sản phẩm (không phải làm thêm)
- **Chức năng nghiệp vụ**: web **58/59 mục** (ma trận `docs/ra-soat/2026-07-18/doi-chieu-hsmt-cuoi-ngay.md`); mobile 37/38 nghiệp vụ qua PWA.
- **Nền tảng .NET 8**: đã có, 143/143 test PASS.
- **5 vai trò** (gồm Quản trị đơn vị), cô lập dữ liệu đa đơn vị, tài liệu mật, phiếu kín, audit log, whitelist tệp TT 39/2017, Unicode TCVN 6909.
- **Realtime WebSocket**, họp trực tuyến LiveKit (đã kiểm chứng kết nối thật), tự sinh biên bản đúng thể thức NĐ 30/2020, màn hình TV phòng họp.
- **Bộ hồ sơ dịch vụ 12 tài liệu** (`docs/ho-so/`) + **website công bố sản phẩm** (`website/index.html`) + script backup/DR/loadtest.

### B2. 🟠 Việc CẤU HÌNH/VẬN HÀNH khi triển khai (làm được ngay trên máy thật — theo Phần A)
| # | Việc | Làm ở đâu |
|---|---|---|
| 1 | Chạy thật trên **SQL Server 2022** instance thật (biến MSSQL 🟡→✅) | A1 |
| 2 | Bật **HTTPS TLS 1.2+** | A2 |
| 3 | Bật **họp trực tuyến LiveKit** (nếu cần video thật) | A3 |
| 3b | Bật **object storage MinIO/S3** tách tệp khỏi DB (Cụm Server-File) — chống phình DB | A3.1 |
| 3c | Bật **Redis backplane** để chạy **App×2 sau cân bằng tải** (realtime + rate-limit đồng bộ toàn cụm) — ĐÃ tích hợp, chỉ cần bật env | A3.2 |
| 4 | Cấu hình **sao lưu tự động + diễn tập DR** (RTO 24h) | A4 |
| 5 | **Load test 90 CCU** lấy số liệu SLA | A5 |
| 6 | Đổi mật khẩu mặc định, đặt `JWT_SECRET` mạnh, thu hồi khóa API demo | A1 |
| 7 | (Nếu HSMT bắt buộc) triển khai **Windows Server + IIS** | A6 |
| 8 | Giám sát 24/7 (Prometheus/Grafana/Uptime Kuma) + cảnh báo — cần dựng thêm | ngoài repo |

> **Mô hình 4 cụm / 7 VM + cân bằng tải + HA (lời giải cho khoảng cách hạ tầng lớn nhất — bom 💣1 rà soát 20/07):** phương án triển khai hạ tầng đầy đủ (sơ đồ kiến trúc, bảng 7 VM đúng HSMT dòng 318–322, ánh xạ từ bản 1-node hiện tại, xử lý state per-process, DB AlwaysOn, MinIO, HA/chuyển mạch tự động, checklist làm việc với TTDL) xem `docs/ho-so/12-phuong-an-trien-khai-ha-tang.md`.

### B3. 🔴 Việc CẦN PHÁP NHÂN / BÊN THỨ BA (không code được — quyết định của công ty)
| # | Việc | Vì sao cần bên ngoài |
|---|---|---|
| 1 | **Ký số PKI thật** (VGCA / VNPT SmartCA) thay mô phỏng — mục 30 | Cần hợp đồng/thiết bị CA được cấp phép + tích hợp SDK thật |
| 2 | **Hồ sơ ATTT cấp độ 3** + pentest độc lập (NĐ 85/2016, TT 12/2022) | Bắt buộc TRƯỚC vận hành; đơn vị kiểm định có pháp nhân; 6–8 tuần |
| 3 | **Mã hóa cơ yếu** cho dữ liệu mật | Giải pháp mật mã của Ban Cơ yếu |
| 4 | **Tín nhiệm mạng** | Đăng ký/gán nhãn NCSC |
| 5 | **Tích hợp LGSP + IOC thật** của TP | Cần đặc tả kỹ thuật + endpoint do TP cấp (Open API đã sẵn sàng) |
| 6 | **Đội vận hành 24/7 + tổng đài** suốt 60 tháng | Nhân sự/tổ chức, cân nhắc thuê NOC |
| 7 | **Năng lực + hợp đồng tương tự** (Chương I/III HSMT) | Rào cản với sản phẩm mới — cân nhắc **liên danh** |
| 8 | Đăng **website công bố** lên tên miền công khai + ký bộ hồ sơ | Điều kiện dự thầu; pháp nhân điền/ký |

### B4. Trình tự khuyến nghị trước vận hành thử / nghiệm thu
1. Chạy A1–A5 trên hạ tầng đích (hoặc hạ tầng TP cấp) → có bản chạy thật + số liệu SLA.
2. Khởi động sớm B3 mục 1,2 (ký số CA + ATTT cấp độ 3) vì thời gian chờ dài, ngoài tầm kiểm soát.
3. Gửi **văn bản làm rõ HSMT** (đã soạn `docs/ho-so/10-van-ban-lam-ro-hsmt.md`) — đặc biệt: nền tảng .NET/Windows bắt buộc hay tương đương; chuẩn CA; đặc tả LGSP/IOC.
4. Đọc **Chương I/III E-HSMT của gói cụ thể** → quyết định bid/no-bid, phương án liên danh nếu thiếu năng lực.
5. Vận hành thử theo Điều 58 NĐ 73/2019 + Phụ lục II TT 16/2024 (kịch bản sẵn: `docs/ho-so/03-kich-ban-kiem-thu-van-hanh-thu.md`).

> **Tóm lại:** Về **sản phẩm + tài liệu**, eCabinet đã sẵn sàng ở mức rất cao. Việc còn lại để "đáp ứng HSMT" chủ yếu là **(a) cấu hình/chạy thật trên hạ tầng đích** (Phần A — đội kỹ thuật làm được ngay) và **(b) các thủ tục pháp nhân/bên thứ ba** (B3 — cần thời gian và quyết định của công ty), KHÔNG còn là việc phát triển phần mềm.
