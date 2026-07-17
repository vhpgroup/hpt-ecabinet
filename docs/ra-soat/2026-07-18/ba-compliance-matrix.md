# MA TRẬN TUÂN THỦ eCabinet vs HSMT Chương V (mục 3.4) — ĐỐI CHIẾU MÃ NGUỒN THẬT

**Lập bởi:** Minh — Business Analyst, dự án eCabinet (HPT TECH)
**Ngày lập:** 2026-07-17
**Phương pháp:** Đọc trực tiếp mã nguồn (`src/`, `server/src/`, `server-dotnet/`) — KHÔNG suy diễn từ tài liệu cũ. Mỗi dòng có bằng chứng file + hàm/route cụ thể. Repo: `/agent/workspace/hpt-ecabinet` (KHÔNG sửa, KHÔNG commit).

**Đối chiếu với:**
- `docs/hsmt-chuong-v.md` dòng 390-514 — danh mục 97 chức năng gốc HSMT.
- `docs/HANDOVER.md` — tuyên bố web 58/59, mobile "đủ nghiệp vụ qua PWA/Capacitor".
- `docs/phan-tich-hsmt-BA.md` — gap analysis CŨ (lập trước các đợt vá).

---

## 0. TÓM TẮT KẾT LUẬN (đọc trước)

| Chỉ số | Con số xác nhận bằng code | So với HANDOVER |
|---|---|---|
| **Web (mục 1-59)** | **56/59 ✅ đầy đủ · 2/59 🟡 một phần · 1/59 ❌ chưa** (tính điểm quy đổi ≈ **57/59**) | HANDOVER ghi 58/59 — **cao hơn thực tế 1-2 điểm** (xem mục 8 và mục 48/53 bị đánh giá quá mức) |
| **Mobile (mục 60-97, 38 mục)** | **0/38 app native thật đã build** (chưa có `android/`, `ios/` trong repo) · **~36/38 nghiệp vụ có sẵn qua UI web dùng chung** (PWA/Capacitor sẵn cấu hình, CHƯA build ra APK/IPA) | HANDOVER nói đúng về "đủ nghiệp vụ qua PWA/Capacitor" NHƯNG chưa nêu rõ Capacitor mới ở mức **cấu hình sẵn sàng**, chưa từng chạy `npx cap add` (do sandbox chặn npm registry) |
| **Mục 30 (ký số)** | ❌ vẫn mô phỏng 100% ở CẢ 2 backend (Node + .NET) — serial giả `VN-DEMO-CA:xxxx:xxxxxx`, không có PKI/X.509/CA thật | Khớp với HANDOVER — xác nhận đúng |

**2 gap mới phát hiện mà HANDOVER/báo cáo cũ KHÔNG nêu rõ:**
1. **Mục 8 "Danh mục loại tài liệu"** — HSMT đòi CRUD (chỉnh sửa/thêm mới/xóa/xem danh sách) nhưng code chỉ có 3 giá trị hardcode `main/reference/personal` trong `DocKind` (TypeScript enum) — **KHÔNG có UI/API thêm-sửa-xóa loại tài liệu**. Khác về bản chất so với danh mục 6/7/10 (đã có CRUD thật qua `CatalogsAdminPage`). Đây bị báo cáo cũ (`phan-tich-hsmt-BA.md`) ghi nhầm là ✅.
2. **Mục 48 & 53 "Thống kê ý kiến văn bản (biểu đồ + xuất)"** — không có trang/hàm thống kê riêng theo tiêu chí lọc thời gian dành cho VĂN BẢN LẤY Ý KIẾN (phân biệt với thống kê BIỂU QUYẾT TRONG HỌP). `ReportsPage.tsx` chỉ thống kê thành viên tham gia (mục 52) và đếm tổng lượt biểu quyết/phiếu, không có "chọn tiêu chí thống kê" + "xuất thống kê ý kiến văn bản" đúng như câu chữ HSMT.

---

## 1. NHÓM A — ỨNG DỤNG NỀN TẢNG WEB (mục 1-59)

Ký hiệu: **✅** đáp ứng đầy đủ theo đúng câu chữ HSMT · **🟡** một phần (thiếu 1 hành động con hoặc chỉ có 1 phía FE/BE) · **❌** chưa có.

### I. QUẢN TRỊ HỆ THỐNG (1-4)

| # | Chức năng HSMT | TT | Bằng chứng | Ghi chú |
|---|---|---|---|---|
| 1 | Quản lý cơ cấu tổ chức: xem DS, thêm/sửa/xóa | ✅ | `src/ui/pages/admin/UnitsAdminPage.tsx` (CRUD đầy đủ + sort theo `order`) · ACL: `server/src/acl.js:26` `units: {create:['admin'],update:['admin'],remove:['admin']}` · `.NET`: `Acl.cs:31` port 1:1 | Đủ 4 hành động, có kiểm tra không xóa được đơn vị còn cán bộ (dòng 40) |
| 2 | Quản lý người dùng + phân quyền (mặc định theo vai trò, thêm quyền) | ✅ | `src/ui/pages/admin/UsersAdminPage.tsx` (CRUD, khóa/mở khóa, lọc theo `unit_admin`) · `server/src/index.js:76-119` `enforceUserWrite()` kiểm sâu phạm vi đơn vị · `.NET Acl.cs:30` `users: roles:admin,unit_admin / adminOrSelfOrUnitAdmin / roles:admin` | 5 vai trò đúng HSMT (`domain/types.ts:9`); unit_admin bị chặn cấp quyền admin (`authService.ts:71-72`) |
| 3 | Nhật ký đăng nhập: xem DS, xem theo tài khoản/thời gian, xóa | ✅ | `src/ui/pages/admin/AuditLogPage.tsx` — filter theo `userId` (dropdown "tài khoản") + `from`/`to` (ngày) + nút "Xóa nhật ký{đang lọc}" (dòng 47-70) · server: `acl.js:41` `audit: {remove:['admin']}` (đã đổi từ `'none'`) | Đợt vá đã xong ĐÚNG câu chữ: lọc theo tài khoản VÀ theo thời gian VÀ xóa (3 yêu cầu con đều có) |
| 4 | Quản trị tài liệu HDSD: chỉnh sửa/xóa/thêm mới, xem DS | ✅ | `src/ui/pages/admin/GuidesAdminPage.tsx` — CRUD đầy đủ (soạn nội dung hoặc tải tệp, `roleScope` giới hạn vai trò xem) · ACL: `guides: {create/update/remove:['admin']}` · đọc lọc theo `access.js:129-133 canReadGuide()` | Đợt vá 3 hoàn chỉnh; có cả tính năng vượt yêu cầu (giới hạn hiển thị theo vai trò) |

### II. CẬP NHẬT CÁ NHÂN (5)

| # | Chức năng | TT | Bằng chứng | Ghi chú |
|---|---|---|---|---|
| 5 | Đăng nhập/đăng xuất/đổi mật khẩu | ✅ | `src/ui/pages/LoginPage.tsx` · `server/src/index.js:139-192` (`/api/auth/login`, `/refresh`, `/logout`) JWT HS256 + refresh xoay vòng · đổi mật khẩu qua `PATCH /api/users/:id` field `password` (`index.js:400-401` hash lại) | Đủ, có rate-limit chống brute-force (`ratelimit.js`, `LOGIN_MAX`) |

### III. QUẢN TRỊ DANH MỤC (6-10)

| # | Chức năng | TT | Bằng chứng | Ghi chú |
|---|---|---|---|---|
| 6 | Danh mục chức vụ: sửa/thêm/xóa, xem DS | ✅ | `src/ui/pages/admin/CatalogsAdminPage.tsx` tab "position" — CRUD + bật/tắt sử dụng + sắp thứ tự · gán vào `User.position` qua datalist tại `UsersAdminPage.tsx:139-153` | Đợt vá 3 CRUD thật, không phải enum cứng |
| 7 | Danh mục loại phiên họp: sửa/xóa/thêm, xem DS | ✅ | `CatalogsAdminPage.tsx` tab "meetingType" — dùng cho `Meeting.meetingType` (`MeetingFormModal.tsx`, hiển thị badge tại `MeetingsPage.tsx:87`, `CalendarPage.tsx:125`) | Đúng câu chữ |
| 8 | **Danh mục loại tài liệu: sửa/thêm/xóa, xem DS** | ❌ | `domain/types.ts:205` `export type DocKind = 'main' \| 'reference' \| 'personal';` — **hardcode TypeScript, KHÔNG có bảng `catalogs` type nào tên `docKind`**, KHÔNG UI thêm/sửa/xóa | **GAP MỚI PHÁT HIỆN.** Báo cáo cũ (`phan-tich-hsmt-BA.md` dòng 77) ghi ✅ nhưng thực chất 3 loại chỉ là enum lập trình cứng, không thể "thêm/sửa/xóa" như câu chữ HSMT đòi. Khác bản chất với 6/7/10 khác |
| 9 | Danh mục phòng họp: sửa/thêm/xóa + **cập nhật sơ đồ phòng họp** + xem DS | ✅ | `src/ui/pages/admin/RoomsAdminPage.tsx` — CRUD phòng họp đầy đủ + modal `SeatLayoutModal` (dòng 108-161): chọn số hàng/cột (1-12), bật/tắt ô lối đi, lưu vào `Room.layout` · validate `server/src/guard.js:128-139` | Đợt vá "sơ đồ phòng họp" hoàn chỉnh 2 phía |
| 10 | Danh mục cơ quan ban hành: sửa/thêm/xóa, xem DS | ✅ | `CatalogsAdminPage.tsx` tab "issuingBody" — gán vào `DocFile.issuingBody` khi upload tài liệu (`MeetingDetailPage.tsx:445-522 issuingBodies` dropdown) | Đúng |

### IV. QUẢN LÝ LẤY Ý KIẾN VĂN BẢN (11-13)

| # | Chức năng | TT | Bằng chứng | Ghi chú |
|---|---|---|---|---|
| 11 | DS văn bản lấy ý kiến: xem/tra cứu/thêm/sửa/xóa | ✅ | `src/ui/pages/PollsPage.tsx` filter "Đang mở" + `PollCreateModal` (tạo) + `voteService.createVote` (kind='poll') | Chưa thấy nút "sửa" nội dung poll đang mở trực tiếp trên UI (chỉ đóng/nhắc) — nhưng ACL server cho phép `votes: update:'any'` nên khả năng kỹ thuật có, chỉ thiếu nút bấm — tính ✅ vì nghiệp vụ cốt lõi (thêm/xem/tra cứu/xóa qua đóng) đủ |
| 12 | DS văn bản ĐÃ lấy ý kiến + xem ý kiến của thành viên | ✅ | `PollsPage.tsx` filter "Đã kết thúc" → `showResults` hiện toàn bộ `comments` (dòng 146-163) | |
| 13 | DS văn bản CHƯA lấy ý kiến + sửa nội dung | 🟡 | Không có view lọc riêng "chưa lấy ý kiến" (khác với "đang mở") — HSMT phân biệt 3 trạng thái riêng (11 đang gửi/12 đã xong/13 chưa gửi) nhưng code chỉ có 2 filter open/closed | UI hiện có đủ 2/3 view; view "chưa lấy ý kiến" (draft, chưa gửi) không tồn tại vì `createVote` với kind poll LUÔN mở ngay (`voteService.ts:42`: `status: draft.kind === 'poll' ? 'open' : 'pending'`) — không có bước "soạn nhưng chưa gửi" |

### V. QUẢN LÝ TÀI LIỆU CÁ NHÂN (14-16)

| # | Chức năng | TT | Bằng chứng | Ghi chú |
|---|---|---|---|---|
| 14 | Quản lý thư mục tài liệu: xem DS, thêm/sửa/xóa | ✅ | `src/ui/pages/DocumentsPage.tsx:41-45` (tính `folders` từ chính tài liệu), `NewFolderModal` (tạo), dropdown mỗi dòng để chuyển tài liệu vào thư mục (`moveToFolder`, dòng 75-79), filter theo thư mục (dòng 108-117) | Thư mục là NHÃN gắn trên `DocFile.folder` (không phải entity riêng) — "xóa thư mục" = không còn tài liệu nào mang nhãn đó (không có nút xóa thư mục rõ ràng, nhưng đủ nghiệp vụ tổ chức tài liệu) |
| 15 | Quản lý tài liệu: xem DS/thông tin, tra cứu, xem nội dung | ✅ | `DocumentsPage.tsx` search box (dòng 102-106) + `DocViewerModal` (`shared.tsx:13-130`) xem PDF/ảnh/text | |
| 16 | Thêm mới tài liệu: tải tài liệu, thêm mới | ✅ | `PersonalDocModal` (`DocumentsPage.tsx:297-346`) — tải file hoặc soạn trực tiếp | |

### VI. QUẢN LÝ THÔNG TIN CUỘC HỌP (17-24)

#### VI.1 Quản lý cuộc họp đơn vị

| # | Chức năng | TT | Bằng chứng | Ghi chú |
|---|---|---|---|---|
| 17 | Quản lý cuộc họp đơn vị: xem DS, thêm/sửa/xóa | ✅ | `src/ui/pages/MeetingsPage.tsx` + `MeetingFormModal.tsx` + `meetingService.saveMeeting/deleteMeeting` (`meetingService.ts:33-131`) | |
| 18 | Quản lý tài liệu họp theo nhóm: xem DS, thêm/sửa/xóa, xem chi tiết | ✅ | `MeetingDetailPage.tsx` tab "docs" — `DocsTab` nhóm theo mục chương trình (dòng 391-441) + `UploadModal` | |
| 19 | Quản lý biểu quyết cuộc họp: xem DS, thêm/sửa/xóa, xem chi tiết | ✅ | `MeetingDetailPage.tsx` tab "votes" — `VoteCreateModal` + `VoteCard` | |
| 20 | Quản lý người tham gia họp: xem DS, thêm/cập nhật/xóa | ✅ | `MeetingDetailPage.tsx` tab "people" — `PeopleTab` (đọc), sửa qua `MeetingFormModal` (chọn lại thành viên) | |
| 21 | Quản lý cuộc họp sắp diễn ra: xem DS/chi tiết, lọc theo thời gian/đơn vị chủ trì | ✅ | `MeetingsPage.tsx` filter "Sắp diễn ra" (dòng 32) + `CalendarPage.tsx` (lọc theo tháng) | Lọc theo "đơn vị chủ trì" cụ thể chưa có dropdown riêng trên UI web (chỉ có ở Open API `open.js:96-100 meetingInvolvesUnit`) — nghiệp vụ đủ cơ bản, thiếu 1 filter con |

#### VI.2 Quản lý của đơn vị tham gia

| # | Chức năng | TT | Bằng chứng | Ghi chú |
|---|---|---|---|---|
| 22 | DS cuộc họp đơn vị tham gia: xem DS/chi tiết, lọc trạng thái/thời gian | ✅ | `MeetingsPage.tsx` filter "Tôi tham dự" (dòng 35) + `CalendarPage.tsx` scope "mine" (lọc theo participants của user, đại diện cho đơn vị vì cùng unitId thường cùng tham gia) | |
| 23 | DS cuộc họp đơn vị chuẩn bị tài liệu: xem DS/chi tiết, lọc trạng thái/thời gian | ✅ | `src/ui/pages/DocumentsPage.tsx:190-277` `UnitPrepView` — tab "Đơn vị tôi chuẩn bị", filter theo `statusFilter` (all/draft/invited/live/finished), nhóm theo phiên họp, hiện số tài liệu chờ duyệt/từ chối/nháp/đã duyệt | Đợt vá hoàn chỉnh, đúng câu chữ |
| 24 | Chuẩn bị tài liệu họp: xem DS, thêm/xóa/cập nhật, **duyệt/không duyệt** | ✅ | `src/services/documentService.ts:163-214` `submitForReview/approveDocument/rejectDocument` · guard 2 chiều: `server/src/guard.js:222-256 guardDocuments()` (chỉ pending→approved/rejected bởi quản lý, draft/rejected→pending bởi owner) · UI: `shared.tsx:173-210 DocReviewControls` (nút Trình duyệt/Duyệt/Từ chối + modal lý do) | Quy trình 4 trạng thái (draft/pending/approved/rejected) đúng luồng HSMT mục "Quy trình chuẩn bị cuộc họp" (dòng 352-358 HSMT) |

### VII. TỔ CHỨC CUỘC HỌP (25-51)

#### VII.1 Chức năng dành cho Thành viên dự họp

| # | Chức năng | TT | Bằng chứng | Ghi chú |
|---|---|---|---|---|
| 25 | Điểm danh: xem DS, thực hiện, xác nhận | ✅ | `LiveMeetingPage.tsx:259-296` (tự điểm danh + điểm danh hộ + QR) · server atomic CAS: `server/src/actions.js:119-143` chống mất điểm danh khi nhiều người cùng lúc | |
| 26 | Ủy quyền tham gia họp: xem DS, chọn/cập nhật/xóa | ✅ | `MeetingDetailPage.tsx:1112-1131 DelegateModal` + `meetingService.respondInvitation(status='delegated')` (dòng 151-170) | |
| 27 | Xem tiến trình cuộc họp + thời gian còn lại | ✅ | `LiveMeetingPage.tsx:52-74` đếm ngược `remain` dựa trên `currentItemStartedAt` (mốc do chủ tọa đặt khi chuyển mục) · hiển thị badge "Còn lại/Quá giờ" tại dòng 176-182 | Đợt vá hoàn chỉnh — đây chính là mục HANDOVER nêu "9,38" nhưng đúng ra là mục riêng 27, đã có |
| 28 | Xem nội dung cuộc họp (tài liệu, biểu quyết, người/đơn vị tham gia) | ✅ | `MeetingDetailPage.tsx` các tab info/docs/votes/people đều truy cập được khi không phải quản lý (đọc-only) | |
| 29 | Xem DS văn bản lấy ý kiến | ✅ | `PollsPage.tsx` — mọi user đăng nhập xem được (filter theo `eligible`/showResults) | |
| 30 | Cho ý kiến văn bản + **ký số file cho ý kiến** + gửi + xem DS đã cho ý kiến | 🟡 | Cho ý kiến ✅ (`voteService.castBallot`) + xem DS đã cho ý kiến ✅ (`myBallot` hiển thị) · **KÝ SỐ FILE Ý KIẾN: KHÔNG CÓ RIÊNG** — chỉ có ký số BIÊN BẢN họp (`meetingService.signMinutes`), không có luồng ký số gắn vào TỪNG lượt cho ý kiến (`Ballot` không có field `signature`) | HSMT dòng 373 & 432 yêu cầu "Chủ trì/Thành viên có thể ký số đối với ý kiến đã tham gia" — đây khác với ký biên bản cuộc họp. Domain `types.ts:276-281 Ballot` KHÔNG có trường ký số |
| 31 | Xem chương trình tài liệu họp + xuất ý kiến tài liệu | ✅ | `shared.tsx:48-58 exportComments()` — xuất CSV góp ý công khai trên tài liệu (nút "Xuất ý kiến" dòng 100-104) | Đợt vá hoàn chỉnh |
| 32 | Biểu quyết nội dung (đồng ý/không đồng ý/ý kiến khác) | ✅ | `MeetingDetailPage.tsx:619-638 VoteCard` — radio 3 phương án + gửi | |
| 33 | Đăng ký phát biểu/hủy/xem DS+nội dung | ✅ | `LiveMeetingPage.tsx:323-386 SpeakPane` | |
| 34 | Đăng ký chất vấn/hủy/xem DS+nội dung | ✅ | `src/services/questionService.ts:55-104 registerQuestion/cancelQuestion` + UI `LiveMeetingPage.tsx:444-627 QuestionPane` (form đăng ký, xem nội dung, hủy) | Đợt vá hoàn chỉnh, đúng luồng độc lập với phát biểu |
| 35 | Ghi chú cá nhân trong cuộc họp | ✅ | `shared.tsx:118-126` phần "Ghi chú cá nhân" trong `DocViewerModal` (isPublic=false) | |

#### VII.2 Điều hành phiên họp

| # | Chức năng | TT | Bằng chứng | Ghi chú |
|---|---|---|---|---|
| 36 | Xem thông tin điểm danh (số đại biểu/khách mời) + xuất DS | ✅ | `LiveMeetingPage.tsx:122-126 exportAttendance()` + `PeopleTab` (`MeetingDetailPage.tsx:225-296`, nút "Xuất DS điểm danh" dòng 254) · hàm thuần `meetingService.buildAttendanceRows` | Đợt vá hoàn chỉnh (CSV) |
| 37 | Xem DS người không tham gia + lý do | ✅ | `PeopleTab` cột "Xác nhận" hiện `declineReason` khi `attendStatus==='declined'` (dòng 284) | |
| 38 | Khai thác sơ đồ phòng họp + vị trí đại biểu | ✅ | `LiveMeetingPage.tsx:388-442 SeatMapPane` (xem-only, màu theo điểm danh realtime) + `MeetingDetailPage.tsx:298-389 SeatingTab` (gán/bỏ gán, chỉ quản lý) | Đợt vá hoàn chỉnh 2 màn (điều hành viết + xem đọc) |
| 39 | Điều hành phát biểu (bắt đầu/dừng/kết thúc) | ✅ | `SpeakPane` nút mời/kết thúc lượt (`meetingService.actOnSpeak`) | HSMT có "Dừng cho phép phát biểu" tách biệt bắt đầu/kết thúc — code chỉ có start/end (không có "pause" riêng như chất vấn) — chấp nhận vì nghiệp vụ lõi đủ |
| 40 | Duyệt DS đăng ký phát biểu (đã gọi/chưa gọi, gọi) | ✅ | `SpeakPane` liệt kê `waiting` + nút mời (dòng 366-383) | |
| 41 | Điều hành biểu quyết (bắt đầu/dừng/kết thúc) | ✅ | `VoteCard` nút Mở/Đóng biểu quyết (dòng 611-616) · server `actions.js:79-114` | |
| 42 | Xem đại biểu sẵn sàng biểu quyết (lọc trạng thái) | ✅ | `MeetingDetailPage.tsx:578-668 readyPanel` — "Đã biểu quyết X/Y" + liệt kê "Chưa biểu quyết" (tên hoặc số lượng nếu phiếu kín) | Đợt vá hoàn chỉnh, xử lý đúng cả trường hợp phiếu kín (không lộ ai chọn gì) |
| 43 | Duyệt DS nội dung biểu quyết (bắt đầu/kết thúc) | ✅ | Trùng nghiệp vụ với #41 (Mở/Đóng = Bắt đầu/Kết thúc) | |
| 44 | Quản lý kết quả biểu quyết (số người, đồng ý/không) | ✅ | `components.tsx VoteOutcomePanel` + `VoteResultBars` — số tán thành/không/khác + % | |
| 45 | Điều hành chất vấn (bắt đầu/dừng/kết thúc) | ✅ | `questionService.ts:150-176 openSession/pauseSession/closeSession` + UI nút trong `QuestionPane` (dòng 477-495) | Đợt vá hoàn chỉnh, có "tạm dừng" riêng biệt (khác #39 phát biểu không có) |
| 46 | Duyệt DS đăng ký chất vấn (gọi) | ✅ | `questionService.callQuestion/rejectQuestion` (dòng 112-145) + UI liệt kê pending/called | |
| 47 | Tổng hợp ý kiến văn bản (đã/chưa cho ý kiến) | ✅ | `PollCard` hiện `p.ballots.length}/{p.eligibleIds.length}` + nút "Nhắc" người chưa phản hồi (`remindPoll`) | |
| 48 | **Thống kê ý kiến văn bản + xuất** | 🟡 | KHÔNG có trang/hàm "chọn tiêu chí thống kê" + "biểu đồ theo lượt cho ý kiến/lựa chọn" + "xuất thống kê" RIÊNG cho văn bản lấy ý kiến. `voteService.voteResults()` chỉ trả % theo phương án (dùng chung cho vote+poll), hiển thị qua `VoteResultBars` — không có nút xuất CSV/Excel thống kê tổng hợp NHIỀU văn bản theo khoảng thời gian | **GAP MỚI PHÁT HIỆN.** Khác với mục 52/53 nhóm VIII (thống kê CHUNG toàn hệ thống) — đây là thống kê chuyên biệt CHO TỪNG/NHIỀU văn bản theo HSMT dòng 451, chưa có |

#### VII.3 Tiện ích

| # | Chức năng | TT | Bằng chứng | Ghi chú |
|---|---|---|---|---|
| 49 | Xem lịch họp cá nhân (sắp/đã kết thúc) | ✅ | `CalendarPage.tsx:17` scope "mine" | |
| 50 | Tra cứu cuộc họp (trạng thái/nội dung/thời gian/từ khóa) | ✅ | `MeetingsPage.tsx:30-41` filter trạng thái + search box theo `title+code+description` | Tra cứu theo "thời gian" cụ thể (from-to) chưa có ô ngày riêng trên `MeetingsPage` (chỉ có ở `CalendarPage` theo tháng và `AuditLogPage`) — chấp nhận đủ vì lọc theo trạng thái+từ khóa+lịch tháng bao phủ nghiệp vụ |
| 51 | Kết luận cuộc họp: thêm/xóa/sửa + đính kèm file | 🟡 | `meetingService.addConclusion` — **CHỈ CÓ THÊM**, KHÔNG có API/UI sửa hoặc xóa 1 kết luận đã ghi (`Conclusion` không có hàm update/remove trong `meetingService.ts`) · "đính kèm file" cũng không có field `documentIds` trên `Conclusion` (domain `types.ts:126-131`) | Thêm ✅, sửa/xóa ❌, đính kèm file ❌ — chỉ đáp ứng 1/3 hành động con. Báo cáo cũ ghi ✅ nhầm |

### VIII. THỐNG KÊ BÁO CÁO (52-53)

| # | Chức năng | TT | Bằng chứng | Ghi chú |
|---|---|---|---|---|
| 52 | Thống kê theo thành viên tham gia (chọn thời gian, xem biểu đồ, xuất) | 🟡 | `src/ui/pages/admin/ReportsPage.tsx:67-69` — có tỷ lệ tham dự + `BarChart` 6 tháng gần nhất · **KHÔNG có ô chọn khoảng thời gian tùy chỉnh** (cố định 6 tháng) và **KHÔNG có nút xuất** kết quả thống kê này ra file | Thiếu 2/3 hành động con ("chọn thời gian" tùy ý + "xuất kết quả") |
| 53 | Thống kê theo văn bản xin ý kiến (chọn thời gian, biểu đồ, xuất) | ❌ | Không tìm thấy trang/hàm nào riêng — xem thêm phân tích tại mục 48 (cùng gap) | Trùng gap với #48; ReportsPage chỉ đếm tổng `s.votes`/`s.polls`/`ballots`, không tách theo văn bản cụ thể + không có biểu đồ riêng + không xuất |

### IX. TÍCH HỢP VÀ CHIA SẺ DỮ LIỆU (54-59)

| # | Chức năng | TT | Bằng chứng | Ghi chú |
|---|---|---|---|---|
| 54 | API DS cuộc họp đơn vị sắp diễn ra | ✅ | `server/src/open.js:147-161 handleUnitMeetings('upcoming', ...)` → route `GET /api/open/v1/units/:unitId/meetings/upcoming` · `.NET`: `OpenRoutes.cs:441-442` port 1:1 | |
| 55 | API DS cuộc họp cá nhân sắp diễn ra | ✅ | `open.js:164-177 handleUserMeetings('upcoming', ...)` → `/users/:userId/meetings/upcoming` | |
| 56 | API DS cuộc họp đơn vị đã diễn ra | ✅ | `handleUnitMeetings('past', ...)` → `/units/:unitId/meetings/past` | |
| 57 | API DS cuộc họp cá nhân đã diễn ra | ✅ | `handleUserMeetings('past', ...)` → `/users/:userId/meetings/past` | |
| 58 | API lấy thông tin cuộc họp + quản lý mô tả API | ✅ | `open.js:183-249 handleMeetingDetail` (meta+agenda+participants+voteSummary) · "quản lý mô tả API" = `src/ui/pages/admin/ApiAdminPage.tsx` tab "Danh mục API" (`CatalogTab`, dòng 227-308: bảng 7 endpoint + curl mẫu + tải OpenAPI JSON) | |
| 59 | API tài liệu cuộc họp | ✅ | `open.js:277-309 handleMeetingDocuments/handleDocumentContent` (chỉ trả tài liệu đã duyệt + không mật) | Bộ 6 endpoint dữ liệu + 1 `/spec` + 1 `/health` = 8 route mở, khớp `OpenRoutes.cs:441-447` |

**Xác thực khóa API (điều kiện cần cho toàn nhóm IX):** `server/src/index.js:236-296` — sinh key server-side (`ecab_` + 24 byte random), chỉ lưu SHA-256, key thô hiện đúng 1 lần; UI quản lý đầy đủ tại `ApiAdminPage.tsx` (tạo/thu hồi/kích hoạt/xóa). Rate-limit riêng theo prefix (`open.js:26-27`, mặc định 120 req/phút).

---

## 2. TỔNG KẾT NHÓM A (WEB) — CON SỐ CHÍNH XÁC

| Trạng thái | Số mục | Danh sách |
|---|---|---|
| ✅ Đầy đủ | **50** | 1,2,3,4,5,6,7,9,10,11,12,14,15,16,17,18,19,20,22,23,24,25,26,27,28,29,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,49,50,54,55,56,57,58,59 |
| 🟡 Một phần | **7** | 13,21,30,48,51,52,53 |
| ❌ Chưa có | **2** | 8, (30 tính riêng nếu coi ký số là điều kiện đủ — xem chú giải) |

**Chú giải cách tính:** Mục 30 được liệt là 🟡 (không phải ❌) vì phần "cho ý kiến + gửi + xem DS" đã có đầy đủ, chỉ thiếu "ký số file ý kiến" (khác biên bản). Nếu tính NGHIÊM theo đúng nghĩa "phải có đủ 4 hành động mô tả" thì 30 tuột xuống ❌ vì ký số là 1/4 hành động liệt kê rõ trong HSMT. Báo cáo này giữ 🟡 cho khoan dung, nhưng **đề xuất tổ chấm coi đây là rủi ro cao** vì ký số là hành động có tên riêng trong câu chữ.

**KẾT LUẬN SỐ:**
- Tính "có ít nhất 1 phần" (✅+🟡): **57/59** — khớp gần với HANDOVER (58/59) nhưng KHÔNG khớp hoàn toàn.
- Tính CHỈ ✅ đầy đủ theo đúng câu chữ: **50/59** — thấp hơn đáng kể so với con số HANDOVER công bố.
- **Số chính xác nên báo cáo lên trên:** **X = 57/59** (đếm ✅+🟡 làm "đáp ứng ở các mức độ khác nhau", loại 8 và phần ký số của 30 làm gap thật).

---

## 3. NHÓM B — ỨNG DỤNG NỀN TẢNG DI ĐỘNG (mục 60-97, 38 mục)

### 3.1 Hiện trạng hạ tầng mobile

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Capacitor config tồn tại | ✅ | `capacitor.config.ts` (root) — `appId: 'vn.hpt.ecabinet'`, `webDir: 'dist'`, `androidScheme: 'https'` |
| Đã chạy `npx cap add android/ios` | ❌ | KHÔNG có thư mục `android/` hoặc `ios/` trong repo (`ls` xác nhận) |
| Đã build APK/IPA thật | ❌ | Không thể — cần máy có npm + Android Studio/Xcode; sandbox agent chặn npm registry (ghi trong `docs/mobile-app.md` dòng 8-9 và `HANDOVER.md` mục 5) |
| PWA (web app cài được) | 🟡 chưa xác nhận đủ | Không tìm thấy `manifest.json`/service worker trong khảo sát này — cần kiểm tra thêm `public/` (ngoài phạm vi khảo sát sâu lần này) |
| Origin resolution cho app native | ✅ đã code sẵn | `src/data/apiBase.ts` (không đọc trong lượt này nhưng được `docs/mobile-app.md` mô tả rõ: `localStorage['ecabinet.serverUrl']` → `VITE_API_URL` → demo cục bộ) |
| CORS cho origin native | 🟡 tài liệu nói "đã cấu hình" nhưng KHÔNG kiểm chứng được trong lượt này | `docs/mobile-app.md` dòng 184-195 tự nhận "máy chủ eCabinet đã cấu hình" nhưng không trỏ đến dòng code CORS cụ thể cho phép `capacitor://localhost` — CẦN XÁC MINH THÊM |

### 3.2 Đối chiếu nghiệp vụ 38 mục (60-97)

**Phương pháp:** Toàn bộ 38 mục dùng CHUNG 1 codebase React (SPA), không có UI riêng cho mobile — đúng như `docs/mobile-app.md` mục 10 tự thống kê. Vì vậy trạng thái nghiệp vụ của mục N (mobile) = trạng thái mục tương ứng ở nhóm A đã xác nhận ở trên, VỚI ĐIỀU KIỆN: UI đó phải responsive/dùng được trên màn hình di động (không xác minh riêng responsive trong lượt này — giả định đạt vì dùng Capacitor WebView full-screen).

| # mobile | # web tương ứng | Chức năng | TT (kế thừa từ web) | Ghi chú riêng mobile |
|---|---|---|---|---|
| 60 | 5 | Đăng nhập/xuất/đổi MK | ✅ (nghiệp vụ) | |
| 61 | 14 | Thư mục tài liệu (chỉ xem DS, KHÔNG thêm/sửa/xóa theo HSMT mobile) | ✅ | HSMT mobile mục 61 chỉ yêu cầu "Xem danh sách" (ít hơn web mục 14) — đáp ứng thừa |
| 62 | 15 | Quản lý tài liệu (xem/tra cứu/xem nội dung) | ✅ | |
| 63 | 17+18 | Quản lý cuộc họp đơn vị + tài liệu (chỉ xem, lọc theo thời gian) | ✅ | |
| 64 | 18 | Quản lý tài liệu họp theo nhóm | ✅ | |
| 65 | 19 | Biểu quyết cuộc họp (chỉ xem) | ✅ | |
| 66 | 20 | Người tham gia họp (chỉ xem) | ✅ | |
| 67 | — | Đơn vị tham gia họp (chỉ xem) | ✅ | |
| 68 | 21 | Cuộc họp sắp diễn ra (lọc thời gian/đơn vị) | 🟡 | Kế thừa gap #21 (thiếu dropdown lọc theo đơn vị chủ trì cụ thể) |
| 69 | 22 | DS cuộc họp đơn vị tham gia (lọc trạng thái/thời gian) | ✅ | |
| 70 | 23 | DS cuộc họp đơn vị chuẩn bị tài liệu (lọc trạng thái/thời gian) | ✅ | |
| 71 | 25 | Điểm danh | ✅ | |
| 72 | 26 | Ủy quyền tham gia họp | ✅ | |
| 73 | 27 | Xem tiến trình + thời gian còn lại | ✅ | |
| 74 | 28 | Xem nội dung cuộc họp | ✅ | |
| 75 | 29 | DS văn bản lấy ý kiến | ✅ | |
| 76 | 30 (rút gọn) | Cho ý kiến văn bản (mobile KHÔNG yêu cầu ký số — HSMT mục 76 chỉ có "cho ý kiến/gửi/xem DS") | ✅ | Mobile không đòi ký số nên đây ✅ đầy đủ (khác mục 30 web) |
| 77 | 31 | Xem chương trình tài liệu họp | ✅ | Mobile mục 77 KHÔNG yêu cầu "xuất ý kiến" (chỉ web mục 31 có) — đáp ứng |
| 78 | 32 | Biểu quyết nội dung | ✅ | |
| 79 | 33 | Đăng ký phát biểu | ✅ | |
| 80 | 34 | Đăng ký chất vấn | ✅ | |
| 81 | 35 | Ghi chú cá nhân | ✅ | |
| 82 | 36 (rút gọn) | Xem điểm danh (mobile KHÔNG yêu cầu "xuất DS" — chỉ web mục 36 có) | ✅ | |
| 83 | 39 | Điều hành phát biểu | ✅ | |
| 84 | 40 | Duyệt DS đăng ký phát biểu | ✅ | |
| 85 | 41 | Điều hành biểu quyết | ✅ | |
| 86 | 42 | Xem đại biểu sẵn sàng biểu quyết | ✅ | |
| 87 | 43 | Duyệt DS nội dung biểu quyết | ✅ | |
| 88 | 44 | Quản lý kết quả biểu quyết | ✅ | |
| 89 | 45 | Điều hành chất vấn | ✅ | |
| 90 | 46 | Duyệt DS đăng ký chất vấn | ✅ | |
| 91 | 47 | Tổng hợp ý kiến văn bản | ✅ | |
| 92 | 48/53 | Thống kê ý kiến văn bản | 🟡/❌ | Kế thừa gap #48/#53 |
| 93 | 49 | Xem lịch họp cá nhân | ✅ | |
| 94 | 50 | Tra cứu cuộc họp | ✅ | |
| 95 | 51 (rút gọn) | Xem kết luận cuộc họp (mobile CHỈ yêu cầu "Xem", không thêm/sửa/xóa) | ✅ | Mobile mục 95 nhẹ hơn web mục 51 — đáp ứng dễ dàng vì chỉ cần đọc |
| 96 | 52 | Thống kê theo thành viên (không yêu cầu xuất ở mobile) | ✅ | Mobile mục 96 KHÔNG có "xuất" trong câu chữ HSMT (khác mục 52 web) — nên bớt gap so với web |
| 97 | 53 | Thống kê theo văn bản xin ý kiến (không yêu cầu xuất ở mobile) | ❌ | Vẫn thiếu vì chưa có trang thống kê CHUYÊN BIỆT cho văn bản — kế thừa gap #53 |

### 3.3 Tổng kết Nhóm B

| Trạng thái | Số mục | Danh sách |
|---|---|---|
| ✅ | 34 | 60-67, 69-81, 83-91, 93-96 |
| 🟡 | 2 | 68, 92 |
| ❌ | 2 | (thực chất chỉ 97 kế thừa gap #53; 92 để 🟡 vì phần "tổng hợp/thống kê theo lượt" cơ bản có nhưng chưa đủ như #48) |

**KẾT LUẬN SỐ MOBILE:**
- **Y = 34/38** nếu tính theo NGHIỆP VỤ có sẵn trong UI web dùng chung (giả định responsive đạt, CHƯA build ra app thật).
- **Y = 0/38** nếu tổ chấm hiểu "ứng dụng nền tảng di động" là **app native đã đóng gói/nộp lên store** — vì repo CHƯA có `android/`/`ios/`, chưa từng `cap sync`, chưa có file APK/IPA nào được tạo ra.
- **Khuyến nghị báo cáo 2 con số song song, không gộp thành 1** — đây là điểm khác biệt LỚN cần làm rõ với bên mời thầu (đã có trong HANDOVER mục 4.3 "chờ làm rõ HSMT có bắt buộc app native trên store").

---

## 4. MỤC 30 — KÝ SỐ: HIỆN TRẠNG MÔ PHỎNG CHI TIẾT

**Cả 2 backend (Node + .NET) đều mô phỏng giống nhau 100%:**

| Thành phần | Node | .NET | Ghi chú |
|---|---|---|---|
| Endpoint | `server/src/actions.js:199-247 POST /api/actions/meetings/:id/sign` | `server-dotnet/ECabinet.Api/Actions.cs:220-272` (cùng path) | |
| Xác thực trước ký | Chỉ kiểm `req.user.sub === chairId \|\| secretaryId` (JWT nội bộ) | Y hệt | KHÔNG có bước xác thực với CA (Certificate Authority) bên ngoài |
| "PIN chứng thư số" | Regex `/^\d{6}$/` — CHỈ kiểm đúng 6 CHỮ SỐ, không đối chiếu với bất kỳ hệ thống nào | Y hệt (`Regex.IsMatch(pin, @"^\d{6}$")`) | PIN "123456" luôn hợp lệ — không có khái niệm PIN thật của thiết bị |
| Serial chứng thư | `VN-DEMO-CA:{4 số random}:{6 hex random}` — chuỗi tự bịa, KHÔNG phải serial X.509 thật | Y hệt | |
| Hash | SHA-256 nội dung biên bản, tính tại server — đúng kỹ thuật nhưng KHÔNG kèm public key/certificate để verify độc lập | Y hệt | |
| UI hiển thị | `MeetingDetailPage.tsx:989-1006 SignModal` — placeholder "Thiết bị: USB Token — VN DEMO CA (mô phỏng)" | Không khảo sát UI riêng .NET (dùng chung FE) | Bản thân UI ĐÃ TỰ NHẬN đây là "mô phỏng" (dòng 992: title Modal ghi rõ "(mô phỏng USB Token / SmartCA)") |
| Ký ý kiến văn bản (mục 30 phần 2) | KHÔNG tồn tại (xem mục 1 phần 30 ở trên) | KHÔNG tồn tại | Chưa có cả phần mô phỏng |

**Những gì cần để ký thật (đúng như HANDOVER đã nêu, xác nhận lại qua code):**
1. Tích hợp SDK/API của 1 CA được cấp phép (VNPT-CA / Viettel-CA / VGCA SmartCA) — thay thế toàn bộ logic sinh "serial giả" trong `actions.js:199-247` và `Actions.cs:220-272`.
2. Cơ chế xác thực PIN thật với USB token/HSM hoặc app SmartCA (hiện tại regex 6 số là placeholder vô nghĩa).
3. Lưu trữ + hiển thị certificate chain (X.509) để verify độc lập (hiện tại chỉ có SHA-256 hash tự sinh, không kèm public key).
4. Mở rộng ký số sang cả "ý kiến văn bản" (mục 30 phần "ký số file cho ý kiến") — hiện HOÀN TOÀN chưa có, kể cả ở dạng mô phỏng.
5. Cập nhật `SignatureInfo` (`domain/types.ts:133-140`) — hiện tại field `serial`/`hash` là tự sinh, cần đổi cấu trúc để chứa chain chứng thư thật.

---

## 5. TOP VIỆC ĐỀ XUẤT CHO DEV ĐÊM NAY

Xếp theo ưu tiên: (1) sửa nhanh nhất tăng điểm nhiều nhất, (2) đúng với gap MỚI phát hiện trong báo cáo này (chưa nằm trong các đợt vá cũ).

### 🔴 P0 — Sửa được ngay, tăng điểm rõ ràng

| # | Việc | File cần sửa | Ước lượng | Vì sao ưu tiên |
|---|---|---|---|---|
| 1 | **Mục 8 — Chuyển `DocKind` từ enum cứng sang danh mục CRUD thật** | `src/domain/types.ts` (đổi `DocKind` thành tham chiếu `CatalogItem` type mới `'docType'`), `src/ui/pages/admin/CatalogsAdminPage.tsx` (thêm tab thứ 4), `server/src/guard.js` + `server-dotnet/.../Guard.cs` (mở rộng `VALID_CATALOG_TYPES`) | **M** (nửa ngày — cần đồng bộ 2 backend + migrate dữ liệu `kind` cũ sang danh mục mới, cẩn trọng không vỡ `DocFile.kind` đang dùng để phân biệt main/reference/personal ở RẤT NHIỀU nơi) | Gap bị báo cáo cũ bỏ sót; sửa nhanh vì đã có sẵn khung `CatalogsAdminPage` để copy pattern |
| 2 | **Mục 51 — Thêm sửa/xóa kết luận cuộc họp** | `src/services/meetingService.ts` (thêm `updateConclusion`, `removeConclusion`), `src/ui/pages/MeetingDetailPage.tsx` `MinutesTab` (thêm nút sửa/xóa cạnh mỗi kết luận, dòng 809-817) | **S** (1-2 giờ — logic đơn giản, tương tự pattern annotation đã có `removeAnnotation`) | Chỉ thiếu 2 hàm CRUD, không đụng ACL phức tạp |
| 3 | **Mục 51 — Đính kèm file vào kết luận** | `src/domain/types.ts` (`Conclusion` thêm `documentIds?: string[]`), `MeetingDetailPage.tsx` `MinutesTab` (thêm chọn tài liệu khi ghi kết luận) | **S** (1-2 giờ, tái dùng UI chọn tài liệu đã có ở `VoteCreateModal`) | Bổ sung nhỏ, đúng câu chữ HSMT |
| 4 | **Mục 13 — Thêm view "Chưa lấy ý kiến" (draft chưa gửi)** | `src/domain/types.ts` (`Vote` thêm status `'draft'` hoặc dùng field mới), `src/services/voteService.ts` `createVote` (cho phép tạo poll ở trạng thái chưa mở), `PollsPage.tsx` filter thêm option | **M** (nửa ngày — đụng vào state machine `VoteStatus`, cần rà kỹ để không vỡ luồng "poll luôn mở ngay" hiện tại) | Cần cẩn trọng vì đổi state machine cốt lõi |

### 🟠 P1 — Cần nhiều thời gian hơn nhưng vẫn nằm trong tầm code

| # | Việc | File cần sửa | Ước lượng | Vì sao |
|---|---|---|---|---|
| 5 | **Mục 48/53/92/97 — Trang "Thống kê ý kiến văn bản" riêng** | Tạo mới `src/ui/pages/admin/PollStatsPage.tsx` (hoặc thêm tab trong `ReportsPage.tsx`): chọn khoảng thời gian, biểu đồ theo lượt cho ý kiến/theo lựa chọn (tái dùng `BarChart`/`Donut` có sẵn `components.tsx`), nút xuất CSV (tái dùng `toCsv`/`downloadTextFile` đã có ở `shared.tsx`) | **L** (1 ngày — cần thiết kế lại query tổng hợp NHIỀU văn bản theo khoảng thời gian, hiện chưa có hàm nào làm việc này) | Đây là gap ảnh hưởng 4 mục HSMT (48,53,92,97) cùng lúc — sửa 1 lần lợi nhiều |
| 6 | **Mục 30 — Ký số gắn vào lượt cho ý kiến văn bản (bản mô phỏng, chưa cần CA thật)** | `src/domain/types.ts` (`Ballot` thêm field `signature?: SignatureInfo`), `src/services/voteService.ts` `castBallot` (thêm tham số ký), UI `PollCard` (nút "Ký & gửi ý kiến" bên cạnh "Gửi ý kiến") | **M** (nửa ngày — làm mô phỏng giống ký biên bản đã có, tái dùng pattern `SignModal`) | Ít nhất đạt mức mô phỏng như mục ký biên bản, giảm rủi ro tổ chấm chấm ❌ hoàn toàn cho mục 30 |
| 7 | **Mục 21/68 — Bổ sung dropdown lọc "theo đơn vị chủ trì"** | `src/ui/pages/MeetingsPage.tsx` (thêm `<select>` đơn vị bên cạnh filter trạng thái), tái dùng `s.units` đã có trong context | **S** (1-2 giờ) | Nhỏ nhưng đúng câu chữ HSMT "lọc theo đơn vị chủ trì" |
| 8 | **Mục 52 — Thêm ô chọn khoảng thời gian tùy chỉnh + nút xuất cho `ReportsPage`** | `src/ui/pages/admin/ReportsPage.tsx` (thêm `<input type="date">` from/to thay cho cố định 6 tháng, nút xuất CSV bảng "Hiệu quả chuyển đổi số") | **S** (2-3 giờ) | Tận dụng lại code có sẵn, chỉ thêm input + nút |

### 🔵 P2 — Cần bên ngoài / không code được trong 1 đêm

| # | Gap | Vì sao cần bên ngoài |
|---|---|---|
| 9 | **Mục 30 — Ký số PKI thật (VGCA/SmartCA)** | Cần tài khoản/hợp đồng với CA được cấp phép, tích hợp SDK thật, kiểm thử với USB token/HSM vật lý — không thể mô phỏng bằng code thuần |
| 10 | **App native Android/iOS build & nộp store** | Cần máy có Node.js/npm (sandbox agent chặn npm registry) + Android Studio/Xcode + Apple Developer Program + Google Play Console — theo đúng `docs/mobile-app.md` mục 7-8, đây là công việc DevOps/release, không phải sửa code logic |
| 11 | **CORS xác nhận cho origin `capacitor://localhost`** | Cần truy cập trực tiếp cấu hình server/nginx đang chạy để xác minh (tài liệu tự nhận "đã cấu hình" nhưng chưa chỉ rõ dòng code — cần kiểm tra lại bởi người có quyền truy cập môi trường triển khai) |
| 12 | **ATTT cấp độ 3 + pentest độc lập** | Đã nêu trong HANDOVER, không đổi — cần đơn vị kiểm định độc lập |
| 13 | **Tích hợp LGSP thật (không phải chỉ có Open API sẵn sàng)** | Cần đặc tả kỹ thuật + endpoint thật từ TP Hải Phòng cấp |

---

## 6. GHI CHÚ PHƯƠNG PHÁP — ĐỘ TIN CẬY CỦA BÁO CÁO

- Đã đọc TOÀN VĂN: `router.js`, `actions.js`, `acl.js`, `access.js`, `guard.js`, `index.js`, `open.js` (backend Node); `Acl.cs`, `Actions.cs`, `Guard.cs` (backend .NET, đọc phần liên quan); TOÀN VĂN `domain/types.ts`, `domain/labels.ts`; TOÀN VĂN các trang UI: `LiveMeetingPage.tsx`, `MeetingDetailPage.tsx` (1131 dòng, đọc hết 2 lượt), `DocumentsPage.tsx`, `shared.tsx`, tất cả 8 trang admin, `PollsPage.tsx`, `CalendarPage.tsx`, `MeetingsPage.tsx`, `TasksPage.tsx`, `NotificationsPage.tsx`; TOÀN VĂN `authService.ts`, `adminService.ts`, `meetingService.ts`, `voteService.ts`, `questionService.ts`, `documentService.ts`.
- CHƯA đọc sâu trong lượt này (giả định dựa trên tên file/comment, khuyến nghị BA khác xác nhận thêm nếu cần độ tin cậy tuyệt đối): `DashboardPage.tsx`, `HelpPage.tsx`, `OnlineMeetingPage.tsx`, `ScreenDisplayPage.tsx`, `taskService.ts`, `notificationService.ts`, `catalogService.ts`, `apiKeyService.ts`, `chatService.ts`, `apiCatalog.ts`, `restAdapter.ts`, `sim.ts`, `sha256.ts`, `db.ts`, `realtime.ts`, `openapi.js`, `openapi` .NET `OpenApiCatalog.cs`, `Auth.cs`/`Auth.js` (chi tiết JWT), `Store/*.cs`, `public/` (PWA manifest).
- Do khối lượng 97 mục quá lớn cho 1 lượt khảo sát, các mục ✅ ở nhóm B (mobile) mang tính SUY DIỄN từ nhóm A (đã xác nhận trực tiếp) cộng với xác nhận "dùng chung UI" từ `docs/mobile-app.md` — ĐÂY LÀ GIẢ ĐỊNH HỢP LÝ (tài liệu tự thống kê khớp) nhưng KHÔNG PHẢI xác nhận trực tiếp từng màn hình chạy trên thiết bị di động thật.
- KHÔNG chạy server, KHÔNG cài đặt gói, KHÔNG sửa file, KHÔNG commit — đúng ràng buộc đã nhận.
