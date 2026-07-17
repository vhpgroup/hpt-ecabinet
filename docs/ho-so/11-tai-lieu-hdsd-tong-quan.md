# KHUNG TÀI LIỆU HƯỚNG DẪN SỬ DỤNG (HDSD)

**Gói thầu:** Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu
**Sản phẩm:** Phần mềm eCabinet
**Đơn vị lập:** [Tên đầy đủ pháp nhân HPT TECH]

## Căn cứ

- E-HSMT Chương V, mục "Yêu cầu chung về đào tạo": *"Đơn vị cung cấp dịch vụ có trách nhiệm cung cấp đầy đủ tài liệu hướng dẫn sử dụng, tài liệu quản trị hệ thống và các tài liệu liên quan phục vụ công tác đào tạo và khai thác hệ thống"* (`docs/hsmt-chuong-v.md` dòng 140).
- Tiêu chí chất lượng dịch vụ 4.2.4 "Tính dễ học, dễ sử dụng" — yêu cầu về sự đầy đủ và cách thức cung cấp hướng dẫn sử dụng (dòng 88–89).
- Mục "Nội dung chính công việc bảo trì, duy trì, cập nhật phần mềm" — hỗ trợ kỹ thuật trong việc cài đặt phần mềm (dòng 244).
- Bảng chức năng mục 3.4 HSMT (dòng 388–515) — nguồn outline chi tiết từng chương.

## Ghi chú quan trọng về hiện trạng

Hệ thống eCabinet **đã có sẵn module Hướng dẫn sử dụng tích hợp trong ứng dụng** (menu "Quản trị hệ thống" > "Tài liệu hướng dẫn sử dụng" dành cho quản trị soạn nội dung; menu "Hướng dẫn sử dụng" dành cho người dùng xem theo đúng vai trò được phân). Quản trị hệ thống có thể soạn nội dung trực tiếp hoặc tải tệp lên, giới hạn hiển thị theo vai trò (Chủ trì/Thư ký/Thành viên dự họp/Quản trị đơn vị/Quản trị hệ thống).

Tài liệu này là **khung mục lục (outline)** dùng làm cơ sở biên soạn bản HDSD đầy đủ dạng file độc lập (PDF/Word) để nộp kèm hồ sơ dự thầu và phát cho học viên trong các lớp đào tạo (`docs/ho-so/08-giao-trinh-dao-tao.md`), đồng thời là nội dung được nạp vào module HDSD tích hợp sẵn trong ứng dụng nêu trên. Nội dung khung bám sát đúng menu thực tế của phần mềm (theo `README.md` mục 1 và mục 3 của repo `hpt-ecabinet`), không mô tả chức năng chưa có trong sản phẩm.

---

## PHẦN A — TÀI LIỆU HDSD DÀNH CHO QUẢN TRỊ HỆ THỐNG

### Chương 1. Tổng quan hệ thống
1.1. Giới thiệu phần mềm eCabinet — mục tiêu, phạm vi áp dụng
1.2. Kiến trúc tổng thể (lớp người dùng — kênh giao tiếp — lớp nghiệp vụ — tầng dữ liệu — lớp tích hợp — hạ tầng, theo mô hình HSMT dòng 274–291)
1.3. Các vai trò người dùng và ma trận quyền tổng quát (Quản trị hệ thống, Quản trị đơn vị, Chủ trì cuộc họp, Thư ký cuộc họp, Thành viên dự họp)
1.4. Yêu cầu về trình duyệt, thiết bị truy cập

### Chương 2. Cài đặt, cấu hình phần mềm
2.1. Yêu cầu hạ tầng (tham chiếu bảng cấu hình máy chủ HSMT)
2.2. Quy trình cài đặt phần mềm trên môi trường máy chủ
2.3. Cấu hình kết nối cơ sở dữ liệu
2.4. Cấu hình chứng chỉ bảo mật (HTTPS/TLS)
2.5. Cấu hình kết nối LGSP (khi có đặc tả chính thức)
2.6. Kiểm tra sau cài đặt (checklist khởi động lần đầu)

### Chương 3. Quản trị hệ thống
3.1. Quản lý cơ cấu tổ chức — xem/thêm/sửa/xóa đơn vị (xã, phường, đặc khu)
3.2. Quản lý thông tin người dùng — thêm/sửa/xóa tài khoản, chọn và phân quyền, thêm quyền bổ sung
3.3. Nhật ký đăng nhập hệ thống — xem, lọc theo tài khoản/thời gian, xóa nhật ký
3.4. Quản trị tài liệu hướng dẫn sử dụng — soạn nội dung/tải tệp, giới hạn theo vai trò, xem danh sách

### Chương 4. Quản trị danh mục
4.1. Danh mục chức vụ — CRUD
4.2. Danh mục loại phiên họp — CRUD
4.3. Danh mục loại tài liệu — CRUD
4.4. Danh mục phòng họp — CRUD + cập nhật sơ đồ phòng họp (cấu hình lưới ghế, lối đi)
4.5. Danh mục cơ quan ban hành — CRUD

### Chương 5. Quản trị hoạt động người sử dụng
5.1. Quy trình phê duyệt cấp/khóa tài khoản (tham chiếu `docs/ho-so/04-quy-trinh-quan-tri-van-hanh.md` Quy trình 3)
5.2. Phân quyền theo vai trò — nguyên tắc và thao tác
5.3. Xử lý sự cố tài khoản thường gặp (quên mật khẩu, tài khoản bị khóa nhầm)

### Chương 6. Giám sát, vận hành, xử lý sự cố
6.1. Theo dõi tình trạng hoạt động hệ thống
6.2. Nhận biết dấu hiệu sự cố và quy trình báo cáo
6.3. Phối hợp với Nhà thầu và Trung tâm Công nghệ thông tin khi có sự cố (tham chiếu `docs/ho-so/04-quy-trinh-quan-tri-van-hanh.md` Quy trình 1, 2)
6.4. Sao lưu, phục hồi dữ liệu — nguyên tắc và cách kiểm tra (tham chiếu Quy trình 4)

### Chương 7. Quản trị API và tích hợp
7.1. Quản lý khóa API cấp cho hệ thống bên thứ ba (tạo/thu hồi/kích hoạt/xóa khóa)
7.2. Danh mục mô tả API (quản lý mô tả 6 API mở tương ứng mục 54–59 HSMT)
7.3. Hướng dẫn đấu nối LGSP

### Chương 8. Báo cáo thống kê dành cho quản trị
8.1. Thống kê số phiên họp theo tháng, tỷ lệ tham dự
8.2. Thống kê lượt biểu quyết, nhiệm vụ sau họp
8.3. Ước tính giấy/chi phí tiết kiệm được
8.4. Thống kê ý kiến văn bản lấy ý kiến

### Phụ lục A
- Danh mục lỗi thường gặp và cách xử lý
- Danh sách đầu mối hỗ trợ kỹ thuật (tổng đài, email)
- Mẫu biểu quản trị (đồng bộ với `docs/ho-so/04-quy-trinh-quan-tri-van-hanh.md`)

---

## PHẦN B — TÀI LIỆU HDSD DÀNH CHO NGƯỜI DÙNG

*Cấu trúc theo 4 vai trò: Chủ trì cuộc họp, Thư ký cuộc họp, Thành viên dự họp, Quản trị đơn vị — mỗi vai trò có chương riêng, chỉ mô tả chức năng vai trò đó thực sự có quyền sử dụng.*

### Chương 1. Bắt đầu sử dụng (áp dụng chung mọi vai trò)
1.1. Đăng nhập, đăng xuất, đổi mật khẩu
1.2. Tổng quan giao diện, menu chính theo từng vai trò
1.3. Xem lịch họp cá nhân (sắp diễn ra/đã kết thúc)
1.4. Tra cứu cuộc họp theo trạng thái, nội dung, thời gian, từ khóa
1.5. Sử dụng Trung tâm thông báo trong ứng dụng
1.6. Tra cứu tài liệu Hướng dẫn sử dụng tích hợp trong hệ thống (theo vai trò)

### Chương 2. Dành cho Quản trị đơn vị
2.1. Quản lý người dùng trong phạm vi đơn vị (tạo/sửa/khóa-mở, không xóa tài khoản, không đổi vai trò Quản trị hệ thống)
2.2. Nhập thông tin cuộc họp, tạo mới cuộc họp theo yêu cầu của Chủ trì/Thư ký
2.3. Chuẩn bị tài liệu họp — tải tài liệu, trình duyệt
2.4. Theo dõi trạng thái duyệt tài liệu (xem view "Đơn vị tôi chuẩn bị tài liệu")
2.5. Xem danh sách cuộc họp đơn vị tham gia

### Chương 3. Dành cho Thư ký cuộc họp
3.1. Tạo/sửa/xóa cuộc họp; thêm chương trình; gửi giấy mời điện tử
3.2. Quản lý tài liệu họp theo mục chương trình
3.3. Quản lý danh sách người tham gia họp
3.4. Thêm/sửa/xóa nội dung biểu quyết trước khi mở
3.5. Điểm danh hộ đại biểu vắng có lý do
3.6. Ghi kết luận cuộc họp theo mục, đính kèm file; sửa/xóa kết luận
3.7. Thêm văn bản cần xin ý kiến (lấy ý kiến ngoài họp); cập nhật thông tin liên quan (cán bộ theo dõi, thời hạn, file đính kèm)
3.8. Tổng hợp, thống kê ý kiến của thành viên đối với văn bản; gửi nhắc người chưa phản hồi
3.9. Xuất báo cáo, danh sách điểm danh, ý kiến tài liệu

### Chương 4. Dành cho Chủ trì cuộc họp
4.1. Điều hành phiên họp: chuyển mục chương trình, xem tiến trình và thời gian còn lại
4.2. Điều hành phát biểu: mời phát biểu, dừng/kết thúc lượt
4.3. Điều hành chất vấn: bắt đầu/tạm dừng/kết thúc phiên chất vấn, duyệt danh sách đăng ký, gọi chất vấn
4.4. Điều hành biểu quyết: mở/đóng biểu quyết, xem đại biểu sẵn sàng/chưa sẵn sàng, xem kết quả tổng hợp
4.5. Duyệt hoặc từ chối tài liệu họp (kèm lý do khi từ chối)
4.6. Xem, ghi kết luận cuộc họp
4.7. Xem xét, cho ý kiến và ký số đối với văn bản lấy ý kiến
4.8. Khai thác sơ đồ phòng họp và vị trí đại biểu trong phiên họp trực tiếp

### Chương 5. Dành cho Thành viên dự họp
5.1. Xác nhận tham dự/báo vắng kèm lý do/ủy quyền cho người khác
5.2. Điểm danh (tự điểm danh, mã QR)
5.3. Xem nội dung cuộc họp: tài liệu, danh sách biểu quyết, người/đơn vị tham gia
5.4. Đăng ký/hủy đăng ký phát biểu
5.5. Đăng ký/hủy đăng ký chất vấn (chọn người được chất vấn, chủ đề, nội dung)
5.6. Biểu quyết nội dung (đồng ý/không đồng ý/ý kiến khác)
5.7. Ghi chú cá nhân trong cuộc họp trên tài liệu
5.8. Xem văn bản lấy ý kiến, nhập ý kiến, ký số ý kiến, gửi ý kiến, xem lại ý kiến đã gửi
5.9. Xem xuất ý kiến tài liệu (góp ý công khai)
5.10. Theo dõi nhiệm vụ sau họp được giao, cập nhật tiến độ

### Chương 6. Quản lý tài liệu cá nhân (áp dụng chung)
6.1. Tạo, quản lý thư mục tài liệu cá nhân
6.2. Tải tài liệu lên, soạn nội dung trực tiếp
6.3. Tra cứu, xem nội dung tài liệu
6.4. Chia sẻ tài liệu có kiểm soát

### Chương 7. Sử dụng trên thiết bị di động
7.1. Truy cập ứng dụng trên thiết bị di động (trình duyệt di động/PWA)
7.2. Khác biệt so với phiên bản web (các chức năng rút gọn theo đúng mục 60–97 HSMT — ví dụ: mục 61 mobile chỉ yêu cầu xem danh sách thư mục, không yêu cầu thêm/sửa/xóa như mục 14 bản web)
7.3. Thực hiện đầy đủ nghiệp vụ trong cuộc họp từ thiết bị di động (điểm danh, phát biểu, chất vấn, biểu quyết, ghi chú)

### Chương 8. Màn hình TV phòng họp (dành cho người quản lý phòng họp/thư ký)
8.1. Chế độ trình chiếu toàn màn hình: nội dung đang thảo luận, người phát biểu/chất vấn, kết quả biểu quyết trực tiếp
8.2. Hiển thị mã QR điểm danh, số đại biểu có mặt

### Phụ lục B
- Bảng tổng hợp phím tắt (nếu có)
- Câu hỏi thường gặp (FAQ) theo từng vai trò
- Thông tin liên hệ hỗ trợ kỹ thuật

---

## Ghi chú biên soạn

1. Nội dung chi tiết từng chương (mô tả từng bước thao tác, ảnh chụp màn hình minh họa) được biên soạn dựa trên đúng giao diện thực tế của phần mềm tại thời điểm bàn giao, cập nhật đồng bộ với module Hướng dẫn sử dụng đã tích hợp sẵn trong ứng dụng — bảo đảm nội dung tài liệu giấy/PDF và nội dung hiển thị trong ứng dụng luôn khớp nhau.
2. Khi hệ thống được nâng cấp (theo `docs/ho-so/07-phuong-an-nang-cap-quy-dinh-moi.md`), tài liệu HDSD (cả bản độc lập và bản tích hợp trong ứng dụng) được cập nhật đồng thời, không trễ hơn thời điểm đưa bản nâng cấp vào vận hành chính thức.
3. Tài liệu HDSD là một trong các tài liệu phát kèm chương trình đào tạo (`docs/ho-so/08-giao-trinh-dao-tao.md` Mục D).

---

**ĐẠI DIỆN NHÀ THẦU**
[Chức vụ]

[Họ tên]
*(Ký, ghi rõ họ tên, đóng dấu)*
