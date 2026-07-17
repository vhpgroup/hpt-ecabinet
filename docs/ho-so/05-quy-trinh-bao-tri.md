# QUY TRÌNH BẢO TRÌ HỆ THỐNG

**Gói thầu:** Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu
**Sản phẩm:** Phần mềm eCabinet
**Đơn vị lập:** [Tên đầy đủ pháp nhân HPT TECH]

## Căn cứ

- E-HSMT Chương V, mục "Yêu cầu về bảo trì": *"Nội dung về bảo trì phần mềm yêu cầu đảm bảo đáp ứng các nội dung chủ yếu được quy định tại Phụ lục số 12, Thông tư 18/2024/TT-BTTTT ngày 30/12/2024 của Bộ trưởng Bộ Thông tin và Truyền thông"* (`docs/hsmt-chuong-v.md` dòng 225–253).
- Mục "Yêu cầu đối với bảo trì, cập nhật phần mềm": *"Hầu hết việc bảo trì phần mềm sẽ được thực hiện trong nội bộ của nhà cung cấp dịch vụ"* (dòng 629–630).
- Mục "Yêu cầu về sao lưu, phục hồi dữ liệu" (dòng 592–597).

Quy trình gồm 4 nội dung theo đúng cấu trúc HSMT: (I) Bảo đảm thực hiện bảo trì; (II) Nội dung công việc chung; (III) Nội dung công việc bảo trì/duy trì/cập nhật phần mềm; (IV) Bảo đảm an toàn thông tin mạng.

---

## I. CÁC CÔNG VIỆC ĐỂ BẢO ĐẢM THỰC HIỆN BẢO TRÌ

**Căn cứ:** HSMT dòng 228–229.

1. Bố trí, sắp xếp nhân lực thực hiện bảo trì: tối thiểu 01 kỹ thuật viên phụ trách bảo trì hệ thống, có thể kiêm nhiệm với nhân sự vận hành (Quy trình 1 và 2 tại `docs/ho-so/04-quy-trinh-quan-tri-van-hanh.md`), bảo đảm không xung đột lịch trực.
2. Lập kế hoạch bảo trì hằng năm, trình Sở Khoa học và Công nghệ thống nhất trước khi thực hiện (nội dung: hạng mục bảo trì, thời gian dự kiến, mức độ ảnh hưởng đến người sử dụng, biện pháp giảm thiểu gián đoạn).
3. Chuẩn bị đầy đủ công cụ, môi trường thử nghiệm (staging) trước khi thực hiện các thay đổi trên môi trường sản xuất, hạn chế tối đa rủi ro gây gián đoạn dịch vụ (liên quan trực tiếp cam kết SLA "≤3 lần gián đoạn/năm" tại `docs/ho-so/02-cam-ket-sla.md`).

## II. NỘI DUNG CÔNG VIỆC CHUNG

**Căn cứ:** HSMT dòng 231–235.

| # | Nội dung | Chu kỳ thực hiện | Trách nhiệm |
|---|---|---|---|
| 1 | Kiểm tra thường xuyên, định kỳ và đột xuất phục vụ việc bảo trì | Định kỳ hằng tuần (kiểm tra thường xuyên); hằng quý (kiểm tra định kỳ toàn diện); ngay khi có dấu hiệu bất thường (đột xuất) | Quản trị viên kỹ thuật |
| 2 | Bảo đảm an toàn thông tin mạng | Liên tục, chi tiết tại Mục IV | Quản trị viên an toàn thông tin |
| 3 | Bảo trì theo kế hoạch bảo trì hằng năm đã được thống nhất | Theo kế hoạch năm, thông báo trước tối thiểu 03 ngày làm việc cho các đơn vị sử dụng đối với hạng mục có khả năng ảnh hưởng dịch vụ | Quản trị viên kỹ thuật |
| 4 | Tối ưu hóa, cấu hình hệ thống thông tin để bảo đảm hiệu năng, an toàn thông tin mạng; sửa chữa hệ thống định kỳ và đột xuất nếu có sự cố hoặc theo yêu cầu | Định kỳ hằng quý (rà soát tối ưu); đột xuất khi có sự cố/yêu cầu | Quản trị viên kỹ thuật |

## III. NỘI DUNG CHÍNH CÔNG VIỆC BẢO TRÌ, DUY TRÌ, CẬP NHẬT PHẦN MỀM

**Căn cứ:** HSMT dòng 237–246 (áp dụng nội dung "đối với phần mềm nội bộ" cho phần mềm eCabinet triển khai tập trung tại Trung tâm dữ liệu thành phố).

| # | Nội dung | Chu kỳ | Công cụ/Phương pháp |
|---|---|---|---|
| 1 | Kiểm tra, theo dõi hiện trạng hoạt động của phần mềm | Liên tục (giám sát tự động) + rà soát thủ công hằng tuần | Công cụ giám sát hiệu năng ứng dụng, nhật ký hệ thống |
| 2 | Sao lưu cơ sở dữ liệu, mã nguồn định kỳ hoặc khi xảy ra sự cố/nâng cấp phần mềm | CSDL: hằng ngày (gia tăng), hằng tuần (toàn bộ); mã nguồn: mỗi lần phát hành phiên bản mới | Công cụ sao lưu tự động, lưu trữ có mã hóa |
| 3 | Kiểm tra tính toàn vẹn các cơ sở dữ liệu sau khi sao lưu | Ngay sau mỗi lần sao lưu | Đối soát checksum, thử phục hồi mẫu định kỳ hằng quý |
| 4 | Kiểm tra, sửa chữa các lỗi cơ sở dữ liệu; sao lưu dữ liệu định kỳ | Khi phát hiện lỗi; định kỳ theo lịch sao lưu | Công cụ quản trị CSDL |
| 5 | Sửa lỗi phần mềm trong phạm vi các chức năng đã có của phần mềm | Theo mức độ ưu tiên sự cố (khẩn cấp: trong 24 giờ; thông thường: trong kỳ phát hành gần nhất) | Quy trình quản lý thay đổi, môi trường staging trước khi đưa lên sản xuất |
| 6 | Hỗ trợ cập nhật các bản nâng cấp, vá lỗi phần mềm | Theo lịch phát hành hoặc ngay khi có bản vá bảo mật khẩn cấp | Quy trình triển khai có kiểm thử trước, thông báo trước cho người dùng |
| 7 | Kiểm tra hiệu suất và khả năng chịu tải của phần mềm | Định kỳ hằng quý, hoặc trước mỗi lần nâng cấp lớn | Kiểm thử tải (load test), đối chiếu với ngưỡng 500 người dùng/90 đồng thời |
| 8 | Thiết lập, tối ưu hóa hệ cơ sở dữ liệu của phần mềm | Định kỳ hằng quý | Rà soát chỉ mục (index), tối ưu câu truy vấn chậm |
| 9 | Hỗ trợ kỹ thuật trong việc cài đặt phần mềm | Khi có yêu cầu (mở rộng đơn vị sử dụng, cài đặt môi trường mới) | Hướng dẫn cài đặt kèm theo tài liệu kỹ thuật |
| 10 | Kiểm tra và cập nhật các bản vá lỗi, bản vá lỗ hổng an toàn thông tin đối với hệ điều hành, hệ quản trị cơ sở dữ liệu, máy chủ web (webserver) và các thành phần cấu thành hệ thống | Định kỳ hằng tháng (rà soát bản vá); ngay khi có bản vá bảo mật mức nghiêm trọng cao | Quy trình quản lý bản vá (patch management), thử nghiệm trên staging trước khi áp dụng sản xuất |

## IV. CÁC NỘI DUNG VỀ BẢO ĐẢM AN TOÀN THÔNG TIN MẠNG

**Căn cứ:** HSMT dòng 248–252, đồng bộ với yêu cầu an toàn thông tin Cấp độ 3 (Nghị định 85/2016/NĐ-CP, Thông tư 12/2022/TT-BTTTT).

| # | Nội dung | Chu kỳ | Ghi chú |
|---|---|---|---|
| 1 | Kiểm tra, đánh giá hiệu quả của các biện pháp bảo đảm an toàn thông tin theo phương án đã được phê duyệt | Định kỳ hằng năm, hoặc theo yêu cầu của cơ quan quản lý nhà nước về an toàn thông tin | Đối chiếu với phương án bảo đảm an toàn thông tin Cấp độ 3 đã lập |
| 2 | Kiểm tra, đánh giá phát hiện mã độc, lỗ hổng, điểm yếu, thử nghiệm xâm nhập hệ thống (pentest) theo quy định pháp luật an toàn thông tin mạng | Định kỳ hằng năm (tối thiểu 01 lần/năm) bằng đơn vị có chức năng đánh giá độc lập; đột xuất khi có dấu hiệu bất thường | Kết quả không được có lỗ hổng mức nghiêm trọng từ cấp độ 3 trở lên (đúng cam kết SLA tại `docs/ho-so/02-cam-ket-sla.md` mục 1 dòng 17) |
| 3 | Duy trì, gia hạn bản quyền, nâng cấp sản phẩm, dịch vụ an toàn thông tin mạng (tường lửa, phần mềm phòng chống mã độc, công cụ giám sát an toàn thông tin...) để đáp ứng yêu cầu bảo đảm an toàn thông tin | Liên tục, theo dõi hạn bản quyền, gia hạn trước khi hết hạn tối thiểu 30 ngày | Có danh mục theo dõi bản quyền/hạn dùng các sản phẩm ATTT |
| 4 | Các công việc cần thiết khác nhằm bảo đảm an toàn thông tin mạng cho hệ thống | Theo yêu cầu phát sinh | — |

## V. Bảng tổng hợp chu kỳ bảo trì (tổng hợp toàn bộ để dễ theo dõi)

| Hạng mục | Hằng ngày | Hằng tuần | Hằng tháng | Hằng quý | Hằng năm |
|---|---|---|---|---|---|
| Giám sát tình trạng hoạt động | ✓ | | | | |
| Sao lưu dữ liệu | ✓ (gia tăng) | ✓ (toàn bộ) | | | |
| Rà soát bản vá bảo mật OS/DB/webserver | | | ✓ | | |
| Tối ưu CSDL, kiểm tra hiệu suất/chịu tải | | | | ✓ | |
| Thử phục hồi từ bản sao lưu (test restore) | | | | ✓ | |
| Đánh giá hiệu quả phương án ATTT | | | | | ✓ |
| Quét lỗ hổng/thử nghiệm xâm nhập (pentest) | | | | | ✓ (tối thiểu) |
| Lập kế hoạch bảo trì năm tiếp theo | | | | | ✓ |

## VI. Biểu mẫu áp dụng

- Kế hoạch bảo trì hằng năm (Biểu 13) — trình Sở Khoa học và Công nghệ thống nhất trước ngày 15/12 hằng năm cho năm kế tiếp.
- Nhật ký thực hiện bảo trì (Biểu 14) — ghi nhận từng lần thực hiện, người thực hiện, kết quả.
- Báo cáo kết quả quét lỗ hổng/pentest hằng năm (Biểu 15).
- Nội dung thực hiện bảo trì trong kỳ được tổng hợp vào Báo cáo dịch vụ định kỳ 6 tháng (`docs/ho-so/02-cam-ket-sla.md` Mục III, phần "Công tác hỗ trợ, đào tạo, bảo trì trong kỳ").

---

**ĐẠI DIỆN NHÀ THẦU**
[Chức vụ]

[Họ tên]
*(Ký, ghi rõ họ tên, đóng dấu)*
