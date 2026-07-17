# QUY TRÌNH QUẢN TRỊ, VẬN HÀNH HỆ THỐNG

**Gói thầu:** Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu
**Sản phẩm:** Phần mềm eCabinet
**Đơn vị lập:** [Tên đầy đủ pháp nhân HPT TECH]

## Căn cứ

- E-HSMT Chương V, mục "Yêu cầu về quản trị, vận hành hệ thống": *"Nội dung về quản trị vận hành hệ thống yêu cầu đảm bảo đáp ứng các nội dung chủ yếu được quy định tại Phụ lục số 11, Thông tư 18/2024/TT-BTTTT ngày 30/12/2024 của Bộ trưởng Bộ Thông tin và Truyền thông"* (`docs/hsmt-chuong-v.md` dòng 146–224).
- Bao gồm 8 nội dung/quy trình con: (1) Tổ chức thực hiện quản trị, vận hành; (2) Quản trị vận hành ứng dụng; (3) Quản trị hoạt động người sử dụng; (4) Kiểm soát, đối soát dữ liệu; (5) Tiếp nhận, kiểm tra, hỗ trợ yêu cầu không liên quan cập nhật dữ liệu; (6) Tiếp nhận, kiểm tra, hỗ trợ yêu cầu liên quan xử lý dữ liệu; (7) Lập báo cáo, tài liệu, quy trình hướng dẫn thường gặp; (8) Xây dựng công cụ/câu lệnh khai thác số liệu theo mẫu biểu chưa có.
- Yêu cầu tại tiêu chí 6.1 bảng chất lượng dịch vụ: *"Ban hành đầy đủ các quy trình quản lý dịch vụ và thống nhất với đơn vị thuê trước khi triển khai"* (dòng 113).

Tài liệu này ban hành đầy đủ 8 quy trình con theo đúng cấu trúc HSMT, dùng làm phụ lục kỹ thuật của hợp đồng, thống nhất với Sở Khoa học và Công nghệ TP Hải Phòng trước khi triển khai chính thức.

---

## QUY TRÌNH 1 — TỔ CHỨC THỰC HIỆN QUẢN TRỊ, VẬN HÀNH

**Mục đích:** Xác định rõ vai trò, trách nhiệm của từng bên (Nhà thầu — Sở Khoa học và Công nghệ — Trung tâm dữ liệu thành phố) trong việc bảo đảm hệ thống hoạt động ổn định, liên tục trong suốt 60 tháng thuê dịch vụ.

**Phạm vi:** Áp dụng cho toàn bộ hoạt động quản trị, vận hành phần mềm eCabinet kể từ khi nghiệm thu, bàn giao đưa vào sử dụng.

**Căn cứ:** HSMT dòng 149–170.

### 1. Trách nhiệm của Nhà thầu (đơn vị cung cấp dịch vụ)
- Bố trí nhân lực thực hiện quản trị, vận hành phần mềm trong suốt thời gian cung cấp dịch vụ (tối thiểu: 01 quản trị viên trực chính, 01 quản trị viên dự phòng, có phân ca 24/7 — xem `docs/ho-so/02-cam-ket-sla.md` mục 1 dòng 13).
- Thực hiện cài đặt, cấu hình, vận hành và duy trì hoạt động của phần mềm.
- Phối hợp với Sở Khoa học và Công nghệ và Trung tâm Công nghệ thông tin trong toàn bộ quá trình vận hành hệ thống.
- Thực hiện các công việc cần thiết khác để bảo đảm phần mềm hoạt động ổn định, liên tục.

### 2. Trách nhiệm của Sở Khoa học và Công nghệ thành phố Hải Phòng
- Bố trí cán bộ quản trị và sử dụng hệ thống phía Chủ đầu tư.
- Quản lý tài khoản người sử dụng theo phân cấp (phê duyệt cấp phát tài khoản, phân quyền theo đề xuất của Nhà thầu — xem Quy trình 3).
- Phối hợp với Nhà thầu trong quá trình vận hành, xử lý sự cố và hỗ trợ người sử dụng.
- Khai thác và sử dụng hệ thống theo chức năng được cung cấp.

### 3. Trách nhiệm của đơn vị quản lý Trung tâm dữ liệu thành phố Hải Phòng
- Bố trí hạ tầng kỹ thuật để triển khai hệ thống: máy chủ, hệ điều hành, hệ quản trị cơ sở dữ liệu, hệ thống mạng và các thành phần hạ tầng liên quan.
- Thực hiện quản trị, vận hành và bảo đảm hoạt động ổn định của hạ tầng Trung tâm dữ liệu.
- Bảo đảm nguồn điện, kết nối mạng, an toàn vật lý và an toàn thông tin cho hạ tầng.
- Phối hợp với Nhà thầu trong quá trình triển khai, vận hành và xử lý sự cố; phối hợp bảo đảm an toàn thông tin cho hệ thống.

### 4. Cơ chế phối hợp vận hành
- Ba bên (Nhà thầu, Sở Khoa học và Công nghệ, Trung tâm Công nghệ thông tin) thiết lập kênh liên lạc thường trực (nhóm trao đổi nhanh + hộp thư chung + số điện thoại trực) trong suốt thời gian cung cấp dịch vụ.
- Phân định trách nhiệm rõ ràng: **Nhà thầu chịu trách nhiệm đối với phần mềm; Trung tâm Công nghệ thông tin chịu trách nhiệm đối với hạ tầng kỹ thuật; Sở Khoa học và Công nghệ chịu trách nhiệm quản lý và sử dụng phần mềm** (đúng nguyên văn dòng 168–170 HSMT).
- Tổ chức họp giao ban định kỳ hằng tháng (hoặc theo thỏa thuận) giữa ba bên để rà soát tình hình vận hành, các vấn đề tồn đọng.

**Biểu mẫu áp dụng:** Danh sách phân ca trực (Biểu 01), Biên bản họp giao ban ba bên (Biểu 02).

---

## QUY TRÌNH 2 — QUẢN TRỊ VẬN HÀNH ỨNG DỤNG

**Mục đích:** Bảo đảm phần mềm eCabinet hoạt động ổn định, phát hiện và xử lý kịp thời các lỗi/sự cố phát sinh trong quá trình vận hành.

**Phạm vi:** Toàn bộ hoạt động giám sát, vận hành ở tầng ứng dụng (không bao gồm hạ tầng — thuộc trách nhiệm Trung tâm dữ liệu).

**Căn cứ:** HSMT dòng 172–182.

### Các bước thực hiện

| Bước | Nội dung | Trách nhiệm | Thời hạn |
|---|---|---|---|
| 1 | Vận hành, giám sát hoạt động của phần mềm theo quy trình vận hành đã ban hành | Quản trị viên trực ca | Liên tục 24/7 |
| 2 | Theo dõi nhật ký hoạt động (log) của hệ thống nhằm phát hiện lỗi phát sinh | Quản trị viên trực ca | Liên tục, rà soát chủ động tối thiểu 2 lần/ca |
| 3 | Khi phát hiện dấu hiệu bất thường: xác định nguyên nhân sự cố | Quản trị viên kỹ thuật | Trong vòng 08 giờ kể từ khi phát hiện (theo cam kết SLA) |
| 4 | Thực hiện biện pháp khắc phục hoặc phối hợp với các bên liên quan để xử lý | Quản trị viên kỹ thuật + phối hợp Trung tâm dữ liệu (nếu liên quan hạ tầng) | Theo mức độ ưu tiên sự cố, tối đa 24 giờ để phục hồi hoàn toàn |
| 5 | Hỗ trợ cấu hình, tối ưu hoạt động của phần mềm trong phạm vi chức năng được cung cấp | Quản trị viên kỹ thuật | Theo yêu cầu phát sinh hoặc theo kế hoạch bảo trì |
| 6 | Kiểm tra, hỗ trợ xử lý các vấn đề liên quan đến hoạt động của phần mềm | Quản trị viên kỹ thuật | Theo yêu cầu |
| 7 | Hỗ trợ bảo đảm an toàn thông tin trong phạm vi phần mềm cung cấp | Quản trị viên an toàn thông tin | Liên tục, theo lịch kiểm tra định kỳ (xem `docs/ho-so/05-quy-trinh-bao-tri.md`) |
| 8 | Khắc phục lỗi dữ liệu khi có công cụ và phương án xử lý phù hợp | Quản trị viên kỹ thuật | Theo mức độ ưu tiên, ghi nhận vào nhật ký xử lý |
| 9 | Hỗ trợ khai thác, trích xuất dữ liệu theo yêu cầu của cơ quan sử dụng | Quản trị viên kỹ thuật | Trong vòng 02 ngày làm việc kể từ khi nhận yêu cầu hợp lệ |

**Biểu mẫu áp dụng:** Nhật ký sự cố (Biểu 03), Phiếu yêu cầu trích xuất dữ liệu (Biểu 04).

---

## QUY TRÌNH 3 — QUẢN TRỊ HOẠT ĐỘNG NGƯỜI SỬ DỤNG

**Mục đích:** Bảo đảm việc cấp phát, quản lý tài khoản, phân quyền người sử dụng đúng quy định, đúng thẩm quyền phê duyệt của Sở Khoa học và Công nghệ.

**Phạm vi:** Toàn bộ tài khoản người sử dụng thuộc các xã, phường, đặc khu trên địa bàn thành phố Hải Phòng.

**Căn cứ:** HSMT dòng 184–193.

### Các bước thực hiện

| Bước | Nội dung | Trách nhiệm | Thời hạn |
|---|---|---|---|
| 1 | Đơn vị/cá nhân có nhu cầu gửi yêu cầu tạo/cập nhật/khóa tài khoản theo mẫu (Biểu 05) | Đơn vị đề xuất (xã/phường/đặc khu hoặc Sở) | — |
| 2 | Sở Khoa học và Công nghệ xem xét, phê duyệt việc cấp tài khoản và phân quyền | Sở Khoa học và Công nghệ | Trong vòng 02 ngày làm việc |
| 3 | Nhà thầu hỗ trợ tạo, cập nhật, khóa tài khoản người sử dụng theo yêu cầu đã được phê duyệt | Quản trị viên (Nhà thầu) | Trong vòng 01 ngày làm việc kể từ khi nhận yêu cầu đã phê duyệt |
| 4 | Nhà thầu hỗ trợ phân quyền sử dụng hệ thống theo đúng vai trò đã phê duyệt (5 vai trò: Quản trị hệ thống, Quản trị đơn vị, Chủ trì cuộc họp, Thư ký cuộc họp, Thành viên dự họp) | Quản trị viên (Nhà thầu) | Cùng thời điểm tạo/cập nhật tài khoản |
| 5 | Sở Khoa học và Công nghệ giám sát việc sử dụng hệ thống, bảo đảm sử dụng đúng mục đích, đúng quy định | Sở Khoa học và Công nghệ | Thường xuyên, thông qua nhật ký hệ thống |
| 6 | Nhà thầu hỗ trợ xử lý các vấn đề liên quan đến tài khoản người sử dụng (quên mật khẩu, lỗi đăng nhập, tài khoản trùng lặp...) | Quản trị viên (Nhà thầu) | Trong giờ hành chính, phản hồi trong vòng 02 giờ làm việc |

**Biểu mẫu áp dụng:** Phiếu đề nghị cấp/sửa/khóa tài khoản (Biểu 05), Danh sách tài khoản theo đơn vị (Biểu 06).

---

## QUY TRÌNH 4 — KIỂM SOÁT, ĐỐI SOÁT DỮ LIỆU

**Mục đích:** Bảo đảm dữ liệu của hệ thống được sao lưu, đối soát, phục hồi an toàn, chính xác, không bị mất hoặc sai lệch trong quá trình vận hành.

**Phạm vi:** Toàn bộ dữ liệu nghiệp vụ (cuộc họp, tài liệu, biểu quyết, tài khoản, nhật ký) của hệ thống eCabinet.

**Căn cứ:** HSMT dòng 195–201.

### Các bước thực hiện

| Bước | Nội dung | Trách nhiệm | Thời hạn/Chu kỳ |
|---|---|---|---|
| 1 | Thực hiện sao lưu dữ liệu theo lịch trình đã thiết lập (sao lưu tự động hằng ngày đối với dữ liệu nghiệp vụ; sao lưu toàn bộ hằng tuần) | Quản trị viên kỹ thuật | Hằng ngày/hằng tuần theo lịch |
| 2 | Kiểm tra tính toàn vẹn của bản sao lưu (xác nhận file không rỗng, đối soát checksum) | Quản trị viên kỹ thuật | Ngay sau mỗi lần sao lưu |
| 3 | Hỗ trợ kiểm tra, đối soát dữ liệu theo yêu cầu của Sở Khoa học và Công nghệ (đối soát số lượng bản ghi, đối soát số liệu thống kê giữa các kỳ báo cáo) | Quản trị viên kỹ thuật | Theo yêu cầu, hoặc định kỳ hằng quý |
| 4 | Hỗ trợ phục hồi dữ liệu khi cần thiết (do sự cố kỹ thuật hoặc theo yêu cầu khôi phục dữ liệu cụ thể) | Quản trị viên kỹ thuật | Bảo đảm phục hồi trong 24 giờ, 100% dữ liệu (theo cam kết SLA) |
| 5 | Bảo đảm dữ liệu được lưu trữ và quản lý an toàn (mã hóa lưu trữ đối với dữ liệu thuộc diện bắt buộc, phân quyền truy cập bản sao lưu) | Quản trị viên an toàn thông tin | Liên tục |
| 6 | Lập báo cáo kết quả sao lưu, đối soát định kỳ, đưa vào nội dung Báo cáo dịch vụ 6 tháng (`docs/ho-so/02-cam-ket-sla.md` Mục III) | Quản trị viên kỹ thuật | Theo kỳ báo cáo |

**Biểu mẫu áp dụng:** Nhật ký sao lưu (Biểu 07), Phiếu yêu cầu đối soát/phục hồi dữ liệu (Biểu 08).

---

## QUY TRÌNH 5 — TIẾP NHẬN, KIỂM TRA, HỖ TRỢ YÊU CẦU KHÔNG LIÊN QUAN ĐẾN CẬP NHẬT DỮ LIỆU

**Mục đích:** Xử lý các yêu cầu hỗ trợ mang tính hướng dẫn sử dụng, kiểm tra kỹ thuật, không làm thay đổi dữ liệu nghiệp vụ của hệ thống.

**Phạm vi:** Các yêu cầu hướng dẫn sử dụng chức năng, tra cứu số liệu, lỗi truy cập do hệ thống/đường truyền.

**Căn cứ:** HSMT dòng 203–208.

### Các bước thực hiện

| Bước | Nội dung | Trách nhiệm | Thời hạn |
|---|---|---|---|
| 1 | Tiếp nhận, kiểm tra và hỗ trợ các yêu cầu hướng dẫn sử dụng chức năng trên ứng dụng hoặc kiểm tra dữ liệu | Nhân sự hỗ trợ kỹ thuật (tổng đài) | Trong giờ hành chính, phản hồi trong vòng 02 giờ làm việc |
| 2 | Tiếp nhận, kiểm tra và hỗ trợ các yêu cầu hướng dẫn người sử dụng tra cứu số liệu trên chức năng ứng dụng | Nhân sự hỗ trợ kỹ thuật | Trong vòng 02 giờ làm việc |
| 3 | Tiếp nhận, phân tích, kiểm tra và hỗ trợ yêu cầu lỗi không vào được ứng dụng do lỗi hệ thống, cơ sở dữ liệu, đường truyền | Quản trị viên kỹ thuật (leo thang từ tổng đài nếu cần) | Xác định nguyên nhân trong 08 giờ (theo SLA), phục hồi trong 24 giờ |
| 4 | Kiểm tra lại ứng dụng sau khi khắc phục được lỗi hệ thống, cơ sở dữ liệu, đường truyền | Quản trị viên kỹ thuật | Ngay sau khi khắc phục, trước khi thông báo người dùng đã xử lý xong |
| 5 | Ghi nhận toàn bộ yêu cầu vào hệ thống theo dõi (ticket/nhật ký hỗ trợ) để phục vụ báo cáo và phân tích xu hướng | Nhân sự hỗ trợ kỹ thuật | Ngay khi tiếp nhận và khi đóng yêu cầu |

**Biểu mẫu áp dụng:** Phiếu tiếp nhận yêu cầu hỗ trợ (Biểu 09).

---

## QUY TRÌNH 6 — TIẾP NHẬN, KIỂM TRA, HỖ TRỢ YÊU CẦU LIÊN QUAN ĐẾN XỬ LÝ DỮ LIỆU

**Mục đích:** Xử lý các yêu cầu có liên quan trực tiếp đến việc kiểm tra, cập nhật dữ liệu của người dùng cụ thể theo đúng thẩm quyền.

**Phạm vi:** Yêu cầu kiểm tra/cập nhật dữ liệu của một người dùng hoặc một nhóm dữ liệu cụ thể.

**Căn cứ:** HSMT dòng 210–214.

### Các bước thực hiện

| Bước | Nội dung | Trách nhiệm | Thời hạn |
|---|---|---|---|
| 1 | Tiếp nhận, kiểm tra dữ liệu của một người dùng theo yêu cầu (có xác nhận thẩm quyền yêu cầu — tài khoản đề nghị hoặc quản trị đơn vị/Sở) | Nhân sự hỗ trợ kỹ thuật | Trong vòng 01 ngày làm việc |
| 2 | Cập nhật dữ liệu theo công cụ hoặc câu lệnh có sẵn theo yêu cầu (không thao tác trực tiếp trên CSDL sản xuất nếu không qua công cụ được kiểm soát) | Quản trị viên kỹ thuật, có xác nhận của cấp quản lý kỹ thuật trước khi thực hiện | Trong vòng 02 ngày làm việc |
| 3 | Tổng hợp kết quả rà soát dữ liệu và chuyển cho bộ phận chuyên trách xử lý nếu vượt phạm vi công cụ có sẵn | Nhân sự hỗ trợ kỹ thuật | Ngay khi phát hiện vượt phạm vi |
| 4 | Ghi nhận lại toàn bộ thao tác cập nhật dữ liệu vào nhật ký hệ thống (audit log), có thể tra cứu sau này | Hệ thống tự động ghi + Quản trị viên xác nhận | Tức thời khi thực hiện thao tác |
| 5 | Thông báo kết quả xử lý cho người/đơn vị đã yêu cầu | Nhân sự hỗ trợ kỹ thuật | Ngay khi hoàn tất xử lý |

**Biểu mẫu áp dụng:** Phiếu yêu cầu xử lý dữ liệu (Biểu 10), có chữ ký xác nhận thẩm quyền của người/đơn vị đề nghị.

---

## QUY TRÌNH 7 — LẬP BÁO CÁO, TÀI LIỆU HOẶC QUY TRÌNH HƯỚNG DẪN THƯỜNG GẶP

**Mục đích:** Hệ thống hóa kinh nghiệm xử lý các tình huống thường gặp, phục vụ công tác hỗ trợ hiệu quả hơn theo thời gian, giảm thời gian xử lý lặp lại.

**Phạm vi:** Toàn bộ hoạt động hỗ trợ, xử lý sự cố trong quá trình vận hành.

**Căn cứ:** HSMT dòng 216–219.

### Các bước thực hiện

| Bước | Nội dung | Trách nhiệm | Chu kỳ |
|---|---|---|---|
| 1 | Lập báo cáo liên quan đến công tác hỗ trợ (tổng hợp số lượng, loại yêu cầu, thời gian xử lý trung bình) | Quản trị viên kỹ thuật | Hằng tháng, tích hợp vào báo cáo 6 tháng |
| 2 | Rà soát các tình huống hỗ trợ lặp lại nhiều lần, xác định nguyên nhân gốc (root cause) | Quản trị viên kỹ thuật + trưởng nhóm vận hành | Hằng tháng |
| 3 | Xây dựng tài liệu hướng dẫn xử lý các tình huống thường gặp (FAQ/runbook nội bộ) dựa trên kết quả rà soát | Quản trị viên kỹ thuật | Cập nhật liên tục khi có tình huống mới |
| 4 | Phổ biến tài liệu hướng dẫn cho toàn bộ nhân sự hỗ trợ, cập nhật vào kho tài liệu nội bộ dùng chung | Trưởng nhóm vận hành | Ngay khi tài liệu được cập nhật |
| 5 | Đề xuất cải tiến sản phẩm/quy trình nếu tình huống lặp lại cho thấy có thể khắc phục từ gốc (sửa lỗi phần mềm, cải thiện giao diện) | Quản trị viên kỹ thuật, chuyển bộ phận phát triển | Theo kỳ rà soát |

**Biểu mẫu áp dụng:** Báo cáo công tác hỗ trợ hằng tháng (Biểu 11), Sổ tay hướng dẫn xử lý tình huống thường gặp (tài liệu sống, cập nhật liên tục).

---

## QUY TRÌNH 8 — XÂY DỰNG CÔNG CỤ HOẶC CÂU LỆNH ĐỂ KHAI THÁC SỐ LIỆU THEO MẪU BIỂU CHƯA CÓ

**Mục đích:** Đáp ứng nhu cầu khai thác dữ liệu phát sinh của Sở Khoa học và Công nghệ mà các báo cáo/thống kê có sẵn trong phần mềm chưa đáp ứng.

**Phạm vi:** Các yêu cầu khai thác số liệu theo mẫu biểu mới, đặc thù, phát sinh ngoài các báo cáo chuẩn đã có trong hệ thống.

**Căn cứ:** HSMT dòng 221–223.

### Các bước thực hiện

| Bước | Nội dung | Trách nhiệm | Thời hạn |
|---|---|---|---|
| 1 | Tiếp nhận yêu cầu khai thác số liệu theo mẫu biểu cụ thể từ Sở Khoa học và Công nghệ (nêu rõ tiêu chí, định dạng đầu ra mong muốn) | Quản trị viên kỹ thuật | Ngay khi nhận |
| 2 | Phân tích yêu cầu, xác định dữ liệu nguồn, logic tổng hợp cần thiết | Quản trị viên kỹ thuật/phân tích dữ liệu | Trong vòng 03 ngày làm việc |
| 3 | Xây dựng công cụ hoặc câu lệnh khai thác dữ liệu liên quan (báo cáo tùy biến, câu lệnh truy vấn, script xuất dữ liệu) — sử dụng API mở/công cụ nội bộ, không truy vấn trực tiếp trái phép vào CSDL sản xuất | Quản trị viên kỹ thuật | Theo độ phức tạp, thông báo tiến độ cho bên yêu cầu |
| 4 | Kiểm thử kết quả với dữ liệu thực tế, xác nhận độ chính xác trước khi cung cấp | Quản trị viên kỹ thuật | Trước khi bàn giao |
| 5 | Cung cấp kết quả và (nếu phù hợp) lưu công cụ/câu lệnh vào danh mục công cụ khai thác dùng lại cho các yêu cầu tương tự trong tương lai | Quản trị viên kỹ thuật | Ngay khi hoàn tất |

**Biểu mẫu áp dụng:** Phiếu yêu cầu khai thác số liệu theo mẫu biểu mới (Biểu 12), Danh mục công cụ khai thác dữ liệu đã xây dựng (cập nhật liên tục).

---

## Hiệu lực áp dụng

Bộ 8 quy trình trên được thống nhất với Sở Khoa học và Công nghệ thành phố Hải Phòng trước khi triển khai chính thức (đúng yêu cầu tiêu chí 6.1 HSMT dòng 113) và là phụ lục không tách rời của hợp đồng thuê dịch vụ. Trong quá trình vận hành, hai bên có thể thống nhất điều chỉnh, bổ sung quy trình cho phù hợp thực tế, có ghi nhận bằng văn bản (Quản lý thay đổi — tiêu chí 6.5 HSMT dòng 118).

---

**ĐẠI DIỆN NHÀ THẦU**
[Chức vụ]

[Họ tên]
*(Ký, ghi rõ họ tên, đóng dấu)*
