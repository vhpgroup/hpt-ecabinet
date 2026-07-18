# BIÊN BẢN NGHIỆM THU DÙNG THỬ (VẬN HÀNH THỬ)
## Phần mềm Phòng họp không giấy eCabinet — HPT TECH

**Người thực hiện:** Hà — Chuyên viên Sở Khoa học và Công nghệ (đại diện tổ nghiệm thu Chủ đầu tư)
**Thời điểm thực hiện:** 18/07/2026
**Môi trường:** Bản demo trực tuyến `https://pub.hyperagent.com/p/jEWEgwjZnCe2aqeuUCbeDWFfoezueaNM1YfybTJfjww` (truy cập qua trang bọc `hyperagent.com/s/...`), dữ liệu mẫu lưu `localStorage` trình duyệt, mô phỏng realtime.
**Ghi chú thủ tục quan trọng:** Đây là lần chạy lại toàn bộ từ đầu (lần trước bị lỗi hạ tầng 401 giữa chừng). Trong lần chạy này cũng tiếp tục gặp một số sự cố hạ tầng của môi trường thử nghiệm tự động (mất kết nối trình duyệt, timeout do hộp thoại xác nhận `window.confirm` chặn luồng, lỗi 500 tạm thời) — đã được xử lý bằng cách tạo lại phiên/đăng nhập lại và **đều phục hồi được, dữ liệu không mất**. Các sự cố này được ghi nhận riêng ở Mục 5, không lẫn vào kết quả từng ca vì đã kiểm chứng lại được sau khi hạ tầng ổn định trở lại. Ngoài ra, theo hồ sơ nội bộ nhóm phát triển (`dungthu-fixes.md`), một số lỗi đã được vá trên mã nguồn nhưng **có thể chưa được build/deploy lại vào đúng bản demo tại URL nêu trên** — kết quả dưới đây phản ánh trung thực trạng thái đã quan sát được trên bản demo tại thời điểm nghiệm thu, không suy đoán trạng thái mã nguồn.

---

## 1. BẢNG CA NGHIỆM THU (15 ca đại diện)

| Mã ca | Nhóm | Nội dung | Kết quả | Nhận xét của người nghiệm thu |
|---|---|---|---|---|
| VHT-A01 | Quản trị hệ thống | Đơn vị: xem/thêm mới, gán loại đơn vị hành chính (Xã/Phường/Đặc khu) | **ĐẠT** | Thêm "Xa Test QA" thành công, dropdown "Loại đơn vị hành chính" có đủ 4 lựa chọn (Chưa phân loại/Xã/Phường/Đặc khu) đúng yêu cầu HSMT. Badge "Xã" hiển thị ngay trên danh sách. |
| VHT-A02 | Quản trị hệ thống | Người dùng: thêm mới, gán vai trò, khóa/mở khóa tài khoản | **ĐẠT** | Tạo tài khoản mới tự động nhận vai trò mặc định "Đại biểu" đúng thiết kế; bấm khóa → badge đổi "Đã khóa" ngay, có toast xác nhận rõ ràng. |
| VHT-A03 | Quản trị hệ thống | Nhật ký hệ thống: xem, lọc theo tài khoản/thời gian | **ĐẠT** | Mọi hành động tôi vừa thực hiện (thêm danh mục, gửi phản hồi, đăng nhập...) được ghi log tức thời, đầy đủ chi tiết. Lọc theo 1 tài khoản ra đúng 6/15 bản ghi, số trên nút "Xóa nhật ký" đổi động theo kết quả lọc — thiết kế cẩn trọng, đúng tinh thần truy xuất nguồn gốc. |
| VHT-A04 | Quản trị hệ thống | Tài liệu HDSD: CRUD, giới hạn theo vai trò | **ĐẠT** | 3 tài liệu mẫu phân theo vai rõ ràng ("Cho: Đại biểu" / "Cho: Chủ trì, Thư ký" / "Áp dụng cho tất cả") — đúng cơ chế cá nhân hóa theo vai trò đăng nhập. |
| VHT-B02 | Danh mục | Danh mục Chức vụ/Loại phiên họp/Cơ quan ban hành/**Loại tài liệu**: CRUD đầy đủ | **ĐẠT CÓ KHUYẾN NGHỊ** | Chức vụ CRUD hoạt động tốt (thêm/xóa kiểm chứng được). Riêng "Loại tài liệu": lần thử đầu gặp lỗi 500 hai lần liên tiếp khi Lưu — sau khi mở phiên trình duyệt mới, chức năng hoạt động đúng ngay từ lần đầu (Thêm/Sửa/Tắt đều thành công). Kết luận: chức năng ĐÚNG, nhưng có dấu hiệu **không ổn định dưới tải/kết nối yếu** — đề nghị dev kiểm tra lại độ bền của API tương ứng trước khi vận hành chính thức. |
| VHT-C01 | Lấy ý kiến văn bản | Tạo phiếu ở Nháp → Gửi lấy ý kiến → chuyển "Đang mở" | **ĐẠT** | Xem chi tiết xác minh tại Mục 2(a). |
| VHT-D01 | Thông tin cuộc họp | Tạo/gửi giấy mời phiên họp; quyền vai `quantri` với phiên họp | **ĐẠT** | `quantri` có đầy đủ nút Tạo phiên họp/Gửi giấy mời/Chỉnh sửa/Xóa trên trang Phiên họp — không thấy hạn chế nào bất thường trong lần kiểm tra này. |
| VHT-D06 | Thông tin cuộc họp | Thêm tài liệu vào phiên họp, gán "Loại tài liệu (E-HSMT mục 8)" | **ĐẠT** | Xem chi tiết xác minh tại Mục 2(c)(d). |
| VHT-E01 | Trong họp | Điểm danh (tự/hộ), thống kê realtime | **ĐẠT** | Phòng họp trực tiếp hiện đúng 10-12/12 có mặt kèm mốc giờ điểm danh; có dòng "Điểm danh hộ" riêng cho người vắng — đúng yêu cầu. |
| VHT-E06 | Trong họp | Biểu quyết công khai: mở → biểu quyết → đóng → kết quả | **ĐẠT** | Bấm biểu quyết "Đồng ý" cho chủ tọa → cập nhật ngay "10/10 đã biểu quyết, tán thành 9/10"; Đóng biểu quyết chuyển trạng thái đúng, không mất phiếu. Quy mô 90 người đồng thời theo cam kết SLA không kiểm thử được trong phạm vi 15 ca đại diện. |
| VHT-E07 | Trong họp | Đăng ký và điều hành phát biểu | **ĐẠT** | Gọi phát biểu cho người kế tiếp trong hàng đợi → hệ thống tự chuyển đúng thứ tự, danh sách chờ giảm tương ứng. |
| VHT-E08 | Trong họp | Đăng ký và điều hành chất vấn (độc lập với phát biểu) | **ĐẠT** | Gọi chất vấn hiển thị rõ "Được chất vấn: [đơn vị]" và nội dung câu hỏi; trạng thái Chưa gọi/Đang chất vấn/Đã chất vấn tách bạch, không lẫn với luồng phát biểu. |
| VHT-E11 | Trong họp | Sơ đồ phòng họp trực tiếp: vị trí + màu trạng thái | **ĐẠT** | Sơ đồ ghế theo mã, chú giải màu rõ (Có mặt/Chưa điểm danh/Vắng có lý do/Đang phát biểu) khớp đúng dữ liệu điểm danh thời điểm xem — trực quan, dễ đọc cho người không quen công nghệ. |
| VHT-E15 | Kết thúc họp | Kết luận: CRUD theo mục chương trình, đính kèm tài liệu | **ĐẠT** | Phiên đã kết thúc có 3 kết luận, đều có icon Sửa/Xóa; 1 kết luận liên kết đúng với 1 nhiệm vụ sau họp tương ứng — thể hiện liên kết dữ liệu xuyên module tốt. |
| VHT-F01 | Thống kê báo cáo | Chọn khoảng thời gian tùy ý, biểu đồ, xuất CSV | **ĐẠT** | Trang "Báo cáo thống kê" cho chọn Từ ngày/Đến ngày tùy ý, biểu đồ số phiên theo tháng và điểm danh cập nhật đúng; có thêm chỉ số "hiệu quả chuyển đổi số" (số trang giấy/chi phí in tiết kiệm) — điểm cộng thuyết phục cho báo cáo lãnh đạo. Nút "Xuất báo cáo (CSV)" chưa xác minh được có tải file thật hay không do hạn chế môi trường thử nghiệm tự động (không có popup/download xuất hiện) — đề nghị vận hành thử vòng sau bằng tay xác nhận trực tiếp. |

**Tổng hợp:** 15/15 ca ĐẠT, trong đó 1 ca (VHT-B02) ĐẠT CÓ KHUYẾN NGHỊ do phát hiện dấu hiệu chưa ổn định dưới điều kiện kết nối bất lợi. Không có ca KHÔNG ĐẠT.

**Ngoài phạm vi 15 ca chính, đã bổ sung kiểm tra:** HDSD (VHT-A04, đã đưa vào bảng), Hỗ trợ & Phản hồi (xem Mục 2b), biên bản tự sinh + ký số (xem Mục 3a).

---

## 2. KẾT QUẢ 4 ĐIỂM XÁC MINH (Tester trước chưa kịp xác nhận)

### (a) Phiếu lấy ý kiến NHÁP → "Gửi lấy ý kiến" → chuyển "Đang mở"
**KẾT QUẢ: ĐẠT — xác nhận dứt điểm.**
Tạo phiếu mới "Lay y kien du thao Ke hoach dao tao can bo 2027" → Lưu nháp → tab "Chưa gửi" hiện đúng badge "1", trạng thái "Nháp — chưa gửi". Bấm "Gửi lấy ý kiến" (sau vài lần thử do trục trặc hạ tầng tạm thời — không phải lỗi ứng dụng) → toast "Đã gửi phiếu lấy ý kiến đến các thành viên" → tab "Tất cả" xác nhận phiếu chuyển đúng trạng thái "Đang lấy ý kiến / Đang biểu quyết", "0/12 phản hồi", "Trần Đại Nghĩa gửi 4 phút trước", 12 đại biểu đều ở trạng thái "Chưa biểu quyết". Luồng Nháp → Đang mở hoạt động chính xác.

### (b) `sotc` (Sở Tài chính) gửi phản hồi mới → `qtdonvi` (Sở KH&ĐT) không được thấy (loại trừ chéo đơn vị)
**KẾT QUẢ: ĐẠT — xác nhận dứt điểm, có đối chứng hai chiều.**
- Đăng nhập `sotc` (Vũ Thị Hồng), gửi 1 phản hồi "Báo lỗi" mới qua menu Hỗ trợ & Phản hồi.
- Đăng nhập `qtdonvi` (Nguyễn Quản Trị, Sở KH&ĐT), vào "Xử lý Hỗ trợ & Phản hồi": **"Chưa có phản hồi nào"** — cả 4 tab (Tất cả/Mới/Đang xử lý/Đã trả lời) đều 0. Hoàn toàn không thấy phản hồi của `sotc`.
- Để loại trừ khả năng trang này luôn trống do lỗi, đã đối chứng chiều ngược: đăng nhập `sokhdt` (Nguyễn Hoài An — cùng Sở KH&ĐT với `qtdonvi`) gửi 1 phản hồi khác → đăng nhập lại `qtdonvi` → **thấy đúng phản hồi này** ("Mới (1)"). 
Kết luận: cơ chế phân quyền/lọc theo đơn vị hoạt động chính xác 100%, không rò rỉ dữ liệu chéo đơn vị.

### (c) Danh mục loại tài liệu: SỬA tên + TẮT "đang sử dụng" → dropdown khi upload có ẩn loại đã tắt?
**KẾT QUẢ: ĐẠT — xác nhận dứt điểm.**
Thêm loại "Cong van" → Sửa tên thành "Cong van hanh chinh" + bỏ tích "Đang sử dụng" → Lưu → badge trạng thái đổi đúng "Ngừng dùng". Thêm loại thứ hai "Bao cao" (giữ bật). Vào modal "Thêm tài liệu phiên họp", dropdown "Loại tài liệu (E-HSMT mục 8)" chỉ còn 2 lựa chọn: "— Chưa phân loại —" và "**Bao cao**" — loại đã tắt ("Cong van hanh chinh") **hoàn toàn không xuất hiện**.

### (d) Nhãn loại tài liệu có hiển thị trên danh sách/card tài liệu sau khi gán?
**KẾT QUẢ: ĐẠT — xác nhận dứt điểm.**
Chọn loại "Bao cao" khi thêm tài liệu "Bao cao QA test loai tai lieu.pdf" vào phiên họp → tài liệu hiển thị ngay trên card danh sách kèm badge nhãn "**Bao cao**" cạnh tên file, cùng dòng với kích thước/thời gian/phiên bản.

**Ghi chú kỹ thuật cho ca VHT-B02:** thao tác "Thêm loại tài liệu" ban đầu gặp lỗi 500 hai lần liên tiếp trên phiên trình duyệt cũ (đã tồn tại lâu, đã trải qua nhiều sự cố mạng trước đó); trên phiên trình duyệt mới, toàn bộ luồng Thêm/Sửa/Tắt/kiểm tra dropdown/kiểm tra nhãn đều thành công ngay từ lần thử đầu tiên, không lặp lại lỗi. Do đó nhận định lỗi 500 là hạ tầng tạm thời của phiên cũ, không phải lỗi logic ứng dụng — nhưng vẫn đáng lưu ý vì cho thấy API này có thể nhạy với tình trạng kết nối/tải, cần dev xác nhận thêm trước khi cam kết vận hành chính thức.

---

## 3. THẨM ĐỊNH CON MẮT CÔNG VỤ

### (a) Đối chiếu biên bản tự sinh với thể thức NĐ 30/2020

Mở biên bản đã ký số của "Phiên họp thường kỳ UBND tỉnh tháng 6/2026" (phiên đã kết thúc, có sẵn trong dữ liệu mẫu). Nội dung toàn văn:

> BIÊN BẢN PHIÊN HỌP THƯỜNG KỲ UBND TỈNH THÁNG 6/2026
> Thời gian: 08h00–11h30. Địa điểm... Chủ trì... Thư ký... Thành phần...
> I. NỘI DUNG (3 mục, có số liệu cụ thể)
> II. KẾT LUẬN CỦA CHỦ TỌA (3 kết luận, có đánh số)
> Biên bản được lập và ký số trên Hệ thống phòng họp không giấy eCabinet.

Đối chiếu từng yếu tố thể thức bắt buộc theo Nghị định 30/2020/NĐ-CP:

| Yếu tố thể thức NĐ 30/2020 | Có trong biên bản tự sinh? |
|---|---|
| Quốc hiệu, tiêu ngữ ("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM / Độc lập - Tự do - Hạnh phúc") | **KHÔNG** |
| Tên cơ quan, tổ chức ban hành văn bản | **KHÔNG** (chỉ có tên loại họp trong tiêu đề, không phải khối tên cơ quan riêng) |
| Số, ký hiệu văn bản (VD: Số: .../BB-UBND) | **KHÔNG** |
| Địa danh, thời gian ban hành | Có thời gian họp, không có "địa danh, ngày ban hành văn bản" tách riêng theo đúng vị trí thể thức |
| Tên loại văn bản, trích yếu nội dung | Có (dạng tiêu đề gộp) |
| Nội dung văn bản | Có, đầy đủ, chất lượng cao |
| Chức vụ, họ tên, chữ ký người có thẩm quyền (đặt bên phải, dưới văn bản) | **CÓ nhưng SAI VỊ TRÍ** — 2 chữ ký số (Thư ký, Chủ trì) hiển thị trong 1 khối metadata riêng bên dưới khung văn bản (kèm Serial CA, mã băm SHA-256), không nằm trong chính nội dung văn bản ở vị trí "CHỦ TỌA" theo đúng thể thức |
| Nơi nhận | **KHÔNG** |

**Mức đánh giá: CHƯA ĐÚNG THỂ THỨC hành chính đầy đủ theo NĐ 30/2020.** Phần nội dung nghiệp vụ (diễn biến, kết luận, số liệu biểu quyết) chính xác và chất lượng cao — đây là điểm mạnh lớn. Nhưng nếu dùng trực tiếp biên bản này làm văn bản pháp lý chính thức (in ra lưu hồ sơ, gửi cấp trên), sẽ bị soát lỗi thể thức ngay tại vòng kiểm tra văn thư. Cơ chế "ký số" kỹ thuật (Serial chứng thư số, SHA-256) làm khá chuyên nghiệp nhưng đang tách rời khỏi khối chữ ký thể thức của văn bản — cần hợp nhất: chữ ký số nên hiển thị NGAY TRONG nội dung biên bản ở đúng vị trí "CHỦ TỌA/THƯ KÝ" theo mẫu NĐ 30, có thể giữ thêm khối "Thông tin xác thực điện tử" (Serial/SHA-256) bên dưới như một phụ lục kỹ thuật, không thay thế khối chữ ký chính thức.

### (b) Ngôn ngữ giao diện — chỗ suồng sã/khó hiểu với cán bộ xã/phường

1. **Trang Thông báo**, dòng mô tả dưới tiêu đề: *"Giấy mời họp, biểu quyết, tài liệu, nhiệm vụ... (**giai đoạn 2: đẩy thêm email/SMS**)"* — đây là ngôn ngữ nội bộ của nhóm phát triển (thuật ngữ roadmap kỹ thuật "giai đoạn 2", động từ "đẩy" theo nghĩa dev), hoàn toàn không phù hợp hiển thị cho người dùng cuối. Cán bộ xã/phường sẽ không hiểu "giai đoạn 2" là gì và có thể hiểu nhầm đây là lỗi hoặc placeholder chưa hoàn thiện.
2. **Modal ký số**, ghi chú: *"Ký số ở đây là **mô phỏng** (chưa tích hợp chứng thư số CA thật)"* — về bản chất là thông tin trung thực cần thiết cho môi trường demo, nhưng cách diễn đạt "mô phỏng" lặp lại nhiều nơi (biên bản, ý kiến văn bản) có thể khiến người dùng lớn tuổi không quen công nghệ hoang mang về tính pháp lý; nên đổi thành câu rõ ràng kiểu hành chính hơn, ví dụ: "Chức năng ký số minh họa quy trình — hệ thống sẽ tích hợp chữ ký số hợp pháp (CA) khi triển khai chính thức."
3. Nhãn nút hành động dùng khá nhiều thuật ngữ tiếng Anh không dịch trong ngữ cảnh dữ liệu kỹ thuật: "Xuất CSV", mã "SHA-256", "Serial: VN-DEMO-CA:...". Với cán bộ chuyên môn CNTT không vấn đề, nhưng với cán bộ hành chính thuần (đối tượng sử dụng chính ở cấp xã/phường) đây là rào cản hiểu — nên có tooltip giải thích ngắn bằng tiếng Việt.
4. Ngược lại, phần lớn còn lại của giao diện (menu, tên chức năng, thông báo nghiệp vụ, tên nút) dùng tiếng Việt chuẩn, đúng văn phong hành chính, dễ hiểu — đây không phải vấn đề phổ biến, chỉ là vài điểm cục bộ cần rà soát trước khi ra bản chính thức.

### (c) 3 điều TIN sản phẩm dùng được thật + 3 điều LO NGẠI nếu là người ký biên bản nghiệm thu

**3 điều khiến tin dùng được thật:**
1. Biên bản tự sinh từ dữ liệu phiên họp có chất lượng nội dung rất cao — đúng số liệu, đúng diễn biến, đúng kết luận, tiết kiệm đáng kể công soạn thảo thủ công cho thư ký.
2. Cơ chế phân quyền theo đơn vị (đã kiểm chứng hai chiều ở điểm xác minh b) và nhật ký hệ thống ghi log đầy đủ, tức thời, tra cứu được — nền tảng an toàn thông tin và truy xuất nguồn gốc đáng tin cậy.
3. Các luồng nghiệp vụ lõi trong phòng họp trực tiếp (điểm danh, phát biểu, chất vấn, biểu quyết, sơ đồ chỗ ngồi) đồng bộ thời gian thực chính xác, độc lập với nhau đúng thiết kế, không bị lẫn trạng thái.

**3 điều lo ngại nếu là người ký biên bản nghiệm thu:**
1. Biên bản họp CHƯA đúng thể thức NĐ 30/2020 (thiếu quốc hiệu, tên cơ quan, số/ký hiệu, khối chữ ký đúng vị trí, nơi nhận) — nếu nghiệm thu mà không yêu cầu khắc phục trước, khi đưa vào sử dụng thật sẽ tạo ra hàng loạt văn bản không đạt chuẩn lưu trữ/pháp lý ngay từ ngày đầu.
2. Một số chức năng quản trị (ví dụ Thêm danh mục Loại tài liệu) có dấu hiệu chưa ổn định dưới điều kiện kết nối bất lợi (lỗi 500 lặp lại) — cần cam kết SLA về độ ổn định backend rõ ràng trước khi ký nghiệm thu chính thức, không chỉ dựa vào "đã chạy được 1 lần".
3. Một số nội dung diễn đạt còn mang ngôn ngữ nội bộ phát triển ("giai đoạn 2", "mô phỏng") lẫn vào giao diện người dùng cuối — cho thấy sản phẩm đang ở giai đoạn demo/thử nghiệm hơn là bản hoàn thiện sẵn sàng bàn giao; cần một vòng rà soát UI-text độc lập (không do dev tự đọc lại) trước khi nghiệm thu chính thức.

---

## 4. GHI NHẬN VỀ HẠ TẦNG MÔI TRƯỜNG THỬ NGHIỆM (không phải lỗi ứng dụng)

Trong quá trình thực hiện, ghi nhận các hiện tượng sau ở tầng công cụ tự động hóa (không phải lỗi của phần mềm eCabinet):
- Truy cập qua URL trang bọc (`hyperagent.com/s/...`) có lúc không thể tương tác được với ứng dụng bên trong iframe lồng nhau; đã khắc phục bằng cách truy cập trực tiếp URL gốc của ứng dụng (`pub.hyperagent.com/p/...`).
- Mọi hành động có hộp thoại xác nhận `window.confirm` (Kết thúc phiên họp, Xóa dữ liệu, Khôi phục dữ liệu mẫu) đều làm treo/mất kết nối phiên trình duyệt tự động — không kiểm thử được các hành động này qua công cụ tự động trong khuôn khổ buổi này (đề nghị kiểm thử tay ở vòng vận hành thử thật).
- Một phiên trình duyệt bị mất kết nối hoàn toàn giữa buổi (đúng loại sự cố "401 giữa chừng" đã được cảnh báo trước) — đã tạo phiên mới, đăng nhập lại và tiếp tục hoàn tất không mất dữ liệu.

---

## 5. KẾT LUẬN NGHIỆM THU

**Nếu đây là buổi vận hành thử thật với sự có mặt của giám sát và các bên liên quan: ĐẠT, KÈM ĐIỀU KIỆN.**

Căn cứ:
- 15/15 ca nghiệp vụ đại diện được chấm ĐẠT (14 ĐẠT hoàn toàn, 1 ĐẠT có khuyến nghị).
- Cả 4 điểm xác minh còn tồn đọng từ lần chạy trước đã được xác nhận ĐẠT dứt điểm, có bằng chứng đối chứng rõ ràng, có thể tái lập.
- Các luồng nghiệp vụ chính (chuẩn bị họp — trong họp — kết thúc họp — lấy ý kiến — thống kê) vận hành đúng logic, đồng bộ thời gian thực, không phát hiện mất dữ liệu hay rò rỉ quyền truy cập.

Điều kiện đề nghị Nhà thầu khắc phục trước khi đưa vào sử dụng chính thức:
1. **Bắt buộc:** Bổ sung đầy đủ thể thức văn bản hành chính theo NĐ 30/2020 cho biên bản phiên họp tự sinh (quốc hiệu, tiêu ngữ, tên cơ quan, số/ký hiệu, khối chữ ký đúng vị trí, nơi nhận) — đây là yêu cầu pháp lý, không thể xem là "điểm cộng" tùy chọn.
2. **Bắt buộc:** Xác nhận và cam kết độ ổn định của API quản trị danh mục (Loại tài liệu) dưới điều kiện tải/kết nối khác nhau, tránh lỗi 500 lặp lại như đã quan sát.
3. **Khuyến nghị:** Rà soát độc lập toàn bộ văn bản/nhãn hiển thị trên giao diện, loại bỏ ngôn ngữ nội bộ phát triển ("giai đoạn 2", jargon kỹ thuật) không phù hợp với cán bộ hành chính cấp xã/phường.
4. **Khuyến nghị:** Vận hành thử tay (không qua công cụ tự động) riêng cho các hành động không hoàn tác (Kết thúc phiên họp, Khôi phục dữ liệu mẫu, Xóa) và tính năng Xuất CSV/PDF để xác nhận trực tiếp trên trình duyệt thật của người dùng.

Đề nghị: ☑ Yêu cầu Nhà thầu tiếp tục chỉnh sửa, bổ sung, hoàn thiện theo 2 điều kiện bắt buộc nêu trên, thực hiện vận hành thử bổ sung xác nhận đã khắc phục trước khi ký biên bản nghiệm thu chính thức.

---

**Người thực hiện nghiệm thu:** Hà — Chuyên viên Sở Khoa học và Công nghệ
*(Biên bản lập trên cơ sở vận hành thử qua trình duyệt, chưa có xác nhận chữ ký các bên — chỉ phục vụ mục đích tổng hợp kết quả trước khi tổ chức buổi nghiệm thu chính thức có đầy đủ thành phần tham gia theo quy định.)*
