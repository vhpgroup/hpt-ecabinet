CÔNG TY [Tên đầy đủ pháp nhân HPT TECH]
Số: [Số văn bản]/PA-HPT

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập – Tự do – Hạnh phúc

Hải Phòng, ngày [Ngày ký]

# PHƯƠNG ÁN TRIỂN KHAI HẠ TẦNG

**Kính gửi:** Sở Khoa học và Công nghệ thành phố Hải Phòng

**Về:** Gói thầu "Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu" — Phương án triển khai hạ tầng máy chủ đáp ứng mô hình 4 cụm/7 máy ảo theo Chương V E-HSMT.

---

## 1. Căn cứ & phạm vi

### 1.1. Căn cứ trích nguyên văn E-HSMT (Chương V — `docs/hsmt-chuong-v.md`)

**Mô hình triển khai phần mềm** (dòng 308–315):

> *"Hệ thống phần mềm được cài đặt tập trung tại Trung tâm tích hợp dữ liệu thành phố, các đơn vị vào đây để khai thác và cập nhật dữ liệu mà không cần phải cài đặt phần mềm và CSDL tại từng đơn vị. Hạ tầng máy chủ được sử dụng công nghệ ảo hóa nhằm phân phối tài nguyên hợp lý, linh hoạt."* (dòng 310–311)
>
> *"Cụm Server-Web: Các module web cần được public ra internet cho người sử dụng. Để đảm bảo ATTT, các module này được đặt qua các thiết bị bảo mật, thiết bị cân bằng tải và các thiết bị mạng chuyên dụng;"* (dòng 312)
>
> *"Cụm Server-App: Cụm các module tiến trình xử lý nghiệp vụ hệ thống, kết nối với máy chủ chức năng trong hệ thống;"* (dòng 313)
>
> *"Cụm Server-Database: Xử lý lưu trữ, truy xuất dữ liệu;"* (dòng 314)
>
> *"Cụm Server-File: Xử lý lưu trữ file như video, media, tệp đính kèm,...."* (dòng 315)

**Bảng cấu hình đề xuất các máy chủ ảo** (dòng 316–322):

> | STT | Máy chủ | Hệ điều hành | vCPU | vRam | Dung lượng lưu trữ | Số lượng |
> |---|---|---|---|---|---|---|
> | 1 | Database-Server | Windows Server | 32 Core | 64 Gb | 500 Gb | 2 |
> | 2 | Web-Server | Windows Server | 16 Core | 32 Gb | 200 Gb | 2 |
> | 3 | App-Server | Windows Server | 16 Core | 32 Gb | 200 Gb | 2 |
> | 4 | File-Server | Ubuntu Server | 8 Core | 16 Gb | — | 1 |

**Nền tảng công nghệ bắt buộc** (dòng 332–334): *"Nền tảng công nghệ lập trình: .NET"*; *"Hệ quản trị Cơ sở dữ liệu: Microsoft SQL Server 2022 trở lên"*; *"Hệ điều hành máy chủ: Windows server OS (2019) hoặc cao hơn, Linux."*

**Các yêu cầu liên quan trực tiếp đến hạ tầng** (viện dẫn để phương án đáp ứng đồng bộ):
- Mã hóa dữ liệu khi lưu trữ/truyền/nhận bằng mật mã cơ yếu (dòng 75; ATTT cấp độ 3 dòng 71, 527–528).
- HTTPS TLS v1.2 trở lên với bộ mã hóa an toàn (dòng 550); sẵn sàng IPv6 (dòng 549).
- Tự động sao lưu theo lịch, phục hồi từ bản sao lưu (dòng 523, 593–597); RTO 24h, gián đoạn ≤3 lần/năm (dòng 41–43, 91–95).
- Thay thế thành phần không gián đoạn, dự phòng và chuyển mạch tự động (dòng 98, 117, mục 4.4.2); giám sát 24/7, cảnh báo (dòng 99, 615).

### 1.2. Phạm vi tài liệu

Tài liệu này là **lời giải chính thức cho khoảng cách hạ tầng lớn nhất** được rà soát 20/07/2026 chỉ ra (`docs/ra-soat/2026-07-20/rasoat-toandien-techleader.md`, bom 💣1): E-HSMT yêu cầu **4 cụm server tách biệt, 7 máy ảo, có cân bằng tải + thiết bị bảo mật + File-server Ubuntu riêng**, trong khi bản triển khai đóng gói hiện tại (`docker-compose.dotnet.yml`) là **một node gộp Web + App + DB + File**, chưa có cân bằng tải/WAF/HA. Phương án dưới đây trình bày kiến trúc đích đúng bảng dòng 318–322, ánh xạ từ hiện trạng, và **trung thực nêu các điểm giới hạn phải xử lý** (state per-process, MinIO single-node, bản quyền), phân biệt rõ việc **làm được bằng cấu hình/mã** với việc **cần Trung tâm dữ liệu TP (TTDL) hoặc pháp nhân quyết**.

Tài liệu này đồng thời khép các bom hạ tầng liên quan trong cùng bản rà soát: 💣2 (tách file MinIO còn GATED), 💣4 (mã hóa at-rest), 💣5 (HA/chuyển mạch tự động), 💣6 (SQL Server 2022 phải chạy bản Standard thay Express/InMemory).

---

## 2. Sơ đồ kiến trúc tổng thể

```
                          Internet công cộng  /  Mạng truyền số liệu chuyên dùng (WAN CQNN)
                                                    │  (IPv4 + IPv6 dual-stack — dòng 549)
                                                    ▼
        ┌───────────────────────────────────────────────────────────────────────────┐
        │  BIÊN AN NINH TTDL TP: Firewall + IPS/IDS + Thiết bị bảo mật (dòng 312)      │
        └───────────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
        ┌───────────────────────────────────────────────────────────────────────────┐
        │  CÂN BẰNG TẢI (LB) + WAF  —  VIP công khai, TLS termination (TLS 1.2+),      │
        │  health-check /health, WebSocket passthrough /api/realtime, sticky session   │
        │  (thiết bị chuyên dụng của TTDL — ưu tiên; hoặc HAProxy/nginx+ModSecurity)   │
        └───────────────────────────────────────────────────────────────────────────┘
                                                    │
   ══════════════ VÙNG DMZ (public zone) ══════════╪══════════════════════════════════
                                                    ▼
                    ┌──────────────────────┐   ┌──────────────────────┐
                    │  CỤM SERVER-WEB #1    │   │  CỤM SERVER-WEB #2    │   Windows Server
                    │  16C/32G/200G         │   │  16C/32G/200G         │   IIS/nginx + React (dist)
                    │  phục vụ FE + proxy   │   │  phục vụ FE + proxy   │   proxy /api → App
                    └───────────┬──────────┘   └──────────┬───────────┘
                                │  (chỉ /api, /api/realtime — firewall DMZ→App)
   ══════════════ VÙNG APP (app zone) ══════════════╪══════════════════════════════════
                                                    ▼
                    ┌──────────────────────┐   ┌──────────────────────┐
                    │  CỤM SERVER-APP #1    │   │  CỤM SERVER-APP #2    │   Windows Server
                    │  16C/32G/200G         │   │  16C/32G/200G         │   ASP.NET Core 8
                    │  ECabinet.Api :3000   │   │  ECabinet.Api :3000   │   (server-dotnet)
                    └───────┬──────────────┘   └──────────────┬───────┘
                            │                                 │
             ┌──────────────┴────────────┐        ┌───────────┴───────────────┐
             ▼ (TDS 1433 — DB zone)      │        │ (S3/HTTP 9000 — File zone) ▼
   ══════════ VÙNG DB (data zone) ═══════╪════════╪═══════════════════ VÙNG FILE ═══════
   ┌──────────────────────┐  ┌──────────────────────┐      ┌────────────────────────────┐
   │  CỤM SERVER-DB #1     │  │  CỤM SERVER-DB #2     │      │  SERVER-FILE (Ubuntu)       │
   │  32C/64G/500G (Primary)│◄►│  32C/64G/500G (Sec.)  │      │  8C/16G — MinIO (S3)        │
   │  SQL Server 2022 Std  │  │  SQL Server 2022 Std  │      │  bucket private + SSE       │
   │  Basic Availability   │  │  Basic Availability   │      │  video/media/tệp đính kèm   │
   │  Group (AlwaysOn)     │  │  Group (AlwaysOn)     │      │  (dòng 315)                 │
   └──────────────────────┘  └──────────────────────┘      └────────────────────────────┘
             ▲  WSFC + quorum witness (chuyển mạch tự động — dòng 98/117)

   ══════════ VÙNG QUẢN TRỊ (management zone — không public) ═══════════════════════════
   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────────┐
   │ NTP nội bộ    │  │ DNS nội bộ    │  │ Giám sát:     │  │ Log tập trung + cảnh báo   │
   │ (đồng hồ TTDL)│  │ (phân giải    │  │ Prometheus/   │  │ (syslog/ELK) → trực 24/7   │
   │               │  │  tên nội bộ)  │  │ Grafana/Uptime│  │ (dòng 99/615)              │
   └───────────────┘  └───────────────┘  └───────────────┘  └───────────────────────────┘
```

**Nguyên tắc phân vùng mạng (network segmentation — phục vụ ATTT cấp độ 3, dòng 71):**
- **DMZ (public zone):** chỉ Cụm Web nhận lưu lượng từ LB/WAF; là lớp duy nhất tiếp xúc người dùng.
- **App zone:** Cụm App **không public**; chỉ nhận kết nối từ Cụm Web qua cổng ứng dụng.
- **Data zone:** Cụm DB **không public**; chỉ nhận kết nối từ App zone qua cổng TDS 1433.
- **File zone:** Server-File chỉ nhận kết nối S3 từ App zone (và presigned có kiểm quyền cho client — mục 7).
- **Management zone:** NTP/DNS nội bộ, giám sát, log, truy cập quản trị (SSH/RDP) tách riêng, chỉ mở từ dải quản trị.

---

## 3. Bảng cấu hình 7 máy ảo (khớp đúng bảng E-HSMT dòng 318–322)

| STT | Tên VM | HĐH (theo HSMT) | vCPU | vRAM | Ổ đĩa | SL | Vai trò | Cổng mở (chiều vào) |
|---|---|---|---|---|---|---|---|---|
| 1 | **Database-Server #1/#2** | Windows Server 2019+ | 32 Core | 64 GB | 500 GB | 2 | SQL Server 2022 Standard, Basic Availability Group (AlwaysOn) — primary + secondary; lưu trữ, truy xuất dữ liệu (dòng 314) | **1433/TCP** từ App zone; **cổng WSFC + endpoint mirroring (5022/TCP)** giữa 2 node DB; quản trị từ management zone |
| 2 | **Web-Server #1/#2** | Windows Server 2019+ | 16 Core | 32 GB | 200 GB | 2 | IIS (hoặc nginx) phục vụ frontend React `dist/` + reverse proxy `/api`, `/api/realtime` sang App; public sau LB/WAF (dòng 312) | **443/80** từ LB/WAF; quản trị từ management zone |
| 3 | **App-Server #1/#2** | Windows Server 2019+ | 16 Core | 32 GB | 200 GB | 2 | ASP.NET Core 8 (`server-dotnet/ECabinet.Api`), tiến trình xử lý nghiệp vụ (dòng 313); mint token LiveKit; ký chữ ký presigned S3 | **3000/TCP** từ DMZ (Web zone); ra: 1433 tới DB, 9000 tới File |
| 4 | **File-Server** | Ubuntu Server 22.04+ | 8 Core | 16 GB | (theo dung lượng media 60 tháng — đề xuất ≥1 TB, xem mục 7) | 1 | MinIO (S3-compatible) lưu video/media/tệp đính kèm (dòng 315); bucket private + SSE mã hóa at-rest | **9000/TCP** (S3 API) từ App zone; 9001 console từ management zone |

**Tổng: 7 máy ảo** (2 + 2 + 2 + 1) — đúng bảng HSMT. Toàn bộ đặt tập trung tại TTDL TP trên nền ảo hóa (dòng 310–311).

> **Ghi chú trung thực về HĐH:** HSMT quy định Web/App/DB dùng **Windows Server**, File dùng **Ubuntu**. Sản phẩm chạy được cả Windows (IIS + .NET 8 Hosting Bundle + SQL Server native) lẫn Linux (Docker). Phương án mặc định **bám đúng HSMT** (Windows cho 6 VM, Ubuntu cho VM File). Nếu triển khai dạng container trên Windows/Ubuntu (mục 4) thì vẫn giữ đúng HĐH nền của từng VM.

---

## 4. Ánh xạ từ hiện trạng → mô hình đích

### 4.1. Bảng ánh xạ service compose hiện tại → VM/cụm đích

| Service hiện tại (compose) | Bằng chứng | Cụm đích | VM đích | Ghi chú |
|---|---|---|---|---|
| `web` (nginx + React `dist`, `docker-compose.dotnet.yml:34`) | proxy `/api`→`api:3000`, `/api/realtime`, `/health` (`nginx.conf:16–38`) | Cụm Server-Web | Web #1, #2 | Nhân bản 2 node sau LB |
| `api` (ASP.NET Core 8, `docker-compose.dotnet.yml:47`) | `server-dotnet/ECabinet.Api` | Cụm Server-App | App #1, #2 | Nhân bản 2 node; xử lý state per-process ở mục 5 |
| `db` (SQL Server 2022, `docker-compose.dotnet.yml:124`) | image `mssql/server:2022-latest`, hiện `MSSQL_PID: Express` (dòng 128) | Cụm Server-Database | DB #1, #2 | **Đổi Express → Standard** + AlwaysOn (mục 6) — đóng 💣6 |
| `minio` + `minio-init` (`docker-compose.dotnet.yml:86–121`) | bucket private | Cụm Server-File | File (Ubuntu) | **Bật `S3_*`** khi triển khai chính thức (mục 7) — đóng 💣2 |
| `caddy` (profile `tls`, `docker-compose.dotnet.yml:163`) | TLS termination tùy chọn | Tầng LB/WAF | (thiết bị TTDL hoặc VM Web) | Thay bằng LB/WAF TTDL; Caddy là phương án dự phòng |

> **Kết luận ánh xạ:** hiện trạng gộp 3 cụm (Web/App/DB) về 1 node + 1 bản mỗi service; đích tách thành 6 VM (2×3 cụm) + 1 VM File, mỗi cụm nhân đôi để có HA. Không phải viết lại phần mềm — cùng image/artifact, chỉ **tách vật lý và nhân bản** theo bảng dòng 318.

### 4.2. Hai phương án đóng gói trên VM

**Phương án (a) — Chạy container trên từng VM (Docker/containerd trên Windows hoặc Ubuntu):**
- Ưu: tái dùng trực tiếp image đã build (`web`, `api`, `db`, `minio`); tính lặp lại cao; cấu hình bằng biến môi trường sẵn có; rút ngắn thời gian dựng.
- Nhược: thêm một lớp runtime container trên Windows Server (cần cân nhắc chính sách vận hành của TTDL); không hoàn toàn "truyền thống" như kỳ vọng máy Windows.

**Phương án (b) — Cài native trên Windows Server (đúng "chất" HSMT):**
- Web/App: **IIS + .NET 8 Hosting Bundle** (ASP.NET Core Module) + bật **WebSocket Protocol**; `dotnet publish server-dotnet/ECabinet.Api` (đã có outline 6 bước tại `docs/HUONG-DAN-TRIEN-KHAI-VA-HSMT.md:110–117` và README mục 11).
- DB: cài **SQL Server 2022 Standard** native (không container), tạo database `ecabinet`, tài khoản SQL riêng (không dùng `sa`).
- File: **MinIO native trên Ubuntu** (systemd service).
- Ưu: đúng mô hình Windows Server truyền thống HSMT mô tả; dễ áp chính sách vá/giám sát/AV cấp OS; tương thích công cụ quản trị của TTDL.
- Nhược: nhiều bước cài thủ công hơn; cần biên bản kiểm chứng chạy thật trên MSSQL/Windows (hiện `SqlServerDocStore` mới kiểm trên InMemory, chưa trên SQL Server thật — 💣6).

**Khuyến nghị:** Ưu tiên **phương án (b) cài native trên Windows Server + SQL Server Standard cho 6 VM Web/App/DB**, và **MinIO native trên Ubuntu cho VM File** — để bám đúng nền tảng và HĐH HSMT quy định, đồng thời tận dụng công cụ quản trị/giám sát cấp OS của TTDL. Cho phép dùng **phương án (a) container ở môi trường staging** (Giai đoạn 1, mục 11) để dựng nhanh và kiểm thử tích hợp trước khi cài native lên hạ tầng sản xuất.

---

## 5. Cân bằng tải + WAF (và xử lý state per-process — không che giấu)

### 5.1. Phương án ưu tiên — dùng thiết bị cân bằng tải + bảo mật của TTDL TP

Đúng dòng 312 ("thiết bị bảo mật, thiết bị cân bằng tải và các thiết bị mạng chuyên dụng"). **Yêu cầu cụ thể gửi TTDL** (để LB/WAF hoạt động đúng với ứng dụng):
- **VIP** (Virtual IP) công khai + bản ghi DNS trỏ về; hỗ trợ **IPv4 và IPv6**.
- **Health-check** tới endpoint **`/health`** trên mỗi Web node (đã có, `nginx.conf:36–38` proxy sang API; README A1 `curl /api/health`) — LB loại node hỏng khỏi pool.
- **TLS termination** tại LB với **TLS 1.2 trở lên**, bộ cipher an toàn, chứng chỉ do TP cấp (đóng yêu cầu dòng 550).
- **WebSocket passthrough** cho đường **`/api/realtime`** (giữ header `Upgrade`/`Connection`, timeout dài — tham chiếu `nginx.conf:16–24`, `proxy_read_timeout 3600s`).
- **Sticky session** (theo cookie hoặc IP-hash) — bắt buộc vì lý do state per-process ở mục 5.3.
- **WAF** bật bộ luật OWASP CRS; chặn tấn công mẫu; ghi log về hệ thống giám sát.

### 5.2. Phương án software dự phòng (nếu TTDL không cấp thiết bị chuyên dụng)

Triển khai trên chính 2 VM Web (hoặc 1 cặp VM LB riêng): **HAProxy** hoặc **nginx** làm LB + **ModSecurity + OWASP CRS** làm WAF. TLS termination tại lớp này (có thể dùng `deploy/Caddyfile` — Caddy đã hỗ trợ WebSocket passthrough, `docker-compose.dotnet.yml:143–192`). Đây là phương án **làm được bằng cấu hình**, không phụ thuộc pháp nhân, nhưng kém về thông lượng/tính năng bảo mật so với thiết bị chuyên dụng.

### 5.3. Xử lý state per-process — Redis backplane ĐÃ TRIỂN KHAI (gated)

Trước đây có **hai cơ chế dùng state tĩnh trong một tiến trình**, KHÔNG chia sẻ giữa nhiều instance — sẽ vỡ khi chạy App/Web ×2 sau LB nếu không xử lý:

1. **Rate-limit** (`server/src/ratelimit.js`; bản .NET `RateLimit.cs`): đếm request theo IP trong bộ nhớ tiến trình → nhiều instance đếm rời, giảm hiệu quả chống brute-force.
2. **WebSocket realtime broadcast** (`server/src/ws.js`; `broadcast()` chỉ gửi client của **đúng tiến trình đó**): client nối App #1 **không nhận** sự kiện realtime phát từ ghi ở App #2.

> Lưu ý tích cực: **refresh-token/session không có gap này** vì đã lưu qua CSDL — đăng nhập/phiên hoạt động đúng ngay khi chạy đa instance.

**✅ NAY ĐÃ CÓ Redis backplane (tự viết, gated qua `REDIS_URL`)** giải cả 2 gap — parity Node ⇄ .NET, **không thêm dependency** (client RESP nói giao thức Redis trực tiếp qua `node:net` / `System.Net.Sockets.TcpClient`, đúng triết lý đã tự viết JWT/SigV4/WS RFC6455):

- **Realtime**: mỗi instance SUBSCRIBE kênh `ecabinet:changes`; khi có ghi CRUD, instance đó **chỉ PUBLISH** (không gửi trực tiếp cho client local) → mọi instance nhận lại qua subscribe rồi fanout cho client của mình **đúng 1 lần** (chống double-send). Client nối bất kỳ instance nào đều nhận realtime → **bỏ ràng buộc sticky session**.
- **Rate-limit**: `hit(key)` khi bật Redis dùng **INCR + PEXPIRE** (đếm chung toàn cụm) — không lách được bằng đổi instance.
- **Fallback**: Redis rớt → realtime về fanout local-only + tự nối lại lũy tiến; rate-limit **fail-open**; lỗi Redis không sập request nghiệp vụ.
- **File chạm**: `server/src/redis.js` (+ `ws.js`/`index.js`); `server-dotnet/ECabinet.Api/Store/RedisBackplane.cs` (+ `Ws.cs`/`RateLimit.cs`/`App.cs`). Kiểm chứng: test-vector RESP + fake Redis in-process (Node smoke nhóm `12-REDIS-BACKPLANE`, .NET nhóm `12-REDIS`). Thiết kế chi tiết: `docs/ra-soat/2026-07-21/redis-backplane.md`.
- **Bật**: `docker compose --profile scale up -d` (kèm `REDIS_URL=redis://redis:6379`) — xem `docs/HUONG-DAN-TRIEN-KHAI-VA-HSMT.md` mục **A3.2**.

**Lộ trình (đã rút gọn nhờ backplane sẵn có):**

| Kỳ | Giải pháp | Bản chất | Trạng thái |
|---|---|---|---|
| **Ngắn hạn (nếu chưa muốn dựng Redis)** | Sticky session tại LB cho `/api/realtime` + rate-limit tầng LB/WAF | Cấu hình hạ tầng, không sửa code | Vẫn dùng được — phương án dự phòng |
| **Khuyến nghị (đã có sẵn trong mã)** | **Bật Redis backplane** (`REDIS_URL` + profile `scale`): realtime đồng bộ toàn cụm + rate-limit đếm chung, **bỏ ràng buộc sticky** | **Chỉ cần bật env** (mã + test + compose đã xong) | ✅ **ĐÃ TRIỂN KHAI** |

> **Cam kết trung thực:** Redis backplane **không còn là "hạng mục phát triển tương lai"** — đã tích hợp sẵn cả 2 backend (gated, tương thích ngược tuyệt đối), có test tự động (fake Redis) và hướng dẫn kiểm chứng thật. Việc còn lại của đội hạ tầng chỉ là **cấp 1 dịch vụ Redis** (có thể HA bằng Sentinel/Cluster) và bật `REDIS_URL`. Kiểm chứng cuối với Redis thật (2 instance sau LB) do đội vận hành chạy theo A3.2 (môi trường dev sandbox chặn socket nên chưa chạy Redis thật khi phát triển).

---

## 6. Cụm Database — SQL Server 2022 Standard + Basic Availability Group (đóng 💣5, 💣6)

### 6.1. Vì sao phải là Standard (không phải Express)

- Compose hiện đặt `MSSQL_PID: Express` (`docker-compose.dotnet.yml:128`). **SQL Server Express giới hạn 10 GB/database + 1 socket CPU + ~1.4 GB RAM** → **không đạt** sizing HSMT (DB 32C/64G/500G) và không hỗ trợ Availability Group.
- **SQL Server 2022 Standard** hỗ trợ **Basic Availability Group** (AlwaysOn) cho **2 node, 1 database** — đủ để đạt yêu cầu "dự phòng và chuyển mạch tự động" (dòng 98/117) cho tầng dữ liệu, khớp đúng "Database-Server × 2" (dòng 319). (Nếu cần nhiều database trong 1 AG hoặc readable secondary → cân nhắc Enterprise; với 1 database nghiệp vụ của eCabinet, Standard + Basic AG là đủ và tiết kiệm.)

> **Cần pháp nhân quyết (🏛️):** mua/thuê **bản quyền SQL Server 2022 Standard** cho 2 node DB (và bản quyền **Windows Server** cho 6 VM). Ghi rõ trong mục 12 — làm rõ với TTDL license do bên nào cấp.

### 6.2. Cấu hình HA tầng DB

- **Windows Server Failover Cluster (WSFC)** trên 2 node DB + **quorum witness** (file share hoặc cloud witness) để tránh split-brain.
- **Basic Availability Group** đồng bộ 1 database `ecabinet` giữa primary và secondary; **synchronous commit** → RPO ≈ 0.
- Chuỗi kết nối App bổ sung **`MultiSubnetFailover=True`** (mở rộng `DATABASE_URL` hiện tại tại `docker-compose.dotnet.yml:53`) để tự bám listener khi failover, chuyển mạch trong suốt với ứng dụng.
- **RPO/RTO tầng DB:** RPO ≈ 0 (synchronous); RTO tự động failover cỡ **giây–chục giây** (WSFC phát hiện + AG chuyển vai).

### 6.3. Sao lưu tầng DB

- Chuyển logic `deploy/backup-mssql.sh` (`docs/HUONG-DAN-TRIEN-KHAI-VA-HSMT.md:88–101`) thành **SQL Server Agent job** chạy trên node primary: full hằng ngày + differential/log theo lịch, giữ N bản gần nhất.
- Kiểm thử phục hồi định kỳ bằng `deploy/restore-mssql.sh` / `deploy/test-restore.sh` (đo thời gian, đối chiếu số bản ghi) — quy trình DR tại `docs/dr-runbook.md`.

> **Lưu ý kiểm chứng (💣6):** `SqlServerDocStore.cs` hiện mới kiểm trên InMemory (test dùng TestHost in-memory), **chưa chạy trên SQL Server thật** (`README.md:515`). Khi dựng DB Standard thật phải lấy **biên bản xác nhận** tạo bảng, CAS chống mất phiếu, seed dữ liệu chạy đúng (README A1 `curl /api/health` trả `"db":"sqlserver"`).

---

## 7. Server-File — MinIO trên Ubuntu (đóng 💣2)

Đúng dòng 315 và HĐH Ubuntu (dòng 322). Cấu phần đã có sẵn trong compose (`docker-compose.dotnet.yml:86–121`), cài native trên VM File 8C/16G.

**Bắt buộc khi triển khai chính thức — bật object storage (đóng 💣2):** hiện các biến `S3_*` để trống mặc định (`docker-compose.dotnet.yml:70–75`) → hệ thống **giữ base64 trong cột `NVARCHAR(MAX)` của DB** (đúng lỗi cũ). Phải đặt đầy đủ các biến (tham chiếu `docs/HUONG-DAN-TRIEN-KHAI-VA-HSMT.md` mục **A3.1**):

```env
S3_ENDPOINT=http://<file-server>:9000
S3_BUCKET=ecabinet-docs
S3_ACCESS_KEY=<khóa>
S3_SECRET_KEY=<mật-khẩu-mạnh>
S3_FORCE_PATH_STYLE=true
```

- Bucket **private**, tải/xem qua **presigned URL có kiểm quyền đọc** trước khi cấp (TTL ngắn, mặc định 300s) — bảo mật giữ nguyên như `GET :id` (A3.1).
- **Mã hóa at-rest (đóng 💣4):** bật **SSE** (server-side encryption) cho bucket MinIO.
- **Sao lưu bucket độc lập** với backup DB: lịch `mc mirror`/snapshot volume `ecabinet_minio` (A3.1 và `docs/HUONG-DAN-TRIEN-KHAI-VA-HSMT.md:86`) — đóng rủi ro "file nằm ngoài backup DB" (💣7). Kiểm thử phục hồi **cả DB + file**.
- **Kiểm chứng sau khi bật:** upload 1 tài liệu → bản ghi DB có `storageKey`, KHÔNG có `dataUrl`; `GET :id` trả `contentUrl`; object có thật trong bucket (README mục 6.1).

**Rủi ro single-node & lộ trình (trung thực):** HSMT chỉ quy định **File-Server × 1** → đây là **điểm đơn lẻ (SPOF) của tầng File**. Để giảm rủi ro trong khuôn khổ 1 VM: dùng **RAID** cho ổ đĩa + **snapshot định kỳ** + backup bucket độc lập (ở trên). **Đề xuất lộ trình** (ngoài phạm vi bảng HSMT, nêu để chủ đầu tư cân nhắc): nâng lên **MinIO 2-node (distributed/erasure code)** sau giai đoạn ổn định để đạt HA cho tầng File — cần TTDL cấp thêm 1 VM.

---

## 8. HA / chuyển mạch tự động end-to-end (đóng 💣5)

| Tầng | Cơ chế phát hiện & chuyển mạch | RTO (mục tiêu) | RPO |
|---|---|---|---|
| **Web (×2)** | LB **health-check `/health`** loại node hỏng khỏi pool; traffic dồn sang node còn lại | vài giây (chu kỳ health-check) | 0 (stateless) |
| **App (×2)** | LB health-check loại App node hỏng; sticky session client chuyển sang node còn sống ở lần kết nối mới (realtime nối lại) | vài giây | 0 (state phiên ở DB) |
| **Database (×2)** | **WSFC + Basic AG (AlwaysOn)** tự failover; app bám listener nhờ `MultiSubnetFailover=True` | giây–chục giây | ≈ 0 (synchronous commit) |
| **File (×1)** | Không tự failover (single-node); phục hồi từ **snapshot/backup bucket**; RAID chống hỏng ổ đơn | theo thời gian restore (đề xuất ≤ vài giờ) | theo chu kỳ snapshot/mirror |

- **Bảng trên đáp ứng "thay thế thành phần không gián đoạn… dự phòng và chuyển mạch tự động"** (dòng 98/117) cho 3 tầng Web/App/DB; tầng File nêu **trung thực** là single-node theo HSMT, có biện pháp giảm thiểu + lộ trình nâng cấp (mục 7).
- Kết hợp với sao lưu + DR (`docs/dr-runbook.md`), phương án hướng tới **RTO ≤ 24h** và **gián đoạn ≤ 3 lần/năm** như cam kết (dòng 41–43, 91–95; `docs/ho-so/02-cam-ket-sla.md`).
- **Kịch bản diễn tập** (đưa vào vận hành thử — Giai đoạn 4/6 kế hoạch 12 tuần): (1) tắt 1 Web node → xác nhận LB loại + dịch vụ liên tục; (2) tắt 1 App node → xác nhận realtime nối lại; (3) failover AG DB (thủ công + mô phỏng sự cố) → đo thời gian chuyển + toàn vẹn dữ liệu; (4) khôi phục File từ snapshot → đối chiếu.

---

## 9. An toàn thông tin đi kèm (đồng bộ hồ sơ ATTT cấp độ 3)

- **Phân vùng mạng + firewall rule tối thiểu giữa zone** (mục 2): DMZ chỉ nhận từ LB; App chỉ nhận từ Web (3000); DB chỉ nhận từ App (1433); File chỉ nhận từ App (9000); quản trị (SSH/RDP, console 9001) chỉ từ management zone. Mặc định **deny-all**, chỉ mở cổng liệt kê ở bảng mục 3.
- **TLS 1.2+ end-to-end** (dòng 550): TLS termination tại LB; nội bộ App↔DB bật `Encrypt=True` (đã có trong `DATABASE_URL`, `docker-compose.dotnet.yml:53`); App↔File dùng HTTPS/S3 khi khả dụng. Pin `min_version tls1.2`, đóng cổng HTTP thuần sau khi TLS ổn (`docs/HUONG-DAN-TRIEN-KHAI-VA-HSMT.md:48`).
- **Mã hóa at-rest (đóng 💣4):** **TDE (Transparent Data Encryption)** cho SQL Server (Standard hỗ trợ TDE) + **SSE** cho bucket MinIO (mục 7). *(Riêng mã hóa bằng mật mã cơ yếu cho dữ liệu mật — dòng 75 — là hạng mục **pháp nhân/Ban Cơ yếu**, ngoài phạm vi cấu hình hạ tầng; ghi nhận đồng bộ với `docs/ho-so/01-cam-ket-bao-mat.md`.)*
- **NTP nội bộ** (đồng bộ đồng hồ toàn hệ — phục vụ tính toàn vẹn audit/ký số) + **DNS nội bộ** (phân giải tên các cụm, không phụ thuộc DNS ngoài) — đặt ở management zone (mục 2). *Nêu vì mô hình HA đa VM cần thời gian/tên nội bộ nhất quán; hạ tầng do TTDL cấp.*
- **Giám sát tập trung 24/7** (dòng 99/615): **Prometheus + Grafana + Uptime-Kuma** (hoặc tương đương) cho hiệu năng/tình trạng; **log tập trung** (syslog/ELK) không cho sửa; **cảnh báo tự động** tới nhân sự trực. (Hiện repo chỉ có `/health` + audit nghiệp vụ — stack giám sát là hạng mục **dựng thêm**, `docs/HUONG-DAN-TRIEN-KHAI-VA-HSMT.md:144`.)
- **WAF/IDS** (dòng 68/77): WAF tại LB (mục 5) + IPS/IDS tại biên TTDL; **rate-limit tập trung** khi chạy đa instance (mục 5.3); bổ sung security headers (HSTS/CSP) tại tầng Web/LB.
- Toàn bộ đồng bộ với **hồ sơ xác định cấp độ an toàn hệ thống thông tin cấp độ 3** (NĐ 85/2016, TT 12/2022 — dòng 71, 527–528) và kế hoạch `docs/ho-so/09` (Giai đoạn 3, checklist ATTT cấp độ 3).

---

## 10. Giải trình phương án tương đương (thế thủ)

Trường hợp TTDL TP cấp tài nguyên **dạng khác** bảng 7 VM (ví dụ: nền tảng private cloud, container platform Kubernetes, hoặc gộp/tách khác đi), Nhà thầu **cam kết đáp ứng tương đương** về **số bản sao, mức tách cụm và năng lực tính toán**, theo bảng quy đổi:

| Yêu cầu HSMT (bản chất) | Đại lượng bất biến phải giữ | Cách đáp ứng trên nền tảng khác |
|---|---|---|
| Web-Server × 2 (dòng 320) | ≥ 2 bản Web sau cân bằng tải | ≥ 2 replica pod/instance Web + service LB |
| App-Server × 2 (dòng 321) | ≥ 2 bản App | ≥ 2 replica pod/instance App |
| Database-Server × 2 (dòng 319) | 2 node DB có chuyển mạch tự động | AG/replica 2 node hoặc dịch vụ DB quản lý có HA, giữ **CSDL tập trung** |
| File-Server × 1 (dòng 322) | Object storage tách khỏi DB | Bucket S3/MinIO/dịch vụ tương đương |
| Tách 4 cụm (dòng 312–315) | Phân vùng mạng/logic Web/App/DB/File | Namespace/network policy tách 4 tầng |
| Tổng năng lực (32C/64G ×2 + 16C/32G ×4 + 8C/16G) | ≈ **144 vCPU / 288 GB RAM** tổng | Cấp tài nguyên tổng tương đương |

**Khẳng định:** mọi phương án tương đương vẫn **tuân thủ nguyên tắc "CSDL tập trung tại Trung tâm tích hợp dữ liệu thành phố"** (dòng 310) — không phân tán DB về từng đơn vị. Phương án tương đương chỉ áp dụng khi có **văn bản xác nhận của TTDL** về dạng tài nguyên cấp phát (câu hỏi làm rõ tại mục 12 và `docs/ho-so/10-van-ban-lam-ro-hsmt.md`).

---

## 11. Lộ trình chuyển đổi từ bản 1-node hiện tại (không mất dữ liệu)

Khớp kế hoạch 12 tuần (`docs/ho-so/09-ke-hoach-trien-khai.md`). Nguyên tắc: **vận hành song song trước khi cắt chuyển**, có điểm rollback ở mỗi bước.

| Bước | Công việc | Mốc (theo `docs/ho-so/09`) | Điểm rollback |
|---|---|---|---|
| 1 | TTDL cấp **7 VM** theo bảng mục 3 + dải IP/VLAN từng zone + LB/VIP | Giai đoạn 1–2 (Tuần 1–4) | Chưa đụng hệ đang chạy |
| 2 | Cài nền: Windows Server + IIS + .NET 8 (Web/App); **SQL Server 2022 Standard + WSFC + AG** (DB); MinIO + SSE (File) | Giai đoạn 2 (Tuần 3–4) | Giữ bản 1-node làm hệ chính |
| 3 | **Migrate DB** bằng backup/restore: `backup-mssql.sh` từ bản hiện tại → `restore-mssql.sh` vào AG primary; seed đồng bộ vào secondary | Giai đoạn 2 (Tuần 3–4) | Bản backup gốc còn nguyên; hệ cũ vẫn chạy |
| 4 | **Bật `S3_*` + migrate file**: đẩy tệp base64 tồn đọng sang MinIO; xác nhận bản ghi mới dùng `storageKey`/`contentUrl` | Giai đoạn 2–3 | Bản ghi cũ còn `dataUrl` vẫn đọc được (tương thích ngược) |
| 5 | Cấu hình **LB/WAF** (health-check `/health`, sticky, WS passthrough, TLS) + rate-limit tầng LB; kết nối App bằng `MultiSubnetFailover=True` | Giai đoạn 3 (Tuần 5–6) | Chưa chuyển DNS → người dùng vẫn trên hệ cũ |
| 6 | **Vận hành song song**: chạy hệ mới cạnh hệ cũ; loadtest 90 CCU (`scripts/loadtest.mjs`), diễn tập HA/DR (mục 8) | Giai đoạn 4 (Tuần 7–8) | Chưa cắt chuyển; so sánh số liệu |
| 7 | **Cắt chuyển**: đồng bộ DB lần cuối (delta) → **chuyển DNS/VIP** sang hệ mới → theo dõi | Giai đoạn 5–6 (Tuần 9–11) | Trỏ DNS về hệ cũ nếu phát hiện lỗi (hệ cũ giữ nóng vài ngày) |
| 8 | Nghiệm thu, gỡ hệ cũ sau thời gian theo dõi ổn định | Giai đoạn 7 (Tuần 12) | — |

> Phần **Redis backplane** (mục 5.3) **đã tích hợp sẵn trong mã** (gated qua `REDIS_URL`, có test) → khi chốt scale ngang đầy đủ chỉ cần **cấp dịch vụ Redis + bật env** (không còn là hạng mục phát triển). Nếu chưa dựng Redis, sticky session (ngắn hạn) vẫn dùng được để cắt chuyển đúng tiến độ.

---

## 12. Checklist làm việc với Trung tâm dữ liệu TP (TTDL)

Danh sách yêu cầu/câu hỏi cụ thể cần TTDL xác nhận bằng **biên bản** (đồng bộ `docs/ho-so/09` Giai đoạn 1 và câu hỏi làm rõ `docs/ho-so/10`):

1. **Cấp 7 VM** đúng bảng mục 3 (32C/64G/500G ×2 · 16C/32G/200G ×2 Web · 16C/32G/200G ×2 App · 8C/16G Ubuntu ×1) trên nền ảo hóa. Nếu cấp dạng khác → xác nhận để áp phương án tương đương (mục 10).
2. **Thiết bị cân bằng tải + VIP**: có/không thiết bị LB chuyên dụng; nếu có, cấp VIP + cấu hình health-check `/health`, sticky session, WebSocket passthrough `/api/realtime`, TLS termination.
3. **Thiết bị bảo mật/WAF/IDS**: có sẵn hay Nhà thầu tự dựng software (mục 5.2)?
4. **Dải IP/VLAN từng zone** (DMZ / App / DB / File / management) + chính sách firewall giữa zone (mục 2, 9).
5. **Quyền cài đặt**: quyền admin trên VM để cài IIS/.NET/SQL Server/MinIO; hay TTDL cài theo yêu cầu?
6. **Bản quyền Windows Server (6 VM) và SQL Server 2022 Standard (2 VM DB)**: do **bên nào** mua/cung cấp (Chủ đầu tư/TTDL/Nhà thầu)? *(🏛️ điểm pháp nhân bắt buộc chốt sớm — ảnh hưởng chi phí và tiến độ.)*
7. **Chứng chỉ TLS** cho tên miền công khai: do TP cấp (CA nội bộ) hay dùng Let's Encrypt; định dạng bàn giao.
8. **NTP/DNS nội bộ**: TTDL cung cấp máy chủ NTP + vùng DNS nội bộ hay Nhà thầu tự dựng trong management zone?
9. **Cổng UDP cho LiveKit self-host** (nếu chọn họp trực tuyến self-host tại TTDL thay LiveKit Cloud): mở `7880/tcp`, `7881/tcp`, dải `50000–60000/udp` (`docs/HUONG-DAN-TRIEN-KHAI-VA-HSMT.md:59`).
10. **Quorum witness** cho WSFC (file share/cloud witness) — vị trí đặt.
11. **Lưu trữ media dài hạn** cho VM File (dung lượng 60 tháng video/media) + khả năng RAID/snapshot; khả năng cấp thêm 1 VM cho lộ trình MinIO 2-node (mục 7).
12. **Kết nối LGSP/IOC** (đồng bộ `docs/ho-so/10`): endpoint + đặc tả kỹ thuật để đấu nối từ App zone.

---

## Phụ lục — Phân định trách nhiệm (làm được bằng cấu hình/mã vs cần TTDL/pháp nhân)

| Hạng mục | ⚙️ Cấu hình/mã (Nhà thầu làm được) | 🏛️ Cần TTDL / pháp nhân |
|---|---|---|
| Tách 4 cụm / nhân bản 2 node mỗi cụm | Đóng gói, cấu hình chạy đa instance | Cấp 7 VM, ảo hóa |
| Cân bằng tải + WAF | HAProxy/nginx + ModSecurity (dự phòng) | Thiết bị LB/WAF chuyên dụng + VIP |
| State per-process (dự phòng) | — | Sticky session + rate-limit tại LB |
| State per-process (khuyến nghị) | **Redis backplane ĐÃ CÓ** — bật `REDIS_URL` + profile `scale` | Cấp dịch vụ Redis (1 VM, có thể HA) |
| DB HA | Cấu hình WSFC + AG + `MultiSubnetFailover=True` | **License SQL Server Standard + Windows** |
| Tách file MinIO + SSE | Bật `S3_*`, cấu hình SSE, backup bucket | Cấp VM File + dung lượng media |
| Mã hóa at-rest | TDE (SQL) + SSE (MinIO) | Mã hóa **cơ yếu** cho dữ liệu mật (Ban Cơ yếu) |
| TLS 1.2+ end-to-end | Pin cấu hình, đóng cổng HTTP | Chứng chỉ TLS do TP cấp |
| Giám sát 24/7 + log tập trung | Dựng Prometheus/Grafana/Uptime + ELK | Nhân sự trực 24/7 |
| Kiểm chứng SQL Server thật (💣6) | Chạy compose/native, lấy biên bản | Instance MSSQL thật trên hạ tầng đích |

---

**ĐẠI DIỆN NHÀ THẦU**
[Chức vụ]

[Họ tên]
*(Ký, ghi rõ họ tên, đóng dấu)*

**CHỦ ĐẦU TƯ / TRUNG TÂM DỮ LIỆU XÁC NHẬN HẠ TẦNG**
(Ký, ghi rõ họ tên, đóng dấu)

---

*Tài liệu số 12 trong bộ hồ sơ dịch vụ eCabinet (`docs/ho-so/`). Là lời giải cho khoảng cách hạ tầng lớn nhất (bom 💣1) tại `docs/ra-soat/2026-07-20/rasoat-toandien-techleader.md`; đồng thời khép các bom 💣2 (tách file), 💣4 (mã hóa at-rest), 💣5 (HA/chuyển mạch tự động), 💣6 (SQL Server Standard). Mọi con số cấu hình máy chủ trích đúng bảng E-HSMT dòng 318–322.*
