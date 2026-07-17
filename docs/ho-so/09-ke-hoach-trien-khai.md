CÔNG TY [Tên đầy đủ pháp nhân HPT TECH]
Số: [Số văn bản]/CV-HPT

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập – Tự do – Hạnh phúc

Hải Phòng, ngày [Ngày ký]

# KẾ HOẠCH CHUẨN BỊ CUNG CẤP DỊCH VỤ CÔNG NGHỆ THÔNG TIN

**Kính gửi:** Sở Khoa học và Công nghệ thành phố Hải Phòng

**Về:** Gói thầu "Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu"

---

## I. Căn cứ lập kế hoạch

- E-HSMT Chương V: *"Thời gian chuẩn bị cung cấp dịch vụ CNTT: Tối đa 03 tháng"* (`docs/hsmt-chuong-v.md` dòng 19).
- *"Nhà thầu phải cam kết hoàn thành việc chuẩn bị cung cấp dịch vụ CNTT (bao gồm cài đặt, cấu hình, tích hợp, vận hành thử phần mềm, đào tạo,…) trong thời hạn tối đa 03 tháng kể từ ngày hợp đồng có hiệu lực"* (dòng 634).
- *"Nhà thầu có trách nhiệm xây dựng kế hoạch cài đặt, triển khai chi tiết và phải được Chủ đầu tư chấp thuận trước khi thực hiện"* (dòng 635).
- *"Việc đưa hệ thống vào sử dụng chính thức và thực hiện kết nối với IOC chỉ được thực hiện sau khi quá trình vận hành thử cho thấy hệ thống hoạt động ổn định... và được Chủ đầu tư chấp thuận nghiệm thu đưa vào sử dụng"* (dòng 636).
- Mục "Yêu cầu về nghiệm thu, bàn giao, đưa dịch vụ vào sử dụng" (dòng 254–260); Nghị định 45/2026/NĐ-CP; TT 16/2024/TT-BTTTT.

Kế hoạch này chuyển thể từ đề xuất kỹ thuật nội bộ của Nhà thầu, được cấu trúc lại theo đúng thể thức văn bản trình Chủ đầu tư, khớp với các mốc vận hành thử/nghiệm thu theo HSMT.

## II. Nguyên tắc chung

1. Thời điểm bắt đầu (Tuần 1) tính từ ngày hợp đồng có hiệu lực.
2. Tổng thời gian chuẩn bị: **12 tuần (tối đa 03 tháng)**, kết thúc bằng việc nghiệm thu, bàn giao đưa dịch vụ vào sử dụng.
3. Kế hoạch chi tiết dưới đây có thể điều chỉnh về trình tự cụ thể sau khi nhận được phản hồi làm rõ HSMT (xem `docs/ho-so/10-van-ban-lam-ro-hsmt.md`) đối với các vấn đề ảnh hưởng trực tiếp đến phạm vi kỹ thuật (nền tảng công nghệ, địa điểm hạ tầng, chuẩn ký số), nhưng tổng thời hạn 03 tháng không thay đổi.
4. Kế hoạch cụ thể này cần được Chủ đầu tư chấp thuận bằng văn bản trước khi Nhà thầu triển khai chính thức (đúng dòng 635 HSMT).

## III. Bảng kế hoạch theo giai đoạn

### Giai đoạn 1 — Làm rõ & khởi động (Tuần 1–2)

| Công việc | Sản phẩm đầu ra | Trách nhiệm | Mốc nghiệm thu nội bộ |
|---|---|---|---|
| Gửi văn bản làm rõ HSMT (nền tảng công nghệ bắt buộc/tham khảo; địa điểm hạ tầng; chuẩn ký số; đặc tả LGSP/IOC) | Văn bản đề nghị làm rõ (`docs/ho-so/10-van-ban-lam-ro-hsmt.md`) | Nhà thầu → Bên mời thầu | Đã gửi, có biên nhận |
| Làm việc với Trung tâm Công nghệ thông tin/Trung tâm dữ liệu thành phố Hải Phòng: xác nhận hạ tầng cấp phát, network, firewall | Biên bản làm việc, xác nhận thông số hạ tầng | Nhà thầu + Trung tâm Công nghệ thông tin | Có biên bản ký |
| Liên hệ đơn vị quản lý LGSP thành phố: xin đặc tả kỹ thuật kết nối | Đặc tả kỹ thuật LGSP (hoặc xác nhận đang chờ) | Nhà thầu | Đã nhận đặc tả hoặc có văn bản xác nhận thời hạn cấp |
| Khởi động lập hồ sơ xác định cấp độ an toàn hệ thống thông tin (Nghị định 85/2016/NĐ-CP) | Hồ sơ đề xuất cấp độ (bản đầu) | Nhà thầu, phối hợp Chủ đầu tư | Hồ sơ nộp cấp có thẩm quyền |
| Thiết lập môi trường triển khai (staging) trên hạ tầng đích | Môi trường staging hoạt động | Nhà thầu | Kiểm tra truy cập được |

### Giai đoạn 2 — Hạ tầng nền (Tuần 3–4)

| Công việc | Sản phẩm đầu ra | Trách nhiệm | Mốc nghiệm thu nội bộ |
|---|---|---|---|
| Triển khai cơ sở dữ liệu có dự phòng (primary/replica) | Hạ tầng CSDL có khả năng chịu lỗi | Nhà thầu | Kiểm tra chuyển đổi dự phòng hoạt động |
| Triển khai giám sát tập trung (theo dõi hiệu năng, log tập trung, cảnh báo) | Hệ thống giám sát hoạt động | Nhà thầu | Dashboard giám sát hiển thị đúng số liệu |
| Cấu hình cảnh báo sự cố tới nhân sự trực (kênh cảnh báo tức thời) | Cơ chế cảnh báo hoạt động | Nhà thầu | Test gửi cảnh báo thành công |
| Thiết lập quy trình triển khai có kiểm soát (kiểm thử tự động cho luồng nghiệp vụ trọng yếu: biểu quyết, ký số, phân quyền) | Bộ kiểm thử tự động | Nhà thầu | Chạy kiểm thử đạt |
| Bắt đầu tích hợp giải pháp ký số theo chuẩn xác định (tùy kết quả làm rõ ở Giai đoạn 1) | Module ký số (phiên bản đầu) | Nhà thầu | Ký thử nghiệm thành công trên môi trường staging |

### Giai đoạn 3 — Tích hợp & bảo mật (Tuần 5–6)

| Công việc | Sản phẩm đầu ra | Trách nhiệm | Mốc nghiệm thu nội bộ |
|---|---|---|---|
| Hoàn thiện tích hợp ký số chính thức | Module ký số hoàn chỉnh | Nhà thầu | Ký số hoạt động đúng quy trình đã chọn |
| Xây dựng bộ kết nối (adapter) với LGSP theo đặc tả đã nhận (hoặc theo chuẩn REST/dữ liệu có cấu trúc dự kiến nếu đặc tả chưa sẵn sàng, để không chặn tiến độ) | Adapter LGSP (thử nghiệm) | Nhà thầu | Kết nối thử thành công với dữ liệu mô phỏng |
| Rà soát, vá theo yêu cầu an toàn thông tin Cấp độ 3: phân vùng mạng, kiểm soát truy cập, mã hóa dữ liệu lưu trữ, xác thực nhiều lớp cho tài khoản quản trị | Checklist ATTT Cấp độ 3 hoàn thành từng mục | Nhà thầu | Đối chiếu checklist TT 12/2022/TT-BTTTT |
| Cấu hình tường lửa ứng dụng (WAF) | WAF hoạt động | Nhà thầu, phối hợp Trung tâm dữ liệu | Kiểm tra chặn tấn công mẫu (OWASP) |
| Kiểm thử tải sơ bộ (baseline) | Báo cáo kiểm thử tải sơ bộ | Nhà thầu | Có số liệu p95 ban đầu |

### Giai đoạn 4 — Hiệu năng & độ tin cậy (Tuần 7–8)

| Công việc | Sản phẩm đầu ra | Trách nhiệm | Mốc nghiệm thu nội bộ |
|---|---|---|---|
| Kiểm thử tải đầy đủ ở quy mô 500 người dùng/90 người dùng đồng thời, đo thời gian phản hồi theo từng loại thao tác | Báo cáo kiểm thử tải chính thức | Nhà thầu | Đạt ngưỡng cam kết SLA (`docs/ho-so/02-cam-ket-sla.md`) |
| Tối ưu hiệu năng cơ sở dữ liệu theo kết quả kiểm thử tải | Hệ thống đã tối ưu | Nhà thầu | Kiểm thử lại đạt ngưỡng |
| Kiểm thử khôi phục từ bản sao lưu toàn diện (dữ liệu + tệp đính kèm) | Báo cáo kiểm thử khôi phục | Nhà thầu | Khôi phục đúng 100%, đo được thời gian thực hiện |
| Lập quy trình ứng cứu sự cố (thời gian phục hồi mục tiêu 24 giờ) | Quy trình ứng cứu sự cố | Nhà thầu | Đã ban hành, có trong `docs/ho-so/04-quy-trinh-quan-tri-van-hanh.md` |
| Thiết lập triển khai không gây gián đoạn dịch vụ (cập nhật hệ thống có kiểm tra tình trạng trước/sau) | Cơ chế triển khai hoạt động | Nhà thầu | Triển khai thử không gây gián đoạn |
| Khởi động đặt lịch với đơn vị quét lỗ hổng/thử nghiệm xâm nhập (pentest) độc lập | Hợp đồng/lịch pentest đã xác nhận | Nhà thầu | Có xác nhận lịch thực hiện |

### Giai đoạn 5 — Hoàn thiện an toàn thông tin & chuẩn bị vận hành thử (Tuần 9–10)

| Công việc | Sản phẩm đầu ra | Trách nhiệm | Mốc nghiệm thu nội bộ |
|---|---|---|---|
| Nhận kết quả quét lỗ hổng/pentest, khắc phục các lỗ hổng phát hiện (ưu tiên mức nghiêm trọng từ cấp độ 3 trở lên) | Báo cáo khắc phục lỗ hổng | Nhà thầu | Không còn lỗ hổng mức ≥3 |
| Hoàn thiện hồ sơ an toàn thông tin Cấp độ 3, nộp cấp có thẩm quyền phê duyệt | Hồ sơ hoàn chỉnh đã nộp | Nhà thầu, phối hợp Chủ đầu tư | Đã nộp (phê duyệt có thể ngoài kiểm soát tiến độ nội bộ) |
| Chuẩn bị kịch bản vận hành thử chính thức | Kịch bản vận hành thử (`docs/ho-so/03-kich-ban-kiem-thu-van-hanh-thu.md`) | Nhà thầu | Đã hoàn thiện, gửi Chủ đầu tư trước vận hành thử |
| Kiểm thử kết nối LGSP/IOC bằng dữ liệu mô phỏng (nếu đặc tả đã sẵn sàng) | Báo cáo kiểm thử kết nối | Nhà thầu | Kết nối thử thành công |

### Giai đoạn 6 — Vận hành thử chính thức (Tuần 11)

| Công việc | Sản phẩm đầu ra | Trách nhiệm | Mốc nghiệm thu nội bộ |
|---|---|---|---|
| Thực hiện vận hành thử có sự tham gia của giám sát và các bên liên quan, theo Khoản 1 Điều 58 Nghị định 73/2019/NĐ-CP | Toàn bộ ca kiểm thử tại `docs/ho-so/03-kich-ban-kiem-thu-van-hanh-thu.md` được thực hiện | Nhà thầu + Chủ đầu tư + giám sát | Có biên bản từng ca |
| Thu thập số liệu SLA thực tế trong thời gian vận hành thử | Số liệu đo thực tế | Nhà thầu | Đối chiếu với cam kết SLA |
| Lập Báo cáo kết quả vận hành thử | Báo cáo kết quả vận hành thử (mẫu tại `docs/ho-so/03-kich-ban-kiem-thu-van-hanh-thu.md` Mục V) | Nhà thầu | Có xác nhận, ký các bên |

### Giai đoạn 7 — Khắc phục & nghiệm thu (Tuần 12)

| Công việc | Sản phẩm đầu ra | Trách nhiệm | Mốc nghiệm thu nội bộ |
|---|---|---|---|
| Khắc phục các vấn đề phát hiện trong vận hành thử | Danh mục khắc phục đã hoàn thành, có xác nhận | Nhà thầu | Đối chiếu danh mục tại Báo cáo kết quả vận hành thử |
| Hoàn thiện toàn bộ tài liệu hồ sơ dịch vụ (HDSD, quy trình quản trị vận hành, quy trình bảo trì, cam kết bảo mật, cam kết SLA) | Bộ hồ sơ hoàn chỉnh (`docs/ho-so/`) | Nhà thầu | Đã có đầy đủ 12 tài liệu |
| Tổ chức đào tạo 2 lớp (quản trị + người dùng) theo giáo trình đã lập | Đã tổ chức đào tạo, có phiếu khảo sát | Nhà thầu, phối hợp Chủ đầu tư | Có danh sách học viên tham dự, ký nhận |
| Chuẩn bị hồ sơ nghiệm thu, bàn giao đưa vào sử dụng | Hồ sơ nghiệm thu đầy đủ | Nhà thầu | Trình Chủ đầu tư xem xét nghiệm thu |

## IV. Bảng tổng hợp tiến độ 12 tuần

| Tuần | Giai đoạn | Trọng tâm |
|---|---|---|
| 1–2 | Làm rõ & khởi động | Làm rõ HSMT, xác nhận hạ tầng, khởi động hồ sơ ATTT |
| 3–4 | Hạ tầng nền | CSDL dự phòng, giám sát tập trung, bắt đầu tích hợp ký số |
| 5–6 | Tích hợp & bảo mật | Hoàn thiện ký số, adapter LGSP, checklist ATTT Cấp độ 3 |
| 7–8 | Hiệu năng & độ tin cậy | Kiểm thử tải 500/90, kiểm thử khôi phục, khởi động pentest |
| 9–10 | Hoàn thiện ATTT & chuẩn bị vận hành thử | Khắc phục lỗ hổng, hồ sơ ATTT, kịch bản vận hành thử |
| 11 | Vận hành thử chính thức | Thực hiện đủ ca kiểm thử, lập báo cáo kết quả |
| 12 | Khắc phục & nghiệm thu | Khắc phục, hoàn thiện tài liệu, đào tạo, hồ sơ nghiệm thu |

**Ghi chú quan trọng về phạm vi:** Trường hợp yêu cầu bắt buộc ứng dụng di động native đóng gói và nộp lên cửa hàng ứng dụng (Google Play/App Store) — thay vì ứng dụng web đáp ứng đa nền tảng — cần được làm rõ và xác nhận sớm (câu hỏi số 1 tại `docs/ho-so/10-van-ban-lam-ro-hsmt.md`), vì đây là công việc bổ sung cần triển khai song song từ Tuần 1 với nhóm nhân sự riêng để không ảnh hưởng tiến độ chung 12 tuần.

## V. Cam kết tiến độ

[Tên đầy đủ pháp nhân HPT TECH] cam kết hoàn thành toàn bộ nội dung chuẩn bị cung cấp dịch vụ CNTT (cài đặt, cấu hình, tích hợp, vận hành thử phần mềm, đào tạo) trong thời hạn tối đa 03 tháng kể từ ngày hợp đồng có hiệu lực, đúng theo dòng 634 HSMT. Kế hoạch chi tiết này được trình Chủ đầu tư xem xét, chấp thuận trước khi Nhà thầu triển khai chính thức, theo đúng dòng 635 HSMT.

Trường hợp tiến độ không đáp ứng yêu cầu của Chủ đầu tư hoặc không hoàn thành đúng thời hạn cam kết (trừ trường hợp bất khả kháng), Nhà thầu chấp nhận để Chủ đầu tư xem xét theo quy định tại dòng 637 HSMT.

---

**ĐẠI DIỆN NHÀ THẦU**
[Chức vụ]

[Họ tên]
*(Ký, ghi rõ họ tên, đóng dấu)*

**CHỦ ĐẦU TƯ CHẤP THUẬN**
(Ký, ghi rõ họ tên, đóng dấu)
