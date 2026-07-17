# BÁO CÁO PHÂN TÍCH NGHIỆP VỤ (GAP ANALYSIS) — E-HSMT vs eCabinet
### Gói thầu: "Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu" — Sở KH&CN TP Hải Phòng
**Nguồn phân tích:** Phụ lục 01 Chương V (Yêu cầu kỹ thuật chi tiết), 1.413 dòng / ~80.400 ký tự — đã đọc toàn bộ.
**Ngày lập:** 2026-07-17 | **Mục đích:** Hỗ trợ quyết định BID / NO-BID.

> **Lưu ý trung thực:** Báo cáo đối chiếu thẳng thắn với năng lực eCabinet hiện tại. eCabinet là **web app React+TS / Node + PostgreSQL**, nhiều tính năng nghiệp vụ mạnh nhưng có 3 điểm chặn lớn: (1) **HSMT chỉ định nền tảng .NET + MS SQL Server + Windows Server** — trái với stack hiện tại; (2) **chưa có app native Android/iOS**; (3) **chưa có ký số PKI thật, chưa có hồ sơ ATTT cấp độ 3, là sản phẩm mới chưa có hợp đồng tương tự**.

---

## 1. TÓM TẮT GÓI THẦU

| Hạng mục | Nội dung (trích HSMT) |
|---|---|
| **Chủ đầu tư** | Sở Khoa học và Công nghệ thành phố Hải Phòng |
| **Đơn vị sử dụng** | Các xã, phường, đặc khu (đơn vị hành chính đặc thù) trên địa bàn TP Hải Phòng |
| **Phạm vi** | 01 gói: "Thuê phần mềm Họp không giấy tờ…" (Đơn vị tính: Gói; Số lượng: 01). *HSMT KHÔNG ghi số lượng xã/phường/tài khoản cụ thể trong phần kỹ thuật.* |
| **Quy mô người dùng (CCU)** | Tối thiểu **500 người sử dụng**, trong đó **90 người dùng đồng thời (concurrent)** tại một thời điểm. Yêu cầu **mở rộng không giới hạn** số người dùng. |
| **Mô hình thuê** | Thuê dịch vụ CNTT (sản phẩm sẵn có trên thị trường); hợp đồng **trọn gói**; đấu thầu rộng rãi trong nước, qua mạng; một giai đoạn một túi hồ sơ; nguồn vốn NSNN |
| **Thời gian** | Chuẩn bị (cài đặt, cấu hình, tích hợp, vận hành thử, đào tạo): **tối đa 03 tháng** kể từ ngày HĐ hiệu lực. Thuê dịch vụ: **60 tháng** kể từ ngày nghiệm thu đưa vào sử dụng |
| **Địa điểm triển khai** | Cài đặt **tập trung tại Trung tâm dữ liệu / Trung tâm tích hợp dữ liệu TP Hải Phòng** (hạ tầng do TP cấp: máy chủ, HĐH, CSDL, mạng) |

### Các mốc / quy định nghiệm thu (mục E + "Yêu cầu khác")
- **Vận hành thử bắt buộc** trước khi đưa vào sử dụng (Khoản 1 Điều 58 NĐ 73/2019/NĐ-CP), có mặt giám sát + các bên liên quan; lập **Báo cáo kết quả vận hành thử**.
- Chủ đầu tư có quyền **kiểm tra bổ sung**; nếu kết quả sai → **nhà thầu chịu chi phí kiểm tra + toàn bộ chi phí sửa chữa** tới khi hoàn chỉnh.
- Việc **kết nối với IOC** và đưa vào sử dụng chính thức **chỉ sau khi vận hành thử ổn định** và được Chủ đầu tư chấp thuận nghiệm thu.
- Nghiệm thu theo **NĐ 45/2026/NĐ-CP**, **TT 16/2024/TT-BTTTT**; vận hành thử theo Phụ lục II TT 16/2024.
- **Chế tài tiến độ:** Nếu không hoàn thành đúng hạn cam kết (trừ bất khả kháng) → **Chủ đầu tư có quyền chấm dứt hợp đồng**.

### KPI / SLA chất lượng dịch vụ chính (mục 3.1)
| Tiêu chí | Ngưỡng yêu cầu |
|---|---|
| Thời gian đáp ứng 1 thao tác | Trung bình **< 5 giây** |
| Tra cứu/tìm kiếm nhiều điều kiện | **< 30 giây** |
| Kết xuất báo cáo tổng hợp diện rộng (nhiều năm, toàn TP) | Trung bình **< 5 phút**, không timeout |
| Tải đồng thời | ≥ **500 user / 90 CCU**, mở rộng không giới hạn |
| Số lần gián đoạn cho phép | **≤ 03 lần/năm**; khoảng cách 2 sự cố ≥ **04 tháng** |
| Phục hồi sau sự cố (RTO) | **≤ 24 giờ**; phục hồi **100%** dịch vụ + **100%** dữ liệu/thành phần |
| Phân tích nguyên nhân + hướng dẫn khắc phục | **≤ 08 giờ** kể từ khi sự cố xảy ra |
| Trực hỗ trợ | **Quản trị hệ thống 24/7**; **tổng đài theo giờ hành chính**; giám sát 24/7 |
| An toàn thông tin | **ATTT cấp độ 3** (NĐ 85/2016, TT 12/2022); **không lỗ hổng mức nghiêm trọng ≥ cấp độ 3** khi quét bằng phần mềm chuyên dụng; đáp ứng **tín nhiệm mạng** |
| Định dạng tệp | Tuân thủ **TT 39/2017/TT-BTTTT**; ký tự **Unicode TCVN 6909:2001** |
| Báo cáo dịch vụ | Định kỳ **06 tháng/lần** + đột xuất khi có yêu cầu |

### Yêu cầu sở hữu & chuyển giao dữ liệu (mục 4) — RẤT QUAN TRỌNG
- **Toàn bộ thông tin, dữ liệu hình thành trong quá trình cung cấp dịch vụ thuộc sở hữu của bên thuê** (Sở KH&CN).
- Nhà cung cấp **không được chia sẻ dữ liệu cho bên thứ 3** dưới mọi hình thức nếu chưa được phép; cam kết bảo mật, tuân thủ pháp luật ATTT, **cơ yếu** và **Pháp lệnh bảo vệ bí mật nhà nước**.
- Khi **kết thúc / chấm dứt hợp đồng**: nhà cung cấp phải **chuyển giao toàn bộ dữ liệu + tài sản hình thành dưới dạng dữ liệu có thể truy xuất**, đồng thời **bảo mật cấu trúc, sơ đồ hệ thống**.
- Trong quá trình vận hành: bên thuê được cấp **tài khoản để truy cập, quản lý dữ liệu của mình**.
- Phát sinh: khi có quy định mới của Chính phủ → nhà thầu phải **nâng cấp đáp ứng trong tối đa 03 tháng**; rà soát/nâng cấp **hàng năm**. Chi phí nâng cấp ngoài phạm vi HĐ được thanh toán theo thực tế.

---

## 2. DANH MỤC YÊU CẦU CHỨC NĂNG (Mục 3.4) — ĐỐI CHIẾU eCabinet

Cấu trúc HSMT: **A. Ứng dụng nền tảng WEB** (chức năng 1–59) và **B. Ứng dụng nền tảng DI ĐỘNG** (chức năng 60–97). Ký hiệu: ✅ ĐÁP ỨNG · 🟡 MỘT PHẦN · ❌ CHƯA CÓ.

### A. NỀN TẢNG WEB

#### I. QUẢN TRỊ HỆ THỐNG
| # | Chức năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 1 | Quản lý cơ cấu tổ chức (xem/thêm/sửa/xóa) | ✅ | eCabinet có quản trị đơn vị |
| 2 | Quản lý người dùng + phân quyền (mặc định theo vai trò, thêm quyền) | ✅ | Có phân quyền 4 vai trò server-side; HSMT dùng 5 vai trò (xem mục dưới) |
| 3 | Nhật ký đăng nhập (xem theo tài khoản/thời gian, xóa) | 🟡 | Có audit log; cần bổ sung màn hình lọc theo tài khoản/thời gian + chức năng xóa log |
| 4 | Quản trị tài liệu hướng dẫn sử dụng (thêm/sửa/xóa/xem) | ❌ | Chưa có module quản lý tài liệu HDSD trong hệ thống |

#### II. CẬP NHẬT CÁ NHÂN
| # | Chức năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 5 | Đăng nhập / đăng xuất / đổi mật khẩu | ✅ | JWT + refresh sẵn có |

#### III. QUẢN TRỊ DANH MỤC
| # | Chức năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 6 | Danh mục chức vụ | 🟡 | Có khái niệm vai trò/chức danh; cần CRUD danh mục chức vụ độc lập |
| 7 | Danh mục loại phiên họp | 🟡 | Có loại phiên họp; cần chuẩn hóa thành danh mục CRUD |
| 8 | Danh mục loại tài liệu | ✅ | Có phân loại chính/tham khảo/cá nhân |
| 9 | Danh mục phòng họp + **cập nhật sơ đồ phòng họp** | 🟡 | Có quản lý phòng họp; **sơ đồ phòng họp/vị trí chỗ ngồi CHƯA có** |
| 10 | Danh mục cơ quan ban hành | ❌ | Chưa có danh mục cơ quan ban hành riêng |

#### IV. QUẢN LÝ LẤY Ý KIẾN VĂN BẢN
| # | Chức năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 11 | DS văn bản lấy ý kiến (xem/tra cứu/thêm/sửa/xóa) | ✅ | eCabinet có lấy ý kiến ngoài họp bằng văn bản |
| 12 | DS văn bản **đã** lấy ý kiến + xem ý kiến | ✅ | Có tổng hợp ý kiến |
| 13 | DS văn bản **chưa** lấy ý kiến + sửa nội dung | ✅ | |

#### V. QUẢN LÝ TÀI LIỆU CÁ NHÂN
| # | Chức năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 14 | Quản lý thư mục tài liệu | 🟡 | Có tài liệu cá nhân + ghi chú; **cấu trúc thư mục** cần bổ sung |
| 15 | Quản lý tài liệu (xem/tra cứu/xem nội dung) | ✅ | |
| 16 | Thêm mới tài liệu (tải lên) | ✅ | Tải lên hoặc soạn trực tiếp |

#### VI. QUẢN LÝ THÔNG TIN CUỘC HỌP
| # | Chức năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 17 | Quản lý cuộc họp đơn vị (thêm/sửa/xóa) | ✅ | Tạo phiên họp + chương trình nhiều mục |
| 18 | Quản lý tài liệu họp theo nhóm | ✅ | Tài liệu theo mục họp |
| 19 | Quản lý biểu quyết cuộc họp (thêm/sửa/xóa nội dung) | ✅ | Biểu quyết công khai/kín nhiều phương án |
| 20 | Quản lý người tham gia họp | ✅ | Thành phần dự họp + khách mời |
| 21 | Quản lý cuộc họp sắp diễn ra (lọc theo thời gian/đơn vị chủ trì) | ✅ | Lịch họp + lọc |
| 22 | DS cuộc họp đơn vị tham gia (lọc trạng thái/thời gian) | ✅ | |
| 23 | DS cuộc họp đơn vị chuẩn bị tài liệu | 🟡 | Có chuẩn bị tài liệu; cần view "đơn vị chuẩn bị" theo trạng thái |
| 24 | Chuẩn bị tài liệu họp + **duyệt/không duyệt tài liệu** | 🟡 | Có tải/soạn tài liệu, chia sẻ kiểm soát; **quy trình trình–duyệt tài liệu** (approve/reject) cần bổ sung theo luồng 3.4 |

#### VII. TỔ CHỨC CUỘC HỌP — VII.1 Dành cho Thành viên dự họp
| # | Chức năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 25 | Điểm danh tham dự (xem/thực hiện/xác nhận) | ✅ | Điểm danh tự/thư ký hộ/QR + realtime |
| 26 | **Ủy quyền tham gia họp** (chọn/cập nhật/xóa người ủy quyền) | ✅ | eCabinet có ủy quyền |
| 27 | Xem tiến trình cuộc họp (thời gian còn lại) | 🟡 | Có tiến trình họp; "đếm ngược thời gian còn lại" cần kiểm tra/bổ sung |
| 28 | Xem nội dung cuộc họp (tài liệu, biểu quyết, người/đơn vị tham gia) | ✅ | |
| 29 | Xem DS văn bản lấy ý kiến | ✅ | |
| 30 | Cho ý kiến văn bản + **KÝ SỐ file cho ý kiến** + gửi | 🟡 | Cho ý kiến ✅; **ký số đang MÔ PHỎNG — chưa ký PKI thật** |
| 31 | Xem chương trình tài liệu họp + **xuất ý kiến tài liệu** | 🟡 | Có góp ý trên tài liệu; "xuất ý kiến" cần bổ sung |
| 32 | Biểu quyết nội dung (đồng ý/không đồng ý/ý kiến khác) | ✅ | Atomic chống mất phiếu |
| 33 | Đăng ký phát biểu / hủy / xem DS + nội dung | ✅ | Đăng ký phát biểu kèm chủ đề |
| 34 | **Đăng ký chất vấn** / hủy / xem DS + nội dung | ❌ | eCabinet **chưa có nghiệp vụ chất vấn** riêng (khác phát biểu) |
| 35 | Ghi chú cá nhân trong cuộc họp | ✅ | |

#### VII.2 Điều hành phiên họp (Chủ tọa/Thư ký)
| # | Chức năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 36 | Xem thông tin điểm danh (số đại biểu/khách mời) + xuất DS | ✅ | Thống kê realtime; xuất DS cần kiểm tra |
| 37 | Xem DS người không tham gia + lý do | ✅ | Báo vắng lý do |
| 38 | **Khai thác sơ đồ phòng họp** + vị trí đại biểu | ❌ | Chưa có sơ đồ phòng họp trực quan/vị trí |
| 39 | Điều hành phát biểu (bắt đầu/dừng/kết thúc) | ✅ | Chủ tọa mời/kết thúc lượt |
| 40 | Duyệt DS đăng ký phát biểu (đã gọi/chưa gọi, gọi) | ✅ | |
| 41 | Điều hành biểu quyết (bắt đầu/dừng/kết thúc) | ✅ | |
| 42 | Xem đại biểu sẵn sàng biểu quyết (lọc trạng thái) | 🟡 | Có realtime biểu quyết; trạng thái "sẵn sàng/chưa sẵn sàng" cần bổ sung |
| 43 | Duyệt DS nội dung biểu quyết (bắt đầu/kết thúc) | ✅ | |
| 44 | Quản lý kết quả biểu quyết (số người, đồng ý/không) | ✅ | Kết quả % trực tiếp |
| 45 | **Điều hành chất vấn** (bắt đầu/dừng/kết thúc) | ❌ | Gắn với gap chất vấn (#34) |
| 46 | **Duyệt DS đăng ký chất vấn** (gọi) | ❌ | Gắn với gap chất vấn |
| 47 | Tổng hợp ý kiến văn bản (đã/chưa cho ý kiến) | ✅ | Tổng hợp tự động |
| 48 | Thống kê ý kiến văn bản + xuất | ✅ | |

#### VII.3 Tiện ích
| # | Chức năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 49 | Xem lịch họp cá nhân (sắp/đã kết thúc) | ✅ | Lịch họp cá nhân/đơn vị |
| 50 | Tra cứu cuộc họp (trạng thái/nội dung/thời gian/từ khóa) | ✅ | |
| 51 | Kết luận cuộc họp (thêm/sửa/xóa + đính kèm file) | ✅ | Kết luận theo mục; tự sinh dự thảo biên bản/thông báo NĐ 30/2020 (**vượt yêu cầu**) |

#### VIII. THỐNG KÊ BÁO CÁO
| # | Chức năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 52 | Thống kê theo thành viên tham gia (biểu đồ + xuất) | ✅ | Báo cáo tỷ lệ tham dự |
| 53 | Thống kê theo văn bản xin ý kiến (biểu đồ + xuất) | ✅ | |

#### IX. TÍCH HỢP VÀ CHIA SẺ DỮ LIỆU (API cho hệ thống khác)
| # | Chức năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 54 | API DS cuộc họp đơn vị sắp diễn ra | 🟡 | Có kiến trúc API nội bộ; **CHƯA có bộ API chuẩn công bố cho bên thứ 3 / LGSP** |
| 55 | API DS cuộc họp cá nhân sắp diễn ra | 🟡 | như trên |
| 56 | API DS cuộc họp đơn vị đã diễn ra | 🟡 | như trên |
| 57 | API DS cuộc họp cá nhân đã diễn ra | 🟡 | như trên |
| 58 | API lấy thông tin cuộc họp + quản lý mô tả API | 🟡 | Cần cổng quản lý & mô tả API (API catalog) |
| 59 | API tài liệu cuộc họp | 🟡 | Cần chuẩn hóa + tài liệu API |

### B. NỀN TẢNG DI ĐỘNG (chức năng 60–97) — ~38 chức năng
| Nhóm | Chức năng | Trạng thái | Ghi chú |
|---|---|---|---|
| I. Cập nhật cá nhân | 60. Đăng nhập/xuất/đổi MK trên mobile | 🟡 | eCabinet là **PWA cài được như app**, chạy trên trình duyệt mobile — **CHƯA có app native trên App Store/Google Play** |
| II. Tài liệu cá nhân | 61–62. Thư mục & tài liệu trên mobile | 🟡 | Chạy qua PWA; nghiệp vụ có nhưng không phải app native |
| III. Thông tin cuộc họp | 63–70. Cuộc họp đơn vị, tài liệu, biểu quyết, người/đơn vị tham gia, sắp diễn ra, chuẩn bị tài liệu | 🟡 | Toàn bộ nghiệp vụ có trên web/PWA; thiếu app native |
| IV.1 Trong cuộc họp (thành viên) | 71–81. Điểm danh, ủy quyền, tiến trình, nội dung, lấy ý kiến, cho ý kiến, chương trình, biểu quyết, đăng ký phát biểu, **đăng ký chất vấn**, ghi chú | 🟡 / ❌ | Phần lớn 🟡 (qua PWA); **chất vấn (80) = ❌** |
| IV.2 Điều hành (mobile) | 82–92. Điểm danh, điều hành phát biểu, duyệt phát biểu, điều hành/duyệt biểu quyết, kết quả, **điều hành chất vấn (89), duyệt chất vấn (90)**, tổng hợp/thống kê ý kiến | 🟡 / ❌ | 🟡 qua PWA; **chất vấn (89,90) = ❌** |
| IV.3 Tiện ích | 93–95. Lịch họp, tra cứu, xem kết luận | 🟡 | Có, qua PWA |
| V. Thống kê | 96–97. Thống kê thành viên / văn bản xin ý kiến (biểu đồ) | 🟡 | Có, qua PWA |

> **Đánh giá nhóm mobile:** Về **nghiệp vụ**, eCabinet đáp ứng gần như toàn bộ danh mục di động. Nhưng HSMT (mục tiêu cụ thể + tiêu đề nhóm B) ghi rõ **"triển khai trên nền tảng ứng dụng di động phổ biến (Android, iOS)"** → nếu tổ chấm hiểu là **app native trên store**, toàn bộ nhóm B chỉ đạt 🟡. Đây là gap cần làm rõ (làm rõ HSMT) hoặc phải phát triển app native/wrapper.

**Vai trò người dùng:** HSMT yêu cầu **5 vai trò** (Chủ trì, Thư ký, Thành viên dự họp, Quản trị hệ thống, **Quản trị đơn vị**). eCabinet hiện **4 vai trò** → cần bổ sung tách bạch vai trò **Quản trị đơn vị** (quản lý người dùng/dữ liệu cấp đơn vị, nhận & phân phối yêu cầu).

---

## 3. YÊU CẦU PHI CHỨC NĂNG & DỊCH VỤ (Mục 3.1, 3.2, 3.3, 3.5)

| Nhóm | Yêu cầu (trích) | Trạng thái | Ghi chú |
|---|---|---|---|
| **Nền tảng công nghệ** ⚠️ | "Nền tảng lập trình **.NET**; CSDL **MS SQL Server 2022+**; HĐH máy chủ **Windows Server 2019+**"; ".NET 8.0 trở lên, Visual Studio" | ❌ | **Mâu thuẫn cốt lõi:** eCabinet là **Node + PostgreSQL**. Đây là yêu cầu kỹ thuật cứng, rủi ro loại/trừ điểm rất cao. Xem mục 4. |
| **Hạ tầng triển khai** | Cài đặt tập trung tại **TTDL TP** (TP cấp máy chủ Windows/SQL); cụm Web/App/DB/File server ảo hóa | 🟡 | eCabinet dùng Docker Compose trên VPS. Có thể chạy container trên hạ tầng TP nếu được duyệt, nhưng cấu hình đề xuất là Windows Server → cần thỏa thuận. |
| **ATTT cấp độ 3** ⚠️ | "Bảo đảm ATTT **cấp độ 3**" (NĐ 85/2016, TT 12/2022) **trước khi vận hành**; không lỗ hổng ≥ cấp độ 3 | ❌ | eCabinet có JWT/rate-limit/audit/mã hóa cơ bản nhưng **chưa có hồ sơ đề xuất cấp độ được phê duyệt, chưa pentest độc lập**. Hồ sơ cấp độ 3 do chủ quản HTTT lập nhưng nhà thầu phải đáp ứng đủ biện pháp kỹ thuật TT12/2022. |
| **Mã hóa cơ yếu** ⚠️ | "Dữ liệu bắt buộc phải mã hóa được mã hóa/giải mã bằng **mật mã cơ yếu**"; tuân thủ **Pháp lệnh bảo vệ bí mật nhà nước** | ❌ | Cần tích hợp giải pháp mật mã cơ yếu (Ban Cơ yếu) — eCabinet chưa có. |
| **Tín nhiệm mạng** | Đáp ứng tiêu chí **tín nhiệm mạng** (pháp luật giao dịch điện tử) | ❌ | Cần đăng ký/đạt gán nhãn Tín nhiệm mạng (NCSC). |
| **IPv6 sẵn sàng + TLS 1.2+** | Sẵn sàng IPv6; HTTPS TLS v1.2+ | 🟡 | HTTPS tự động ✅; **sẵn sàng IPv6** cần rà soát cấu hình. |
| **Định dạng tệp / Unicode** | TT 39/2017/TT-BTTTT; TCVN 6909:2001 | ✅ | Hỗ trợ Unicode, xuất PDF. |
| **Hiệu năng** | <5s/thao tác; <30s tìm kiếm; <5 phút báo cáo; 500 user/90 CCU; mở rộng không giới hạn | 🟡 | Realtime WebSocket tốt; **cần benchmark tải thực tế 90 CCU** để chứng minh. |
| **Tích hợp LGSP/NGSP** ⚠️ | Liên thông qua **Trục LGSP TP** (và NGSP); tuân thủ **Khung CQS Hải Phòng 4.0** (QĐ 4435/QĐ-UBND), **NĐ 278/2025/NĐ-CP**; cung cấp API | ❌ | eCabinet **chưa tích hợp LGSP/trục liên thông**. Cần phát triển adapter + kết nối thực tế (phụ thuộc TP mở kết nối). |
| **Tích hợp QLVB điều hành / hệ thống khác / IOC** | Kết nối QLVB & điều hành, quản lý công việc; **kết nối IOC** khi vận hành chính thức | ❌ | Chưa có; là điều kiện đưa vào sử dụng chính thức. |
| **Sao lưu / phục hồi** | Sao lưu định kỳ + đột xuất; phục hồi 100% | ✅ | Backup hằng ngày sẵn có; cần bổ sung quy trình DR đạt RTO 24h. |
| **Audit / truy vết** | Lưu vết mọi hành động người dùng, tra cứu được, nhật ký không chỉnh sửa | ✅ | Audit log sẵn có; bổ sung "không chỉnh sửa" (append-only) + UI tra cứu. |
| **Export dữ liệu** | Cho phép export theo quy định | ✅ | In/xuất PDF; bổ sung xuất theo mẫu. |

### Yêu cầu về NHÀ THẦU / DỊCH VỤ (mục 3.1.x, 3.5) — ⚠️ khó với công ty mới, sản phẩm mới
| Yêu cầu | Trạng thái | Mức khó |
|---|---|---|
| **Website công bố chức năng sản phẩm chào thầu** (đường dẫn) phù hợp yêu cầu HSMT | 🟡 | **Điều kiện dự thầu** — phải có website mô tả đầy đủ chức năng sản phẩm. Cần dựng ngay. |
| **Đội vận hành / bộ phận chuyên trách; trực quản trị 24/7 + tổng đài giờ HC** trong 60 tháng | ❌ | **CAO** — cần cam kết nhân sự vận hành 24/7 suốt 5 năm; công ty mới khó chứng minh. |
| **Đào tạo** (quản trị 1 lớp/1 ngày ~10 HV; sử dụng 1 lớp/1 buổi; ≥1 giảng viên + 1 trợ giảng/lớp; tài liệu đầy đủ) | 🟡 | Trung bình — làm được nhưng cần chuẩn bị giáo trình/tài liệu. |
| **Quy trình quản lý dịch vụ** (ITSM: quản lý thay đổi, phiên bản, sự cố, sẵn sàng/liên tục) | 🟡 | Cần ban hành đầy đủ quy trình trước triển khai. |
| **Báo cáo dịch vụ 06 tháng/lần** | ✅ | Làm được. |
| **Cam kết bảo mật, không tiết lộ bên thứ 3, tuân thủ cơ yếu + bí mật nhà nước** | 🟡 | Cần văn bản cam kết + tuân thủ thực tế. |
| **Bảo trì theo Phụ lục 11 & 12 TT 18/2024/TT-BTTTT** (vá lỗi, tối ưu, đánh giá ATTT, gia hạn bản quyền sản phẩm ATTT…) | 🟡 | Cần quy trình + có thể phát sinh chi phí sản phẩm ATTT. |
| **Kinh nghiệm / hợp đồng tương tự đã triển khai** | ❌ | **CAO** — eCabinet là **sản phẩm mới, chưa có hợp đồng tương tự**. Đây thường là tiêu chí năng lực ở E-HSMT (Chương III) — **cần kiểm tra Chương III/tiêu chí đánh giá** (không nằm trong file này). |

> **Cảnh báo:** File phân tích là **Chương V (yêu cầu kỹ thuật)**. Các tiêu chí **năng lực–kinh nghiệm nhà thầu, doanh thu, nhân sự chủ chốt, hợp đồng tương tự, bảo lãnh dự thầu** nằm ở **Chương III (Tiêu chuẩn đánh giá) và Chương I/II** — **PHẢI đọc bổ sung** trước khi chốt bid, vì đây là nơi loại nhà thầu mới phổ biến nhất.

---

## 4. GAP MATRIX TỔNG

### Tỷ lệ đáp ứng theo nhóm (ước tính, theo số mục chức năng 3.4 + phi chức năng)
| Nhóm | Đáp ứng | Một phần | Chưa có | % đáp ứng (đủ) | % có+một phần |
|---|---|---|---|---|---|
| Web – Quản trị HT + cá nhân (1–5) | 2 | 2 | 1 | 40% | 80% |
| Web – Danh mục (6–10) | 1 | 3 | 1 | 20% | 80% |
| Web – Lấy ý kiến (11–13) | 3 | 0 | 0 | 100% | 100% |
| Web – Tài liệu cá nhân (14–16) | 2 | 1 | 0 | 67% | 100% |
| Web – Thông tin cuộc họp (17–24) | 6 | 2 | 0 | 75% | 100% |
| Web – Tổ chức họp (25–51) | 19 | 5 | 3 | 70% | 89% |
| Web – Thống kê (52–53) | 2 | 0 | 0 | 100% | 100% |
| Web – API tích hợp (54–59) | 0 | 6 | 0 | 0% | 100% |
| **Mobile native (60–97)** | 0 | ~35 | ~3 | **0%** | ~92% (qua PWA) |
| Phi chức năng kỹ thuật (nền tảng .NET/SQL, ATTT c.độ 3, LGSP, cơ yếu, tín nhiệm mạng) | — | — | — | **Thấp** | Nhiều gap nặng |

**Tổng quan nghiệp vụ (chức năng thuần):** eCabinet đáp ứng **~85–90%** nếu tính cả "một phần" (đặc biệt web mạnh). **Nghĩa là về mặt nghiệp vụ họp không giấy, eCabinet rất cạnh tranh.**
**Tổng quan kỹ thuật/pháp lý/dịch vụ:** đây là **vùng rủi ro chính** — nhiều gap nặng, một số mang tính **loại trực tiếp**.

### TOP GAP NẶNG — xếp theo (a) mức chặn thầu và (b) công sức
| # | Gap | Loại chặn | Công sức xây dựng | Ghi chú |
|---|---|---|---|---|
| **G1** | **Nền tảng .NET + MS SQL Server + Windows Server** (HSMT chỉ định cứng) | 🔴 **Có thể loại / trừ điểm nặng** | **Rất cao** (viết lại hoặc port toàn bộ backend) | eCabinet = Node+PostgreSQL. Cần: (i) làm rõ HSMT xem đây là "bắt buộc" hay "đề xuất"; (ii) nếu bắt buộc → chi phí/thời gian port lớn, khó trong 3 tháng. **Gap sinh tử.** |
| **G2** | **ATTT cấp độ 3** (hồ sơ + biện pháp TT12/2022 + không lỗ hổng ≥ c.độ 3) | 🔴 **Bắt buộc trước vận hành** | Cao | Cần hồ sơ đề xuất cấp độ, kiện toàn biện pháp kỹ thuật, pentest độc lập. |
| **G3** | **Ký số PKI thật** (chức năng 30, 611 — ký số ý kiến văn bản) | 🟠 Bắt buộc chức năng | Trung bình–cao | eCabinet đang **mô phỏng**; cần tích hợp **VGCA/SmartCA/USB token** thật. |
| **G4** | **Tích hợp LGSP + API chuẩn + Khung CQS 4.0 + NĐ 278/2025** (54–59, mục 3.3) | 🟠 Bắt buộc + điều kiện kết nối IOC | Cao (phụ thuộc TP) | Cần adapter LGSP + bộ API công bố + kết nối thực tế (phụ thuộc TP cấp endpoint). |
| **G5** | **App native Android/iOS trên store** (nhóm B, mục tiêu cụ thể) | 🟠 Rủi ro tùy cách chấm | Trung bình–cao | PWA có thể không được coi là "ứng dụng di động Android/iOS". Cần app native/wrapper (Capacitor) hoặc làm rõ HSMT. |
| **G6** | **Mã hóa cơ yếu + tín nhiệm mạng** | 🟠 Bắt buộc | Trung bình | Tích hợp mật mã cơ yếu; đăng ký nhãn tín nhiệm mạng. |
| **G7** | **Nghiệp vụ CHẤT VẤN** (34,45,46,80,89,90) | 🟡 Bắt buộc chức năng | Thấp–trung bình | Xây mới luồng chất vấn (tương tự phát biểu — dễ tái sử dụng). |
| **G8** | **Sơ đồ phòng họp + vị trí đại biểu** (9,38) | 🟡 Bắt buộc chức năng | Thấp–trung bình | Xây UI sơ đồ chỗ ngồi. |
| **G9** | **Đội vận hành 24/7 + tổng đài + ITSM 60 tháng** | 🟠 Cam kết dịch vụ | Tổ chức/nhân sự | Công ty mới cần chứng minh năng lực vận hành dài hạn. |
| **G10** | **Kinh nghiệm/hợp đồng tương tự** (kiểm tra Chương III) | 🔴 Rủi ro loại ở bước năng lực | Không xây được bằng dev | **Rào cản lớn nhất cho công ty mới** — cần đọc Chương III để xác nhận. |
| **G11** | Vai trò **Quản trị đơn vị**; quy trình **trình–duyệt tài liệu**; danh mục cơ quan ban hành; quản trị tài liệu HDSD; nhật ký lọc/xóa | 🟡 Bắt buộc chức năng | Thấp | Nhóm gap nhỏ, làm nhanh trong 3 tháng. |

**Điều kiện tiên quyết/bị loại nếu thiếu (theo văn bản):**
- Vận hành thử **phải đạt** mới được nghiệm thu & kết nối IOC (mục E + Yêu cầu khác).
- **ATTT cấp độ 3 phải hoàn thành trước khi vận hành** (mục 3.4.b phi chức năng).
- **Website công bố chức năng sản phẩm** khi dự thầu (Yêu cầu khác) → thiếu là rủi ro loại HSDT.
- Không hoàn thành đúng hạn 3 tháng → **chấm dứt hợp đồng**.
- *(Các tiêu chí kỹ thuật đạt/không đạt cụ thể của tổ chấm nằm ở Chương III — cần đọc.)*

---

## 5. KHUYẾN NGHỊ BID / NO-BID

### Kết luận: **BID CÓ ĐIỀU KIỆN — nhưng chỉ sau khi làm rõ 2 điểm sinh tử (G1 nền tảng .NET/SQL và G10 kinh nghiệm).**

**Lý do:** Về **nghiệp vụ họp không giấy, eCabinet đáp ứng ~85–90% và nhiều chỗ VƯỢT yêu cầu** (tự sinh biên bản NĐ 30/2020, ghi biên bản bằng giọng nói, họp trực tuyến WebRTC, màn hình TV, realtime mạnh). Rủi ro **không nằm ở nghiệp vụ** mà ở **stack công nghệ chỉ định, ATTT cấp độ 3, tích hợp LGSP, ký số thật, app native, và năng lực nhà thầu**.

### Điều kiện BẮT BUỘC làm được thì mới nên dự (giai đoạn 3 tháng chuẩn bị + trước nghiệm thu):

**A. Trước khi nộp HSDT (quyết định go/no-go):**
1. **Làm rõ HSMT (văn bản):** nền tảng **.NET/SQL Server có phải bắt buộc "đạt/không đạt"** hay chỉ là đề xuất tương thích? Nếu **bắt buộc** và không chấp nhận Node/PostgreSQL → **NO-BID** (không thể port + đạt ATTT trong 3 tháng với chi phí trọn gói hợp lý). Đây là **điều kiện tiên quyết số 1**.
2. **Đọc Chương III (tiêu chuẩn đánh giá) + Chương I/II:** xác nhận yêu cầu **hợp đồng tương tự, doanh thu, nhân sự chủ chốt, bảo lãnh dự thầu**. Nếu bắt buộc hợp đồng tương tự đã nghiệm thu mà công ty chưa có → cân nhắc **liên danh/thầu phụ** với đơn vị có kinh nghiệm & pháp nhân đủ điều kiện.
3. Làm rõ **"ứng dụng di động Android/iOS"** có yêu cầu app trên store hay chấp nhận web/PWA.
4. **Dựng website công bố chức năng sản phẩm** chào thầu (điều kiện dự thầu).

**B. Trong 3 tháng chuẩn bị (nếu trúng thầu):**
5. **Port/triển khai theo nền tảng được duyệt** (nếu HSMT chấp nhận thương lượng, có thể chạy container trên hạ tầng TP; nếu bắt buộc .NET/SQL → đây là khối lượng lớn nhất, phải có kế hoạch & nguồn lực rõ).
6. **Tích hợp ký số PKI thật** (VGCA/SmartCA) thay thế mô phỏng — bắt buộc cho chức năng 30.
7. **Hoàn thiện hồ sơ ATTT cấp độ 3** + kiện toàn biện pháp TT12/2022 + **pentest độc lập** đạt "không lỗ hổng ≥ cấp độ 3"; tích hợp **mã hóa cơ yếu**; đăng ký **tín nhiệm mạng**.
8. **Xây adapter LGSP + bộ API công bố (54–59)** theo Khung CQS Hải Phòng 4.0 & NĐ 278/2025; phối hợp TP mở kết nối; chuẩn bị kết nối **IOC**.
9. **Bổ sung nghiệp vụ còn thiếu:** chất vấn (G7), sơ đồ phòng họp (G8), vai trò Quản trị đơn vị, quy trình trình–duyệt tài liệu, danh mục cơ quan ban hành, quản trị tài liệu HDSD, đếm ngược thời gian, xuất DS/ý kiến (G11). Khối lượng nhỏ, khả thi.
10. **Wrapper app native** (Capacitor/React Native shell) đưa lên store nếu cần (G5).
11. **Chuẩn hóa dịch vụ:** cam kết đội vận hành 24/7 + tổng đài giờ HC; ban hành quy trình ITSM (TT18/2024 PL11&12); giáo trình + tài liệu đào tạo; cơ chế backup đạt RTO 24h.
12. **Benchmark tải 90 CCU / 500 user** để chứng minh hiệu năng khi vận hành thử.

### Điểm eCabinet VƯỢT yêu cầu — có thể ghi điểm kỹ thuật / thuyết phục tổ chấm
- **Tự sinh dự thảo biên bản & thông báo kết luận đúng thể thức NĐ 30/2020** (quốc hiệu, số hiệu, nơi nhận) — HSMT chỉ yêu cầu kết luận cơ bản.
- **Ghi biên bản bằng giọng nói tiếng Việt** (speech-to-text) — không có trong HSMT.
- **Họp trực tuyến video WebRTC (LiveKit) + màn hình TV phòng họp** trình chiếu realtime — vượt yêu cầu "họp không giấy".
- **Realtime WebSocket** mạnh (điểm danh/biểu quyết/phát biểu/tin nhắn) — đáp ứng tốt "<5s" và trải nghiệm điều hành.
- **Bảo mật bản ghi tinh vi** (lọc quyền đọc theo tài liệu mật/phiếu kín/biên bản theo thành phần; atomic chống mất phiếu) — phù hợp yêu cầu phân quyền chặt + bí mật nhà nước.
- **Điểm danh QR, ghi chú cá nhân, góp ý công khai trên tài liệu, tin nhắn chung + riêng, ủy quyền, lấy ý kiến ngoài họp có nhắc hạn** — bao phủ rộng danh mục 3.4.
- **Đã chạy thật trên VPS, Docker, HTTPS tự động, backup hằng ngày** — chứng minh sản phẩm vận hành được.

### Rủi ro nếu vẫn dự mà chưa xử lý G1/G10
- **G1 (.NET/SQL):** nếu bắt buộc, gần như **không thể** hoàn thành + đạt ATTT cấp độ 3 trong 3 tháng với hợp đồng trọn gói → rủi ro **chấm dứt hợp đồng + mất bảo lãnh**.
- **G10 (kinh nghiệm):** rủi ro **bị loại ở bước đánh giá năng lực** trước cả khi xét kỹ thuật.

> **Tóm lại:** Sản phẩm eCabinet **rất mạnh về nghiệp vụ** nhưng gói thầu này **ràng buộc nặng về nền tảng công nghệ, ATTT, tích hợp và năng lực nhà thầu**. **BID nếu và chỉ nếu:** (1) nền tảng .NET/SQL không phải điều kiện loại cứng (hoặc chấp nhận thương lượng), (2) đủ điều kiện năng lực/kinh nghiệm (tự thân hoặc liên danh), và (3) có nguồn lực hoàn thành trọn bộ hồ sơ ATTT cấp độ 3 + ký số thật + tích hợp LGSP trong 3 tháng. Nếu một trong ba không đạt → **NO-BID**.
