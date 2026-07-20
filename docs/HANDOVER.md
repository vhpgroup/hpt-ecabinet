# HỒ SƠ BÀN GIAO DỰ ÁN eCabinet (HPT TECH)
*Cập nhật: 18/07/2026 08:30 (+07) — sau ca "hội đồng rà soát tổng + thực hiện" qua đêm và thẩm định đấu thầu sáng 18/07 (**gói mục tiêu ban đầu ĐÃ trúng thầu — đọc ngay khối ⚠️ ở mục 1**). Tài liệu này giúp bất kỳ AI agent / dev mới nắm toàn bộ dự án trong 5 phút.*

## 1. Dự án là gì
Phần mềm **phòng họp không giấy** (tương đương VNPT eCabinet) của HPT TECH — **sản phẩm dự thầu các gói "Thuê phần mềm Họp không giấy tờ"** cho khối chính quyền (xã/phường/đặc khu, sở ngành).

> ⚠️ **TÌNH HÌNH MỚI (thẩm định 18/07/2026, nguồn chính thống muasamcong.mpi.gov.vn):** Gói mục tiêu ban đầu — "Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu", Sở KH&CN TP Hải Phòng, mã **IB2600235546-00** — **ĐÃ TRÚNG THẦU**: CTCP Tin học **Tân Dân**, giá **12,613 tỷ VND / 63 tháng** (giá gói 13,313 tỷ, giảm ~5,26%), QĐ 955/QĐ-SKHCN ngày 02/07/2026, đăng công khai 13/07/2026. Vietesoft trượt (giá xếp 3/3); VSD Việt Nam **bị loại kỹ thuật**. Không có hủy thầu/đấu lại; các gói còn lại trong KHLCNT là tư vấn chỉ định thầu. Chi tiết: `docs/ra-soat/2026-07-18/tham-dinh-goi-thau.md`.
>
> **Định hướng mới (chốt 18/07/2026):** giữ nguyên sản phẩm + bộ hồ sơ làm nền, **chuyển sang săn & chuẩn bị cho các gói tương tự ở tỉnh/thành khác** (làn sóng thuê "họp không giấy" sau sáp nhập hành chính). HSMT Hải Phòng (`docs/hsmt-chuong-v.md`) trở thành **khung yêu cầu tham chiếu** — các tỉnh thường dùng cấu trúc yêu cầu tương tự. Benchmark giá thị trường vừa có: **~200 triệu đồng/tháng** cho mô hình cấp xã/phường.

Thông số gói tham chiếu (HSMT Hải Phòng): thuê dịch vụ CNTT 60 tháng, chuẩn bị ≤3 tháng, 500 user/90 CCU, đặt tại Trung tâm dữ liệu TP, ATTT cấp độ 3.

- **Repo (nguồn chân lý duy nhất):** https://github.com/vhpgroup/hpt-ecabinet (nhánh `main`)
- Yêu cầu kỹ thuật chi tiết của gói thầu: file E-HSMT "Phụ lục 01 Chương V" (chủ đầu tư phát hành — giữ bản gốc DOCX)
- Phân tích HSMT: `docs/phan-tich-hsmt-BA.md` (gap 97 mục chức năng) + `docs/phan-tich-hsmt-TechLeader.md` (kỹ thuật/SLA/ATTT)

## 2. Kiến trúc
```
React SPA (1 mã nguồn) ──► Web · PWA · Android · iOS (Capacitor — xem docs/mobile-app.md)
        │  REST /api + WebSocket /api/realtime + Open API /api/open/v1 (X-API-Key)
        ▼
2 BACKEND CÙNG CONTRACT:
  server/        Node.js + PostgreSQL/PGlite  → demo, tham chiếu contract
  server-dotnet/ ASP.NET Core 8 + SQL Server  → TRIỂN KHAI THẦU (HSMT bắt buộc .NET + MSSQL)
```
- Frontend: `src/` — domain / data (adapter localStorage ↔ REST, chọn lúc chạy qua `apiBase.ts`) / services / ui. Build **không cần npm**: `node scripts/build-cdn.mjs` (demo) · `VITE_API_URL=/api node scripts/build-cdn.mjs` (server). Máy có npm: `npm install && npm run build`.
- Backend .NET: `dotnet build server-dotnet/ECabinet.sln` · test `dotnet run --project server-dotnet/ECabinet.Tests` (**72/72 PASS** qua TestHost). Không có `DATABASE_URL` → InMemory store tự seed.
- Bảo mật nhiều lớp (cả 2 backend như nhau): JWT HS256 + refresh xoay vòng · ACL 5 vai trò (admin/chairman/secretary/delegate/**unit_admin**) · lọc quyền đọc theo bản ghi (tài liệu mật, phiếu kín, biên bản, chất vấn) · guard khóa field + validate kiểu · CAS chống mất phiếu · rate-limit.

## 3. Triển khai
| Kịch bản | Lệnh |
|---|---|
| Full-stack Node (demo nhanh) | `docker compose up -d --build` → :8080 |
| **Full-stack .NET + SQL Server** (đúng HSMT) | `DB_PASSWORD='...' docker compose -f docker-compose.dotnet.yml up -d --build` → :8081 |
| Pilot HTTPS tự động (Caddy) | `./deploy/pilot.sh` (xem `deploy/.env.example`) |
| Coolify (VPS đang dùng) | Resource Docker Compose → `/docker-compose.coolify.yml`, env `DB_PASSWORD`+`JWT_SECRET`, domain gán service `web` |
| App Android/iOS | `docs/mobile-app.md` (Capacitor, cần máy có npm + Android Studio/Xcode) |
| Windows Server + IIS | README mục "Backend .NET" |
| **Lưu tệp ra object storage** (tách khỏi DB — mô hình Cụm Server-File HSMT) | Đặt env `S3_*` (MinIO/S3) — GATED, để trống thì giữ base64-trong-DB. Xem `docs/HUONG-DAN-TRIEN-KHAI-VA-HSMT.md` A3.1 + README 6.1 |

Tài khoản demo (mật khẩu chung `123456`): `chutich` (chủ trì) · `thuky` · `quantri` (admin) · `qtdonvi` (quản trị đơn vị) · `sokhdt`/`soyt`/… (đại biểu). Họp video: đặt env `LIVEKIT_URL/API_KEY/API_SECRET` (LiveKit Cloud). Khóa Open API demo: `ecab_demo_qlvb_2026` (THU HỒI khi chạy thật).

**Lưu ý hợp tác (20/07):** chủ repo có làm việc SONG SONG trên `main` (vd commit `bc3aba4` "support local tunnel development" — thêm `package-lock.json`, sửa `.gitignore`, `vite.config.ts` proxy dev cho tunnel `ecabinet.vhpdata.com`). LUÔN `list_commits` trước khi push và CHỈ push đúng danh sách file mình đổi (đừng đè 3 file này). Test hiện tại: **Node smoke 105/105 · .NET 153/153**.

## 4. Trạng thái so với HSMT

> 💣 **CẢNH BÁO BOM NỔ CHẬM (rà toàn diện 20/07 — `docs/ra-soat/2026-07-20/rasoat-toandien-{techleader,ba}.md`):** Khoảng cách LỚN NHẤT KHÔNG phải chức năng mà là **MÔ HÌNH TRIỂN KHAI HẠ TẦNG**. HSMT dòng 308–322 đòi **4 cụm server tách biệt / 7 máy ảo** (Web×2, App×2, DB×2, File×1) + **cân bằng tải + WAF + HA/chuyển mạch tự động**. Bản chạy thật (`docker-compose.dotnet.yml`, `ecabinet.vhpdata.com`) là **1 node Docker gộp**, không LB/WAF/HA/NTP/DNS nội bộ, **DB còn là SQL Server Express (trần 10GB)**. Vụ "Server-File" mới vá 1/4 khe hở, và MinIO **GATED tắt mặc định** → không đặt env `S3_*` thì **file vẫn base64 trong DB (lỗi cũ tái diễn)**. Tổ chấm đối chiếu "Phương án kỹ thuật ↔ bảng cấu hình máy chủ" gần như CHẮC CHẮN bắt. Kèm: MSSQL test dùng InMemory (chưa chạy MSSQL thật), loadtest 90 CCU số thật chưa lưu (số trong `docs/loadtest.md` là VÍ DỤ mẫu), chưa mã hóa at-rest/cơ yếu. → Phải xử lý ở tầng KIẾN TRÚC/HẠ TẦNG + phối hợp TTDL TP, KHÔNG chỉ là code.

### 4.x Trạng thái chi tiết (cập nhật 18/07/2026 — sau ca rà soát & thực hiện qua đêm)
- **Chức năng (mục 3.4) — CON SỐ CHÍNH XÁC (cập nhật 20/07 chiều): web 59/59 ✅ trọn vẹn · 0 🟡 · 0 ❌.** Đã vá nốt 2 mục 🟡 cuối: mục 14 thêm nút "Xóa thư mục" độc lập (gỡ nhãn, giữ tài liệu — `docs/ra-soat/2026-07-20/va-muc-14-20.md`); mục 20 thêm action thêm/sửa/xóa TỪNG người tham gia ngay trên tab Đại biểu. Kèm vá 1 bug parity thật (`folder: undefined` bị JSON loại khỏi PATCH → dùng `folder: null`, schema `string|null` 2 backend). Mục 30 ký số ĐỦ 4/4 hành động ở mức mô phỏng (PKI/CA thật là việc pháp nhân riêng, KHÔNG trừ vào đếm 3.4). Con số "58/59" cũ KHÔNG chính xác về danh sách mục 🟡. Chi tiết: `docs/ra-soat/2026-07-20/rasoat-toandien-ba.md`. Ma trận 97 mục kèm bằng chứng file/dòng: `docs/ra-soat/2026-07-18/ba-compliance-matrix.md`. Đêm 17→18/07 vá thêm: mục 8 (danh mục loại tài liệu CRUD) · 13 (phiếu nháp chưa gửi) · 21 (lọc đơn vị chủ trì) · 48/53/92/97 (thống kê ý kiến văn bản + xuất CSV) · 51 (sửa/xóa + đính kèm kết luận) · module **Phản hồi người dùng** (tiêu chí 5.1–5.4) · Cán bộ theo dõi phiếu ý kiến · loại đơn vị xã/phường/đặc khu · whitelist định dạng tệp TT 39/2017.
- **Bảo mật đa đơn vị (multi-tenant) — vá lỗ hổng lớn nhất:** API nội bộ ĐÃ cô lập dữ liệu theo đơn vị (meetings/votes/feedbacks — trước đây user xã A thấy họp xã B); unit_admin tạo phiên họp + gửi giấy mời + xử lý phản hồi TRONG ĐƠN VỊ MÌNH; Thành viên dự họp duyệt tài liệu (đúng quy trình HSMT dòng 354–358). Test sau 2 đợt vá (QA đêm + dùng thử sáng 18/07): **.NET 128/128 PASS** · **Node smoke 79/79 PASS** (`node server/test/smoke.mjs`).
- **Đợt DÙNG THỬ 18/07 (sáng):** 4 vai (Tester, Tech Leader, BA, chuyên viên Sở giả định) dùng thử end-to-end trên bản demo công khai — 31 ca khám phá + 15/15 ca nghiệm thu ĐẠT (kết luận giả định: "ĐẠT kèm điều kiện" — các điều kiện đã vá ngay cùng ngày). Đã vá tiếp trên UI: unit_admin tạo họp/gửi mời/tải + trình tài liệu; thành viên phiên duyệt tài liệu; phiếu lấy ý kiến KÍN (ẩn danh); khóa cứng biên bản ngay khi có chữ ký; thể thức biên bản NĐ 30/2020 (khối ký bản in); nhóm dropdown ủy quyền theo thành phần; confirm hành động không hoàn tác; website công bố trung lập hóa (bỏ nêu đích danh Hải Phòng); thống nhất thuật ngữ "phiên họp"/"lấy ý kiến"; viết lại 23 chuỗi jargon nội bộ thành ngôn ngữ công vụ.
- **Họp trực tuyến LiveKit — ĐÃ KIỂM CHỨNG KẾT NỐI THẬT (chiều 18/07):** token do `server/src/rtc.js` tự ký (HS256, không SDK) được LiveKit Cloud chấp nhận (REST 200); trình duyệt thật join phòng sau **649ms**; máy chủ LiveKit đối chứng `num_participants: 1`, codecs H264/VP8/VP9/AV1+opus sẵn sàng. Còn lại DUY NHẤT: test media 2 chiều với 2 thiết bị thật có camera trên bản triển khai chế độ máy chủ — hướng dẫn 4 bước tại `docs/ra-soat/2026-07-18/livekit-test.md` (lưu ý: XOAY API secret sau test vì key từng trao đổi qua chat).
- **✅ KIỂM CHỨNG HẠ TẦNG THẬT (20/07/2026)** — chủ dự án triển khai tại **https://ecabinet.vhpdata.com** (qua Cloudflare, HTTPS). Xác minh độc lập bằng curl: `/health` → `{"ok":true,"db":"sqlserver","realtimeClients":2}` (chạy **SQL Server 2022 THẬT**, không phải InMemory) · đăng nhập JWT hoạt động · `/api/rtc/config` → `{"enabled":true}` (**LiveKit video thật đã bật**) · realtime WebSocket sống. Chủ dự án báo **load test 90 CCU PASS**. → biến các mục 🟡/🔴 nền tảng thành ✅ trên hạ tầng thật (trừ Windows/IIS: bản đang chạy dùng Docker Compose .NET). ⚠️ Mật khẩu demo `chutich/123456` VẪN đăng nhập được — ĐỔI + thu hồi tài khoản/khóa API demo trước khi công khai cho tổ chấm.
- **Nền tảng (nói trung thực):** .NET 8 ✅ · SQL Server 🟡 mã sẵn sàng nhưng CHƯA test trên instance MSSQL thật · Windows Server + IIS 🔴 mới có outline. Đã bổ sung: backup/restore MSSQL (`deploy/backup-mssql.sh`), diễn tập DR (`deploy/test-restore.sh` + `docs/dr-runbook.md`), TLS profile cho compose .NET, script loadtest 90 CCU (`scripts/loadtest.mjs` + `docs/loadtest.md`), IPv6 dual-stack nginx.
- **Hồ sơ thầu:** bộ **12 tài liệu** tại `docs/ho-so/` (mục lục, cam kết bảo mật, cam kết SLA, kịch bản vận hành thử, quy trình quản trị vận hành 8 quy trình con, quy trình bảo trì, chuyển giao dữ liệu, nâng cấp theo quy định mới, giáo trình đào tạo, kế hoạch 12 tuần, văn bản làm rõ HSMT, khung HDSD) — CẦN pháp nhân điền placeholder [Họ tên/Chức vụ/Ngày] + ký. **Website công bố sản phẩm**: `website/index.html` (điều kiện dự thầu — cần đăng lên domain công khai).
- **Tư liệu:** HSMT Chương V toàn văn `docs/hsmt-chuong-v.md` (trích từ DOCX gốc chủ dự án cấp 17/07). 16 báo cáo rà soát + dùng thử tại `docs/ra-soat/2026-07-18/` — mới nhất: `dungthu-so-khcn.md` (nghiệm thu giả định 15/15 ca ĐẠT, điều kiện đã vá cùng ngày), `dungthu-tester.md` (31 ca khám phá), `dungthu-fixes.md` + `dungthu-thethuc.md` (nhật ký vá), `tham-dinh-goi-thau.md` (kết quả gói Hải Phòng).
- **Còn lại để SẴN SÀNG DỰ CÁC GÓI TƯƠNG TỰ (cần pháp nhân/bên ngoài, KHÔNG code được):**
  1. 🔴 **Săn gói thầu mới** — theo dõi KHLCNT/TBMT "họp không giấy" các tỉnh/thành trên muasamcong.mpi.gov.vn, vào cuộc từ giai đoạn **KHLCNT** chứ đừng đợi TBMT (bài học Hải Phòng: KHLCNT duyệt 18/03, TBMT 27/05, đóng thầu 15/06 — biết muộn là lỡ cả vòng)
  2. 🔴 **Ký số VGCA / VNPT SmartCA thật** — cần tài khoản/thiết bị CA (việc pháp nhân)
  3. 🔴 **Hồ sơ ATTT cấp độ 3** + pentest độc lập (6-8 tuần) · **hồ sơ năng lực/hợp đồng tương tự** — rào cản lớn nhất của sản phẩm mới, cân nhắc liên danh (bài học gói Hải Phòng: VSD bị **loại kỹ thuật** ngay vòng đánh giá)
  4. 🟠 Khi xuất hiện gói mới: đọc **Chương I/III E-HSMT của gói đó** trước khi bid/no-bid; tái dùng `docs/ho-so/10-van-ban-lam-ro-hsmt.md` làm template câu hỏi làm rõ (thay căn cứ/tên bên mời thầu theo gói mới)
  5. 🟠 Đấu LGSP/IOC thật (đặc tả tùy tỉnh) · test compose MSSQL instance thật · triển khai thử Windows/IIS · build app native lên store (cần máy có npm + Android Studio/Xcode)
  6. 🟠 Đăng website công bố lên domain công khai · pháp nhân hoàn thiện + ký bộ `docs/ho-so/` (soạn theo HSMT Hải Phòng — dùng cho gói mới phải cập nhật căn cứ trích dẫn)
  7. 🟢 3 lỗi P2 đêm 17/07 ĐÃ VÁ sáng 18/07 (kết luận id-match cho chủ trì/thư ký của chính phiên; `signedCount` phiếu kín; bind IPv6 dual-stack — đặt `BIND_IPV4_ONLY=1` nếu hạ tầng chỉ IPv4). Còn ghi nhận nhỏ: 3 script `.sh` trên GitHub không có bit thực thi (chạy `bash deploy/...sh` hoặc `chmod +x`).

## 5. Ghi chú cho AI agent tiếp quản (kinh nghiệm xương máu)
- Sandbox chặn registry npm → build frontend bằng `scripts/build-cdn.mjs` (esbuild + deps tải sẵn `scripts/fetch-deps.mjs`). NuGet + dotnet SDK cài được (`dot.net/v1/dotnet-install.sh`).
- Nền tảng hay **giết tiến trình mở socket** → test server bằng import hàm trực tiếp (Node) hoặc TestHost in-memory (.NET); đừng chạy HTTP server + curl dài.
- **Trước mỗi lần push GitHub: `list_commits` kiểm tra commit mới của chủ repo** (đã từng đè mất 1 commit của user). Push targeted theo danh sách file, KHÔNG snapshot cả cây; loại trừ theo ĐƯỜNG DẪN (`server/data`, `deploy/backups`) chứ không theo tên thư mục (`src/data` từng bị loại nhầm).
- 2 file PNG icon PWA không có trong repo (nhị phân) — sinh lại được, không chặn build.
- Agent chạy nền (`run_in_background`) chết khi lượt kết thúc → việc dài chạy đồng bộ trong lượt.
- Icon UI: nét mảnh = Lucide (nhúng tĩnh trong `components.tsx`); icon màu 3D = Fluent Emoji base64 (`emojiIcons.ts`, component `ColorIcon`).
- Làm tính năng FE + BE song song bằng nhiều agent: CHỐT HỢP ĐỒNG FIELD trước khi phát lệnh (tên field/endpoint/mã lỗi — xem `docs/ra-soat/2026-07-18/dev-backend.md`), phân vùng file nghiêm ngặt cho từng agent, và LUÔN cho Tester đối chiếu chéo 2 phía trước khi commit — đêm 18/07 bước này bắt được 1 lỗi P0 (docType bị guard chặn) + 1 lỗi P1 (lệch quyền feedbacks) trước khi lên GitHub.

## 6. Prompt khởi động cho thread mới (dán nguyên văn)
> Tôi đang tiếp tục dự án eCabinet — phần mềm phòng họp không giấy của HPT TECH, sản phẩm để dự thầu các gói "Thuê phần mềm Họp không giấy tờ" cho khối chính quyền. LƯU Ý: gói mục tiêu ban đầu tại Sở KH&CN TP Hải Phòng (IB2600235546) ĐÃ trúng thầu bởi Tân Dân 02/07/2026 — định hướng hiện tại là săn & chuẩn bị cho các gói tương tự ở tỉnh/thành khác. Toàn bộ mã nguồn và ngữ cảnh ở repo GitHub vhpgroup/hpt-ecabinet. Hãy đọc kỹ `docs/HANDOVER.md` (khối ⚠️ mục 1 + mục 4), `docs/ra-soat/2026-07-18/tham-dinh-goi-thau.md` và `README.md` trước, tóm tắt lại hiện trạng cho tôi, rồi đề xuất việc tiếp theo theo mục 4 của HANDOVER.
