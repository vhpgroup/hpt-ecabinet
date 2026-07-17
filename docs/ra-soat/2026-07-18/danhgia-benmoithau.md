# BÁO CÁO ĐÁNH GIÁ HỒ SƠ KỸ THUẬT (VAI BÊN MỜI THẦU / TỔ CHUYÊN GIA)

**Gói thầu:** Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu — Sở Khoa học và Công nghệ TP Hải Phòng
**Sản phẩm đánh giá:** eCabinet — HPT TECH
**Người đánh giá (vai giả định):** Hà — chuyên viên Sở KH&CN Hải Phòng, tổ chuyên gia chấm thầu kiêm tổ nghiệm thu
**Ngày đánh giá:** 17/07/2026
**Nguồn căn cứ pháp lý:** `docs/hsmt-chuong-v.md` (668 dòng, phát hành bởi bên mời thầu) — đã đọc toàn văn.
**Nguồn kiểm chứng:** repo mã nguồn `/agent/workspace/hpt-ecabinet` (đã soi trực tiếp code, không chỉ tin theo tài liệu nhà thầu tự khai).

**Nguyên tắc chấm:** Với mỗi yêu cầu, tôi trích nguyên văn HSMT, đối chiếu bằng chứng thực tế trong repo (đường dẫn cụ thể), rồi chấm theo 3 mức:
- **ĐẠT** — có bằng chứng code/tài liệu thực thi, kiểm chứng được ngay.
- **MỘT PHẦN** — có nền tảng kỹ thuật nhưng chưa đủ hoặc chưa kiểm chứng độc lập (tự khai, chưa test bên thứ 3, chưa vận hành đủ thời gian).
- **KHÔNG ĐẠT / THIẾU BẰNG CHỨNG** — không tìm thấy trong repo, hoặc chỉ là văn bản dự định.

---

## MỤC 1. DANH MỤC YÊU CẦU NGOÀI CHỨC NĂNG — CHẤM CHI TIẾT

### 1.1. Bảng tiêu chí chất lượng dịch vụ (HSMT dòng 54–119)

| STT HSMT | Tiêu chí | Yêu cầu cụ thể (trích) | Bằng chứng nhà thầu | Chấm |
|---|---|---|---|---|
| 1.1 | Tính đầy đủ chức năng nghiệp vụ | "Hệ thống đáp ứng đầy đủ các chức năng nghiệp vụ theo yêu cầu của Kế hoạch" (dòng 58) | 58/59 mục web đã có UI (`src/ui/pages/`, `src/ui/pages/admin/`); mobile 38 mục qua PWA/Capacitor (`docs/mobile-app.md` mục 10). Ký số (mục 30) mô phỏng. | **MỘT PHẦN** — thiếu bằng chứng kiểm thử/vận hành thử chính thức (HSMT dòng 58 yêu cầu "Thực hiện kiểm thử hoặc vận hành thử để xác định số lượng chức năng đáp ứng") — chưa có báo cáo kiểm thử nào trong repo. |
| 1.2 | Tính chính xác chức năng nghiệp vụ | "Đáp ứng đầy đủ yêu cầu chức năng tại Mục 3.4... hoạt động ổn định, cho kết quả chính xác" (dòng 59) | .NET: 72/72 test PASS qua TestHost in-memory (README dòng 408–414); Node: có CAS chống mất phiếu biểu quyết. Nhưng **SqlServerDocStore chưa test trên SQL Server thật** — README tự thừa nhận "chưa kiểm thử trên SQL Server thật trong môi trường sandbox" (README dòng 414). | **MỘT PHẦN** — test tự động có, nhưng test là in-memory, KHÔNG phải trên MSSQL thật/production-like. Tổ nghiệm thu sẽ đòi bằng chứng chạy trên đúng CSDL yêu cầu. |
| 1.3 | Tính phù hợp với nghiệp vụ thực tế | tương tự 1.2 (dòng 60) | Quy trình 3 bước HSMT (chuẩn bị họp → điều hành phiên họp → lấy ý kiến văn bản, dòng 352–374) khớp với luồng `meetingService.ts`, `voteService.ts`. | **ĐẠT** (về mặt thiết kế nghiệp vụ) — nhưng chưa có xác nhận người dùng thực tế (cán bộ xã/phường) sử dụng. |
| 2.1 | Hiệu năng đáp ứng | "<5 giây/thao tác, <30 giây tìm kiếm, ≥500 user/90 CCU" (dòng 62) | **Không có bất kỳ file load test nào trong repo** (`k6`, `artillery`, benchmark script — tìm không thấy). `docs/phan-tich-hsmt-TechLeader.md` dòng 29–33 tự nhận "chưa có benchmark tải thực tế công bố". | **THIẾU BẰNG CHỨNG** — đây là SLA đo được, không phải "cam kết bằng lời". Không có số liệu p95 response time nào để dẫn chiếu. |
| 2.2 | Khả năng mở rộng | "mở rộng không giới hạn số người sử dụng" (dòng 63) | Kiến trúc stateless API (Node/​.NET) về lý thuyết scale ngang được, nhưng **không có HA/cluster/auto-scale nào đã triển khai** — Docker Compose single-node (`docker-compose.yml`, `docker-compose.dotnet.yml`). | **THIẾU BẰNG CHỨNG** — chưa test scale ngang thật. |
| 3.1 | Bảo mật thông tin — không lỗ hổng ≥ cấp độ 3 khi quét | "kiểm tra bằng các phần mềm chuyên dụng" (dòng 65–66) | Không có báo cáo pentest/quét lỗ hổng (Nessus/OpenVAS/Burp) nào trong repo. Chỉ có validate input (`Guard.cs`), rate-limit tự viết (`RateLimit.cs`, `server/src/ratelimit.js`). | **KHÔNG ĐẠT / THIẾU BẰNG CHỨNG** — chưa có đơn vị độc lập quét, không thể tự chấm đạt. |
| 3.1 | Toàn vẹn dữ liệu | (dòng 67) | CAS (compare-and-swap) chống mất phiếu — thấy trong `Actions.cs`/`meetingService.ts`; audit log (`AuditLogPage.tsx`, `adminService.ts`). | **MỘT PHẦN** — có cơ chế kỹ thuật, chưa có "đánh giá tín toàn vẹn định kỳ" như văn bản yêu cầu (dòng 67 cột giai đoạn thuê dịch vụ). |
| 3.2 | Truy xuất nguồn gốc | "lưu vết và tra cứu hành động người dùng" (dòng 69) | `AuditLogPage.tsx` có lọc theo tài khoản + khoảng thời gian + admin xóa log (dòng code xác nhận `filter`, `userId`, `xóa`). | **ĐẠT** — có UI + logic filter thật, không phải giả lập. |
| 3.3 | Cam kết bảo mật thông tin | "Nhà thầu phải cam kết về bảo mật thông tin" — "Có cam kết" (dòng 70) | **Không tìm thấy văn bản cam kết bảo mật riêng biệt nào trong repo** (`docs/` chỉ có 4 file phân tích kỹ thuật, không có file cam kết ký tên pháp nhân). | **KHÔNG ĐẠT** — đây là văn bản hồ sơ dự thầu bắt buộc, chưa soạn. |
| 3.4 | ATTT cấp độ 3 | "Hệ thống thông tin được xác định cấp độ và triển khai phương án... theo quy định" (dòng 71) | Không có hồ sơ đề xuất cấp độ (theo NĐ 85/2016), không có phương án ATTT cấp độ 3 được phê duyệt. | **KHÔNG ĐẠT** — mục 3.4 dòng 71 ghi rõ giai đoạn chuẩn bị đã phải có "hệ thống thông tin được xác định cấp độ", đây không phải việc để dành đến sau khi trúng thầu. |
| 3.6 | Tín nhiệm mạng | "đáp ứng tiêu chí tín nhiệm mạng theo quy định pháp luật giao dịch điện tử" (dòng 73) | Chưa đăng ký nhãn Tín nhiệm mạng (NCSC). Không có bằng chứng trong repo. | **KHÔNG ĐẠT / THIẾU BẰNG CHỨNG** |
| 3.7 | Mã hóa dữ liệu bằng mật mã cơ yếu khi bắt buộc | "các dữ liệu thuộc diện bắt buộc phải mã hóa được thực hiện mã hóa/giải mã bằng **mật mã cơ yếu**" (dòng 75) | Có TLS 1.2+ qua Caddy tự động (Let's Encrypt, `deploy/Caddyfile`) cho dữ liệu truyền; **không có** mã hóa tại chỗ (encryption at rest) bằng giải pháp cơ yếu Ban Cơ yếu Chính phủ. Tìm "cơ yếu"/"encryption at rest" trong code: 0 kết quả (chỉ có trong docs phân tích). | **KHÔNG ĐẠT** — đây là yêu cầu pháp lý riêng (cơ yếu ≠ TLS/HTTPS thông thường), hoàn toàn chưa có. |
| 4.1.1 | Định dạng tệp theo TT 39/2017/TT-BTTTT | (dòng 80) | Chưa rà soát cụ thể whitelist định dạng export/import. Hệ thống dùng PDF, DOCX phổ biến nhưng không có checklist đối chiếu thông tư. | **THIẾU BẰNG CHỨNG** |
| 4.2.1 | Export dữ liệu theo quy định | "Hệ thống phải cho phép export dữ liệu" (dòng 84) | Có xuất CSV (điểm danh, ý kiến — README mục "Khác"), in/xuất PDF biên bản. | **ĐẠT** |
| 4.3.1 | Tính liên tục — ≤3 lần gián đoạn/năm, cách nhau ≥4 tháng | (dòng 91–92) | Không có dữ liệu uptime lịch sử (chưa triển khai thật cho khách hàng, chưa qua 1 năm vận hành). Không có giám sát uptime tập trung (Prometheus/Grafana không thấy trong repo). | **THIẾU BẰNG CHỨNG** — SLA đo theo thời gian, không thể chấm đạt tại thời điểm dự thầu; cần cam kết + kế hoạch giám sát. |
| 4.3.2 | Phục hồi sự cố ≤24h, 100% dữ liệu | (dòng 93–95) | `deploy/backup.sh` (pg_dump + gzip + rotate BACKUP_KEEP) và `deploy/restore.sh` (DROP SCHEMA + restore) là **script thật, chạy được**. Nhưng: (a) chỉ backup CSDL, chưa backup file đính kèm/video riêng biệt xác nhận trong script; (b) chưa có "test restore end-to-end" ghi nhận; (c) không có RTO/RPO runbook văn bản. | **MỘT PHẦN** — cơ chế kỹ thuật tồn tại và chạy được, nhưng thiếu tài liệu quy trình DR + chưa chứng minh restore thật đạt 24h. |
| 4.4.1 | Phân tích nguyên nhân sự cố ≤8h | (dòng 97) | Có audit log hỗ trợ điều tra, nhưng không có hệ thống alerting/giám sát 24/7 tự động phát hiện sự cố (không thấy Prometheus/Grafana/Zabbix nào). | **KHÔNG ĐẠT / THIẾU BẰNG CHỨNG** — không có cơ chế phát hiện sớm để kịp phân tích trong 8h. |
| 4.4.3 | Giám sát 24/7, cảnh báo tự động | (dòng 99) | Không có. | **KHÔNG ĐẠT** |
| 6.2 | Bộ phận chuyên trách vận hành | (dòng 115) | Không thể chứng minh bằng code — là vấn đề tổ chức/nhân sự, không thuộc phạm vi repo. | **THIẾU BẰNG CHỨNG** (ngoài phạm vi kỹ thuật, cần hồ sơ nhân sự riêng). |
| 6.3 | Báo cáo dịch vụ định kỳ | (dòng 116) | Có `ReportsPage.tsx` (thống kê nội bộ hệ thống) nhưng đây là báo cáo NGHIỆP VỤ (số phiên họp, tỷ lệ tham dự), KHÁC với "báo cáo dịch vụ" (uptime, SLA, sự cố) mà điều khoản nhà cung cấp yêu cầu 6 tháng/lần (dòng 622). | **KHÔNG ĐẠT** cho đúng loại báo cáo dịch vụ — chưa có mẫu báo cáo dịch vụ 6 tháng nào được soạn. |

### 1.2. SLA tổng hợp — bảng đối chiếu số liệu cứng

| Chỉ tiêu SLA (nguyên văn HSMT) | Dòng | Bằng chứng | Chấm |
|---|---|---|---|
| Đáp ứng thao tác trung bình <5s | 62, 531 | Không có số liệu đo | **THIẾU BẰNG CHỨNG** |
| Tìm kiếm nhiều điều kiện <30s | 62, 532 | Không có số liệu đo | **THIẾU BẰNG CHỨNG** |
| Báo cáo tổng hợp toàn TP, nhiều năm <5 phút, không timeout | 533 | Chưa có module báo cáo multi-tenant toàn TP được test ở quy mô lớn | **THIẾU BẰNG CHỨNG** |
| ≥500 user / 90 CCU đồng thời | 62, 535 | Chưa load test | **THIẾU BẰNG CHỨNG** |
| Cảnh báo khi độ trễ >10s | 534 | Không thấy cơ chế loading/spinner có ngưỡng 10s cụ thể trong code (chỉ có toast/loading indicator chung, chưa xác nhận ngưỡng đúng 10s) | **THIẾU BẰNG CHỨNG** |
| Gián đoạn ≤3 lần/năm, cách nhau ≥4 tháng | 91–92 | Chưa vận hành đủ 1 năm để có dữ liệu | **THIẾU BẰNG CHỨNG** (cấu trúc — không thể chấm tại thời điểm dự thầu) |
| Phục hồi ≤24h, 100% dữ liệu | 93–95 | Có backup/restore script chạy được, chưa đo thời gian thực tế | **MỘT PHẦN** |
| Phân tích nguyên nhân ≤8h | 97 | Không có alerting | **KHÔNG ĐẠT** |
| Trực quản trị 24/7 | 615 | Không thể chứng minh bằng code | **THIẾU BẰNG CHỨNG** (hồ sơ nhân sự) |
| Trực tổng đài giờ hành chính | 618 | Không thể chứng minh bằng code | **THIẾU BẰNG CHỨNG** (hồ sơ nhân sự) |
| TLS 1.2+ | 550 | Caddy tự động HTTPS, TLS mặc định 1.2/1.3 (`deploy/Caddyfile`) | **ĐẠT** |
| IPv6-ready | 548–549 | Không có cấu hình/test IPv6 nào (grep không thấy) | **KHÔNG ĐẠT / THIẾU BẰNG CHỨNG** |

### 1.3. Đào tạo, chuyển giao (HSMT dòng 122–144)

| Yêu cầu | Trích dòng | Bằng chứng | Chấm |
|---|---|---|---|
| Lớp quản trị: 1 ngày, 1 lớp, ~10 học viên, trực tiếp | 130–131 | Chưa có kế hoạch đào tạo cụ thể, chưa có giáo trình soạn sẵn trong `docs/` | **KHÔNG ĐẠT** — chưa soạn |
| Lớp người dùng: 1 buổi, 1 lớp, trực tiếp+trực tuyến | 137–138 | Tương tự, chưa có | **KHÔNG ĐẠT** |
| Tài liệu HDSD + tài liệu quản trị đầy đủ | 140 | Có module **HDSD trong app** (`GuidesAdminPage.tsx`, `HelpPage.tsx` — admin soạn nội dung/tải tệp, giới hạn theo vai trò, người dùng xem theo vai trò), nhưng đây là tài liệu TÍCH HỢP TRONG SẢN PHẨM, không phải giáo trình đào tạo/tài liệu quản trị hệ thống độc lập (dạng văn bản nộp hồ sơ). | **MỘT PHẦN** — nền tảng kỹ thuật có, nội dung giáo trình cụ thể chưa soạn. |
| Mỗi lớp ≥1 giảng viên + 1 trợ giảng | 141 | Vấn đề nhân sự, ngoài phạm vi code | **THIẾU BẰNG CHỨNG** |

### 1.4. Quản trị vận hành hệ thống — TỪNG quy trình con (HSMT dòng 146–223, Phụ lục 11 TT 18/2024)

| Quy trình con | Trích dòng | Bằng chứng kỹ thuật hỗ trợ | Bằng chứng quy trình văn bản | Chấm |
|---|---|---|---|---|
| Quản trị vận hành ứng dụng (theo dõi log, xác định nguyên nhân, tối ưu, khắc phục lỗi dữ liệu) | 172–182 | Audit log có (`AuditLogPage.tsx`); không có công cụ "khắc phục lỗi dữ liệu" chuyên dụng, không có giám sát log tập trung. | Không có quy trình vận hành ứng dụng dạng văn bản trong `docs/`. | **MỘT PHẦN** (kỹ thuật) / **KHÔNG ĐẠT** (văn bản quy trình) |
| Quản trị hoạt động người sử dụng (tạo/khóa/phân quyền theo yêu cầu Sở) | 184–193 | `UsersAdminPage.tsx` có CRUD người dùng + phân quyền theo vai trò (5 vai trò gồm unit_admin — `src/domain/types.ts` dòng 8–9); quản trị đơn vị (`UnitsAdminPage.tsx`) siết theo phạm vi đơn vị (theo README mục 1). | Không có quy trình phê duyệt cấp tài khoản dạng văn bản. | **ĐẠT** (kỹ thuật) / **KHÔNG ĐẠT** (quy trình văn bản phối hợp với Sở) |
| Kiểm soát, đối soát dữ liệu (sao lưu, đối soát, phục hồi) | 195–201 | `backup.sh`/`restore.sh` chạy được; chưa có công cụ "đối soát dữ liệu" (data reconciliation) chuyên biệt. | Không có quy trình đối soát bằng văn bản. | **MỘT PHẦN** |
| Tiếp nhận/hỗ trợ yêu cầu không liên quan cập nhật dữ liệu | 203–208 | Không có hệ thống ticket/helpdesk trong sản phẩm. | Không có quy trình. | **KHÔNG ĐẠT** |
| Tiếp nhận/hỗ trợ yêu cầu xử lý dữ liệu | 210–214 | Không có công cụ cập nhật dữ liệu theo "câu lệnh có sẵn" cho hỗ trợ viên. | Không có quy trình. | **KHÔNG ĐẠT** |
| Lập báo cáo/tài liệu/quy trình hướng dẫn thường gặp | 216–219 | Không có. | Không có. | **KHÔNG ĐẠT** |
| Xây dựng công cụ/câu lệnh khai thác số liệu theo mẫu biểu chưa có | 221–223 | Có OpenAPI catalog (`OpenApiCatalog.cs`) cho phép khai thác dữ liệu qua API chuẩn hóa — có thể là nền tảng một phần cho việc này, nhưng không phải "công cụ ad-hoc khai thác số liệu theo yêu cầu phát sinh". | Không có quy trình. | **THIẾU BẰNG CHỨNG** |

### 1.5. Bảo trì (HSMT dòng 225–252, Phụ lục 12 TT 18/2024)

| Nội dung | Trích dòng | Bằng chứng | Chấm |
|---|---|---|---|
| Sao lưu CSDL/mã nguồn định kỳ, kiểm tra toàn vẹn sau sao lưu | 240 | `backup.sh` có kiểm tra file không rỗng (dòng 20–21 script); chưa có bước kiểm tra toàn vẹn (checksum/test-restore tự động) sau mỗi lần backup. | **MỘT PHẦN** |
| Sửa lỗi phần mềm, hỗ trợ cập nhật bản vá | 241 | Có git repo, có khả năng vá — nhưng không có quy trình patch/release chính thức, không có CI/CD (README mục 8 xác nhận "chưa có" test tự động CI/CD cho quy trình phát hành). | **THIẾU BẰNG CHỨNG** |
| Kiểm tra hiệu suất, khả năng chịu tải | 242 | Không có (đã nêu ở 2.1). | **KHÔNG ĐẠT** |
| Cập nhật bản vá lỗ hổng ATTT cho OS/DB/webserver | 245 | Không có quy trình patch management ghi nhận. | **KHÔNG ĐẠT** |
| Kiểm tra phát hiện mã độc, lỗ hổng, thử nghiệm xâm nhập | 250 | Chưa pentest (đã nêu ở 3.1). | **KHÔNG ĐẠT** |

### 1.6. Nghiệm thu, bàn giao (HSMT dòng 254–260)

| Yêu cầu | Trích | Bằng chứng | Chấm |
|---|---|---|---|
| Vận hành thử theo Khoản 1 Điều 58 NĐ 73/2019/NĐ-CP | 255 | Chưa thực hiện — chưa có kế hoạch/kịch bản vận hành thử chính thức trong repo (chỉ có phân tích gap, chưa có kịch bản test case cụ thể). | **KHÔNG ĐẠT** (chưa làm) |
| Có mặt giám sát + các bên liên quan khi thử nghiệm | 256 | N/A tại thời điểm này (chưa thử nghiệm) | **N/A** |
| Báo cáo kết quả vận hành thử | 258 | Chưa có | **KHÔNG ĐẠT** |
| Nội dung vận hành thử theo Phụ lục II TT 16/2024/TT-BTTTT | 260 | Chưa đối chiếu Phụ lục II cụ thể (không có bản Phụ lục II trong repo để đối chiếu từng nội dung) | **THIẾU BẰNG CHỨNG** |

### 1.7. Sở hữu & chuyển giao dữ liệu (HSMT dòng 639–650, mục 4)

| Yêu cầu | Trích | Bằng chứng | Chấm |
|---|---|---|---|
| Dữ liệu thuộc sở hữu bên thuê | 642 | Kiến trúc self-host (không SaaS bên thứ 3 lưu dữ liệu nghiệp vụ) hỗ trợ nguyên tắc này về mặt kỹ thuật. | **ĐẠT** (về nguyên tắc kỹ thuật) |
| Không chia sẻ dữ liệu cho bên thứ 3 khi chưa được phép | 643 | Không phát hiện tích hợp gửi dữ liệu ra ngoài trái phép trong code (cần rà soát LiveKit Cloud nếu dùng — đây là dịch vụ bên thứ 3 xử lý audio/video). | **MỘT PHẦN** — cần làm rõ LiveKit Cloud (nếu dùng bản Cloud thay self-host) có lưu trữ nội dung họp hay không. |
| Chuyển giao dữ liệu dưới dạng "có thể truy xuất" khi kết thúc HĐ | 649 | `pg_dump` (SQL dump) là "có thể truy xuất" nhưng cần công cụ chuyên môn đọc — chưa có bản xuất CSV/Excel/JSON thân thiện cho người không chuyên kỹ thuật. Chưa có "phương án chuyển giao dữ liệu khi kết thúc hợp đồng" dạng văn bản. | **MỘT PHẦN** (kỹ thuật) / **KHÔNG ĐẠT** (văn bản phương án) |
| Cam kết bảo mật cấu trúc/sơ đồ hệ thống + tuân thủ cơ yếu + Pháp lệnh bảo vệ bí mật nhà nước | 645, 649 | Không có văn bản cam kết. | **KHÔNG ĐẠT** |

### 1.8. Yêu cầu đối với nhà cung cấp dịch vụ (HSMT dòng 599–637)

| Yêu cầu | Trích | Bằng chứng | Chấm |
|---|---|---|---|
| Website công bố các chức năng sản phẩm chào thầu | 633 | **Không tìm thấy** — repo không có landing page/website public nào (chỉ có `public/manifest.webmanifest`, `sw.js`, `favicon.svg` — đây là PWA assets, không phải trang giới thiệu chức năng). `dist/index.html` là app SPA yêu cầu đăng nhập, không phải trang công bố chức năng cho tổ chấm xem không cần tài khoản. | **KHÔNG ĐẠT** — đây là điều kiện dự thầu ("Nhà thầu cung cấp đường dẫn website công bố các chức năng của sản phẩm chào thầu" — không có thì hồ sơ có rủi ro bị đánh giá thiếu tài liệu chứng minh). |
| Cam kết hoàn thành chuẩn bị dịch vụ ≤3 tháng | 634 | Chưa có văn bản cam kết chính thức (chỉ có ước lượng kỹ thuật trong `docs/phan-tich-hsmt-TechLeader.md` — tài liệu nội bộ, không phải văn bản cam kết nộp thầu). | **KHÔNG ĐẠT** (chưa có văn bản chính thức) |
| Kế hoạch cài đặt, triển khai chi tiết, được Chủ đầu tư chấp thuận trước | 635 | Có kế hoạch 12 tuần trong `docs/phan-tich-hsmt-TechLeader.md` mục 4, nhưng đây là ghi chú nội bộ kỹ thuật, chưa ở dạng "Kế hoạch triển khai" chính thức để trình Chủ đầu tư theo đúng thể thức hồ sơ dự thầu. | **MỘT PHẦN** |
| Báo cáo 6 tháng | 622 | Chưa có mẫu | **KHÔNG ĐẠT** |
| Nâng cấp theo quy định mới ≤3 tháng | 652 | Kiến trúc modular (React + API tách lớp) hỗ trợ về nguyên tắc, nhưng không có CI/CD, không có quy trình release — rủi ro không kịp 3 tháng nếu thay đổi lớn. | **MỘT PHẦN** |
| Rà soát/nâng cấp hàng năm | 653 | Chưa có quy trình rà soát hàng năm bằng văn bản. | **KHÔNG ĐẠT** |

---

## MỤC 2. KỊCH BẢN VẬN HÀNH THỬ GIẢ ĐỊNH — 25 CA KIỂM THỬ

*Khung này bám mục 3.4 (chức năng), SLA (mục 3.1), và bảng tiêu chí chất lượng dịch vụ. Dùng làm nền cho "Kịch bản kiểm thử vận hành thử" chính thức mà nhà thầu phải nộp trước vận hành thử theo Khoản 1 Điều 58 NĐ 73/2019/NĐ-CP.*

| # | Ca kiểm thử | Bước thực hiện | Kết quả mong đợi (theo HSMT) | Dự đoán đạt/rớt | Căn cứ dự đoán |
|---|---|---|---|---|---|
| TC-01 | Đăng nhập + đổi mật khẩu (mục 5) | Đăng nhập tài khoản demo `chutich`/`123456` → đổi mật khẩu → đăng xuất → đăng nhập lại bằng MK mới | Đăng nhập/đổi MK thành công, JWT cấp đúng | **ĐẠT** | `Auth.cs`/`authService.ts` có JWT HS256 + đổi MK; tài khoản demo README dòng 61–68 xác nhận hoạt động |
| TC-02 | Tạo cuộc họp mới + gửi giấy mời (mục 17) | Thư ký tạo phiên họp, thêm chương trình, gửi giấy mời | Tạo thành công, đại biểu nhận thông báo | **ĐẠT** | `meetingService.ts` có luồng Nháp→Gửi giấy mời; `NotificationsPage.tsx` |
| TC-03 | Trình – duyệt tài liệu họp (mục 24) | Quản trị đơn vị tải tài liệu → Trình duyệt → Chủ trì Duyệt/Từ chối kèm lý do | Badge trạng thái đổi đúng, đại biểu chỉ thấy tài liệu đã duyệt | **ĐẠT** | README xác nhận có luồng Nháp→Chờ duyệt→Đã duyệt/Từ chối, lọc theo vai trò |
| TC-04 | Sơ đồ phòng họp + gán vị trí đại biểu (mục 9, 38) | Quản trị cập nhật sơ đồ (lưới ghế) → gán vị trí đại biểu → xem màu điểm danh trực tiếp trên sơ đồ | Sơ đồ hiển thị đúng, màu theo trạng thái điểm danh | **ĐẠT** | `RoomsAdminPage.tsx` + `LiveMeetingPage.tsx` có seating chart (đã kiểm chứng có file/logic tương ứng) |
| TC-05 | Điểm danh (tự + thư ký hộ + QR) (mục 25, 36) | Đại biểu tự điểm danh; thư ký điểm danh hộ người vắng có lý do; test mã QR | Cập nhật CSDL đúng, thống kê realtime | **ĐẠT** | `meetingService.ts` có điểm danh đa hình thức; QR "mô phỏng" theo README — cần làm rõ QR có phải QR thật scan bằng camera hay chỉ hiển thị mã |
| TC-06 | Ủy quyền tham gia họp (mục 26) | Đại biểu A ủy quyền cho đại biểu B, kiểm tra B có quyền biểu quyết thay | Cập nhật đúng, B biểu quyết thay A | **ĐẠT** | README + BA report xác nhận có ủy quyền |
| TC-07 | Đăng ký chất vấn + điều hành chất vấn (mục 34, 45, 46) | Đại biểu đăng ký chất vấn → chủ tọa bắt đầu phiên chất vấn → duyệt DS đã gọi/chưa gọi → gọi | Luồng chất vấn hoạt động độc lập với "phát biểu" | **ĐẠT** | `domain/types.ts` dòng 170–337 có state machine chất vấn riêng (open/called/done) — đã bổ sung so với báo cáo BA cũ (từng ghi ❌) |
| TC-08 | Biểu quyết đồng thời 90 người (mục 32, 44) | 90 tài khoản giả lập biểu quyết cùng lúc trong 1 nội dung | Không mất phiếu, kết quả % đúng, <5s phản hồi | **MỘT PHẦN — RỦI RO RỚT SLA THỜI GIAN** | CAS chống mất phiếu có thật (cơ chế đúng); nhưng **chưa từng load test ở 90 CCU thật** — có thể không mất phiếu (logic đúng) nhưng KHÔNG có bằng chứng đạt ngưỡng <5s ở tải này |
| TC-09 | Lấy ý kiến bằng văn bản + tổng hợp (mục 11–13, 47, 48) | Thư ký thêm văn bản xin ý kiến, thành viên cho ý kiến, tổng hợp/thống kê | Tổng hợp đúng số liệu, xuất được thống kê | **ĐẠT** | Có đủ luồng theo BA report + README |
| TC-10 | Ký số ý kiến văn bản (mục 30) | Thành viên cho ý kiến → bấm "ký số" → nhập PIN 6 số → kiểm tra chữ ký gắn vào văn bản | Chữ ký số có giá trị PHÁP LÝ (chuẩn PAdES/CA hợp pháp) | **RỚT — CHẶN NGHIỆM THU** | `meetingService.ts` dòng 453–473: PIN 6 số tự chế + SHA-256 hash nội dung — đây là **mô phỏng**, không dùng CA/PKI thật. HSMT không nêu rõ chuẩn CA bắt buộc nhưng với văn bản hành chính nhà nước, tổ nghiệm thu nhiều khả năng yêu cầu chữ ký số hợp pháp theo NĐ 130/2018 |
| TC-11 | Xem tài liệu Mật theo phân quyền | Đại biểu không có quyền cố mở tài liệu Mật của thành phần khác | Bị chặn 403, không xem được | **ĐẠT** | README + HANDOVER xác nhận "lọc quyền đọc theo bản ghi (tài liệu mật, phiếu kín...)" |
| TC-12 | Xuất báo cáo tổng hợp toàn TP, dữ liệu nhiều năm (mục 3.1 dòng 533) | Chạy báo cáo thống kê trên dữ liệu giả lập 5 năm, nhiều đơn vị | <5 phút, không timeout | **RỚT — CHƯA CÓ MODULE** | `ReportsPage.tsx` là báo cáo 1 instance, chưa test quy mô toàn TP đa xã/phường; TechLeader report dòng 31 xác nhận "chưa có module thống kê quy mô toàn thành phố được kiểm chứng" |
| TC-13 | Tìm kiếm đa điều kiện (mục 2.1 dòng 62) | Tra cứu cuộc họp theo trạng thái + nội dung + thời gian + từ khóa đồng thời | <30 giây | **MỘT PHẦN** | Có UI tra cứu (mục 50) nhưng chưa đo thời gian thực tế trên dữ liệu lớn |
| TC-14 | Tấn công brute-force đăng nhập | Thử đăng nhập sai liên tục 20 lần trong 1 phút | Bị rate-limit chặn | **ĐẠT** | `RateLimit.cs`/`ratelimit.js` có `LOGIN_RATE_MAX` cấu hình riêng (docker-compose.dotnet.yml dòng env) |
| TC-15 | Quét lỗ hổng OWASP Top 10 bằng công cụ chuyên dụng | Chạy ZAP/Burp/Nessus quét toàn bộ endpoint | Không lỗ hổng ≥ cấp độ 3 (mục 3.1 dòng 66) | **CHƯA THỰC HIỆN — RỦI RO CAO** | Chưa từng chạy — không có báo cáo pentest nào trong repo |
| TC-16 | Ngắt kết nối server giữa phiên họp đang diễn ra | Kill container API khi họp đang mở biểu quyết | Phục hồi ≤24h, 100% dữ liệu, không mất phiếu đã ghi trước khi ngắt | **MỘT PHẦN** | CAS + backup có, nhưng chưa test restore end-to-end thực tế (README/TechLeader report xác nhận "chưa test restore end-to-end") |
| TC-17 | Khôi phục từ bản backup | Chạy `deploy/restore.sh` với 1 bản backup thật | Dữ liệu khôi phục đúng 100%, hệ thống hoạt động lại | **CHƯA CÓ BẰNG CHỨNG THỬ THẬT** | Script tồn tại và có logic đúng (`DROP SCHEMA CASCADE` + reload), nhưng repo không có log/report xác nhận đã chạy thử thành công |
| TC-18 | Test trên .NET + SQL Server thật (đúng nền tảng HSMT) | Chạy `docker-compose.dotnet.yml` với SQL Server 2022 container thật, thực hiện đủ luồng nghiệp vụ | Hoạt động y hệt bản Node, dữ liệu lưu đúng MSSQL | **MỘT PHẦN — CHƯA KIỂM CHỨNG TRỰC TIẾP** | README dòng 414 tự thừa nhận "SqlServerDocStore... chưa kiểm thử trên SQL Server thật trong môi trường sandbox" — code có vẻ đúng cú pháp SqlClient nhưng CHƯA xác nhận chạy thành công |
| TC-19 | Test API mở (Open API) cho bên thứ 3 (mục 54–59) | Gọi 6 endpoint `/api/open/v1/...` bằng X-API-Key, kiểm tra phân trang, scope, rate-limit | Trả đúng dữ liệu, không trả biên bản/phiếu kín | **ĐẠT** | README mục 10 mô tả chi tiết, có ví dụ curl; `OpenApiCatalog.cs`/`OpenRoutes.cs` có code thật (818 dòng) |
| TC-20 | Kết nối LGSP thật của TP Hải Phòng | Đấu API vào trục LGSP TP theo đặc tả thật | Trao đổi dữ liệu thành công qua LGSP | **RỚT — CHƯA CÓ ĐẶC TẢ/CHƯA THỰC HIỆN** | Chỉ có "LGSP-ready" (chuẩn REST tổng quát), chưa có đặc tả kỹ thuật cụ thể từ TP, chưa từng đấu nối thật |
| TC-21 | Test trên trình duyệt Cốc Cốc (mục 336, 560) | Mở toàn bộ nghiệp vụ chính trên Cốc Cốc | Hoạt động đầy đủ như Chrome/Edge | **MỘT PHẦN — CHƯA TEST RIÊNG** | React 18 chạy Chromium-based nên về lý thuyết OK, nhưng chưa có biên bản test riêng trên Cốc Cốc |
| TC-22 | Đào tạo thử 1 lớp quản trị | Chạy thử buổi đào tạo với giáo trình soạn sẵn, 10 học viên giả định | Học viên nắm được thao tác quản trị cơ bản | **CHƯA THỂ THỰC HIỆN** | Chưa có giáo trình đào tạo soạn sẵn trong repo |
| TC-23 | Vận hành thử app mobile qua PWA trên Android/iOS thật | Cài PWA lên điện thoại thật, chạy đủ 38 mục mobile (60–97) | Hoạt động đầy đủ, không phải app native trên store | **MỘT PHẦN — RỦI RO CÁCH HIỂU** | Nghiệp vụ có đủ qua PWA/Capacitor code, nhưng CHƯA build ra APK/AAB/IPA thật (cần máy có Android Studio/Xcode — chưa làm trong sandbox); và HSMT dòng 37, 466 dùng chữ "ỨNG DỤNG TRÊN NỀN TẢNG DI ĐỘNG" — tổ nghiệm thu có thể yêu cầu app cài từ CH Play/App Store, không chấp nhận PWA |
| TC-24 | Website công bố chức năng sản phẩm | Bên mời thầu mở đường dẫn website nhà thầu cung cấp, không cần tài khoản, xem đầy đủ chức năng | Truy cập công khai được, mô tả đủ chức năng theo E-HSMT | **RỚT — CHƯA TỒN TẠI** | Không tìm thấy bất kỳ trang public nào trong repo/dist |
| TC-25 | IPv6 dual-stack | Truy cập hệ thống qua địa chỉ IPv6 | Hoạt động bình thường như IPv4 | **RỚT / THIẾU BẰNG CHỨNG** | Không có cấu hình/test IPv6 nào tìm thấy trong `deploy/`, docker-compose, hoặc code |

**Tổng kết dự đoán 25 ca:** ĐẠT rõ ràng ~11/25 (44%), MỘT PHẦN/rủi ro ~9/25 (36%), RỚT/CHƯA THỰC HIỆN ~5/25 (20%) — trong đó **TC-10 (ký số), TC-15 (pentest), TC-20 (LGSP thật), TC-24 (website công bố)** là các ca có khả năng **chặn nghiệm thu trực tiếp** vì đây là điều kiện tiên quyết theo văn bản (dòng 71, 255, 633 HSMT), không phải "điểm cộng thêm".

---

## MỤC 3. DANH MỤC HỒ SƠ/TÀI LIỆU BẮT BUỘC — ĐÃ CÓ vs CHƯA CÓ

| # | Tài liệu bắt buộc (theo Chương V) | Trích dòng HSMT | Trạng thái | Đường dẫn nếu có |
|---|---|---|---|---|
| 1 | Website công bố chức năng sản phẩm | 633 | **CHƯA CÓ** | — |
| 2 | Tài liệu HDSD (người dùng + quản trị) — bản độc lập nộp hồ sơ | 140, 244 | **MỘT PHẦN** — có module trong app (`src/ui/pages/admin/GuidesAdminPage.tsx`, `src/ui/pages/HelpPage.tsx`) nhưng KHÔNG có bản tài liệu HDSD dạng file (PDF/Word) độc lập để nộp hồ sơ dự thầu | `src/ui/pages/admin/GuidesAdminPage.tsx`, `src/ui/pages/HelpPage.tsx` (chỉ là tính năng trong sản phẩm) |
| 3 | Giáo trình đào tạo (quản trị + người dùng) | 123–144 | **CHƯA CÓ** | — |
| 4 | Quy trình quản trị vận hành (ứng dụng, người dùng, đối soát dữ liệu, hỗ trợ, báo cáo, công cụ khai thác) | 146–223 | **CHƯA CÓ** (chỉ có phân tích trong `docs/phan-tich-hsmt-TechLeader.md`, không phải quy trình chính thức) | — |
| 5 | Quy trình bảo trì | 225–252 | **CHƯA CÓ** | — |
| 6 | Kế hoạch vận hành thử | 255–260 | **CHƯA CÓ** | — |
| 7 | Báo cáo kết quả vận hành thử | 258 | **CHƯA CÓ** (chưa vận hành thử) | — |
| 8 | Cam kết SLA (chỉ tiêu định lượng, chế tài) | dòng 62–119 (toàn bảng) | **CHƯA CÓ** văn bản cam kết chính thức | — |
| 9 | Văn bản cam kết bảo mật thông tin (bao gồm cơ yếu, bí mật nhà nước) | 70, 645 | **CHƯA CÓ** | — |
| 10 | Phương án chuyển giao dữ liệu khi kết thúc hợp đồng | 647–650 | **CHƯA CÓ** (chỉ có backup/restore kỹ thuật, chưa có văn bản phương án) | `deploy/backup.sh`, `deploy/restore.sh` (chỉ là công cụ kỹ thuật, không phải "phương án" văn bản) |
| 11 | Phương án nâng cấp khi có quy định mới (≤3 tháng) | 652 | **CHƯA CÓ** | — |
| 12 | Hồ sơ đề xuất cấp độ ATTT + phương án bảo đảm ATTT cấp độ 3 | 71, 527–528 | **CHƯA CÓ** | — |
| 13 | Báo cáo pentest / kết quả quét lỗ hổng độc lập | 65–66 | **CHƯA CÓ** | — |
| 14 | Kế hoạch cài đặt, triển khai chi tiết (trình Chủ đầu tư chấp thuận) | 635 | **MỘT PHẦN** — có kế hoạch 12 tuần trong `docs/phan-tich-hsmt-TechLeader.md` mục 4 (ghi chú nội bộ, chưa đúng thể thức hồ sơ) | `docs/phan-tich-hsmt-TechLeader.md` |
| 15 | Mẫu báo cáo dịch vụ định kỳ 6 tháng | 622 | **CHƯA CÓ** | — |
| 16 | Kế hoạch đào tạo (thống nhất với Sở) | 144 | **CHƯA CÓ** | — |
| 17 | Đối chiếu 97 mục chức năng 3.4 (self-assessment matrix) | 388–515 | **ĐÃ CÓ** (khá đầy đủ, cần cập nhật vài mục đã bổ sung sau) | `docs/phan-tich-hsmt-BA.md` |
| 18 | Đánh giá compliance kỹ thuật/hạ tầng/ATTT | 262–341 (mục kỹ thuật) | **ĐÃ CÓ** | `docs/phan-tich-hsmt-TechLeader.md` |
| 19 | Tài liệu hướng dẫn đóng gói mobile Capacitor | 466 (nhóm B) | **ĐÃ CÓ** (hướng dẫn kỹ thuật, chưa build ra app thật) | `docs/mobile-app.md` |

**Tổng: 19 hồ sơ liệt kê → 5 tài liệu ĐÃ CÓ đầy đủ hoặc gần đủ (26%) / 3 MỘT PHẦN (16%) / 11 CHƯA CÓ hoàn toàn (58%).** Đáng chú ý: các tài liệu ĐÃ CÓ đều là tài liệu PHÂN TÍCH KỸ THUẬT NỘI BỘ (giúp dev hiểu gap), KHÔNG PHẢI tài liệu HỒ SƠ DỰ THẦU CHÍNH THỨC theo đúng thể thức (không có văn bản có tiêu đề/số hiệu/ký tên đại diện pháp nhân nào trong repo).

---

## MỤC 4. CÂU HỎI LÀM RÕ HSMT NÊN GỬI BÊN MỜI THẦU

### Kế thừa từ HANDOVER mục 4.4 (đã xác nhận vẫn còn treo):
1. **PWA vs app native trên store:** HSMT dòng 37 ("triển khai trên các nền tảng ứng dụng di động phổ biến Android, iOS") và tiêu đề nhóm B (dòng 466 "ỨNG DỤNG TRÊN NỀN TẢNG DI ĐỘNG") có bắt buộc app cài từ Google Play/App Store, hay chấp nhận PWA/web responsive chạy trên trình duyệt di động?
2. **Chuẩn chữ ký số bắt buộc:** Mục 30 (dòng 432) yêu cầu "Ký số file cho ý kiến vào văn bản" — có bắt buộc dùng CA công cộng/chuyên dùng Chính phủ (VGCA) hay VNPT SmartCA theo NĐ 130/2018, hay chấp nhận cơ chế ký số nội bộ có giá trị xác nhận (không cần CA pháp lý)?
3. **Đặc tả kỹ thuật kết nối LGSP/IOC thành phố:** Dòng 340 ("sẵn sàng cung cấp API... với hệ thống khác có liên quan") và dòng 636 ("kết nối với IOC") — đề nghị cung cấp đặc tả kỹ thuật (giao thức, định dạng, endpoint, cơ chế xác thực) của Trục LGSP và IOC Hải Phòng để nhà thầu thiết kế adapter đúng ngay từ giai đoạn chuẩn bị hồ sơ.

### Bổ sung — phát hiện khi đọc toàn văn 668 dòng:
4. **Số lượng xã/phường/đặc khu chính xác và số tài khoản dự kiến theo đơn vị:** HSMT chỉ ghi "500 người sử dụng, 90 CCU" (dòng 62) cho TOÀN GÓI, không ghi rõ số đơn vị hành chính cấp xã sau sắp xếp/sáp nhập sẽ dùng hệ thống — đề nghị cung cấp danh sách cụ thể để tính đúng sizing hạ tầng và phân bổ tài khoản.
5. **Nền tảng công nghệ .NET/MSSQL/Windows Server là ràng buộc BẮT BUỘC hay THAM KHẢO:** Dòng 332–335 ("Nền tảng công nghệ lập trình: .NET", "MS SQL Server 2022 trở lên", "Windows server OS (2019) hoặc cao hơn, Linux") và dòng 544 ("Phụ thuộc nền tảng: MS SQL Server, Windows Server, Microsoft Visual Studio, .NET 8.0 trở lên") — đây có phải tiêu chí "Đạt/Không đạt" áp dụng cứng, hay chấp nhận công nghệ khác nếu đáp ứng tương đương về chức năng/hiệu năng/ATTT? (Lưu ý: HĐH máy chủ dòng 334 ghi cả "Windows server OS... hoặc cao hơn, Linux" — có mâu thuẫn nội tại với dòng 544 chỉ ghi "Windows Server" — cần làm rõ Linux có được chấp nhận cho máy chủ không, vì File-Server trong bảng sizing dòng 322 đã ghi "Ubuntu Server").
6. **Hạ tầng do Trung tâm dữ liệu TP cấp hay nhà thầu tự mang:** Dòng 160–165 ghi rõ "Trách nhiệm của đơn vị quản lý Trung tâm dữ liệu TP Hải Phòng: Bố trí hạ tầng kỹ thuật... máy chủ, HĐH, HQTCSDL, mạng" — vậy nhà thầu KHÔNG cần tự đầu tư hạ tầng theo bảng sizing dòng 318–322 (2x DB-Server 32vCPU/64GB, v.v.), đúng không? Nếu đúng, đề nghị xác nhận thời điểm và điều kiện được cấp phát VM/tài khoản để nhà thầu lập kế hoạch cài đặt trong 3 tháng.
7. **Giới hạn dung lượng lưu trữ tài liệu/video họp:** HSMT không nêu giới hạn dung lượng file đính kèm hay tổng dung lượng lưu trữ 60 tháng — đề nghị làm rõ để tính đúng cấu hình File-Server (bảng dòng 322 chỉ ghi "Ubuntu Server, 8 Core, 16Gb" không ghi dung lượng lưu trữ, khác với 3 dòng máy chủ khác đều có cột "Dung lượng lưu trữ").
8. **Mật mã cơ yếu áp dụng cho loại dữ liệu nào:** Dòng 75 yêu cầu "các dữ liệu thuộc diện bắt buộc phải mã hóa được thực hiện mã hóa/giải mã bằng mật mã cơ yếu" — đề nghị xác định rõ danh mục dữ liệu nào của hệ thống (biên bản họp mật? phiếu biểu quyết kín? toàn bộ CSDL?) thuộc "diện bắt buộc" này, vì đây quyết định phạm vi phải tích hợp giải pháp Ban Cơ yếu Chính phủ.
9. **Nội dung đầy đủ của Phụ lục 11, Phụ lục 12 TT 18/2024/TT-BTTTT và Phụ lục II TT 16/2024/TT-BTTTT:** HSMT chỉ dẫn chiếu (dòng 147, 226, 260) mà không đính kèm toàn văn phụ lục — đề nghị cung cấp bản đầy đủ để nhà thầu soạn đúng quy trình vận hành/bảo trì/vận hành thử theo mẫu chuẩn, tránh làm sai cấu trúc khi nộp hồ sơ.
10. **Tiêu chí đánh giá Đạt/Không đạt cụ thể ở Chương III:** File Chương V này là "yêu cầu kỹ thuật chi tiết", nhưng thang điểm/tiêu chí loại thầu theo Chương III (năng lực, kinh nghiệm, hợp đồng tương tự) không nằm trong phạm vi đọc của báo cáo này — đề nghị xác nhận với bộ phận phụ trách hồ sơ pháp lý xem gói thầu có yêu cầu "hợp đồng tương tự đã nghiệm thu" hay không, vì đây là rào cản khác hoàn toàn ngoài phạm vi kỹ thuật.
11. **"Kiểm tra định kỳ" trong giai đoạn thuê dịch vụ ai thực hiện, chu kỳ bao lâu:** Nhiều dòng (58, 59, 60, 65...) ghi "Tổ chức kiểm tra định kỳ" nhưng không ghi rõ chu kỳ (hàng tháng? hàng quý?) — ảnh hưởng đến việc nhà thầu lập kế hoạch nhân sự vận hành phục vụ các đợt kiểm tra này trong 60 tháng.

---

## MỤC 5. KẾT LUẬN CỦA TỔ CHẤM GIẢ ĐỊNH

### Kết luận tổng thể: **HỒ SƠ KỸ THUẬT — KHÔNG ĐẠT nếu chấm hôm nay (17/07/2026)**

Căn cứ nguyên tắc chấm HSMT dòng 658 ("Với mỗi tiêu chí được đánh giá, kết quả thể hiện giá trị đạt/không đạt"), và các điều kiện tiên quyết không thể bỏ qua:

- **HSMT dòng 71** yêu cầu giai đoạn chuẩn bị dịch vụ đã phải có "Hệ thống thông tin được xác định cấp độ và triển khai phương án bảo đảm an toàn theo quy định của pháp luật" — **hiện tại: chưa có hồ sơ ATTT cấp độ 3 nào được lập, chưa pentest.**
- **HSMT dòng 255** yêu cầu vận hành thử bắt buộc theo Khoản 1 Điều 58 NĐ 73/2019/NĐ-CP trước khi đưa vào sử dụng — **hiện tại: chưa có kế hoạch/kịch bản vận hành thử chính thức, chưa thực hiện.**
- **HSMT dòng 633** yêu cầu website công bố chức năng sản phẩm — điều kiện dự thầu — **hiện tại: hoàn toàn chưa có.**
- **HSMT dòng 70** yêu cầu văn bản cam kết bảo mật thông tin — **hiện tại: chưa soạn.**

Bốn điểm trên đủ để một tổ chấm khó tính đánh giá hồ sơ **KHÔNG ĐẠT** nếu nộp ở trạng thái hiện tại, vì đây là các điều kiện tiên quyết theo văn bản, không phải "điểm cộng kỹ thuật".

### Điểm mạnh ghi điểm (nếu xử lý được các điểm chết người trước hạn nộp/nghiệm thu):
1. **Độ phủ nghiệp vụ chức năng rất cao** — 58/59 mục web có UI thực thi, không phải mockup; đã bổ sung đúng các gap mà báo cáo BA cũ từng ghi "❌" (chất vấn, sơ đồ phòng họp, quản trị đơn vị, HDSD, audit log filter+xóa, danh mục cơ quan ban hành) — cho thấy nhà thầu có năng lực phản hồi gap nhanh.
2. **Đã có bằng chứng port .NET 8 + SQL Server 2022 thật** (không chỉ nói suông) — mã nguồn `server-dotnet/` với `Microsoft.Data.SqlClient`, docker-compose có container MSSQL 2022 thật, 72/72 test PASS (dù test in-memory, chưa test MSSQL thật) — đây là phản hồi trực diện với rủi ro "lệch nền tảng công nghệ" từng là điểm chặn số 1 trong phân tích nội bộ.
3. **API mở LGSP-ready có code thật, không phải khái niệm** — `OpenApiCatalog.cs`/`OpenRoutes.cs` (818 dòng), đủ 6 endpoint mục 54–59, có OpenAPI 3.0 spec tự sinh, cơ chế khóa API + scope + rate-limit rõ ràng.
4. **Cơ chế bảo mật tầng ứng dụng có thật và tinh vi hơn mức tối thiểu** — CAS chống mất phiếu, lọc quyền đọc theo bản ghi (tài liệu mật/phiếu kín), audit log filter+xóa, rate-limit chống brute-force.
5. **Backup/restore là script thật chạy được**, không phải placeholder — dù chưa test end-to-end.

### Điểm chết người (must-fix trước khi có thể nộp/nghiệm thu):
1. **Chưa có hồ sơ ATTT cấp độ 3 + pentest độc lập** — pháp lý bắt buộc, KHÔNG thể tự làm bằng code, cần đơn vị bên ngoài, thời gian 4–8 tuần.
2. **Ký số vẫn là mô phỏng (PIN 6 số + SHA-256 tự chế)** — không có giá trị pháp lý cho văn bản hành chính nhà nước; rủi ro bị đánh giá "chưa đáp ứng chức năng 30" dù UI đã có.
3. **Website công bố sản phẩm không tồn tại** — điều kiện dự thầu, dễ khắc phục nhất trong nhóm "chết người" (chỉ cần vài ngày).
4. **Toàn bộ SLA định lượng (đáp ứng <5s, tìm kiếm <30s, 90 CCU, gián đoạn ≤3 lần/năm...) chưa có một số liệu đo nào** — không thể "cam kết bằng lời" khi tổ nghiệm thu yêu cầu chứng minh bằng kiểm thử/vận hành thử thực tế.
5. **Không có bất kỳ văn bản hồ sơ dự thầu chính thức nào** (cam kết SLA, cam kết bảo mật, phương án chuyển giao dữ liệu, phương án nâng cấp, quy trình vận hành/bảo trì, giáo trình đào tạo) — 11/19 tài liệu bắt buộc hoàn toàn chưa có; các tài liệu đã có (`docs/phan-tich-hsmt-*.md`) là phân tích nội bộ, không đúng thể thức nộp thầu.
6. **`SqlServerDocStore` chưa từng chạy thành công trên SQL Server thật** — tự nhận trong README, đây là rủi ro kỹ thuật cụ thể (không phải giả định) vì là nền tảng CSDL bắt buộc của HSMT.

### Khuyến nghị ưu tiên cho nhà thầu (theo thứ tự cấp bách):
1. Gửi ngay 11 câu hỏi làm rõ ở Mục 4 — đặc biệt câu 2 (chuẩn ký số), câu 5 (ràng buộc .NET/MSSQL bắt buộc hay tham khảo), câu 6 (hạ tầng TP cấp) — vì các câu trả lời quyết định lại toàn bộ phạm vi công việc còn lại.
2. Dựng website công bố chức năng sản phẩm (việc nhanh, rẻ, chặn dự thầu nếu thiếu).
3. Khởi động hồ sơ ATTT cấp độ 3 + đặt lịch pentest độc lập NGAY (thời gian chờ dài nhất, không nằm trên critical path code).
4. Chạy thử `docker-compose.dotnet.yml` với SQL Server 2022 thật để xác nhận `SqlServerDocStore` hoạt động — đây là việc kiểm chứng nhanh, rẻ, nhưng đang là lỗ hổng lớn về bằng chứng.
5. Soạn song song toàn bộ 11 tài liệu hồ sơ còn thiếu ở Mục 3 — đây là việc soạn thảo, không phụ thuộc code, có thể làm ngay trong khi chờ trả lời làm rõ HSMT.

---

## TOP VIỆC ĐỀ XUẤT CHO DEV/HỒ SƠ ĐÊM NAY

### A. VIỆC CODE (dev thực thi được ngay, không phụ thuộc bên ngoài)

1. **Chạy thử `docker-compose.dotnet.yml` với SQL Server 2022 thật** — xác nhận `SqlServerDocStore` hoạt động đúng (tạo bảng, nạp seed, CRUD, CAS) trên MSSQL thật, không chỉ InMemory. Đây là bằng chứng kỹ thuật rẻ nhất để vá lỗ hổng "chưa kiểm thử trên SQL Server thật" mà README tự thừa nhận.
2. **Viết script load test tối thiểu** (k6 hoặc script Node đơn giản gọi API đồng thời) mô phỏng 90 CCU thao tác biểu quyết + tra cứu, đo p95 response time — dù chưa đạt production-grade, có SỐ LIỆU CỤ THỂ để trích dẫn vẫn tốt hơn "chưa đo" hoàn toàn.
3. **Viết script test restore end-to-end** — chạy `backup.sh` → xóa dữ liệu giả lập → chạy `restore.sh` → xác nhận dữ liệu khôi phục đúng 100%, đo thời gian thực hiện (chứng minh khả năng đạt RTO 24h bằng số liệu, không phải suy luận).
4. **Rà soát cấu hình IPv6** trong Caddyfile/docker-compose — tối thiểu xác nhận dual-stack không bị chặn cứng ở tầng network config (dù chưa test triển khai thật, chỉnh để không tự loại bỏ IPv6 trong code/config là việc nhanh).
5. **Bổ sung bản xuất dữ liệu thân thiện (CSV/JSON) độc lập với pg_dump** — chuẩn bị sẵn tool/script xuất toàn bộ dữ liệu nghiệp vụ (không chỉ SQL dump) để làm bằng chứng kỹ thuật cho "phương án chuyển giao dữ liệu".
6. **Rà soát LiveKit Cloud vs self-host** — nếu đang dùng bản Cloud, kiểm tra chính sách lưu trữ dữ liệu audio/video của nhà cung cấp để xác nhận không vi phạm dòng 643 HSMT ("không chia sẻ dữ liệu cho bên thứ 3 khi chưa được phép").

### B. VIỆC SOẠN TÀI LIỆU (không cần code, có thể làm song song/đêm nay)

1. **Website công bố chức năng sản phẩm** — trang giới thiệu tĩnh (có thể publish nhanh), liệt kê đủ 97 mục chức năng theo đúng cách đặt tên của HSMT mục 3.4, không cần đăng nhập để xem.
2. **Văn bản cam kết bảo mật thông tin** — theo đúng dòng 70 HSMT ("Nhà thầu phải cam kết về bảo mật thông tin"), dòng 645/649 (cơ yếu, Pháp lệnh bảo vệ bí mật nhà nước).
3. **Kịch bản kiểm thử vận hành thử chính thức** — dùng khung 25 ca ở Mục 2 báo cáo này làm nền, mở rộng đủ để bao quát toàn bộ 97 mục chức năng + toàn bộ bảng SLA mục 3.1, đúng thể thức nộp kèm hồ sơ.
4. **Cam kết SLA bằng văn bản** — chuyển hóa toàn bộ bảng số liệu SLA (mục 1.2 báo cáo này) thành văn bản cam kết có chữ ký, kèm cơ chế đo lường/báo cáo.
5. **Phương án chuyển giao dữ liệu khi kết thúc hợp đồng** — văn bản mô tả quy trình (không chỉ script kỹ thuật), đúng dòng 647–650 HSMT.
6. **Phương án nâng cấp khi có quy định mới** — văn bản cam kết ≤3 tháng theo dòng 652.
7. **Quy trình quản trị vận hành + bảo trì** — soạn theo cấu trúc TỪNG quy trình con dòng 149–252 HSMT (không gộp chung thành 1 văn bản mơ hồ — tổ nghiệm thu sẽ đối chiếu từng mục con).
8. **Giáo trình đào tạo** (2 giáo trình riêng: quản trị 1 ngày, người dùng 1 buổi) theo đúng nội dung dòng 124–138.
9. **Kế hoạch cài đặt/triển khai chi tiết** — chuyển `docs/phan-tich-hsmt-TechLeader.md` mục 4 (kế hoạch 12 tuần) thành văn bản đúng thể thức trình Chủ đầu tư theo dòng 635.
10. **Gửi văn bản làm rõ HSMT** — 11 câu hỏi ở Mục 4 báo cáo này, ưu tiên gửi trong giai đoạn hỏi đáp trước khi nộp hồ sơ (không chờ đến sau khi trúng thầu).
