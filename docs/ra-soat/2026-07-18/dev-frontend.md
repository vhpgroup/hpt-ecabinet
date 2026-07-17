# BÁO CÁO DEV FRONTEND — eCabinet (HPT TECH)

**Người thực hiện:** Phong — Frontend Developer
**Ngày:** 2026-07-18
**Phạm vi sửa:** CHỈ `src/` (React 18 + TypeScript). Không sửa `server/`, `server-dotnet/`, `README.md`, `deploy/`, `docker-compose*`, `docs/`, `website/`, `scripts/`. `server/src/seed.mjs` bị `node scripts/build-cdn.mjs` tự regenerate — không phải sửa tay.
**Build:** `node scripts/fetch-deps.mjs` (đã có sẵn `.esbuild` binary) → `node scripts/build-cdn.mjs` → **PASS** (đã rebuild sạch từ đầu, xác nhận lần cuối `dist/index.html` sinh ra hợp lệ ~750KB).
**Chế độ kiểm tra:** đọc code cẩn thận theo từng luồng (demo localStorage qua `src/data/db.ts`) — KHÔNG chạy HTTP server, đúng ràng buộc.

---

## 1. Trang Thống kê ý kiến văn bản (HSMT mục 48/53, mobile 92/97)

**Việc:** thêm tab "Thống kê ý kiến văn bản" trong khu Báo cáo — chọn khoảng thời gian, tổng hợp theo TỪNG văn bản (số người được xin/đã-chưa cho ý kiến, phân bố phương án) + tổng hợp toàn cục theo thời gian, nút xuất CSV. Quyền xem: chủ trì/thư ký/admin.

**File sửa/tạo:**
- `src/services/voteService.ts` — thêm 2 hàm thuần mới: `pollStatsInRange(votes, from, to): PollStatRow[]` (lọc poll theo khoảng ngày tạo, tính `totalEligible/responded/notResponded/responseRatePercent/optionBreakdown`) và `pollStatsByMonth(rows)` (gộp theo tháng cho BarChart).
- `src/ui/pages/admin/ReportsPage.tsx` — viết lại toàn bộ: `ReportsPage` giờ là shell 2-tab (`OpsReportTab` = nội dung cũ đã nâng cấp mục 2, `PollStatsTab` = tab mới). `PollStatsTab`: 2 ô ngày + 4 `StatCard`, `BarChart` theo tháng, `Donut` đã/chưa cho ý kiến toàn cục, bảng chi tiết từng văn bản (click để xem `Donut` phân bố phương án của văn bản đó, kèm tên cán bộ theo dõi nếu có), nút xuất CSV (`toCsv`/`downloadTextFile` tái dùng).
- `src/App.tsx` — route `/admin/reports` đổi guard từ `RequireAdmin` → `RequireManage` (admin/chairman/secretary) vì trang này giờ cần mở cho vai trò quản lý, không chỉ admin.
- `src/ui/MainLayout.tsx` — thêm mục menu "Báo cáo thống kê" cho chairman/secretary (trước đây chỉ admin thấy).

**Ánh xạ HSMT:** mục 48 (thống kê ý kiến văn bản), 53 (chọn thời gian/biểu đồ/xuất — nhóm văn bản), mobile 92/97 (kế thừa cùng UI web responsive).

**Ghi chú:** dùng chung route/trang `/admin/reports` (thêm tab) theo đúng gợi ý trong đề bài ("...hoặc trang mới") — chọn phương án tái dùng route để không phải thêm route/guard mới không cần thiết.

---

## 2. Danh mục loại tài liệu CRUD (HSMT mục 8)

**Việc:** thêm loại danh mục `docType` là tab thứ 4 trong `CatalogsAdminPage`; `DocFile.docTypeId?`; chọn loại tài liệu khi tải lên/sửa; hiển thị nhãn trên danh sách/chi tiết. KHÔNG đụng `DocFile.kind`.

**File sửa:**
- `src/domain/types.ts` — `CatalogType` thêm `'docType'`; `DocFile` thêm `docTypeId?: string` (id của `CatalogItem` type='docType') — comment rõ KHÔNG liên quan `kind`.
- `src/domain/labels.ts` — `CATALOG_TYPE.docType = { label: 'Loại tài liệu', ... }`.
- `src/ui/pages/admin/CatalogsAdminPage.tsx` — `TABS` thêm `'docType'` (1 dòng) — toàn bộ CRUD (thêm/sửa/xóa/bật-tắt/sắp thứ tự) tự động hoạt động vì `catalogService.ts` đã generic theo `CatalogType`, không cần sửa service.
- `src/services/documentService.ts` — `addTextDocument`/`addFileDocument` nhận thêm `opts.docTypeId` (thêm interface `AddDocOpts` để gọn tham số); thêm hàm `setDocType(actor, docId, docTypeId)` để cập nhật loại tài liệu cho tài liệu đã có.
- `src/ui/pages/MeetingDetailPage.tsx` (`UploadModal`) và `src/ui/pages/DocumentsPage.tsx` (`PersonalDocModal`) — thêm ô chọn "Loại tài liệu" (dropdown từ danh mục đang bật).
- `src/ui/pages/shared.tsx` — `DocRow` hiện Badge loại tài liệu; `DocViewerModal` hiện nhãn loại tài liệu trong dòng metadata. Cả 2 dùng hook nội bộ `useDocTypeLabel(docTypeId)` tra qua `s.catalogs`.

**Xác nhận không đụng `DocFile.kind`:** grep toàn bộ `documentService.ts` xác nhận `kind` chỉ còn xuất hiện ở chỗ cũ (`defaultReviewStatus`, `attachToAgenda` set `kind:'main'`, `visibleDocs` filter `kind!=='personal'`) — không có dòng nào bị đổi ngữ nghĩa.

**Việc bỏ dở:** "sửa tài liệu" như một hành động UI tổng quát (đổi tên/đổi loại một tài liệu đã tồn tại, ngoài chọn lúc tải lên) KHÔNG có sẵn ở app (không có nút "Edit" trên `DocFile` nói chung — chỉ có "chọn thư mục" cho tài liệu cá nhân qua dropdown dòng). Đã viết hàm service `setDocType` sẵn sàng cho UI tương lai, nhưng không thêm nút gọi vì không có luồng "sửa tài liệu" tương ứng để gắn vào (tránh thêm luồng mới ngoài scope).

---

## 3. Kết luận cuộc họp — sửa/xóa + đính kèm (HSMT mục 51)

**Việc:** `meetingService.ts` thêm `updateConclusion`, `removeConclusion`; `Conclusion.documentIds?`; UI tab biên bản: nút sửa/xóa cạnh từng kết luận (quyền chủ trì/thư ký), chọn tài liệu đính kèm, hiển thị link đính kèm.

**File sửa:**
- `src/domain/types.ts` — `Conclusion` thêm `documentIds?: string[]` và `updatedAt?: string` (ghi nhận thời điểm sửa gần nhất).
- `src/services/meetingService.ts` — `addConclusion` nhận thêm param `documentIds?`; thêm `updateConclusion(actor, meetingId, conclusionId, patch)` và `removeConclusion(actor, meetingId, conclusionId)`.
- `src/ui/pages/MeetingDetailPage.tsx` (`MinutesTab`) — mỗi kết luận hiện Badge tài liệu đính kèm (click-through không cần vì chỉ hiện tên, không mở modal — giữ đơn giản theo scope "hiển thị link"), nút sửa/xóa (icon-btn, chỉ `chairCtl`); form ghi kết luận mới có thêm picker chọn tài liệu (dropdown + Badge xóa, kiểu `VoteCreateModal`); thêm `ConclusionEditModal` (sửa nội dung/mục chương trình/tài liệu đính kèm).

**Ánh xạ HSMT:** mục 51 "Kết luận cuộc họp: thêm/xóa/sửa + đính kèm file" — nay đủ cả 3 hành động con.

---

## 4. Ký số ý kiến văn bản (HSMT mục 30 + quy trình lấy ý kiến văn bản dòng 373)

**Việc:** trong PollCard, thêm nút "Ký số & gửi ý kiến" bên cạnh "Gửi ý kiến" thường — modal PIN 6 số — badge "Đã ký số" trên ý kiến của mình và trong bảng tổng hợp (phiếu kín không lộ chữ ký/danh tính người khác) — ghi rõ mô phỏng chờ CA.

**File sửa:**
- `src/domain/types.ts` — `BallotSignature { signedAt, serialNumber, hash, signerName }`; `Ballot.signature?: BallotSignature`.
- `src/services/voteService.ts` — hàm mới `castBallotSigned(actor, voteId, optionId, comment, signPin)`:
  - Chế độ REST (`db.action` tồn tại): gọi `POST /actions/vote/:id/ballot` với body `{ optionId, comment, signPin }` — server tự tính chữ ký (không tin client), đúng hợp đồng field `signPin`.
  - Chế độ demo: validate PIN 6 số, tính `hash = sha256Hex(voteId|userId|optionId|comment)` (dùng `sha256Hex` sẵn có ở `src/services/sha256.ts`), sinh `serialNumber` ngẫu nhiên theo đúng khuôn mẫu ký biên bản (`VN-DEMO-CA:xxxx:xxxxxx`), ghi `Ballot.signature` rồi lưu.
- `src/ui/pages/PollsPage.tsx` — viết lại `PollCard`: 2 nút "Gửi ý kiến" (thường)/"Ký số & gửi ý kiến" (mở `PollSignModal`, tái dùng pattern `SignModal` ký biên bản trong `MeetingDetailPage.tsx`); dòng chú thích rõ "Ký số ở đây là mô phỏng (chưa tích hợp chứng thư số CA thật)"; badge "Đã ký số" hiện trên dòng "Bạn đã cho ý kiến" của chính mình, và trong bảng tổng hợp góp ý — CÓ kiểm tra `!p.secret` trước khi hiện badge kèm tên người khác (phiếu kín: ẩn cả tên VÀ badge ký số theo tên, chỉ còn dòng "Đại biểu (ẩn danh — phiếu kín)" không gắn badge).

**Ánh xạ HSMT:** mục 30 phần "Ký số file cho ý kiến vào văn bản" (đã 0% trước đây theo `ba-compliance-matrix.md` mục 4) + quy trình lấy ý kiến văn bản dòng 373.

**Giới hạn đã ghi rõ trên UI:** đây là ký số mô phỏng (serial tự sinh, không phải chứng thư X.509 thật) — đúng comment `docs`/báo cáo BA đã cảnh báo, KHÔNG claim đây là ký số PKI thật.

---

## 5. Phiếu lấy ý kiến dạng NHÁP (HSMT mục 13)

**Việc:** tạo phiếu cho phép "Lưu nháp (chưa gửi)"; PollsPage thêm filter "Chưa gửi"; nút "Gửi lấy ý kiến" chuyển draft→open.

**File sửa:**
- `src/domain/types.ts` — `VoteStatus` thêm `'draft'` (comment rõ: CHỈ áp dụng `kind='poll'`, `kind='vote'` không dùng trạng thái này).
- `src/domain/labels.ts` — `VOTE_STATUS.draft = { label: 'Nháp — chưa gửi', color: 'gray' }`.
- `src/services/voteService.ts` — `VoteDraft` thêm `saveAsDraft?: boolean`; `createVote`: `isDraftPoll = kind==='poll' && saveAsDraft===true` → `status = isDraftPoll ? 'draft' : (kind==='poll' ? 'open' : 'pending')` — **giữ nguyên 100% hành vi cũ** khi `saveAsDraft` không truyền (poll mở ngay, vote vẫn pending). `openVote` cập nhật thông báo/audit label tùy `kind` (đúng chữ "Gửi phiếu lấy ý kiến" cho poll thay vì "Mở biểu quyết"). `voteOutcome` xử lý riêng label cho `status==='draft'` ("Nháp — chưa gửi", tránh hiện sai "Không thông qua" nếu lỡ render outcome panel).
- `src/ui/pages/PollsPage.tsx` — filter thêm `'draft'` (chỉ hiện nút filter cho quản lý, có badge số lượng); `PollCard` ẩn khối kết quả/thống kê khi draft (`showResults` loại trừ draft); nút "Gửi lấy ý kiến" gọi `voteService.openVote` (tái dùng action `/vote/:id/open` có sẵn — đúng gợi ý "chế độ REST dùng action open có sẵn"); `PollCreateModal` có 2 nút submit: "Lưu nháp (chưa gửi)" và "Gửi phiếu" (2 giá trị `asDraft` khác nhau truyền vào `createVote`).

**Rà soát an toàn state machine:** đã grep toàn bộ `v.status ===`/`p.status ===` trong `src/` (23 vị trí) — xác nhận mọi nơi liên quan `kind:'vote'` (DashboardPage, LiveMeetingPage, MeetingDetailPage's VoteCard, ScreenDisplayPage, sim.ts) đều KHÔNG bị ảnh hưởng vì `createVote` chỉ set `'draft'` khi `kind==='poll'` — biểu quyết trong họp không đổi luồng.

**Ánh xạ HSMT:** mục 13 "DS văn bản CHƯA lấy ý kiến + sửa nội dung" — nay có view riêng (khác với mục 11 "đang gửi" và mục 12 "đã xong").

---

## 6. Cán bộ theo dõi (`trackerUserId`)

**File sửa:**
- `src/domain/types.ts` — `Vote.trackerUserId?: string`.
- `src/services/voteService.ts` — `VoteDraft.trackerUserId?`; `createVote` gán vào `vote.trackerUserId`.
- `src/ui/pages/PollsPage.tsx` — `PollCreateModal` thêm dropdown "Cán bộ theo dõi" (chọn từ `s.users` active); `PollCard` hiện "Cán bộ theo dõi: {tên}" nếu có; `ReportsPage.tsx` (`PollStatsTab`) hiện tên cán bộ theo dõi trong panel chi tiết văn bản đã chọn.

**Ánh xạ HSMT:** dòng 372 quy trình lấy ý kiến văn bản, bước "Cập nhật thông tin liên quan: Cán bộ theo dõi".

---

## 7. Lọc theo đơn vị chủ trì (HSMT mục 21/68)

**File sửa:**
- `src/ui/pages/MeetingsPage.tsx` — thêm `<select>` đơn vị (từ `s.units`, sort theo `order`) cạnh filter trạng thái; lọc theo `users.get(m.chairId)?.unitId === unitFilter` (đơn vị của người chủ trì phiên họp).

**Ánh xạ HSMT:** mục 21 (web) và 68 (mobile, dùng chung UI web).

---

## 8. ReportsPage — khoảng thời gian tùy chỉnh + xuất CSV (HSMT mục 52)

**File sửa:** `src/ui/pages/admin/ReportsPage.tsx` (`OpsReportTab`, nội dung cũ đã nâng cấp) — thay khung cố định "6 tháng gần nhất" bằng 2 ô `<input type="date">` (Từ ngày/Đến ngày, mặc định 6 tháng gần nhất để không đổi UX ban đầu); mọi số liệu/biểu đồ (`stats`) đều lọc theo `inRange()` trên khoảng đã chọn; nút "Xuất báo cáo (CSV)" ở đầu trang VÀ nút "Xuất CSV" nhỏ tại bảng "Hiệu quả chuyển đổi số" (cùng gọi `exportCsv`) — dùng `toCsv`/`downloadTextFile` có sẵn.

**Ánh xạ HSMT:** mục 52 "Thống kê theo thành viên tham gia (chọn thời gian, xem biểu đồ, xuất)" — trước đây thiếu "chọn thời gian tùy chỉnh" + "xuất", nay có cả 2.

---

## 9. Module Phản hồi người dùng (HSMT tiêu chí 5.1–5.4)

**Việc:** collection `feedbacks` vào tầng data (demo + REST); `feedbackService.ts`; trang "Hỗ trợ & Phản hồi" (form gửi + danh sách của tôi + trạng thái/trả lời); khu admin (danh sách toàn bộ, đổi trạng thái, trả lời); hotline/email đặt hằng trong labels; menu icon phù hợp.

**File tạo mới:**
- `src/services/feedbackService.ts` — `submitFeedback(actor, category, content)`, `myFeedbacks(all, userId)` (hàm thuần), `updateFeedback(actor, id, patch)` (chỉ quản lý — `can.manageMeetings` hoặc `unit_admin`, gửi notification cho người dùng khi có `response`).
- `src/ui/pages/SupportPage.tsx` — trang người dùng: form gửi (chọn `FeedbackCategory`, textarea), danh sách "Phản hồi của tôi" (badge loại + trạng thái + hiển thị trả lời nếu có), khối "Kênh hỗ trợ" đọc từ `SUPPORT_CHANNELS`.
- `src/ui/pages/admin/SupportAdminPage.tsx` — bảng toàn bộ phản hồi (lọc theo trạng thái), modal `ResponseModal` để đổi trạng thái + nhập nội dung trả lời cùng lúc.

**File sửa (đăng ký collection vào tầng data + hằng số + route/menu):**
- `src/domain/types.ts` — `FeedbackCategory`, `FeedbackStatus`, `Feedback` (khớp đúng hợp đồng field); `Snapshot.feedbacks: Feedback[]`.
- `src/domain/labels.ts` — `FEEDBACK_CATEGORY`, `FEEDBACK_STATUS`, hằng số `SUPPORT_CHANNELS` (`hotline` giờ hành chính, `hotlineAdmin` 24/7, `email`).
- `src/data/repository.ts` — `DataSource.feedbacks: Repo<Feedback>`.
- `src/data/db.ts` — `COLLECTIONS` thêm `'feedbacks'`; `LocalRepo('feedbacks')` (demo adapter).
- `src/data/restAdapter.ts` — `RestRepo('feedbacks')` (REST adapter dùng CRUD chung `/api/feedbacks`).
- `src/data/seed.ts` — `feedbacks: []` trong `buildSeed()` (seed rỗng theo yêu cầu).
- `src/store/AppContext.tsx` — `emptySnapshot.feedbacks = []`; `refresh()` gọi thêm `db.feedbacks.list()`.
- `src/App.tsx` — route `/support` (mọi user đăng nhập) và `/support-admin` (guard `RequireManage`: admin/chairman/secretary).
- `src/ui/MainLayout.tsx` — menu "Hỗ trợ & Phản hồi" (icon `question`, nhóm Tiện ích) cho mọi user; mục quản trị (nhóm "Quản trị hệ thống" cho admin, nhóm "Báo cáo" cho chairman/secretary).

**Icon:** dùng `question` — có sẵn trong bộ `EMOJI` (`src/ui/emojiIcons.ts`, đã xác nhận bằng grep 25 icon có sẵn: bell/book/building/calendar/.../question/room/...) đúng phong cách `ColorIcon` Fluent của menu hiện có; fallback `Icon` (Lucide) cho các nút phụ trong trang.

**Lưu ý backend:** đề bài yêu cầu "restAdapter dùng CRUD chung" — đã implement đúng bằng `RestRepo('feedbacks')` gọi `/api/feedbacks` theo cùng pattern các collection khác (`catalogs`, `guides`...); KHÔNG cần route đặc biệt phía server cho tính năng cơ bản CRUD, chỉ cần backend đăng ký collection `feedbacks` vào ACL/guard/db (việc của backend dev, ngoài phạm vi frontend).

---

## 10. Unit.adminType (Xã/Phường/Đặc khu)

**File sửa:**
- `src/domain/types.ts` — `UnitAdminType = 'xa' | 'phuong' | 'dac_khu'`; `Unit.adminType?: UnitAdminType`.
- `src/domain/labels.ts` — `UNIT_ADMIN_TYPE` (nhãn + màu badge: xã=green, phường=blue, đặc khu=purple).
- `src/ui/pages/admin/UnitsAdminPage.tsx` — thêm cột "Loại đơn vị" trong bảng (Badge hoặc "—"); modal thêm/sửa có `<select>` Xã/Phường/Đặc khu/Chưa phân loại.

**Ánh xạ:** đúng đề xuất trong `phantich-hethong.md` mục 4.2 việc #7 (chuẩn bị hạ tầng dữ liệu đúng bối cảnh trước khi viết seed mới — việc viết seed mới KHÔNG thuộc phạm vi nhiệm vụ này, không thực hiện).

---

## 11. Loading/disable cho thao tác chậm >10s (HSMT dòng 534) — MỘT PHẦN

**Đã làm:**
- `src/ui/pages/MeetingDetailPage.tsx` (`UploadModal.submit`) — thêm state `busy`, disable cả 2 nút (Hủy/Thêm tài liệu) khi đang xử lý, label nút đổi thành "Đang tải lên…" kèm icon `refresh`.
- `src/ui/pages/DocumentsPage.tsx` (`PersonalDocModal.submit`) — tương tự, disable nút + label "Đang tải lên…".
- `src/ui/pages/admin/ReportsPage.tsx` — cả 3 nút xuất CSV (`OpsReportTab` x2, `PollStatsTab` x1) có state `exporting`/disable + label "Đang xuất…" trong lúc xử lý.

**Chưa rà hết (bỏ dở, có lý do):** các nút xuất CSV khác trong app (`shared.tsx` exportComments, `MeetingDetailPage.tsx` exportAttendance ở `PeopleTab`) và các thao tác upload khác (`GuidesAdminPage`, `RoomsAdminPage` nếu có tải file) KHÔNG được rà — đây là hạng mục "(Nếu còn thời gian)" cuối cùng trong danh sách ưu tiên, đã dừng ở mức MỘT PHẦN sau khi hoàn tất đầy đủ 10 việc chính (1–10) và build PASS ổn định. Đề xuất rà tiếp ở lượt sau nếu cần đầy đủ 100%: các file còn lại có pattern `onClick={() => { ... download... }}` không có state loading — dễ áp cùng pattern `busy`/`disabled` đã dùng ở trên.

---

## TÓM TẮT ÁNH XẠ VIỆC → MỤC HSMT

| # | Việc | Mục HSMT (web) | Mục HSMT (mobile) |
|---|---|---|---|
| 1 | Thống kê ý kiến văn bản | 48, 53 | 92, 97 |
| 2 | Danh mục loại tài liệu | 8 | — |
| 3 | Sửa/xóa/đính kèm kết luận | 51 | 95 (rút gọn, chỉ xem — không ảnh hưởng) |
| 4 | Ký số ý kiến văn bản | 30 | 76 (mobile không yêu cầu ký số — không ảnh hưởng) |
| 5 | Phiếu nháp (chưa gửi) | 13 | — |
| 6 | Cán bộ theo dõi | quy trình dòng 372 | — |
| 7 | Lọc theo đơn vị chủ trì | 21 | 68 |
| 8 | ReportsPage khoảng thời gian + xuất | 52 | 96 (mobile không yêu cầu xuất — đã đủ) |
| 9 | Module Phản hồi người dùng | tiêu chí 5.1–5.4 | — |
| 10 | Unit.adminType | (hạ tầng dữ liệu, chuẩn bị mục 1 QLDCTC nhóm A) | — |
| 11 | Loading/disable | dòng 534 (một phần) | — |

## FILE ĐÃ TẠO MỚI (3)

- `src/services/feedbackService.ts`
- `src/ui/pages/SupportPage.tsx`
- `src/ui/pages/admin/SupportAdminPage.tsx`

## FILE ĐÃ SỬA (20)

`src/App.tsx`, `src/data/db.ts`, `src/data/repository.ts`, `src/data/restAdapter.ts`, `src/data/seed.ts`, `src/domain/labels.ts`, `src/domain/types.ts`, `src/services/documentService.ts`, `src/services/meetingService.ts`, `src/services/voteService.ts`, `src/store/AppContext.tsx`, `src/ui/MainLayout.tsx`, `src/ui/pages/DocumentsPage.tsx`, `src/ui/pages/MeetingDetailPage.tsx`, `src/ui/pages/MeetingsPage.tsx`, `src/ui/pages/PollsPage.tsx`, `src/ui/pages/admin/CatalogsAdminPage.tsx`, `src/ui/pages/admin/ReportsPage.tsx`, `src/ui/pages/admin/UnitsAdminPage.tsx`, `src/ui/pages/shared.tsx`.

## HẠNG MỤC BỎ DỞ / GIỚI HẠN ĐÃ BIẾT

1. **"Sửa tài liệu" tổng quát** (mục 2) — chưa có nút UI vì app chưa có luồng "sửa tài liệu" nói chung để gắn vào; hàm service `setDocType` đã viết sẵn sàng dùng khi luồng đó xuất hiện.
2. **Rà loading/disable toàn diện** (mục 11) — chỉ áp dụng cho 2 modal upload chính + 3 nút xuất CSV lớn nhất (ReportsPage); còn `shared.tsx`/`PeopleTab` export và các trang admin khác chưa rà — bỏ dở có chủ đích vì đây là mục ưu tiên thấp nhất ("nếu còn thời gian") và đã hoàn tất đầy đủ 10 việc ưu tiên cao hơn.
3. **Không đổi ngữ nghĩa `DocFile.kind`** — xác nhận bằng grep, tuân thủ nghiêm ngặt ràng buộc đề bài.
4. **Không sửa server/server-dotnet** — mọi field mới (`Ballot.signature`, `Vote.trackerUserId`, `Vote.status='draft'`, `Unit.adminType`, `DocFile.docTypeId`, collection `feedbacks`) chỉ có ở frontend theo đúng hợp đồng field đã thỏa thuận; chế độ REST gọi action/CRUD đúng tên (`signPin` trong action ballot, action `/vote/:id/open` cho draft→open, CRUD chung cho `feedbacks`) — chờ backend dev hoàn thiện phía server song song.
