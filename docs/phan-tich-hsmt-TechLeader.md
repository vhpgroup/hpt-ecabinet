# BÁO CÁO TECH LEADER: ĐÁNH GIÁ COMPLIANCE KỸ THUẬT eCabinet vs E-HSMT

**Gói thầu:** Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu — Sở KH&CN TP Hải Phòng
**Hình thức:** Thuê dịch vụ CNTT 60 tháng, chuẩn bị dịch vụ tối đa 3 tháng
**Nguồn:** Phụ lục 01 Chương V (E-HSMT) — các mục 3.1, 3.2, 3.3, 3.5, 4.2, E
**Ngày lập:** 17/07/2026
**Người lập:** Tech Leader dự án eCabinet

**Lưu ý về nguồn dữ liệu:** Nội dung chi tiết của Mục E (Quy định kiểm tra, nghiệm thu sản phẩm) bị cắt cụt trong file trích xuất — chỉ còn tiêu đề, không có nội dung theo sau. Các nội dung liên quan đến nghiệm thu/vận hành thử được tổng hợp từ các đoạn rải rác trong mục 3.1 và 3.5 (căn cứ Điều 58 NĐ 73/2019/NĐ-CP, Phụ lục II TT 16/2024/TT-BTTTT). Cần lấy bản đầy đủ Mục E trước khi làm hồ sơ dự thầu chính thức.

---

## 0. TÓM TẮT ĐIỀU HÀNH

eCabinet hiện tại là một sản phẩm software đúng nghiệp vụ (họp không giấy, biểu quyết, lấy ý kiến văn bản, điểm danh, video meeting) nhưng **lệch nền tảng công nghệ nghiêm trọng** so với ràng buộc cứng của HSMT: HSMT quy định rõ .NET 8.0+, MS SQL Server 2022+, Windows Server, triển khai tập trung tại Trung tâm dữ liệu (DC) thành phố — còn eCabinet dùng Node.js + PostgreSQL + Docker, tự triển khai trên VPS/VM ngoài. Đây là **rủi ro loại thầu (technical non-compliance) lớn nhất**, không phải vấn đề "thiếu tính năng".

Bên cạnh đó, 4 khoảng trống kỹ thuật lớn: (1) ký số hiện là mô phỏng, chưa dùng CA hợp pháp; (2) chưa có hồ sơ ATTT cấp độ 3 theo NĐ 85/2016 + pentest độc lập — là điều kiện **bắt buộc** trước khi vận hành, không phải "nên có"; (3) chưa có app mobile native Android/iOS như mục tiêu B yêu cầu; (4) chưa có kết nối LGSP/IOC thành phố. Về hiệu năng (500 người dùng/90 CCU, phản hồi <5s), hạ tầng dự kiến của HSMT là 2 cụm server đối lập với hiện trạng "chưa test tải, chưa HA" của eCabinet — cần benchmark thực tế trước khi cam kết.

3 tháng chuẩn bị dịch vụ là **rất chật** để giải quyết đồng thời: đổi kiến trúc hạ tầng, làm ký số thật, làm ATTT cấp độ 3 + pentest, làm LGSP adapter, và có thể phải viết lại backend theo stack .NET/MSSQL nếu HSMT không chấp nhận stack khác — xem phần 2 và rủi ro #1.

---

## 1. BẢNG COMPLIANCE KỸ THUẬT

### 1.1. Mục 3.1 — Chất lượng dịch vụ CNTT (SLA)

| # | Yêu cầu HSMT (nguyên văn/số liệu) | Trạng thái | Hiện trạng eCabinet | Việc phải làm |
|---|---|---|---|---|
| 1 | Hiệu năng: "Thời gian đáp ứng cho một thao tác của người dùng khi vận hành thực tế trung bình dưới 5 giây" | **MỘT PHẦN** | Chưa có benchmark tải thực tế công bố; kiến trúc Node.js + WebSocket tự viết + PGlite dev/Postgres prod có khả năng đạt nhưng chưa đo | Chạy load test (k6/Artillery) với 90 CCU mô phỏng, đo p95 response time cho các thao tác chính (mở tài liệu, biểu quyết, gửi ý kiến) |
| 2 | "Tốc độ tra cứu, tìm kiếm dữ liệu theo nhiều điều kiện dưới 30 giây" | **MỘT PHẦN** | PostgreSQL JSONB có thể chậm với filter đa điều kiện nếu thiếu index phù hợp | Rà soát index GIN/B-tree cho các trường tra cứu, benchmark truy vấn phức tạp |
| 3 | "Thời gian kết xuất báo cáo tổng hợp phạm vi lớn, nhiều năm, toàn thành phố ... dưới 5 phút, không lỗi timeout" | **CHƯA** | Chưa có module thống kê/báo cáo quy mô toàn thành phố (đa xã/phường) được kiểm chứng; kiến trúc hiện là 1 instance duy nhất | Thiết kế báo cáo async/batch (job queue), có thể cần warehouse/read-replica riêng nếu multi-tenant |
| 4 | "Hệ thống cần đáp ứng cho tối thiểu **500 người sử dụng, trong đó 90 người sử dụng ở một thời điểm**" | **MỘT PHẦN** | Chưa test tải ở mức CCU này; rate-limit theo IP+tài khoản có thể là điểm nghẽn nếu nhiều user cùng UBND dùng chung NAT/IP | Load test 90 CCU đồng thời (bao gồm cả kênh WebSocket + LiveKit video nếu họp trực tuyến diễn ra song song), rà lại ngưỡng rate-limit theo IP văn phòng |
| 5 | "Khả năng mở rộng không giới hạn số người sử dụng" | **MỘT PHẦN** | Không có HA/cluster, không có auto-scale; 1 instance Docker Compose là single point of failure | Thiết kế khả năng scale ngang (nhiều instance API phía sau load balancer, Postgres có thể cần read replica) |
| 6 | ATTT: "Không một lỗ hổng nào... mức độ nghiêm trọng từ cấp độ 3 trở lên khi kiểm tra bằng phần mềm chuyên dụng" | **CHƯA** | Chưa từng pentest độc lập/quét lỗ hổng chuyên dụng (chỉ có guard validate + ACL tự viết, chưa kiểm chứng bên ngoài) | Thuê đơn vị pentest độc lập (có pháp nhân, chứng chỉ ATTT theo quy định), khắc phục lỗ hổng trước nghiệm thu |
| 7 | "Toàn bộ dữ liệu... phải bảo đảm tính vẹn toàn, không bị thay đổi/mất trong xử lý và lưu trữ" | **ĐÁP ỨNG** | Atomic update (CAS) chống mất phiếu biểu quyết đồng thời, audit log, guard validate kiểu dữ liệu đã có sẵn | Bổ sung tài liệu mô tả quy trình đảm bảo vẹn toàn dữ liệu để nộp hồ sơ |
| 8 | "Bảo đảm an toàn hệ thống thông tin theo **Cấp độ 3**" (hệ thống hạ tầng dùng chung 1 tỉnh) — dẫn Điều 9 NĐ 85/2016/NĐ-CP, TT 12/2022/TT-BTTTT | **CHƯA** | Chưa có hồ sơ xác định cấp độ, chưa có phương án bảo đảm ATTT theo cấp độ được phê duyệt | Lập hồ sơ đề xuất cấp độ (theo mẫu NĐ 85/2016), phương án bảo đảm ATTT cấp độ 3 (TT 12/2022), trình Sở TT&TT/Sở KH&CN thẩm định — quy trình này thường mất 4-8 tuần, KHÔNG chỉ là việc kỹ thuật thuần |
| 9 | Số lần gián đoạn dịch vụ chấp nhận **≤3 lần/năm**; khoảng cách tối thiểu giữa 2 sự cố liên tiếp **≥4 tháng** | **MỘT PHẦN** | Chưa có giám sát uptime tập trung để đo/chứng minh; đã chạy thật trên VPS Coolify + VM Ubuntu nhưng chưa qua chu kỳ vận hành dài để có dữ liệu | Triển khai giám sát uptime (Prometheus/Grafana/Uptime Kuma), tích lũy dữ liệu SLA thực tế trước và trong giai đoạn nghiệm thu |
| 10 | Khả năng phục hồi: **24h** kể từ khi xảy ra sự cố; **100% dịch vụ** và **100% dữ liệu/thành phần** phải phục hồi | **MỘT PHẦN** | Có backup pg_dump hằng ngày + rotate — đáp ứng khôi phục dữ liệu, nhưng chưa có runbook DR chính thức, chưa test restore end-to-end, chưa có hạ tầng dự phòng (standby) để đạt 24h khi cả server chính hỏng | Viết runbook DR (RTO/RPO cụ thể), test restore thực tế định kỳ, xem xét chuẩn bị server/instance dự phòng nóng hoặc ấm |
| 11 | "Xác định nguyên nhân và đưa hướng dẫn khắc phục trong vòng **08 giờ**" khi sự cố | **MỘT PHẦN** | Có audit log hỗ trợ điều tra nhưng chưa có giám sát/cảnh báo tự động 24/7 để phát hiện sớm | Thiết lập alerting (Prometheus Alertmanager/Grafana + kênh Zalo/Telegram/SMS on-call) |
| 12 | "Thay thế/nâng cấp thành phần mà không ảnh hưởng chất lượng dịch vụ, qua dự phòng và chuyển mạch tự động" | **CHƯA** | Docker Compose single-node, chưa có blue-green/rolling deploy, chưa có failover tự động | Thiết kế zero-downtime deploy (rolling update), health check + auto-restart, cân nhắc HA cho DB (streaming replication) |
| 13 | "Hỗ trợ kiểm tra, giám sát liên tục 24/7, cảnh báo tự động, nhật ký theo dõi" | **CHƯA** | Chưa có giám sát tập trung; chỉ có audit log ứng dụng, chưa có giám sát hạ tầng (CPU/RAM/disk/network) | Triển khai Prometheus + Grafana + node-exporter + alerting, kết hợp log tập trung (Loki/ELK) |
| 14 | "Toàn bộ dữ liệu... theo tiêu chuẩn TCVN 6909:2001 (Unicode)" | **ĐÁP ỨNG** | PostgreSQL UTF-8 mặc định | Xác nhận collation/encoding trong tài liệu kỹ thuật |
| 15 | Định dạng tập tin theo TT 39/2017/TT-BTTTT | **MỘT PHẦN** | Chưa rà soát cụ thể định dạng file export/import (PDF/A, docx, jpg...) theo thông tư | Rà soát danh mục định dạng cho phép, đảm bảo export tài liệu/biên bản đúng chuẩn |
| 16 | Đào tạo: 2 lớp (quản trị 1 ngày/10hv trực tiếp; người dùng 1 buổi trực tiếp+trực tuyến), tài liệu HDSD | **ĐÁP ỨNG** (về khả năng đáp ứng, chưa chuẩn bị) | Chưa có tài liệu đào tạo/quản trị chính thức | Soạn tài liệu HDSD, tài liệu quản trị hệ thống, chuẩn bị giảng viên+trợ giảng |

### 1.2. Mục 3.2 — Yêu cầu kỹ thuật, công nghệ (kiến trúc, hạ tầng, ATTT, nền tảng)

| # | Yêu cầu HSMT (nguyên văn/số liệu) | Trạng thái | Hiện trạng eCabinet | Việc phải làm |
|---|---|---|---|---|
| 17 | **"Mô hình cơ sở dữ liệu tập trung"**; "Hệ thống phần mềm được cài đặt tập trung tại Trung tâm tích hợp dữ liệu thành phố" | **MỘT PHẦN** | eCabinet hiện chạy 1 instance PostgreSQL — mô hình dữ liệu phù hợp "tập trung", nhưng đang đặt trên VPS/VM ngoài (Coolify/Ubuntu VM), KHÔNG đặt tại DC thành phố | Làm việc với Trung tâm CNTT/DC thành phố Hải Phòng để xác nhận có được host tại DC thành phố hay chấp nhận DC/cloud của nhà thầu (xem phần 3 — đây là quyết định kiến trúc, không chỉ kỹ thuật) |
| 18 | Sizing máy chủ đề xuất: **DB-Server 32 vCPU/64GB/500GB x2; Web-Server 16 vCPU/32GB/200GB x2; App-Server 16 vCPU/32GB/200GB x2; File-Server 8 vCPU/16GB x1** (ảo hóa) | **KHÔNG ÁP DỤNG TRỰC TIẾP — cần làm rõ** | Đây là bảng "cấu hình đề xuất" trong HSMT, gắn với OS Windows Server cho DB/Web/App — không khớp kiến trúc Docker Compose 1-VM hiện tại của eCabinet | Đề xuất bảng sizing riêng tương đương (theo Linux/container) và giải trình lý do khác biệt (xem phần 3) |
| 19 | **Nền tảng công nghệ: ".NET"; Hệ QTCSDL: "Microsoft SQL Server 2022 trở lên"; HĐH máy chủ: "Windows Server 2019+ hoặc Linux"; ràng buộc "MS SQL Server, Windows Server, .NET 8.0 trở lên"** | **CHƯA** | **KHÔNG KHỚP** — eCabinet dùng Node.js (không framework) + PostgreSQL 16, hoàn toàn khác nền tảng .NET/MSSQL | Đây là điểm rủi ro loại thầu cao nhất. 3 lựa chọn: (a) xin làm rõ/kiến nghị HSMT chấp nhận nền tảng tương đương (open standard, không khóa vendor) trước khi nộp hồ sơ; (b) chuẩn bị lớp tương thích/migration path sang MSSQL nếu buộc phải theo đúng văn bản; (c) đấu thầu với giải trình "công nghệ tương đương hoặc tốt hơn" nếu quy định đấu thầu cho phép. **Phải làm rõ với bên mời thầu TRƯỚC khi nộp hồ sơ** — đây là quyết sách, không tự quyết được ở cấp kỹ thuật |
| 20 | "Cụm Server-Web... đặt qua thiết bị bảo mật, cân bằng tải, thiết bị mạng chuyên dụng" | **CHƯA** | Chỉ có Caddy (reverse proxy HTTPS), chưa có WAF/thiết bị cân bằng tải chuyên dụng, chưa tách cụm | Bổ sung WAF (ví dụ ModSecurity/Cloudflare/thiết bị DC cấp), load balancer nếu multi-instance |
| 21 | ATTT Cấp độ 3 theo NĐ 85/2016, TT 12/2022/TT-BTTTT — "hạ tầng phải đáp ứng yêu cầu cơ bản bảo đảm an toàn HTTT Cấp độ 3" | **CHƯA** | Chưa có hồ sơ cấp độ, chưa rà soát checklist TT 12/2022 (phân vùng mạng, kiểm soát truy cập, giám sát, mã hóa...) | (Trùng #8) — Lập và trình phê duyệt hồ sơ ATTT cấp độ 3; đây là yêu cầu **bắt buộc trước khi vận hành**, không thể bỏ qua |
| 22 | IPv6-ready: "phải sẵn sàng về kiến trúc và kỹ thuật cho IPv6" | **MỘT PHẦN** | Node.js/nginx/Caddy hỗ trợ IPv6 về nguyên tắc nhưng chưa cấu hình/test cụ thể | Cấu hình và test dual-stack IPv4/IPv6 trên toàn bộ pipeline (DNS, nginx, Caddy, WebSocket) |
| 23 | "Triển khai HTTPS sử dụng TLS v1.2 trở lên với bộ mã hóa an toàn" | **ĐÁP ỨNG** | Caddy tự động Let's Encrypt/internal HTTPS — Caddy mặc định TLS 1.2/1.3 với cipher suite an toàn | Xác nhận cấu hình cipher suite qua SSL Labs test, đưa vào hồ sơ ATTT |
| 24 | Sao lưu: "cơ chế tự động sao lưu theo lịch trình hoặc tùy chọn; có khả năng phục hồi CSDL từ backup" + "dữ liệu cấu hình hệ thống, CSDL nội dung, dữ liệu liên quan khác" | **ĐÁP ỨNG PHẦN LỚN** | Script backup pg_dump hằng ngày + rotate đã chạy thật | Bổ sung backup file lưu trữ tài liệu (không chỉ DB), test restore toàn bộ (không chỉ DB mà cả file đính kèm/video), viết chính sách rotate/retention rõ ràng để đưa vào hồ sơ |
| 25 | "Xử lý đồng thời: yêu cầu truy cập dữ liệu đồng thời tại mọi thời điểm" | **ĐÁP ỨNG** | Atomic update (CAS) đã giải quyết đúng vấn đề này cho biểu quyết đồng thời | Không cần làm thêm, chỉ cần benchmark ở CCU=90 để xác nhận không có deadlock/contention |
| 26 | "Mức độ hỗ trợ bảo mật: yêu cầu bảo mật mức 2" | **ĐÁP ỨNG MỘT PHẦN** | JWT HS256 + refresh token xoay vòng, scrypt, ACL server-side, rate-limit — là các biện pháp bảo mật hợp lý ở tầng ứng dụng | Bổ sung 2FA/MFA cho tài khoản quản trị (chưa thấy trong stack hiện tại), rà soát theo checklist "mức 2" cụ thể của HSMT nếu có phụ lục riêng |
| 27 | Hỗ trợ trình duyệt: Edge, Firefox, Chrome, Cốc Cốc, bản mới nhất; HĐH máy trạm Windows 10/11, Linux, MacOS | **ĐÁP ỨNG** | React 18 PWA chạy trên browser hiện đại, không phụ thuộc OS máy trạm | Test riêng trên Cốc Cốc (browser Việt Nam, engine Chromium) để chắc chắn |

### 1.3. Mục 3.3 — Kết nối, liên thông LGSP/hệ thống khác

| # | Yêu cầu HSMT | Trạng thái | Hiện trạng eCabinet | Việc phải làm |
|---|---|---|---|---|
| 28 | "Tuân thủ QĐ 4435/QĐ-UBND (Khung KTCQĐT Hải Phòng 4.0) và NĐ 278/2025/NĐ-CP về kết nối, chia sẻ dữ liệu bắt buộc" | **CHƯA** | Chưa rà soát/áp dụng khung kiến trúc và nghị định này | Nghiên cứu khung kiến trúc CQĐT Hải Phòng 4.0 và NĐ 278/2025, thiết kế API tuân thủ |
| 29 | "Tích hợp, liên thông, chia sẻ dữ liệu... qua Nền tảng LGSP thành phố; sẵn sàng cung cấp API phục vụ kết nối" | **CHƯA** | Chưa có adapter/kết nối LGSP; chưa có API chuẩn công khai cho bên thứ 3 | Xây LGSP adapter (thường theo chuẩn REST/SOAP + X-Road hoặc trục riêng của tỉnh), làm việc với đơn vị quản lý LGSP Hải Phòng để lấy đặc tả kỹ thuật |
| 30 | "Có thể liên kết Hệ thống khác của bộ ngành qua trục NGSP" | **CHƯA** | Chưa có | Không cấp bách trong 3 tháng đầu — làm sau khi có LGSP, ghi vào lộ trình dài hạn |
| 31 | "Kết nối với IOC" trước khi đưa vào sử dụng chính thức (nêu tại 3.5) | **CHƯA** | Chưa có kết nối IOC (Trung tâm điều hành thông minh) thành phố | Xác định đặc tả kết nối IOC Hải Phòng, làm API/feed dữ liệu thống kê cuộc họp cho IOC |
| 32 | "Trao đổi dữ liệu có cấu trúc bằng XML" theo CV 3788/BTTTT-THH | **MỘT PHẦN** | Backend dùng JSON/JSONB là chuẩn phổ biến hơn XML hiện nay; cần lớp chuyển đổi nếu LGSP yêu cầu XML nghiêm ngặt | Làm lớp adapter JSON↔XML nếu LGSP thành phố yêu cầu định dạng XML cụ thể |

### 1.4. Mục 3.5 — Yêu cầu đối với nhà cung cấp dịch vụ

| # | Yêu cầu HSMT | Trạng thái | Hiện trạng eCabinet | Việc phải làm |
|---|---|---|---|---|
| 33 | "Thời gian khởi tạo dịch vụ (cài đặt, cấu hình, tích hợp, vận hành thử, đào tạo) tối đa **03 tháng**" | **MỘT PHẦN** | Đội ngũ có thể triển khai nhanh phần "cấu hình/đào tạo" nhưng khối lượng công việc kỹ thuật mới (LGSP, ATTT cấp độ 3, ký số thật, mobile) là rất lớn cho 3 tháng | Xem kế hoạch chi tiết ở phần 4 — cần ưu tiên nghiêm ngặt, có nguy cơ trễ nếu không rút gọn phạm vi hoặc tăng nhân sự |
| 34 | "Thời gian hỗ trợ trực quản trị hệ thống: **24/7**" | **MỘT PHẦN** | Chưa có đội NOC 24/7; đội hiện tại vận hành theo giờ hành chính là chủ yếu | Thiết lập ca trực on-call xoay vòng (kể cả thuê ngoài dịch vụ NOC nếu cần), tích hợp với hệ thống alerting |
| 35 | "Thời gian hỗ trợ trực tổng đài: theo giờ hành chính" | **ĐÁP ỨNG** (dễ đáp ứng) | Có thể tổ chức hotline/email hỗ trợ giờ hành chính không khó | Thiết lập kênh tiếp nhận (hotline, email, form trong app) và quy trình ticket |
| 36 | "Báo cáo kết quả cung cấp dịch vụ định kỳ **06 tháng**" | **ĐÁP ỨNG** (thủ tục, không phải kỹ thuật) | Không có vướng kỹ thuật | Chuẩn bị mẫu báo cáo dịch vụ (uptime, SLA, sự cố, số người dùng...) — cần dữ liệu từ hệ thống giám sát (xem #9,13) |
| 37 | "Phát sinh yêu cầu mới theo quy định pháp luật... tối đa 3 tháng phải đáp ứng" | **MỘT PHẦN** | Kiến trúc module hóa (React+Node API riêng biệt) hỗ trợ thay đổi nhanh nhưng thiếu CI/CD và test tự động khiến rủi ro regression khi cập nhật nhanh | Xây CI/CD pipeline + test tự động (hiện chưa có) để đổi nhanh mà không phá vỡ hệ thống đang chạy |
| 38 | "Website công bố chức năng sản phẩm chào thầu" | **CHƯA** | Chưa có trang public giới thiệu chức năng | Chuẩn bị landing page/trang demo công khai trước khi nộp hồ sơ dự thầu |
| 39 | Cam kết bảo mật thông tin, không tiết lộ dữ liệu cho bên thứ 3 | **ĐÁP ỨNG** (về chính sách) | Kiến trúc ACL + audit log hỗ trợ; cần văn bản cam kết chính thức | Soạn văn bản cam kết bảo mật đưa vào hồ sơ dự thầu |

### 1.5. Mục 4.2 — Chuyển giao dữ liệu khi kết thúc thuê

| # | Yêu cầu HSMT | Trạng thái | Hiện trạng eCabinet | Việc phải làm |
|---|---|---|---|---|
| 40 | "Thông tin, dữ liệu... thuộc sở hữu chủ trì thuê dịch vụ"; "chuyển giao đầy đủ... khi kết thúc hợp đồng" | **ĐÁP ỨNG VỀ NGUYÊN TẮC** | PostgreSQL cho phép export toàn bộ (pg_dump), file lưu trữ có thể export | Chuẩn bị quy trình/tool export "một lần" đầy đủ (DB + file + log) đúng định dạng dễ đọc (không proprietary), viết tài liệu mô tả schema để bên nhận có thể tự khai thác |
| 41 | "Dữ liệu... dưới dạng dữ liệu có thể truy xuất" khi chấm dứt hợp đồng | **MỘT PHẦN** | pg_dump là SQL dump — "có thể truy xuất" nhưng cần công cụ đọc phù hợp (không phải file phẳng CSV/Excel thân thiện) | Chuẩn bị thêm bản export CSV/Excel/JSON thân thiện cho người không chuyên kỹ thuật, kèm tài liệu hướng dẫn |
| 42 | "Nhà cung cấp không được chia sẻ dữ liệu... khi chưa được phép" | **ĐÁP ỨNG** | Kiến trúc self-host (Docker Compose, VPS riêng, không dùng SaaS bên thứ 3 lưu dữ liệu người dùng) đáp ứng tốt yêu cầu này | Rà soát các dịch vụ bên thứ 3 đang dùng (LiveKit Cloud nếu dùng, DNS...) để xác nhận không có dữ liệu nghiệp vụ bị gửi ra ngoài ngoài phạm vi cho phép |

### 1.6. Mục E — Kiểm tra, nghiệm thu (dữ liệu bị cắt, tổng hợp từ 3.1/3.5)

| # | Yêu cầu (rải rác 3.1/3.5, vì mục E gốc bị thiếu nội dung) | Trạng thái | Hiện trạng eCabinet | Việc phải làm |
|---|---|---|---|---|
| 43 | "Vận hành thử theo Khoản 1 Điều 58 NĐ 73/2019/NĐ-CP", "có sự có mặt của giám sát và các bên liên quan", lập "báo cáo kết quả vận hành thử" theo Phụ lục II TT 16/2024/TT-BTTTT | **CHƯA** | Chưa có quy trình vận hành thử chính thức theo đúng khung pháp lý này | Xây kế hoạch vận hành thử (test case theo từng chức năng 3.4 + phi chức năng 3.1/3.2), chuẩn bị báo cáo theo mẫu Phụ lục II TT 16/2024 |
| 44 | "Kiểm tra bổ sung" theo yêu cầu Chủ đầu tư, chi phí bên cho thuê chịu nếu không đạt | **N/A (điều khoản hợp đồng)** | — | Cần dự phòng ngân sách/nhân lực cho khả năng phải khắc phục sau kiểm tra bổ sung |

**GHI CHÚ QUAN TRỌNG:** Nội dung đầy đủ của Mục E chưa có trong file trích xuất — khuyến nghị lấy bản đầy đủ E-HSMT (định dạng gốc PDF/Word) để xác nhận tiêu chí nghiệm thu chi tiết trước khi hoàn thiện hồ sơ dự thầu và kế hoạch kiểm thử.

---

## 2. CÁC HẠNG MỤC KỸ THUẬT PHẢI XÂY MỚI (xếp theo mức chặn thầu)

Ký hiệu mức chặn thầu: **[CHẶN CỨNG]** = HSMT nêu rõ ràng, không đáp ứng gần như chắc chắn bị loại/không nghiệm thu được; **[CHẶN VẬN HÀNH]** = không chặn thầu ngay nhưng chặn khi đưa vào sử dụng/nghiệm thu; **[RỦI RO]** = có thể thương lượng/làm rõ được.

| Hạng mục | Mức chặn thầu | Công sức ước lượng (person-week) | Ghi chú |
|---|---|---|---|
| **Làm rõ/giải trình nền tảng công nghệ** (.NET/MSSQL/Windows Server theo văn bản vs Node.js/PostgreSQL thực tế) | **[CHẶN CỨNG]** — cao nhất | 1-2 tuần (làm rõ + văn bản kiến nghị) trước khi biết hướng đi tiếp | Phải hỏi bên mời thầu (văn bản làm rõ HSMT) TRƯỚC khi nộp hồ sơ. Nếu buộc theo đúng văn bản → cần đánh giá lại toàn bộ phạm vi (có thể phải viết lại backend, ước lượng riêng biệt 20-40 person-week, KHÔNG nằm trong kế hoạch 3 tháng chuẩn bị dịch vụ hiện tại) |
| **ATTT Cấp độ 3 (hồ sơ + phương án theo NĐ 85/2016, TT 12/2022) + pentest độc lập** | **[CHẶN VẬN HÀNH]** — bắt buộc trước nghiệm thu | 6-8 tuần (bao gồm thời gian chờ thẩm định của Sở TT&TT), trong đó phần kỹ thuật thuần (rà soát, khắc phục lỗ hổng) ~3-4 person-week | Không thể bỏ qua — là điều kiện pháp lý để đưa hệ thống hạ tầng dùng chung cấp tỉnh vào vận hành |
| **Kết nối LGSP thành phố Hải Phòng (+ sẵn sàng NGSP)** | **[CHẶN VẬN HÀNH]** | 3-4 person-week (chưa tính thời gian chờ đặc tả kỹ thuật từ đơn vị quản lý LGSP, có thể kéo dài ngoài kiểm soát) | Cần làm việc sớm với Trung tâm CNTT thành phố để lấy đặc tả — đây là phụ thuộc ngoài (external dependency), không chỉ là việc code |
| **Ký số hợp pháp (VGCA/CA công cộng hoặc SmartCA) thay thế mô phỏng** | **[CHẶN VẬN HÀNH]** (bắt buộc cho chức năng "ký số" nêu tại 3.4, và để văn bản có giá trị pháp lý) | 3-4 person-week tích hợp SDK (giả định dùng SDK/API sẵn có của VGCA hoặc nhà cung cấp SmartCA, không tự làm CA) | Cần xác nhận rõ HSMT yêu cầu ký số theo chuẩn nào (chưa thấy ghi rõ VGCA cụ thể trong đoạn trích — cần hỏi làm rõ); nếu chỉ cần "ký số nội bộ có giá trị xác nhận" thì mức độ có thể thấp hơn |
| **Giám sát tập trung (Prometheus/Grafana) + alerting 24/7 + log tập trung** | **[CHẶN VẬN HÀNH]** (để đạt SLA 8h/24h và uptime đo được) | 2-3 person-week | Có thể dùng self-host, không cần license đắt |
| **HA/dự phòng cho DB + zero-downtime deploy** | **[CHẶN VẬN HÀNH]** (để đạt "thay thế linh hoạt", "khả năng mở rộng") | 3-4 person-week | PostgreSQL streaming replication + health-check + rolling deploy |
| **Load test + tối ưu hiệu năng ở CCU=90/500 users** | **[CHẶN VẬN HÀNH]** (để chứng minh đạt SLA hiệu năng) | 1-2 person-week | Có thể phát hiện vấn đề cần fix thêm sau khi test |
| **CI/CD + test tự động** | **[RỦI RO]** (không nêu trực tiếp nhưng cần để đáp ứng "phát sinh yêu cầu mới trong 3 tháng" an toàn) | 2-3 person-week | Nên làm sớm, giảm rủi ro regression khi cập nhật nhanh trong 60 tháng vận hành |
| **App mobile native Android/iOS** (thay PWA) | **[RỦI RO — cần làm rõ]** | 8-12 person-week (2 platform, hoặc 5-7 nếu dùng React Native/Flutter tái sử dụng logic) | Mục tiêu B nêu "triển khai trên nền tảng di động phổ biến (Android, iOS)" — PWA có thể coi là "truy cập qua thiết bị di động" nhưng chưa chắc được chấp nhận thay app native lên CH Play/App Store; cần hỏi làm rõ. Kiến trúc 3.4 liệt kê "Ứng dụng trên nền tảng di động" như module riêng — nghiêng về việc HSMT muốn app thực sự |
| **WAF/thiết bị bảo mật, cân bằng tải chuyên dụng** | **[RỦI RO]** | 1-2 person-week nếu dùng giải pháp software (ModSecurity/Cloudflare); phụ thuộc hạ tầng DC nếu phải dùng thiết bị cứng | Có thể được hạ tầng DC thành phố cung cấp sẵn nếu host tại đó |
| **Kết nối IOC thành phố** | **[RỦI RO]** (nêu là điều kiện trước khi "đưa vào sử dụng chính thức") | 1-2 person-week (sau khi có đặc tả) | Phụ thuộc đặc tả từ đơn vị quản lý IOC |
| **SSO liên thông với hệ thống QLVB/điều hành thành phố** | **[RỦI RO]** — không thấy yêu cầu SSO bắt buộc rõ trong các mục đã đọc, chỉ có "kết nối, chia sẻ dữ liệu" qua LGSP | 3-5 person-week nếu cần (SAML/OAuth2 với IdP thành phố) | Cần làm rõ có bắt buộc SSO hay chỉ cần API kết nối dữ liệu |
| **Đội NOC 24/7** | **[CHẶN VẬN HÀNH]** cho SLA "trực quản trị 24/7" | Không phải "xây" kỹ thuật mà là vấn đề nhân sự/vận hành — quy đổi ước lượng ~2 person-week để dựng quy trình on-call + runbook | Có thể kết hợp thuê dịch vụ NOC ngoài nếu team nội bộ mỏng |

**Tổng ước lượng công sức kỹ thuật thuần (không tính SSO, không tính viết lại backend theo .NET) để đạt compliance tối thiểu trong 3 tháng chuẩn bị dịch vụ: khoảng 30-40 person-week**, tương đương 3-4 kỹ sư làm full-time liên tục trong 12 tuần — **rất căng nếu không cắt giảm phạm vi hoặc tăng người**, và giả định điểm nghẽn "làm rõ nền tảng công nghệ" được giải quyết nhanh có lợi cho phía giữ nguyên stack hiện tại.

---

## 3. KIẾN TRÚC TRIỂN KHAI ĐỀ XUẤT (60 tháng, đa xã/phường)

### 3.1. Mô hình: Multi-tenant tập trung (không phải instance riêng từng xã/phường)

HSMT nêu rõ "**mô hình cơ sở dữ liệu tập trung**" và "cài đặt tập trung tại Trung tâm tích hợp dữ liệu thành phố, các đơn vị vào đây để khai thác... mà không cần cài đặt phần mềm và CSDL tại từng đơn vị". Điều này khớp tự nhiên với kiến trúc web multi-tenant hiện có của eCabinet (1 backend, phân quyền theo đơn vị qua ACL) — **không nên** làm instance riêng cho mỗi xã/phường (sẽ vi phạm đúng yêu cầu "tập trung" và tốn tài nguyên gấp nhiều lần không cần thiết). Multi-tenant với tenant isolation ở tầng dữ liệu (đã có filter đọc theo bản ghi/ACL) là hướng đúng.

### 3.2. Địa điểm đặt hạ tầng: cần làm rõ, có 2 lựa chọn khả thi

HSMT viết "cài đặt tập trung **tại Trung tâm tích hợp dữ liệu thành phố**" trong phần mô tả mô hình triển khai (mục 3.2), và cũng có đoạn (mục 3.1 đào tạo/quản trị) nêu **"Trách nhiệm của đơn vị quản lý Trung tâm dữ liệu thành phố Hải Phòng: bố trí hạ tầng kỹ thuật... máy chủ, hệ điều hành, HQTCSDL, mạng"** — điều này cho thấy đây là **dịch vụ thuê phần mềm chạy trên hạ tầng DO THÀNH PHỐ CUNG CẤP**, không phải nhà thầu tự mang hạ tầng đến (khác với mô hình SaaS thuần của eCabinet hiện tại trên VPS Coolify riêng của nhà thầu).

Đây là điểm cần làm rõ gấp với bên mời thầu:
- **Nếu đúng là DC thành phố cấp hạ tầng**: nhà thầu chỉ cần cài đặt phần mềm lên VM được cấp (theo cấu hình 3.2 — có thể là Windows Server hoặc Linux tùy thỏa thuận), không cần tự vận hành VPS/Coolify. Điều này thực ra **giảm phần việc hạ tầng (HA, giám sát vật lý)** cho nhà thầu (DC thành phố chịu), nhưng đồng nghĩa **phải tương thích với chuẩn hạ tầng DC cấp** (có thể ưu tiên Windows Server + MSSQL theo bảng sizing).
- **Nếu nhà thầu được phép tự mang hạ tầng (cloud VN)**: có thể tiếp tục dùng kiến trúc Docker Compose/cloud hiện tại, miễn đáp ứng ATTT cấp độ 3 và các SLA — cần xác nhận rõ vì đoạn "Trung tâm tích hợp dữ liệu thành phố" xuất hiện khá nhất quán trong văn bản.

**Đề xuất kỹ thuật (giả định được chấp nhận đặt tại DC thành phố hoặc cloud VN tuân thủ ATTT cấp độ 3, không đặt ở nước ngoài):**

```
                    [Người dùng: web browser / mobile]
                                |
                    [Load Balancer / WAF] (DC cấp hoặc Cloudflare/Caddy)
                                |
              +--------------------------------+
              |                                |
      [API Node.js instance 1]        [API Node.js instance 2]  (scale ngang, stateless)
              |                                |
              +---------------+----------------+
                              |
                  [PostgreSQL 16 primary]
                  [PostgreSQL 16 replica]  (streaming replication, cho HA + báo cáo nặng)
                              |
                  [File storage: object storage hoặc NFS cho tài liệu/video]
                              |
              [LiveKit SFU self-host hoặc LiveKit Cloud] (video meeting)
                              |
              [Adapter LGSP] <-----> [Trục LGSP thành phố Hải Phòng]
                              |
              [Prometheus/Grafana + Loki] (giám sát + log tập trung)
```

### 3.3. Sizing sơ bộ theo số liệu HSMT

HSMT chỉ nêu CCU cho **1 gói thầu này** (500 users / 90 CCU) — không thấy số liệu tổng số xã/phường/đặc khu cụ thể trong các mục đã đọc (chỉ nói chung "các xã, phường, đặc khu trên địa bàn thành phố Hải Phòng"). Với giả định 90 CCU là baseline cho toàn bộ dự án (không phải mỗi đơn vị):

| Thành phần | Sizing đề xuất (tương đương, kiến trúc Linux/container) | So với bảng HSMT (Windows) |
|---|---|---|
| API server (Node.js) | 2 instance x 4 vCPU / 8GB RAM (scale ngang dễ hơn 1 máy lớn) | HSMT đề xuất App-Server 16 vCPU/32GB x2 (dư nhiều nếu dùng Node.js nhẹ) |
| PostgreSQL primary + replica | 8-16 vCPU / 32GB RAM / 500GB SSD (primary), replica tương đương | HSMT đề xuất DB-Server 32 vCPU/64GB/500GB x2 — có thể matching nếu cần margin lớn cho tăng trưởng |
| File/media storage | Object storage hoặc volume riêng, tối thiểu 1-2TB (video họp + tài liệu tích lũy 60 tháng) | HSMT đề xuất File-Server 8 vCPU/16GB — dung lượng cần tính lại theo khối lượng video thực tế nếu ghi hình họp |
| Web/reverse proxy | 2 vCPU/4GB đủ cho Caddy/nginx | HSMT đề xuất Web-Server 16 vCPU/32GB x2 — dư thừa nhiều so với nhu cầu thực nếu chỉ làm reverse proxy tĩnh |

**Lưu ý:** bảng sizing 32/16/16/8 vCPU của HSMT gắn với giả định chạy Windows Server + IIS/.NET + MSSQL — vốn tốn tài nguyên hơn stack Node.js/Postgres. Nếu được chấp nhận giữ stack hiện tại, sizing thực tế cần thấp hơn đáng kể — nên trình bày rõ trong hồ sơ dự thầu để tránh bị đánh giá "không đáp ứng cấu hình đề xuất" một cách máy móc.

### 3.4. Video meeting (LiveKit)

Với 90 CCU tổng nhưng số người tham gia đồng thời 1 phòng họp video thường nhỏ hơn nhiều (họp UBND xã/phường thường 10-30 người). LiveKit self-host SFU là khả thi về chi phí cho quy mô này, nhưng cần đảm bảo băng thông UDP/TURN ổn định nếu đặt tại DC thành phố (một số DC chính phủ hạn chế UDP outbound — cần kiểm tra sớm với đơn vị quản lý DC).

---

## 4. KẾ HOẠCH 3 THÁNG CHUẨN BỊ CUNG CẤP DỊCH VỤ (chỉ kỹ thuật)

Giả định: hợp đồng có hiệu lực = Tuần 1. Kế hoạch giả định điểm nghẽn "làm rõ nền tảng công nghệ" (mục 2) được giải quyết có lợi cho việc giữ nguyên stack Node.js/PostgreSQL — nếu không, toàn bộ kế hoạch dưới đây cần làm lại từ đầu với backend .NET.

**Tuần 1-2 — Làm rõ & khởi động:**
- Gửi văn bản làm rõ HSMT về: (a) nền tảng công nghệ bắt buộc hay tham khảo; (b) địa điểm đặt hạ tầng (DC thành phố cấp hay nhà thầu tự mang); (c) chuẩn ký số bắt buộc; (d) lấy bản đầy đủ Mục E (nghiệm thu)
- Làm việc với Trung tâm CNTT/DC thành phố Hải Phòng: xác nhận hạ tầng được cấp, network, firewall, UDP policy cho video
- Liên hệ đơn vị quản lý LGSP Hải Phòng: xin đặc tả kỹ thuật kết nối
- Bắt đầu lập hồ sơ xác định cấp độ ATTT (NĐ 85/2016) — quy trình này cần thời gian dài, phải khởi động sớm nhất
- Setup môi trường staging trên hạ tầng đích (DC thành phố hoặc cloud đã chốt)

**Tuần 3-4 — Hạ tầng nền:**
- Triển khai PostgreSQL streaming replication (primary/replica)
- Triển khai giám sát tập trung: Prometheus + Grafana + node-exporter + Loki (log tập trung)
- Cấu hình alerting (kênh Telegram/SMS cho on-call)
- Thiết lập CI/CD pipeline cơ bản + bắt đầu viết test tự động cho các luồng nghiệp vụ trọng yếu (biểu quyết, ký số, ACL)
- Bắt đầu tích hợp ký số thật (SDK VGCA/CA công cộng hoặc SmartCA) — song song với làm rõ chuẩn bắt buộc ở Tuần 1-2

**Tuần 5-6 — Tích hợp & bảo mật:**
- Hoàn thiện tích hợp ký số, thay thế module mô phỏng
- Xây dựng LGSP adapter (theo đặc tả nhận được từ Tuần 1-2); nếu đặc tả chưa có, làm mock adapter theo chuẩn REST/XML dự kiến để không chặn tiến độ
- Rà soát và vá theo checklist ATTT cấp độ 3 (TT 12/2022): phân vùng mạng, kiểm soát truy cập, mã hóa dữ liệu nghỉ (encryption at rest cho PostgreSQL), 2FA cho tài khoản quản trị
- Cấu hình WAF (ModSecurity hoặc thiết bị DC cấp)
- Bắt đầu load test sơ bộ (baseline, chưa tối ưu)

**Tuần 7-8 — Hiệu năng & độ tin cậy:**
- Load test đầy đủ ở 90 CCU + 500 users mô phỏng, đo p95 response time theo từng thao tác
- Tối ưu index PostgreSQL, query chậm phát hiện qua load test
- Test restore backup end-to-end (không chỉ DB mà cả file/video)
- Viết runbook DR (RTO 24h, RPO theo tần suất backup)
- Thiết lập zero-downtime deploy (rolling update, health check)
- Thuê đơn vị pentest độc lập — khởi động (kết quả thường cần 2-3 tuần)

**Tuần 9-10 — Hoàn thiện ATTT & vận hành thử:**
- Nhận kết quả pentest, khắc phục lỗ hổng phát hiện được (ưu tiên mức ≥3 theo yêu cầu HSMT)
- Hoàn thiện hồ sơ ATTT cấp độ 3, nộp cấp thẩm quyền phê duyệt (có thể cần thêm thời gian ngoài kiểm soát của nhà thầu — nên đã nộp từ Tuần 4-5 để không chặn)
- Chuẩn bị kịch bản vận hành thử theo Điều 58 NĐ 73/2019 + Phụ lục II TT 16/2024/TT-BTTTT
- Test kết nối LGSP/IOC (nếu đặc tả đã sẵn sàng) bằng dữ liệu giả lập

**Tuần 11 — Vận hành thử chính thức:**
- Thực hiện vận hành thử có giám sát các bên liên quan
- Thu thập log, đo SLA thực tế (uptime, response time) trong giai đoạn vận hành thử
- Lập báo cáo kết quả vận hành thử

**Tuần 12 — Khắc phục & nghiệm thu:**
- Khắc phục các vấn đề phát hiện trong vận hành thử
- Hoàn thiện tài liệu: HDSD, tài liệu quản trị, tài liệu kỹ thuật hệ thống, cam kết bảo mật
- Đào tạo 2 lớp (quản trị + người dùng) theo yêu cầu 3.1
- Chuẩn bị hồ sơ nghiệm thu, bàn giao đưa vào sử dụng

**Ghi chú tiến độ:** App mobile native (nếu buộc phải làm) và SSO (nếu buộc phải làm) **không nằm trong 12 tuần trên** — công sức 8-12 và 3-5 person-week tương ứng cần được cộng thêm song song bằng một nhóm nhân sự riêng từ Tuần 1, nếu không muốn trễ toàn bộ tiến độ 3 tháng.

---

## 5. RỦI RO KỸ THUẬT TOP 5 + BIỆN PHÁP

### Rủi ro #1: Nền tảng công nghệ không khớp văn bản HSMT (.NET/MSSQL/Windows Server vs Node.js/PostgreSQL) — MỨC ĐỘ: RẤT CAO
HSMT nêu rất cụ thể "Nền tảng công nghệ lập trình: .NET", "Hệ quản trị CSDL: MS SQL Server 2022 trở lên", và ràng buộc môi trường "phụ thuộc nền tảng: MS SQL Server, Windows Server, ... .NET 8.0 trở lên". Nếu tổ chuyên gia đấu thầu áp dụng đúng văn bản, hồ sơ dựa trên Node.js/PostgreSQL có thể bị đánh giá không đáp ứng yêu cầu kỹ thuật bắt buộc — dẫn đến loại thầu, bất kể chất lượng chức năng.
**Biện pháp:** Gửi văn bản yêu cầu làm rõ HSMT ngay trong giai đoạn hỏi đáp trước khi nộp hồ sơ, hỏi rõ liệu đây là "yêu cầu bắt buộc" hay "đề xuất tham khảo, chấp nhận công nghệ tương đương". Song song, chuẩn bị phương án dự phòng: đánh giá effort viết lớp tương thích (ví dụ để PostgreSQL đóng vai trò tương đương MSSQL về chức năng, hoặc cân nhắc di trú backend nếu buộc phải theo đúng văn bản) — quyết định này cần cấp quản lý dự án/kinh doanh tham gia, không chỉ kỹ thuật.

### Rủi ro #2: Chưa có ATTT cấp độ 3 + pentest độc lập trước hạn nghiệm thu — MỨC ĐỘ: CAO
Đây là yêu cầu pháp lý bắt buộc (NĐ 85/2016, TT 12/2022) cho hệ thống hạ tầng dùng chung cấp tỉnh, không phải "nice to have". Quy trình phê duyệt hồ sơ cấp độ qua Sở TT&TT thường có thời gian xử lý ngoài kiểm soát của nhà thầu (có thể vài tuần đến hơn 1 tháng), và pentest cần thời gian đặt lịch với đơn vị độc lập có tư cách pháp nhân phù hợp.
**Biện pháp:** Khởi động lập hồ sơ cấp độ và đặt lịch pentest ngay từ Tuần 1-2 (không đợi đến khi code "xong"), chạy song song với phát triển. Dự phòng buffer thời gian cho khâu phê duyệt, không tính vào critical path cuối cùng của 3 tháng.

### Rủi ro #3: Chưa xác nhận địa điểm đặt hạ tầng (DC thành phố cấp hay nhà thầu tự mang) — MỨC ĐỘ: CAO
Văn bản gợi ý mạnh "Trung tâm tích hợp dữ liệu thành phố" cấp hạ tầng, khác hoàn toàn với mô hình tự vận hành VPS/Coolify hiện tại của eCabinet. Nếu phải chuyển sang hạ tầng DC thành phố cấp, có thể phát sinh ràng buộc OS/DB (khớp với rủi ro #1), quy trình xin cấp tài nguyên/tài khoản chậm, hạn chế về network (UDP cho video, băng thông).
**Biện pháp:** Làm rõ với Trung tâm CNTT thành phố Hải Phòng ngay trong giai đoạn chuẩn bị hồ sơ dự thầu (trước khi nộp), không chờ đến khi trúng thầu. Nếu hạ tầng DC hạn chế (ví dụ chặn UDP), cần phương án thay thế cho LiveKit (TURN/relay qua TCP, chấp nhận độ trễ cao hơn).

### Rủi ro #4: Ký số hiện là mô phỏng — không có giá trị pháp lý cho văn bản hành chính — MỨC ĐỘ: TRUNG BÌNH-CAO
Chức năng "Ký số file cho ý kiến vào văn bản" (mục 3.4) trong ngữ cảnh cơ quan nhà nước thường cần chữ ký số có giá trị pháp lý (theo Luật Giao dịch điện tử, NĐ 130/2018 về chữ ký số), không thể dùng "PIN + SHA-256 khóa biên bản" tự chế nếu văn bản kết luận họp cần giá trị pháp lý chính thức.
**Biện pháp:** Làm rõ mức độ yêu cầu (ký số nội bộ xác nhận nội dung, hay chữ ký số công cộng/chuyên dùng Chính phủ có giá trị pháp lý). Nếu cần chuẩn thật, tích hợp sớm với SDK VGCA (chữ ký số chuyên dùng Chính phủ) hoặc nhà cung cấp SmartCA — đây là hạng mục có external dependency (chờ cấp phép/API key) nên phải khởi động sớm trong Tuần 1-2.

### Rủi ro #5: Thiếu dữ liệu benchmark/HA thực tế cho SLA nghiêm ngặt (≤3 gián đoạn/năm, RTO 24h, phản hồi <5s ở 90 CCU) — MỨC ĐỘ: TRUNG BÌNH
eCabinet "đã chạy thật" nhưng ở quy mô nhỏ, chưa qua load test chính thức, chưa có HA/failover tự động, chưa có giám sát liên tục để đo và chứng minh SLA. Cam kết SLA này trong hợp đồng 60 tháng mà không có hạ tầng/giám sát tương xứng dẫn đến rủi ro vi phạm hợp đồng ngay trong năm đầu vận hành.
**Biện pháp:** Bắt buộc hoàn thành load test + giám sát tập trung + HA cơ bản (DB replica, rolling deploy) TRƯỚC giai đoạn vận hành thử (Tuần 11), không lùi lại vận hành song song với sản xuất. Thiết lập từ đầu văn hóa đo SLA bằng số liệu thật, không ước lượng chủ quan, để có dữ liệu minh bạch phục vụ báo cáo 6 tháng/lần theo yêu cầu 3.5.

---

*Hết báo cáo. File này được lập từ dữ liệu mục 3.1/3.2/3.3/3.5/4.2/E trích xuất từ /agent/workspace/phuluc01-chuongV.txt. Mục 3.4 (chức năng nghiệp vụ) chỉ được lướt qua để hiểu ngữ cảnh, không phân tích compliance chi tiết — thuộc phạm vi phụ trách của BA.*
