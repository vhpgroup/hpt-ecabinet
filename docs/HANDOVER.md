# HỒ SƠ BÀN GIAO DỰ ÁN eCabinet (HPT TECH)
*Cập nhật: 17/07/2026 23:35 (+07). Tài liệu này giúp bất kỳ AI agent / dev mới nắm toàn bộ dự án trong 5 phút.*

## 1. Dự án là gì
Phần mềm **phòng họp không giấy** (tương đương VNPT eCabinet), xây để **dự thầu gói "Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu"** — Sở KH&CN TP Hải Phòng (thuê dịch vụ CNTT 60 tháng, chuẩn bị ≤3 tháng, 500 user/90 CCU, đặt tại Trung tâm dữ liệu TP, ATTT cấp độ 3).

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

Tài khoản demo (mật khẩu chung `123456`): `chutich` (chủ trì) · `thuky` · `quantri` (admin) · `qtdonvi` (quản trị đơn vị) · `sokhdt`/`soyt`/… (đại biểu). Họp video: đặt env `LIVEKIT_URL/API_KEY/API_SECRET` (LiveKit Cloud). Khóa Open API demo: `ecab_demo_qlvb_2026` (THU HỒI khi chạy thật).

## 4. Trạng thái so với HSMT (thời điểm bàn giao)
- **Chức năng (mục 3.4):** web **58/59** mục đáp ứng — còn duy nhất **ký số PKI thật (mục 30, đang mô phỏng)**. Mobile: đủ nghiệp vụ qua PWA/Capacitor; chờ làm rõ HSMT có bắt buộc app native trên store không.
- **Nền tảng .NET + SQL Server (gap G1):** ĐÃ port xong, 72/72 test. Chưa test tích hợp trên MSSQL instance thật (chạy compose dotnet là kiểm được).
- **Còn lại để thắng thầu (chưa làm):**
  1. 🔴 **Ký số VGCA / VNPT SmartCA thật** — cần tài khoản/thiết bị CA (việc pháp nhân)
  2. 🔴 **Hồ sơ ATTT cấp độ 3** + pentest độc lập (6-8 tuần, cần đơn vị kiểm định)
  3. 🔴 **Chương I/III E-HSMT** (năng lực, kinh nghiệm, tiêu chuẩn đánh giá) — CHƯA đọc, quyết định bid/no-bid; cân nhắc liên danh
  4. 🟠 Câu hỏi làm rõ gửi bên mời thầu (PWA vs native? chuẩn CA? đặc tả LGSP/IOC?)
  5. 🟠 Đấu LGSP/IOC thật (đã có Open API + OpenAPI spec, chờ đặc tả TP)
  6. 🟠 Website công bố sản phẩm (điều kiện dự thầu) · hồ sơ tài liệu (HDSD, kịch bản kiểm thử, quy trình vận hành, cam kết SLA, phương án chuyển giao dữ liệu)
  7. 🟡 Hội đồng rà soát tổng (BA + Tester + chủ đầu tư giả định + FE/BE dev) — đã lên kế hoạch, chưa chạy

## 5. Ghi chú cho AI agent tiếp quản (kinh nghiệm xương máu)
- Sandbox chặn registry npm → build frontend bằng `scripts/build-cdn.mjs` (esbuild + deps tải sẵn `scripts/fetch-deps.mjs`). NuGet + dotnet SDK cài được (`dot.net/v1/dotnet-install.sh`).
- Nền tảng hay **giết tiến trình mở socket** → test server bằng import hàm trực tiếp (Node) hoặc TestHost in-memory (.NET); đừng chạy HTTP server + curl dài.
- **Trước mỗi lần push GitHub: `list_commits` kiểm tra commit mới của chủ repo** (đã từng đè mất 1 commit của user). Push targeted theo danh sách file, KHÔNG snapshot cả cây; loại trừ theo ĐƯỜNG DẪN (`server/data`, `deploy/backups`) chứ không theo tên thư mục (`src/data` từng bị loại nhầm).
- 2 file PNG icon PWA không có trong repo (nhị phân) — sinh lại được, không chặn build.
- Agent chạy nền (`run_in_background`) chết khi lượt kết thúc → việc dài chạy đồng bộ trong lượt.
- Icon UI: nét mảnh = Lucide (nhúng tĩnh trong `components.tsx`); icon màu 3D = Fluent Emoji base64 (`emojiIcons.ts`, component `ColorIcon`).

## 6. Prompt khởi động cho thread mới (dán nguyên văn)
> Tôi đang tiếp tục dự án eCabinet — phần mềm phòng họp không giấy của HPT TECH để dự thầu gói "Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu" (Sở KH&CN TP Hải Phòng). Toàn bộ mã nguồn và ngữ cảnh ở repo GitHub vhpgroup/hpt-ecabinet. Hãy đọc kỹ `docs/HANDOVER.md`, `docs/phan-tich-hsmt-BA.md`, `docs/phan-tich-hsmt-TechLeader.md` và `README.md` trước, tóm tắt lại hiện trạng cho tôi, rồi đề xuất việc tiếp theo theo mục 4 của HANDOVER.
