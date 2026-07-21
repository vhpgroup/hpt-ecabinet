# eCabinet — Phần mềm Phòng họp không giấy
*Tài liệu giới thiệu sản phẩm · HPT TECH · cập nhật 21/07/2026*

## eCabinet là gì?
**eCabinet** là phần mềm họp không giấy theo mô hình phòng họp điện tử của Chính phủ, giúp cơ quan nhà nước **tin học hóa và số hóa toàn bộ quy trình chuẩn bị, tổ chức và kết thúc cuộc họp**. Cán bộ chuẩn bị và duyệt tài liệu, gửi giấy mời điện tử, điểm danh, phát biểu, chất vấn, biểu quyết, lấy ý kiến bằng văn bản và ký số biên bản ngay trên hệ thống — rút ngắn thời gian, tiết kiệm giấy in, tăng minh bạch và phù hợp định hướng chính quyền số.

**Dành cho:** UBND xã/phường/đặc khu, sở ngành và các cơ quan nhà nước tổ chức họp thường xuyên.

## Trọn vòng đời một phiên họp
1. **Chuẩn bị** — Tạo phiên họp, gửi giấy mời điện tử, xác nhận/ủy quyền tham dự, chuẩn bị & trình duyệt tài liệu (kèm tài liệu mật).
2. **Điều hành** — Điểm danh (QR/thư ký), sơ đồ chỗ ngồi, đăng ký phát biểu, chất vấn, điều phối chương trình theo thời gian.
3. **Quyết nghị** — Biểu quyết công khai/kín, kết quả cột phần trăm trực tiếp; lấy ý kiến bằng văn bản ngoài phiên họp kèm ký số.
4. **Kết thúc** — Tự sinh dự thảo biên bản đúng thể thức, ký số, khóa biên bản; giao và theo dõi nhiệm vụ sau họp.

## Tính năng nổi bật
| Nhóm | Mô tả |
|---|---|
| **Lịch & giấy mời** | Lịch công tác tháng của đơn vị/cá nhân; giấy mời điện tử, xác nhận tham dự, báo vắng, ủy quyền, mời khách. |
| **Quản lý tài liệu** | Tài liệu theo mục chương trình, đánh dấu Mật, phiên bản, quy trình trình–duyệt, ghi chú cá nhân & góp ý công khai. |
| **Biểu quyết & lấy ý kiến** | Biểu quyết kín/công khai, tổng hợp trực tiếp; phiếu xin ý kiến bằng văn bản có hạn phản hồi và nhắc việc. |
| **Phát biểu & chất vấn** | Đăng ký phát biểu theo hàng đợi; điều hành phiên chất vấn, hiển thị người đang chất vấn trên màn hình lớn. |
| **Biên bản & ký số** | Tự sinh dự thảo biên bản đúng thể thức NĐ 30/2020, ghi biên bản bằng giọng nói tiếng Việt, ký số & khóa biên bản. |
| **Họp trực tuyến** | Điểm cầu video tích hợp (WebRTC/LiveKit): hình ảnh, âm thanh, chia sẻ màn hình, chia sẻ tài liệu đang thảo luận. |
| **Màn hình phòng họp** | Trình chiếu toàn màn hình: nội dung thảo luận, người phát biểu, kết quả biểu quyết trực tiếp, QR điểm danh. |
| **Nhiệm vụ sau họp** | Giao việc từ kết luận, gán người phụ trách, hạn xử lý, cập nhật tiến độ và cảnh báo quá hạn. |
| **Báo cáo thống kê** | Số phiên họp theo tháng, tỷ lệ tham dự, lượt biểu quyết, nhiệm vụ, ước tính giấy và chi phí tiết kiệm. |

## Phân hệ quản trị
- **5 vai trò**: Quản trị hệ thống · Chủ trì · Thư ký · Thành viên dự họp · Quản trị đơn vị.
- Quản lý đơn vị (xã/phường/đặc khu), phòng họp, sơ đồ chỗ ngồi cấu hình được.
- Quản trị danh mục (chức vụ, loại phiên họp, cơ quan ban hành, loại tài liệu); tài liệu hướng dẫn sử dụng theo vai trò; nhật ký hệ thống.
- API công bố & đấu nối LGSP cho hệ thống dùng chung của tỉnh/thành.

## An toàn & tin cậy
- Cô lập dữ liệu theo đơn vị — mỗi xã/phường chỉ thấy dữ liệu của mình.
- Tài liệu mật, phiếu kín ẩn danh, khóa biên bản đã ký (bất biến).
- Đăng nhập JWT + phiên xoay vòng, phân quyền phía máy chủ, chống mất phiếu biểu quyết.
- Sao lưu – phục hồi định kỳ, quy trình khắc phục sự cố (DR).
- Sẵn sàng mở rộng: nhiều máy chủ sau cân bằng tải, lưu trữ tệp tách riêng.

## Nền tảng công nghệ
| Thành phần | Công nghệ |
|---|---|
| Giao diện | React 18 + TypeScript — một mã nguồn cho Web, PWA, Android, iOS (Capacitor). Hỗ trợ Chrome, Edge, Firefox, Cốc Cốc. |
| Máy chủ | ASP.NET Core 8 (.NET 8) + Microsoft SQL Server 2022 trên Windows Server — đúng yêu cầu nền tảng HSMT. |
| Thời gian thực | WebSocket đẩy sự kiện tức thời; sẵn sàng chạy nhiều máy chủ đồng bộ (Redis backplane). |
| Họp trực tuyến | WebRTC qua LiveKit (SFU); có thể tự vận hành trong Trung tâm dữ liệu. |
| Lưu trữ tệp | Object storage (tách khỏi CSDL) theo mô hình cụm máy chủ tệp riêng. |
| Triển khai | CSDL tập trung tại TTDL thành phố; kiến trúc nhiều cụm (Web/Ứng dụng/CSDL/Tệp) + cân bằng tải + dự phòng. |

## Tuân thủ tiêu chuẩn
Thể thức văn bản **NĐ 30/2020** · Định dạng tệp **TT 39/2017** · Unicode **TCVN 6909:2001** · Vận hành thử **TT 16/2024** · Hướng tới **ATTT cấp độ 3** · Sẵn sàng đấu nối **LGSP/IOC** · Kết nối, chia sẻ dữ liệu theo quy định hiện hành.

> **Ghi chú trung thực:** Chữ ký số trên biên bản hỗ trợ đầy đủ quy trình ký; việc tích hợp chữ ký số chuyên dùng Chính phủ (VGCA/SmartCA) và hoàn thiện hồ sơ an toàn thông tin cấp độ 3 được thực hiện trong giai đoạn chuẩn bị dịch vụ cùng đơn vị có thẩm quyền.

---
© 2026 HPT TECH — eCabinet (xây dựng theo mô hình chức năng phòng họp không giấy VNPT eCabinet).
