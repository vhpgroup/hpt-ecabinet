CÔNG TY [Tên đầy đủ pháp nhân HPT TECH]
Số: [Số văn bản]/CV-HPT

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập – Tự do – Hạnh phúc

Hải Phòng, ngày [Ngày ký]

# VĂN BẢN ĐỀ NGHỊ LÀM RÕ HỒ SƠ MỜI THẦU (E-HSMT)

**Kính gửi:** Sở Khoa học và Công nghệ thành phố Hải Phòng (Bên mời thầu)

**Về:** Gói thầu "Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu"

---

Căn cứ E-HSMT Chương V — Yêu cầu kỹ thuật chi tiết đã được phát hành (`docs/hsmt-chuong-v.md`), trong quá trình nghiên cứu hồ sơ để chuẩn bị hồ sơ dự thầu, [Tên đầy đủ pháp nhân HPT TECH] nhận thấy một số nội dung cần được Bên mời thầu làm rõ để nhà thầu xây dựng phương án kỹ thuật, tổ chức nhân sự và tính toán chi phí chính xác, phù hợp với yêu cầu thực tế. Kính đề nghị Bên mời thầu xem xét, trả lời các câu hỏi sau trong giai đoạn hỏi–đáp E-HSMT:

---

### Câu 1 — Hình thức ứng dụng nền tảng di động: web di động (PWA) hay ứng dụng cài đặt từ cửa hàng ứng dụng

**Trích dẫn HSMT:** *"Phần mềm được triển khai trên các nền tảng ứng dụng di động phổ biến (Android, iOS), hỗ trợ người dùng thao tác thuận tiện trên các thiết bị thông minh"* (dòng 37); tiêu đề Nhóm B mục 3.4: *"ỨNG DỤNG TRÊN NỀN TẢNG DI ĐỘNG"* (dòng 466).

**Nội dung chưa rõ:** Văn bản không nêu rõ "ứng dụng trên nền tảng di động" có bắt buộc là ứng dụng native được đóng gói và phân phối qua Google Play/App Store, hay chấp nhận ứng dụng web tối ưu cho di động (responsive/Progressive Web App) có đầy đủ nghiệp vụ tương đương.

**Câu hỏi:** Đề nghị Bên mời thầu xác nhận: (a) yêu cầu bắt buộc app cài đặt từ cửa hàng ứng dụng, hay (b) chấp nhận giải pháp web di động đáp ứng đầy đủ nghiệp vụ mục 60–97 HSMT.

**Phương án nhà thầu đề xuất:** Nhà thầu đề xuất giải pháp ứng dụng web di động tối ưu (responsive, có thể cài lên màn hình chính thiết bị) đáp ứng đầy đủ 38 mục nghiệp vụ nhóm B; sẵn sàng bổ sung đóng gói ứng dụng native cho Android/iOS nếu được xác nhận là yêu cầu bắt buộc, với điều kiện được bổ sung thời gian và nguồn lực tương ứng ngoài phạm vi 12 tuần chuẩn bị dịch vụ chính (do đây là hạng mục có quy trình phê duyệt riêng của cửa hàng ứng dụng, nằm ngoài kiểm soát hoàn toàn của nhà thầu).

---

### Câu 2 — Chuẩn chữ ký số bắt buộc

**Trích dẫn HSMT:** Mục chức năng 30: *"Ký số file cho ý kiến vào văn bản"* (dòng 432); Quy trình lấy ý kiến bằng văn bản: *"...có thể ký số đối với ý kiến đã tham gia..."* (dòng 373).

**Nội dung chưa rõ:** HSMT không nêu rõ chuẩn chữ ký số bắt buộc áp dụng: chữ ký số công cộng/chuyên dùng Chính phủ có giá trị pháp lý theo Nghị định 130/2018/NĐ-CP (VGCA/SmartCA), hay chấp nhận cơ chế xác nhận nội bộ (không cần chứng thư số do tổ chức cung cấp dịch vụ chứng thực chữ ký số cấp) chỉ nhằm xác nhận nội dung, chống chối bỏ trong nội bộ hệ thống.

**Câu hỏi:** Đề nghị xác nhận mức độ bắt buộc của chữ ký số đối với: (a) biên bản/kết luận cuộc họp, (b) ý kiến góp ý vào văn bản lấy ý kiến — có cần giá trị pháp lý theo pháp luật về chữ ký số hay chỉ cần cơ chế xác nhận nội bộ.

**Phương án nhà thầu đề xuất:** Nếu bắt buộc chuẩn pháp lý đầy đủ, Nhà thầu sẽ tích hợp giải pháp của tổ chức cung cấp dịch vụ chứng thực chữ ký số được cấp phép (chữ ký số chuyên dùng Chính phủ hoặc chữ ký số công cộng), triển khai từ giai đoạn sớm của kế hoạch 12 tuần do có phụ thuộc bên ngoài (cấp phép, tích hợp SDK). Nếu chỉ cần cơ chế xác nhận nội bộ, hệ thống hiện đã có module xác nhận bằng mã định danh cá nhân kèm băm nội dung để chống chối bỏ trong phạm vi nội bộ, có thể nâng cấp lên chuẩn pháp lý đầy đủ khi có yêu cầu chính thức trong quá trình vận hành (theo `docs/ho-so/07-phuong-an-nang-cap-quy-dinh-moi.md`).

---

### Câu 3 — Đặc tả kỹ thuật kết nối LGSP/IOC thành phố Hải Phòng

**Trích dẫn HSMT:** *"...sẵn sàng cung cấp các API phục vụ kết nối, chia sẻ dữ liệu với các hệ thống khác có liên quan"* (dòng 340); *"...thực hiện kết nối với IOC chỉ được thực hiện sau khi quá trình vận hành thử cho thấy hệ thống hoạt động ổn định..."* (dòng 636); Công văn 3788/BTTTT-THH về liên thông dữ liệu bằng XML (dòng 328).

**Nội dung chưa rõ:** Chưa có đặc tả kỹ thuật cụ thể (giao thức, định dạng dữ liệu, endpoint, cơ chế xác thực) của Trục LGSP và hệ thống IOC thành phố Hải Phòng để nhà thầu thiết kế bộ kết nối (adapter) đúng ngay từ giai đoạn chuẩn bị hồ sơ. Đặc biệt, HSMT vừa dẫn chiếu Công văn 3788/BTTTT-THH (hướng dẫn liên thông bằng ngôn ngữ XML — dòng 328) vừa yêu cầu chung "API" (dòng 340) không nêu rõ định dạng payload trao đổi (XML hay JSON), là 2 chuẩn có yêu cầu kỹ thuật xử lý khác nhau đáng kể.

**Câu hỏi:** Đề nghị cung cấp đặc tả kỹ thuật của Trục LGSP và hệ thống IOC Hải Phòng, đồng thời xác nhận rõ định dạng dữ liệu trao đổi bắt buộc là XML (theo Công văn 3788/BTTTT-THH) hay JSON (theo chuẩn REST API phổ biến hiện nay), hoặc hệ thống có hỗ trợ song song cả hai định dạng.

**Phương án nhà thầu đề xuất:** Hệ thống eCabinet đã có sẵn bộ API mở theo chuẩn REST/JSON, có tài liệu đặc tả OpenAPI tự sinh; sẵn sàng bổ sung lớp chuyển đổi dữ liệu (adapter XML) nếu Trục LGSP thành phố yêu cầu định dạng XML theo Công văn 3788/BTTTT-THH.

---

### Câu 4 — Số lượng xã/phường/đặc khu và số tài khoản dự kiến theo đơn vị

**Trích dẫn HSMT:** *"Hệ thống cần đáp ứng cho tối thiểu 500 người sử dụng, trong đó 90 người sử dụng ở một thời điểm"* (dòng 62, 535); *"Đơn vị sử dụng dịch vụ: Các xã, phường, đặc khu trên địa bàn thành phố Hải Phòng"* (dòng 22).

**Nội dung chưa rõ:** HSMT chỉ ghi tổng số 500 người dùng/90 đồng thời cho toàn gói, không ghi rõ danh sách cụ thể số đơn vị hành chính cấp xã (sau sắp xếp/sáp nhập) sẽ triển khai và số tài khoản dự kiến phân bổ theo từng đơn vị.

**Câu hỏi:** Đề nghị cung cấp danh sách cụ thể các xã, phường, đặc khu sẽ triển khai và số lượng tài khoản dự kiến phân bổ theo từng đơn vị, để nhà thầu tính đúng quy mô sizing hạ tầng và kế hoạch cấp phát tài khoản.

**Phương án nhà thầu đề xuất:** Trong khi chờ danh sách chính thức, Nhà thầu thiết kế hệ thống theo kiến trúc cho phép mở rộng linh hoạt số đơn vị/tài khoản mà không cần thay đổi cấu trúc (đúng tiêu chí 2.2 HSMT dòng 63 "mở rộng không giới hạn số người sử dụng").

---

### Câu 5 — Nền tảng công nghệ .NET/MSSQL/Windows Server: bắt buộc hay tham khảo

**Trích dẫn HSMT:** *"Nền tảng công nghệ lập trình: .NET"*; *"Hệ quản trị Cơ sở dữ liệu: Microsoft SQL Server 2022 trở lên"*; *"Hệ điều hành máy chủ: Windows server OS (2019) hoặc cao hơn, Linux"* (dòng 332–335); *"Phụ thuộc nền tảng: MS SQL Server, Windows Server, Microsoft Visual Studio, .NET 8.0 trở lên"* (dòng 544).

**Nội dung chưa rõ:** Chưa rõ đây là tiêu chí "Đạt/Không đạt" áp dụng cứng khi chấm thầu, hay là mô tả tham khảo/định hướng cho hạ tầng do Trung tâm dữ liệu thành phố cấp, chấp nhận công nghệ khác nếu đáp ứng tương đương về chức năng, hiệu năng, an toàn thông tin. Đồng thời, dòng 334 (mục "Yêu cầu các tiêu chuẩn về nền tảng công nghệ") ghi hệ điều hành máy chủ gồm cả "Windows server OS... hoặc cao hơn, Linux", nhưng dòng 544 (mục "Các ràng buộc đối với hệ thống") chỉ ghi "Windows Server" — có điểm chưa nhất quán giữa hai vị trí trong cùng văn bản về việc Linux có được chấp nhận cho máy chủ ứng dụng/CSDL hay không.

**Câu hỏi:** Đề nghị xác nhận: (a) nền tảng công nghệ .NET/MSSQL/Windows Server là tiêu chí Đạt/Không đạt bắt buộc hay tiêu chí tham khảo, chấp nhận công nghệ tương đương nếu đáp ứng đầy đủ chức năng/hiệu năng/an toàn thông tin theo yêu cầu; (b) làm rõ điểm chưa nhất quán giữa dòng 334 và dòng 544 về việc Linux có được chấp nhận làm hệ điều hành máy chủ ứng dụng/CSDL hay chỉ giới hạn cho máy chủ tệp (File-Server, theo bảng sizing dòng 322 ghi "Ubuntu Server").

**Phương án nhà thầu đề xuất:** Nhà thầu đã chuẩn bị sẵn phiên bản triển khai đầy đủ trên nền .NET 8 + SQL Server 2022, đáp ứng đúng yêu cầu nếu là tiêu chí bắt buộc; đề nghị làm rõ để xác định phương án triển khai chính thức phù hợp hạ tầng thực tế được cấp.

---

### Câu 6 — Hạ tầng do Trung tâm dữ liệu thành phố cấp hay nhà thầu tự mang

**Trích dẫn HSMT:** *"Trách nhiệm của đơn vị quản lý Trung tâm dữ liệu thành phố Hải Phòng: Bố trí hạ tầng kỹ thuật để triển khai hệ thống, bao gồm máy chủ, hệ điều hành, hệ quản trị cơ sở dữ liệu, hệ thống mạng và các thành phần hạ tầng liên quan"* (dòng 160–165).

**Nội dung chưa rõ:** Với quy định trên, có thể hiểu nhà thầu không cần tự đầu tư hạ tầng theo bảng cấu hình máy chủ đề xuất tại HSMT (2× Database-Server 32 vCPU/64GB, 2× Web-Server 16 vCPU/32GB, 2× App-Server 16 vCPU/32GB, 1× File-Server 8 vCPU/16GB — dòng 318–322), nhưng văn bản chưa nêu rõ thời điểm và điều kiện nhà thầu được cấp phát các máy chủ ảo (VM)/tài khoản quản trị hạ tầng để bắt đầu lắp đặt, cấu hình phần mềm.

**Câu hỏi:** Đề nghị xác nhận: (a) nhà thầu không cần tự đầu tư hạ tầng theo bảng cấu hình đề xuất tại dòng 318–322; (b) thời điểm dự kiến cấp phát VM/tài khoản quản trị hạ tầng sau khi hợp đồng có hiệu lực, để nhà thầu lập kế hoạch triển khai 12 tuần chính xác (`docs/ho-so/09-ke-hoach-trien-khai.md`).

**Phương án nhà thầu đề xuất:** Kế hoạch triển khai 12 tuần của Nhà thầu giả định môi trường hạ tầng đích (staging) sẵn sàng từ Tuần 1–2; nếu thời điểm cấp phát thực tế trễ hơn, đề nghị điều chỉnh tương ứng thời hạn 03 tháng chuẩn bị dịch vụ.

---

### Câu 7 — Giới hạn dung lượng lưu trữ tài liệu, video họp

**Trích dẫn HSMT:** Bảng cấu hình máy chủ đề xuất — 3/4 dòng máy chủ có cột "Dung lượng lưu trữ" (500Gb, 200Gb, 200Gb), riêng dòng File-Server (lưu tệp video, media, tệp đính kèm) để trống cột này (dòng 318–322).

**Nội dung chưa rõ:** HSMT không nêu giới hạn dung lượng file đính kèm mỗi lần tải lên, cũng như tổng dung lượng lưu trữ dự kiến cho toàn bộ 60 tháng thuê dịch vụ (bao gồm video/ghi âm cuộc họp trực tuyến, nếu có lưu trữ).

**Câu hỏi:** Đề nghị làm rõ: (a) giới hạn dung lượng tối đa mỗi tệp tải lên; (b) tổng dung lượng lưu trữ dự kiến cho File-Server trong 60 tháng; (c) chính sách lưu trữ/xóa dữ liệu video cuộc họp trực tuyến (nếu có) — lưu vĩnh viễn hay theo thời hạn nhất định.

**Phương án nhà thầu đề xuất:** Nhà thầu thiết kế cơ chế lưu trữ có khả năng mở rộng dung lượng theo module hóa, không phụ thuộc cấu hình cố định ban đầu, để linh hoạt điều chỉnh khi có số liệu chính thức.

---

### Câu 8 — Phạm vi dữ liệu bắt buộc mã hóa bằng mật mã cơ yếu

**Trích dẫn HSMT:** *"...các dữ liệu thuộc diện bắt buộc phải mã hóa được thực hiện mã hóa/giải mã bằng mật mã cơ yếu khi lưu trữ, truyền, nhận và chia sẻ trên mạng máy tính..."* (dòng 75).

**Nội dung chưa rõ:** Chưa xác định rõ danh mục dữ liệu cụ thể của hệ thống thuộc "diện bắt buộc" phải áp dụng mật mã cơ yếu (biên bản họp đánh dấu Mật? phiếu biểu quyết kín? toàn bộ cơ sở dữ liệu?) — nội dung này quyết định phạm vi phải tích hợp giải pháp của Ban Cơ yếu Chính phủ.

**Câu hỏi:** Đề nghị Bên mời thầu/Chủ đầu tư xác định rõ danh mục dữ liệu thuộc diện bắt buộc áp dụng mật mã cơ yếu, làm cơ sở để nhà thầu thiết kế đúng phạm vi tích hợp.

**Phương án nhà thầu đề xuất:** Trong khi chờ xác định danh mục cụ thể, Nhà thầu áp dụng mã hóa kênh truyền (TLS 1.2 trở lên) cho toàn bộ hệ thống và sẵn sàng bổ sung mã hóa cơ yếu cho phần dữ liệu được xác định thuộc diện bắt buộc ngay khi có xác nhận chính thức, đúng cam kết tại `docs/ho-so/01-cam-ket-bao-mat.md` Mục II.2.2.

---

### Câu 9 — Toàn văn Phụ lục 11, Phụ lục 12 TT 18/2024/TT-BTTTT và Phụ lục II TT 16/2024/TT-BTTTT

**Trích dẫn HSMT:** HSMT chỉ dẫn chiếu số hiệu phụ lục mà không đính kèm toàn văn: *"...theo Phụ lục số 11, Thông tư 18/2024/TT-BTTTT..."* (dòng 147), *"...theo Phụ lục số 12, Thông tư 18/2024/TT-BTTTT..."* (dòng 226), *"...theo Phụ lục II ban hành kèm theo Thông tư số 16/2024/TT-BTTTT..."* (dòng 260).

**Nội dung chưa rõ:** Nhà thầu chưa có bản đầy đủ 3 phụ lục nêu trên để đối chiếu từng mục cụ thể khi soạn quy trình quản trị vận hành, quy trình bảo trì, kịch bản vận hành thử theo đúng mẫu chuẩn của Bộ Thông tin và Truyền thông (nay thuộc Bộ Khoa học và Công nghệ theo cơ cấu tổ chức mới), tránh sai cấu trúc khi nộp hồ sơ.

**Câu hỏi:** Đề nghị cung cấp (đính kèm hoặc chỉ dẫn nguồn công khai chính thức) toàn văn 3 phụ lục nêu trên.

**Phương án nhà thầu đề xuất:** Nhà thầu đã soạn `docs/ho-so/04-quy-trinh-quan-tri-van-hanh.md`, `docs/ho-so/05-quy-trinh-bao-tri.md`, `docs/ho-so/03-kich-ban-kiem-thu-van-hanh-thu.md` dựa trên nội dung tóm lược đã có trong HSMT; sẵn sàng điều chỉnh, bổ sung cho khớp hoàn toàn với mẫu chuẩn khi nhận được toàn văn phụ lục.

---

### Câu 10 — Tiêu chí đánh giá Đạt/Không đạt tại Chương III (năng lực, kinh nghiệm)

**Trích dẫn HSMT:** Toàn bộ nội dung đọc được thuộc Chương V "Yêu cầu kỹ thuật chi tiết"; không thuộc phạm vi Chương III.

**Nội dung chưa rõ:** Chương V không đề cập tiêu chí về năng lực, kinh nghiệm (ví dụ: yêu cầu hợp đồng tương tự đã nghiệm thu).

**Câu hỏi:** Đề nghị xác nhận gói thầu có yêu cầu về hợp đồng tương tự đã thực hiện/nghiệm thu hay không, và tiêu chí cụ thể (nếu có) — nội dung này thuộc phạm vi hồ sơ pháp lý/năng lực, cần xác nhận sớm để chuẩn bị đầy đủ hồ sơ dự thầu.

**Phương án nhà thầu đề xuất:** Không áp dụng (câu hỏi mang tính xác nhận phạm vi hồ sơ, không có phương án kỹ thuật kèm theo).

---

### Câu 11 — Chu kỳ "kiểm tra định kỳ" trong giai đoạn thuê dịch vụ

**Trích dẫn HSMT:** Nhiều mục trong bảng tiêu chí chất lượng dịch vụ ghi *"Tổ chức kiểm tra định kỳ để xác định các chức năng hoạt động không chính xác (nếu có)..."* nhưng không ghi rõ chu kỳ cụ thể (dòng 58, 59, 60, 65, 66...).

**Nội dung chưa rõ:** Không rõ "định kỳ" là hằng tháng, hằng quý, hay theo chu kỳ khác — ảnh hưởng đến kế hoạch bố trí nhân sự vận hành phục vụ các đợt kiểm tra này trong suốt 60 tháng thuê dịch vụ.

**Câu hỏi:** Đề nghị xác định cụ thể chu kỳ "kiểm tra định kỳ" áp dụng cho các tiêu chí chất lượng dịch vụ nêu trên.

**Phương án nhà thầu đề xuất:** Nhà thầu đề xuất chu kỳ kiểm tra định kỳ hằng quý đối với các tiêu chí chức năng nghiệp vụ, tích hợp vào nội dung Báo cáo dịch vụ 6 tháng (`docs/ho-so/02-cam-ket-sla.md`), có thể điều chỉnh theo thống nhất của hai bên.

---

### Câu 12 — Định dạng dữ liệu trao đổi qua LGSP: XML hay JSON (bổ sung, liên quan Câu 3)

**Trích dẫn HSMT:** Công văn 3788/BTTTT-THH ngày 26/12/2014 *"về việc hướng dẫn liên thông, trao đổi dữ liệu có cấu trúc bằng ngôn ngữ XML giữa các hệ thống thông tin trong cơ quan nhà nước"* (dòng 328) — được liệt là 1 trong các tiêu chuẩn kỹ thuật áp dụng cho việc kết nối chia sẻ dữ liệu, trong khi phần "sẵn sàng cung cấp các API" (dòng 340) không chỉ rõ định dạng.

**Nội dung chưa rõ:** Đây là câu hỏi tách riêng, cụ thể hóa từ Câu 3, vì ảnh hưởng trực tiếp đến việc lựa chọn công nghệ xây dựng adapter (REST/JSON hiện đại phổ biến vs. SOAP/XML theo hướng dẫn 2014) — hai hướng có effort kỹ thuật khác biệt đáng kể.

**Câu hỏi:** Trục LGSP thành phố Hải Phòng hiện tại (năm 2026) có còn áp dụng chuẩn XML theo Công văn 3788/BTTTT-THH (2014), hay đã chuyển đổi sang chuẩn REST/JSON hiện đại hơn? Đề nghị cung cấp bản đặc tả kỹ thuật mới nhất đang áp dụng thực tế.

**Phương án nhà thầu đề xuất:** Đã nêu tại Câu 3 (thiết kế song song, ưu tiên REST/JSON, bổ sung adapter XML nếu bắt buộc).

---

### Câu 13 — Hệ điều hành máy trạm: chỉ Windows hay đa nền tảng (Windows/Linux/macOS)

**Trích dẫn HSMT:** Mục "Yêu cầu các tiêu chuẩn về nền tảng công nghệ": *"Hệ điều hành máy trạm: Windows 10 hoặc cao hơn"* (dòng 335); Mục "Yêu cầu về mỹ thuật, kỹ thuật... độ phức tạp": *"...phải hỗ trợ nhiều hệ điều hành của các máy trạm: Windows 10, Windows 11, Linux, Mac OS"* (dòng 560).

**Nội dung chưa rõ:** Hai vị trí trong cùng văn bản HSMT nêu phạm vi hệ điều hành máy trạm khác nhau — dòng 335 chỉ ghi Windows, dòng 560 ghi đầy đủ 4 hệ điều hành (Windows 10, Windows 11, Linux, macOS). Đây là điểm chưa nhất quán nội tại cần được xác nhận để nhà thầu xác định đúng phạm vi kiểm thử tương thích trình duyệt/hệ điều hành máy trạm.

**Câu hỏi:** Đề nghị xác nhận phạm vi hệ điều hành máy trạm chính thức mà hệ thống phải hỗ trợ đầy đủ: chỉ Windows, hay đầy đủ Windows/Linux/macOS như dòng 560.

**Phương án nhà thầu đề xuất:** Hệ thống eCabinet được xây dựng dưới dạng ứng dụng web chạy trên trình duyệt hiện đại (Chrome, Edge, Firefox, Cốc Cốc), về nguyên tắc kỹ thuật hoạt động không phân biệt hệ điều hành máy trạm (Windows/Linux/macOS); Nhà thầu sẽ thực hiện kiểm thử tương thích đầy đủ trên cả 4 hệ điều hành nêu tại dòng 560 trong giai đoạn vận hành thử để bảo đảm không phát sinh rủi ro dù kết quả làm rõ theo hướng nào.

---

### Câu 14 — Số hiệu Nghị định căn cứ nghiệm thu tại phần cuối HSMT

**Trích dẫn HSMT:** Mục "Quy định về kiểm tra, nghiệm thu sản phẩm": *"Việc kiểm tra, nghiệm thu sản phẩm tuân thủ theo quy định tại Nghị định số 45/2026/NĐ-CP ngày 26/01/2026 của Chính phủ..."* (dòng 668–669).

**Nội dung chưa rõ:** Nhà thầu ghi nhận số hiệu văn bản này (Nghị định 45/2026/NĐ-CP, ngày 26/01/2026) theo bản HSMT điện tử đã nhận; do đây là căn cứ pháp lý quan trọng cho toàn bộ công tác nghiệm thu, đề nghị Bên mời thầu xác nhận lại số hiệu, ngày ban hành chính xác (đối chiếu với bản gốc/công báo) để tránh sai sót khi nhà thầu trích dẫn trong hồ sơ dự thầu và các văn bản hợp đồng sau này.

**Câu hỏi:** Đề nghị xác nhận số hiệu, ngày ban hành chính xác của Nghị định căn cứ nghiệm thu nêu tại dòng 668–669 HSMT.

**Phương án nhà thầu đề xuất:** Không áp dụng (câu hỏi mang tính xác nhận văn bản, không có phương án kỹ thuật kèm theo).

---

## Kết luận

Kính đề nghị Bên mời thầu xem xét, trả lời các câu hỏi nêu trên trong thời hạn quy định của giai đoạn hỏi–đáp E-HSMT, để [Tên đầy đủ pháp nhân HPT TECH] có đầy đủ căn cứ hoàn thiện hồ sơ dự thầu và phương án kỹ thuật chính xác, phù hợp với yêu cầu thực tế của Chủ đầu tư.

Trân trọng./.

---

**ĐẠI DIỆN NHÀ THẦU**
[Chức vụ]

[Họ tên]
*(Ký, ghi rõ họ tên, đóng dấu)*
