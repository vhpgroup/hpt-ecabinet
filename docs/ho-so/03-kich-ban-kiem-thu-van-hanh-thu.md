# KỊCH BẢN KIỂM THỬ VẬN HÀNH THỬ

**Gói thầu:** Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu
**Sản phẩm:** Phần mềm eCabinet
**Đơn vị lập:** [Tên đầy đủ pháp nhân HPT TECH]

## I. Căn cứ lập kịch bản

- Mục "Yêu cầu về nghiệm thu, bàn giao, đưa dịch vụ vào sử dụng": *"Phần mềm trước khi đưa vào vận hành phải được Bên thuê tiến hành vận hành thử theo quy định tại Khoản 1 Điều 58, Nghị định 73/2019/NĐ-CP"*; *"Toàn bộ các thử nghiệm phải tiến hành với sự có mặt của giám sát và của các bên liên quan đến quá trình nghiệm thu"*; *"Kết quả vận hành thử được lập thành văn bản và được gọi là báo cáo kết quả vận hành thử"* (`docs/hsmt-chuong-v.md` dòng 254–260).
- *"Nội dung về công tác vận hành thử được quy định chi tiết tại Phụ lục II ban hành kèm theo Thông tư số 16/2024/TT-BTTTT ngày 30/12/2024"* (dòng 260).
- Bảng "Yêu cầu về chức năng của Phần mềm Họp không giấy tờ" — 97 chức năng, mục 3.4 (dòng 388–515), phân theo Nhóm A (I–IX, web) và Nhóm B (di động).
- Bảng chỉ tiêu chất lượng dịch vụ, đặc biệt hiệu năng, an toàn thông tin, độ tin cậy (dòng 54–120, 531–535).
- *"Việc đưa hệ thống vào sử dụng chính thức và thực hiện kết nối với IOC chỉ được thực hiện sau khi quá trình vận hành thử cho thấy hệ thống hoạt động ổn định..."* (dòng 636).

## II. Nguyên tắc tổ chức vận hành thử

1. Vận hành thử được thực hiện trên môi trường gần giống môi trường sản xuất nhất có thể (cùng cấu hình phần cứng/phần mềm dự kiến vận hành chính thức, dữ liệu mô phỏng đủ quy mô).
2. Có sự tham gia, xác nhận của: đại diện Chủ đầu tư (Sở Khoa học và Công nghệ TP Hải Phòng), đại diện đơn vị giám sát (nếu có), đại diện Trung tâm Công nghệ thông tin, đại diện Nhà thầu.
3. Mỗi ca kiểm thử có: mã ca, mục HSMT liên quan, điều kiện tiên quyết, các bước thực hiện, kết quả mong đợi theo đúng câu chữ HSMT, và cột kết quả thực tế để trống — điền tại thời điểm thực hiện, có xác nhận ký tên của người thực hiện và người giám sát.
4. Kết thúc vận hành thử, toàn bộ kết quả được tổng hợp thành "Báo cáo kết quả vận hành thử" theo mẫu tại Mục V văn bản này, làm căn cứ để các bên xem xét nghiệm thu hoặc yêu cầu Nhà thầu tiếp tục chỉnh sửa, bổ sung, hoàn thiện (dòng 259 HSMT).
5. Kịch bản bao phủ đủ 4 nhóm nội dung: (a) chức năng nghiệp vụ theo mục 3.4 (Nhóm A + B), (b) hiệu năng/SLA, (c) an toàn thông tin — phân quyền/tài liệu mật/phiếu kín, (d) độ tin cậy — sự cố/phục hồi.

## III. Bảng kịch bản kiểm thử

### Phần A — Nhóm I: Quản trị hệ thống (mục 1–4 HSMT)

| Mã ca | Mục HSMT | Điều kiện | Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế |
|---|---|---|---|---|---|
| VHT-A01 | 1 — Quản lý cơ cấu tổ chức | Đăng nhập vai Quản trị hệ thống | 1. Xem danh sách đơn vị. 2. Thêm mới 1 đơn vị (xã/phường/đặc khu). 3. Sửa thông tin đơn vị. 4. Xóa đơn vị không còn dữ liệu liên quan | Danh sách hiển thị đúng; thêm/sửa/xóa thành công, không cho xóa đơn vị còn cán bộ đang hoạt động | |
| VHT-A02 | 2 — Quản lý người dùng + phân quyền | Đăng nhập vai Quản trị hệ thống | 1. Thêm người dùng mới, chọn vai trò. 2. Xác nhận quyền mặc định theo vai trò được gán sẵn. 3. Thêm quyền bổ sung cho người dùng. 4. Khóa/mở khóa tài khoản | Tài khoản tạo thành công với quyền đúng vai trò; có thể bổ sung quyền; khóa/mở khóa hoạt động đúng | |
| VHT-A03 | 3 — Nhật ký đăng nhập | Có dữ liệu đăng nhập của nhiều tài khoản, nhiều thời điểm | 1. Xem danh sách nhật ký. 2. Lọc theo 1 tài khoản cụ thể. 3. Lọc theo khoảng thời gian. 4. Xóa nhật ký (đã lọc) | Lọc đúng theo từng điều kiện và kết hợp; xóa nhật ký thành công, có ghi log hành động xóa | |
| VHT-A04 | 4 — Quản trị tài liệu HDSD | Đăng nhập vai Quản trị hệ thống | 1. Thêm tài liệu HDSD mới (soạn nội dung hoặc tải tệp), giới hạn theo vai trò xem. 2. Sửa nội dung. 3. Xóa tài liệu. 4. Xem danh sách | CRUD hoạt động đầy đủ; người dùng thuộc vai trò không được gán không thấy tài liệu | |

### Phần B — Nhóm II–III: Cập nhật cá nhân, Quản trị danh mục (mục 5–10)

| Mã ca | Mục HSMT | Điều kiện | Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế |
|---|---|---|---|---|---|
| VHT-B01 | 5 — Đăng nhập/đăng xuất/đổi mật khẩu | Có tài khoản hợp lệ | 1. Đăng nhập đúng thông tin. 2. Đổi mật khẩu. 3. Đăng xuất. 4. Đăng nhập lại bằng mật khẩu mới | Đăng nhập/đổi mật khẩu/đăng xuất thành công; mật khẩu cũ không còn hiệu lực | |
| VHT-B02 | 6, 7, 8, 10 — Danh mục chức vụ/loại phiên họp/loại tài liệu/cơ quan ban hành | Đăng nhập vai Quản trị hệ thống | 1. Với từng danh mục: xem danh sách. 2. Thêm mới. 3. Sửa. 4. Xóa | Cả 4 danh mục đều hỗ trợ CRUD đầy đủ theo đúng câu chữ HSMT | |
| VHT-B03 | 9 — Danh mục phòng họp + sơ đồ phòng họp | Đăng nhập vai Quản trị hệ thống | 1. Thêm phòng họp mới. 2. Cập nhật sơ đồ phòng họp (số hàng/cột, vị trí lối đi). 3. Sửa/xóa phòng họp | Sơ đồ lưu đúng cấu hình; CRUD phòng họp hoạt động đầy đủ | |

### Phần C — Nhóm IV–V: Lấy ý kiến văn bản, Tài liệu cá nhân (mục 11–16)

| Mã ca | Mục HSMT | Điều kiện | Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế |
|---|---|---|---|---|---|
| VHT-C01 | 11, 12, 13 — Văn bản lấy ý kiến (đang/đã/chưa lấy ý kiến) | Thư ký cuộc họp đăng nhập | 1. Thêm văn bản cần xin ý kiến. 2. Xem danh sách đang mở, đã kết thúc. 3. Tra cứu theo từ khóa. 4. Xem chi tiết ý kiến của từng thành viên | Danh sách phân loại đúng trạng thái; tra cứu đúng kết quả; xem chi tiết ý kiến đầy đủ | |
| VHT-C02 | 14, 15, 16 — Tài liệu cá nhân | Người dùng bất kỳ đăng nhập | 1. Tạo thư mục tài liệu. 2. Tải lên tài liệu mới. 3. Xem danh sách, tra cứu, xem nội dung. 4. Chuyển tài liệu vào thư mục khác | Thư mục và tài liệu quản lý đúng; tra cứu/xem nội dung chính xác | |

### Phần D — Nhóm VI: Quản lý thông tin cuộc họp (mục 17–24)

| Mã ca | Mục HSMT | Điều kiện | Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế |
|---|---|---|---|---|---|
| VHT-D01 | 17 — Tạo/sửa/xóa cuộc họp | Thư ký/Chủ trì đăng nhập | 1. Tạo cuộc họp mới (tiêu đề, thời gian, thành phần). 2. Sửa thông tin. 3. Xóa cuộc họp chưa diễn ra | Tạo/sửa/xóa thành công, đúng luồng "Nháp" ban đầu | |
| VHT-D02 | 18 — Tài liệu họp theo nhóm | Quản trị đơn vị đăng nhập | 1. Thêm tài liệu vào từng mục chương trình. 2. Xem chi tiết. 3. Sửa/xóa tài liệu | Tài liệu được nhóm đúng theo mục chương trình | |
| VHT-D03 | 19 — Biểu quyết cuộc họp (thiết lập trước) | Thư ký đăng nhập | 1. Thêm nội dung biểu quyết cho cuộc họp. 2. Xem danh sách, chi tiết. 3. Sửa/xóa nội dung khi chưa mở biểu quyết | Nội dung biểu quyết tạo/sửa/xóa đúng, không cho sửa khi đang mở | |
| VHT-D04 | 20 — Người tham gia họp | Thư ký đăng nhập | 1. Thêm/xóa thành phần tham gia. 2. Cập nhật vai trò trong cuộc họp | Danh sách người tham gia cập nhật đúng | |
| VHT-D05 | 21, 22 — Cuộc họp sắp diễn ra + cuộc họp đơn vị tham gia | Người dùng đăng nhập | 1. Lọc theo thời gian. 2. Lọc theo trạng thái. 3. Xem chi tiết | Lọc và hiển thị đúng | |
| VHT-D06 | 23, 24 — Chuẩn bị và duyệt tài liệu họp | Quản trị đơn vị + Chủ trì đăng nhập (2 vai) | 1. Quản trị đơn vị tải tài liệu, trình duyệt. 2. Chủ trì Duyệt hoặc Từ chối kèm lý do. 3. Xác nhận đại biểu chỉ thấy tài liệu đã duyệt | Luồng 4 trạng thái (Nháp/Chờ duyệt/Đã duyệt/Từ chối) hoạt động đúng, đại biểu không thấy tài liệu chưa duyệt | |

### Phần E — Nhóm VII: Tổ chức cuộc họp (mục 25–51) — trọng tâm nghiệp vụ chính

| Mã ca | Mục HSMT | Điều kiện | Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế |
|---|---|---|---|---|---|
| VHT-E01 | 25 — Điểm danh (tự/hộ/QR) | Cuộc họp đang diễn ra | 1. Đại biểu tự điểm danh. 2. Thư ký điểm danh hộ người vắng có lý do. 3. Thử điểm danh bằng mã QR | Cập nhật đúng CSDL, thống kê realtime chính xác | |
| VHT-E02 | 26 — Ủy quyền tham gia họp | Đại biểu A, B đăng nhập | 1. Đại biểu A ủy quyền cho B. 2. Kiểm tra B có quyền biểu quyết thay A. 3. Cập nhật/xóa ủy quyền | Ủy quyền hoạt động đúng cả chiều thiết lập và hủy | |
| VHT-E03 | 27 — Xem tiến trình + thời gian còn lại | Cuộc họp đang diễn ra | 1. Chủ tọa chuyển mục chương trình. 2. Đại biểu xem tiến trình, thời gian còn lại cập nhật đúng | Đồng hồ đếm ngược và tiến trình hiển thị đồng bộ cho mọi đại biểu | |
| VHT-E04 | 28, 29, 31 — Xem nội dung cuộc họp, văn bản, chương trình tài liệu | Đại biểu đăng nhập | 1. Xem tài liệu, biểu quyết, người/đơn vị tham gia. 2. Xem văn bản lấy ý kiến. 3. Xuất ý kiến tài liệu | Hiển thị đầy đủ đúng quyền; xuất file thành công | |
| VHT-E05 | 30 — Cho ý kiến văn bản + ký số ý kiến | Đại biểu đăng nhập, có văn bản đang mở lấy ý kiến | 1. Nhập ý kiến. 2. Thực hiện ký số ý kiến. 3. Gửi. 4. Xem lại trong danh sách đã cho ý kiến | Ý kiến ghi nhận đúng, có gắn thông tin xác nhận/ký; hiển thị trong danh sách đã cho ý kiến | |
| VHT-E06 | 32, 41, 43, 44 — Biểu quyết + điều hành biểu quyết đồng thời quy mô lớn | Cuộc họp đang diễn ra, mô phỏng 90 người dùng đồng thời | 1. Chủ tọa mở biểu quyết. 2. 90 tài khoản biểu quyết đồng thời trong cùng 1 nội dung. 3. Đóng biểu quyết. 4. Xem kết quả tổng hợp (số đồng ý/không đồng ý/khác) | Không mất phiếu, kết quả tổng hợp chính xác 100%, thời gian phản hồi trung bình dưới 5 giây theo cam kết SLA (`docs/ho-so/02-cam-ket-sla.md` mục 1) | |
| VHT-E07 | 33, 39, 40 — Đăng ký và điều hành phát biểu | Cuộc họp đang diễn ra | 1. Đại biểu đăng ký phát biểu. 2. Chủ tọa xem danh sách đã gọi/chưa gọi, gọi phát biểu. 3. Bắt đầu/dừng/kết thúc lượt phát biểu | Hàng đợi phát biểu vận hành đúng thứ tự, trạng thái cập nhật realtime | |
| VHT-E08 | 34, 45, 46 — Đăng ký và điều hành chất vấn | Cuộc họp đang diễn ra | 1. Đại biểu đăng ký chất vấn (chọn người được chất vấn, nội dung). 2. Chủ tọa bắt đầu phiên chất vấn. 3. Duyệt danh sách đã gọi/chưa gọi. 4. Gọi chất vấn. 5. Kết thúc phiên | Luồng chất vấn vận hành độc lập với luồng phát biểu, đúng trạng thái open/called/done | |
| VHT-E09 | 35 — Ghi chú cá nhân | Đại biểu đăng nhập, đang xem tài liệu | 1. Thêm ghi chú cá nhân trên tài liệu. 2. Sửa, xóa ghi chú | Ghi chú chỉ hiển thị với chính người tạo, không lộ cho người khác | |
| VHT-E10 | 36, 37 — Thông tin điểm danh + người không tham gia | Cuộc họp đã điểm danh | 1. Xem số lượng đại biểu/khách mời có mặt. 2. Xem danh sách người không tham gia kèm lý do. 3. Xuất danh sách điểm danh | Số liệu khớp với dữ liệu điểm danh thực tế; xuất file đúng định dạng | |
| VHT-E11 | 38 — Sơ đồ phòng họp trực tiếp | Cuộc họp đang diễn ra, phòng đã cấu hình sơ đồ | 1. Gán vị trí đại biểu theo sơ đồ. 2. Xem sơ đồ với màu điểm danh trực tiếp (có mặt/chưa điểm danh/vắng) | Sơ đồ hiển thị đúng vị trí và trạng thái theo thời gian thực | |
| VHT-E12 | 42 — Xem đại biểu sẵn sàng biểu quyết | Biểu quyết đang mở | 1. Xem danh sách đại biểu theo trạng thái đã/chưa biểu quyết. 2. Lọc theo trạng thái | Thống kê đúng số đã biểu quyết/chưa biểu quyết; không lộ nội dung lựa chọn nếu là biểu quyết kín | |
| VHT-E13 | 47, 48 — Tổng hợp và thống kê ý kiến văn bản | Có nhiều văn bản đã lấy ý kiến trong kỳ | 1. Xem số người đã/chưa cho ý kiến. 2. Chọn tiêu chí thống kê theo khoảng thời gian. 3. Xem biểu đồ. 4. Xuất thống kê | Số liệu tổng hợp đúng; xuất được báo cáo thống kê theo văn bản | |
| VHT-E14 | 49, 50 — Lịch họp cá nhân + tra cứu | Người dùng đăng nhập | 1. Xem lịch cá nhân (sắp diễn ra/đã kết thúc). 2. Tra cứu cuộc họp theo trạng thái + nội dung + thời gian + từ khóa đồng thời | Kết quả tra cứu chính xác, thời gian phản hồi dưới 30 giây theo cam kết SLA | |
| VHT-E15 | 51 — Kết luận cuộc họp | Thư ký đăng nhập, cuộc họp đang/đã kết thúc | 1. Thêm kết luận theo mục. 2. Đính kèm file. 3. Sửa kết luận đã ghi. 4. Xóa kết luận sai | CRUD kết luận đầy đủ theo đúng 3 hành động HSMT yêu cầu (thêm/xóa/sửa) + đính kèm file | |

### Phần F — Nhóm VIII–IX: Thống kê báo cáo, Tích hợp API (mục 52–59)

| Mã ca | Mục HSMT | Điều kiện | Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế |
|---|---|---|---|---|---|
| VHT-F01 | 52 — Thống kê theo thành viên tham gia | Có dữ liệu nhiều tháng | 1. Chọn khoảng thời gian tùy ý. 2. Xem biểu đồ. 3. Xuất kết quả | Chọn được khoảng thời gian bất kỳ (không cố định); xuất file thành công | |
| VHT-F02 | 53 — Thống kê theo văn bản xin ý kiến | Có dữ liệu nhiều văn bản | 1. Chọn tiêu chí thống kê. 2. Xem theo lượt cho ý kiến/theo lựa chọn. 3. Xuất thống kê | Thống kê tách riêng theo từng/nhiều văn bản, đúng số liệu | |
| VHT-F03 | 54–59 — API tích hợp, chia sẻ dữ liệu | Đã cấp khóa API hợp lệ | 1. Gọi API lấy cuộc họp đơn vị/cá nhân sắp diễn ra và đã diễn ra. 2. Gọi API lấy thông tin cuộc họp. 3. Gọi API lấy tài liệu cuộc họp. 4. Thử gọi bằng khóa không hợp lệ/đã thu hồi | Trả đúng dữ liệu cho khóa hợp lệ; từ chối đúng cho khóa không hợp lệ; không trả tài liệu Mật/phiếu kín qua API mở | |

### Phần G — Nhóm B: Ứng dụng nền tảng di động (mục 60–97)

| Mã ca | Mục HSMT | Điều kiện | Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế |
|---|---|---|---|---|---|
| VHT-G01 | 60 — Đăng nhập/đổi mật khẩu trên di động | Thiết bị di động thật (Android/iOS) | 1. Cài đặt/truy cập ứng dụng trên thiết bị di động. 2. Đăng nhập, đổi mật khẩu, đăng xuất | Hoạt động đầy đủ như trên web, giao diện phù hợp màn hình di động | |
| VHT-G02 | 61, 62, 63, 64 — Tài liệu cá nhân, cuộc họp, tài liệu họp trên di động | Thiết bị di động thật | 1. Xem danh sách thư mục/tài liệu. 2. Tra cứu, xem nội dung. 3. Xem cuộc họp đơn vị, lọc theo thời gian | Hiển thị đầy đủ, thao tác thuận tiện trên màn hình di động | |
| VHT-G03 | 71–81 — Chức năng trong cuộc họp trên di động (điểm danh, ủy quyền, tiến trình, biểu quyết, phát biểu, chất vấn, ghi chú) | Thiết bị di động thật, cuộc họp đang diễn ra | 1. Thực hiện lần lượt từng nghiệp vụ tương ứng nhóm E trên thiết bị di động | Toàn bộ nghiệp vụ hoạt động đồng bộ thời gian thực với phiên bản web | |
| VHT-G04 | 83–91 — Điều hành phiên họp trên di động (dành cho chủ tọa/thư ký di động) | Thiết bị di động thật, vai Chủ trì/Thư ký | 1. Điều hành phát biểu, biểu quyết, chất vấn từ thiết bị di động | Điều hành viên có thể điều hành cuộc họp hoàn toàn từ thiết bị di động | |
| VHT-G05 | 93–97 — Tiện ích và thống kê trên di động | Thiết bị di động thật | 1. Xem lịch cá nhân. 2. Tra cứu cuộc họp. 3. Xem kết luận. 4. Xem thống kê | Đầy đủ tương ứng với yêu cầu rút gọn của mục di động | |

### Phần H — Hiệu năng và SLA (đối chiếu mục 2.1, 4.3, 4.4 bảng tiêu chí + mục thời gian xử lý)

| Mã ca | Mục HSMT | Điều kiện | Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế |
|---|---|---|---|---|---|
| VHT-H01 | Hiệu năng đáp ứng (dòng 62, 531) | Môi trường vận hành thử, đủ dữ liệu mô phỏng | Đo thời gian phản hồi trung bình của 20 thao tác phổ biến (đăng nhập, mở cuộc họp, biểu quyết, tra cứu, xem tài liệu...) | Trung bình dưới 5 giây/thao tác | |
| VHT-H02 | Tốc độ tra cứu đa điều kiện (dòng 62, 532) | Dữ liệu mô phỏng đủ lớn (nhiều năm) | Thực hiện 10 lượt tra cứu kết hợp nhiều điều kiện (trạng thái + nội dung + thời gian + từ khóa) | Mỗi lượt dưới 30 giây | |
| VHT-H03 | Kết xuất báo cáo tổng hợp quy mô lớn (dòng 533) | Dữ liệu mô phỏng nhiều năm, nhiều đơn vị | Chạy báo cáo tổng hợp toàn thành phố trên dữ liệu nhiều năm | Dưới 5 phút, không lỗi timeout | |
| VHT-H04 | Quy mô 500 người dùng/90 đồng thời (dòng 62, 535) | Kịch bản load test | 500 tài khoản được tạo, 90 tài khoản thao tác đồng thời liên tục trong 30 phút | Hệ thống hoạt động ổn định, không lỗi 5xx, thời gian phản hồi vẫn trong ngưỡng cam kết | |
| VHT-H05 | Cảnh báo độ trễ >10 giây (dòng 534) | Mô phỏng tác vụ nặng (upload file lớn, xuất báo cáo lớn) | Thực hiện tác vụ có độ trễ vượt 10 giây | Hệ thống hiển thị rõ thông báo/biểu tượng đang xử lý cho người dùng | |
| VHT-H06 | Gián đoạn dịch vụ và phục hồi (dòng 91–95) | Môi trường vận hành thử | Chủ động ngắt kết nối 1 thành phần hệ thống (mô phỏng sự cố) khi đang có phiên họp mở biểu quyết, sau đó khôi phục | Không mất phiếu đã ghi trước khi ngắt; phục hồi trong 24 giờ; 100% dữ liệu và thành phần khôi phục đúng |  |
| VHT-H07 | Khôi phục từ bản sao lưu | Có bản sao lưu (backup) hợp lệ | Thực hiện quy trình khôi phục từ bản sao lưu gần nhất | Dữ liệu khôi phục đúng 100%, hệ thống hoạt động lại bình thường | |
| VHT-H08 | Phân tích nguyên nhân sự cố ≤8 giờ (dòng 97) | Mô phỏng 1 sự cố có kịch bản | Từ thời điểm ghi nhận sự cố, đo thời gian đến khi có báo cáo nguyên nhân và hướng dẫn khắc phục | Không vượt 8 giờ | |

### Phần I — An toàn thông tin: phân quyền, tài liệu mật, phiếu kín, dò lỗ hổng

| Mã ca | Mục HSMT | Điều kiện | Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế |
|---|---|---|---|---|---|
| VHT-I01 | Phân quyền theo vai trò (dòng 36, 68) | 5 vai trò đã tạo tài khoản | Mỗi vai trò lần lượt thử truy cập chức năng vượt quyền (ví dụ: Thành viên dự họp thử vào phân hệ Quản trị hệ thống) | Bị chặn đúng, hiển thị thông báo không đủ quyền, không truy cập được dữ liệu | |
| VHT-I02 | Tài liệu đánh dấu Mật (dòng 68 — chống truy cập trái phép) | Tài liệu Mật đã tạo, gán phạm vi truy cập | Người không thuộc phạm vi được cấp cố mở tài liệu Mật | Bị chặn (từ chối truy cập), không lộ nội dung, không lộ cả sự tồn tại của tài liệu nếu ngoài phạm vi | |
| VHT-I03 | Biểu quyết/phiếu kín (dòng 32) | Nội dung biểu quyết được đặt ở chế độ kín | Người không có quyền quản lý xem kết quả biểu quyết | Chỉ thấy số liệu tổng hợp (số lượng theo phương án), không thấy ai chọn phương án nào | |
| VHT-I04 | Truy xuất nguồn gốc — nhật ký hành động (dòng 69) | Đã thực hiện nhiều hành động trong hệ thống | Tra cứu nhật ký theo tài khoản và theo khoảng thời gian cụ thể | Tra cứu ra đúng, đầy đủ các hành động đã thực hiện | |
| VHT-I05 | Chống dò mật khẩu (brute-force) (dòng 65–68 — ngăn truy cập trái phép) | Tài khoản hợp lệ | Thử đăng nhập sai liên tục nhiều lần trong thời gian ngắn | Hệ thống tạm khóa/giới hạn tốc độ thử đăng nhập theo IP và/hoặc tài khoản | |
| VHT-I06 | Quét lỗ hổng an toàn thông tin bằng công cụ chuyên dụng (dòng 65–66) | Môi trường vận hành thử, đã được phép quét | Đơn vị có chuyên môn thực hiện quét toàn bộ hệ thống bằng công cụ chuyên dụng | Không phát hiện lỗ hổng nào ở mức độ nghiêm trọng từ cấp độ 3 trở lên | |
| VHT-I07 | Mã hóa truyền dẫn (dòng 550) | Môi trường vận hành thử | Kiểm tra cấu hình TLS của toàn bộ endpoint công khai | Tối thiểu TLS 1.2, bộ mã hóa an toàn | |

## IV. Bảng tổng hợp phạm vi phủ

| Nhóm | Số mục HSMT | Số ca kiểm thử tương ứng |
|---|---|---|
| Nhóm I — Quản trị hệ thống | 4 (mục 1–4) | 4 (VHT-A01–A04) |
| Nhóm II–III — Cập nhật cá nhân, Danh mục | 6 (mục 5–10) | 3 (VHT-B01–B03) |
| Nhóm IV–V — Lấy ý kiến, Tài liệu cá nhân | 6 (mục 11–16) | 2 (VHT-C01–C02) |
| Nhóm VI — Thông tin cuộc họp | 8 (mục 17–24) | 6 (VHT-D01–D06) |
| Nhóm VII — Tổ chức cuộc họp | 27 (mục 25–51) | 15 (VHT-E01–E15) |
| Nhóm VIII–IX — Thống kê, API | 8 (mục 52–59) | 3 (VHT-F01–F03) |
| Nhóm B — Di động | 38 (mục 60–97) | 5 (VHT-G01–G05, đại diện theo cụm nghiệp vụ) |
| Hiệu năng/SLA | Theo bảng SLA | 8 (VHT-H01–H08) |
| An toàn thông tin | Theo mục 3.1–3.7 | 7 (VHT-I01–I07) |
| **Tổng** | **97 mục chức năng + toàn bộ SLA/ATTT** | **53 ca kiểm thử** |

## V. Mẫu Báo cáo kết quả vận hành thử

*(Lập sau khi hoàn thành toàn bộ các ca kiểm thử tại Mục III, theo đúng dòng 258–259 HSMT)*

---

**BÁO CÁO KẾT QUẢ VẬN HÀNH THỬ**
Gói thầu: Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu
Thời gian thực hiện: từ ..../..../..... đến ..../..../.....
Địa điểm: .....................................

**Thành phần tham gia:**
- Đại diện Chủ đầu tư: .....................................
- Đại diện đơn vị giám sát (nếu có): .....................................
- Đại diện Trung tâm Công nghệ thông tin: .....................................
- Đại diện Nhà thầu: .....................................

**Tổng hợp kết quả:**

| Nhóm | Số ca đạt | Số ca không đạt | Số ca không thực hiện được (lý do) |
|---|---|---|---|
| Nhóm I–IX (chức năng) | | | |
| Nhóm B (di động) | | | |
| Hiệu năng/SLA | | | |
| An toàn thông tin | | | |

**Danh sách ca không đạt và kiến nghị xử lý:**

| Mã ca | Nội dung không đạt | Nguyên nhân | Kiến nghị/kế hoạch khắc phục | Thời hạn khắc phục |
|---|---|---|---|---|
| | | | | |

**Kết luận của các bên tham gia:**
☐ Đủ điều kiện đề nghị nghiệm thu, đưa vào sử dụng
☐ Yêu cầu Nhà thầu tiếp tục chỉnh sửa, bổ sung, hoàn thiện theo danh sách trên, thực hiện vận hành thử bổ sung trước khi nghiệm thu

**Chữ ký xác nhận các bên:**

| Đại diện Chủ đầu tư | Đại diện giám sát | Đại diện Nhà thầu |
|---|---|---|
| (Ký, ghi rõ họ tên) | (Ký, ghi rõ họ tên) | (Ký, ghi rõ họ tên) |
