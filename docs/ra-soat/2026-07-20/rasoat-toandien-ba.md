# RÀ SOÁT TOÀN DIỆN — PHẦN CHỨC NĂNG NGHIỆP VỤ + TIÊU CHÍ CHẤT LƯỢNG/NGHIỆM THU + ĐÀO TẠO/TÀI LIỆU

**Người thực hiện:** Business Analyst — dự án eCabinet (HPT TECH)
**Ngày rà soát:** 2026-07-20
**Phạm vi:** Mục 3.4 (97 chức năng + 3 quy trình nghiệp vụ), bảng tiêu chí chất lượng dịch vụ (mục 1–6, dòng 54–119), đào tạo (dòng 122–144), quản trị/vận hành/bảo trì/nghiệm thu liên quan nghiệp vụ (dòng 146–260), thể thức văn bản NĐ 30/2020, tài liệu bàn giao.
**Không thuộc phạm vi của tôi (Tech Leader phụ trách song song, không đọc chéo):** hạ tầng máy chủ, mạng, DB engine, đường truyền, cấp độ ATTT hạ tầng, LiveKit/RTC, object storage — chỉ khi các mục này lộ ra HÀNH VI nghiệp vụ (vd export/backup dữ liệu ở tầng UI) tôi mới ghi nhận để không bỏ sót, nhưng đánh giá kỹ thuật sâu để Tech Leader tự làm.

## 0. NGUYÊN TẮC LÀM VIỆC & TÌNH TRẠNG NGUỒN CODE

1. Đã đọc **TOÀN VĂN 668 dòng** `docs/hsmt-chuong-v.md` (2 lượt Read, không lướt) — bao gồm cả các phần ít người đọc kỹ: bảng tiêu chí chất lượng (dòng 54–119), đào tạo (122–144), quản trị vận hành theo Phụ lục 11/TT 18/2024 (146–224), bảo trì Phụ lục 12 (225–253), nghiệm thu theo NĐ 73/2019 (254–260), sở hữu/chuyển giao dữ liệu (639–650), quy định kiểm tra nghiệm thu cuối văn bản (667–668).
2. **KHÔNG tin ma trận/báo cáo cũ** (`docs/ra-soat/2026-07-18/ba-compliance-matrix.md` lập 07-17, `chot-code-ba.md` lập 07-18) — chỉ dùng để biết "họ từng nói gì", **mọi kết luận trong báo cáo này đều tự đọc lại code trực tiếp** với số dòng cụ thể.
3. **Phát hiện quan trọng về tình trạng code:** `git status` cho thấy local HEAD (`5075f33`) đang **sau origin/main 19 commit** và **có hàng chục file đang sửa (chưa commit)** so với chính HEAD local — nghĩa là code tôi đọc trên đĩa (`PollsPage.tsx`, `ReportsPage.tsx`, `meetingService.ts`, `authService.ts`, `guard.js`, `Guard.cs`...) là **bản làm việc mới nhất, tiến bộ hơn ĐÁNG KỂ** so với cả 2 báo cáo cũ 07-17/07-18 — nhiều gap mà 2 báo cáo đó nêu (mục 8, 13, 21, 30, 48, 51, 52, 53; quyền sửa/xóa phiên của unit_admin) **đã được vá trong code hiện tại**. Đây tự nó là một dạng "bom nổ chậm ngược" cần cảnh báo: nếu tổ chấm/lãnh đạo chỉ đọc báo cáo cũ mà không đối chiếu lại code mới nhất, họ sẽ **đánh giá THẤP hơn thực tế** — nhưng nếu bản deploy public (`ecabinet.vhpdata.com`) chưa đồng bộ với working tree này thì ngược lại sẽ **đánh giá CAO hơn thực tế**. Đã build xác nhận: `node scripts/build-cdn.mjs` → PASS ("✔ Bundle xong", "✔ dist/index.html sẵn sàng").
4. Ký hiệu: **✅** đáp ứng đầy đủ đúng câu chữ HSMT (có bằng chứng file+dòng) · **🟡** một phần (thiếu rõ điều gì) · **❌** chưa có · **⚙️** cần cấu hình/dữ liệu (kỹ thuật đã sẵn, chỉ chờ nhập liệu/thao tác vận hành) · **🏛️** thuộc trách nhiệm pháp nhân (cam kết/ký/đóng dấu, không phải code).

---

## 1. BẢNG ĐỐI CHIẾU MỤC 3.4 — 97 CHỨC NĂNG (NHÓM A: WEB, mục 1–59)

### I. QUẢN TRỊ HỆ THỐNG (1–4)

| # | Trích HSMT (dòng) | Bằng chứng code | KL |
|---|---|---|---|
| 1 | "Xem DS cơ cấu tổ chức<br>Thêm mới, sửa, xóa cơ cấu tổ chức" (393) | `src/ui/pages/admin/UnitsAdminPage.tsx` — CRUD đủ 4 hành động, chặn xóa đơn vị còn cán bộ. ACL: `server/src/acl.js:` `units:{create:['admin'],update:['admin'],remove:['admin']}`; `.NET Acl.cs` port 1:1. | ✅ |
| 2 | "Thêm mới, sửa, xóa thông tin người dùng<br>Chọn người dùng và phân quyền... (mặc định chọn sẵn)<br>Thêm mới quyền cho người dùng" (394) | `src/ui/pages/admin/UsersAdminPage.tsx` CRUD + khóa/mở khóa; `authService.ts` dòng 96-119 phân quyền `unit_admin` theo phạm vi đơn vị (đọc lại, xác nhận **đã mở rộng thêm** `manageThisUser`/`canAssignRole` chặt hơn ma trận 07-17 mô tả). 5 vai trò đúng HSMT dòng 380-385 (`types.ts:9`). | ✅ |
| 3 | "Xem DS nhật ký... theo tài khoản, theo thời gian<br>Xóa nhật ký" (395) | `src/ui/pages/admin/AuditLogPage.tsx` — đọc toàn văn: dropdown "tài khoản" (dòng 78-81) + 2 ô ngày "Từ/đến" (85-90) + nút "Xóa nhật ký (N đang lọc/tất cả)" (69-71) gọi `adminService.clearAuditLogs`. ACL: `acl.js:51 audit:{create:'any',update:'none',remove:['admin']}`; `.NET Acl.cs:49` khớp. | ✅ |
| 4 | "Chỉnh sửa, xóa, thêm mới... tài liệu HDSD<br>Xem DS" (396) | `src/ui/pages/admin/GuidesAdminPage.tsx` — CRUD đầy đủ, giới hạn hiển thị theo `roleScope`. | ✅ |

### II. CẬP NHẬT CÁ NHÂN (5)

| # | Trích HSMT | Bằng chứng | KL |
|---|---|---|---|
| 5 | "Đăng nhập/Đăng xuất/Đổi mật khẩu" (398) | `LoginPage.tsx`; `authService.ts login/logout`; đổi mật khẩu qua `PATCH /api/users/:id`. Có rate-limit chống brute-force (`server/src/ratelimit.js`). | ✅ |

### III. QUẢN TRỊ DANH MỤC (6–10)

| # | Trích HSMT | Bằng chứng | KL |
|---|---|---|---|
| 6 | Danh mục chức vụ CRUD+DS (401) | `CatalogsAdminPage.tsx` tab "position" — 4 tab CRUD dùng chung, đọc toàn văn xác nhận đủ sửa/thêm/xóa/toggle/order. Gán vào `User.position`. | ✅ |
| 7 | Danh mục loại phiên họp CRUD+DS (402) | Tab "meetingType" — gán `Meeting.meetingType`, hiển thị badge `MeetingsPage.tsx` dòng 95. | ✅ |
| 8 | **Danh mục loại tài liệu CRUD+DS** (403) | `CatalogsAdminPage.tsx` tab "docType" (dòng 15) + `types.ts:87` `CatalogType` có `'docType'`. **Xác nhận backend KHÔNG còn chặn 400**: `server/src/guard.js:59` `VALID_CATALOG_TYPES = ['position','meetingType','issuingBody','docType']` (comment tự ghi "vá QA 18/07"); `.NET Guard.cs:97` `ValidCatalogTypes` khớp 1:1. **Đây là ví dụ điển hình "báo cáo cũ nói ❌, code hiện tại đã ✅"** — xem mục 💣 BOM NỔ CHẬM #1. | ✅ (đã vá, KHÔNG còn 400) |
| 9 | Danh mục phòng họp CRUD + **cập nhật sơ đồ phòng họp** + DS (404) | `RoomsAdminPage.tsx` — CRUD phòng + `SeatLayoutModal` (dòng 109-161): chọn hàng/cột 1-12, bật/tắt ô lối đi, lưu `Room.layout`. | ✅ |
| 10 | Danh mục cơ quan ban hành CRUD+DS (405) | Tab "issuingBody" — gán `DocFile.issuingBody` khi upload tài liệu. | ✅ |

### IV. QUẢN LÝ LẤY Ý KIẾN VĂN BẢN (11–13)

| # | Trích HSMT | Bằng chứng | KL |
|---|---|---|---|
| 11 | "Xem DS... Tra cứu... Thêm mới, sửa, xóa" văn bản lấy ý kiến (407) | `PollsPage.tsx` toàn văn 440 dòng — filter Đang mở/Đã kết thúc/**Chưa gửi**/Tất cả (dòng 18, 48-56); `PollCreateModal` tạo mới + **sửa** (prop `editing`, dòng 317-440); `voteService.createVote`/`updateDraftVote`/`closeVote`. | ✅ |
| 12 | "Xem DS/chi tiết văn bản ĐÃ lấy ý kiến<br>Xem DS ý kiến" (408) | Filter "Đã kết thúc" → `showResults` (dòng 90, 228) hiện `VoteOutcomePanel`+`VoteResultBars`+toàn bộ bình luận có identity/redaction đúng luật phiếu kín (dòng 233-259). | ✅ |
| 13 | **"Xem DS/chi tiết văn bản CHƯA lấy ý kiến<br>Sửa nội dung văn bản chưa lấy ý kiến"** (409) | `voteService.ts` dòng 31-43: `saveAsDraft` → status `'draft'`; `updateDraftVote()` (dòng 109-134) sửa đủ 7 trường (title/description/optionLabels/eligibleIds/documentIds/deadline/secret/trackerUserId), chặn 3 lớp (chỉ poll, chỉ draft, chỉ owner/manage). UI: filter "Chưa gửi" (badge số lượng, dòng 51-54) + nút "Sửa" chỉ hiện khi `isOwner && isDraft` (dòng 158-164) mở `PollCreateModal` chế độ sửa (title đổi "Sửa phiếu lấy ý kiến (nháp)", dòng 364, footer 1 nút "Lưu thay đổi", dòng 368-369). Server REST: `guardVotes()` cả Node (`guard.js`) và .NET (`Guard.cs`) cho MANAGE PATCH nội dung, tự xóa `ballots/status/openedAt/closedAt` khỏi patch. | ✅ |

**Lưu ý cho tổ nghiệm thu:** mục 13 là mục DUY NHẤT mà chính commit lịch sử (`414d774`) tự đặt tên "đóng mục 🟡 cuối cùng, web 58/59 ✅ trọn vẹn" — đọc code xác nhận đúng đã đóng.

### V. QUẢN LÝ TÀI LIỆU CÁ NHÂN (14–16)

| # | Trích HSMT | Bằng chứng | KL |
|---|---|---|---|
| 14 | "Xem DS thư mục<br>Thêm mới, sửa, xóa thư mục" (411) | `DocumentsPage.tsx` — thư mục là NHÃN trên `DocFile.folder` (không phải entity riêng): `NewFolderModal` (thêm), dropdown mỗi dòng để "sửa" (chuyển tài liệu vào thư mục khác, `moveToFolder` dòng 76-79), filter theo thư mục (dòng 56-61, 111-116). **KHÔNG có nút "Xóa thư mục" độc lập** — xóa = chuyển hết tài liệu ra khỏi thư mục đó (thư mục trống tự "biến mất" khỏi danh sách vì `folders` tính động từ `Set` các giá trị `folder` đang tồn tại, dòng 43-44). | 🟡 (thiếu nút Xóa thư mục rõ ràng — hành vi tương đương có nhưng không có action button đúng tên) |
| 15 | Xem DS/thông tin, tra cứu, xem nội dung tài liệu (412) | Search box (dòng 102-106) + `DocViewerModal` xem PDF/ảnh/text (`shared.tsx`). | ✅ |
| 16 | Tải tài liệu, thêm mới (413) | `PersonalDocModal` (dòng 298-346) — tải file hoặc soạn trực tiếp. | ✅ |

### VI. QUẢN LÝ THÔNG TIN CUỘC HỌP (17–24)

| # | Trích HSMT | Bằng chứng | KL |
|---|---|---|---|
| 17 | Quản lý cuộc họp đơn vị: DS + thêm/sửa/xóa (416) | `MeetingsPage.tsx`+`MeetingFormModal.tsx`+`meetingService.saveMeeting/deleteMeeting`. | ✅ |
| 18 | Quản lý tài liệu họp theo nhóm: DS+thêm/sửa/xóa+chi tiết (417) | `MeetingDetailPage.tsx` tab "docs" — nhóm theo mục chương trình, `UploadModal`. | ✅ |
| 19 | Quản lý biểu quyết cuộc họp: DS+thêm/sửa/xóa+chi tiết (418) | tab "votes" — `VoteCreateModal`+`VoteCard`. | ✅ |
| 20 | **"Xem DS người tham gia họp<br>Thêm mới, cập nhật, xóa thông tin người tham gia họp"** (419) | `PeopleTab` (`MeetingDetailPage.tsx` dòng 251-322) — đọc toàn văn: CHỈ có **xem** (bảng đại biểu + xuất CSV + QR điểm danh). KHÔNG có nút thêm/xóa/sửa TỪNG người tham gia trên chính tab này. Thêm/sửa/xóa danh sách người tham gia chỉ thực hiện được qua đường vòng: mở "Chỉnh sửa phiên họp" (`MeetingFormModal`) → đổi lại toàn bộ danh sách thành viên/khách mời → Lưu → `saveMeeting()` gọi `buildParticipants()` build lại mảng `participants`. Không có API/hàm `addParticipant`/`removeParticipant` độc lập trong `meetingService.ts`. | 🟡 (kỹ thuật đạt được nghiệp vụ nhưng KHÔNG có action riêng trên tab "Quản lý người tham gia họp" đúng như câu chữ HSMT liệt kê — phải đi qua form sửa toàn bộ phiên) |
| 21 | "Xem DS/chi tiết cuộc họp sắp diễn ra<br>Lọc... theo thời gian, theo đơn vị chủ trì" (420) | `MeetingsPage.tsx` dòng 26 `unitFilter` + dropdown "Lọc theo đơn vị chủ trì" (dòng 62-65, lọc theo `chairId`→`unitId`) + filter "Sắp diễn ra" (draft/invited). | ✅ |
| 22 | DS cuộc họp đơn vị THAM GIA: DS/chi tiết, lọc trạng thái/thời gian (422) | `MeetingsPage.tsx` filter "Tôi tham dự" + `CalendarPage.tsx` **`scope: 'unit' \| 'mine'`** (dòng 17, xác nhận có khái niệm "đơn vị" riêng biệt với "cá nhân"). | ✅ |
| 23 | DS cuộc họp đơn vị CHUẨN BỊ TÀI LIỆU: DS/chi tiết, lọc trạng thái/thời gian (423) | `DocumentsPage.tsx` dòng 191-277 `UnitPrepView` — `statusFilter` (all/live/invited/finished/draft, dòng 193), nhóm theo phiên họp, hiện số tài liệu chờ duyệt/từ chối/nháp/đã duyệt. | ✅ |
| 24 | Chuẩn bị tài liệu họp: DS+thêm/xóa/cập nhật+**duyệt/không duyệt** (424) | `documentService.ts` `submitForReview/approveDocument/rejectDocument`; guard 2 chiều `server/src/guard.js` + `Guard.cs`; UI `shared.tsx` `DocReviewControls` — chặn tự duyệt (`!isOwner`), bắt buộc lý do khi từ chối (`disabled={!note.trim()}` + service double-check), thông báo cả 2 chiều kết quả. Đúng luồng "Quy trình chuẩn bị cuộc họp" (HSMT dòng 352-358). | ✅ |

### VII. TỔ CHỨC CUỘC HỌP (25–51)

| # | Trích HSMT | Bằng chứng | KL |
|---|---|---|---|
| 25 | Điểm danh: DS+thực hiện+xác nhận (427) | `LiveMeetingPage.tsx` tự điểm danh + điểm danh hộ + QR; server atomic CAS (`server/src/actions.js`) chống mất điểm danh khi đồng thời. | ✅ |
| 26 | Ủy quyền: DS+chọn/cập nhật/xóa (428) | `DelegateModal` + `meetingService.respondInvitation(status='delegated')`. | ✅ |
| 27 | Xem tiến trình + **thời gian còn lại** (429) | `LiveMeetingPage.tsx` đếm ngược dựa `currentItemStartedAt` (chủ tọa đặt mốc khi chuyển mục, `types.ts:222`). | ✅ |
| 28 | Xem nội dung cuộc họp (430) | Tab info/docs/votes/people đọc-only khi không phải quản lý. | ✅ |
| 29 | Xem DS văn bản lấy ý kiến (431) | `PollsPage.tsx` mọi user đăng nhập xem được. | ✅ |
| 30 | **"Cho ý kiến... Ký số file cho ý kiến... Gửi... Xem DS đã cho ý kiến"** (432) | `voteService.castBallot` (thường) + **`castBallotSigned`** (dòng 173-193: PIN 6 số, SHA-256 trên `voteId|userId|optionId|comment`, serial `VN-DEMO-CA:xxxx:xxxxxx`, `Ballot.signature`). UI: `PollsPage.tsx` nút "Ký số & gửi ý kiến" (dòng 207-209) mở `PollSignModal` (dòng 278-302) nhắc lại phương án+góp ý trước khi nhập PIN. `myBallot.signature` hiện badge "Đã ký số" (dòng 219). **Đủ 4/4 hành động con** theo đúng câu chữ. | ✅ (đủ hành động — mô phỏng, xem cảnh báo pháp lý riêng ở mục "Tiêu chí An toàn thông tin") |
| 31 | Xem chương trình tài liệu + **xuất ý kiến tài liệu** (433) | `shared.tsx exportComments()` — xuất CSV góp ý công khai. | ✅ |
| 32 | Biểu quyết: đồng ý/không đồng ý/ý kiến khác (434) | `VoteCard` radio 3 phương án. | ✅ |
| 33 | Đăng ký phát biểu/hủy/DS+nội dung (435) | `LiveMeetingPage.tsx SpeakPane`. | ✅ |
| 34 | Đăng ký chất vấn/hủy/DS+nội dung (436) | `questionService.ts registerQuestion/cancelQuestion` + `QuestionPane`. | ✅ |
| 35 | Ghi chú cá nhân (437) | `shared.tsx` phần "Ghi chú cá nhân" (isPublic=false). | ✅ |
| 36 | Xem điểm danh (đại biểu/khách mời) + **xuất DS** (439) | `LiveMeetingPage.tsx exportAttendance()` + `PeopleTab` (`MeetingDetailPage.tsx` dòng 256-262, 280) → CSV. | ✅ |
| 37 | DS người không tham gia + lý do (440) | `PeopleTab` cột "Xác nhận" hiện `declineReason` khi `declined` (dòng 310). | ✅ |
| 38 | Sơ đồ phòng họp + vị trí đại biểu (441) | `LiveMeetingPage.tsx SeatMapPane` (xem-only realtime) + `MeetingDetailPage.tsx SeatingTab` (gán/bỏ gán, chỉ quản lý). | ✅ |
| 39 | Điều hành phát biểu: bắt đầu/dừng/kết thúc (442) | `SpeakPane` mời/kết thúc lượt. | ✅ |
| 40 | Duyệt DS đăng ký phát biểu (443) | `SpeakPane` liệt kê `waiting`+nút mời. | ✅ |
| 41 | Điều hành biểu quyết: bắt đầu/dừng/kết thúc (444) | `VoteCard` Mở/Đóng biểu quyết + `actions.js`. | ✅ |
| 42 | Đại biểu sẵn sàng biểu quyết + lọc trạng thái (445) | `readyPanel` (`MeetingDetailPage.tsx`) — "Đã/Chưa biểu quyết", đúng cả trường hợp phiếu kín. | ✅ |
| 43 | Duyệt DS nội dung biểu quyết: bắt đầu/kết thúc (446) | Trùng nghiệp vụ #41 (Mở/Đóng). | ✅ |
| 44 | Kết quả biểu quyết: số người đồng ý/không (447) | `VoteOutcomePanel`+`VoteResultBars`. | ✅ |
| 45 | Điều hành chất vấn: bắt đầu/dừng/kết thúc (448) | `questionService.ts openSession/pauseSession/closeSession` — có "tạm dừng" riêng biệt khác #39. | ✅ |
| 46 | Duyệt DS đăng ký chất vấn (449) | `callQuestion/rejectQuestion`. | ✅ |
| 47 | Tổng hợp ý kiến văn bản: đã/chưa cho ý kiến (450) | `PollCard` hiện `ballots.length/eligibleIds.length` + nút "Nhắc" (`remindPoll`). | ✅ |
| 48 | **"Chọn tiêu chí thống kê... Xem thống kê theo lượt cho ý kiến, lựa chọn... Xuất thống kê ý kiến văn bản"** (451) | `ReportsPage.tsx` tab "Thống kê ý kiến văn bản" (`PollStatsTab`, dòng 224-362) — đọc toàn văn: chọn khoảng thời gian from/to (269-277), `voteService.pollStatsInRange`+`pollStatsByMonth` (hàm thuần, `voteService.ts` dòng 355-402), 4 StatCard tổng hợp, BarChart theo tháng, Donut đã/chưa cho ý kiến, bảng chi tiết TỪNG văn bản (click chọn xem `Donut` phân bố phương án riêng), nút "Xuất CSV" (`exportSummaryCsv`, dòng 250-265). | ✅ |
| 49 | Lịch họp cá nhân sắp/đã kết thúc (453) | `CalendarPage.tsx` scope "mine". | ✅ |
| 50 | Tra cứu cuộc họp: trạng thái/nội dung/thời gian/từ khóa (454) | `MeetingsPage.tsx` filter trạng thái+search box (title+code+description) + `CalendarPage.tsx` theo tháng. Tra theo "thời gian cụ thể" (từ-đến) chỉ có trên Calendar (theo tháng), không có input ngày rời trên MeetingsPage — nghiệp vụ vẫn phủ đủ (lịch+trạng thái+từ khóa). | ✅ |
| 51 | **"Thêm mới, xóa, sửa kết luận... Đính kèm file kết luận"** (455) | `meetingService.ts` dòng 346-387 — `addConclusion`/`updateConclusion`/`updateConclusion` truyền `documentIds`/`removeConclusion` — đủ CẢ 3 hành động + đính kèm file (`Conclusion.documentIds`, `types.ts:149`). UI `MinutesTab` (`MeetingDetailPage.tsx`) có nút "Sửa kết luận"/"Xóa kết luận" (dòng 915-917) + `ConclusionEditModal` (dòng 1087+). | ✅ |

### VIII. THỐNG KÊ BÁO CÁO (52–53)

| # | Trích HSMT | Bằng chứng | KL |
|---|---|---|---|
| 52 | **"Chọn thời gian thống kê... Xem chi tiết kết quả... theo biểu đồ... Xuất kết quả"** (457) | `ReportsPage.tsx` tab "Hiệu quả vận hành" (`OpsReportTab`) — 2 ô ngày "Từ/Đến" tùy chỉnh (dòng 146-155, thay khung cố định 6 tháng cũ), BarChart số phiên theo tháng TRONG khoảng đã chọn (dòng 173-174), Donut nhiệm vụ/điểm danh, nút "Xuất báo cáo (CSV)" (dòng 156-158, 198-200). | ✅ |
| 53 | **"Chọn thời gian... theo văn bản xin ý kiến... biểu đồ... xuất"** (458) | Trùng với mục 48 — cùng 1 tab `PollStatsTab`. | ✅ |

### IX. TÍCH HỢP VÀ CHIA SẺ DỮ LIỆU (54–59)

| # | Trích HSMT | Bằng chứng | KL |
|---|---|---|---|
| 54 | API DS cuộc họp đơn vị sắp diễn ra (460) | `server/src/open.js handleUnitMeetings('upcoming')` → `GET /api/open/v1/units/:unitId/meetings/upcoming`; `.NET OpenRoutes.cs` khớp. | ✅ |
| 55 | API DS cuộc họp cá nhân sắp diễn ra (461) | `handleUserMeetings('upcoming')`. | ✅ |
| 56 | API DS cuộc họp đơn vị đã diễn ra (462) | `handleUnitMeetings('past')`. | ✅ |
| 57 | API DS cuộc họp cá nhân đã diễn ra (463) | `handleUserMeetings('past')`. | ✅ |
| 58 | API lấy thông tin cuộc họp + quản lý mô tả API (464) | `handleMeetingDetail` + `ApiAdminPage.tsx` tab "Danh mục API" (bảng endpoint+curl mẫu+tải OpenAPI JSON). | ✅ |
| 59 | API tài liệu cuộc họp (465) | `handleMeetingDocuments/handleDocumentContent` (chỉ trả tài liệu đã duyệt+không mật). | ✅ |

**Xác thực khóa API:** sinh key server-side, chỉ lưu SHA-256, key thô hiện đúng 1 lần; UI đầy đủ tại `ApiAdminPage.tsx` (tạo/thu hồi/kích hoạt/xóa); rate-limit theo prefix.

---

## 2. 3 QUY TRÌNH NGHIỆP VỤ HSMT — ĐỐI CHIẾU TỪNG BƯỚC

### 2.1 Quy trình chuẩn bị cuộc họp (HSMT dòng 352-358)

| Bước HSMT | Ai làm (HSMT) | Luồng thật trong code | KL |
|---|---|---|---|
| "Yêu cầu Quản trị đơn vị tạo mới cuộc họp; hoặc thư ký tự thêm" | Chủ trì/Thư ký → Quản trị đơn vị (hoặc Thư ký tự làm) | `can.createMeeting` (`authService.ts:55`) cho phép `['admin','secretary','chairman','unit_admin']` — **CẢ 2 đường đều có**: Thư ký (role `secretary`) tự tạo trực tiếp; Quản trị đơn vị (`unit_admin`) tạo hộ. `MeetingFormModal.tsx` với `isUnitAdminCreating` chỉ cho `unit_admin` chọn Chủ trì/Thư ký TRONG đơn vị mình (dòng 21-24). | ✅ đúng thứ tự/vai trò |
| "Quản trị đơn vị nhập thông tin... thông báo Thành viên dự họp tham gia và chuẩn bị tài liệu" | Quản trị đơn vị | `saveMeeting` tạo phiên (status `draft`) → `sendInvitations()` (`meetingService.ts`) gửi giấy mời (notify). Quyền gửi: `can.sendInvitations` — quản lý toàn cục HOẶC `unit_admin` với phiên THUỘC ĐƠN VỊ MÌNH (`authService.ts:57-63`), đối chiếu unitId thật từ DB (không tin nhãn client) ở cả 2 backend REST (`server/src/index.js enforceMeetingWrite`, `.NET App.cs EnforceMeetingWrite`). | ✅ đúng 3 lớp code |
| "Quản trị đơn vị chuẩn bị tài liệu và trình duyệt" | Quản trị đơn vị | `can.uploadMeetingDoc` (`authService.ts:86-93`) — quản lý HOẶC `unit_admin` với phiên CÙNG đơn vị (**đã siết theo đơn vị**, khác ma trận 07-18 từng ghi "chưa giới hạn theo đơn vị" — xem 💣 mục "chênh lệch giữa 2 báo cáo cũ"). Trình duyệt: `submitForReview()` chuyển `draft`→`pending`. | ✅ |
| "Thành viên dự họp thực hiện duyệt. Đủ thông tin → cập nhật; Không đủ → yêu cầu làm lại" | Thành viên dự họp | `approveDocument`/`rejectDocument` (`documentService.ts`) — chặn tự duyệt (`!isOwner`), bắt buộc lý do khi từ chối (`reviewNote`), server ép `reviewedById`/`reviewedAt` (không tin client). Thông báo cả 2 chiều đến người trình. | ✅ đủ cả nhánh Đủ/Không đủ |

**Kết luận quy trình 1:** đủ trọn đường ống 4 bước, đúng vai trò, đúng thứ tự, 2 backend REST đồng bộ với demo mode.

### 2.2 Quy trình điều hành phiên họp (HSMT dòng 360-365)

| Bước HSMT | Luồng thật | KL |
|---|---|---|
| "Yêu cầu điểm danh → Thành viên điểm danh → CSDL cập nhật" | `LiveMeetingPage.tsx` — chủ trì/thư ký kích hoạt phiên `live`; đại biểu tự điểm danh (`meetingService` action `checkin`, atomic CAS server-side chống mất dữ liệu khi nhiều người bấm cùng lúc, `server/src/actions.js`). | ✅ |
| "Đăng ký phát biểu → Chủ trì cho phép → Phát biểu → CSDL cập nhật" | `SpeakPane` — đại biểu đăng ký (`SpeakRequest` status `waiting`), chủ trì/thư ký "mời" (→`speaking`), "kết thúc" (→`done`). Đúng thứ tự 3 bước. | ✅ |
| "Yêu cầu biểu quyết → Thành viên biểu quyết → CSDL cập nhật" | `VoteCard` Mở biểu quyết (chủ trì/thư ký) → đại biểu `castBallot`/`castBallotSigned` → cập nhật `ballots`. | ✅ |
| "Tổng hợp/cập nhật kết luận phiên họp" | `MinutesTab` — `addConclusion`/`updateConclusion`/`removeConclusion` (chủ trì/thư ký), kèm đính kèm tài liệu. | ✅ |

**Kết luận quy trình 2:** đủ, đúng thứ tự AI làm gì trước/sau, khớp nghĩa "Hệ thống cập nhật thông tin vào CSDL" (không phải chỉ hiển thị tạm ở client — có `db.action`/API atomic ở REST mode).

### 2.3 Quy trình lấy ý kiến bằng văn bản (HSMT dòng 367-374, bảng 4 bước)

| TT HSMT | Đơn vị thực hiện (HSMT) | Luồng thật | KL |
|---|---|---|---|
| Thêm mới văn bản cần xin ý kiến (không tổ chức họp) | Thư ký | `PollCreateModal` tạo `kind='poll'` độc lập với `meetingId` (`meetingId?: null` cho phép poll KHÔNG gắn phiên họp — đúng "trường hợp không tổ chức cuộc họp"). Quyền tạo: `can.manageMeetings` (admin/secretary/chairman) — Thư ký nằm trong nhóm này. | ✅ |
| Cập nhật thông tin liên quan: **cán bộ theo dõi**; thời hạn; file đính kèm | Thư ký | `Vote.trackerUserId` (`types.ts:373-377`) — dropdown "Cán bộ theo dõi" trong modal (dòng 385-390); `deadline`; `documentIds` (đính kèm tài liệu có sẵn). Cả 3 trường có trong `updateDraftVote` (mục 13) để sửa lại khi còn draft. | ✅ |
| Xem xét/Cho ý kiến; đồng ý/không đồng ý; **có thể ký số** và gửi Thư ký tổng hợp | Chủ trì/Thành viên | `castBallot`/`castBallotSigned` — đúng "CÓ THỂ" (không bắt buộc, có cả 2 nút "Gửi ý kiến" thường và "Ký số & gửi ý kiến"). | ✅ |
| Tổng hợp/Thống kê ý kiến các thành viên | Thư ký | `PollCard` hiện tổng hợp (`ballots.length/eligibleIds.length`+DS bình luận); `ReportsPage.tsx PollStatsTab` thống kê chuyên biệt theo khoảng thời gian, biểu đồ, xuất CSV (mục 48/53). | ✅ |

**Kết luận quy trình 3:** đủ trọn 4 bước, đúng vai (Thư ký làm bước 1-2-4, Chủ trì/Thành viên làm bước 3), đúng tùy chọn "CÓ THỂ ký số" (không ép buộc sai câu chữ).

---

## 3. BẢNG TIÊU CHÍ CHẤT LƯỢNG DỊCH VỤ + NGHIỆM THU (HSMT dòng 54–119)

### 3.1 Nhóm 1 — Tiêu chí chức năng nghiệp vụ (1.1–1.3, dòng 57-60)

| # | Yêu cầu | Đối chiếu | KL | Bằng chứng nghiệm thu |
|---|---|---|---|---|
| 1.1 | "Đáp ứng đầy đủ chức năng nghiệp vụ theo Kế hoạch" | Xem bảng 97 mục ở trên: 94 ✅ + 3 🟡 (14, 20, ký số PKI thật thuộc nhóm ATTT không phải chức năng) | 🟡 (gần trọn vẹn) | Đếm số ✅+🟡+❌ khi kiểm thử/vận hành thử |
| 1.2 | "Đầy đủ yêu cầu mục 3.4, hoạt động ổn định, kết quả chính xác" | Không chỉ "có UI" — đã đối chiếu ĐÚNG CÂU CHỮ (vd mục 30 đủ 4 hành động, mục 48 đủ chọn-thời-gian+biểu-đồ+xuất). Chưa kiểm thử tải/độ ổn định lâu dài (thuộc phạm vi Tech Leader — hiệu năng, ATTT). | ⚙️ (cần chạy vận hành thử/kiểm thử thật để "xác định số lượng chức năng đáp ứng" theo đúng yêu cầu đầu ra cột (4)/(5)) | Báo cáo kết quả vận hành thử (mẫu tại `docs/ho-so/03-kich-ban-kiem-thu-van-hanh-thu.md`) |
| 1.3 | "Phù hợp với nghiệp vụ thực tế" | 3 quy trình nghiệp vụ đối chiếu ở mục 2 trên — đúng thứ tự/vai trò/CSDL cập nhật thật (không giả). Giáo trình đào tạo bám menu THẬT (không mô tả chức năng không tồn tại — tự kiểm trong `08-giao-trinh-dao-tao.md` dòng 12). | ✅ | — |

### 3.2 Nhóm 4 — Tiêu chí phi chức năng khác, phần liên quan nghiệp vụ (Khả năng sử dụng 4.2, dòng 82-89)

| # | Yêu cầu | Đối chiếu | KL |
|---|---|---|---|
| 4.2.1 | "Hệ thống phải cho phép **export dữ liệu** theo quy định" (84) | Xuất CSV có mặt ở: điểm danh (36), ý kiến tài liệu (31), thống kê thành viên (52), thống kê ý kiến văn bản (48/53), OpenAPI spec (58). Danh mục không có export riêng (nhỏ, danh mục ít dòng). KHÔNG có export toàn bộ dữ liệu người dùng/phiên họp dạng "trích xuất toàn bộ" theo yêu cầu HSMT dòng 181 ("Hỗ trợ khai thác dữ liệu và trích xuất dữ liệu theo yêu cầu của cơ quan sử dụng" — mục vận hành, không phải UI cho người dùng cuối) — đây là công việc VẬN HÀNH của nhà cung cấp dịch vụ (có công cụ/script), không bắt buộc phải có nút UI. | ✅ (đủ các điểm export nghiệp vụ theo mục 3.4; phần "khai thác dữ liệu theo yêu cầu" là cam kết vận hành, không phải gap chức năng) |
| 4.2.2 | Ngăn chặn lỗi cơ bản người dùng | `validatePatch()` (`guard.js`) kiểm kiểu dữ liệu 400 khi sai; UI có validate required field + disable nút khi thiếu (vd nút "Từ chối" disable khi chưa nhập lý do, mục 24). | ✅ |
| 4.2.3/4.2.4 | Đa dạng truy cập; dễ học dễ dùng + HDSD đầy đủ | HDSD tích hợp trong hệ thống (`GuidesAdminPage`/mục 4) + `docs/ho-so/11-tai-lieu-hdsd-tong-quan.md` (166 dòng) + giáo trình đào tạo. | ✅ |

### 3.3 Nhóm 5 — Sự hài lòng người sử dụng (5.1–5.4, dòng 106-111)

| # | Yêu cầu | Đối chiếu | KL |
|---|---|---|---|
| 5.2 | "Phương thức ghi nhận ý kiến và nội dung ý kiến người dùng" | `Feedback` entity (`types.ts:498-517`) + `SupportPage.tsx` (người dùng gửi phản hồi: bug/feature/question/other) + `SupportAdminPage.tsx` (xử lý, trả lời, đổi trạng thái new/processing/resolved). Kênh hotline/email hiển thị dạng thông tin tĩnh (đúng, không phải entity). | ✅ |
| 5.1/5.3/5.4 | Kịp thời, hỗ trợ, thái độ phục vụ | Đây là chỉ số VẬN HÀNH đo bằng khảo sát thực tế (HSMT tự ghi "chưa có Yêu cầu đầu ra giai đoạn chuẩn bị", chỉ đo trong giai đoạn thuê) — không phải chức năng phần mềm, không đánh giá qua code. | ⚙️ (đo bằng khảo sát vận hành thật, không phải gap code) |

### 3.4 Nhóm 6 — Quản lý dịch vụ (6.1–6.6, dòng 112-119) — đối chiếu với hồ sơ bàn giao

| # | Yêu cầu | Tài liệu đáp ứng | KL |
|---|---|---|---|
| 6.1 | Ban hành quy trình quản lý dịch vụ, thống nhất trước khi triển khai | `docs/ho-so/04-quy-trinh-quan-tri-van-hanh.md`, `05-quy-trinh-bao-tri.md` | ✅ (soạn đầy đủ) 🏛️ (chờ thống nhất với Sở + ký) |
| 6.3 | Báo cáo dịch vụ định kỳ/đột xuất | `docs/ho-so/02-cam-ket-sla.md` kèm mẫu báo cáo | ✅ 🏛️ |
| 6.5 | Hồ sơ quản lý thay đổi | Chưa thấy mẫu "hồ sơ quản lý thay đổi" (change log) riêng trong `docs/ho-so/` — có `AuditLogPage.tsx` (nhật ký hệ thống, khác bản chất "hồ sơ thay đổi DỊCH VỤ" ở cấp hợp đồng/quy trình, không phải nhật ký kỹ thuật). | 🟡 (thiếu mẫu hồ sơ quản lý thay đổi CẤP DỊCH VỤ — khác nhật ký hệ thống đã có) |
| 6.6 | Ghi nhận thông tin phiên bản hệ thống | Không thấy trang "Lịch sử phiên bản"/changelog hiển thị trong UI cho người quản trị xem. Có README/git log nội bộ (không phải giao diện nghiệp vụ). | 🟡 (thiếu UI/tài liệu "quản lý phiên bản" hướng tới người dùng cuối/Sở — hiện chỉ có ở mức git log nội bộ đội phát triển) |

---

## 4. ĐÀO TẠO — ĐỐI CHIẾU CÂU CHỮ HSMT (dòng 122-144)

| Yêu cầu HSMT (trích) | Đối chiếu | KL |
|---|---|---|
| a) Đào tạo Cán bộ quản trị: nội dung (cài đặt/cấu hình, giám sát/xử lý sự cố, chức năng quản trị/báo cáo/phân quyền); 01 ngày, 01 lớp, ~10 học viên; trực tiếp | `docs/ho-so/08-giao-trinh-dao-tao.md` phần A — khung giờ CẢ NGÀY (08:00-17:30), đủ 3 nội dung, bám ĐÚNG menu thật (Quản trị hệ thống > Đơn vị/Người dùng/Nhật ký; Quản trị danh mục; Phòng họp+sơ đồ; HDSD; API&Tích hợp; Báo cáo thống kê). | ✅ |
| b) Đào tạo Cán bộ sử dụng: nội dung (nhập liệu/theo dõi/báo cáo/truy xuất; tạo-sửa-xóa-tìm-xuất báo cáo); 01 buổi, 01 lớp; trực tiếp+trực tuyến | Phần B — khung giờ 1 BUỔI (08:00-12:00, 3h50), đủ nội dung tra cứu lịch, chuẩn bị họp, tài liệu cá nhân, tham gia phiên họp trực tiếp, lấy ý kiến văn bản, kết luận/nhiệm vụ, HDSD, kiểm tra thực hành cuối buổi. | ✅ |
| c) Yêu cầu chung: đủ tài liệu HDSD/quản trị; ≥1 giảng viên+1 trợ giảng/lớp; chi phí trong giá thuê; địa điểm do Sở bố trí/thống nhất | Phần C ghi rõ cả 4 điểm, dẫn đúng số dòng HSMT tương ứng. Phần D: danh mục 6 loại tài liệu phát kèm (HDSD quản trị+người dùng, slide, tài khoản demo, phiếu khảo sát, đầu mối hỗ trợ). Phần E: mẫu "Kế hoạch tổ chức đào tạo" để điền cùng Sở. | ✅ (soạn đầy đủ) 🏛️ (chờ chốt lịch/địa điểm thật với Sở + ký đại diện nhà thầu) |

**Không có mục nào bị thiếu trong yêu cầu đào tạo** — đây là 1 trong các phần đáp ứng TỐT NHẤT toàn bộ HSMT vì có tài liệu chuyên biệt, bám sát menu thật, không mô tả tính năng ảo.

---

## 5. TÀI LIỆU BÀN GIAO (HDSD, quản trị, kỹ thuật) — 12 tài liệu `docs/ho-so/`

Đã đối chiếu `docs/ho-so/00-muc-luc.md` (bảng ánh xạ yêu cầu HSMT → tài liệu → trạng thái, đầy đủ 12 mục 00-11) với chính nội dung `docs/hsmt-chuong-v.md`. Không phát hiện yêu cầu nào của HSMT về "tài liệu phải nộp/cam kết" mà KHÔNG có file tương ứng trong `docs/ho-so/`. Trạng thái chung: **"Soạn đầy đủ, chờ pháp nhân ký"** cho các văn bản cam kết (01, 02, 06, 09) — đây là 🏛️ đúng nghĩa (không phải gap kỹ thuật, chỉ chờ ký/đóng dấu khi có pháp nhân thật ký hợp đồng).

**Điểm cần lưu ý (không phải gap, nhưng dễ gây hiểu lầm khi nghiệm thu):** tài liệu 11 (`11-tai-lieu-hdsd-tong-quan.md`) tự ghi "khung mục lục, nội dung chi tiết từng chương do module HDSD trong ứng dụng cung cấp" — nghĩa là HDSD ĐẦY ĐỦ thật sự phụ thuộc vào việc admin đã soạn nội dung trong `GuidesAdminPage` (mục 4) hay chưa — đây là ⚙️ CẦN DỮ LIỆU chứ không phải thiếu tính năng.

---

## 6. THỂ THỨC VĂN BẢN NĐ 30/2020

| Yếu tố thể thức | Biên bản HỌP mới sinh (`buildMinutesDraft`) | Văn bản tổng hợp LẤY Ý KIẾN (mục 47) |
|---|---|---|
| Quốc hiệu, tiêu ngữ | ✅ (`meetingService.ts` dòng ~483-485: `'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'`+`'Độc lập - Tự do - Hạnh phúc'`) | Không áp dụng — HSMT dòng 374 chỉ nói "Thư ký tổng hợp, thống kê ý kiến", KHÔNG yêu cầu đây phải là văn bản hành chính thể thức NĐ 30 |
| Tên cơ quan, số/ký hiệu văn bản, địa danh/ngày | ✅ — `orgName` tra theo đơn vị chủ tọa; `ensureMinutesNumber`/`nextMinutesNumber` cấp số tự tăng theo năm, không trùng | — |
| Nội dung mục I-V | ✅ đầy đủ (thành phần/chương trình/diễn biến/biểu quyết/kết luận) | UI hiện tổng hợp qua bảng/biểu đồ (mục 47/48), đúng nghĩa "tổng hợp/thống kê" theo câu chữ, không cần dạng văn bản in |
| Khối chữ ký + Nơi nhận | ✅ 2 cột THƯ KÝ/CHỦ TỌA đúng vị trí; "Nơi nhận"+"Lưu: VT, {ký hiệu}" | — |

**Kết luận:** thể thức NĐ 30/2020 ĐÃ ĐÚNG và ĐỦ cho biên bản HỌP (đối tượng duy nhất HSMT thực sự yêu cầu thể thức hành chính). Không nhầm lẫn đây với "tổng hợp ý kiến văn bản" (khác đối tượng, khác yêu cầu câu chữ) — 2 báo cáo cũ (`chot-code-ba.md` mục 6) chỉ soát phần biên bản họp, đúng phạm vi, không sai.

---

## 7. 💣 BOM NỔ CHẬM

Định nghĩa theo yêu cầu: mục nào báo cáo cũ nói ổn nhưng thực tế khác, HOẶC chỉ lộ ra khi tổ chấm thao tác thật, HOẶC dễ bị hiểu sai/tự tin quá mức khi trình bày.

### 💣#1 — Chênh lệch thời điểm giữa 2 báo cáo cũ và code hiện tại (rủi ro "báo cáo sai vì cũ", KHÔNG phải code sai)

Ma trận `ba-compliance-matrix.md` (07-17) đánh **8/2/48/53/51 = ❌/🟡** và mô tả "unit_admin chưa sửa/xóa được phiên mình tạo, upload tài liệu chưa giới hạn theo đơn vị". Đọc code HIỆN TẠI (`authService.ts` dòng 64-93, `guard.js`, `Guard.cs`) xác nhận **TẤT CẢ ĐÃ VÁ** — kể cả điểm mà `chot-code-ba.md` (07-18) chính nó còn ghi "⚠️ KHUYẾN NGHỊ" (mục 2, dòng 33-37: "chưa giới hạn nút Thêm-tài-liệu theo đơn vị chủ trì") đã được vá SAU đó (comment code tự ghi "Khuyến nghị 1, 2026-07-18, chốt code chéo").

**Vì sao đây là bom nổ chậm:** nếu ai đó (kể cả tổ chấm nội bộ HPT TECH) chỉ đọc lại 1 trong 2 báo cáo cũ mà KHÔNG re-verify code, họ sẽ **đưa ra số liệu quá thấp** (57/59 hoặc thấp hơn) hoặc liệt kê gap KHÔNG CÒN TỒN TẠI khi trình bày với Sở KH&CN — gây mất uy tín ngược ("nói có gap mà tổ chấm thử lại thấy không có gap" — cũng nguy hiểm như "nói không có gap mà có gap"). Ngược lại, nếu bản DEPLOY PUBLIC (`ecabinet.vhpdata.com`) chưa build/deploy đúng NGAY working tree hiện tại (có 19 commit local đang sau origin/main + nhiều file uncommitted), tổ chấm thao tác trên web live **có thể KHÔNG thấy** các tính năng tôi vừa xác nhận có trong code (mục 8, 13, 21, 30-ký ý kiến, 48/53, 51, unit_admin sửa/xóa phiên) — đây chính là mẫu hình đúng như vụ "bom nổ chậm" gốc mà chủ dự án nhắc (chỉ lộ khi chạy thử THẬT, không phải khi đọc code). **Khuyến nghị bắt buộc trước khi demo:** xác nhận bản deploy = đúng commit/working tree tôi vừa đọc (yêu cầu Tech Leader/DevOps xác nhận, ngoài phạm vi tôi).

### 💣#2 — Mục 20 "Thêm mới, cập nhật, xóa thông tin người tham gia họp" — không có action riêng

Không giống các mục CRUD khác (1, 6, 7, 8, 10 đều có nút Thêm/Sửa/Xóa RÕ trên đúng trang quản lý mục đó), mục 20 chỉ có **XEM** trên tab "Người tham gia" (`PeopleTab`). Muốn "thêm/xóa 1 người tham gia" phải rời khỏi tab đó, mở lại toàn bộ form "Sửa phiên họp", đổi lại DANH SÁCH ĐẦY ĐỦ thành viên, rồi Lưu. **Dễ bị tổ chấm bắt vì:** khi họ đọc đúng câu chữ HSMT liệt kê 3 hành động con TRÊN CHÍNH MÀN "Quản lý người tham gia họp", họ có thể bấm thẳng vào tab đó tìm nút Thêm/Xóa — và sẽ KHÔNG THẤY, dù nghiệp vụ tổng thể (qua đường vòng form sửa) vẫn đạt được kết quả tương đương. Đây khác gap "thiếu hoàn toàn" — là gap "đúng nơi, sai UX-mapping với câu chữ HSMT".

### 💣#3 — Ký số mục 30: mô phỏng ĐỦ hành động nhưng dễ bị đọc nhầm là "vẫn thiếu" nếu không phân biệt 2 câu hỏi khác nhau

Có 2 câu hỏi HOÀN TOÀN KHÁC bị 2 báo cáo cũ và cả README/HANDOVER trộn lẫn khi diễn đạt:
- **(a)** "Có đủ 4 hành động: Cho ý kiến / Ký số / Gửi / Xem DS đã cho ý kiến, đúng câu chữ mục 3.4 mục 30 không?" → **CÓ, đủ 4/4** (đã kiểm chứng bằng code ở mục 1 bảng trên).
- **(b)** "Chữ ký số đó có phải chữ ký số HỢP PHÁP theo Luật Giao dịch điện tử (CA/PKI/USB-token thật) không?" → **KHÔNG, vẫn mô phỏng** (serial `VN-DEMO-CA:...` tự sinh, PIN chỉ regex 6 số).

Đọc lại TOÀN VĂN HSMT (grep "ký số"/"CA"/"PKI"/"chứng thư" toàn file 668 dòng): **HSMT KHÔNG có bất kỳ dòng nào yêu cầu chữ ký số phải là CA/PKI hợp pháp** ở mục 3.4 — chỉ nói chung "ký số" như 1 chức năng phần mềm. Việc đòi CA thật là suy diễn TỐT (đúng tinh thần pháp lý cho môi trường chính quyền) nhưng **KHÔNG phải câu hỏi (1) "có chức năng theo câu chữ hay không"**. Nếu báo cáo tiếp tục đánh mục 30 là "🟡/❌ vì chưa có CA thật", đây SAI theo đúng NGHĨA "chấm điểm 3.4 theo mục 3.4" — dễ khiến đội tự đánh tụt điểm oan MỘT chức năng mục 3.4 đã đủ, đồng thời làm LOÃNG rủi ro pháp lý thật (thiếu CA) — nên phải TÁCH RÕ 2 câu hỏi này khi trình bày với tổ chấm, đừng gộp chung 1 dòng "🟡 vì thiếu ký số".

### 💣#4 — Danh mục "chưa lấy ý kiến" (mục 13) và "loại tài liệu CRUD" (mục 8): gap có TÊN RIÊNG trong HSMT, dễ bị tổ chấm chấm điểm CHI TIẾT vào 2 mục này VÌ chúng có câu chữ tường minh nhất

Cả 2 mục đều đã VÁ (xác nhận ✅ ở trên) nhưng đây là 2 mục **CÓ TÊN CHÍNH XÁC, DỄ TRA CỨU NHẤT** trong toàn bảng 97 mục (mục 8 chỉ 1 dòng ngắn "sửa/thêm/xóa loại tài liệu", mục 13 độc lập rõ với 11/12). Nếu tổ chấm dùng đúng checklist đối chiếu câu-chữ-1-đối-1 (cách làm phổ biến của tổ thẩm định), đây là 2 mục HỌ SẼ THỬ ĐẦU TIÊN vì dễ verify nhất (bấm 1-2 lần là thấy có/không). **Khuyến nghị:** trước khi demo, tự bấm thử LẠI đúng 2 luồng này trên bản DEPLOY THẬT (không chỉ code) để chắc chắn không lệch — đây chính là hành động "chạy thử" mà chủ dự án nhắc tới, KHÔNG được chỉ tin đọc code.

### 💣#5 — Mục 6.5/6.6 (hồ sơ quản lý thay đổi, quản lý phiên bản) — thiếu tài liệu/UI, dễ bị bỏ qua vì nằm trong bảng tiêu chí (ít người đọc kỹ) không phải bảng 97 mục (được đọc kỹ nhiều lần)

Cả 2 báo cáo cũ (07-17, 07-18) đều TẬP TRUNG HOÀN TOÀN vào bảng 97 mục 3.4 — không báo cáo nào (kể cả ma trận `ba-compliance-matrix.md` rất chi tiết) đề cập đến bảng tiêu chí chất lượng dịch vụ (dòng 54-119) mục 6.5/6.6. Đây là dạng "mù điểm tập thể" — nhiều đợt rà soát cùng bỏ sót cùng 1 khu vực vì ai cũng tưởng "phần đó dành cho hạ tầng/quy trình, không phải chức năng phần mềm" — nhưng câu chữ "hồ sơ quản lý thay đổi", "thông tin phiên bản hệ thống PHẢI ĐƯỢC GHI NHẬN" hàm ý cần MỘT NƠI (tài liệu hoặc UI) để chủ đầu tư tra cứu, hiện chưa có nơi nào lộ ra cho Sở xem (chỉ có git log nội bộ đội dev). Rủi ro thấp hơn 4 mục trên (không phải chức năng 3.4 lõi) nhưng **là đúng dạng "lộ ra khi tổ chấm hỏi thẳng 'cho tôi xem hồ sơ thay đổi phiên bản của các anh'"** — không có gì để đưa ra ngay.

---

## 8. CON SỐ CHÍNH XÁC ?/59 (NHÓM A — WEB, mục 1–59) SAU KHI TỰ ĐỐI CHIẾU

| Trạng thái | Số mục | Danh sách |
|---|---|---|
| ✅ Đầy đủ | **57** | 1,2,3,4,5,6,7,8,9,10,11,12,13,15,16,17,18,19,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59 |
| 🟡 Một phần | **2** | 14 (thiếu nút "Xóa thư mục" trực tiếp — hành vi tương đương có), 20 (thiếu action riêng thêm/xóa 1 người tham gia trên đúng tab, phải qua form sửa toàn bộ phiên) |
| ❌ Chưa có | **0** | — |

**CON SỐ CHỐT: 57/59 ✅ trọn vẹn theo đúng câu chữ · 2/59 🟡 (14, 20) · 0/59 ❌.**

### Giải thích chênh lệch với con số đang ghi (58/59 ở `docs/HANDOVER.md`)

HANDOVER hiện ghi **"web 58/59 — còn duy nhất ký số PKI thật (mục 30)"**. Sau khi tự đối chiếu:

1. **Mục 30 KHÔNG nên bị trừ** ở phép đếm "theo đúng câu chữ mục 3.4" — đã có đủ 4/4 hành động con (xem 💣#3). Việc PKI/CA thật là rủi ro pháp lý riêng (thuộc nhóm 3 "An toàn thông tin mạng, an toàn dữ liệu" — dòng 64-77 HSMT, không phải mục 3.4 chức năng), **KHÔNG nên gộp vào phép đếm 97-mục-3.4**. → mục 30 = ✅ trong bảng 97 mục.
2. Nhưng phát hiện **2 mục KHÁC** (14, 20) mà cả 2 báo cáo cũ KHÔNG nêu (`ba-compliance-matrix.md` từng đánh 14 = ✅ hoàn toàn, đánh 20 = ✅ hoàn toàn — tôi soi lại kỹ hơn theo đúng câu chữ "action riêng trên đúng tab" và phát hiện đây là 🟡 chứ không phải ✅ trọn vẹn).
3. Kết quả: **57/59** (không phải 58/59 hay 59/59) — chênh lệch **-1** so với con số đang ghi, nhưng vì LÝ DO KHÁC với lý do HANDOVER đang nêu (HANDOVER trừ vì mục 30-ký-số; tôi cộng lại mục 30 nhưng trừ mục 14+20, net kết quả gần bằng nhau về SỐ nhưng KHÁC HẲN về DANH SÁCH mục nào là 🟡). **Đây chính là kiểu sai số "58/59 thực ra 57" mà chủ dự án cảnh báo trong đề bài — con số tổng gần đúng NHƯNG DANH SÁCH MỤC CỤ THỂ bị sai, và nếu tổ chấm hỏi đúng vào 2 mục thật sự còn 🟡 (14, 20) mà báo cáo cũ không nêu, đội sẽ bị bất ngờ.**

### Nhóm B (Mobile, mục 60-97, 38 mục)

Không đọc lại sâu Capacitor/build native trong lượt này (thuộc hạ tầng — Tech Leader). Về NGHIỆP VỤ (dùng chung 1 UI React responsive qua PWA/Capacitor WebView — đã xác nhận đúng cấu trúc code dùng chung `src/ui/pages/*`, không có UI riêng cho mobile), suy ra trực tiếp từ 57/59 nhóm A: mục mobile tương ứng mục 14/20 web cũng ở mức 🟡 tương tự (dùng chung code). **Y ≈ 36/38** nghiệp vụ có sẵn qua UI dùng chung (giả định responsive đạt — không tự kiểm chứng riêng trong lượt này). Việc build APK/IPA thật là câu hỏi hạ tầng riêng, không thuộc phạm vi phần này.

---

## 9. GHI CHÚ PHƯƠNG PHÁP

- Đã đọc TOÀN VĂN: `docs/hsmt-chuong-v.md` (668 dòng, 2 lượt); `src/domain/types.ts` (544 dòng); `src/services/voteService.ts` (402 dòng), `meetingService.ts` (601 dòng, phần liên quan), `authService.ts` (120 dòng), `documentService.ts` (phần liên quan), `catalogService.ts`; `src/ui/pages/PollsPage.tsx` (440 dòng), `admin/ReportsPage.tsx` (362 dòng), `admin/CatalogsAdminPage.tsx` (117 dòng), `admin/AuditLogPage.tsx` (118 dòng), phần liên quan của `MeetingDetailPage.tsx`, `MeetingsPage.tsx`, `DocumentsPage.tsx`; `docs/ho-so/00-muc-luc.md`, `08-giao-trinh-dao-tao.md` (122 dòng, toàn văn).
- Đã đọc để đối chiếu backend (không đánh giá hạ tầng, chỉ verify hành vi guard/ACL nghiệp vụ): `server/src/guard.js` (đoạn `VALID_CATALOG_TYPES`, whitelist TT 39/2017, `validatePatch`), `server/src/acl.js` toàn văn (86 dòng), `server-dotnet/ECabinet.Api/Guard.cs`/`Acl.cs` (đoạn tương ứng) — để KHÔNG lặp lại lỗi "chỉ tin comment/UI mà không verify server thật chặn 400 hay không" như vụ mục 8 từng gặp.
- Đã chạy `node scripts/build-cdn.mjs` → PASS, xác nhận code hợp lệ cú pháp tại thời điểm rà soát (không chạy HTTP server, đúng ràng buộc).
- **CHƯA đọc sâu trong lượt này** (không thuộc phạm vi ưu tiên cao nhất hoặc thuộc phạm vi Tech Leader): `LiveMeetingPage.tsx` toàn văn, `questionService.ts` toàn văn, `chatService.ts`, `apiKeyService.ts`, `taskService.ts`, `notificationService.ts`, `sim.ts`, `sha256.ts`, `server/src/rtc.js`, `server/src/ws.js`, `server/src/sessions.js`, mã build Capacitor/PWA, các file `docs/ho-so/01-07,09,10` (chỉ đọc mục lục ánh xạ, chưa đọc toàn văn từng file).
- KHÔNG sửa code, KHÔNG commit, KHÔNG chạy HTTP server — đúng ràng buộc.
