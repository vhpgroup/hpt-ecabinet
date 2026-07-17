CÔNG TY [Tên đầy đủ pháp nhân HPT TECH]
Số: [Số văn bản]/CV-HPT

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập – Tự do – Hạnh phúc

Hải Phòng, ngày [Ngày ký]

# VĂN BẢN CAM KẾT MỨC CHẤT LƯỢNG DỊCH VỤ (SLA)

**Kính gửi:** Sở Khoa học và Công nghệ thành phố Hải Phòng

**Về:** Gói thầu "Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu" — sản phẩm dự thầu: phần mềm eCabinet

---

## I. Căn cứ lập cam kết

- Bảng "Yêu cầu kỹ thuật dựa trên chất lượng của dịch vụ" — E-HSMT Chương V, các tiêu chí 1 đến 6 (`docs/hsmt-chuong-v.md` dòng 54–120).
- Mục "Các yêu cầu cần đáp ứng về thời gian xử lý, độ phức tạp xử lý của các phần mềm" (dòng 531–535).
- Mục "Yêu cầu đối với hỗ trợ kỹ thuật" — thời gian trực quản trị, trực tổng đài (dòng 605–619).
- Mục "Yêu cầu về báo cáo kết quả cung cấp dịch vụ" — báo cáo định kỳ 06 tháng (dòng 621–623).
- Mục "Yêu cầu kiểm tra, đánh giá chất lượng dịch vụ trong giai đoạn thuê dịch vụ" (dòng 657–659).
- TT 18/2024/TT-BTTTT (Phụ lục 11, 12); TT 16/2024/TT-BTTTT (Phụ lục II); Nghị định 45/2026/NĐ-CP.

## II. Nội dung cam kết

[Tên đầy đủ pháp nhân HPT TECH] cam kết với Sở Khoa học và Công nghệ thành phố Hải Phòng thực hiện đầy đủ, không vi phạm các chỉ tiêu chất lượng dịch vụ dưới đây trong suốt 60 tháng thuê dịch vụ, kể từ ngày nghiệm thu, bàn giao đưa dịch vụ vào sử dụng.

### 1. Bảng cam kết chỉ tiêu định lượng (SLA)

| # | Chỉ tiêu | Ngưỡng cam kết (nguyên văn HSMT) | Căn cứ (dòng) | Cơ chế đo lường |
|---|---|---|---|---|
| 1 | Thời gian đáp ứng thao tác người dùng | Trung bình **dưới 5 giây** khi vận hành thực tế | 62, 531 | Đo bằng công cụ giám sát hiệu năng ứng dụng (APM) ghi nhận thời gian phản hồi API theo từng loại thao tác; lấy trung bình theo tuần, báo cáo trong báo cáo dịch vụ 6 tháng |
| 2 | Tốc độ tra cứu, tìm kiếm đa điều kiện | **Dưới 30 giây** | 62, 532 | Đo thời gian phản hồi của các API tra cứu/tìm kiếm (tra cứu cuộc họp, tra cứu tài liệu, tra cứu văn bản lấy ý kiến) qua log hệ thống và công cụ giám sát |
| 3 | Thời gian kết xuất báo cáo tổng hợp quy mô lớn (nhiều năm, toàn thành phố) | **Dưới 5 phút**, không lỗi timeout | 533 | Đo thời gian thực thi tác vụ xuất báo cáo; kiểm thử định kỳ với tập dữ liệu mô phỏng theo quy mô tăng trưởng thực tế |
| 4 | Cảnh báo khi có độ trễ | Khi độ trễ **trên 10 giây**, hệ thống hiển thị thông báo/biểu tượng cho người dùng biết hệ thống vẫn đang xử lý | 534 | Kiểm tra bằng kịch bản kiểm thử giao diện (UI test) trong vận hành thử và kiểm tra định kỳ |
| 5 | Quy mô người dùng | Đáp ứng tối thiểu **500 người sử dụng**, trong đó **90 người sử dụng đồng thời** tại một thời điểm | 62, 535 | Kiểm thử tải (load test) trước vận hành thử; giám sát số kết nối đồng thời (CCU) thực tế trong vận hành, cảnh báo khi vượt 80% ngưỡng đã kiểm thử |
| 6 | Khả năng mở rộng | Mở rộng **không giới hạn** số người sử dụng | 63 | Thiết kế kiến trúc cho phép scale ngang (thêm node xử lý) khi nhu cầu vượt ngưỡng ban đầu, không cần thay đổi cấu trúc dữ liệu |
| 7 | Số lần gián đoạn dịch vụ | Tối đa **03 lần/năm** | 91 | Ghi nhận qua hệ thống giám sát uptime tập trung (giám sát 24/7); mỗi lần gián đoạn được lập biên bản, tính vào báo cáo 6 tháng |
| 8 | Khoảng cách giữa hai lần gián đoạn liên tiếp | Tối thiểu **04 tháng** | 92 | Theo dõi qua nhật ký sự cố (incident log), đối chiếu mốc thời gian |
| 9 | Thời gian phục hồi sau sự cố | **24 giờ** kể từ thời điểm xảy ra sự cố | 93 | Đo từ thời điểm ghi nhận sự cố (theo nhật ký giám sát) đến thời điểm dịch vụ hoạt động trở lại bình thường (theo nhật ký khôi phục) |
| 10 | Tỷ lệ phục hồi dịch vụ sau khắc phục | **100%** dịch vụ được phục hồi | 94 | Kiểm tra chức năng toàn diện (checklist) sau mỗi lần khôi phục, xác nhận bằng biên bản |
| 11 | Tỷ lệ phục hồi thành phần/dữ liệu | **100%** thành phần, dữ liệu được phục hồi | 95 | Đối soát dữ liệu trước/sau sự cố; kiểm tra tính toàn vẹn (checksum, đối soát số bản ghi) |
| 12 | Thời gian phân tích nguyên nhân sự cố | Xác định nguyên nhân và đưa ra hướng dẫn khắc phục trong **08 giờ** kể từ khi sự cố xảy ra | 97 | Nhật ký xử lý sự cố (incident ticket) ghi mốc thời gian phát hiện — mốc thời gian có báo cáo nguyên nhân/hướng dẫn khắc phục |
| 13 | Thời gian trực hỗ trợ quản trị hệ thống | **24/7** (24 giờ/ngày, 7 ngày/tuần) | 615 | Bảng phân ca trực quản trị, có xác nhận của người trực từng ca; ghi nhận qua hệ thống ticket có timestamp |
| 14 | Thời gian trực tổng đài hỗ trợ | **Theo giờ hành chính** | 618 | Bảng phân ca trực tổng đài, số điện thoại/kênh hỗ trợ công bố cho Sở và các đơn vị sử dụng |
| 15 | Định dạng tệp tuân thủ quy định | Tuân thủ TT 39/2017/TT-BTTTT | 80 | Kiểm tra định kỳ danh mục định dạng tệp nhập/xuất/lưu trữ đối chiếu với danh mục định dạng chuẩn của thông tư |
| 16 | Truyền dẫn dữ liệu an toàn | HTTPS/TLS **1.2 trở lên** | 550 | Kiểm tra cấu hình chứng chỉ, bộ mã hóa (cipher suite) định kỳ; quét bằng công cụ kiểm tra TLS |
| 17 | Bảo mật — không lỗ hổng nghiêm trọng | Không lỗ hổng nào bị đánh giá mức độ nghiêm trọng **từ cấp độ 3 trở lên** khi quét bằng phần mềm chuyên dụng | 65–66 | Quét định kỳ bằng công cụ đánh giá lỗ hổng an toàn thông tin (theo lịch quy định tại `docs/ho-so/05-quy-trinh-bao-tri.md`), lập báo cáo kết quả |
| 18 | Truy xuất nguồn gốc | Lưu vết và tra cứu được mọi hành động của người sử dụng | 69 | Nhật ký hệ thống (audit log) ghi nhận mọi thao tác, có chức năng tra cứu theo tài khoản/thời gian |
| 19 | Báo cáo dịch vụ định kỳ | **06 tháng/lần**, hoặc đột xuất khi có yêu cầu | 622 | Lập theo mẫu tại Mục III văn bản này, gửi cho Chủ đầu tư đúng kỳ |

### 2. Cam kết về công tác hỗ trợ kỹ thuật, vận hành

Theo dòng 605–619 HSMT, Nhà thầu cam kết bố trí nhân sự thực hiện đầy đủ các nội dung sau trong suốt thời gian thuê dịch vụ:

- Thực hiện các tính năng, chức năng quản trị, vận hành hệ thống;
- Quản lý, hỗ trợ các đơn vị khai thác, sử dụng hệ thống đúng quy định, đúng quy trình đã ban hành;
- Theo dõi hoạt động vật lý, tình trạng mạng, điện của các thiết bị trong sơ đồ hạ tầng (phối hợp với đơn vị quản lý Trung tâm dữ liệu thành phố theo phân định trách nhiệm tại `docs/ho-so/04-quy-trinh-quan-tri-van-hanh.md` mục 1);
- Theo dõi tải hoạt động của thiết bị, ứng dụng; đề xuất biện pháp tối ưu, nâng cấp khi cần thiết;
- Theo dõi hoạt động an toàn thông tin, phòng chống tấn công, chống thay đổi dữ liệu trái phép;
- Xử lý sự cố và các yêu cầu phát sinh khác trong quá trình vận hành;
- Bố trí nhân sự có chuyên môn, kinh nghiệm trực tổng đài tiếp nhận sự cố, hỗ trợ đơn vị sử dụng thực hiện các chức năng phần mềm;
- Giải đáp thắc mắc của người dùng, xử lý các sự cố khác.

### 3. Chế tài khi không đạt SLA

Trường hợp không đạt một hoặc nhiều chỉ tiêu cam kết tại Mục II.1 văn bản này trong kỳ đánh giá, Nhà thầu:
- Có trách nhiệm giải trình nguyên nhân bằng văn bản với Chủ đầu tư trong vòng 05 ngày làm việc kể từ khi được yêu cầu;
- Đề xuất biện pháp khắc phục và thời hạn khắc phục cụ thể;
- Chấp nhận các hình thức xử lý theo thỏa thuận cụ thể trong hợp đồng thuê dịch vụ (nhắc nhở, yêu cầu khắc phục có thời hạn, hoặc các chế tài khác do hai bên thống nhất khi ký hợp đồng), phù hợp với quy định tại dòng 658 HSMT: *"Với mỗi tiêu chí được đánh giá, kết quả thể hiện giá trị đạt/không đạt"* và trách nhiệm *"tiếp thu và cải thiện chất lượng cung cấp dịch vụ theo quy định của Hợp đồng"* (dòng 659).

## III. Mẫu Báo cáo dịch vụ định kỳ 6 tháng

*(Nhà thầu lập và gửi Chủ đầu tư trong vòng 10 ngày làm việc sau khi kết thúc mỗi kỳ 6 tháng, theo dòng 622 HSMT)*

---

**BÁO CÁO KẾT QUẢ CUNG CẤP DỊCH VỤ**
Kỳ báo cáo: từ ngày ..../..../..... đến ngày ..../..../.....
Gói thầu: Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu

**1. Tình hình sử dụng hệ thống**

| Chỉ số | Số liệu kỳ này | Số liệu kỳ trước | Ghi chú |
|---|---|---|---|
| Số đơn vị (xã/phường/đặc khu) đang sử dụng | | | |
| Số tài khoản đang hoạt động | | | |
| Số người dùng đồng thời cao nhất (CCU) ghi nhận | | | So với ngưỡng cam kết 90 CCU |
| Số phiên họp đã tổ chức | | | |
| Số văn bản lấy ý kiến đã xử lý | | | |

**2. Kết quả đo các chỉ tiêu SLA**

| # | Chỉ tiêu | Ngưỡng cam kết | Kết quả đo kỳ này | Đạt/Không đạt |
|---|---|---|---|---|
| 1 | Thời gian đáp ứng thao tác trung bình | < 5 giây | | |
| 2 | Thời gian tra cứu, tìm kiếm | < 30 giây | | |
| 3 | Thời gian kết xuất báo cáo tổng hợp | < 5 phút | | |
| 4 | Số lần gián đoạn dịch vụ trong kỳ | ≤ 3 lần/năm (quy đổi theo kỳ) | | |
| 5 | Thời gian phục hồi trung bình sau sự cố | ≤ 24 giờ | | |
| 6 | Tỷ lệ phục hồi dữ liệu/thành phần | 100% | | |
| 7 | Thời gian phân tích nguyên nhân sự cố trung bình | ≤ 8 giờ | | |
| 8 | Số lỗ hổng an toàn thông tin mức ≥ cấp độ 3 phát hiện | 0 | | |

**3. Danh sách sự cố phát sinh trong kỳ**

| # | Thời điểm xảy ra | Mô tả sự cố | Thời gian phát hiện nguyên nhân | Thời gian phục hồi | Biện pháp khắc phục |
|---|---|---|---|---|---|
| | | | | | |

**4. Công tác hỗ trợ, đào tạo, bảo trì trong kỳ**
- Số yêu cầu hỗ trợ đã tiếp nhận/đã xử lý: ..................
- Công tác bảo trì đã thực hiện (theo `docs/ho-so/05-quy-trinh-bao-tri.md`): ..................
- Ý kiến phản hồi của người sử dụng (tổng hợp): ..................

**5. Kiến nghị, đề xuất**
..................................................................

---

**ĐẠI DIỆN NHÀ THẦU**
[Chức vụ]

[Họ tên]
*(Ký, ghi rõ họ tên, đóng dấu)*
