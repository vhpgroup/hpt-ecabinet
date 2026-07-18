# BÁO CÁO SỬA LỖI — Phong, Frontend Developer, HPT TECH

**Ngày:** 2026-07-18
**Nguồn:** `dungthu-tester.md` (P0/P1) + `dungthu-ba.md` (mục 4, bảng cải tiến).
**Trạng thái repo:** giữ nguyên 6 file Tech Leader chưa commit (`server/src/guard.js`, `server-dotnet/ECabinet.Api/Guard.cs`, `Program.cs` (Api + Tests), `src/ui/pages/PollsPage.tsx` fix `showSignedCount`, `server/test/smoke.mjs`) — không revert, sửa tiếp trên đó. Không commit/push git.
**Build:** `node scripts/build-cdn.mjs` PASS 6 lần liên tiếp (esbuild transpile-only — không có `tsc`/npm registry trong sandbox để type-check bổ sung; đã tự rà soát type/logic thủ công kỹ, balance braces xác nhận qua script).
**Phạm vi file đã sửa:** `src/services/{authService,documentService,meetingService}.ts`, `src/ui/pages/{CalendarPage,LoginPage,MeetingsPage,MeetingFormModal,MeetingDetailPage,PollsPage,DocumentsPage,shared}.tsx`, `src/ui/pages/admin/{ApiAdminPage,ReportsPage}.tsx`, `website/index.html`.

---

## V1 (P0-1) — unit_admin tạo phiên họp

Backend (`acl.js:32`, `actions.js:186-200`, `index.js enforceMeetingWrite`) đã sẵn cho unit_admin tạo/mời họp trong đơn vị mình — chỉ FE chưa bắt kịp.

- `authService.ts`: thêm `can.createMeeting` (mở cho unit_admin), `can.sendInvitations(actor, chairUnitId)` (mirror `POST /invite`).
- `MeetingsPage.tsx`: nút "Tạo phiên họp" dùng `can.createMeeting`.
- `MeetingFormModal.tsx`: khi unit_admin tạo mới, dropdown Chủ trì/Thư ký lọc chỉ còn người cùng đơn vị (`chairSecCandidates`), có ghi chú UI; giữ nguyên khi SỬA phiên (đúng phạm vi vá P0-2 — chỉ `create`).
- `meetingService.ts`: `saveMeeting` thêm `enforceUnitAdminMeetingCreate` (guard demo, mirror `enforceMeetingWrite`); `sendInvitations` cho unit_admin gửi mời khi chủ trì cùng đơn vị (mirror action `invite`).
- `MeetingDetailPage.tsx`: nút "Gửi giấy mời" tách khỏi `manage`, dùng `canInviteThis`; "Chỉnh sửa"/"Xóa" vẫn chỉ `manage` (không mở rộng). `DocsTab`: nút "Thêm tài liệu vào phiên họp" mở thêm cho `unit_admin` (`canUpload`) — backend `documents.create: 'any'` đã cho phép, chỉ thiếu gate UI. "Trình duyệt" hoạt động tự nhiên vì dựa vào `isOwner`, không phụ thuộc role.

## V2 (P1-1 + BA#2) — thành viên phiên duyệt tài liệu

`shared.tsx DocReviewControls`: thêm prop `meeting?`, tính `isMeetingMember` (chairId/secretaryId/participant khớp `doc.meetingId`), `canApprove = (manage || isMeetingMember) && !isOwner` (chặn tự duyệt — mirror `guardDocuments`/`canReviewDocumentAsMeetingMember` trong `guard.js`). `documentService.ts`: `approveDocument`/`rejectDocument` nhận `meeting?`, dùng `canReviewDocument()` mirror guard đầy đủ. Cập nhật mọi nơi gọi để truyền `meeting`: `DocumentsPage.tsx` (2 chỗ, lookup `meetings.get(d.meetingId)`; `UnitPrepView` dùng `meeting` sẵn có), `MeetingDetailPage.tsx DocsTab` (3 chỗ, `meeting={m}`), và mở "Tài liệu chờ duyệt" trong `DocsTab` cho `manage || isMeetingMember` (trước chỉ `manage`).

## V3 (P1-2) — Phiếu lấy ý kiến KÍN

`PollsPage.tsx`: `PollCreateModal` thêm checkbox "Phiếu kín (ẩn danh người góp ý)" → `secret` (trước hardcode `false`). `PollCard`: badge "Kín" cạnh trạng thái; `canSeeIdentities = !p.secret || isOwner`, hàm `identityFor(b)` redact tên thành "Đại biểu (ẩn danh — phiếu kín)" trừ chính mình/owner/manage — áp cho danh sách "Tổng hợp ý kiến góp ý" (client tự redact ở demo mode, mirror `access.js projectVote` đã strip ở REST mode). Giữ nguyên `showSignedCount`/`signedCount` của Tech Leader không đổi.

## V4 (P1-3) — Khóa biên bản sau ký số

Phát hiện: điều kiện ẩn nút cũ chỉ dựa vào `m.minutes.locked` (đủ CẢ 2 chữ ký chủ trì+thư ký) — nếu mới có **1** chữ ký, "Tạo lại dự thảo"/"Lưu biên bản" vẫn bấm được, ghi đè nội dung trong khi chữ ký cũ (gắn nội dung trước) vẫn còn trên bản ghi → đúng lỗ hổng tester nêu. Sửa: `MeetingDetailPage.tsx MinutesTab` dùng `hasAnySignature = signatures.length > 0` thay `locked` để ẩn nút + `readOnly` textarea + hiện ghi chú "Biên bản đã ký số — không thể chỉnh sửa". `meetingService.saveMinutes` (dùng chung cho Lưu + Tạo lại dự thảo) đổi điều kiện throw từ `locked` sang `signatures.length > 0`.

## V5 (P1-4) — Điều tra lệch ngày/giờ

**Kết luận: KHÔNG phải bug xử lý ngày giờ.** `format.ts toLocalInput`/`fromLocalInput` dùng đúng getter/setter LOCAL (đã test roundtrip `2026-07-25T09:00` → ISO `02:00Z` → hiển thị lại đúng `09:00`, TZ sandbox = `Asia/Saigon` khớp thực tế VN). Tìm được bằng chứng dứt điểm: giá trị hệ thống lưu ("08:00 18/07/2026") khớp **CHÍNH XÁC** công thức mặc định `MeetingFormModal.tsx:26` (`Date.now()+24h, setHours(8,0)`) tính từ lúc tester test (17/07); tương tự "24/07" khớp default `TaskCreateModal` (`Date.now()+7 ngày, setHours(17,0)`). Nghĩa là React state KHÔNG được cập nhật khi automation điền field — form submit giá trị MẶC ĐỊNH ban đầu, không phải giá trị hiển thị trên input. Đã KHÔNG sửa mù logic ngày giờ (vốn đúng). Thêm lưới an toàn nhẹ: `MeetingFormModal.save()` parse an toàn (`isNaN` check) + `window.confirm` nếu bắt đầu ở quá khứ (chỉ khi tạo mới); `TaskCreateModal.submit()` tương tự cho hạn xử lý.

## V6 (P1-5) — Dropdown ủy quyền

`MeetingDetailPage.tsx DelegateModal`: thêm prop `meetingParticipantIds: Set<string>`, chia `<optgroup>` "Thành phần phiên họp" (đầu) / "Ngoài thành phần phiên họp" (sau, vẫn chọn được). Chính mình đã loại từ trước (`s.users.filter(u.id !== user?.id)` tại nơi gọi, không đổi).

## V7 (BA#1) — Website hết "Hải Phòng"

`website/index.html` dòng 7 (meta description), 1039 (footer đoạn văn), 1063 (footer "Gói thầu") — trung lập hóa thành "cơ quan chính quyền các cấp" / placeholder `[Tên cơ quan chính quyền/Chủ đầu tư]` (nhất quán style với các placeholder có sẵn trong file). Grep xác nhận không còn "Hải Phòng" trong file.

## V8 (BA#3) — Confirm hành động không hoàn tác

`PollsPage.tsx`: nút "Kết thúc" → đổi nhãn "Kết thúc lấy ý kiến" + `window.confirm` nêu tên phiếu. `MeetingDetailPage.tsx:~654` "Đóng biểu quyết" → thêm `window.confirm` tương tự.

## V9 (BA#4+#5) — Thuật ngữ

"cuộc họp"→"phiên họp": `CalendarPage.tsx` (2 chuỗi liền kề dòng 105+107 — đổi cả 2 để nhất quán nội bộ, không chỉ dòng 107), `LoginPage.tsx:152`, `ApiAdminPage.tsx:33,319`. "xin ý kiến"→"lấy ý kiến" trong `ReportsPage.tsx` (9 chuỗi JSX: dòng 22, 254, 278, 285, 286, 293, 309, 315, 316) — giữ nguyên 2 comment code (dòng 5, 220) theo đúng yêu cầu, không đổi tên hàm/biến/route.

## V10 (BA#7) — PollSignModal nhắc lại lựa chọn

`PollsPage.tsx PollSignModal` thêm props `optionLabel`/`comment`, hiển thị khung "Bạn đang ký ý kiến: **{phương án}**" + góp ý kèm theo (nếu có) trước ô PIN, cùng câu nhắc "không thể sửa/hủy".

## Việc bỏ dở

Không có — toàn bộ V1–V10 đã hoàn thành trong thời gian cho phép.

## Kiểm chứng

`git status --short` chỉ gồm: các file trong phạm vi cho phép (`src/`, `website/index.html`) + 6 file Tech Leader còn nguyên (diff stat không đổi so với đầu phiên) + các file "M"/"??" pre-existing từ trước (README, deploy/, docs/, server*, src/data,domain,App.tsx,store,MainLayout — không liên quan V1-V10, không bị tôi chạm). Không commit/push.
