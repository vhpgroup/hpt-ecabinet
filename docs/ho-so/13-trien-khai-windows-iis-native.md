# HƯỚNG DẪN TRIỂN KHAI NATIVE: Windows Server + IIS + SQL Server 2022 Standard
*eCabinet (HPT TECH) — không dùng Docker. Đúng nền tảng HSMT (.NET 8 + MS SQL Server 2022 + Windows Server). Cập nhật 21/07/2026.*

> Tài liệu này biến "outline 6 bước" ở README mục 11 thành quy trình thực thi đầy đủ cho đội vận hành. Áp dụng cho **1 máy** (pilot) và mở rộng **nhiều cụm** (mục 10). Cần chạy thử một lần trên Windows thật để nghiệm thu (biến 🟡 → ✅).

---

## 0. Kiến trúc native đã chọn (và VÌ SAO)
```
                      HTTPS 443 (TLS 1.2+)
  [Người dùng] ───────────────► [IIS — Windows Server]
                                   │  • Phục vụ frontend tĩnh dist/ (SPA)
                                   │  • Reverse proxy (ARR + URL Rewrite):
                                   │      /api/*  và  /health   ─┐
                                   │      /api/realtime (WebSocket)│
                                   ▼                              ▼
                        [ECabinet.Api — Windows Service]  http://localhost:3000
                        (ASP.NET Core 8 / Kestrel — tự viết, 1 gói NuGet: Microsoft.Data.SqlClient)
                                   │  TDS 1433 (TrustServerCertificate / cert nội bộ)
                                   ▼
                        [SQL Server 2022 Standard]  DB: ecabinet
```
**Vì sao API chạy như Windows Service + IIS reverse proxy, KHÔNG dùng ANCM in-process:** `server-dotnet/ECabinet.Api/Program.cs` chủ động đặt `ASPNETCORE_URLS=http://[::]:PORT` để Kestrel tự lắng nghe cổng 3000 (đồng nhất với bản Docker/nginx — nginx `web` proxy sang `api:3000`). Mô hình reverse proxy giữ **đúng contract đang chạy**, **không phải sửa mã nguồn**, và IIS thay vai trò của nginx. (Muốn IIS-hosted cổ điển bằng ASP.NET Core Module in-process thì phải vá Program.cs — xem **Phụ lục B**.)

---

## 1. Chuẩn bị máy chủ (Windows Server 2019/2022)
Chạy PowerShell **Administrator**:

```powershell
# 1.1 Cài IIS + WebSocket Protocol + công cụ quản trị
Install-WindowsFeature -Name Web-Server, Web-WebSockets, Web-Mgmt-Console, Web-Mgmt-Service, Web-Http-Redirect, Web-Static-Content -IncludeManagementTools
```
Cài thêm (tải từ Microsoft, cài offline nếu DC không có Internet):
- **.NET 8 Hosting Bundle** (`dotnet-hosting-8.x-win.exe`) — gồm ASP.NET Core Runtime + ANCM. (Đủ để chạy Kestrel; ANCM để dành cho Phụ lục B.)
- **URL Rewrite 2.1** (`rewrite_amd64_en-US.msi`).
- **Application Request Routing 3.0** (`ARRv3_setup.exe`) — cho reverse proxy.

Sau khi cài ARR, bật chế độ proxy: IIS Manager → nút máy chủ (root) → **Application Request Routing Cache** → *Server Proxy Settings* → tích **Enable proxy** → Apply.

---

## 2. Cài đặt SQL Server 2022 Standard
1. Chạy bộ cài **SQL Server 2022 Standard** → New standalone installation. Feature: **Database Engine Services**.
2. **Authentication Mode: Mixed Mode** — đặt mật khẩu `sa` mạnh (sẽ vô hiệu hóa `sa` sau khi tạo tài khoản riêng).
3. Cài **SQL Server Management Studio (SSMS)**.
4. Bật giao thức **TCP/IP**: SQL Server Configuration Manager → SQL Server Network Configuration → Protocols → **TCP/IP: Enabled**, cổng **1433**. Khởi động lại dịch vụ SQL Server.
5. Mở firewall nội bộ cho 1433 (chỉ trong vùng mạng App zone — không public):
   ```powershell
   New-NetFirewallRule -DisplayName "SQL 1433 (App zone)" -Direction Inbound -Protocol TCP -LocalPort 1433 -RemoteAddress <DẢI_IP_APP_ZONE> -Action Allow
   ```
6. Tạo **tài khoản SQL riêng** (không dùng `sa`) + database — chạy trong SSMS:
   ```sql
   CREATE LOGIN ecab_app WITH PASSWORD = N'<mật-khẩu-rất-mạnh>', CHECK_POLICY = ON;
   CREATE DATABASE ecabinet;
   USE ecabinet;
   CREATE USER ecab_app FOR LOGIN ecab_app;
   ALTER ROLE db_owner ADD MEMBER ecab_app;   -- app tự tạo bảng lần đầu; có thể siết quyền sau khi bảng đã tạo
   ```
   > Ứng dụng **tự tạo bảng + nạp dữ liệu mẫu** ở lần chạy đầu (như bản Docker). Không cần chạy script schema thủ công.
7. **(ATTT cấp độ 3 — khuyến nghị)** Bật **TDE** mã hóa dữ liệu nghỉ cho DB `ecabinet` (SQL Server Standard hỗ trợ TDE từ 2019+); sao lưu chứng chỉ TDE ra nơi an toàn.

---

## 3. Build & publish (trên MÁY BUILD có .NET 8 SDK + Node ≥ 20)
```powershell
git clone https://github.com/vhpgroup/hpt-ecabinet.git ; cd hpt-ecabinet

# 3.1 Frontend tĩnh (build với API cùng origin)
$env:VITE_API_URL = "/api"
npm install ; npm run build        # hoặc: node scripts/build-cdn.mjs
#   → kết quả: dist/ (index.html + assets)

# 3.2 Backend .NET (kèm .exe cho Windows Service)
dotnet publish server-dotnet/ECabinet.Api/ECabinet.Api.csproj -c Release -r win-x64 --self-contained false /p:UseAppHost=true -o C:\deploy\ecabinet-api
#   → C:\deploy\ecabinet-api\ECabinet.Api.exe (+ seed.json đi kèm)
```
Chép sang server đích: `dist\*` → **`C:\inetpub\ecabinet-web\`**; thư mục publish → **`C:\ecabinet\api\`**.

---

## 4. Chạy API như Windows Service (Kestrel :3000)
Đặt biến môi trường bí mật **ở phạm vi dịch vụ** (không ghi vào web.config của IIS). Cách gọn dùng **NSSM** (Non-Sucking Service Manager) — dễ quản lý env; hoặc `sc.exe` + biến hệ thống.

**Cách A1 — NSSM (khuyến nghị):**
```powershell
nssm install eCabinetAPI "C:\ecabinet\api\ECabinet.Api.exe"
nssm set eCabinetAPI AppDirectory "C:\ecabinet\api"
nssm set eCabinetAPI AppEnvironmentExtra ^
  PORT=3000 ^
  "DATABASE_URL=Server=localhost,1433;Database=ecabinet;User Id=ecab_app;Password=<mật-khẩu>;TrustServerCertificate=True;Encrypt=True" ^
  "JWT_SECRET=<chuỗi-bí-mật-dài-ngẫu-nhiên>" ^
  ASPNETCORE_ENVIRONMENT=Production
nssm set eCabinetAPI Start SERVICE_AUTO_START
nssm set eCabinetAPI AppStdout "C:\ecabinet\logs\api.log"
nssm set eCabinetAPI AppStderr "C:\ecabinet\logs\api.err.log"
nssm start eCabinetAPI
```
Chạy dịch vụ dưới **tài khoản dịch vụ tối thiểu quyền** (Log On As: gMSA hoặc tài khoản riêng), KHÔNG dùng LocalSystem cho sản xuất.

**Biến môi trường thêm (tùy chọn — gated, chỉ đặt khi cần):**
| Biến | Khi nào |
|---|---|
| `LIVEKIT_URL/API_KEY/API_SECRET` | Bật họp video thật (xem HUONG-DAN A3) |
| `S3_ENDPOINT/BUCKET/ACCESS_KEY/SECRET_KEY/FORCE_PATH_STYLE` | Tách tệp sang Server-File/MinIO (A3.1) |
| `REDIS_URL` | Khi chạy **App ×2** sau cân bằng tải (A3.2) |
| `CORS_ORIGIN` | `https://ecabinet.<tỉnh>.gov.vn` |
| `BIND_IPV4_ONLY=1` | Nếu OS tắt hẳn IPv6 khiến Kestrel bind `[::]` lỗi |

**Kiểm nhanh API sống (trên chính máy chủ):**
```powershell
curl.exe http://localhost:3000/health        # phải trả  "db":"sqlserver"
```

---

## 5. Cấu hình IIS: site web tĩnh + reverse proxy
1. Tạo site **ecabinet-web**: IIS Manager → Sites → Add Website → Physical path `C:\inetpub\ecabinet-web` → binding tạm HTTP 80 (sẽ thêm HTTPS ở mục 6). App Pool: **No Managed Code** (IIS chỉ phục vụ tĩnh + proxy, không chạy .NET trong IIS).
2. Đặt file **`C:\inetpub\ecabinet-web\web.config`** với nội dung sau (reverse proxy `/api` + `/health` + WebSocket, và SPA fallback):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <webSocket enabled="true" pingInterval="00:00:30" />
    <rewrite>
      <rules>
        <!-- 1) Proxy API + health (kể cả WebSocket /api/realtime) sang Kestrel :3000 -->
        <rule name="Proxy_API" stopProcessing="true">
          <match url="^(api|health)(/.*)?$" />
          <action type="Rewrite" url="http://localhost:3000/{R:0}" />
          <serverVariables>
            <set name="HTTP_X_FORWARDED_PROTO" value="https" />
            <set name="HTTP_X_FORWARDED_HOST" value="{HTTP_HOST}" />
          </serverVariables>
        </rule>
        <!-- 2) SPA fallback: request KHÔNG phải file/thư mục thật và KHÔNG phải /api -> index.html -->
        <rule name="SPA_Fallback" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            <add input="{REQUEST_URI}" pattern="^/(api|health)" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
    <!-- Cho phép body tài liệu lớn (khớp giới hạn app 25MB, đệm dư) -->
    <security><requestFiltering><requestLimits maxAllowedContentLength="52428800" /></requestFiltering></security>
    <staticContent><clientCache cacheControlMode="UseMaxAge" cacheControlMaxAge="7.00:00:00" /></staticContent>
  </system.webServer>
</configuration>
```
3. Cho phép 2 server variable dùng trong rule: IIS Manager → site **ecabinet-web** → **URL Rewrite** → *View Server Variables* → Add `HTTP_X_FORWARDED_PROTO` và `HTTP_X_FORWARDED_HOST`.
4. Xác nhận **ARR Enable proxy** đã bật (mục 1). Không có bước này, rule Rewrite ra URL tuyệt đối sẽ trả lỗi 404/500.

> **WebSocket cho `/api/realtime`:** hoạt động khi (a) đã cài feature *WebSocket Protocol* (mục 1), (b) `<webSocket enabled="true">` như trên, (c) ARR proxy bật. Kestrel giữ nguyên nâng cấp WS.

---

## 6. TLS/HTTPS (HSMT bắt buộc TLS 1.2+)
1. Import chứng chỉ do TP/CA nội bộ cấp vào **Server Certificates** của IIS (hoặc tạo CSR từ IIS gửi CA).
2. Site **ecabinet-web** → Bindings → Add **https** 443 → chọn chứng chỉ. Bật **HSTS** (IIS 10+: cấu hình trong site settings).
3. Thêm rule redirect 80→443 (hoặc dùng Web-Http-Redirect).
4. **Tắt giao thức cũ** (SSL 3.0/TLS 1.0/1.1) + bật cipher an toàn qua Schannel registry (hoặc dùng công cụ IIS Crypto), kiểm bằng SSL Labs/`Test-NetConnection`.

---

## 7. Kiểm chứng sau triển khai (nghiệm thu 1 máy)
```powershell
curl.exe -k https://<domain>/health                                  # "db":"sqlserver"
# đăng nhập thử
curl.exe -k -X POST https://<domain>/api/auth/login -H "Content-Type: application/json" -d '{\"username\":\"chutich\",\"password\":\"123456\"}'
```
- Mở `https://<domain>` bằng trình duyệt → đăng nhập → mở **2 tab** cùng một phiên họp, điểm danh/biểu quyết ở tab này → tab kia cập nhật **tức thời** (xác nhận WebSocket qua IIS OK).
- Nếu bật LiveKit: `GET /api/rtc/config` trả `{"enabled":true}`.
- Tải lên 1 tài liệu → mở xem được. (Nếu bật S3: kiểm bản ghi có `storageKey`, đối tượng có trong bucket — xem A3.1.)

---

## 8. Sao lưu & vận hành
- **Sao lưu SQL** bằng **SQL Server Agent Job** (thay `deploy/backup-mssql.sh`): `BACKUP DATABASE ecabinet TO DISK='...' WITH INIT, COMPRESSION;` chạy hằng ngày + dọn bản cũ; định kỳ **test restore** vào DB tạm và đối chiếu số bản ghi (khớp `docs/dr-runbook.md`).
- **(Nếu bật S3/Server-File)** sao lưu bucket độc lập với DB (đúng mô hình 4 cụm).
- **Log**: file `C:\ecabinet\logs\api*.log` (NSSM). Đưa vào giám sát tập trung (Event Log forwarding / Prometheus windows_exporter) cho yêu cầu giám sát 24/7.
- **Tự khởi động lại**: NSSM `AppExit Default Restart`; service Auto-start.
- **Cứng hóa ban đầu:** đổi mật khẩu tài khoản demo, đặt `JWT_SECRET` mạnh, **thu hồi khóa API demo** `ecab_demo_qlvb_2026`, vô hiệu hóa `sa` sau khi đã có `ecab_app`.

---

## 9. Cập nhật phiên bản (không gián đoạn cơ bản)
1. Build bản mới (mục 3). 2. Dừng service: `nssm stop eCabinetAPI`. 3. Sao lưu thư mục `C:\ecabinet\api` cũ; chép bản mới đè (giữ nguyên env service). 4. Cập nhật `dist\` mới vào `C:\inetpub\ecabinet-web`. 5. `nssm start eCabinetAPI` → kiểm `/health`. (Muốn zero-downtime: chạy 2 App node + ARR như mục 10.)

---

## 10. Mở rộng nhiều cụm đúng mô hình HSMT (7 VM)
1 máy ở trên là **App×1**. Mô hình HSMT đầy đủ (Web×2, App×2, DB×2 AlwaysOn, File×1 + cân bằng tải + WAF) — sơ đồ, bảng cấu hình VM, phân vùng mạng, checklist làm việc với TTDL: xem **`docs/ho-so/12-phuong-an-trien-khai-ha-tang.md`**. Điểm khác biệt khi native + nhiều cụm:
- **Cân bằng tải**: dùng thiết bị của TTDL (khuyến nghị) hoặc **ARR Server Farm** trên 2 node Web (health-check `/health`, WebSocket passthrough, sticky nếu chưa bật Redis).
- **App×2**: mỗi App node chạy service Kestrel :3000; **BẮT BUỘC đặt `REDIS_URL`** để realtime + rate-limit đồng bộ toàn cụm (xem HUONG-DAN **A3.2**).
- **DB×2**: SQL Server 2022 Standard + **WSFC + Basic Availability Group** (1 database); connection string thêm `MultiSubnetFailover=True`.
- **Server-File**: máy Ubuntu chạy MinIO (bật `S3_*`) — đúng "Cụm Server-File" HSMT.

---

## Phụ lục A — Sự cố thường gặp
| Triệu chứng | Nguyên nhân & xử lý |
|---|---|
| `/api/*` trả 404.0 hoặc 502.3 | Chưa **Enable proxy** trong ARR (mục 1) hoặc service API chưa chạy (`curl localhost:3000/health`). |
| WebSocket không cập nhật realtime | Chưa cài feature *WebSocket Protocol*, hoặc `<webSocket enabled>` chưa bật, hoặc LB không passthrough WS. |
| 500.19 khi mở site | web.config cần URL Rewrite + ARR đã cài; kiểm module đã có. |
| API khởi động lỗi bind `[::]` | OS tắt IPv6 → đặt `BIND_IPV4_ONLY=1` cho service. |
| Đăng nhập lỗi kết nối DB | Sai `DATABASE_URL`/mật khẩu, TCP 1433 chưa bật, firewall chặn, chứng chỉ SQL (đặt `TrustServerCertificate=True` cho cert tự ký nội bộ). |

## Phụ lục B — (Tùy chọn) IIS-hosted bằng ASP.NET Core Module (in-process)
Nếu muốn IIS trực tiếp host tiến trình .NET (không service riêng), cần **vá `Program.cs`**: KHÔNG đặt `ASPNETCORE_URLS` khi phát hiện chạy dưới ANCM (biến `ASPNETCORE_IIS_HTTPS_PORT`/`ASPNETCORE_PORT` do ANCM cấp), rồi `dotnet publish` và tạo App Pool (No Managed Code) trỏ vào thư mục publish với `web.config` `hostingModel="inprocess"`. **Không khuyến nghị cho lần triển khai đầu** vì phải sửa mã + kiểm thử lại; mô hình reverse proxy (mục 0–5) an toàn và khớp thiết kế hiện tại hơn.

---

## Checklist nghiệm thu 1 máy
- [ ] IIS + WebSocket + URL Rewrite + ARR (Enable proxy) + .NET 8 Hosting Bundle đã cài
- [ ] SQL Server 2022 Standard chạy, TCP 1433, tài khoản `ecab_app`, DB `ecabinet`
- [ ] Service `eCabinetAPI` (Kestrel :3000) Auto-start, `/health` trả `db:sqlserver`
- [ ] IIS site web + web.config reverse proxy + server variables; `/api/*` và WebSocket OK
- [ ] HTTPS TLS 1.2+, redirect 80→443, tắt giao thức cũ
- [ ] Đổi mật khẩu demo, `JWT_SECRET` mạnh, thu hồi khóa API demo, vô hiệu `sa`
- [ ] SQL Agent job sao lưu + test restore; log + giám sát
- [ ] (Tùy chọn) LiveKit / S3 / Redis theo nhu cầu (HUONG-DAN A3, A3.1, A3.2)
