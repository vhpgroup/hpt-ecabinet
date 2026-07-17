# BÁO CÁO SOẠN BỘ HỒ SƠ DỊCH VỤ + WEBSITE CÔNG BỐ SẢN PHẨM

**Người thực hiện (vai giả định):** Văn — chuyên viên hồ sơ thầu, HPT TECH
**Gói thầu:** Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu — Sở Khoa học và Công nghệ TP Hải Phòng
**Sản phẩm dự thầu:** eCabinet
**Ngày lập:** 18/07/2026
**Phạm vi thực hiện:** Chỉ tạo file mới trong `docs/ho-so/` và `website/` của repo `/agent/workspace/hpt-ecabinet`. Không sửa file có sẵn nào. Không commit/push git.

---

## 1. Danh sách file đã soạn

### 1.1. Bộ hồ sơ tài liệu dịch vụ — `docs/ho-so/` (12 file, tổng ~1.627 dòng)

| # | File | Nội dung | Dòng |
|---|---|---|---|
| 00 | `docs/ho-so/00-muc-luc.md` | Danh mục bộ hồ sơ + bảng ánh xạ yêu cầu HSMT → tài liệu → trạng thái + quy ước placeholder dùng chung | 77 |
| 01 | `docs/ho-so/01-cam-ket-bao-mat.md` | Cam kết bảo mật thông tin (sở hữu dữ liệu, không chia sẻ bên thứ 3, ATTT vận hành, cơ yếu/Pháp lệnh bảo vệ bí mật nhà nước) + Phụ lục cam kết cá nhân nhân sự | 119 |
| 02 | `docs/ho-so/02-cam-ket-sla.md` | Chuyển 19 chỉ tiêu SLA của HSMT thành bảng cam kết định lượng + cơ chế đo lường từng chỉ tiêu + mẫu Báo cáo dịch vụ 6 tháng | 127 |
| 03 | `docs/ho-so/03-kich-ban-kiem-thu-van-hanh-thu.md` | 53 ca kiểm thử, phủ đủ 9 nhóm mục 3.4 (I–IX) + Nhóm B di động + hiệu năng/SLA + an toàn thông tin (phân quyền, tài liệu mật, phiếu kín) + mẫu Báo cáo kết quả vận hành thử | 178 |
| 04 | `docs/ho-so/04-quy-trinh-quan-tri-van-hanh.md` | 8 quy trình con đầy đủ theo Phụ lục 11 TT18/2024 (tổ chức thực hiện, vận hành ứng dụng, hoạt động người dùng, đối soát dữ liệu, 2 quy trình hỗ trợ, báo cáo/tài liệu, công cụ khai thác số liệu) | 222 |
| 05 | `docs/ho-so/05-quy-trinh-bao-tri.md` | Quy trình bảo trì theo Phụ lục 12 TT18/2024 (4 nội dung: bảo đảm thực hiện, công việc chung, bảo trì/duy trì/cập nhật, bảo đảm ATTT mạng) + bảng chu kỳ tổng hợp | 90 |
| 06 | `docs/ho-so/06-phuong-an-chuyen-giao-du-lieu.md` | Phương án sở hữu & chuyển giao dữ liệu: phạm vi, 2 lớp định dạng (kỹ thuật + thân thiện CSV/JSON), quy trình 7 bước, mẫu Biên bản bàn giao | 109 |
| 07 | `docs/ho-so/07-phuong-an-nang-cap-quy-dinh-moi.md` | Cam kết nâng cấp ≤3 tháng, rà soát hằng năm, quy trình tiếp nhận-đánh giá-phát triển-kiểm thử-triển khai + mẫu đề xuất | 85 |
| 08 | `docs/ho-so/08-giao-trinh-dao-tao.md` | 2 chương trình đào tạo chi tiết theo khung giờ (lớp quản trị 1 ngày, lớp người dùng 1 buổi), bám đúng menu thật eCabinet + danh mục tài liệu phát kèm | 121 |
| 09 | `docs/ho-so/09-ke-hoach-trien-khai.md` | Kế hoạch 12 tuần/≤3 tháng chuyển thể từ đề xuất kỹ thuật nội bộ thành thể thức văn bản trình Chủ đầu tư (7 giai đoạn, sản phẩm đầu ra, trách nhiệm, mốc nghiệm thu nội bộ) | 132 |
| 10 | `docs/ho-so/10-van-ban-lam-ro-hsmt.md` | 14 câu hỏi làm rõ HSMT (11 từ danhgia-benmoithau.md + 3 bổ sung từ phantich-hethong.md: mâu thuẫn OS máy trạm, LGSP XML/JSON, số Nghị định) | 201 |
| 11 | `docs/ho-so/11-tai-lieu-hdsd-tong-quan.md` | Khung HDSD: Phần A (8 chương quản trị) + Phần B (8 chương người dùng theo 4 vai trò + di động + màn hình TV) | 166 |

### 1.2. Website công bố chức năng sản phẩm — `website/` (1 file)

| File | Nội dung | Kích thước |
|---|---|---|
| `website/index.html` | Trang giới thiệu tự chứa (CSS inline, Google Fonts qua `<link>`, không phụ thuộc file ngoài): hero, 8 thông số chính, bảng đầy đủ 97/97 chức năng (Nhóm A I–IX web + Nhóm B di động, đặt tên đúng nguyên văn HSMT), kiến trúc & ATTT (5 vai trò, tài liệu mật/phiếu kín, audit log, sao lưu), dịch vụ đi kèm, footer liên hệ + disclaimer trung thực | 68.800 bytes, 1082 dòng |

**Xác nhận đã kiểm chứng:** đếm được đúng 97/97 mã số chức năng (1–97), không thiếu mục nào; không có `<link rel="stylesheet">` trỏ ra ngoài ngoại trừ Google Fonts; đã publish thử và chụp màn hình kiểm tra layout (hero, bảng chức năng, footer) — hiển thị đúng thiết kế trang trọng, nền sáng, xanh công vụ, đọc được.

---

## 2. Các chỗ [placeholder] pháp nhân phải điền

Toàn bộ 12 tài liệu và website dùng chung bộ placeholder (đã ghi chú tại `docs/ho-so/00-muc-luc.md` Mục 5):

| Placeholder | Xuất hiện tại | Nội dung cần điền |
|---|---|---|
| `[Tên đầy đủ pháp nhân HPT TECH]` | Tất cả 9 văn bản có tiêu đề công văn (01, 02, 06, 07, 09, 10) + website footer | Tên công ty đăng ký kinh doanh đầy đủ theo Giấy chứng nhận ĐKKD |
| `[Số văn bản]` | Đầu mỗi văn bản công văn (01, 02, 06, 07, 09, 10) | Số hiệu theo sổ công văn đi nội bộ |
| `[Ngày ký]` | Đầu mỗi văn bản công văn | Ngày ký thực tế trước khi nộp hồ sơ |
| `[Họ tên]` / `[Chức vụ]` | Cuối mỗi văn bản (chỗ ký) — 01, 02, 06, 07, 08, 09, 10, 11 | Người đại diện theo pháp luật hoặc người được ủy quyền ký, cùng chức vụ |
| `[Mã số doanh nghiệp]` | Website footer | Mã số thuế/mã số DN |
| `[Địa điểm]` / `[Địa chỉ trụ sở]` | Website footer, `00-muc-luc.md` Mục 5 | Địa chỉ đăng ký trụ sở chính |
| `[Hotline]`, `[Email]` | Website footer | Thông tin liên hệ công khai thống nhất |

**Lưu ý:** `docs/ho-so/04-quy-trinh-quan-tri-van-hanh.md`, `05-quy-trinh-bao-tri.md`, `03-kich-ban-kiem-thu-van-hanh-thu.md` là tài liệu quy trình/kịch bản kỹ thuật, chỉ có chữ ký đại diện Nhà thầu ở cuối (không có tiêu đề công văn số hiệu riêng), cần được thống nhất song phương với Sở Khoa học và Công nghệ (có chỗ ký đại diện Chủ đầu tư/giám sát tại mẫu Báo cáo kết quả vận hành thử trong file 03).

---

## 3. Đề xuất bước hoàn thiện

### 3.1. In ấn / ký
1. Đại diện pháp nhân HPT TECH điền đầy đủ placeholder theo bảng Mục 2, đặc biệt các văn bản cam kết chính thức (01, 02, 06, 07, 09) và văn bản làm rõ HSMT (10) — cần ký, đóng dấu trước khi nộp/gửi.
2. Tài liệu 03, 04, 05 (quy trình/kịch bản kỹ thuật) nên được gửi bản dự thảo cho Sở Khoa học và Công nghệ TP Hải Phòng trước để thống nhất nội dung (đúng yêu cầu HSMT dòng 113 "thống nhất với đơn vị thuê trước khi triển khai"), sau đó mới hoàn tất ký chính thức làm phụ lục hợp đồng.
3. Tài liệu 08 (giáo trình đào tạo) cần chốt lịch, địa điểm, danh sách học viên cụ thể với Sở trước khi in bản cuối (mẫu Kế hoạch tổ chức đào tạo đã có ở cuối file).

### 3.2. Đăng web
1. `website/index.html` là file HTML tự chứa, có thể đăng ngay lên bất kỳ hosting tĩnh (kể cả GitHub Pages, subdomain của HPT TECH) mà không cần build step — chỉ cần điền 4 placeholder liên hệ ở footer trước khi đăng công khai.
2. Đề xuất đăng tại một đường dẫn ổn định, không yêu cầu đăng nhập (đúng điều kiện dự thầu HSMT dòng 633 "cung cấp đường dẫn website công bố các chức năng... đảm bảo phù hợp"), và ghi đường dẫn này vào hồ sơ dự thầu chính thức + vào `docs/ho-so/00-muc-luc.md` bảng ánh xạ.
3. Sau khi đăng, nên đối chiếu lại 1 lần nữa với `reports/ba-compliance-matrix.md` (báo cáo có thể được các agent code khác cập nhật thêm sau) để xác nhận không có mục nào cần cập nhật mô tả trước khi bên mời thầu truy cập.

### 3.3. Liên kết với các đầu việc code song song
- 3 agent khác đang sửa code trong cùng repo (ghi nhận qua `git status`: nhiều file `.cs`/`.ts`/`.tsx` đang `M` — không thuộc phạm vi thực hiện của nhiệm vụ này, không bị đụng tới). Khi các đợt vá đó hoàn tất (đặc biệt mục 8 "Danh mục loại tài liệu", mục 48/53/92/97 "Thống kê ý kiến văn bản"), nên rà lại đúng 2 chỗ trong `website/index.html` đang đánh dấu "Đang hoàn thiện theo lộ trình" (mục 8, 48, 53, 92, 97) — nếu đã hoàn thiện thật thì gỡ nhãn đó đi để phản ánh đúng năng lực hiện tại của sản phẩm.
- Tài liệu 10 (văn bản làm rõ HSMT) nên được gửi sớm nhất có thể trong giai đoạn hỏi–đáp E-HSMT vì nhiều câu hỏi (đặc biệt câu 5 về nền tảng công nghệ bắt buộc/tham khảo) ảnh hưởng ngược lại phạm vi công việc còn lại của các đội code.

---

## 4. Đối chiếu phạm vi thực hiện

- Chỉ tạo file mới trong `docs/ho-so/` (12 file .md) và `website/` (1 file .html). Không sửa file có sẵn nào trong repo (`git status` xác nhận toàn bộ file `?? ` liên quan tới nhiệm vụ này chỉ nằm trong 2 thư mục nêu trên).
- Không thực hiện bất kỳ lệnh `git add`/`git commit`/`git push` nào.
- Mọi trích dẫn HSMT trong 12 tài liệu đều kèm số dòng cụ thể từ `docs/hsmt-chuong-v.md` (669 dòng).
- Bảng 97 chức năng trên website lấy đúng tên và mô tả từ HSMT mục 3.4 (dòng 388–515) và đối chiếu số lượng với `reports/ba-compliance-matrix.md`, không ghi cột trạng thái đáp ứng nội bộ, không bịa số liệu khách hàng/hợp đồng/chứng nhận.
