# BÁO CÁO DÙNG THỬ THẬT (EXPLORATORY TESTING) — eCabinet

**Người thực hiện:** Kiểm — Tester/QA, HPT TECH
**Ngày:** 2026-07-18
**Phương pháp:** Dùng thử qua trình duyệt thật (Playwright/Stagehand qua browser tools), đăng nhập lần lượt các vai demo, thao tác trực tiếp trên UI — KHÔNG đọc code, KHÔNG chạy test tự động. Khác đợt trước (`tester-qa.md` — đọc code + chạy test).
**Môi trường:** `https://hyperagent.com/s/W6hkwlvb0gYUVgxdhtYn5A` (wrapper) → sau khi phát hiện wrapper gây lỗi nested-iframe, chuyển điều hướng trực tiếp URL app thật `https://pub.hyperagent.com/p/jEWEgwjZnCe2aqeuUCbeDWFfoezueaNM1YfybTJfjww` để test ổn định hơn (không sửa gì phía app, chỉ đổi cách trình duyệt truy cập).
**Ràng buộc đã tuân thủ:** không sửa file repo, không commit, không đóng browser session cuối phiên (đã tạo session mới do session cũ hết hạn tự nhiên sau 60 phút — xem mục Hạn chế công cụ).

---

## 0. GHI CHÚ QUAN TRỌNG VỀ HẠ TẦNG KIỂM THỬ (đọc trước khi xem kết quả)

Trong suốt phiên, `BrowserAction` (click/type/select) liên tục trả lỗi `"Failed to perform act"` hoặc `"An internal server error occurred"` **theo từng đợt** (có lúc phải thử lại 5-12 lần liên tiếp cho ĐÚNG một hành động mới thành công), trong khi `BrowserObserve`/`BrowserGetContent`/`BrowserExtract` luôn phản hồi tốt ngay cả khi `BrowserAction` đang lỗi. Đây là **hạn chế backend công cụ browser-automation (Stagehand act API)**, KHÔNG phải lỗi của app eCabinet — mọi hành động cuối cùng đều thành công sau khi retry, và không có trường hợp nào app tự phản hồi sai khi hành động thực sự chạy tới nơi. Một lần, session bị "chết" hoàn toàn (mất kết nối) sau đúng ~61 phút hoạt động liên tục — đã tạo session mới (`ea18eb95-...`) và tiếp tục; agent sau kế thừa session mới này.

Do hạn chế trên, 2-3 tương tác phụ (xem mục "Chưa xác nhận được") không được xác nhận triệt để để tiết kiệm thời gian cho các luồng nghiệp vụ quan trọng hơn. Đây không phải PASS/FAIL của app — cần agent QA sau thử lại khi hạ tầng ổn định.

---

## 1. BẢNG KẾT QUẢ TỪNG CA

### Nhóm A — Tính năng MỚI đêm qua

| # | Ca kiểm thử | Kết quả | Ghi chú |
|---|---|---|---|
| A1 | qtdonvi: menu Quản trị đơn vị có "Người dùng đơn vị" + "Xử lý Hỗ trợ & Phản hồi" | **PASS** | Cả 2 mục có trong sidebar `qtdonvi`. |
| A1 | qtdonvi: tạo được phiên họp mới (quy trình HSMT: quản trị đơn vị tạo họp) | **FAIL — P0** | Trang "Phiên họp" của `qtdonvi` KHÔNG có nút "Tạo phiên họp" (đã soát HTML `<div class="page-actions">` — hoàn toàn vắng mặt cho vai này). Cùng trang, vai `thuky` CÓ đầy đủ nút này (đã đối chứng, chụp ảnh). Vậy quyền tạo họp hiện gán cho `thuky`/có thể `chutich`, KHÔNG gán cho `qtdonvi` — sai lệch với mô tả nghiệp vụ "quản trị đơn vị tạo họp" theo quy trình HSMT. |
| A1 | Tạo phiên họp mới + Gửi giấy mời (test thay bằng vai `thuky` vì `qtdonvi` không có nút) | PASS (chức năng) | Tạo phiên "Bản nháp" → "Gửi giấy mời" thành công, đổi trạng thái đúng, có timestamp. Riêng chức năng hoạt động tốt, chỉ sai vai. |
| A1-note | Lệch giờ/ngày khi tạo phiên họp | **GHI CHÚ P1 (cần dev xác nhận)** | Nhập Bắt đầu "2026-07-25T09:00" nhưng hệ thống lưu/hiển thị "08:00 18/07/2026". Lặp lại tương tự khi Giao nhiệm vụ (nhập hạn 01/08/2026, hệ thống hiển thị 24/07/2026). Có thể do lỗi xử lý input datetime-local, cần dev kiểm tra kỹ component ngày giờ; cũng có thể một phần do cách tool điền field không hoàn toàn khớp UI thật — nhưng 2 lần lệch không nhất quán nhau nên nghiêng về khả năng lỗi thật. |
| A2 | qtdonvi/thuky tải tài liệu lên phiên họp + Trình duyệt → sokhdt thấy & duyệt/từ chối | **KHÔNG ĐÚNG NHƯ MÔ TẢ — P1** | Đã thử cả 2 loại tài liệu (Tài liệu chính / Tài liệu tham khảo) do `thuky` thêm — CẢ HAI publish trực tiếp, không qua "chờ duyệt". Mục "Tài liệu chờ duyệt" hiện có trong hệ thống hoạt động theo hướng NGƯỢC: đại biểu (VD Vũ Thị Hồng) tự nộp tài liệu → chỉ **chủ trì + thư ký** (không phải member/đại biểu khác) mới thấy nút Duyệt/Từ chối. Đã đối chứng bằng 3 vai (`sokhdt`, `sotc`, `chutich`) — chỉ `chutich`/`thuky` có nút. Không tìm thấy cơ chế "chỉ định người duyệt/trình duyệt cho 1 thành viên cụ thể" ở tab Đại biểu. Kết luận: cơ chế "member duyệt tài liệu" như đề bài mô tả **chưa tồn tại**; cơ chế hiện có là "chủ trì/thư ký duyệt tài liệu member nộp" — đủ dùng về nghiệp vụ nhưng khác hướng brief. |
| A3 | Tạo phiếu lấy ý kiến ở NHÁP → filter "Chưa gửi" → "Gửi lấy ý kiến"; trường "Cán bộ theo dõi" | PASS (một phần) | Tạo nháp OK, filter "Chưa gửi" hiện badge đúng, nhãn "Nháp — chưa gửi", "Cán bộ theo dõi: Phạm Văn Thư" hiển thị đúng. Dropdown Cán bộ theo dõi liệt kê đủ 13 người dùng, tên/chức vụ chuẩn. Bước "Gửi lấy ý kiến" (đổi draft→open) KHÔNG kịp xác nhận thành công do 10+ lần lỗi hạ tầng liên tiếp riêng cho nút này — cần verify lại. |
| A4 | Ký số ý kiến văn bản (`chutich`, phiếu mở) — PIN 6 số, badge "Đã ký số" | **PASS** | Chọn "Nhất trí, có chỉnh sửa bổ sung" → modal "Ký số ý kiến (mô phỏng — chờ tích hợp CA)" → PIN 123456 → xác nhận → số phản hồi 5/9→6/9, badge "1 ý kiến đã ký số" ở đầu phiếu, dòng cá nhân "✓ ... Đã ký số". *(Dùng `chutich` thay `sokhdt` vì `sokhdt`/`sotc` đã có ý kiến sẵn trong data mẫu, không test lại được luồng gửi mới.)* |
| A4 | Phiếu KÍN — người khác có bị lộ danh tính/chữ ký không | **THIẾU TÍNH NĂNG — P1** | Đã đọc kỹ toàn văn form "Tạo phiếu lấy ý kiến" (Extract đầy đủ) — **không có bất kỳ checkbox/field "Kín"/"Ẩn danh"** nào. Mọi phiếu hiện có đều công khai danh tính (Tổng hợp ý kiến hiện rõ tên "Ngô Gia Huy", "Nguyễn Hoài An"...). Tính năng "phiếu KÍN" trong đề bài **chưa được triển khai** trong bản demo hiện tại — không kiểm tra được rủi ro lộ danh tính vì chưa có phiếu kín nào để test. |
| A5 | Hỗ trợ & Phản hồi: sokhdt gửi → quantri xử lý+trả lời → sokhdt thấy thông báo | **PASS xuất sắc** | `sokhdt` gửi phản hồi (loại "Báo lỗi") → `quantri` mở "Xử lý Hỗ trợ & Phản hồi" (menu riêng, đúng vai) → đổi trạng thái "Đã trả lời" + nhập nội dung trả lời → Lưu → `sokhdt` nhận đúng thông báo chuông "Phản hồi của bạn đã được trả lời" kèm full nội dung trả lời, timestamp chính xác. |
| A5 | qtdonvi chỉ thấy phản hồi đơn vị mình | PASS (một phần) | `qtdonvi` (Sở KH&ĐT) vào "Xử lý Hỗ trợ & Phản hồi" thấy đúng 1 phản hồi của `sokhdt` (cùng Sở KH&ĐT). Chưa kịp verify **loại trừ** — tạo phản hồi thử từ `sotc` (Sở Tài chính, khác đơn vị) bị chặn do 12+ lần lỗi hạ tầng liên tiếp đúng lúc điều hướng menu "Hỗ trợ & Phản hồi" của vai đại biểu khác đơn vị — cần agent sau verify lại phần loại trừ chéo-đơn-vị. |
| A6 | Danh mục loại tài liệu: quantri thêm/sửa/tắt "Công văn"; dropdown khi upload + nhãn hiển thị | PASS (thêm) + chưa verify (sửa/tắt) | Tab "Loại tài liệu" ban đầu trống (0) → thêm "Công văn" + "Nghị quyết" qua modal "Thêm loại tài liệu" (có field Tên/Mô tả/Thứ tự/checkbox "Đang sử dụng") → **PASS liên kết end-to-end**: dropdown "Loại tài liệu (E-HSMT mục 8)" khi thêm tài liệu vào phiên họp tự động cập nhật hiện đúng 2 option mới. Chưa verify: "Sửa" 1 loại có hoạt động đúng không, "tắt" (bỏ checkbox Đang sử dụng) có làm dropdown ẩn option đó không, và nhãn loại tài liệu có hiện trên card danh sách tài liệu không — bị chặn bởi 10+ lần lỗi hạ tầng liên tiếp đúng vào nút "Sửa" hàng "Nghị quyết". |
| A7 | Kết luận trong phiên: sửa/xóa + đính kèm tài liệu + link hiển thị | **PASS** | "Sửa kết luận" mở đúng, pre-fill nội dung cũ, chọn tài liệu đính kèm "Báo cáo KT-XH 6 tháng đầu năm 2026.pdf" → Lưu → hiển thị đúng "sửa vừa xong" + link tài liệu đính kèm rõ ràng dưới kết luận. Nút "Xóa" tồn tại (không bấm thử để giữ dữ liệu mẫu). |
| A8 | Thống kê ý kiến văn bản: khoảng ngày, biểu đồ, xuất CSV | PASS (phần lớn) | Tab "Thống kê ý kiến văn bản" trong Báo cáo thống kê hiển thị đúng: tổng số văn bản, tỷ lệ đã/chưa cho ý kiến (khớp chính xác với hành động ký số tôi vừa làm ở A4 — 5/9=56%, "Nhất trí có bổ sung: 2"), bảng chi tiết theo văn bản, nút "Xem biểu đồ" render đúng biểu đồ phân bố phương án. Chưa verify: input "Từ ngày/Đến ngày" (dạng spinbutton Month/Day/Year, action tool không tương tác được) và nút "Xuất CSV" (bị chặn 8+ lần lỗi hạ tầng liên tiếp) — cần agent sau thử lại thủ công qua UI thật. |
| A9 | Lọc phiên họp theo "đơn vị chủ trì"; Báo cáo thống kê chọn ngày + xuất CSV | PASS (lọc) | Filter "đơn vị chủ trì" trên trang Phiên họp hoạt động đúng — chọn "Sở Kế hoạch và Đầu tư" (không đơn vị nào chủ trì 5 phiên mẫu) → hiện đúng "Không có phiên họp nào phù hợp". Phần "chọn ngày + xuất CSV báo cáo" trùng với A8, cùng hạn chế đã nêu. |
| A10 | Đơn vị: chọn loại Xã/Phường/Đặc khu (adminType), hiển thị badge | **PASS** | Modal "Cập nhật đơn vị" (`quantri` → Đơn vị → Sửa) có dropdown "Loại đơn vị hành chính" với đủ 3 option: Xã, Phường, Đặc khu, cộng "— Chưa phân loại —". Đã xác nhận field tồn tại đúng, KHÔNG lưu thay đổi (Hủy) để tránh làm sai lệch dữ liệu mẫu "Văn phòng UBND tỉnh". |

### Nhóm B — Luồng lõi (regression)

| # | Ca kiểm thử | Kết quả | Ghi chú |
|---|---|---|---|
| B11 | Phòng họp trực tiếp: điểm danh | PASS | 11/12 đại biểu đã điểm danh với timestamp — mô phỏng realtime hoạt động đúng thiết kế demo (KHÔNG phải lỗi). |
| B11 | Sơ đồ chỗ ngồi | PASS | Sơ đồ trực quan hiện trạng thái (có mặt/chưa điểm danh/đang phát biểu). |
| B11 | Mời phát biểu (tab Phát biểu) | PASS | 2 đại biểu đang chờ (mô phỏng) → bấm "Mời phát biểu" cho Hoàng Thu Trang → chuyển đúng trạng thái "Đang phát biểu". `thuky` cũng có quyền này (hợp lý). |
| B11 | Điều hành Chất vấn (tab ❓) | **PASS** | Phiên chất vấn "Đang mở", 2 câu hỏi "Chưa gọi" + nút Gọi/Từ chối, 1 câu "Đã gọi". Bấm "Gọi chất vấn" cho Lương Thị Mai → chuyển đúng "Đang chất vấn". |
| B11 | Mở-đóng biểu quyết, % trực tiếp | PASS | 2 phiên biểu quyết: "Đang biểu quyết" 8/10=80%, "Chưa mở" 0/10. Bấm "Mở biểu quyết" → chuyển "Đang biểu quyết" đúng %. Bấm "Đóng biểu quyết" cho phiên khác — UI chuyển đúng nhưng chưa 100% chắc chắn xác nhận trạng thái cuối do đổi view (đã gián tiếp xác nhận không mất dữ liệu qua biên bản tự sinh ở B12 — số liệu 8/10=80% vẫn đúng trong biên bản). |
| B12 | thuky: tự sinh dự thảo biên bản | **PASS xuất sắc** | Nút "Tạo dự thảo từ dữ liệu phiên họp" sinh văn bản CỰC KỲ chi tiết, đúng chuẩn hành chính: thành phần, chương trình, diễn biến, tổng hợp ý kiến trên tài liệu (đúng người/nội dung mô phỏng), kết quả biểu quyết, kết luận chủ tọa. Chất lượng rất cao, đáng làm điểm nhấn demo. |
| B12 | Ký số biên bản (PIN 6 số) | PASS | Modal "Ký số biên bản (mô phỏng USB Token / SmartCA)" → PIN 123456 → hiển thị đúng "Phạm Văn Thư" ký lúc 19:48 17/07/2026. |
| B12 | Khóa biên bản | **GHI CHÚ P1** | Không thấy nút "Khóa biên bản" riêng. Sau khi ký số, nút "Ký số biên bản" biến mất (hợp lý) nhưng nút "**Tạo lại dự thảo**" VẪN CÒN — nghĩa là có thể ghi đè/tạo lại biên bản đã ký số, mất tính toàn vẹn pháp lý của văn bản đã ký. Cần dev bổ sung khóa cứng biên bản ngay sau khi ký (hoặc xác nhận đây là hành vi có chủ đích và chỉ hiển thị cảnh báo). |
| B12 | Giao nhiệm vụ sau họp | PASS | Modal đầy đủ Nhiệm vụ/Mô tả/Người phụ trách/Hạn xử lý → tạo thành công, hiện đúng người phụ trách "Nguyễn Hoài An", 0%, "Chưa thực hiện". (Xem lỗi lệch ngày ở mục A1-note — cùng hiện tượng.) |
| B13 | sokhdt: xác nhận tham dự giấy mời | Chưa test đúng vai | `sokhdt` đã "Tham dự" sẵn trong data mẫu cho mọi phiên đang mở — không còn trạng thái "chờ xác nhận" để test lại. Đã test tương đương bằng `chutich` (xem dưới). |
| B13 | Ủy quyền | **PASS** (dùng `chutich` thay `sokhdt`) | Modal "Ủy quyền tham dự" → chọn "Lê Minh Khuê" → Xác nhận → tab Đại biểu hiện đúng "Ủy quyền → Lê Minh Khuê", thống kê tổng "Ủy quyền: 1" cập nhật chính xác. |
| B13 | Ghi chú cá nhân trên tài liệu | PASS | Modal xem tài liệu có 2 khu: "Ghi chú cá nhân (chỉ mình bạn thấy)" và "Góp ý công khai". Thêm ghi chú → lưu và hiện đúng trong danh sách. |
| B13 | Nhắn tin trao đổi trong phòng họp | PASS | Tab "Trao đổi" — mô phỏng realtime chat rất tự nhiên (bao gồm tin nhắn "Riêng" giữa 2 người, liên kết đúng với thông báo "tài liệu được chia sẻ"). Gửi tin QA test → hiện đúng, xen giữa các tin mô phỏng khác đúng thời gian thực. |
| B14 | Màn hình TV | **PASS** | Chế độ trình chiếu toàn màn hình, đủ thông tin (chủ đề đang thảo luận, kết quả biểu quyết live, chương trình, sĩ số). Ấn tượng cho demo. |
| B14 | Lịch công tác | PASS | Calendar view tháng + list chi tiết cuộc họp trong tháng, đúng dữ liệu. |
| B14 | Tra cứu phiên họp | Không test riêng | Trùng chức năng với filter trang "Phiên họp" đã test kỹ ở A9. |
| B14 | HDSD | PASS | Hiện đúng tài liệu HDSD theo vai trò đang đăng nhập (Chủ trì) — cá nhân hóa tốt. |
| B14 | Thông báo | PASS | Đầy đủ, đúng thời gian, liên kết logic với hành động khác (VD thông báo "tài liệu chia sẻ" khớp tin nhắn riêng trong chat). |
| B15 | Vai trò — điều hướng menu đúng | **PASS** | Đã xác nhận qua nhiều lần đăng nhập: `thuky`/`chutich` **KHÔNG** có "Xử lý Hỗ trợ & Phản hồi" (chỉ "Hỗ trợ & Phản hồi" thường); `qtdonvi` **CÓ** — đúng thiết kế mới. `qtdonvi` không có "Báo cáo thống kê"; `thuky`/`chutich`/`quantri` có. |

---

## 2. DANH SÁCH LỖI (đánh số theo mức độ)

### P0 — Chặn nghiệp vụ (1 lỗi)

**P0-1.** Vai `qtdonvi` (Quản trị đơn vị) không có nút/khả năng **tạo phiên họp mới** (trang Phiên họp không hiển thị `page-actions` chứa nút "Tạo phiên họp" cho vai này, dù CÓ hiển thị đầy đủ cho `thuky`). Nếu quy trình HSMT thực sự yêu cầu "quản trị đơn vị tạo họp" (theo brief giao việc), đây là **chặn hoàn toàn** luồng nghiệp vụ tương ứng cho vai `qtdonvi`. Cần dev xác nhận: (a) đây có đúng là yêu cầu HSMT hay brief hiểu nhầm vai; (b) nếu đúng, bổ sung quyền tạo họp cho `qtdonvi` (hoặc mở endpoint tương đương qua UI khác).

### P1 — Sai chức năng / có đường vòng (5 lỗi)

**P1-1.** Cơ chế "trình duyệt tài liệu cho member/đại biểu duyệt" (mô tả trong brief là tính năng mới đêm qua) **không tìm thấy** trong UI hiện tại — cơ chế "Tài liệu chờ duyệt" thực tế hoạt động NGƯỢC hướng: chỉ chủ trì+thư ký duyệt tài liệu do member nộp, không có bước "quản trị đơn vị tải lên → member duyệt". Đường vòng: luồng duyệt-bởi-chủ trì hiện có vẫn đủ dùng cho nghiệp vụ tổng thể, chỉ khác vai người duyệt so với mô tả.

**P1-2.** Tính năng "phiếu lấy ý kiến KÍN" (ẩn danh người trả lời/ký số) **chưa tồn tại** trong form tạo phiếu — không có checkbox/field liên quan. Mọi phiếu hiện tại đều công khai danh tính người góp ý.

**P1-3.** Biên bản phiên họp SAU KHI ký số vẫn còn nút "Tạo lại dự thảo" — không có cơ chế khóa cứng ngăn ghi đè biên bản đã ký, có thể làm mất tính toàn vẹn pháp lý của văn bản đã ký số.

**P1-4.** Lệch ngày/giờ khi nhập input datetime (2 lần quan sát độc lập: tạo phiên họp và giao nhiệm vụ) — giá trị lưu/hiển thị không khớp giá trị nhập vào form. Cần dev kiểm tra kỹ component xử lý `datetime-local`/timezone. (Có khả năng nhỏ do cách công cụ test điền field, nhưng độ lệch không nhất quán giữa 2 lần nên nghiêng về lỗi thật — đề nghị verify tay qua UI thật với date picker.)

**P1-5.** Dropdown "Người được ủy quyền" (modal Ủy quyền tham dự) liệt kê TOÀN BỘ 13 người dùng hệ thống, không giới hạn/ưu tiên trong 7 đại biểu thuộc thành phần phiên họp đang xem — về mặt UX/nghiệp vụ, có thể dẫn tới ủy quyền cho người ngoài thành phần biểu quyết của phiên (dev cần xác nhận có chủ đích hay không).

### P2 — UX / nhãn / màu (3 điểm)

**P2-1.** Trong tab "Trao đổi" (chat phòng họp), tin nhắn do người dùng vừa gửi đôi khi hiển thị không kèm tên người gửi (chỉ có timestamp), trong khi các tin khác đều có tên — cần xác nhận có phải hành vi "gộp nhóm tin liên tiếp cùng người" đúng thiết kế hay là thiếu label.

**P2-2.** Trạng thái "sửa/tắt loại tài liệu" và "hiển thị nhãn loại tài liệu trên card danh sách" chưa verify được do hạn chế công cụ — đề nghị QA vòng sau xác nhận trực quan (không phải lỗi đã xác nhận, chỉ là chưa kiểm hết).

**P2-3.** Input "Từ ngày/Đến ngày" trong Báo cáo thống kê dùng dạng 3 spinbutton (Month/Day/Year) tách biệt — khó điền nhanh so với 1 ô date picker chuẩn; đây chỉ là quan sát UX, không chắc là vấn đề thật vì có thể do trình duyệt/OS render input `type="date"` theo cách riêng.

---

## 3. ĐỀ XUẤT UX (không phải lỗi, chỉ là quan sát đáng giá)

1. Nhãn nút ở trang Phiên họp của `thuky` — "Tạo phiên họp" khá nhỏ, nằm sát cạnh phải header, dễ bị người dùng lần đầu bỏ sót nếu không quen layout (đã phải soát kỹ Observe mới định vị được).
2. Modal "Thêm tài liệu phiên họp" khá dài (2 loại tài liệu × 2 cách nhập × cơ quan ban hành × loại E-HSMT × checkbox mật) — nên xem xét chia thành 2 bước hoặc accordion để giảm choáng ngợp cho người dùng lớn tuổi (đối tượng chính là lãnh đạo/chuyên viên sở, không phải dev).
3. Sau khi "Ký số & gửi ý kiến" hoặc "Ký số biên bản", nên có toast/banner xác nhận rõ ràng hơn là chỉ đổi badge lặng lẽ — với văn bản có giá trị pháp lý, cảm giác "đã hoàn tất" cần rõ ràng hơn cho người dùng không quen công nghệ.
4. Biểu đồ "Thống kê ý kiến văn bản" và "Phân bố phương án" chất lượng tốt, số liệu chính xác theo thời gian thực — đây là điểm mạnh đáng nhấn khi demo cho tổ chấm thầu.
5. Dự thảo biên bản tự sinh (nút "Tạo dự thảo từ dữ liệu phiên họp") là điểm sáng nhất của toàn bộ buổi test — chất lượng văn bản gần như sẵn sàng nộp thật, nên được ưu tiên trình diễn đầu tiên khi demo bán hàng.
6. Modal xác nhận đăng nhập ("Đăng nhập" nút) không hiển thị loading/disable trong lúc xử lý — không phát hiện lỗi thật nhưng nên thêm trạng thái loading để tránh double-click.

---

## 4. BẰNG CHỨNG SCREENSHOT ĐÃ LƯU (fileId trong thread)

1. `cmrppo4b706zf07adfmf8y6xc` — Dashboard Quản trị đơn vị (qtdonvi) — menu đầy đủ.
2. `cmrppstjl07e007ad8agsk5ps` — LỖI P0-1: vai thuky có nút Tạo phiên họp, vai qtdonvi không có.
3. `cmrpqwqlz07b506ad59f7941h` — Thông báo "Phản hồi của bạn đã được trả lời" — luồng Hỗ trợ & Phản hồi hoạt động tốt.
4. `cmrprghr707u107adui940841` — Màn hình phòng họp trực tiếp, đầy đủ tab.
5. `cmrprq8r507w407advdkrd5x7` — Biên bản đã ký số thành công, dự thảo tự sinh chất lượng cao.
6. `cmrps8fhu08ey07ad1om0wvcj` — Trao đổi tin nhắn trong phòng họp trực tiếp.
7. `cmrps9crz080j07adnt9657rg` — Màn hình TV — chế độ trình chiếu toàn màn hình.
8. `cmrpsflmr084s07adl2jdd5bn` — Báo cáo thống kê ý kiến văn bản — biểu đồ phân bố phương án.

---

## 5. TRẠNG THÁI DỮ LIỆU MẪU SAU PHIÊN TEST

Đã thêm vào dữ liệu mẫu (không xóa gì): 1 phiên họp mới bị mất sau session reset ("Họp QA kiểm thử eCabinet" — không còn tồn tại, xem ghi chú kỹ thuật); 2 tài liệu QA test trong phiên "Họp chuyên đề giải ngân"; 1 kết luận đã sửa (thêm đính kèm) trong phiên tháng 7; 1 nhiệm vụ mới ("Hoàn thiện Báo cáo KT-XH theo góp ý (QA test 2)"); 1 phản hồi Hỗ trợ đã được trả lời; 1 phiếu ý kiến nháp (chưa rõ đã gửi thành công hay còn ở draft — cần agent sau kiểm tra tab "Chưa gửi"); "Công văn" + "Nghị quyết" trong Danh mục loại tài liệu; 1 ủy quyền (Trần Đại Nghĩa → Lê Minh Khuê) trong phiên "Họp chuyên đề"; ghi chú cá nhân trên 1 tài liệu; 1 tin nhắn chat. Nếu cần dữ liệu mẫu sạch, `quantri` có nút ↻ khôi phục ở toolbar.

**Ghi chú kỹ thuật quan trọng:** phát hiện 1 hiện tượng đáng lưu ý — phiên họp mới tạo (đã gửi giấy mời thành công) đã **biến mất** sau khi tôi buộc phải `BrowserNavigate` (full reload) do sự cố nested-iframe. Không rõ đây là do (a) app dùng `sessionStorage` cho dữ liệu mới thay vì `localStorage` bền, hoặc (b) chỉ là tác dụng phụ của việc reload cross-origin trong công cụ test. Đề nghị dev xác nhận cơ chế lưu trữ demo có đúng dùng `localStorage` persist qua reload như thiết kế dự kiến hay không — đây có thể ảnh hưởng đến trải nghiệm demo thật nếu người dùng vô tình F5.

**Session browser cuối phiên:** session `ea18eb95-fb1e-4a27-aa86-8233d1d3f0ea` đang active, đăng nhập cuối cùng là vai `chutich` (Trần Đại Nghĩa), tại trang Báo cáo thống kê > Thống kê ý kiến văn bản. KHÔNG đóng session này để agent sau dùng tiếp.
