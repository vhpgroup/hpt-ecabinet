CÔNG TY [Tên đầy đủ pháp nhân HPT TECH]
Số: [Số văn bản]/CV-HPT

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập – Tự do – Hạnh phúc

Hải Phòng, ngày [Ngày ký]

# PHƯƠNG ÁN SỞ HỮU, QUẢN LÝ VÀ CHUYỂN GIAO DỮ LIỆU

**Kính gửi:** Sở Khoa học và Công nghệ thành phố Hải Phòng

**Về:** Gói thầu "Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu"

---

## I. Căn cứ lập phương án

- E-HSMT Chương V, mục "Yêu cầu về việc sở hữu các thông tin, dữ liệu hình thành trong quá trình cung cấp dịch vụ và phương án, quản lý, chuyển giao cho bên thuê" (`docs/hsmt-chuong-v.md` dòng 639–650).
- *"Thông tin, dữ liệu hình thành trong quá trình thuê dịch vụ công nghệ thông tin thuộc sở hữu của cơ quan, đơn vị thuê..."* (dòng 642).
- *"...nhà cung cấp dịch vụ phải có trách nhiệm cung cấp toàn bộ các thông tin, dữ liệu, và tài sản hình thành thuộc sở hữu của chủ trì thuê dịch vụ dưới dạng dữ liệu có thể truy xuất..."* (dòng 649).
- Mục "Phương án quản lý, chuyển giao dữ liệu, tài sản hình thành cho bên thuê trong quá trình thực hiện bảo trì" (dòng 625–627).
- Luật Giao dịch điện tử số 20/2023/QH15; Nghị định số 278/2025/NĐ-CP về kết nối, chia sẻ dữ liệu.

## II. Nguyên tắc sở hữu dữ liệu

1. Toàn bộ thông tin, dữ liệu hình thành trong quá trình thuê dịch vụ (dữ liệu nghiệp vụ, tệp đính kèm, biên bản, nhật ký hệ thống) **thuộc quyền sở hữu của Sở Khoa học và Công nghệ thành phố Hải Phòng** (đơn vị chủ trì thuê dịch vụ) trong suốt và sau khi kết thúc thời gian thuê dịch vụ.
2. Trong suốt quá trình vận hành, Chủ đầu tư được cấp các tài khoản hệ thống (bao gồm tài khoản Quản trị hệ thống có toàn quyền truy cập, tra cứu, trích xuất dữ liệu) để truy cập, quản lý thông tin dữ liệu do mình sở hữu bất kỳ lúc nào, không phải chờ đến khi kết thúc hợp đồng.
3. Nhà thầu không được chia sẻ, tiết lộ dữ liệu cho bên thứ ba dưới bất kỳ hình thức nào khi chưa được Chủ đầu tư cho phép bằng văn bản (đã cam kết cụ thể tại `docs/ho-so/01-cam-ket-bao-mat.md` Mục II.1).

## III. Phạm vi dữ liệu chuyển giao

| Nhóm dữ liệu | Nội dung cụ thể |
|---|---|
| Cơ sở dữ liệu nghiệp vụ | Toàn bộ bảng dữ liệu: đơn vị, người dùng, phòng họp, cuộc họp, tài liệu họp, nội dung biểu quyết, phiếu biểu quyết, văn bản lấy ý kiến, ý kiến góp ý, kết luận cuộc họp, nhiệm vụ sau họp, thông báo, tin nhắn trao đổi trong phiên họp |
| Tệp đính kèm | Toàn bộ tệp tài liệu (văn bản, hình ảnh), biên bản đã ký số, tệp ghi âm/ghi hình cuộc họp (nếu có lưu trữ) |
| Nhật ký hệ thống | Nhật ký đăng nhập, nhật ký hành động người dùng (audit log), nhật ký hệ thống phục vụ giám sát |
| Danh mục cấu hình | Danh mục chức vụ, loại phiên họp, loại tài liệu, cơ quan ban hành, sơ đồ phòng họp, cấu hình phân quyền |
| Dữ liệu tài khoản | Danh sách tài khoản, vai trò, phân quyền (không bao gồm mật khẩu dạng có thể đọc được — chỉ chuyển giao thông tin tài khoản, mật khẩu do người dùng tự đặt lại) |

## IV. Định dạng dữ liệu chuyển giao — bảo đảm "có thể truy xuất"

Đáp ứng đúng yêu cầu dòng 649 HSMT ("dưới dạng dữ liệu có thể truy xuất"), Nhà thầu cung cấp dữ liệu theo **2 lớp định dạng song song**, để bảo đảm cả người có chuyên môn kỹ thuật và người không chuyên đều truy xuất, sử dụng được:

### 1. Lớp định dạng kỹ thuật (dành cho đội ngũ CNTT)
- Bản kết xuất toàn bộ cơ sở dữ liệu (database dump) ở định dạng gốc của hệ quản trị cơ sở dữ liệu đang sử dụng (SQL Server hoặc PostgreSQL tùy theo nền tảng triển khai chính thức — xem làm rõ tại `docs/ho-so/10-van-ban-lam-ro-hsmt.md`), có thể phục hồi lại thành hệ thống hoạt động đầy đủ trên hạ tầng tương đương.
- Kèm tài liệu mô tả cấu trúc bảng (schema) — tên bảng, tên trường, kiểu dữ liệu, quan hệ giữa các bảng — để đơn vị tiếp nhận (hoặc nhà cung cấp dịch vụ kế tiếp, nếu có) hiểu và khai thác được dữ liệu mà không cần phụ thuộc vào Nhà thầu.

### 2. Lớp định dạng thân thiện (dành cho người sử dụng không chuyên kỹ thuật)
- Bản xuất từng nhóm dữ liệu nghiệp vụ ra định dạng phổ biến, dễ mở bằng công cụ văn phòng thông dụng: **CSV** (dữ liệu dạng bảng: danh sách cuộc họp, danh sách tài khoản, thống kê biểu quyết...), **JSON** (dữ liệu có cấu trúc lồng nhau: hồ sơ cuộc họp đầy đủ kèm tài liệu, biểu quyết, kết luận), tệp gốc giữ nguyên định dạng (PDF, DOCX, hình ảnh) cho tài liệu và biên bản.
- Cấu trúc thư mục xuất dữ liệu được tổ chức rõ ràng theo đơn vị/theo năm/theo loại dữ liệu để dễ tra cứu thủ công.
- Kèm bảng chú giải (data dictionary) bằng tiếng Việt giải thích ý nghĩa từng trường dữ liệu.

## V. Quy trình chuyển giao dữ liệu khi kết thúc/chấm dứt hợp đồng

| Bước | Nội dung | Trách nhiệm | Thời hạn |
|---|---|---|---|
| 1 | Chủ đầu tư thông báo bằng văn bản về việc kết thúc hoặc chấm dứt hợp đồng, kèm mốc thời gian dự kiến | Sở Khoa học và Công nghệ | Trước tối thiểu 30 ngày (kết thúc theo thời hạn) hoặc theo thỏa thuận cụ thể trong hợp đồng (trường hợp chấm dứt trước hạn) |
| 2 | Hai bên thống nhất phạm vi, định dạng, phương thức bàn giao cụ thể (theo khung tại Mục III, IV văn bản này) | Hai bên | Trong vòng 07 ngày làm việc kể từ khi nhận thông báo |
| 3 | Nhà thầu thực hiện kết xuất toàn bộ dữ liệu theo cả 2 lớp định dạng (kỹ thuật + thân thiện), kiểm tra tính đầy đủ, toàn vẹn (đối soát số lượng bản ghi so với hệ thống đang vận hành) | Nhà thầu | Trong vòng 10 ngày làm việc |
| 4 | Nhà thầu bàn giao dữ liệu cho Chủ đầu tư qua phương thức bảo mật đã thống nhất (thiết bị lưu trữ vật lý được mã hóa, hoặc truyền qua kênh an toàn nội bộ do Trung tâm dữ liệu thành phố cung cấp — không qua dịch vụ chia sẻ file công khai trên Internet) | Nhà thầu | Theo mốc đã thống nhất tại Bước 2 |
| 5 | Chủ đầu tư xác nhận đã nhận đủ, đúng dữ liệu (đối soát mẫu ngẫu nhiên hoặc toàn bộ theo thỏa thuận) | Sở Khoa học và Công nghệ | Trong vòng 05 ngày làm việc kể từ khi nhận dữ liệu |
| 6 | Lập Biên bản bàn giao dữ liệu (mẫu tại Mục VII văn bản này), có xác nhận của cả hai bên | Hai bên | Ngay sau khi xác nhận Bước 5 |
| 7 | Sau khi Biên bản bàn giao được ký, Nhà thầu xóa toàn bộ dữ liệu còn lưu trên hạ tầng của Nhà thầu (nếu không thuộc hạ tầng do Trung tâm dữ liệu thành phố quản lý) theo đúng quy định bảo mật, có xác nhận bằng văn bản việc đã xóa | Nhà thầu | Trong vòng 15 ngày làm việc sau khi ký Biên bản bàn giao |

## VI. Bàn giao tài khoản và bảo mật cấu trúc hệ thống

1. Đối với tài khoản Quản trị hệ thống, Nhà thầu bàn giao đầy đủ quyền truy cập cho Chủ đầu tư trước khi thực hiện Bước 7 (xóa dữ liệu trên hạ tầng Nhà thầu), bảo đảm Chủ đầu tư có thể tự khai thác hoặc chuyển giao cho đơn vị khác vận hành tiếp nếu cần.
2. Nhà thầu cam kết bảo mật toàn bộ cấu trúc, sơ đồ hệ thống, mã nguồn, tài liệu thiết kế kỹ thuật trong suốt và cả sau khi kết thúc hợp đồng, không tiết lộ cho bên thứ ba không liên quan, đúng theo cam kết tại `docs/ho-so/01-cam-ket-bao-mat.md` Mục II.4.
3. Trường hợp Chủ đầu tư lựa chọn tiếp tục sử dụng cùng phần mềm với nhà cung cấp dịch vụ khác (gia hạn/đấu thầu lại), Nhà thầu có trách nhiệm hỗ trợ kỹ thuật hợp lý trong phạm vi được thỏa thuận cụ thể tại hợp đồng, để bảo đảm tính liên tục của dịch vụ cho các đơn vị sử dụng, không gây gián đoạn hoạt động của các xã, phường, đặc khu.

## VII. Mẫu Biên bản bàn giao dữ liệu

---

**BIÊN BẢN BÀN GIAO DỮ LIỆU**
(Khi kết thúc/chấm dứt hợp đồng thuê dịch vụ)

Hôm nay, ngày ..... tháng ..... năm ....., tại .....................................

**Bên giao (Nhà thầu):** [Tên đầy đủ pháp nhân HPT TECH]
Đại diện: [Họ tên] — Chức vụ: [Chức vụ]

**Bên nhận (Chủ đầu tư):** Sở Khoa học và Công nghệ thành phố Hải Phòng
Đại diện: ..................................... — Chức vụ: .....................................

**Hai bên xác nhận:**

| # | Nhóm dữ liệu | Định dạng bàn giao | Dung lượng/Số lượng bản ghi | Phương thức bàn giao | Xác nhận đầy đủ, toàn vẹn |
|---|---|---|---|---|---|
| 1 | Cơ sở dữ liệu nghiệp vụ | | | | ☐ Đạt ☐ Không đạt |
| 2 | Tệp đính kèm | | | | ☐ Đạt ☐ Không đạt |
| 3 | Nhật ký hệ thống | | | | ☐ Đạt ☐ Không đạt |
| 4 | Danh mục cấu hình | | | | ☐ Đạt ☐ Không đạt |
| 5 | Dữ liệu tài khoản | | | | ☐ Đạt ☐ Không đạt |
| 6 | Tài khoản Quản trị hệ thống | | | | ☐ Đạt ☐ Không đạt |

Bên nhận xác nhận đã nhận đủ, đúng dữ liệu như trên. Bên giao cam kết sau khi ký biên bản này sẽ xóa toàn bộ dữ liệu còn lưu trên hạ tầng của Nhà thầu (nếu có) trong thời hạn quy định tại Mục V.7 văn bản Phương án chuyển giao dữ liệu.

**Đại diện Bên giao** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; **Đại diện Bên nhận**
(Ký, ghi rõ họ tên, đóng dấu) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (Ký, ghi rõ họ tên, đóng dấu)

---

**ĐẠI DIỆN NHÀ THẦU**
[Chức vụ]

[Họ tên]
*(Ký, ghi rõ họ tên, đóng dấu)*
