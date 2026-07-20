# RÀ SOÁT TOÀN DIỆN PHẦN SERVER / HẠ TẦNG / KỸ THUẬT / VẬN HÀNH / NGHIỆM THU
## eCabinet (HPT TECH) — đối chiếu TỪNG MỤC HSMT Chương V với CODE + HẠ TẦNG THẬT

**Người thực hiện:** Tech Leader
**Ngày:** 20/07/2026
**Nguồn chuẩn:** `docs/hsmt-chuong-v.md` (669 dòng, đã đọc TOÀN VĂN phần kỹ thuật, KHÔNG lướt)
**Nguyên tắc:** KHÔNG tin ma trận cũ. Mọi kết luận tự đối chiếu lại với file/dòng code thật (`server/`, `server-dotnet/`, `docker-compose*.yml`, `nginx.conf`, `deploy/`) + test đã chạy lại (Node **119/119**, .NET **173/173**, build-cdn PASS) + curl hạ tầng thật.
**Cảnh báo đã kiểm chứng:** hệ thống test XANH toàn bộ **KHÔNG** chứng minh đáp ứng HSMT — test chỉ phủ tầng ứng dụng (ACL/CRUD/CAS/blob thuần), KHÔNG phủ hạ tầng, SLA, mã hóa, HA. Đây chính là lớp ngụy trang khiến "bom nổ chậm" khó lộ.

---

## 0. TÓM TẮT ĐIỀU HÀNH (đọc trước)

- **Phát hiện 9 "bom nổ chậm" 💣** (chi tiết mục cuối). Nghiêm trọng nhất đều nằm ở **phần server/hạ tầng** — đúng như chủ dự án lo.
- **Khoảng cách LỚN NHẤT: mô hình triển khai máy chủ.** HSMT (dòng 308–322) mô tả **4 cụm server tách biệt, 7 máy ảo, có cân bằng tải + thiết bị bảo mật**. Bản triển khai thật (`docker-compose.dotnet.yml`) là **1 node gộp tất cả**, KHÔNG có cân bằng tải/WAF/HA/máy dự phòng/NTP/DNS nội bộ. Vụ "Server-File" đã vá (thêm MinIO) nhưng **GATED tắt mặc định** và **3 cụm còn lại vẫn gộp**.
- **Vụ Server-File CHƯA đóng hẳn:** MinIO có trong compose nhưng để trống `S3_*` → **mặc định vẫn nhồi base64 vào cột NVARCHAR(MAX) của DB**. Nếu chủ dự án/tổ chấm dựng bản mặc định → lỗi cũ tái diễn nguyên vẹn.
- Nền tảng .NET 8 + MSSQL 2022 + Windows: **code sẵn** nhưng **CHƯA chạy trên MSSQL/Windows thật** (dev không có). SqlServerDocStore tự thừa nhận "chưa chạy trên SQL Server thật" (dòng 15–16).
- SLA (500 user/90 CCU, <5s): **CHƯA có số liệu thật** — số p95=210ms trong `docs/loadtest.md` là **ví dụ mẫu**, không phải kết quả chạy (dòng 5 ghi rõ "CHƯA chạy thử thật").

---

## 1. BẢNG ĐỐI CHIẾU TỪNG MỤC

Cột **Trạng thái:** ✅ đáp ứng · 🟡 một phần · ❌ thiếu/chưa · ⚙️ code sẵn cần cấu hình/vận hành · 🏛️ pháp nhân/bên ngoài · 💣 bom nổ chậm (báo cáo cũ nói ổn / chỉ lộ khi chạy thử).

### A. MÔ HÌNH TRIỂN KHAI MÁY CHỦ (TRỌNG TÂM — nơi "Server-File" đã lọt)

| HSMT dòng | Yêu cầu (trích nguyên văn) | Trạng thái | Bằng chứng code/hạ tầng (file:dòng) | Việc phải làm |
|---|---|---|---|---|
| **312** | "**Cụm Server-Web**: Các module web cần được public… đặt qua các thiết bị bảo mật, **thiết bị cân bằng tải** và các thiết bị mạng chuyên dụng" | 💣❌ | `docker-compose.dotnet.yml` chỉ có 1 service `web` (nginx, 1 bản, `ports 8081:80`). KHÔNG có cân bằng tải, KHÔNG có 2 bản web. `grep -i "load.balanc\|cân bằng tải\|waf"` toàn bộ infra → **0 kết quả** | Dựng ≥2 Web node sau LB (HAProxy/nginx LB/thiết bị TTDL) + WAF |
| **313** | "**Cụm Server-App**: các module tiến trình xử lý nghiệp vụ" | 💣🟡 | 1 service `api` (`docker-compose.dotnet.yml:47`). Web và App **gộp về ý niệm** (nginx `web` chỉ proxy `/api`→`api:3000`, `nginx.conf:27`). Không tách 2 cụm vật lý, không 2 bản App | Tách/hoặc giải trình mô hình container tương đương; chạy ≥2 bản API |
| **314** | "**Cụm Server-Database**: Xử lý lưu trữ, truy xuất dữ liệu" | ⚙️🟡 | 1 service `db` (SQL Server 2022 **Express**, `docker-compose.dotnet.yml:124-129`). Express giới hạn **10GB/DB + 1 socket CPU + ~1.4GB RAM** — KHÔNG đủ cho sizing HSMT | Dùng **Standard/Enterprise** (README A6 bước 2 có nhắc Standard nhưng compose vẫn Express) |
| **315** | "**Cụm Server-File**: Xử lý lưu trữ file như **video, media, tệp đính kèm**" | 💣⚙️ | MinIO có (`docker-compose.dotnet.yml:86-121`) NHƯNG **GATED**: `S3_*` để trống mặc định (dòng 70–75) → `BlobStore.cs:47-49` trả `null` → base64 GIỮ trong cột `data NVARCHAR(MAX)` (`SqlServerDocStore.cs:59`). **Mặc định = lỗi cũ.** Video/media: KHÔNG có luồng riêng — LiveKit chỉ mint token, media không lưu | Bật `S3_*` khi triển khai + kiểm chứng (README 6.1). Làm rõ lưu video/ghi hình họp |
| **318–322** | Bảng cấu hình: **Database 32C/64G/500G ×2; Web 16C/32G/200G ×2; App 16C/32G/200G ×2; File 8C/16G Ubuntu ×1** = **7 máy ảo** | 💣❌ | Không file hạ tầng nào phản ánh 7 VM/2 bản mỗi cụm. `docker-compose.dotnet.yml` = **1 host, 1 bản mỗi service**. `docs/HUONG-DAN…:11-17` khuyến nghị 8–16 vCPU gộp — **không khớp bảng HSMT** | Lập sơ đồ triển khai đúng 7 VM (hoặc giải trình ảo hóa tương đương) đưa vào hồ sơ kỹ thuật |
| **310–311** | "cài đặt **tập trung tại Trung tâm tích hợp dữ liệu thành phố**… công nghệ **ảo hóa**" | 🏛️⚙️ | Compose chạy Docker 1 host; TTDL TP cấp hạ tầng (HSMT dòng 161). Ảo hóa/đặt máy do TTDL | Phối hợp TTDL nhận 7 VM, cài đặt theo sơ đồ |

> **Kết luận cụm A:** vụ Server-File chỉ là **1 trong 4** khe hở của mô hình triển khai. Ba cụm còn lại (Web×2/App×2/DB×2 + cân bằng tải) **vẫn gộp về 1 node** — đây là khoảng cách server lớn nhất và gần như chắc chắn bị tổ chấm soi khi đối chiếu "Phương án kỹ thuật ↔ bảng dòng 318".

### B. NỀN TẢNG CÔNG NGHỆ

| HSMT dòng | Yêu cầu | Trạng thái | Bằng chứng | Việc phải làm |
|---|---|---|---|---|
| **332** | "Nền tảng lập trình: **.NET**" | ✅ | `server-dotnet/ECabinet.Api` ASP.NET Core 8, build+test 173/173 (`Program.cs`) | — |
| **333** | "HQTCSDL: **Microsoft SQL Server 2022 trở lên**" | 💣⚙️ | Image `mcr.microsoft.com/mssql/server:2022-latest` (`docker-compose.dotnet.yml:124`) NHƯNG `SqlServerDocStore.cs:15-16` **tự ghi: "chưa chạy trên SQL Server thật trong sandbox"**. Test nghiệm thu chạy **InMemoryDocStore**, KHÔNG phải MSSQL | Chạy thật trên instance MSSQL 2022 (README A1); biên bản xác nhận tạo bảng/CAS/seed |
| **334** | "HĐH máy chủ: **Windows server (2019) hoặc cao hơn, Linux**" | 🟡 | Chạy Docker/Linux được; Windows+IIS chỉ **outline 6 bước** (`docs/HUONG-DAN…:110-117`, README m.11) — **chưa thực thi** | Nếu HSMT bắt buộc Windows: dựng IIS thật lấy bằng chứng |
| **544** | "Phụ thuộc: MS SQL Server, Windows Server, Visual Studio, **.NET 8.0 trở lên**" | ✅ | .NET 8 khớp | — |
| **336/560** | Hỗ trợ Edge/Firefox/Chrome/**Cốc Cốc** | ⚙️ | FE React/Vite chuẩn (chạy mọi trình duyệt Chromium/Gecko). Cốc Cốc = Chromium → tương thích; chưa có biên bản test từng trình duyệt | Test tương thích trình duyệt trong vận hành thử |

### C. ATTT / MÃ HÓA / TLS / IPv6 / SAO LƯU / HA

| HSMT dòng | Yêu cầu | Trạng thái | Bằng chứng | Việc phải làm |
|---|---|---|---|---|
| **71 / 527–528** | "**ATTT Cấp độ 3**" (NĐ 85/2016, TT 12/2022) | 🏛️❌ | KHÔNG có hồ sơ cấp độ trong repo; chưa pentest độc lập. `HUONG-DAN…:150` xếp 🔴 pháp nhân | Lập hồ sơ cấp độ 3 + pentest (6–8 tuần, bên ngoài) — **bắt buộc TRƯỚC vận hành** |
| **75 / 151(guide)** | "dữ liệu bắt buộc phải **mã hóa… bằng mật mã cơ yếu** khi lưu trữ, truyền, nhận" | 💣❌ | **KHÔNG có mã hóa at-rest** (`grep at-rest/SSE/TDE/cơ yếu` trong `server*/` → 0). `tach-file…md §7.6` tự thừa nhận "Chưa có… mã hóa at-rest". Mật khẩu có PBKDF2 (`Auth.cs:47-57`) nhưng đó KHÔNG phải mã hóa dữ liệu nghiệp vụ | TDE cho MSSQL / SSE cho MinIO; mã hóa cơ yếu do Ban Cơ yếu (🏛️) |
| **550** | "HTTPS **TLS v1.2 trở lên** với bộ mã hóa an toàn" | 💣🟡 | `nginx.conf:1-2` chỉ `listen 80` (HTTP thuần). TLS **chỉ khi bật profile Caddy** (`docker-compose.dotnet.yml:163-187`, tùy chọn) và **KHÔNG pin phiên bản** — `grep tls1.2/ssl_protocols` → **0 kết quả**. Caddy mặc định ≥TLS1.2 nhưng không khai báo tường minh; cổng 8081 HTTP vẫn mở song song | Bật TLS bắt buộc; **pin `min_version tls1.2`**; đóng cổng HTTP; đưa cipher-suite vào cấu hình |
| **549** | "sẵn sàng **IPv6**" | ✅ | `Program.cs:22` bind `[::]` dual-stack; `nginx.conf:3` `listen [::]:80`; `Caddyfile` dual-stack | — (còn phụ thuộc hạ tầng TTDL cấp IPv6) |
| **523 / 593–597** | "tự động **sao lưu** theo lịch… phục hồi từ bản sao lưu" (gồm **cấu hình + nội dung + dữ liệu khác**) | 💣⚙️ | `deploy/backup-mssql.sh` sao lưu **DB** tốt (cron mẫu). NHƯNG khi bật S3, **bucket MinIO KHÔNG được backup tự động** — chỉ ghi chú thủ công `mc mirror` (`HUONG-DAN…:86`). → tách file xong thì **file nằm ngoài backup DB** = rủi ro mất tệp | Thêm job backup bucket vào cùng lịch; kiểm thử phục hồi CẢ DB+file |
| **91–95 / 41–43** | Gián đoạn **≤3 lần/năm**, RTO **24h**, phục hồi **100%** | ⚙️🟡 | `docs/dr-runbook.md` có quy trình + `test-restore.sh` đo thời gian. Nhưng dòng 137 tự ghi "RTO 24h **chỉ tính phần kỹ thuật backup+restore DB**", chưa tính phát hiện+điều phối. "≤3 lần/năm" ghi "ngoài phạm vi" (dr-runbook:7) | Diễn tập DR thật, ghi số; cần HA để đạt "≤3 gián đoạn" |
| **98 / 117 / 4.4.2** | "thay thế thành phần **không gián đoạn**… **dự phòng và chuyển mạch tự động**" (HA/failover) | 💣❌ | KHÔNG có HA/replica/failover/standby. `grep failover/replica/chuyển mạch` infra → **0**. 1 bản mỗi service = **single point of failure** toàn hệ | Triển khai HA thật (2 bản mỗi cụm + LB health-check + DB replica/AlwaysOn) |
| **99 / 615 / 565** | "kiểm tra, **giám sát liên tục 24/7**, cảnh báo tự động, nhật ký theo dõi" | ⚙️❌ | Chỉ có `/health` (`App.cs:270`) + audit nghiệp vụ. KHÔNG có Prometheus/Grafana/Uptime-Kuma/alerting trong repo (`HUONG-DAN…:144` xếp "cần dựng thêm, ngoài repo") | Dựng stack giám sát + cảnh báo + trực 24/7 (🏛️ nhân sự) |
| **68 / 77** | "**chống truy cập bất thường**, tường lửa ứng dụng, phát hiện–ngăn chặn xâm nhập" (WAF/IDS) | 💣❌ | Có rate-limit **in-memory** (`RateLimit.cs`, `App.cs:66-80`) nhưng **1 instance** (nhiều bản → không chia sẻ, cần Redis — `RateLimit.cs:11` tự ghi). KHÔNG có WAF/IDS. KHÔNG có security headers (HSTS/CSP/X-Content-Type) — `ApplyCors` chỉ set CORS (`App.cs:96-114`) | Thêm WAF (ModSecurity)/IDS; rate-limit tập trung (Redis) khi ≥2 bản; thêm security headers |
| **69 / 83 / 3.2** | "**lưu vết** và tra cứu hành động người dùng" (audit) | ✅ | Audit ghi đăng nhập, mở/đóng biểu quyết, điểm danh, giấy mời, khai/bế mạc, ký số (`Actions.cs:53-317`, `index.js` c_audit). Admin xem, không sửa, admin xóa (`acl.js:51`) | — (bổ sung log tập trung/không-sửa cho cấp độ 3) |
| **394 / 36** | Phân quyền theo vai trò | ✅ | 5 vai trò + ACL + guard đa đơn vị + tài liệu mật + phiếu kín; test 33 ca multitenant PASS (`Guard.cs`, `Access.cs`) | — |

### D. HIỆU NĂNG / SLA (số liệu cụ thể)

| HSMT dòng | Yêu cầu | Trạng thái | Bằng chứng | Việc phải làm |
|---|---|---|---|---|
| **62 / 531 / 535** | "<5s/thao tác; **500 user, 90 CCU**" | 💣⚙️ | Có công cụ `scripts/loadtest.mjs`. NHƯNG `docs/loadtest.md:5` ghi rõ **"CHƯA chạy thử thật"**; bảng p95=210ms (dòng 73–83) là **VÍ DỤ MẪU minh họa định dạng**, KHÔNG phải số đo thật | Chạy loadtest 90 CCU trên hạ tầng đích, lấy số thật vào hồ sơ SLA |
| **532** | "tra cứu <**30s**" | 🟡 | Không có bước đo tra-cứu-đa-điều-kiện trong kịch bản mặc định (`loadtest.md:15` tự ghi "không có endpoint riêng") | Bổ sung kịch bản đo tra cứu |
| **533** | "báo cáo tổng hợp toàn TP <**5 phút**, không timeout" | ❌ | `loadtest.md:16` ghi "ngoài phạm vi script" — chưa đo với dữ liệu nhiều năm/nhiều đơn vị | Sinh dữ liệu lớn + đo kết xuất báo cáo |
| **534** | ">10s phải có **biểu tượng chờ**" | ⚙️🟡 | Cần xác minh FE có spinner toàn cục cho tác vụ dài — chưa kiểm trong rà soát này | Kiểm/bổ sung indicator |
| **63 / 267** | "mở rộng **không giới hạn** người dùng" | 🟡 | Kiến trúc stateless-ish nhưng rate-limit + WS in-memory 1 bản → **scale ngang cần Redis/sticky** | Thiết kế scale-out (Redis, WS adapter) |

### E. KẾT NỐI / LIÊN THÔNG / CHUẨN

| HSMT dòng | Yêu cầu | Trạng thái | Bằng chứng | Việc phải làm |
|---|---|---|---|---|
| **290 / 306 / 340** | Tích hợp **LGSP** TP; sẵn sàng **NGSP** | ⚙️🏛️ | Open API sẵn (`OpenRoutes.cs`, `open.js`, 14 ca test open/rtc PASS): khóa API + scope + `/documents/{id}/content`. Nhưng **endpoint LGSP thật do TP cấp** — chưa đấu nối | Lấy đặc tả + endpoint LGSP TP, đấu nối thật |
| **636** | "kết nối **IOC** chỉ sau vận hành thử ổn định" | 🏛️ | Phụ thuộc nghiệm thu + IOC TP | Theo trình tự nghiệm thu |
| **328 / 545** | "trao đổi dữ liệu cấu trúc **XML** (CV 3788/2014)" | 💣🟡 | API hiện trả **JSON** (`OpenApiCatalog.cs`, `openapi.js`). HSMT dẫn CV 3788 về **XML**. Nếu tổ chấm hiểu bắt buộc XML liên thông → thiếu tầng XML | Làm rõ (văn bản làm rõ) hoặc bổ sung XML adapter cho LGSP |
| **327 / 339** | NĐ 278/2025; **Khung CQĐT TP HP v4.0** (QĐ 4435/QĐ-UBND) | 🏛️🟡 | Chưa có bằng chứng đối chiếu khung kiến trúc TP | Đối chiếu khung v4.0, đưa vào thuyết minh |
| **326 / 80(4.1.1)** | Định dạng tệp theo **TT 39/2017** | ✅ | Whitelist định dạng tệp (`guard.js`, `Guard.cs`, test 7-FILE-WHITELIST 6 ca PASS); storageKey cũng coi là "có tệp" chặn đổi đuôi cấm | — |
| **524 / 562** | Unicode **TCVN 6909:2001** | ✅ | Test 8-UNICODE 5 ca PASS (chuẩn hóa NFC, chống lẫn mã) | — |

### F. VẬN HÀNH / BẢO TRÌ / ĐÀO TẠO / NGHIỆM THU

| HSMT dòng | Yêu cầu | Trạng thái | Bằng chứng | Việc phải làm |
|---|---|---|---|---|
| **147–224** | Quản trị vận hành theo **PL 11 TT 18/2024** | ⚙️🟡 | `docs/ho-so/04-quy-trinh-quan-tri-van-hanh.md` có; thực thi cần đội vận hành | Bố trí nhân sự vận hành thật |
| **226–252** | Bảo trì theo **PL 12 TT 18/2024** (gồm **vá lỗ hổng OS/DB/webserver**) | ⚙️🟡 | `05-quy-trinh-bao-tri.md` có quy trình; vá bản OS/DB/nginx cần lịch vận hành thật + gia hạn bản quyền ATTT (HSMT dòng 251) | Lập lịch vá + hợp đồng dịch vụ ATTT |
| **254–260** | **Nghiệm thu/vận hành thử** (Đ.58 NĐ 73/2019; PL II TT 16/2024) | ⚙️🟡 | `03-kich-ban-kiem-thu-van-hanh-thu.md` sẵn kịch bản; cần chạy thật có giám sát + biên bản | Tổ chức vận hành thử chính thức |
| **122–144** | Đào tạo 2 nhóm (quản trị + sử dụng), tài liệu | ⚙️✅ | `08-giao-trinh-dao-tao.md`, `11-tai-lieu-hdsd…md` sẵn | Tổ chức lớp thật |
| **599–631** | Nhà cung cấp: hỗ trợ **24/7** + tổng đài giờ HC, báo cáo 6 tháng, chuyển giao dữ liệu | 🏛️ | Hồ sơ cam kết SLA (`02-cam-ket-sla.md`) + chuyển giao (`06-…`) sẵn; **thực thi = nhân sự/pháp nhân 60 tháng** | Bố trí NOC/tổng đài; ký cam kết |
| **30–37** | Ứng dụng di động **Android/iOS** | 💣🟡 | `capacitor.config.ts` + PWA; nhưng **app native build cần máy ngoài** (báo cáo cũ: "app native đóng gói 0/38"). Tổ chấm đòi APK/IPA thật → thiếu | Build & thử APK/IPA thật trên thiết bị |
| **30 / 373** | **Ký số** ý kiến/biên bản | 💣🏛️ | **100% MÔ PHỎNG** (serial `VN-DEMO-CA:…`, PIN regex 6 số) ở CẢ 2 luồng (`doi-chieu…:228`). KHÔNG đối chiếu CA thật | Hợp đồng CA (VGCA/VNPT SmartCA) + SDK thật (🏛️) |

---

## 2. 💣 DANH SÁCH BOM NỔ CHẬM (xếp theo mức nghiêm trọng)

> Định nghĩa: mục mà (a) báo cáo/ma trận cũ ngụ ý ổn nhưng **thực tế KHÔNG**, hoặc (b) chỉ lộ khi **chạy thử thật / tổ chấm đối chiếu tài liệu**. Kèm lý do dễ bị bỏ sót.

| # | Bom | Mức | Vì sao báo cáo cũ tưởng ổn / vì sao dễ sót | Lộ khi nào |
|---|---|---|---|---|
| **💣1** | **Mô hình 4 cụm / 7 VM / cân bằng tải chưa triển khai** (HSMT 312–322) — chỉ vá được Server-File, còn Web×2/App×2/DB×2 + LB/WAF **vẫn gộp 1 node** | **CỰC CAO** | Vụ Server-File được vá xong tạo cảm giác "đã đóng vấn đề hạ tầng"; thực ra mới đóng **1/4**. Compose 1-node nhìn "chạy được" nên không ai soi lại bảng dòng 318 | Tổ chấm đối chiếu "Phương án kỹ thuật ↔ bảng cấu hình máy chủ HSMT" — **gần như chắc chắn** |
| **💣2** | **Tách file GATED — mặc định vẫn base64 trong DB** (HSMT 315/521-522) | **CAO** | Báo cáo `tach-file-object-storage.md` XANH 27–30 ca test → tưởng "đã tách file". Nhưng test dùng **blobStore in-memory giả**; mặc định `S3_*` trống → `BlobStore.cs:47` trả null → **base64 y như lỗi cũ**. Chính là cùng cơ chế "bom" ban đầu, chỉ lùi 1 bước | Dựng bản mặc định rồi upload PDF → `SELECT` thấy base64 trong `data`. Chủ dự án đã bắt kiểu này 1 lần |
| **💣3** | **SLA chưa có số thật — số p95 trong loadtest.md là VÍ DỤ MẪU** (HSMT 62/531-535) | **CAO** | Ai lướt `docs/loadtest.md` thấy bảng "p95=210ms · ĐẠT" dễ tưởng đã đo. Dòng 5 ghi "CHƯA chạy thử thật" nằm phía trên, dễ bỏ qua | Tổ chấm hỏi "biên bản loadtest 90 CCU đâu?" / vận hành thử |
| **💣4** | **Không mã hóa at-rest / cơ yếu** (HSMT 75/527) | **CAO** | Có PBKDF2 mật khẩu + TLS on-transit → tưởng "đã mã hóa". Nhưng dữ liệu nghiệp vụ (tài liệu mật, biểu quyết) **lưu thô** trong DB/MinIO. `tach-file…§7.6` thừa nhận, nhưng nằm cuối tài liệu | Pentest cấp độ 3 / kiểm tra ATTT bắt buộc trước vận hành |
| **💣5** | **Không HA/failover — single point of failure** (HSMT 98/117) | **CAO** | Yêu cầu "chuyển mạch tự động" nằm rải ở mục tin cậy 4.4.2, không ở phần hạ tầng → dễ sót. 1 bản mỗi service vẫn "chạy tốt" lúc demo | Sự cố thật / tổ chấm hỏi phương án dự phòng; và mâu thuẫn với "≤3 gián đoạn/năm" |
| **💣6** | **MSSQL chỉ chạy InMemory khi test — CHƯA kiểm chứng SQL Server thật; compose lại dùng Express** (HSMT 333) | TRUNG-CAO | 173/173 test PASS tạo cảm giác "MSSQL OK". `SqlServerDocStore.cs:15-16` tự thú nhận chưa chạy MSSQL thật; test dùng InMemory. Express không đủ sizing | Chạy thật gặp lỗi cú pháp T-SQL/ISJSON/CAS; Express đụng trần 10GB |
| **💣7** | **Backup bỏ sót bucket file khi đã tách** (HSMT 523/593-597 "sao lưu… nội dung") | TRUNG-CAO | `backup-mssql.sh` chạy tốt → tưởng "đã backup đủ". Nhưng sau khi tách file sang MinIO, script **chỉ backup DB**; bucket chỉ có ghi chú thủ công | Khôi phục sau sự cố → DB về nhưng **tệp/video mất** |
| **💣8** | **Liên thông XML (CV 3788) — API đang JSON** (HSMT 328/545) | TRUNG BÌNH | "Có Open API" được tính là đáp ứng kết nối. Nhưng CV 3788 nói **XML có cấu trúc**; nếu LGSP TP đòi XML → thiếu adapter | Khi đấu nối LGSP thật / tổ chấm chiếu CV 3788 |
| **💣9** | **App di động native chưa build; ký số mô phỏng** (HSMT 30-37/373) | TRUNG BÌNH | "PWA chạy trên mobile" được tính 37/38 → tưởng đủ. Nhưng HSMT nói nền tảng Android/iOS; APK/IPA chưa có; ký số `VN-DEMO-CA` | Tổ chấm đòi cài APK/IPA + chữ ký số hợp pháp |

**Ghi chú "con số chức năng" (báo cáo cũ tự mâu thuẫn):** `doi-chieu-hsmt-cuoi-ngay.md` cùng lúc ghi **50/59** (chỉ ✅ thuần), **57/59**, và **58/59** tùy cách đếm; ký số 100% mô phỏng. → **Không dùng "58/59" như bằng chứng đáp ứng**; đây đúng loại "ma trận từng sai" chủ dự án cảnh báo.

---

## 3. KẾT LUẬN — "PHẦN SERVER CÒN KHOẢNG CÁCH LỚN NHẤT Ở ĐÂU"

**Khoảng cách lớn nhất, rõ ràng nhất, và chắc bị bắt: MÔ HÌNH TRIỂN KHAI MÁY CHỦ (💣1).**
HSMT vẽ **4 cụm tách biệt, 7 máy ảo, có cân bằng tải + thiết bị bảo mật + File-server Ubuntu riêng** (dòng 308–322). Bản triển khai thật là **một node Docker gộp Web+App+DB+File**, không LB, không WAF, không HA, không NTP/DNS nội bộ, DB còn là **Express**. Việc vá "Server-File" (thêm MinIO) mới lấp **1/4** khe hở, và bản thân nó còn **GATED tắt mặc định** (💣2). Đây chính xác là họ "bom" đã nổ lần trước, chỉ khác vị trí.

**Ba khối phải làm cho phần server, ưu tiên giảm dần:**
1. **Kiến trúc hạ tầng thật (💣1,💣5):** lập sơ đồ đúng 7 VM/4 cụm (hoặc giải trình ảo hóa tương đương) + cân bằng tải + WAF + HA/failover + DB Standard(+AlwaysOn) — phối hợp TTDL TP. Không có cái này, thuyết minh kỹ thuật **lệch thẳng** bảng HSMT.
2. **Kiểm chứng vận hành thật (💣2,💣3,💣6,💣7):** bật `S3_*` + xác nhận DB hết base64; chạy MSSQL 2022 Standard thật (bỏ InMemory/Express); chạy loadtest 90 CCU lấy **số thật** thay ví dụ mẫu; thêm backup bucket + diễn tập phục hồi CẢ DB+file.
3. **ATTT bắt buộc trước vận hành (💣4 + hồ sơ cấp độ 3):** mã hóa at-rest (TDE/SSE) + cơ yếu (🏛️), TLS pin ≥1.2 + đóng cổng HTTP + security headers, giám sát 24/7 + IDS/WAF, hồ sơ ATTT cấp độ 3 + pentest độc lập.

**Chắc chắn tổ chấm / chạy thử sẽ bắt:** 💣1 (đối chiếu bảng cấu hình máy chủ), 💣2 (upload 1 tệp là lộ base64), 💣3 (đòi biên bản loadtest), 💣4 + hồ sơ cấp độ 3 (điều kiện pháp lý bắt buộc trước vận hành). Bốn mục này không thể "để lộ khi chạy thử" — phải xử lý trước.
