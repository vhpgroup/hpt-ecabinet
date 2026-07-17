# PHÂN TÍCH HỆ THỐNG eCabinet vs HSMT CHƯƠNG V (BẢN MỚI ĐẦY ĐỦ)
### Gói thầu: "Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu" — Sở KH&CN TP Hải Phòng
**Người lập:** Tuệ — Chuyên gia phân tích hệ thống | **Ngày:** 2026-07-17
**Nguồn:** `docs/hsmt-chuong-v.md` (668 dòng, toàn văn, đọc hết) đối chiếu `docs/phan-tich-hsmt-BA.md` (293 dòng) và `docs/phan-tich-hsmt-TechLeader.md` (263 dòng); code `src/domain/types.ts`, `src/data/seed.ts`, `server/src/{access,acl,guard,actions,db,index,open}.js`, `server-dotnet/ECabinet.Api/{Acl,Access}.cs`.

**Kết luận mở đầu quan trọng:** Bản HSMT mới KHÔNG CHỈ đầy đủ hơn bản cũ (Mục E nghiệm thu, mục quy trình nghiệp vụ, mô hình kiến trúc/triển khai) — bản thân **code hiện tại cũng đã tiến triển xa hơn** hai báo cáo cũ mô tả: nhiều gap mà BA/Tech Leader từng ghi "❌ chưa có" (chất vấn, sơ đồ phòng họp, danh mục, tài liệu HDSD, khóa API LGSP mục 54-59) **đã có comment "E-HSMT mục X" trong code và đã implement**. Vì vậy báo cáo này có 2 lớp: (A) yêu cầu MỚI trong văn bản mà 2 báo cáo cũ bỏ sót/ghi sai, và (B) đối chiếu with code THẬT hiện tại (không chỉ dựa vào báo cáo cũ) để tránh báo cáo lại gap đã được vá.

---

## PHẦN 1. ĐỐI CHIẾU HSMT MỚI vs 2 BÁO CÁO CŨ — YÊU CẦU BỊ THIẾU/SAI

### 1.1. Mục E (Nghiệm thu) — KHÔNG bị cắt cụt như Tech Leader ghi chú

Tech Leader viết (dòng 9 báo cáo cũ): *"Nội dung chi tiết của Mục E... bị cắt cụt trong file trích xuất — chỉ còn tiêu đề, không có nội dung theo sau"*. Bản mới có ĐẦY ĐỦ nội dung này ở 2 nơi:

- **Dòng 254-260** (mục 3.1.5 "Yêu cầu về nghiệm thu, bàn giao, đưa dịch vụ vào sử dụng"): quy định vận hành thử theo Khoản 1 Điều 58 NĐ 73/2019/NĐ-CP, có mặt giám sát, lập "báo cáo kết quả vận hành thử", **dẫn chiếu Phụ lục II TT 16/2024/TT-BTTTT** — đây khớp với những gì Tech Leader đã tổng hợp rải rác, KHÔNG có gì mới về nội dung nhưng nay có **vị trí chính thức, không phải suy luận**.
- **Dòng 667-668 (chương cuối "Quy định về kiểm tra, nghiệm thu sản phẩm")**: *"Việc kiểm tra, nghiệm thu sản phẩm tuân thủ theo quy định tại Nghị định [số bị cắt do lỗi convert docx, gần như chắc chắn là NĐ 45/2026/NĐ-CP theo ngữ cảnh bối cảnh dự án] về công tác triển khai, nghiệm thu đối với dự án đầu tư ứng dụng công nghệ thông tin; xác định yêu cầu về chất lượng dịch vụ và các nội dung đặc thù của hợp đồng thuê dịch vụ đối với thuê dịch vụ công nghệ thông tin theo yêu cầu riêng và các thỏa thuận trong hợp đồng"*.
  - **Tác động:** Đây là câu kết hoàn chỉnh — file KHÔNG bị cắt cụt về nội dung nghiệp vụ, chỉ thiếu SỐ NGHỊ ĐỊNH cụ thể (lỗi OCR/convert từ DOCX, không phải lỗi trích thiếu văn bản). BA đã đúng khi ghi "NĐ 45/2026/NĐ-CP" (dòng 26 báo cáo BA) — số này khớp bối cảnh (ban hành 2026, thay thế NĐ 73/2019 cho lĩnh vực nghiệm thu ĐTC CNTT) nhưng KHÔNG xuất hiện chữ số trong bản trích — **cần xác nhận lại với văn bản DOCX gốc trước khi trích dẫn số nghị định trong hồ sơ dự thầu chính thức**, vì đây là rủi ro trích dẫn sai số văn bản pháp lý trong HSDT.
  - **Việc cần làm:** Mở lại file DOCX gốc (không phải .md đã convert) để lấy đúng số Nghị định ở câu cuối cùng, đưa vào phần "Giải pháp và phương pháp luận" và "Kế hoạch triển khai" (mục ngay trước, dòng 661-665) mà HSMT yêu cầu nhà thầu phải nộp.

### 1.2. Bảng tiêu chí chất lượng dịch vụ (mục 1.x → 6.x) — BA/TechLeader tổng hợp ĐÚNG số liệu chính nhưng THIẾU nhiều dòng chi tiết cấp con

Bản mới có bảng đầy đủ **34 dòng tiêu chí** (dòng 54-119) chia 6 nhóm; 2 báo cáo cũ đã bắt đúng các số liệu SLA lớn (< 5 giây, < 30 giây, 500/90 user, RTO 24h, 08 giờ phân tích sự cố...) nhưng BỎ SÓT các dòng tiêu chí "mềm" sau — không sai số liệu, nhưng **thiếu hoàn toàn** trong cả 2 báo cáo:

| # | Yêu cầu mới bị bỏ sót | Trích dẫn (dòng) | Tác động | Việc cần làm |
|---|---|---|---|---|
| 1 | **1.1-1.3**: "Tính đầy đủ/chính xác/phù hợp của chức năng nghiệp vụ" — yêu cầu **"Thực hiện kiểm thử hoặc vận hành thử để xác định số lượng chức năng, nghiệp vụ đáp ứng yêu cầu"** ở GIAI ĐOẠN CHUẨN BỊ, và **"Tổ chức kiểm tra định kỳ"** ở GIAI ĐOẠN THUÊ | Dòng 57-60 | Đây là yêu cầu về QUY TRÌNH kiểm thử/kiểm tra định kỳ, không chỉ về sản phẩm — cần văn bản test plan + biên bản kiểm tra định kỳ trong hồ sơ | Soạn Test Plan (danh sách case theo từng chức năng 3.4) + kế hoạch kiểm tra định kỳ (đề xuất quý/6 tháng) — việc làm hồ sơ, không phải code |
| 2 | **4.7**: "Mức độ sử dụng, khai thác của dịch vụ trong kỳ đánh giá" — thỏa thuận về "biện pháp bảo đảm hiệu quả sử dụng, khai thác dịch vụ" (hỗ trợ kỹ thuật, giám sát hiệu năng, cập nhật theo phản hồi) | Dòng 105 | Tiêu chí đánh giá riêng, không trùng SLA hiệu năng — cần cam kết cụ thể trong hợp đồng | Bổ sung điều khoản hợp đồng: cam kết hỗ trợ kỹ thuật + tối ưu theo phản hồi định kỳ |
| 3 | **5.1-5.4 — nhóm "Sự hài lòng người sử dụng"** đầy đủ: tính kịp thời cung cấp hệ thống; **phương thức ghi nhận ý kiến người dùng** (in-app, hotline, email) + lưu trữ nội dung phản hồi; khả năng hỗ trợ; **thái độ phục vụ chuyên nghiệp** | Dòng 107-111 | 2 báo cáo cũ hoàn toàn KHÔNG đề cập nhóm tiêu chí này — đây là 4 dòng chấm điểm riêng biệt, có thể ảnh hưởng điểm kỹ thuật khi vận hành thử/đánh giá dịch vụ | Xây module "Phản hồi/Góp ý" trong app (form in-app + kênh hotline/email) — hiện **CHƯA CÓ** trong domain/types.ts (không có `Feedback` entity) |
| 4 | **6.1-6.6 — nhóm "Quản lý dịch vụ" (ITSM)** đầy đủ 6 tiêu chí: tuân thủ quy trình quản lý dịch vụ (ban hành + thống nhất với đơn vị thuê); **môi trường làm việc + "bộ phận chuyên trách"**; báo cáo dịch vụ định kỳ/đột xuất; **quản lý tính sẵn sàng/liên tục** (hồ sơ riêng); **quản lý thay đổi** (hồ sơ riêng); **quản lý và triển khai phiên bản** (ghi nhận version suốt quá trình cung cấp dịch vụ) | Dòng 112-119 | Tech Leader có nhắc chung "ITSM" (dòng 116, 203 báo cáo TechLeader) nhưng KHÔNG tách 6 tiêu chí con cụ thể — đặc biệt "quản lý và triển khai phiên bản" (6.6) là yêu cầu ghi nhận version CSDL/app suốt 60 tháng, chưa từng được đề cập | Thiết lập CHANGELOG chính thức (không chỉ git log) + quy trình thay đổi (change request form) + hồ sơ sẵn sàng/liên tục riêng biệt (khác báo cáo SLA) |
| 5 | **3.7** (4 dòng con, 74-77): yêu cầu **"Bảo đảm chất lượng dữ liệu, bảo vệ dữ liệu"** tách biệt 4 khía cạnh: (a) chuẩn hóa/xác thực dữ liệu đầu vào; (b) mã hóa cơ yếu khi lưu trữ/truyền/nhận **"các dữ liệu thuộc diện bắt buộc"**; (c) quy trình làm sạch/chuẩn hóa/phân loại/xác thực dữ liệu; (d) tường lửa ứng dụng + phát hiện/ngăn chặn xâm nhập | Dòng 74-77 | Cả 2 báo cáo cũ có nhắc "mã hóa cơ yếu" (G6/#21 TechLeader) nhưng KHÔNG tách rõ đây là 4 yêu cầu riêng biệt có thể chấm điểm độc lập, đặc biệt thiếu hẳn "quy trình làm sạch/chuẩn hóa dữ liệu" — một quy trình vận hành, không phải tính năng | Viết Data Quality Procedure (validation input, dedup, chuẩn hóa) — hiện code chỉ có `validatePatch` (guard.js) kiểm KIỂU dữ liệu, CHƯA có business-rule validation (vd trùng lặp meeting code, format hợp lệ theo miền giá trị) |

### 1.3. Yêu cầu đào tạo — chi tiết hơn báo cáo cũ

Cả 2 báo cáo cũ ghi đúng số lớp/số học viên nhưng **thiếu chi tiết**: HSMT (dòng 122-144) ghi rõ nội dung đào tạo TÁCH THÀNH 2 nhóm với nội dung khác nhau:
- (a) Cán bộ quản trị (Sở): "Cài đặt, cấu hình phần mềm; Quản lý, giám sát hệ thống, nhận biết và xử lý sự cố; Sử dụng chức năng quản trị, báo cáo, phân quyền" — 01 ngày/01 lớp/~10 học viên/trực tiếp.
- (b) Cán bộ sử dụng (tại các xã/phường/đặc khu): "nhập liệu, theo dõi nghiệp vụ, quản lý báo cáo, truy xuất dữ liệu; tạo/sửa/xóa/tìm kiếm/xuất báo cáo" — **01 buổi/01 lớp** (KHÔNG phải 1 ngày như nhóm a) — **"dự kiến đào tạo cán bộ phụ trách CNTT của các xã, phường, đặc khu"** (dòng 137) — trực tiếp KẾT HỢP trực tuyến.
- **Điểm mới quan trọng bị bỏ sót:** đối tượng đào tạo (b) là **"cán bộ phụ trách CNTT của các xã, phường, đặc khu"** — CHỈ 1 lớp cho TẤT CẢ cán bộ phụ trách CNTT của (giả định) hàng chục/hàng trăm xã/phường/đặc khu toàn TP Hải Phòng, KHÔNG phải đào tạo từng đơn vị riêng lẻ. Đây gợi ý mô hình "train-the-trainer" — cán bộ phụ trách CNTT xã/phường tự đào tạo lại cho cán bộ khác tại đơn vị mình, một yêu cầu ẩn về **tài liệu tự học phải rất đầy đủ** (vì buổi đào tạo không đủ cho toàn bộ ≥500 user).
  - **Việc cần làm:** Không phải code — soạn giáo trình tự học chi tiết (không chỉ slide) vì 1 buổi/1 lớp không đủ phủ hết user cuối tại các xã.

### 1.4. Mục "Yêu cầu về quản trị, vận hành hệ thống" (TT 18/2024 Phụ lục 11) — HOÀN TOÀN MỚI, 2 báo cáo cũ chỉ nhắc chung "ITSM"/"bảo trì Phụ lục 11&12"

Đây là phần **DÀI NHẤT và CHI TIẾT NHẤT** bị bỏ sót gần như toàn bộ (dòng 146-223, ~78 dòng), chia thành:

1. **Tổ chức thực hiện quản trị, vận hành** (dòng 149-170): phân trách nhiệm RÕ RÀNG giữa 3 bên — (i) **Đơn vị cung cấp dịch vụ** (nhà thầu): bố trí nhân lực, cài đặt/cấu hình/vận hành, phối hợp Sở + Trung tâm CNTT; (ii) **Sở KH&CN**: bố trí cán bộ quản trị/sử dụng, **quản lý tài khoản người sử dụng theo phân cấp**, phối hợp xử lý sự cố; (iii) **Đơn vị quản lý Trung tâm dữ liệu TP Hải Phòng**: bố trí hạ tầng (máy chủ/HĐH/CSDL/mạng), bảo đảm điện/mạng/an toàn vật lý. Kèm nguyên tắc phân trách nhiệm cuối: *"Đơn vị cung cấp dịch vụ chịu trách nhiệm đối với PHẦN MỀM; Trung tâm CNTT chịu trách nhiệm đối với HẠ TẦNG KỸ THUẬT; Sở KH&CN chịu trách nhiệm QUẢN LÝ VÀ SỬ DỤNG phần mềm"* (dòng 168-170).
   - **Tác động:** Đây xác nhận RÕ mô hình 3 bên tách bạch trách nhiệm — khác với giả định "SaaS tự vận hành hạ tầng" mà eCabinet hiện tại đang làm (VPS/Coolify riêng). Nhà thầu KHÔNG cần tự lo hạ tầng vật lý (TT CNTT TP lo) nhưng PHẢI chứng minh có khả năng phối hợp 3 bên trong hồ sơ dự thầu (ma trận RACI).
2. **Quản trị vận hành ứng dụng** (dòng 172-182): 9 đầu việc cụ thể nhà thầu phải làm — bao gồm **"Hỗ trợ khai thác dữ liệu và trích xuất dữ liệu theo yêu cầu của cơ quan sử dụng"** (dòng 181) — đây là commitment về SLA hỗ trợ trích xuất dữ liệu theo yêu cầu ad-hoc, khác với "export dữ liệu" tự động (mục 4.2.1).
3. **Quản trị hoạt động người sử dụng** (dòng 184-193): tách 2 vai — nhà thầu "**hỗ trợ** tạo/cập nhật/khóa tài khoản THEO YÊU CẦU của Sở" (dòng 186) vs Sở "**quản lý và phê duyệt** việc cấp tài khoản và phân quyền" (dòng 191) — mô hình này ngụ ý **Sở KH&CN là approver cuối cùng cho MỌI thay đổi tài khoản, không phải unit_admin tự quyết**. Đây LỆCH với thiết kế ACL hiện tại (unit_admin tự tạo/sửa user trong đơn vị mình KHÔNG cần phê duyệt của Sở) — xem Phần 2.3.
4. **Kiểm soát, đối soát dữ liệu** (dòng 195-201): "hỗ trợ kiểm tra, đối soát dữ liệu theo yêu cầu" — khác với "sao lưu/phục hồi" đơn thuần, đây là quy trình reconciliation định kỳ.
5. **Tiếp nhận/kiểm tra/hỗ trợ yêu cầu KHÔNG liên quan cập nhật dữ liệu** (dòng 203-208): quy trình hỗ trợ (hướng dẫn dùng, tra cứu, lỗi không vào được app do hệ thống/CSDL/đường truyền) — cần **help-desk ticketing workflow**, KHÔNG có trong domain hiện tại.
6. **Tiếp nhận/kiểm tra/hỗ trợ yêu cầu LIÊN QUAN xử lý dữ liệu** (dòng 210-214): quy trình sửa dữ liệu theo yêu cầu người dùng — "cập nhật dữ liệu theo công cụ hoặc câu lệnh có sẵn theo yêu cầu" (dòng 212) — ngụ ý cần bộ script/tool sửa dữ liệu chuẩn hóa (không phải sửa tay trực tiếp DB).
7. **Lập báo cáo/tài liệu/quy trình hướng dẫn thường gặp** (dòng 216-219): FAQ + báo cáo hỗ trợ.
8. **Xây dựng công cụ/câu lệnh khai thác số liệu theo mẫu biểu CHƯA CÓ** (dòng 221-223): commitment phát triển báo cáo ad-hoc theo yêu cầu phát sinh — đây là SLA "custom reporting on demand" không giới hạn trong 60 tháng.

**Đánh giá tổng:** Toàn bộ mục này (78 dòng) là **quy trình vận hành dịch vụ (ITSM/help-desk)**, không phải tính năng phần mềm — nhưng ảnh hưởng trực tiếp đến **kế hoạch nhân sự vận hành 60 tháng** mà nhà thầu phải cam kết trong hồ sơ. 2 báo cáo cũ đã đúng khi cảnh báo "cần đội vận hành 24/7" (G9 báo cáo BA, #34 báo cáo TechLeader) nhưng KHÔNG lượng hóa được khối lượng công việc chi tiết (help-desk, đối soát dữ liệu, custom reporting, sửa dữ liệu theo yêu cầu) — đây LÀ CĂN CỨ để lập bảng nhân sự/quy trình ITSM cụ thể hơn nhiều so với ước lượng "2 person-week để dựng quy trình on-call" của Tech Leader (dòng 121 báo cáo cũ) — thực tế cần MÔ TẢ 8 quy trình vận hành riêng biệt trong hồ sơ dự thầu.

### 1.5. Yêu cầu về bảo trì (TT 18/2024 Phụ lục 12) — chi tiết hơn, có mục MỚI "kiểm tra thường xuyên/định kỳ/đột xuất"

Dòng 225-252 liệt kê:
- **Nội dung công việc chung** (dòng 231-235): *"Kiểm tra thường xuyên, định kỳ và đột xuất phục vụ việc bảo trì"* — 3 loại kiểm tra riêng biệt (không chỉ định kỳ như 2 báo cáo cũ ngụ ý), cùng **"Bảo trì theo kế hoạch bảo trì HÀNG NĂM"** — yêu cầu phải có kế hoạch bảo trì niên độ, nộp/thống nhất hàng năm trong 5 năm hợp đồng — KHÔNG được nhắc trong 2 báo cáo cũ.
- **Nội dung chính bảo trì/duy trì/cập nhật phần mềm** (dòng 237-246): 8 đầu việc cụ thể cho "phần mềm nội bộ" — bao gồm **"Kiểm tra tính toàn vẹn các cơ sở dữ liệu SAU KHI sao lưu"** (dòng 240, khác với chỉ "sao lưu" — đây là bước verify riêng, restore test định kỳ chính thức) và **"Kiểm tra hiệu suất và khả năng chịu tải của phần mềm"** (dòng 242, định kỳ trong 60 tháng, không chỉ 1 lần trước nghiệm thu như 2 báo cáo cũ hiểu — Tech Leader chỉ đề xuất load test 1 lần ở Tuần 7-8 kế hoạch 3 tháng).
- **Bảo đảm ATTT mạng** (dòng 248-252): **"Duy trì, gia hạn bản quyền, nâng cấp sản phẩm, dịch vụ an toàn thông tin mạng"** (dòng 251) — đây là commitment TÀI CHÍNH lặp lại hàng năm (license antivirus/firewall/WAF...) trong 60 tháng, một chi phí vận hành cụ thể chưa được 2 báo cáo cũ đưa vào bài toán chi phí.

### 1.6. Mô hình kiến trúc / lô-gic / triển khai phần mềm — 3 mô hình riêng biệt bị 2 báo cáo cũ MERGE lại thành 1

HSMT có **3 mục mô hình tách bạch** (dòng 274-323) mà 2 báo cáo cũ trộn lẫn thành một khái niệm "kiến trúc triển khai":

1. **Mô hình kiến trúc phần mềm** (dòng 274-291): mô tả 6 lớp logic — Lớp người dùng (5 vai trò, khớp domain hiện tại) → Kênh giao tiếp (Web + di động) → **Lớp nghiệp vụ** (10 module: Cập nhật cá nhân / Quản trị hệ thống / Quản trị danh mục / Quản lý lấy ý kiến văn bản / Quản lý tài liệu cá nhân / Quản lý thông tin cuộc họp / Tổ chức cuộc họp / Thống kê báo cáo / Tích hợp chia sẻ dữ liệu / Ứng dụng di động) → Tầng dữ liệu → **Lớp tích hợp** (qua LGSP, có thể qua NGSP) → Hạ tầng. 2 báo cáo cũ hoàn toàn KHÔNG liệt kê 10 module lớp nghiệp vụ này như một khung kiến trúc chính thức cần trình bày trong đề xuất kỹ thuật — đây LÀ khung mà hồ sơ dự thầu (Chương "Giải pháp và phương pháp luận") cần bám theo đúng cấu trúc.
2. **Mô hình lô-gic phần mềm** (dòng 293-306): liệt kê lại 10 module + câu bổ sung QUAN TRỌNG dòng 306: *"Sẵn sàng tích hợp với các Hệ thống thông tin/CSDL khác của Thành phố thông qua Trục LGSP: **Kho dữ liệu dùng chung của thành phố; Cổng thông tin điện tử**"* — đây là 2 ĐÍCH TÍCH HỢP CỤ THỂ (Kho dữ liệu dùng chung + Cổng TTĐT) mà 2 báo cáo cũ chỉ nói chung "LGSP/QLVB/IOC", KHÔNG nhắc đích "Kho dữ liệu dùng chung" và "Cổng thông tin điện tử" — 2 đầu tích hợp cụ thể cần làm rõ đặc tả riêng.
3. **Mô hình triển khai phần mềm** (dòng 308-323): có **BẢNG SIZING MÁY CHỦ CHÍNH THỨC** (DB-Server Windows 32 core/64GB/500GB x2; Web-Server Windows 16 core/32GB/200GB x2; App-Server Windows 16 core/32GB/200GB x2; File-Server **Ubuntu Server** 8 core/16GB x1). 2 báo cáo cũ đã trích đúng bảng này (Tech Leader #18) nhưng bỏ sót 1 chi tiết: **File-Server dùng Ubuntu Server (Linux), KHÔNG phải Windows** — 3/4 cụm là Windows nhưng cụm File-Server là Linux — đây là điểm có thể tận dụng: cụm lưu trữ file (video, media, tệp đính kèm) chấp nhận Linux, gợi ý các thành phần không lõi CSDL/App có thể đề xuất chạy container Linux mà không "trái HSMT" hoàn toàn.

### 1.7. Yêu cầu tiêu chuẩn kỹ thuật — 1 điểm mới: "Hệ điều hành máy trạm: Windows 10 hoặc cao hơn" (KHÁC với đoạn khác trong cùng file)

Phát hiện **MÂU THUẪN NỘI TẠI trong chính văn bản HSMT** (không phải giữa HSMT và báo cáo cũ) mà cả BA và Tech Leader đều không chỉ ra:
- Dòng 335: *"Hệ điều hành máy trạm: Windows 10 hoặc cao hơn"* (mục "Yêu cầu các tiêu chuẩn về nền tảng công nghệ") — CHỈ liệt kê Windows.
- Dòng 560 (mục "Yêu cầu về mỹ thuật, kỹ thuật... độ phức tạp"): *"phải hỗ trợ nhiều hệ điều hành của các máy trạm: **Windows 10, Windows 11, Linux, Mac OS**"* — liệt kê ĐẦY ĐỦ 4 OS.
- Dòng 27 báo cáo TechLeader ghi "Hệ điều hành máy trạm Windows 10/11, Linux, MacOS" — Tech Leader đã VÔ TÌNH LẤY ĐÚNG câu ở dòng 560 (bản đủ) nhưng không hề nhận ra bản HSMT có 2 câu MÂU THUẪN về máy trạm ở 2 vị trí khác nhau.
- **Tác động:** eCabinet là web app đa nền tảng nên KHÔNG bị ảnh hưởng thực tế bởi mâu thuẫn này, nhưng đây là **điểm cần đặt câu hỏi làm rõ với bên mời thầu** trong giai đoạn hỏi đáp E-HSMT — vì tổ chấm có thể áp dụng câu hẹp hơn (chỉ Windows) khi đánh giá, dù thực tế văn bản có câu rộng hơn ở nơi khác. Nên trích dẫn CẢ HAI câu trong văn bản làm rõ để chủ động.

### 1.8. Con số & mốc thời gian MỚI hoàn toàn — bảng tổng hợp

| Con số/mốc | Trích dẫn (dòng) | Có trong báo cáo cũ? | Ghi chú |
|---|---|---|---|
| "Khi chương trình có độ trễ quá **10 giây** cho tác vụ, hệ thống cần có công cụ hiển thị lời thông báo/biểu tượng cho người dùng biết hệ thống vẫn hoạt động" | 534 | **KHÔNG** — ngưỡng UX loading-indicator hoàn toàn mới, khác biệt với ngưỡng "< 5 giây" SLA | Cần thêm loading spinner/progress indicator cho mọi action > 10s (hiện UI dùng loading state cơ bản, chưa rà soát ngưỡng 10s cụ thể) |
| "Yêu cầu bảo mật mức **2**" (mục độ phức tạp #11, dòng 587) | 587 | Có (Tech Leader #26) nhưng KHÔNG có ngữ cảnh đây thuộc bảng "Yêu cầu về độ phức tạp kỹ thuật-công nghệ" 13 dòng (dòng 567-589) — bảng NÀY toàn bộ chưa từng được đối chiếu | Cả 13 dòng bảng độ phức tạp (Xử lý phân tán, Hiệu quả sử dụng người dùng, Độ phức tạp xử lý bên trong, Khả năng tái sử dụng mã nguồn, Dễ cài đặt, Dễ vận hành, Khả năng chuyển đổi, Dễ bảo trì, Xử lý đồng thời, Mức hỗ trợ bảo mật, Phụ thuộc mã bên thứ 3, Mức hỗ trợ đào tạo) là các tiêu chí PHẢI TRẢ LỜI TỪNG DÒNG trong hồ sơ đề xuất kỹ thuật — chưa có báo cáo nào lập bảng đối chiếu đầy đủ 13 dòng này |
| "Không có yêu cầu hỗ trợ của hệ thống về đào tạo người sử dụng" (#13, dòng 589) | 589 | KHÔNG | Ngược lại trực giác: dòng này nói phần MỀM không cần tự có tính năng "đào tạo tích hợp" (built-in tutorial) — khác với yêu cầu đào tạo CON NGƯỜI (mục riêng ở trên). Không phải gap tính năng. |
| "Có yêu cầu **thiết lập thông số khi cài đặt**" + "phải xây dựng tài liệu hướng dẫn cài đặt" (#6 Dễ cài đặt, dòng 582) | 582 | KHÔNG | Cần installer/setup wizard có tham số hóa (connection string, domain, branding theo đơn vị) — hiện code là deploy bằng Docker Compose thủ công, chưa có cấu hình qua UI |
| Yêu cầu **"Xử lý phân tán"** (#1 bảng độ phức tạp, dòng 570): "một lớp/thành phần của hệ thống tạo dữ liệu và truyền cho các lớp/thành phần khác... xử lý TỰ ĐỘNG (không cần con người can thiệp)" | 570 | KHÔNG | Có thể ứng với: WS broadcast tự động cập nhật UI (đã có), nhưng CHƯA có xử lý nền tự động dạng job/queue (vd tự tổng hợp báo cáo định kỳ, tự nhắc hạn lấy ý kiến) — đây gợi ý cần thêm scheduler/cron job trong 60 tháng vận hành |
| "**Bố trí nhân lực thực hiện bảo trì**" là công việc RIÊNG (không trùng vận hành) — dòng 229 | 229 | KHÔNG (2 báo cáo cũ trộn "vận hành" và "bảo trì" thành 1 nhóm nhân sự) | HSMT tách 2 nhóm trách nhiệm: quản trị-vận hành (Phụ lục 11) và bảo trì (Phụ lục 12) — có thể là 2 đội khác nhau về mặt tổ chức, ảnh hưởng cách tính chi phí nhân sự trong hồ sơ giá |

### 1.9. Yêu cầu SỞ HỮU dữ liệu — chi tiết hơn 1 điểm: "phải được chuyển giao khi có yêu cầu, KHÔNG CHỈ khi kết thúc hợp đồng"

Dòng 626: *"đơn vị cung cấp dịch vụ có trách nhiệm và nghĩa vụ cung cấp cho chủ trì thuê dịch vụ **KHI CÓ YÊU CẦU**, và phải được chuyển giao toàn bộ... **sau khi kết thúc thời gian thuê dịch vụ**"* — 2 báo cáo cũ chỉ nhắc "khi kết thúc hợp đồng" (BA dòng 47, TechLeader #40), bỏ sót vế đầu: Sở có quyền **yêu cầu xuất dữ liệu bất kỳ lúc nào trong 60 tháng**, không chỉ khi chấm dứt hợp đồng — đây là yêu cầu vận hành liên tục (self-service export tool cho Sở), không phải chỉ 1 lần cuối kỳ.

---

## PHẦN 2. MÔ HÌNH DỮ LIỆU & MULTI-TENANT

### 2.1. Cấu trúc `Unit` hiện tại — KHÔNG đủ phân cấp cho quy mô "toàn TP Hải Phòng, các xã/phường/đặc khu"

`src/domain/types.ts` dòng 11-16:
```ts
export interface Unit {
  id: string;
  name: string;
  short: string;
  order: number;
}
```
Đây là cấu trúc **PHẲNG (flat)** — không có `parentId`, không có `type` (xã/phường/đặc khu/sở/phòng), không có mã địa giới hành chính. `src/data/seed.ts` (dòng 23-33) mô phỏng **9 đơn vị cấp Sở của 1 UBND TỈNH** ("Văn phòng UBND tỉnh", "Sở KH&ĐT", "Sở Tài chính"...) — đây là **mô hình sai bối cảnh hoàn toàn** so với đối tượng sử dụng thực tế của gói thầu: "các xã, phường, đặc khu trên địa bàn TP Hải Phòng" (dòng 22 HSMT). Hải Phòng sau sáp nhập có hàng chục đơn vị hành chính cấp xã/phường/đặc khu (không phải 9 Sở).

**Đánh giá:** Cấu trúc `Unit` phẳng (id/name/short/order) về mặt kỹ thuật CÓ THỂ tái sử dụng 1:1 cho xã/phường/đặc khu (chỉ cần đổi seed data, không cần đổi schema) NẾU mỗi xã/phường là 1 unit độc lập, KHÔNG có quan hệ cấp trên-cấp dưới cần thể hiện (giống các Sở hiện tại — đều là "lá" ngang hàng). Nhưng HSMT dùng cụm "**đơn vị sử dụng dịch vụ**" số nhiều gồm 3 LOẠI hành chính khác nhau (xã / phường / đặc khu) — nếu cần phân biệt loại đơn vị để báo cáo thống kê riêng theo loại (vd "so sánh tỷ lệ họp không giấy giữa các phường vs các xã"), cấu trúc hiện tại **THIẾU trường `type`/`kind`** để phân loại.

**Việc cần làm (code, ước lượng S):**
- Thêm field OPTIONAL `Unit.adminType?: 'commune' | 'ward' | 'specialZone'` (xã/phường/đặc khu) vào `types.ts`, cập nhật `guard.js` SCHEMA `units`, `UnitsAdminPage.tsx` để chọn loại khi tạo đơn vị. Không phá tương thích ngược (optional).
- Viết lại seed.ts (hoặc tạo file seed riêng `seed-haiphong.ts`) mô phỏng 15-20 xã/phường mẫu thay cho 9 Sở, để demo đúng bối cảnh khi trình bày với tổ chấm — hiện demo cho tổ chấm xem sẽ cho thấy "UBND tỉnh + các Sở" hoàn toàn lệch ngữ cảnh gói thầu, đây là RỦI RO TRUYỀN THÔNG khi thuyết trình/demo, không phải rủi ro kỹ thuật.

### 2.2. Cô lập dữ liệu theo đơn vị — KHÔNG có ở tầng API nội bộ; CHỈ có ở Open API bên thứ 3

Đây là **phát hiện quan trọng nhất của toàn bộ phân tích multi-tenant**. Có 2 tầng API hoàn toàn khác cơ chế lọc:

**(a) Open API `/api/open/v1/*` (dùng cho LGSP/bên thứ 3, mục 54-59 HSMT)** — CÓ filter theo unit đúng nghĩa: `server/src/open.js` dòng 96-100 hàm `meetingInvolvesUnit(m, unitId, unitOfUser)` chỉ trả về cuộc họp có chủ trì/thư ký/thành phần thuộc đúng `unitId` được truyền vào path `/units/:unitId/meetings/upcoming`. Đây implement ĐÚNG khái niệm multi-tenant theo đơn vị.

**(b) API nội bộ `/api/:collection` (dùng cho user đăng nhập qua UI, tức TOÀN BỘ ~500 user thực tế các xã/phường)** — filter quyền đọc CHỈ dựa vào **"có phải thành phần phiên họp" (`myMeetingIds`, `access.js` dòng 28-39)**, KHÔNG có bất kỳ điều kiện `unitId` nào:

```js
// access.js dòng 27-39
export async function buildAccessCtx(user) {
  const [mres, dres] = await Promise.all([
    query('SELECT data FROM c_meetings'),
    query('SELECT data FROM c_documents'),
  ]);
  const meetings = mres.rows.map((r) => r.data);
  const myMeetingIds = new Set(
    meetings.filter((m) => (m.participants ?? []).some((p) => p.userId === user.sub)).map((m) => m.id),
  );
  ...
}
```

Hàm này nạp **TOÀN BỘ** `c_meetings` và `c_documents` (không giới hạn theo unit) rồi lọc theo participant. `projectMeeting()` (access.js dòng 101-104) cho phép **người NGOÀI phiên vẫn thấy lịch (tiêu đề, thời gian, phòng, chương trình)**, chỉ ẩn `minutes`/`conclusions`. Điều này có nghĩa:

> **Một cán bộ xã Đông Phú đăng nhập vào hệ thống SẼ THẤY được tiêu đề, thời gian, phòng họp, và chương trình nghị sự của MỌI phiên họp ở TẤT CẢ xã/phường/đặc khu khác trên toàn TP Hải Phòng** (chỉ không thấy nội dung biên bản/kết luận nếu không phải thành phần). Vote/poll (`projectVote`) và documents cũng tương tự — logic dựa hoàn toàn vào "đại biểu của phiên nào" chứ không vào "thuộc đơn vị nào".

**Đây là gap nghiêm trọng nhất trong toàn bộ phân tích hệ thống**, vì:
1. Mâu thuẫn trực tiếp với mô hình "mô hình cơ sở dữ liệu tập trung" + đặc tính cô lập ngầm định khi ≥500 user từ hàng chục đơn vị hành chính KHÁC NHAU, KHÔNG cùng một cơ quan (khác hẳn bối cảnh "1 UBND tỉnh + các Sở trực thuộc" mà code/seed hiện mô phỏng, nơi việc thấy lịch họp nhau trong nội bộ 1 UBND là hợp lý).
2. HSMT không yêu cầu "cô lập tuyệt đối" bằng văn bản rõ ràng (không có câu nào ghi "xã A không được thấy dữ liệu xã B") — nhưng đây là **ngầm định hợp lý bắt buộc về nghiệp vụ**: xã Đông Phú và xã Tây Sơn là 2 đơn vị hành chính độc lập, không có quan hệ báo cáo qua lại như Sở-UBND tỉnh; để 1 xã thấy được (dù chỉ metadata) lịch họp nội bộ của xã khác là rủi ro bảo mật/quan hệ hành chính, đặc biệt khi phiên họp có thể liên quan nhân sự/đất đai/khiếu kiện nhạy cảm cấp cơ sở.
3. Đây cũng là rủi ro cho tiêu chí ATTT cấp độ 3 (mục 3.1 HSMT dòng 68 "*Yêu cầu về cách thức hệ thống ngăn chặn các truy cập trái phép hoặc sửa đổi dữ liệu dù vô tình hay cố ý*") — pentest độc lập gần như chắc chắn sẽ gắn cờ (flag) hành vi "user A thấy được danh sách/tiêu đề cuộc họp của đơn vị B mà mình không thuộc về" là information disclosure, dù mức độ nhẹ.

**Việc cần làm (code, ước lượng M):**
- Thêm bước lọc `unitId` vào `buildAccessCtx`/`applyFilter` (access.js): trước khi filter theo participant, filter thêm theo "cuộc họp do đơn vị mình chủ trì HOẶC mình là thành phần" — tái sử dụng logic `meetingInvolvesUnit` đã có sẵn trong `open.js` (dòng 96-100), chỉ cần import/tái dùng cho `access.js`.
- Cân nhắc: `admin` (Quản trị hệ thống, dòng 383 HSMT "toàn quyền quản lý hệ thống, toàn bộ người dùng, dữ liệu toàn hệ thống") vẫn xem tất cả — đúng vai trò. Nhưng `unit_admin`, `delegate`, `chairman`, `secretary` PHẢI giới hạn theo đơn vị mình trừ khi thuộc phiên liên đơn vị (vd Sở KH&CN mời đại diện nhiều xã họp chung — trường hợp này participant đã có mặt trong `participants[]` nên vẫn thấy đúng theo cơ chế cũ, KHÔNG BỊ MẤT chức năng liên đơn vị).
- File cần sửa: `server/src/access.js` (thêm hàm `meetingInvolvesUnit`-style filter), `server-dotnet/ECabinet.Api/Access.cs` (đồng bộ .NET).

### 2.3. `unit_admin` — đủ quyền quản lý NGƯỜI DÙNG trong đơn vị, nhưng THIẾU quyền tạo phiên họp mà chính quy trình nghiệp vụ HSMT yêu cầu

Đã xác nhận qua code (`server/src/index.js` dòng 76-119 hàm `enforceUserWrite`, `server/src/acl.js` dòng 24): `unit_admin` có kiểm tra sâu ĐẦY ĐỦ và ĐÚNG cho collection `users` — không đổi được `unitId` của người khác/mình, không cấp role admin, không sửa tài khoản admin. Đây là phần được làm TỐT.

Nhưng **HSMT quy trình "Chuẩn bị cuộc họp" (dòng 354-358)** ghi rõ:
> *"Chủ trì cuộc họp/Thư ký cuộc họp có thể yêu cầu **Quản trị đơn vị thực hiện tạo mới cuộc họp trên hệ thống**; hoặc thư ký cuộc họp tự thêm mới... **Quản trị đơn vị nhập thông tin cuộc họp trên hệ thống**, thông báo cho Thành viên dự họp... **Quản trị đơn vị chuẩn bị tài liệu họp và trình duyệt**."*

Nghĩa là "Quản trị đơn vị" (`unit_admin`) là MỘT TRONG CÁC ACTOR CHÍNH thực hiện tạo phiên họp + chuẩn bị/trình tài liệu — không chỉ quản lý user. Nhưng:

```js
// acl.js dòng 27
meetings:      { create: MANAGE, update: 'any', remove: MANAGE },
// MANAGE = ['admin', 'secretary', 'chairman']  — KHÔNG có 'unit_admin'
```

Xác nhận đồng bộ ở `server-dotnet/ECabinet.Api/Acl.cs` dòng 33: `["meetings"] = new(M, "any", M)` cùng gap. Nếu một `unit_admin` cố gọi `POST /api/meetings` sẽ nhận **403 Forbidden** — đúng luồng nghiệp vụ HSMT mô tả sẽ THẤT BẠI ở bước đầu tiên.

**Việc cần làm (code, ước lượng S):**
- Sửa `server/src/acl.js` dòng 27: `meetings: { create: [...MANAGE, 'unit_admin'], update: 'any', remove: MANAGE }` — cân nhắc thêm ràng buộc "chỉ tạo phiên họp mà chairId/secretaryId thuộc đơn vị mình" (kiểm tra sâu tương tự `enforceUserWrite`) để tránh unit_admin tạo phiên họp gán chủ trì là người đơn vị khác.
- Đồng bộ `server-dotnet/ECabinet.Api/Acl.cs` dòng 33.
- Cân nhắc thêm: quyền `documents: create/update` hiện là `'any'`/`'ownerOrManage'` — `unit_admin` với vai trò "chuẩn bị tài liệu họp và trình duyệt" (dòng 356-358) đã hoạt động được qua `'any'` (create) nhưng luồng "trình duyệt" (`reviewStatus: pending`) trong `guardDocuments` (guard.js dòng 222-256) hiện định nghĩa "quản lý" (được duyệt) = `MANAGE` — cũng KHÔNG có `unit_admin`. Theo đúng quy trình HSMT, "Quản trị đơn vị chuẩn bị tài liệu và trình duyệt", còn "**Thành viên dự họp thực hiện duyệt**" — nghĩa là người DUYỆT là `delegate` (thành viên dự họp), không phải `unit_admin`. Vậy `guardDocuments` hiện tại (chỉ MANAGE duyệt) CŨNG lệch quy trình — cần thêm khả năng chairman/delegate cụ thể của phiên đó duyệt tài liệu do unit_admin trình, không giới hạn cứng vào MANAGE.

### 2.4. Khối lượng dữ liệu 60 tháng — giới hạn thiết kế cụ thể

Đã xác nhận qua code: `server/src/util.js` dòng 28-29 giới hạn request body **25MB** (không phải 15MB như bối cảnh nêu — 25MB là số THẬT trong code, "đủ cho tài liệu base64"). Mô hình lưu trữ `server/src/db.js` dòng 14-31 + dòng 101-105: mỗi collection là 1 bảng `(id TEXT PK, data JSONB, updated_at TIMESTAMPTZ)` — bao gồm `c_documents` lưu cả `dataUrl` (base64 toàn bộ file) TRONG CÙNG CỘT JSONB với metadata.

**Giới hạn thiết kế cụ thể cho quy mô 60 tháng / ≥500 user / toàn TP:**

1. **Không tách blob ra khỏi metadata**: file đính kèm (base64) và metadata tài liệu nằm CHUNG 1 JSONB row. Với ≥500 user × nhiều xã/phường × 60 tháng, số tài liệu tích lũy có thể lên hàng chục nghìn, mỗi row có thể tới ~20MB (base64 của file 15MB gốc) → bảng `c_documents` có thể phình tới hàng trăm GB. PostgreSQL TOAST xử lý được về mặt lưu trữ, nhưng **mọi `SELECT data FROM c_documents` không lọc điều kiện (như trong `access.js` dòng 31, `open.js` dòng 349) sẽ kéo TOÀN BỘ bảng bao gồm blob vào RAM ứng dụng** — đây là bottleneck hiệu năng thực sự, không phải lý thuyết, khi dữ liệu tăng theo thời gian. Đúng như Tech Leader đã cảnh báo (#3 báo cáo cũ: "Chưa có module thống kê/báo cáo quy mô toàn thành phố... kiến trúc hiện là 1 instance duy nhất") nhưng nay có thể LƯỢNG HÓA rõ hơn: nguyên nhân gốc là SELECT không phân trang + blob chung cột.
2. **Không có index full-text/GIN trên nội dung tài liệu**: `db.js` dòng 118-119 chỉ có 2 index: `idx_meetings_status` và `idx_notif_user` (cả 2 dạng B-tree trên trường JSONB đơn giản). KHÔNG có GIN index cho tra cứu "theo nhiều điều kiện" (yêu cầu <30s, dòng 62/532 HSMT) trên `documents`/`meetings` — với khối lượng lớn tích lũy 60 tháng, các query filter theo nhiều điều kiện (tiêu đề + thời gian + đơn vị + trạng thái) sẽ full-scan JSONB, không đạt SLA khi dữ liệu lớn.
3. **Không có cơ chế archive/partition theo thời gian**: bảng `c_meetings`/`c_audit`/`c_notifications` sẽ tăng tuyến tính theo 60 tháng không có chiến lược archive dữ liệu cũ (vd audit log của tháng thứ 1 vẫn nằm chung bảng với audit log tháng 60) — ảnh hưởng cả hiệu năng và yêu cầu "Nhật ký đăng nhập hệ thống... Xóa nhật ký" (mục 3, dòng 395 HSMT) hiện chỉ có xóa từng bản ghi qua ACL admin (`acl.js` dòng 41), không có xóa theo lô/theo khoảng thời gian.
4. **`mutateDoc` (CAS retry, db.js dòng 51-73) đọc TOÀN BỘ row (bao gồm blob nếu là documents) mỗi lần retry** — với votes/meetings (không chứa blob lớn) không sao, nhưng nếu áp dụng pattern này cho `documents` (hiện tại actions.js không dùng CAS cho documents, chỉ dùng cho votes/meetings) thì sẽ rất nặng.

**Đề xuất kỹ thuật (không sửa code đêm nay, ghi vào kế hoạch dài hạn/hồ sơ kỹ thuật):**
- Tách file blob khỏi metadata: lưu file vào object storage (MinIO/S3-compatible hoặc filesystem có index riêng — đúng với cụm "File-Server" Linux mà HSMT đã đề xuất, dòng 322), documents JSONB chỉ giữ metadata + `fileUrl` con trỏ.
- Thêm GIN index cho JSONB search: `CREATE INDEX ... USING gin (data jsonb_path_ops)` hoặc trường tách riêng (`title`, `start_time` dạng cột thường) cho các bảng tần suất tra cứu cao.
- Chiến lược archive: partition theo tháng/năm cho `c_audit`, `c_notifications`, `c_meetings` (đã kết thúc) — hoặc job định kỳ chuyển dữ liệu >N tháng sang bảng lưu trữ riêng (đáp ứng "quản trị hoạt động... xóa nhật ký" nhưng vẫn giữ được để đối soát khi cần).

---

## PHẦN 3. ĐỐI CHIẾU QUY TRÌNH NGHIỆP VỤ HSMT vs LUỒNG THẬT TRONG CODE

### 3.1. Quy trình chuẩn bị cuộc họp (HSMT dòng 352-358)

| Bước HSMT | Actor HSMT | Bước thực tế trong eCabinet | Component/service | Khớp/Lệch/Thiếu |
|---|---|---|---|---|
| Chủ trì/Thư ký YÊU CẦU Quản trị đơn vị tạo mới cuộc họp | Chủ trì/Thư ký → Quản trị đơn vị | Không có cơ chế "yêu cầu" (request/ticket) giữa Chủ trì và Quản trị đơn vị — chỉ có tạo trực tiếp | (không có) | **THIẾU** — không có domain entity "yêu cầu tạo họp" hay notification loại này |
| HOẶC Thư ký tự thêm mới thông tin cuộc họp | Thư ký (secretary) | `MeetingFormModal.tsx` tạo phiên họp qua `POST /api/meetings` | `MeetingsPage.tsx`, `MeetingFormModal.tsx`, ACL `meetings.create = MANAGE` (có secretary) | **KHỚP** |
| Theo dõi tiến trình chuẩn bị cuộc họp (của Quản trị đơn vị) | Chủ trì/Thư ký theo dõi | Không có "trạng thái chuẩn bị" tách biệt — chỉ có `MeetingStatus` (draft/invited/live/finished/cancelled), không có sub-status "đang chuẩn bị tài liệu X%" | `types.ts` `MeetingStatus` | **MỘT PHẦN** — trạng thái tổng thể có, nhưng không có tracking chi tiết tiến trình chuẩn bị (vd bao nhiêu tài liệu đã trình/đã duyệt trên tổng số) |
| **Quản trị đơn vị nhập thông tin cuộc họp** | Quản trị đơn vị (unit_admin) | ACL `meetings.create = MANAGE` — **KHÔNG bao gồm `unit_admin`** → sẽ nhận 403 nếu thử | `acl.js` dòng 27 | **LỆCH (đã phân tích chi tiết ở mục 2.3)** |
| Thông báo cho Thành viên dự họp tham gia và chuẩn bị tài liệu | Quản trị đơn vị → Thành viên dự họp | `POST /api/actions/meetings/:id/invite` gửi notification tới participants | `actions.js` dòng 146-163 (hàm invite) | **KHỚP** (nhưng CHỈ `MANAGE` gọi được invite — cùng gap `unit_admin` như trên, `actions.js` dòng 149 `if (!MANAGE.includes(req.user.role))`) |
| **Quản trị đơn vị chuẩn bị tài liệu họp và trình duyệt** | Quản trị đơn vị | Domain có `DocFile.reviewStatus` đầy đủ (draft/pending/approved/rejected) — đúng luồng "trình duyệt". `guardDocuments` (guard.js dòng 222-256) cho phép **owner** chuyển draft/rejected → pending | `types.ts` DocFile, `guard.js` guardDocuments | **MỘT PHẦN KHỚP** — cơ chế trình/duyệt CÓ đầy đủ, nhưng "owner" ở đây là `ownerId` bất kỳ ai tạo tài liệu (không ràng buộc phải là unit_admin cụ thể) — về mặt kỹ thuật hoạt động được nếu unit_admin là người tạo tài liệu, KHÔNG BỊ CHẶN ở bước NÀY (chỉ chặn ở bước tạo MEETING trước đó) |
| **Thành viên dự họp thực hiện duyệt** (nếu đủ → cập nhật; nếu thiếu → yêu cầu làm lại) | Thành viên dự họp (delegate) | `guardDocuments` dòng 232: `allowedManage = isManage && cur === 'pending' && ...` — chỉ `MANAGE` (admin/secretary/chairman) duyệt được, **KHÔNG cho `delegate` (Thành viên dự họp) duyệt** | `guard.js` dòng 222-256, `acl.js` MANAGE const | **LỆCH** — HSMT ghi rõ actor duyệt là "Thành viên dự họp", nhưng code giới hạn duyệt cho nhóm quản lý (MANAGE), loại trừ cả `delegate` và `unit_admin` |

**Tổng đánh giá quy trình 1:** 2/6 bước LỆCH rõ ràng (ai được tạo họp, ai được duyệt tài liệu), 1 bước THIẾU (cơ chế yêu cầu/tracking tiến trình chuẩn bị), còn lại KHỚP. Nguyên nhân gốc: constant `MANAGE = ['admin','secretary','chairman']` được dùng làm "nhóm có quyền" cho NHIỀU nghiệp vụ khác nhau (tạo họp, gửi mời, duyệt tài liệu, điều hành chất vấn...) nhưng quy trình HSMT thực tế phân vai actor KHÁC NHAU cho từng bước (Quản trị đơn vị tạo/chuẩn bị, Thành viên dự họp duyệt) — code đã đơn giản hóa quá mức thành 1 nhóm quyền chung.

### 3.2. Quy trình điều hành phiên họp (HSMT dòng 360-365)

| Bước HSMT | Bước thực tế trong eCabinet | Component/service | Khớp/Lệch/Thiếu |
|---|---|---|---|
| Chủ trì/Thư ký yêu cầu điểm danh → Thành viên điểm danh → hệ thống cập nhật CSDL | `POST /api/actions/meetings/:id/checkin` — tự điểm danh HOẶC chủ trì/thư ký điểm danh hộ (`chairCtl`), dùng CAS `mutateDoc` chống mất điểm danh đồng thời | `actions.js` dòng 119-143 | **KHỚP đầy đủ**, còn có thêm bảo vệ concurrency (vượt yêu cầu) |
| Thành viên đăng ký phát biểu (khi có nhu cầu) → Chủ trì/Thư ký cho phép → Thành viên phát biểu → CSDL cập nhật | `SpeakRequest` entity (waiting/speaking/done/rejected), ACL `speakRequests.create: 'self:userId'`, điều hành qua `meetings.questionSession`-style pattern (thực tế `agenda`/`currentAgendaItemId`) | `types.ts` SpeakRequest, `acl.js` dòng 31 | **KHỚP** |
| Chủ trì/Thư ký yêu cầu biểu quyết → Thành viên biểu quyết → CSDL cập nhật | `POST /api/actions/vote/:id/open` (mở) → `POST /api/actions/vote/:id/ballot` (bỏ phiếu, CAS chống mất phiếu) → `POST /api/actions/vote/:id/close` (đóng) | `actions.js` dòng 58-114 | **KHỚP đầy đủ**, có bảo vệ atomic (vượt yêu cầu) |
| Chủ trì/Thư ký tổng hợp/cập nhật kết luận phiên họp | `Conclusion[]` trong `Meeting`, có thể đính kèm file (mục 51 HSMT); còn có tự sinh dự thảo biên bản/thông báo theo NĐ 30/2020 (vượt yêu cầu, theo ghi chú comment trong code + báo cáo BA cũ đã xác nhận) | `types.ts` Conclusion/Minutes, `actions.js` sign | **KHỚP + VƯỢT YÊU CẦU** |

**Tổng đánh giá quy trình 2:** KHỚP HOÀN TOÀN, không phát hiện lệch. Đây là quy trình được xây kỹ nhất trong toàn hệ thống (có bảo vệ concurrency CAS cho cả điểm danh và biểu quyết — 2 điểm dễ mất dữ liệu nhất khi nhiều người tương tác đồng thời trong 1 phiên họp).

**Ghi chú bổ sung không có trong quy trình chính thức nhưng đã implement (vượt yêu cầu HSMT bảng chức năng 34-46):** nghiệp vụ "Chất vấn" (`QuestionRequest`, `questionSession` trên Meeting) — mô phỏng đúng chức năng 34/45/46/80/89/90 mục 3.4 HSMT dù KHÔNG xuất hiện trong đoạn tả quy trình tường minh (dòng 360-365 chỉ mô tả điểm danh/phát biểu/biểu quyết/kết luận, không mô tả chất vấn như 1 bước quy trình riêng) — có thể suy luận chất vấn là biến thể của "phát biểu" được điều hành tương tự, code đã xử lý đúng hướng này.

### 3.3. Quy trình lấy ý kiến bằng văn bản (HSMT dòng 367-374, có bảng 4 bước rõ ràng)

| Bước HSMT | Đơn vị thực hiện (HSMT) | Bước thực tế trong eCabinet | Component/service | Khớp/Lệch/Thiếu |
|---|---|---|---|---|
| 1. Thêm mới văn bản cần xin ý kiến (trường hợp KHÔNG tổ chức cuộc họp) | Thư ký cuộc họp | `Vote { kind: 'poll', meetingId: null }` — tạo qua `POST /api/votes`, ACL `votes.create = MANAGE` (có secretary) | `voteService.ts`, `PollsPage.tsx`, `acl.js` dòng 30 | **KHỚP** — domain đã tách rõ `kind: 'poll'` (ngoài họp) vs `'vote'` (trong họp) đúng ý "trường hợp không tổ chức cuộc họp" |
| 2. Cập nhật thông tin liên quan: **cán bộ theo dõi**; **thời hạn xin ý kiến**; file đính kèm | Thư ký cuộc họp | `Vote.deadline` (hạn) ✅, `Vote.documentIds` (file đính kèm) ✅ — nhưng **"cán bộ theo dõi" (tracking officer) KHÔNG có field riêng** trong `Vote` interface | `types.ts` Vote (dòng 283-308) | **THIẾU 1 TRƯỜNG** — không có `trackerUserId`/`ownerContactId` để ghi nhận "cán bộ theo dõi" khác với `createdBy` (người tạo phiếu, có thể khác người được giao theo dõi tiến độ phản hồi) |
| 3. Chủ trì/Thành viên xem xét văn bản, cho ý kiến đồng ý/không đồng ý; **có thể ký số ý kiến đã tham gia và gửi Thư ký tổng hợp** | Chủ trì cuộc họp/Thành viên dự họp | `Ballot { userId, optionId, comment, castAt }` qua `POST /api/actions/vote/:id/ballot` — có ghi ý kiến (`comment`) nhưng **KHÔNG có bước ký số cho ballot cá nhân** (chỉ có ký số ở cấp BIÊN BẢN phiên họp qua `actions.js` `/meetings/:id/sign`, không có ký số gắn với TỪNG ballot của poll lấy ý kiến văn bản) | `types.ts` Ballot, `actions.js` (thiếu action ký ballot) | **LỆCH/THIẾU** — mục 30 (bảng chức năng 3.4, dòng 432) đã ghi "Ký số file cho ý kiến vào văn bản" như 1 hành động riêng của người cho ý kiến, khớp với mô tả quy trình dòng 373 ("có thể ký số đối với ý kiến đã tham gia") — nhưng code HIỆN CHƯA có action ký số áp cho `Ballot`, chỉ có ký biên bản họp. Đây LÀ gap đã được cả 2 báo cáo cũ nêu ở mức "ký số mô phỏng" (G3/#4 rủi ro) nhưng CHƯA chỉ rõ: ký số của "ý kiến văn bản" (poll) và ký số "biên bản họp" (meeting) là **2 nghiệp vụ tách biệt trong HSMT**, code hiện MỚI CÓ 1 trong 2 (biên bản họp), CHƯA CÓ ký ballot |
| 4. Thư ký tổng hợp, thống kê ý kiến của thành viên | Thư ký cuộc họp | Mục 47/48 HSMT (Tổng hợp/Thống kê ý kiến văn bản) — có UI tổng hợp trong `PollsPage.tsx`/`voteService.ts` (đã xác nhận qua báo cáo BA cũ "✅ Tổng hợp tự động", tôi xác nhận lại `voteService.ts` có hàm tổng hợp outcome `summarizeOutcome`-style logic cũng xuất hiện ở `open.js` dòng 255-267 cho Open API) | `voteService.ts`, `PollsPage.tsx` | **KHỚP** |

**Tổng đánh giá quy trình 3:** 1/4 bước LỆCH RÕ (ký số ballot chưa có — khác ký biên bản đã có), 1/4 bước THIẾU 1 TRƯỜNG (cán bộ theo dõi), 2/4 KHỚP. Đây là quy trình có gap CỤ THỂ NHẤT có thể vá bằng code trong thời gian ngắn (thêm field + thêm 1 action ký, tái sử dụng pattern `sign` đã có ở `actions.js`).

---

## PHẦN 4. KẾT LUẬN

### 4.1. TOP RỦI RO HỆ THỐNG (xếp hạng theo mức độ nghiêm trọng)

| # | Rủi ro | Mức độ | Vì sao xếp hạng này |
|---|---|---|---|
| **R1** | **Không cô lập dữ liệu theo đơn vị ở API nội bộ** (`access.js` chỉ lọc theo participant, không theo `unitId`) — mọi user thấy được tiêu đề/lịch/chương trình họp của MỌI đơn vị khác trên toàn TP | **CAO NHẤT** | Ảnh hưởng ĐÚNG bản chất đối tượng sử dụng của gói thầu (≥500 user từ HÀNG CHỤC đơn vị hành chính độc lập, không phải nội bộ 1 cơ quan) — vi phạm nguyên tắc bảo mật cơ bản nhất của multi-tenant, RẤT DỄ bị pentest độc lập (bắt buộc trước nghiệm thu ATTT cấp độ 3) phát hiện và gắn cờ nghiêm trọng |
| **R2** | **Nền tảng công nghệ Node.js/PostgreSQL không khớp yêu cầu văn bản .NET/MSSQL/Windows Server** (đã nêu đúng ở 2 báo cáo cũ, XÁC NHẬN LẠI vẫn đúng trong bản HSMT mới — dòng 331-334, 544) | **CAO** (giữ nguyên đánh giá của 2 báo cáo cũ) | Rủi ro loại thầu ở bước đánh giá kỹ thuật, không phải vấn đề code có thể vá qua đêm |
| **R3** | **Seed data/demo mô phỏng SAI bối cảnh** (UBND tỉnh + 9 Sở, không phải xã/phường/đặc khu) | **TRUNG BÌNH-CAO** | Không phải lỗi kỹ thuật (schema Unit vẫn dùng được) nhưng RỦI RO TRUYỀN THÔNG khi demo/vận hành thử trước tổ chấm — có thể gây cảm giác "sản phẩm không hiểu đúng bài toán xã/phường" dù năng lực kỹ thuật thực tế đủ dùng |
| **R4** | **Quyền tạo phiên họp/duyệt tài liệu lệch actor HSMT quy định** (`unit_admin` không tạo được meeting; chỉ MANAGE duyệt tài liệu, không phải "Thành viên dự họp" như HSMT ghi) | **TRUNG BÌNH** | Ảnh hưởng trực tiếp luồng vận hành thật khi Sở KH&CN thao tác theo đúng quy trình mô tả trong HSMT — sẽ gặp lỗi 403 ngay ở vận hành thử nếu không sửa trước |
| **R5** | **Chưa có ký số cho từng ballot lấy ý kiến văn bản** (chỉ có ký biên bản họp) | **TRUNG BÌNH** | Gap chức năng cụ thể (mục 30 bảng 3.4), tách biệt với gap "ký số PKI thật" tổng thể mà 2 báo cáo cũ đã nêu (G3) — đây là lớp gap CHỨC NĂNG (thiếu action), nằm dưới lớp gap CÔNG NGHỆ (ký số mô phỏng chưa CA thật) |
| **R6** | **Không có filter GIN/index cho tra cứu đa điều kiện + không tách blob khỏi metadata** trong `c_documents` | **TRUNG BÌNH** (dài hạn) | Chưa phát sinh vấn đề ở quy mô demo hiện tại, nhưng theo đúng phân tích khối lượng 60 tháng/toàn TP sẽ là bottleneck hiệu năng thật, ảnh hưởng SLA "<30s tra cứu" khi dữ liệu lớn dần |
| **R7** | ATTT cấp độ 3 / mã hóa cơ yếu / pentest / LGSP thật — GIỮ NGUYÊN như 2 báo cáo cũ đã đánh giá đúng | **CAO nhưng đã được ghi nhận đầy đủ** | Không có thông tin mới trong HSMT bản đầy đủ làm thay đổi đánh giá này — chỉ xác nhận lại |

### 4.2. TOP VIỆC ĐỀ XUẤT CHO DEV ĐÊM NAY

**Nhóm A — LÀM ĐƯỢC NGAY BẰNG CODE (ước lượng S=vài giờ, M=1 ngày, L=nhiều ngày):**

| # | Việc | File cần sửa | Ước lượng | Vì sao ưu tiên |
|---|---|---|---|---|
| 1 | **Cô lập dữ liệu theo đơn vị ở API nội bộ** — thêm điều kiện `unitId` vào `buildAccessCtx`/`applyFilter` trong `access.js`, tái sử dụng logic `meetingInvolvesUnit` đã có sẵn ở `open.js` (dòng 96-100); đồng bộ `server-dotnet/ECabinet.Api/Access.cs` | `server/src/access.js`, `server-dotnet/ECabinet.Api/Access.cs` | **M** (nửa ngày–1 ngày, cần test kỹ để không phá luồng liên đơn vị hợp lệ) | R1 — rủi ro cao nhất, ảnh hưởng bản chất bảo mật multi-tenant |
| 2 | **Cho `unit_admin` tạo phiên họp** theo đúng quy trình HSMT — sửa `acl.js` dòng 27 (`meetings.create` thêm `'unit_admin'`), thêm kiểm tra sâu (chairId/secretaryId thuộc đơn vị mình) tương tự `enforceUserWrite`; đồng bộ `Acl.cs` | `server/src/acl.js`, `server/src/index.js` (thêm hàm kiểm sâu), `server-dotnet/ECabinet.Api/Acl.cs` | **S-M** | R4 — luồng nghiệp vụ chính HSMT mô tả sẽ lỗi 403 nếu không sửa |
| 3 | **Cho `unit_admin` gửi giấy mời họp** (action invite hiện chỉ MANAGE) — mở rộng check trong `actions.js` dòng 149 | `server/src/actions.js` | **S** | Đi kèm việc #2, cùng luồng "Quản trị đơn vị nhập thông tin và thông báo" |
| 4 | **Cho "Thành viên dự họp" (delegate) duyệt tài liệu** đúng vai HSMT quy định (dòng 356-358: "Thành viên dự họp thực hiện duyệt"), hiện `guardDocuments` chỉ cho MANAGE — sửa điều kiện `allowedManage` trong `guard.js` để cho phép thành phần cụ thể của phiên họp (không mở toàn bộ `delegate` toàn hệ thống, chỉ người thuộc đúng phiên) | `server/src/guard.js` (hàm `guardDocuments`, dòng 222-256) | **M** (cần truy meeting để biết ai là thành viên phiên đó — hiện `guardPatch` không có context meeting) | R4 |
| 5 | **Thêm field `trackerUserId` (cán bộ theo dõi) vào `Vote`** cho quy trình lấy ý kiến văn bản (HSMT dòng 372 "Cán bộ theo dõi") | `src/domain/types.ts` (Vote interface), `server/src/guard.js` (SCHEMA.votes) | **S** | Gap cụ thể, dễ vá, không phá tương thích (optional field) |
| 6 | **Thêm action ký số cho từng Ballot** (poll lấy ý kiến văn bản) — tái sử dụng pattern `/actions/meetings/:id/sign` đã có, viết `/actions/vote/:id/ballot/sign` hoặc tích hợp `SignatureInfo`-style vào `Ballot` | `src/domain/types.ts` (Ballot interface — thêm optional `signature?: SignatureInfo`), `server/src/actions.js` (thêm endpoint mới, dùng lại `mutateDoc` CAS pattern có sẵn) | **M** | R5 — mục 30 bảng chức năng 3.4 chưa đáp ứng đầy đủ |
| 7 | **Thêm field `Unit.adminType`** (xã/phường/đặc khu) — optional, không phá tương thích | `src/domain/types.ts`, `server/src/guard.js` (SCHEMA.units), `src/ui/pages/admin/UnitsAdminPage.tsx` | **S** | Chuẩn bị hạ tầng dữ liệu đúng bối cảnh trước khi viết seed mới |
| 8 | **Viết bộ seed mới mô phỏng xã/phường/đặc khu** (thay 9 Sở của UBND tỉnh) — tạo file riêng để không phá seed demo hiện tại đang dùng cho các luồng khác, dùng khi cần trình diễn đúng ngữ cảnh gói thầu | `src/data/seed-haiphong.ts` (file mới, không sửa `seed.ts` hiện tại để tránh rủi ro phá vỡ mọi demo/test khác đang phụ thuộc) | **L** (cả ngày — cần đủ số lượng đơn vị, user, phiên họp hợp lý để demo thuyết phục) | R3 — rủi ro truyền thông khi demo với tổ chấm |
| 9 | **Thêm module "Phản hồi/Góp ý người dùng"** (in-app feedback form + lưu trữ) đáp ứng mục 5.2 HSMT (dòng 108-109) | `src/domain/types.ts` (entity `Feedback` mới), `server/src/db.js` (thêm collection), `server/src/acl.js`, UI trang mới | **L** | Mục 1.9/5.2 — tiêu chí chấm điểm riêng, hiện hoàn toàn chưa có |
| 10 | **Rà soát ngưỡng "độ trễ >10 giây → hiển thị loading indicator"** (dòng 534 HSMT) trên các action gọi API lâu (upload file lớn, xuất báo cáo) | `src/ui/pages/*.tsx` (rà từng nơi có upload/export) | **M** | Gap UX cụ thể, mới phát hiện, chưa từng được đề cập ở 2 báo cáo cũ |

**Nhóm B — CẦN BÊN NGOÀI/PHÁP NHÂN (không code được, giữ nguyên đánh giá của 2 báo cáo cũ, KHÔNG lặp lại chi tiết ở đây):**
- Làm rõ HSMT về nền tảng .NET/MSSQL (bắt buộc hay tham khảo) — quyết định go/no-go cấp quản lý.
- Hồ sơ ATTT cấp độ 3 + pentest độc lập (NĐ 85/2016, TT 12/2022) — thời gian phê duyệt ngoài kiểm soát nhà thầu.
- Kết nối LGSP/NGSP/IOC/Kho dữ liệu dùng chung/Cổng TTĐT thật — phụ thuộc đặc tả từ TP Hải Phòng.
- Ký số PKI thật (VGCA/SmartCA) thay mô phỏng — phụ thuộc nhà cung cấp CA.
- Xác nhận số Nghị định chính xác ở câu cuối HSMT (dòng 668, hiện bị cắt số) — cần xem lại file DOCX gốc.
- Xác nhận với bên mời thầu về mâu thuẫn nội tại "Windows-only" (dòng 335) vs "Windows/Linux/MacOS" (dòng 560) cho máy trạm.
- Đội vận hành 60 tháng theo 8 quy trình chi tiết mục "Quản trị vận hành" (Phần 1.4) — kế hoạch nhân sự/tổ chức, không phải code.
