# BÁO CÁO VÁ 2 ĐIỀU KIỆN — Nghi (Frontend Developer)

Căn cứ: `/agent/workspace/reports/dungthu-so-khcn.md` mục 3(a), 3(b) và điều kiện bắt buộc 1 + khuyến nghị 3.
Phạm vi sửa: chỉ `src/`. Không revert, không commit/push. Build `node scripts/build-cdn.mjs` PASS 2 lần (đã chạy 3 lần).

---

## 1. VIỆC 1 — Thể thức biên bản theo NĐ 30/2020

### 1.1 Hiện trạng khi bắt đầu

Khi đọc `src/services/meetingService.ts`, phát hiện hàm `buildMinutesDraft` (dòng 402-491) đã được một dev trước (comment ghi "P0-B") bổ sung SẴN hầu hết thể thức: quốc hiệu/tiêu ngữ, tên cơ quan (tra theo đơn vị của chủ trì), số/ký hiệu "Số: …/BB-{ký hiệu đơn vị}" (cấp số thật qua `ensureMinutesNumber`/`nextMinutesNumber`, đếm theo năm), địa danh + ngày tháng, tên loại văn bản "BIÊN BẢN" + trích yếu, và "Nơi nhận:". View in (`MeetingDetailPage.tsx` → `MinutesTab` → khối `print-root`/`.print-sig`, CSS `@media print` trong `src/styles.css`) cũng đã có khung 2 cột chữ ký cuối trang in.

**2 lỗi còn lại đã vá:**

**(a) Lệch thuật ngữ chức danh ký:** nội dung mục V ghi "V. KẾT LUẬN CỦA CHỦ TỌA" nhưng khối chữ ký cuối văn bản lại ghi nhãn "CHỦ TRÌ" — không đồng bộ, đúng loại lỗi thể thức tổ nghiệm thu có thể bắt lại ở vòng sau. Đã đổi nhãn khối ký thành "CHỦ TỌA" để khớp chính nội dung mục V (hệ thống vẫn dùng "Chủ trì" làm nhãn VAI TRÒ trong toàn bộ UI khác — không đổi, vì đó là đúng ngữ nghĩa "vai trò chủ trì phiên họp"; chỉ riêng CHỨC DANH KÝ cuối biên bản theo thể thức hành chính dùng "Chủ tọa").

**(b) Khối chữ ký chỉ hiện khi ĐÃ ký số — trống hoàn toàn khi chưa ký:** trước sửa, `m.minutes.signatures.filter(...).map(...)` không render gì nếu chưa có chữ ký, khiến bản in thiếu hẳn vị trí "(Ký, ghi rõ họ tên)" cho chủ tọa/thư ký ký tay — vi phạm thể thức NĐ 30/2020 (luôn phải có khối chữ ký ở cuối văn bản). Đã sửa để khối chữ ký LUÔN hiện diện: nếu đã ký số thì hiện "(Đã ký số)" + thời điểm + tên; nếu CHƯA ký thì hiện "(Ký, ghi rõ họ tên)" + họ tên đầy đủ lấy từ `m.chairId`/`m.secretaryId` (tra qua `users.get`).

### 1.2 File/hàm đã sửa

- `src/ui/pages/MeetingDetailPage.tsx`, hàm `MinutesTab`, khối `print-root`/`print-sig` (dòng ~1002-1037): đổi nhãn "CHỦ TRÌ" → "CHỦ TỌA"; tách logic hiển thị theo nhánh có/chưa có chữ ký cho từng vai (thư ký, chủ tọa) bằng IIFE để tránh trùng lặp; giữ nguyên `fmtDT`, cấu trúc `.print-sig` (CSS không đổi).
- Không sửa `buildMinutesDraft` trong `meetingService.ts` — đã đủ thành phần thể thức trong phần NỘI DUNG SINH RA, chỉ còn thiếu ở tầng VIEW (khối ký) nên chỉ sửa view.

### 1.3 Phương án tương thích ngược đã chọn (biên bản cũ)

Biên bản mẫu cũ (`src/data/seed.ts`, phiên "m4" đã ký số, `locked: true`) có `minutes.content` được LƯU SẴN dạng text tĩnh, không có quốc hiệu/tên cơ quan/số ký hiệu (đúng như tổ nghiệm thu đã ghi nhận). Đã **KHÔNG sửa nội dung `minutes.content` đã lưu** của biên bản cũ — theo đúng chỉ dẫn "phần bổ sung thể thức áp cho DỰ THẢO SINH MỚI", vì sửa ngược nội dung một văn bản ĐÃ KÝ SỐ (đã có hash SHA-256 gắn với nội dung gốc) sẽ làm mismatch nội dung-với-hash, phá vỡ toàn vẹn pháp lý của chữ ký đã có — rủi ro cao hơn lợi ích. Phần khối CHỮ KÝ ở tầng view (đổi nhãn CHỦ TRÌ→CHỦ TỌA, luôn hiện diện) áp dụng cho MỌI biên bản kể cả cũ, vì đây là phần render riêng biệt không phụ thuộc `content` đã lưu, không làm sai lệch nội dung đã ký, chỉ chuẩn hóa khung hiển thị xung quanh — phương án an toàn nhất, không vỡ dữ liệu cũ, không cần migrate.

Biên bản MỚI sinh từ nay (nút "Tạo dự thảo từ dữ liệu phiên họp") sẽ có đủ toàn bộ thể thức trong cả nội dung và khối ký.

### 1.4 Mẫu biên bản sau sửa (sinh thử với dữ liệu mẫu tương tự phiên "Phiên họp thường kỳ UBND tỉnh tháng 6/2026")

Chạy trực tiếp logic `buildMinutesDraft` với input mẫu (chủ trì Trần Đại Nghĩa — Chủ tịch UBND tỉnh, thư ký Phạm Văn Thư — Chánh Văn phòng, đơn vị "Văn phòng UBND tỉnh" / ký hiệu "VP UBND"), số biên bản giả định "Số: 07/BB-VP":

```
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
---------------

VĂN PHÒNG UBND TỈNH
Thành phố …, ngày 30 tháng 06 năm 2026
Số: 07/BB-VP

BIÊN BẢN
Phiên họp thường kỳ UBND tỉnh tháng 6/2026
(Mã phiên họp: PH-2026/06-14)

Hôm nay, lúc 15 giờ 00 phút, ngày 30 tháng 06 năm 2026, tại ………, diễn ra phiên họp: Phiên họp thường kỳ UBND tỉnh tháng 6/2026.

I. THÀNH PHẦN THAM DỰ
- Chủ trì: Trần Đại Nghĩa — Chủ tịch UBND tỉnh.
- Thư ký: Phạm Văn Thư — Chánh Văn phòng UBND tỉnh.
- Có mặt: 3/3 đại biểu.

II. CHƯƠNG TRÌNH LÀM VIỆC
1. Báo cáo tình hình KT-XH tháng 6, nhiệm vụ tháng 7/2026 — Trình bày: Nguyễn Hoài An.

III. DIỄN BIẾN PHIÊN HỌP
1. Báo cáo tình hình KT-XH tháng 6, nhiệm vụ tháng 7/2026: đại biểu nghe trình bày, thảo luận và cho ý kiến.

IV. KẾT QUẢ BIỂU QUYẾT
Biểu quyết thông qua Nghị quyết phiên họp: 9/9 tán thành, 0 không tán thành, 0 không ý kiến.

V. KẾT LUẬN CỦA CHỦ TỌA
(1) Thông qua Báo cáo KT-XH tháng 6/2026. Yêu cầu các sở, ngành hoàn thành báo cáo sơ kết 6 tháng trước ngày 05/7/2026.
(2) Thống nhất thông qua Nghị quyết phiên họp với 9/9 thành viên dự họp tán thành.

Phiên họp kết thúc lúc 18:30 cùng ngày. Biên bản được lập và ký số trên Hệ thống phòng họp không giấy eCabinet.

Nơi nhận:
- Như thành phần dự họp;
- Lưu: VT, UBND.

                    [Khối chữ ký thể thức — render riêng ở view/bản in, luôn hiện diện]
        THƯ KÝ                                          CHỦ TỌA
   (Ký, ghi rõ họ tên)                              (Ký, ghi rõ họ tên)

     Phạm Văn Thư                                   Trần Đại Nghĩa
```

*(Khi đã ký số, dòng "(Ký, ghi rõ họ tên)" của vai tương ứng được thay bằng "(Đã ký số)" kèm thời điểm ký — vẫn giữ đúng vị trí 2 cột THƯ KÝ/CHỦ TỌA cuối văn bản.)*

---

## 2. VIỆC 2 — Rà soát ngôn ngữ nội bộ/kỹ thuật hiển thị người dùng

Đã grep toàn bộ `src/**/*.tsx` và `src/**/*.ts` với các từ khóa: `demo`, `giai đoạn N`, `GĐN`, `PGlite`, `localStorage`, `mô phỏng`, `WebRTC`, `LiveKit`, `mock`, `sample`, `README`. Phân loại: comment nội bộ dev (giữ), chuỗi hiển thị người dùng (sửa), ngoại lệ chủ đích (giữ).

| # | File | Chuỗi CŨ | Chuỗi MỚI | Loại |
|---|---|---|---|---|
| 1 | `LoginPage.tsx` | "Về bản demo" (nút) | "Về chế độ cục bộ (không máy chủ)" | Nút hành động |
| 2 | `LoginPage.tsx` | "Bản demo giai đoạn 1 — dữ liệu mẫu lưu tại trình duyệt · Kiến trúc sẵn sàng nâng cấp máy chủ + PostgreSQL" | "Bản trình diễn — dữ liệu mẫu lưu cục bộ tại trình duyệt; phiên bản triển khai kết nối máy chủ tập trung" | Footer đăng nhập (đúng ví dụ đề bài) |
| 3 | `LoginPage.tsx` | "Chọn nhanh một tài khoản demo hoặc nhập thông tin đăng nhập." | "Chọn nhanh một tài khoản dùng thử hoặc nhập thông tin đăng nhập." | Sub-heading |
| 4 | `LoginPage.tsx` | "Mật khẩu demo cho mọi tài khoản: 123456…" | "Mật khẩu dùng thử cho mọi tài khoản: 123456…" | Hint |
| 5 | `NotificationsPage.tsx` | "(giai đoạn 2: đẩy thêm email/SMS)" | "(sẽ bổ sung gửi kèm email/SMS ở bản triển khai chính thức)" | Subtitle trang Thông báo |
| 6 | `PollsPage.tsx` | "Ký số ở đây là **mô phỏng** (chưa tích hợp chứng thư số CA thật) — dùng để minh họa…" | "Chức năng ký số minh họa quy trình… — hệ thống sẽ tích hợp chữ ký số hợp pháp (CA) khi triển khai chính thức." | Chú thích dưới modal ký ý kiến |
| 7 | `PollsPage.tsx` | "Đây là **ký số mô phỏng**, chưa tích hợp chứng thư số CA thật (VNPT-CA/Viettel-CA/SmartCA)." | "Chức năng ký số minh họa quy trình — hệ thống sẽ tích hợp chữ ký số hợp pháp (CA) khi triển khai chính thức." | Modal ký ý kiến |
| 8 | `PollsPage.tsx` | "Gợi ý demo: nhập 6 chữ số bất kỳ, ví dụ 123456." | "Ở bản dùng thử, có thể nhập 6 chữ số bất kỳ, ví dụ 123456." | Hint modal ký ý kiến |
| 9 | `MeetingDetailPage.tsx` | "…đến các đại biểu (email + SMS **mô phỏng**)" (toast gửi giấy mời) | "…đến các đại biểu (email + SMS)" | Toast |
| 10 | `MeetingDetailPage.tsx` / `LiveMeetingPage.tsx` | "…quét mã…để điểm danh (**mô phỏng**)." (x2, modal QR) | "…quét mã…để điểm danh." | Modal QR điểm danh |
| 11 | `MeetingDetailPage.tsx` | Modal title "Ký số biên bản (**mô phỏng USB Token / SmartCA**)" | "Ký số biên bản (mô phỏng — chờ tích hợp CA)" *(đồng bộ đúng format ngoại lệ)* | Modal title ký biên bản |
| 12 | `MeetingDetailPage.tsx` | "Thiết bị: **USB Token — VN DEMO CA** (mô phỏng)… **Giai đoạn 2** sẽ tích hợp ký số thật (VNPT-CA/Viettel-CA/SmartCA)." | "Chức năng ký số minh họa quy trình — hệ thống sẽ tích hợp chữ ký số hợp pháp (CA) khi triển khai chính thức." | Modal ký biên bản |
| 13 | `MeetingDetailPage.tsx` | "Gợi ý demo: nhập 6 chữ số bất kỳ, ví dụ 123456." | "Ở bản dùng thử, có thể nhập 6 chữ số bất kỳ, ví dụ 123456." | Hint modal ký biên bản |
| 14 | `OnlineMeetingPage.tsx` | title "Chia sẻ màn hình (**mô phỏng**)" + toast "**Mô phỏng**: chia sẻ màn hình sẽ hoạt động khi bật **WebRTC (LiveKit)** — xem **README**" | title "Chia sẻ màn hình (minh họa — bản triển khai chính thức có chia sẻ màn hình thật)" + toast "Chia sẻ màn hình thật sẽ khả dụng ở bản triển khai chính thức có kết nối máy chủ truyền hình ảnh." | Nút + toast giao diện họp minh họa |
| 15 | `OnlineMeetingPage.tsx` | "Giao diện **mô phỏng** họp trực tuyến — bật **WebRTC (LiveKit)**… (xem **README**)." | "Giao diện minh họa họp trực tuyến — bản triển khai chính thức có kết nối máy chủ truyền âm thanh, hình ảnh và chia sẻ màn hình thật." | Ghi chú dưới giao diện minh họa |
| 16 | `OnlineMeetingPage.tsx` | "…hiển thị chế độ **mô phỏng**." / "…chuyển sang **mô phỏng**." | "…hiển thị giao diện minh họa." / "…chuyển sang giao diện minh họa." | Toast lỗi khi không vào được RTC thật |
| 17 | `OnlineMeetingPage.tsx` | "Họp trực tuyến (**WebRTC**) · N điểm cầu…" | "Họp trực tuyến · N điểm cầu…" | Header phòng họp RTC thật |
| 18 | `OnlineMeetingPage.tsx` | "Họp trực tuyến thật qua **WebRTC (LiveKit)** — âm thanh, hình ảnh và chia sẻ màn hình." | "Họp trực tuyến thật — âm thanh, hình ảnh và chia sẻ màn hình được truyền trực tiếp qua máy chủ." | Ghi chú phòng họp RTC thật |
| 19 | `admin/ApiAdminPage.tsx` | "**Bản demo** trình duyệt: khóa API quản lý trên máy cục bộ **để minh họa**…" | "Chế độ cục bộ (chưa kết nối máy chủ): khóa API quản lý trên máy cục bộ…" | Banner trang API & Tích hợp |
| 20 | `admin/ApiAdminPage.tsx` | "**Bản demo** sinh từ danh mục dưới đây." | "Bản sinh từ danh mục dưới đây (chế độ cục bộ)." | Chú thích OpenAPI spec |
| 21 | `admin/UsersAdminPage.tsx` | "Mật khẩu mặc định: 123456 (**demo**)." | "Mật khẩu mặc định: 123456 — đề nghị người dùng đổi lại sau khi nhận tài khoản." | Modal tạo user mới |
| 22 | `services/voteService.ts` | "…(Email/SMS nhắc kèm theo — **mô phỏng**)" (nội dung thông báo "Nhắc cho ý kiến") | "…(Email/SMS nhắc kèm theo)" | Thông báo gửi người dùng |
| 23 | `data/seed.ts` | Tên khóa API mẫu "Hệ thống QLVB (**demo**)"; ghi chú "**CHỈ DÙNG DEMO** — key thô cố định…" | Tên "Hệ thống QLVB (khóa dùng thử)"; ghi chú "Khóa dùng thử — tạo khóa mới khi triển khai chính thức, không dùng khóa này ở môi trường thật." | `k.note`/`name` hiển thị trong bảng Khóa API (trang admin) |

**Ngoại lệ giữ nguyên đúng theo đề bài** (đã xác nhận qua grep cuối, không còn `demo`/`giai đoạn N`/`mô phỏng` nào khác lọt ra `.tsx`):
- `PollsPage.tsx` title tooltip nút ký ý kiến: `"Ký số mô phỏng — chờ tích hợp chứng thư số (CA) thật"`.
- `PollsPage.tsx` modal title: `"Ký số ý kiến (mô phỏng — chờ tích hợp CA)"`.
- `MeetingDetailPage.tsx` modal title ký biên bản: đổi thành cùng format `"(mô phỏng — chờ tích hợp CA)"` (mục #11 trên — đồng bộ hóa theo đúng ngoại lệ, không xóa từ "mô phỏng" ở đây vì đây chính là nhãn được đề bài liệt kê giữ nguyên).
- `MainLayout.tsx`: chỉ báo `'● Thời gian thực'` — không đụng.
- Serial chứng thư số `VN-DEMO-CA:...` (trong `meetingService.ts`, `voteService.ts`, `seed.ts`) — giữ nguyên vì đây là minh bạch có chủ đích tương đương tinh thần ngoại lệ (ghi rõ chưa phải CA thật ngay trong dữ liệu kỹ thuật đi kèm chữ ký mô phỏng).
- Comment nội bộ dev (không hiển thị UI): mọi dòng `// ...` chứa "demo", "GĐ2/GĐ3", "mô phỏng" trong `db.ts`, `repository.ts`, `apiBase.ts`, `restAdapter.ts`, `meetingService.ts`, `apiKeyService.ts`, `adminService.ts`, `types.ts`, `AppContext.tsx`, `sim.ts`, `OnlineMeetingPage.tsx` (header) — giữ nguyên toàn bộ.

---

## 3. Xác nhận build & phạm vi

- `node scripts/build-cdn.mjs` chạy 3 lần liên tiếp, đều PASS ("✔ Bundle xong", "✔ dist/index.html sẵn sàng").
- `git status --short` sau sửa: chỉ 11 file trong `src/` có thêm thay đổi so với trạng thái trước khi tôi vào (`seed.ts`, `documentService.ts`, `voteService.ts`, `LiveMeetingPage.tsx`, `LoginPage.tsx`, `MeetingDetailPage.tsx`, `NotificationsPage.tsx`, `OnlineMeetingPage.tsx`, `PollsPage.tsx`, `admin/ApiAdminPage.tsx`, `admin/UsersAdminPage.tsx`); `server/src/seed.mjs` đổi 8 dòng do build script tự đồng bộ từ `seed.ts` (hành vi tất định của `build-cdn.mjs`, không sửa tay). Không tạo file mới, không revert file nào của Tech Leader/Phong.
- Cơ chế "khóa biên bản sau ký" (Phong vừa làm ở `MinutesTab` — `hasAnySignature`, disable textarea/nút Lưu/Tạo lại dự thảo) không bị đụng tới.

**Nghi — Frontend Developer**
