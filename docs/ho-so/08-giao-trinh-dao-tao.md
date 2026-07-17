# GIÁO TRÌNH ĐÀO TẠO, CHUYỂN GIAO CÔNG NGHỆ

**Gói thầu:** Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu
**Sản phẩm:** Phần mềm eCabinet
**Đơn vị lập:** [Tên đầy đủ pháp nhân HPT TECH]

## Căn cứ

- E-HSMT Chương V, mục "Yêu cầu về đào tạo, chuyển giao công nghệ" (`docs/hsmt-chuong-v.md` dòng 122–145): *"Đơn vị cung cấp dịch vụ có trách nhiệm tổ chức đào tạo và hướng dẫn sử dụng phần mềm... nhằm bảo đảm cán bộ của Sở Khoa học và Công nghệ thành phố Hải Phòng có thể khai thác, sử dụng và vận hành hệ thống hiệu quả"*.
- Danh mục chức năng thực tế của phần mềm eCabinet: `README.md` mục 1 "Chức năng" (repo `/agent/workspace/hpt-ecabinet`) và bảng chức năng mục 3.4 HSMT (dòng 388–515).

Giáo trình gồm 2 chương trình theo đúng yêu cầu HSMT: (A) Lớp đào tạo Cán bộ quản trị; (B) Lớp đào tạo Cán bộ sử dụng. Nội dung từng phần bám sát đúng các phân hệ/menu thật có trong phần mềm eCabinet, không mô tả chức năng chưa tồn tại.

---

## A. CHƯƠNG TRÌNH ĐÀO TẠO CÁN BỘ QUẢN TRỊ

**Đối tượng:** Cán bộ quản trị vận hành của Sở Khoa học và Công nghệ (HSMT dòng 129).
**Thời gian:** 01 ngày, 01 lớp, dự kiến 10 học viên (dòng 130).
**Hình thức:** Trực tiếp (dòng 131).
**Nhân sự phụ trách:** Tối thiểu 01 giảng viên + 01 trợ giảng trong suốt quá trình đào tạo (dòng 141).
**Địa điểm:** Do Sở Khoa học và Công nghệ bố trí hoặc thống nhất giữa hai bên (dòng 143).

### Khung chương trình theo giờ

| Buổi | Thời gian | Nội dung | Phân hệ/menu tương ứng trong eCabinet |
|---|---|---|---|
| Sáng | 08:00–08:15 | Khai giảng, giới thiệu mục tiêu khóa học, phát tài liệu | — |
| Sáng | 08:15–09:00 | Tổng quan hệ thống: kiến trúc, các phân hệ chính, 5 vai trò người dùng (Quản trị hệ thống, Quản trị đơn vị, Chủ trì cuộc họp, Thư ký cuộc họp, Thành viên dự họp), luồng nghiệp vụ tổng thể (chuẩn bị họp → điều hành phiên họp → lấy ý kiến văn bản) | Toàn hệ thống |
| Sáng | 09:00–09:45 | Cài đặt, cấu hình phần mềm: cấu hình máy chủ (theo mô hình triển khai tập trung tại Trung tâm dữ liệu thành phố), thiết lập biến môi trường, kết nối cơ sở dữ liệu, cấu hình chứng chỉ bảo mật (HTTPS/TLS) | Cấu hình hệ thống (thực hiện cùng đội kỹ thuật Nhà thầu) |
| Sáng | 09:45–10:00 | Giải lao | — |
| Sáng | 10:00–10:45 | **Quản trị hệ thống — Quản lý cơ cấu tổ chức**: xem/thêm/sửa/xóa đơn vị (xã, phường, đặc khu) | Menu "Quản trị hệ thống" > Đơn vị |
| Sáng | 10:45–11:30 | **Quản trị hệ thống — Quản lý người dùng**: thêm/sửa/xóa tài khoản, phân quyền theo vai trò, khóa/mở khóa tài khoản; phân biệt quyền Quản trị hệ thống và Quản trị đơn vị | Menu "Quản trị hệ thống" > Người dùng |
| Sáng | 11:30–12:00 | **Nhật ký hệ thống (audit log)**: tra cứu theo tài khoản, theo thời gian; xóa nhật ký; ý nghĩa phục vụ truy xuất nguồn gốc | Menu "Quản trị hệ thống" > Nhật ký hệ thống |
| | 12:00–13:30 | Nghỉ trưa | — |
| Chiều | 13:30–14:15 | **Quản trị danh mục**: chức vụ, loại phiên họp, loại tài liệu, cơ quan ban hành — CRUD, bật/tắt sử dụng, sắp thứ tự | Menu "Quản trị danh mục" |
| Chiều | 14:15–15:00 | **Quản trị phòng họp và sơ đồ phòng họp**: thêm phòng họp, cấu hình sơ đồ (lưới ghế, lối đi), gán vị trí đại biểu | Menu "Quản trị danh mục" > Phòng họp |
| Chiều | 15:00–15:15 | Giải lao | — |
| Chiều | 15:15–16:00 | **Quản trị tài liệu hướng dẫn sử dụng (HDSD)**: soạn nội dung/tải tệp HDSD, giới hạn hiển thị theo vai trò người dùng | Menu "Quản trị hệ thống" > Tài liệu HDSD |
| Chiều | 16:00–16:45 | **Giám sát, nhận biết và xử lý sự cố**: theo dõi tình trạng hoạt động hệ thống, quy trình báo cáo sự cố, phối hợp với Nhà thầu và Trung tâm Công nghệ thông tin (tham chiếu `docs/ho-so/04-quy-trinh-quan-tri-van-hanh.md`) | Vận hành hệ thống (ngoài phạm vi UI, thực hành qua tình huống mô phỏng) |
| Chiều | 16:45–17:15 | **API & Tích hợp**: quản lý khóa API cấp cho hệ thống bên thứ ba, danh mục mô tả API, hướng dẫn đấu nối LGSP | Menu "Quản trị hệ thống" > API & Tích hợp |
| Chiều | 17:15–17:30 | **Báo cáo thống kê quản trị**: số phiên họp theo tháng, tỷ lệ tham dự, lượt biểu quyết, nhiệm vụ, ước tính giấy/chi phí tiết kiệm; giải đáp thắc mắc, tổng kết | Menu "Báo cáo thống kê" |

### Yêu cầu đạt được sau khóa học
Học viên có thể độc lập thực hiện: quản lý cơ cấu tổ chức, cấp/khóa tài khoản và phân quyền, quản trị danh mục và phòng họp, tra cứu nhật ký hệ thống, quản trị tài liệu HDSD, xử lý bước đầu các tình huống sự cố thường gặp theo quy trình đã được chuyển giao.

---

## B. CHƯƠNG TRÌNH ĐÀO TẠO CÁN BỘ SỬ DỤNG

**Đối tượng:** Cán bộ trực tiếp sử dụng phần mềm tại các xã, phường, đặc khu; dự kiến đào tạo cán bộ phụ trách CNTT của các xã, phường, đặc khu (HSMT dòng 136–137).
**Thời gian:** 01 buổi, 01 lớp (dòng 137).
**Hình thức:** Trực tiếp kết hợp trực tuyến (dòng 138).
**Nhân sự phụ trách:** Tối thiểu 01 giảng viên + 01 trợ giảng (dòng 141).

### Khung chương trình theo giờ (buổi 3,5 giờ)

| Thời gian | Nội dung | Phân hệ/menu tương ứng trong eCabinet |
|---|---|---|
| 08:00–08:10 | Khai giảng, giới thiệu mục tiêu buổi học, hướng dẫn kết nối trực tuyến cho học viên tham gia từ xa | — |
| 08:10–08:30 | Đăng nhập, đổi mật khẩu, đăng xuất; tổng quan giao diện, các vai trò người dùng và quyền tương ứng (Chủ trì/Thư ký/Thành viên dự họp/Quản trị đơn vị) | Đăng nhập, "Cập nhật cá nhân" |
| 08:30–09:00 | **Lịch công tác và tra cứu cuộc họp**: xem lịch tháng của đơn vị/cá nhân, tra cứu cuộc họp theo trạng thái, nội dung, thời gian, từ khóa | Menu "Lịch họp" |
| 09:00–09:40 | **Chuẩn bị cuộc họp** (dành cho vai Quản trị đơn vị/Thư ký): tạo cuộc họp mới, thêm chương trình, gửi giấy mời điện tử; tải tài liệu, trình duyệt tài liệu; đối với vai Chủ trì/Thư ký: duyệt hoặc từ chối tài liệu kèm lý do | Menu "Cuộc họp" > Tạo/sửa cuộc họp, Tab "Tài liệu" |
| 09:40–09:50 | Giải lao | — |
| 09:50–10:20 | **Quản lý tài liệu cá nhân**: tạo thư mục, tải tài liệu lên, tra cứu, xem nội dung, ghi chú cá nhân trên tài liệu | Menu "Tài liệu cá nhân" |
| 10:20–11:00 | **Tham gia phiên họp trực tiếp**: điểm danh (tự điểm danh/mã QR), xem sơ đồ phòng họp, xem tiến trình và thời gian còn lại, đăng ký phát biểu, đăng ký chất vấn, biểu quyết, xem kết quả biểu quyết, ủy quyền tham gia họp khi vắng | Trang "Phòng họp trực tiếp" |
| 11:00–11:20 | **Lấy ý kiến bằng văn bản (ngoài họp)**: xem văn bản cần cho ý kiến, đọc tài liệu kèm theo, nhập ý kiến, ký số ý kiến, gửi ý kiến, xem lại ý kiến đã gửi | Menu "Lấy ý kiến văn bản" |
| 11:20–11:35 | **Kết luận cuộc họp và nhiệm vụ sau họp**: xem kết luận theo từng mục, xem/cập nhật tiến độ nhiệm vụ được giao | Trang "Chi tiết cuộc họp" > Tab "Kết luận", Menu "Nhiệm vụ" |
| 11:35–11:50 | **Tra cứu Hướng dẫn sử dụng (HDSD)** dành cho vai trò của học viên; giải đáp thắc mắc thực hành | Menu "Hướng dẫn sử dụng" |
| 11:50–12:00 | Kiểm tra nhanh (thực hành trực tiếp trên hệ thống demo), tổng kết, phát phiếu khảo sát đánh giá khóa học | — |

### Yêu cầu đạt được sau khóa học
Học viên có thể độc lập thực hiện các thao tác cơ bản: đăng nhập/đổi mật khẩu, tra cứu lịch họp, tham gia đầy đủ một phiên họp trực tuyến (điểm danh, phát biểu, chất vấn, biểu quyết), quản lý tài liệu cá nhân, tham gia lấy ý kiến bằng văn bản, theo dõi nhiệm vụ sau họp.

---

## C. YÊU CẦU CHUNG VỀ ĐÀO TẠO (áp dụng cho cả 2 chương trình)

Theo HSMT dòng 139–144:

1. Nhà thầu có trách nhiệm cung cấp đầy đủ tài liệu hướng dẫn sử dụng, tài liệu quản trị hệ thống và các tài liệu liên quan phục vụ công tác đào tạo và khai thác hệ thống (xem danh mục tại Mục D dưới đây và `docs/ho-so/11-tai-lieu-hdsd-tong-quan.md`).
2. Mỗi lớp đào tạo bố trí tối thiểu 01 giảng viên và 01 trợ giảng trong suốt quá trình đào tạo.
3. Nội dung đào tạo và hướng dẫn sử dụng hệ thống là một phần của phạm vi cung cấp dịch vụ, chi phí thực hiện đã được tính trong chi phí thuê dịch vụ.
4. Địa điểm đào tạo do Sở Khoa học và Công nghệ thành phố Hải Phòng bố trí hoặc được thống nhất giữa hai bên.
5. Nhà thầu phối hợp với Sở Khoa học và Công nghệ xây dựng kế hoạch đào tạo cụ thể (ngày giờ, danh sách học viên, môi trường thực hành), chuẩn bị môi trường, tài khoản demo và các điều kiện kỹ thuật cần thiết phục vụ công tác đào tạo trước tối thiểu 05 ngày làm việc so với ngày tổ chức.

## D. Danh mục tài liệu phát kèm

| # | Tài liệu | Đối tượng nhận | Hình thức |
|---|---|---|---|
| 1 | Tài liệu Hướng dẫn sử dụng dành cho Cán bộ quản trị (khung tại `docs/ho-so/11-tai-lieu-hdsd-tong-quan.md` Phần A) | Học viên lớp quản trị | Bản in + bản điện tử (PDF) + tích hợp trong hệ thống (menu "Hướng dẫn sử dụng") |
| 2 | Tài liệu Hướng dẫn sử dụng dành cho Người dùng theo từng vai trò (khung tại `docs/ho-so/11-tai-lieu-hdsd-tong-quan.md` Phần B) | Học viên lớp người dùng | Bản in + bản điện tử (PDF) + tích hợp trong hệ thống |
| 3 | Slide bài giảng của từng buổi đào tạo | Toàn bộ học viên | Bản điện tử (gửi trước và sau buổi học) |
| 4 | Tài khoản demo môi trường thực hành (không dùng tài khoản/dữ liệu thật) | Toàn bộ học viên | Cấp trước buổi học |
| 5 | Phiếu khảo sát đánh giá chất lượng khóa học | Toàn bộ học viên | Bản in hoặc trực tuyến |
| 6 | Danh sách đầu mối hỗ trợ kỹ thuật sau đào tạo (số điện thoại/email tổng đài) | Toàn bộ học viên | Bản in kèm slide |

## E. Mẫu Kế hoạch đào tạo cụ thể (thống nhất với Sở trước khi tổ chức)

---

**KẾ HOẠCH TỔ CHỨC ĐÀO TẠO**

| Nội dung | Lớp Quản trị | Lớp Người dùng |
|---|---|---|
| Ngày tổ chức | | |
| Địa điểm | | |
| Số lượng học viên dự kiến | 10 | |
| Danh sách học viên | (đính kèm) | (đính kèm) |
| Giảng viên | | |
| Trợ giảng | | |
| Hình thức | Trực tiếp | Trực tiếp kết hợp trực tuyến |
| Link tham gia trực tuyến (nếu có) | — | |

---

**ĐẠI DIỆN NHÀ THẦU**
[Chức vụ]

[Họ tên]
*(Ký, ghi rõ họ tên, đóng dấu)*
