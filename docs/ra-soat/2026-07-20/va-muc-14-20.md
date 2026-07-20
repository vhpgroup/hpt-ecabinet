# VÁ 2 MỤC 🟡 CUỐI CÙNG (14, 20) — WEB 59/59 CHỨC NĂNG HSMT

**Người thực hiện:** Phong — Frontend Developer, dự án eCabinet (HPT TECH)
**Ngày:** 2026-07-20
**Gap gốc:** `docs/ra-soat/2026-07-20/rasoat-toandien-ba.md` mục 14 (dòng 58) và mục 20 (dòng 69), 💣#2 (dòng 245-247).
**Phạm vi:** CHỈ 2 mục 14/20 — không đụng mục nào khác. Không commit/push, không đụng `.gitignore`/`package-lock.json`/`vite.config.ts`, không thêm dependency.

---

## 1. MỤC 14 — "Xóa thư mục" độc lập (HSMT dòng 411)

### 1.1 Thiết kế

Thư mục vẫn là NHÃN động trên `DocFile.folder` (không đổi thành entity riêng — đúng khuyến nghị "nếu rủi ro thì bỏ qua" trong đề bài, giữ nguyên kiến trúc hiện có). "Xóa thư mục X" = gỡ nhãn `folder` khỏi MỌI tài liệu cá nhân của actor đang mang nhãn X, KHÔNG xóa tài liệu.

### 1.2 File/dòng đã sửa

| File | Dòng | Nội dung |
|---|---|---|
| `src/services/documentService.ts` | 137-141 | `setDocFolder` — sửa 1 chỗ: `folder: folder.trim() || undefined` → `folder: folder.trim() || null` (xem 1.4 — lý do bắt buộc). |
| `src/services/documentService.ts` | 146-166 | Thêm `removeFolder(actor, folder): Promise<number>` — lọc `d.kind==='personal' && d.ownerId===actor.id && d.folder===name`, lặp `db.documents.update(d.id, {folder: null})`, 1 dòng audit tổng hợp "Xóa thư mục tài liệu", trả số tài liệu đã gỡ nhãn. |
| `src/ui/pages/DocumentsPage.tsx` | 82-91 | Hàm `removeFolder` (UI handler) — `window.confirm` cảnh báo đúng câu đề bài yêu cầu, gọi service, `setFolderFilter('')`, `refresh()`, toast. |
| `src/ui/pages/DocumentsPage.tsx` | 128-133 | Nút **"Xóa thư mục"** (icon trash) — chỉ render khi `tab==='personal' && folderFilter && folderFilter!==NO_FOLDER` (không hiện ở "Tất cả"/"Chưa phân thư mục", đúng yêu cầu). |
| `src/domain/types.ts` | 280-290 | `DocFile.folder?: string` → `folder?: string \| null` (mở rộng union type, không đổi ý nghĩa). |

Đã KHÔNG làm "đổi tên thư mục" — đánh giá rủi ro (phải đồng bộ với `folderFilter` đang chọn + validate trùng tên) không nhỏ hơn lợi ích so với yêu cầu, và đề bài cho phép bỏ nếu rủi ro. Tập trung đúng "Xóa" theo tên chính xác HSMT.

### 1.3 Quyền

Không cần thêm quyền mới: nút chỉ hiện ở tab cá nhân, tác động đúng tài liệu SỞ HỮU của actor (mirror đúng phạm vi ACL server `documents.update = 'ownerOrManage'`, actor luôn là chính chủ nên không cần kiểm thêm).

### 1.4 Phát hiện phụ (parity demo/REST) — bug preexisting đã sửa cùng đợt

Khi soát kỹ đường REST, phát hiện: `db.documents.update(docId, { folder: undefined })` ở CHẾ ĐỘ MÁY CHỦ **không có tác dụng thật**. Lý do: `restAdapter.ts` gửi `JSON.stringify(patch)` — `JSON.stringify({folder: undefined})` cho ra `"{}"` (JS loại field `undefined` khỏi JSON trước khi gửi network), server nhận `patch={}`, `merged={...existing,...patch}` giữ NGUYÊN `folder` cũ. Ở demo (localStorage) thì lại ĐÚNG (spread object JS giữ key với giá trị `undefined`, sau đó `JSON.stringify` lúc lưu localStorage loại field, đọc lại thành `undefined` thật).

→ Đây là bug PARITY 2 CHẾ ĐỘ có sẵn từ trước (thuộc `setDocFolder` gốc, không phải tôi tạo), ảnh hưởng cả đường cũ "chuyển tài liệu về Chưa phân thư mục" (dropdown mỗi dòng) VÀ trực tiếp chặn `removeFolder` mới hoạt động ở REST. Đã sửa tận gốc bằng cách dùng `null` (giá trị JSON thật, round-trip đúng qua `JSON.stringify`/`JSON.parse`) thay `undefined` khi cần "xóa field":

- `src/domain/types.ts` dòng 280-290: `DocFile.folder?: string | null`.
- `server/src/guard.js` dòng 30-31: schema `documents.folder: 'string'` → `'string|null'`.
- `server-dotnet/ECabinet.Api/Guard.cs` dòng 38-45: schema tương đương → `"string|null"` (port 1:1).
- `src/services/documentService.ts`: cả `setDocFolder` (dòng 137-141) và `removeFolder` (dòng 146-166) gửi `folder: null`.

Đã verify `typeOk`/`TypeOk` 2 backend xử lý `'null'` giống nhau (`t==='null' && val===null`), và mọi nơi FE đọc `d.folder` (`!d.folder`, `d.folder ?? ''`, `d.folder===name`) đều coi `null` falsy giống `undefined` — không phá tương thích cũ.

---

## 2. MỤC 20 — Thêm/xóa/sửa TỪNG người tham gia họp trên PeopleTab (HSMT dòng 419)

### 2.1 Thiết kế

Action MỚI nằm NGAY trên tab "Đại biểu" (`PeopleTab`), độc lập với đường "Chỉnh sửa phiên họp" (`MeetingFormModal`→`saveMeeting`→`buildParticipants`) — đường cũ GIỮ NGUYÊN không đổi 1 dòng nào.

Model participant: đọc `types.ts` xác nhận `Participant.meetingRole: 'chair'|'secretary'|'member'|'guest'` — KHÔNG có field `canVote`/`isGuest` riêng; `'member'` = biểu quyết, `'guest'` = khách mời không biểu quyết là 2 giá trị PHÂN BIỆT tư cách sẵn có. Dùng đúng field thật này cho "vai trò tham dự" (không tạo field mới).

### 2.2 File/dòng đã sửa

| File | Dòng | Nội dung |
|---|---|---|
| `src/services/meetingService.ts` | 137-158 | Docblock giải thích thiết kế + `assertNotChairOrSecretary(m, userId)` — chặn thao tác trên chair/secretary CỦA CHÍNH phiên đó (họ quản lý qua "Chỉnh sửa phiên họp"). |
| `src/services/meetingService.ts` | 160-174 | `addParticipant(actor, meetingId, userId, meetingRole='member')` — chặn trùng, tạo participant mới (`attendStatus:'pending'`, `checkedInAt:null`), ghi atomic `db.meetings.update({participants:[...]})`, audit, notify người được thêm. |
| `src/services/meetingService.ts` | 176-190 | `removeParticipant(actor, meetingId, userId)` — gọi `assertNotChairOrSecretary`, lọc bỏ khỏi mảng, ghi atomic, audit. |
| `src/services/meetingService.ts` | 192-205 | `updateParticipant(actor, meetingId, userId, meetingRole)` — gọi `assertNotChairOrSecretary`, đổi `meetingRole` của đúng 1 dòng, ghi atomic, audit. |
| `src/ui/pages/MeetingDetailPage.tsx` | 155 | Truyền `canManage={canEditThis}` xuống `PeopleTab` (biến `canEditThis` đã có sẵn ở component cha, dòng 53 — TÁI DÙNG đúng yêu cầu, không tạo helper quyền mới). |
| `src/ui/pages/MeetingDetailPage.tsx` | 258-375 | Viết lại `PeopleTab` — thêm nút "Thêm người tham gia" (chỉ `canManage`), cột "Thao tác" (Sửa/Xóa mỗi dòng, ẩn nếu là chair/secretary — hiện `—` với title giải thích), 2 modal mới. |
| `src/ui/pages/MeetingDetailPage.tsx` | 378-410 | `AddParticipantModal` — chọn user CHƯA có trong `participants` (lọc `s.users` theo `status==='active'` và không trùng `existingIds`), radio chọn Thành viên/Khách mời. |
| `src/ui/pages/MeetingDetailPage.tsx` | 412-434 | `EditParticipantModal` — đổi vai trò tham dự (biểu quyết ↔ khách mời) của 1 người. |

### 2.3 Quyền — đúng yêu cầu "kiểm chính xác helper nào đang dùng cho sửa phiên"

Đã đọc kỹ 2 helper trong `authService.ts`:
- `can.chairControls(user, chairId, secretaryId)` (dòng 45-46): CHỈ `chairId`/`secretaryId`/`admin` — dùng cho điều hành TRỰC TIẾP tại phòng họp (mở/đóng biểu quyết, kết luận…), biến `chairCtl` trong `MeetingDetailPage.tsx`.
- `can.editMeeting(actor, chairUnitId)` (dòng 64-75): `['admin','secretary','chairman'].includes(role) || (role==='unit_admin' && actor.unitId===chairUnitId)` — dùng cho nút **"Chỉnh sửa"** phiên họp, biến `canEditThis`.

Yêu cầu đề bài: *"chỉ hiện cho vai quản lý phiên: chủ trì/thư ký/admin + unit_admin-của-đơn-vị-phiên"* — đây khớp CHÍNH XÁC `can.editMeeting`/`canEditThis`, KHÔNG khớp `chairCtl` (thiếu unit_admin). Đã dùng đúng `canEditThis` cho `PeopleTab.canManage` — không tạo phép mới, không mở rộng/thu hẹp quyền nào.

### 2.4 Chặn xóa chủ trì/thư ký + cảnh báo điểm danh

- **Không cho xóa chủ trì/thư ký** qua tab này: `assertNotChairOrSecretary` (service) + UI ẩn nút Sửa/Xóa, hiện `—` với `title` giải thích "Sửa qua Chỉnh sửa phiên họp" (dòng 349-350, 353-356 `MeetingDetailPage.tsx`). 2 lớp chặn (UI + service) — nếu ai đó cố gọi service trực tiếp vẫn bị chặn.
- **Cảnh báo đã điểm danh**: `PeopleTab.removeRow` (dòng 278-285) kiểm `p.checkedInAt` — nếu có, `window.confirm` cảnh báo RÕ "ĐÃ điểm danh trong phiên này. Vẫn xóa?"; nếu chưa điểm danh thì confirm thường. KHÔNG hard-block xóa khi phiên đang live (đúng yêu cầu "tối thiểu là xóa được khi phiên chưa diễn ra" — ở đây làm RỘNG hơn tối thiểu: cho xóa cả khi đã điểm danh nếu quản lý xác nhận, đúng cho tình huống thực tế "điểm danh nhầm"/rời họp giữa phiên).

### 2.5 Parity demo + REST — KHÔNG nới guard cho participants

Đã đọc toàn văn `guardMeetings` (Node `guard.js` dòng 474-550) và `GuardMeetings` (.NET `Guard.cs` dòng 509-575) TRƯỚC khi viết code. Xác nhận: guard hiện tại **ĐÃ CHO PHÉP** `isManage || isUnitAdminHere` ghi TOÀN BỘ mảng `participants` qua PATCH (chỉ ép `checkedInAt` giữ nguyên từ server qua `keepServerCheckins`/`KeepServerCheckins`, không hạn chế số dòng/nội dung khác) — guard KHÔNG phân biệt "sửa 1 dòng" với "thêm/xóa dòng", coi participants là 1 field nguyên khối do vai quản lý toàn quyền ghi lại. Điều này ĐÃ ĐỦ RỘNG cho `addParticipant`/`removeParticipant`/`updateParticipant` — dùng đúng cách "Chỉnh sửa phiên họp" cũ vẫn dùng (gửi lại TOÀN BỘ mảng qua PATCH).

**Kết luận: KHÔNG cần nới guard nào cho participants.** `enforceMeetingWrite`/`EnforceMeetingWrite` (kiểm sâu op update) cũng KHÔNG chặn theo `status` phiên (chỉ chặn theo status ở op `delete`) — nghĩa là thao tác thêm/xóa/sửa người tham gia hoạt động ở MỌI trạng thái phiên (draft/invited/live/finished) từ vai quản lý, không bị chặn nhầm.

3 hàm mới ghi atomic qua `db.meetings.update(meetingId, {participants: newArray})` — CÙNG con đường REST (`PATCH /api/meetings/:id`) mà `saveMeeting`/`respondInvitation`/`checkIn`/`assignSeat` đang dùng, tự động chạy đúng cả demo (localStorage) và REST không cần code riêng cho mỗi backend.

### 2.6 Test mới thêm (bảo vệ hồi quy, không nới quyền)

Dù KHÔNG nới guard, đã thêm test case bảo vệ hồi quy cho use case "thêm/xóa" (khác "chỉ sửa 1 dòng" đã có test từ trước) — phòng trường hợp guard đổi trong tương lai:

- `server/test/smoke.mjs` nhóm `10-UNIT-ADMIN-MEETING-WRITE` (+4 case): MANAGE thêm 1 participant mới → qua; MANAGE xóa 1 participant → qua; unit_admin CÙNG đơn vị thêm/xóa → qua như MANAGE; unit_admin KHÁC đơn vị cố thêm người lạ → KHÔNG lọt qua (giữ nguyên existing).
- `server-dotnet/ECabinet.Tests/Program.cs` nhóm `4-GUARD` (+2 case, HTTP thật qua TestHost): chủ trì thêm `u-admin` (chưa có trong `m1` seed) qua PATCH → 200, có mặt đúng vai trò guest; chủ trì xóa lại → 200, không còn trong danh sách.

---

## 3. HỒI QUY TỰ KIỂM

| Hồi quy cần giữ | Kết quả kiểm | Cách kiểm |
|---|---|---|
| Tạo/lọc/chuyển thư mục vẫn chạy | ✅ | Đọc lại `NewFolderModal`, dropdown lọc, `moveToFolder` — không đụng dòng nào. Mô phỏng logic `removeFolder` với dữ liệu giả (5 doc, nhiều owner/kind/folder khác nhau) — chỉ đúng 2 doc mục tiêu bị gỡ nhãn, các doc khác giữ nguyên. |
| Xóa thư mục KHÔNG xóa tài liệu | ✅ | `removeFolder` chỉ `db.documents.update(d.id, {folder: null})`, KHÔNG gọi `db.documents.remove`. Mô phỏng xác nhận `docs.length` không đổi sau khi "xóa thư mục". |
| PeopleTab xem/CSV/QR vẫn nguyên | ✅ | `exportAttendance`, nút QR, bảng thống kê (`stats`), 6 cột gốc (Đại biểu/Đơn vị/Vai trò/Xác nhận/Điểm danh/Chỗ ngồi) — giữ nguyên 100%, chỉ THÊM cột "Thao tác" (điều kiện `canManage`) ở cuối. |
| Sửa phiên qua MeetingFormModal vẫn nguyên | ✅ | `git diff` xác nhận KHÔNG có dòng nào bị xóa liên quan `buildParticipants`/`saveMeeting` — chỉ CHÈN THÊM 3 hàm mới trước `buildParticipants`. `MeetingFormModal.tsx` không sửa. |
| Thêm/xóa/sửa người tham gia phản ánh đúng ở phòng họp | ✅ | `refresh()` (AppContext) re-fetch TOÀN BỘ `db.meetings.list()` sau mỗi action → `s.meetings` cập nhật toàn cục → `LiveMeetingPage.tsx` (điểm danh/biểu quyết đọc `m.participants`/`eligibleIds`) tự động thấy dữ liệu mới, không có cache riêng lệch pha. |
| Không cho xóa chủ trì/thư ký | ✅ | `assertNotChairOrSecretary` (service, 2 hàm remove/update) + UI ẩn nút (2 lớp). Mô phỏng logic xác nhận throw đúng cho `u-chair`/`u-sec`, không throw cho member thường. |
| Demo + REST đều đúng | ✅ | Guard/schema 2 backend port 1:1 (đã đọc + verify từng dòng); Node smoke 127/127 PASS; .NET Tests 177/177 PASS (bao gồm case HTTP thật qua TestHost cho cả `folder=null` và thêm/xóa participant). |

---

## 4. KẾT QUẢ BUILD/TEST

| Lệnh | Kết quả |
|---|---|
| `node scripts/build-cdn.mjs` | ✔ PASS ("Bundle xong", "dist/index.html sẵn sàng") — chạy lại nhiều lần sau mỗi đợt sửa, luôn PASS. |
| `node server/test/smoke.mjs` | **127/127 PASS** (119 gốc + 8 mới: 4 case `folder`/`validatePatch` + 4 case thêm/xóa participant qua `guardPatch`). |
| `dotnet run --project server-dotnet/ECabinet.Tests` | **177/177 PASS** (173 gốc + 4 mới: 2 case `folder=null` end-to-end qua HTTP + 2 case thêm/xóa participant qua HTTP). Đã phát hiện + sửa 1 ca fail trong lúc viết test (dữ liệu test chọn nhầm user `u-yt` đã có sẵn trong seed `m1` — sửa sang `u-admin`, không phải bug code sản phẩm). |
| `typecheck` (tsc) | KHÔNG chạy được — `node_modules` không có `typescript`/`tsc` cài sẵn trong sandbox này và không có mạng để cài (403 registry, đúng ràng buộc không thêm dependency/sửa `package-lock.json`). Đã bù bằng: (a) `esbuild` (build-cdn) parse cú pháp toàn bộ PASS nhiều lần; (b) rà tay kỹ từng đoạn diff bằng `git diff`; (c) mô phỏng logic nghiệp vụ bằng Node script độc lập (removeFolder, assertNotChairOrSecretary, add/remove/update participant) với dữ liệu giả — tất cả khớp kỳ vọng. |

---

## 5. RỦI RO CÒN LẠI

1. **Chưa chạy `typecheck` (tsc) thật** — do môi trường không có `typescript` cài sẵn và không có mạng. Rủi ro thấp: esbuild transpile PASS (bắt lỗi cú pháp), rà tay kỹ types (`Participant['meetingRole']`, `DocFile.folder`), nhưng không loại trừ 100% một lỗi type edge-case mà chỉ `tsc --noEmit` mới bắt được. Khuyến nghị: chạy `npm run typecheck` trên máy có `node_modules` đầy đủ trước khi merge.
2. **Bug preexisting đã sửa (mục 1.4) có phạm vi RỘNG HƠN "thư mục"** — pattern `field: undefined` để "xóa 1 field" qua PATCH xuất hiện ở NHIỀU nơi khác trong codebase (`reviewNote: undefined` ở `submitForReview`/`approveDocument`, `documentIds: ...: undefined` ở `addConclusion`/`updateConclusion`) — CÙNG rủi ro parity demo/REST về mặt lý thuyết. KHÔNG sửa các nơi khác (ngoài phạm vi 2 mục 14/20 được giao) — chỉ báo cáo để Tech Leader/BA cân nhắc rà soát diện rộng riêng.
3. **"Đổi tên thư mục" chưa làm** — theo đúng lựa chọn "bỏ qua nếu rủi ro, tập trung Xóa" trong đề bài. Nếu cần, có thể làm ở đợt sau bằng cách lặp `setDocFolder` với tên mới cho các doc cùng owner+folder cũ (cùng pattern `removeFolder`).
4. **Modal "Thêm người tham gia" không giới hạn theo đơn vị** — cho phép chọn BẤT KỲ user active nào trong hệ thống (không riêng cùng đơn vị với phiên) — đúng khớp hành vi CŨ của `MeetingFormModal` (chọn thành phần dự họp không giới hạn theo đơn vị, trừ chair/secretary khi `unit_admin` tạo/sửa), không phải hồi quy nhưng cũng không siết chặt hơn. Nếu nghiệp vụ cần siết theo đơn vị, cần yêu cầu riêng.
