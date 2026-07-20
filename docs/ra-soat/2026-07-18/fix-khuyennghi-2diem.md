# Báo cáo triển khai 2 khuyến nghị (rà chéo 2026-07-18)

Người thực hiện: Bách — Full-stack Developer
Nguồn khuyến nghị: `docs/ra-soat/2026-07-18/chot-code-ba.md` (mục "Quản trị đơn vị tạo phiên họp",
điểm (iii)/(iv), dòng 33-37, 122) + `docs/ra-soat/2026-07-18/chot-code-techleader.md` (mục 4
"Phiếu kín", dòng 78-88, 143).
Ràng buộc môi trường: không commit/push git; build bằng `node scripts/build-cdn.mjs` (không
`npm install`); `.NET` build/test qua `dotnet` (PATH đã export `$HOME/.dotnet`); không chạy HTTP
server thật (test qua hàm thuần Node + `TestHost` in-memory .NET).

---

## KHUYẾN NGHỊ 1 — unit_admin tự SỬA/XÓA phiên vừa tạo + giới hạn thêm tài liệu theo đơn vị

### Thiết kế chốt

"Đơn vị của phiên" tiếp tục suy từ đơn vị của **chủ trì HOẶC thư ký** (Meeting không có field
`unitId` riêng) — tái dùng đúng khái niệm đã có ở `meetingInvolvesUnit` (open.js/access.js),
nhưng đơn giản hơn (chỉ cần chair/secretary, không quét toàn bộ participants) vì đã khớp với
cách FE hiện có (`can.sendInvitations`, filter "đơn vị chủ trì" ở MeetingsPage.tsx) coi "đơn vị
phiên" = "đơn vị chủ trì" (fallback thư ký nếu chủ trì không xác định được đơn vị).

Triết lý ACL lỏng + enforce chặt được **giữ nguyên nhất quán** với các đợt vá trước (P0-2 tạo
phiên, P1-6 feedbacks): ACL cấp collection chỉ chặn vai trò hoàn toàn ngoài phạm vi (`delegate`);
ràng buộc "cùng đơn vị"/"chưa diễn ra" siết sâu ở hàm `enforce*` riêng, đọc `unitId` từ
DB/store — **không tin JWT/body**.

### File/dòng sửa

**Node REST (`server/src/`)**
| File | Thay đổi |
|---|---|
| `acl.js:32` | `meetings.remove` thêm `'unit_admin'` (trước chỉ `MANAGE`); `update` giữ `'any'` |
| `index.js` (hàm `enforceMeetingWrite`, ~131-215) | Mở rộng từ chỉ `op==='create'` sang `'create'\|'update'\|'delete'`. Thêm hàm `unitOfMeeting(m)` (tra unit chair/secretary). `update`: đơn vị phiên hiện tại phải khớp `myUnit`; nếu body đổi `chairId`/`secretaryId`, người MỚI cũng phải cùng đơn vị. `delete`: đơn vị khớp + `status ∈ {draft, invited}` (`NOT_STARTED_STATUSES`) |
| `index.js` (route `PATCH /api/:collection/:id`, ~498-527) | Gọi `enforceMeetingWrite(req,'update',existing,patch)`; tính `extra = {actorUnitId, meetingUnitId}` cho `meetings` truyền vào `guardPatch` |
| `index.js` (route `DELETE /api/:collection/:id`, ~567-572) | Gọi `enforceMeetingWrite(req,'delete',existing,null)` trước khi xóa |
| `index.js` (hàm mới `enforceDocumentWrite`, ~207-230) | unit_admin tạo document có `meetingId` → tra đơn vị phiên đó, so với `myUnit` |
| `index.js` (route `POST /api/:collection` cho `documents`, ~452-456) | Gọi `enforceDocumentWrite(req,'create',body)` |
| `guard.js` (hàm `guardMeetings`, ~449-540) | Nhận thêm `extra`; thêm `isUnitAdminOfThisMeeting(existing,user,extra)` — unit_admin cùng đơn vị phiên được coi **như MANAGE** cho field nội dung (participants dùng `keepServerCheckins`, giữ mọi field còn lại sau lọc) — **NHƯNG KHÔNG** gộp vào 3 nhánh `!isManage` riêng (`questionSession`/`seatAssignments`/`currentItemStartedAt` — hành vi điều hành trực tiếp tại phòng họp, chủ ý giữ CHỈ MANAGE). Khóa cứng `minutes` khi ≥1 chữ ký **áp dụng bất kể** `isUnitAdminHere` |
| `guard.js` (`guardPatch`, ~253-260) | Truyền `extra` vào `guardMeetings` |

**`.NET` REST (`server-dotnet/ECabinet.Api/`)** — port 1:1
| File | Thay đổi |
|---|---|
| `Acl.cs:36` | `meetings` Remove rule đổi từ `M` (chỉ MANAGE) sang `"roles:admin,secretary,chairman,unit_admin"` |
| `App.cs` (`EnforceMeetingWrite`, ~530-598 sau sửa) | Port 1:1 logic Node; thêm `UnitOfMeeting`, `NotStartedStatuses` |
| `App.cs` (`EnforceDocumentWrite`, mới) | Port `enforceDocumentWrite` |
| `App.cs` (route PATCH/POST/DELETE) | Gọi enforce tương ứng; tính `actorUnitId`/`meetingUnitId` truyền `Guard.GuardPatch` |
| `Guard.cs` (`GuardMeetings`, `IsUnitAdminOfThisMeeting`) | Port 1:1; thêm 2 tham số `actorUnitId`/`meetingUnitId` vào `GuardPatch`/`GuardMeetings` |

**Demo mode (`src/services/`)**
| File | Thay đổi |
|---|---|
| `meetingService.ts` | `enforceUnitAdminMeetingCreate` → mở rộng thành `enforceUnitAdminMeetingWrite(actor, op, draft, existing)` hỗ trợ `create\|update\|delete`; thêm `unitOfMeeting()` (EXPORT để `documentService.ts` tái dùng); `NOT_STARTED_STATUSES`. `saveMeeting`/`deleteMeeting` gọi enforce đúng op |
| `documentService.ts` | Hàm mới `enforceUnitAdminDocumentWrite(actor, meetingId)`; gọi trong `addTextDocument`/`addFileDocument` |
| `authService.ts` (`can.*`) | Thêm `editMeeting`, `deleteMeeting(actor, chairUnitId, status)`, `uploadMeetingDoc` — helper thuần cho FE gate |

**FE gate**
| File | Thay đổi |
|---|---|
| `MeetingDetailPage.tsx` | Thêm `canEditThis`/`canDeleteThis`/`canDeleteInvited`; nút Sửa hiện cho unit_admin cùng đơn vị ở CẢ `draft`+`invited`; nút Xóa hiện thêm ở `invited` **CHỈ cho unit_admin** (tách biến `canDeleteInvited` riêng để **KHÔNG** vô tình mở rộng UI Xóa-ở-invited cho MANAGE — giữ đúng UI cũ cho admin/MANAGE). `DocsTab.canUpload` đổi từ "mọi unit_admin" sang `can.uploadMeetingDoc(user, chairUnitId)` |
| `MeetingFormModal.tsx` | `isUnitAdminCreating` → `isUnitAdminActing` (bỏ điều kiện `!initial` — áp cho cả sửa); dropdown chair/secretary lọc theo đơn vị áp dụng cả khi sửa |
| `MeetingsPage.tsx` | Không đổi (không có nút Sửa/Xóa ở danh sách, chỉ nút Tạo — đã đúng từ trước) |

### Ràng buộc quyền cuối cùng

- **SỬA**: unit_admin PATCH field nội dung (title/description/thời gian/phòng/chair/secretary/
  participants/agenda/meetingType...) khi đơn vị phiên HIỆN TẠI === đơn vị mình; đổi chair/
  secretary sang người ĐƠN VỊ KHÁC → 403 (chặn "chuyển" phiên). Field khóa cứng giữ nguyên
  100% (status, checkedInAt server-ghi, minutes bất biến từ ≥1 chữ ký, questionSession/
  seatAssignments/currentItemStartedAt chỉ MANAGE).
- **XÓA**: unit_admin xóa phiên đơn vị mình khi `status ∈ {draft, invited}`; `live`/`finished`/
  `cancelled` → 403. admin/MANAGE giữ nguyên xóa mọi trạng thái (không hồi quy).
- **Tài liệu**: unit_admin tạo document có `meetingId` → phải cùng đơn vị phiên đó; document
  KHÔNG gắn phiên (tham khảo/cá nhân) không bị ràng buộc. delegate/MANAGE không đổi hành vi.

### Parity demo/Node/.NET

3 lớp code khớp 1:1 về ngữ nghĩa (đã đối chiếu tay từng nhánh + xác nhận qua test): cùng điều
kiện "cùng đơn vị", cùng danh sách `NOT_STARTED_STATUSES`, cùng cách tra `unitOfMeeting`, cùng
cách unit_admin-cùng-đơn-vị được coi như MANAGE ở `guardMeetings` nhưng KHÔNG mở 3 field điều
hành trực tiếp phòng họp.

### Số ca test PASS

- `node scripts/build-cdn.mjs` → PASS (build + đồng bộ `server/src/seed.mjs`).
- `node server/test/smoke.mjs` → **92/92 PASS, 0 FAIL** (82 ca cũ giữ nguyên PASS + 10 ca mới
  nhóm `10-UNIT-ADMIN-MEETING-WRITE`: `ACL.meetings.remove` unit_admin/delegate/MANAGE,
  `guardMeetings` với `extra.actorUnitId/meetingUnitId` — cùng đơn vị (coi như MANAGE), khác
  đơn vị (lọc như đại biểu), thiếu ngữ cảnh (an toàn mặc định), field điều hành trực tiếp vẫn
  chặn, khóa cứng minutes vẫn áp, participants dùng `keepServerCheckins`).
- `dotnet run --project server-dotnet/ECabinet.Tests` → **143/143 PASS, 0 FAIL** (129 ca cũ giữ
  nguyên PASS + 14 ca mới trong nhóm `8-MULTITENANT`, HTTP-level qua `TestHost`: sửa phiên đơn
  vị mình OK; sửa phiên đơn vị khác 403; đổi chairId/secretaryId sang đơn vị khác 403; đổi
  chairId sang người CÙNG đơn vị OK (không chặn nhầm); xóa phiên `finished`/`live` 403 (kèm
  double-check GET vẫn tồn tại); xóa phiên đơn vị khác dù đúng trạng thái vẫn 403; xóa phiên
  `invited` đơn vị mình OK (kèm double-check GET 404 sau xóa); admin/MANAGE vẫn xóa được mọi
  trạng thái (không hồi quy); delegate thường không bị enforce mới ảnh hưởng; thêm tài liệu
  phiên đơn vị khác 403; thêm tài liệu không gắn phiên OK; delegate thêm tài liệu bất kỳ đơn vị
  vẫn OK (không hồi quy)).

Không có ca test cũ nào cần sửa do đổi ngữ nghĩa — mọi mở rộng đều **cộng thêm** quyền cho
unit_admin trong phạm vi hẹp, không thu hẹp quyền MANAGE/delegate hiện có.

### Rủi ro còn lại

1. FE `unitOfMeeting`/enforce ở demo mode KHÔNG phải phòng thủ bảo mật thật (client tự tin
   `actor.unitId` từ bản ghi User đăng nhập trong localStorage) — đúng bản chất demo, chỉ đảm
   bảo ĐÚNG NGHIỆP VỤ khi thao tác qua UI chính thức, không chống được người dùng tự sửa
   localStorage trực tiếp (rủi ro này tồn tại sẵn ở TOÀN BỘ demo mode, không riêng đợt vá này).
2. Nút Xóa ở trạng thái `invited` mới CHỈ mở cho unit_admin (biến `canDeleteInvited` tách riêng
   khỏi `canDeleteThis`) — nếu tương lai muốn mở luôn cho MANAGE ở UI (backend đã cho phép từ
   trước), cần chủ động thêm, không tự động theo `can.deleteMeeting()`.
3. `unitOfMeeting` ở cả 3 lớp code ưu tiên đơn vị CHỦ TRÌ, fallback THƯ KÝ — trường hợp hiếm
   chủ trì không xác định được `unitId` (dữ liệu hỏng) mới dùng thư ký; chưa test riêng case
   fallback này (chairId có nhưng unitId null) vì dữ liệu seed hiện tại không có user thiếu
   unitId để dựng fixture tự nhiên.

---

## KHUYẾN NGHỊ 2 — Demo mode ẩn nội dung góp ý người khác trong phiếu KÍN

### Thiết kế chốt

Redact ở 2 nơi render danh sách ballot của demo mode: `PollsPage.tsx` (phiếu lấy ý kiến ngoài
họp) VÀ `MeetingDetailPage.tsx` → `VoteCard` (biểu quyết/lấy ý kiến TRONG 1 phiên họp — cùng
component dùng lại ở `LiveMeetingPage.tsx` qua prop `compact`, tự động parity vì `compact=true`
không render list comment). Cả 2 nơi cùng logic: `secret===true` + người xem KHÔNG phải
người tạo/quản lý → comment người khác ẩn (thay bằng câu "Đã bỏ phiếu — nội dung góp ý ẩn
danh"), CHỈ ballot của CHÍNH MÌNH hiện đầy đủ. Comment của chính mình LUÔN hiện đủ (kể cả khi
không phải owner) — khớp REST (`projectVote` giữ nguyên ballot có `userId===user.sub`).

### File/dòng sửa

| File | Thay đổi |
|---|---|
| `src/ui/pages/PollsPage.tsx` (trong `PollCard`, khối render `comments`, ~228-260) | Thêm biến `isMine`/`contentVisible` (= `identityVisible`, tái dùng đúng điều kiện đã có); comment chỉ hiện khi `contentVisible`, ngược lại hiện `<span>` "Đã bỏ phiếu — nội dung góp ý ẩn danh (phiếu kín)" |
| `src/ui/pages/MeetingDetailPage.tsx` (trong `VoteCard`, ~630-637 khai báo + ~744-758 render) | Thêm `isOwner = chairCtl \|\| v.createdBy===user?.id`; `canSeeIdentities = !v.secret \|\| isOwner` (mirror PollsPage); khối render đổi từ `v.secret ? 'Đại biểu (ẩn danh)' : tên` (chỉ đổi tên, giữ nguyên `b.comment`) sang ẩn CẢ tên LẪN comment khi không `identityVisible` |

### Ràng buộc quyền cuối cùng

Phiếu `secret===false`: không đổi (mọi người thấy đủ tên+comment, khớp cũ). Phiếu
`secret===true`: người tạo/MANAGE (`PollsPage`: `createdBy===user.id || manageMeetings`;
`VoteCard`: `chairCtl || createdBy===user.id`) thấy đủ TẤT CẢ ballot; người xem khác chỉ thấy
đủ ballot CỦA CHÍNH MÌNH, ballot người khác ẩn tên (đã có từ trước) VÀ ẩn nội dung góp ý (mới).
`showSignedCount`, luồng ký số (`PollSignModal`), luồng sửa phiếu nháp (`PollCreateModal`
prop `editing`) — hoàn toàn không đụng, chạy qua `build-cdn.mjs` xác nhận không lỗi cú pháp.

### Parity demo/REST

Sau sửa, mức độ ẩn danh của demo mode khớp với `access.js projectVote` (REST) về BẢN CHẤT
hiển thị (comment người khác không lộ ra màn hình) — vẫn giữ khác biệt CHỦ Ý đã ghi nhận từ
trước ở tầng LƯU TRỮ (localStorage giữ nguyên dữ liệu gốc, REST đã strip tại DB response) —
đúng đúng như techleader đã khuyến nghị "cân nhắc thống nhất... nếu cần bảo đảm hành vi giống
nhau tuyệt đối" — nay đã thống nhất ở tầng HIỂN THỊ (điều duy nhất người dùng cuối quan sát
được), không cần đổi tầng lưu trữ demo (đổi tầng lưu trữ sẽ phá vỡ khả năng owner/MANAGE xem
đủ dữ liệu để tổng hợp mà không cần gọi lại "API" riêng).

### Số ca test

Khuyến nghị 2 là **thuần FE React** (không có logic server/hàm thuần export được để unit-test
qua Node smoke/`.NET` TestHost — cả 2 harness test đều target `server/src/*.js` và
`server-dotnet/ECabinet.Api/*.cs`, không target `src/ui/*.tsx`). Đã xác minh bằng:
- `node scripts/build-cdn.mjs` → PASS (không lỗi cú pháp/import ở 2 file sửa).
- Rà tay logic điều kiện (`contentVisible`/`identityVisible`) đối chiếu trực tiếp với
  `access.js:94-111 projectVote` — khớp ngữ nghĩa "ballot khác userId bị strip comment".
- Không có ca test REST/Node/`.NET` nào bị ảnh hưởng (Khuyến nghị 2 không đụng backend) —
  xác nhận qua chạy lại đầy đủ smoke.mjs (92/92) + `.NET` (143/143) không đổi so với baseline
  trước khi sửa 2 file này.

### Rủi ro còn lại

1. Không có test tự động (unit/E2E) cho tầng UI React trong ràng buộc hiện tại (không cài
   được Jest/RTL/Playwright do npm registry bị chặn) — chỉ xác minh bằng rà code tay + build
   syntax check. Nếu môi trường sau này mở npm, nên bổ sung test snapshot/RTL cho `PollCard`/
   `VoteCard` với fixture phiếu kín.
2. Nếu tương lai thêm nơi render ballot thứ 3 (ví dụ trang xuất báo cáo/in ấn riêng biểu
   quyết), cần áp dụng lại đúng pattern `identityVisible`/`contentVisible` — chưa có hàm dùng
   chung 1 nơi (2 component độc lập tự tính biến tương tự) — rủi ro trôi hành vi nếu sửa 1 nơi
   quên nơi khác trong tương lai (đã ghi rõ trong comment ở cả 2 file để giảm rủi ro này).

---

## Tổng kết chạy test cuối cùng

| Lệnh | Kết quả |
|---|---|
| `node scripts/build-cdn.mjs` | PASS |
| `node server/test/smoke.mjs` | **92/92 PASS, 0 FAIL** |
| `dotnet run --project server-dotnet/ECabinet.Tests` | **143/143 PASS, 0 FAIL** |
