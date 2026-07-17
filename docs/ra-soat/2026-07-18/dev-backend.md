# Báo cáo Backend Developer — eCabinet (đợt vá P0/P1 theo phân tích Tuệ + kiểm chứng Thép)

**Người thực hiện:** Bách — Backend Developer
**Ngày:** 2026-07-18
**Phạm vi sửa:** CHỈ `server/` (Node) và `server-dotnet/` (.NET). Không sửa `src/`, `docs/`, `deploy/`, `docker-compose*`, `README.md`, `website/`, `scripts/`. Không commit/push git.
**Nguồn:** `/agent/workspace/reports/phantich-hethong.md` mục 4.2 Nhóm A + rủi ro R1/R4/R5; `/agent/workspace/reports/techleader-verify.md` mục (b) #3/#5; `docs/hsmt-chuong-v.md` dòng 350–375.

---

## 0. Kết quả kiểm thử cuối cùng (tóm tắt)

| Bộ test | Lệnh chạy | Kết quả |
|---|---|---|
| .NET build | `dotnet build server-dotnet/ECabinet.sln` | **0 Warning, 0 Error** |
| .NET test (TestHost in-memory, không mở socket) | `dotnet run --project server-dotnet/ECabinet.Tests` | **116/116 PASS, 0 FAIL** (72 ca cũ giữ nguyên PASS + 44 ca mới) |
| Node smoke (hàm thuần, không HTTP/DB) | `node server/test/smoke.mjs` | **65/65 PASS, 0 FAIL** |

Chi tiết theo nhóm .NET:

```
1-AUTH 9/9 · 2-ACL 9/9 · 3-ACCESS 11/11 · 4-GUARD 14/14 · 5-ACTIONS/CAS 11/11 ·
6-OPEN/RTC 14/14 · 7-WS 4/4 · 8-MULTITENANT 19/19 · 9-SIGN/VOTE/FEEDBACK/FILE/UNICODE 25/25
```

Chi tiết theo nhóm Node:

```
1-ACL 5/5 · 2-MULTITENANT-ACCESS 19/19 · 3-DOC-APPROVAL 11/11 · 4-BALLOT-SIGNATURE 6/6 ·
5-VOTE-DRAFT 6/6 · 6-FEEDBACKS 7/7 · 7-FILE-WHITELIST 6/6 · 8-UNICODE 5/5
```

**Test cũ có fail do đổi ngữ nghĩa CÓ CHỦ ĐÍCH không?** KHÔNG có test cũ nào cần SỬA để khớp ngữ nghĩa mới — toàn bộ 72 ca .NET gốc PASS nguyên trạng. (Có 1 lần fail tạm thời trong quá trình phát triển — xem mục 8 "Lỗi tự phát hiện qua test" — đã sửa CODE, không sửa test, và test cũ chính là thứ đã bắt được lỗi.)

---

## 1. P0-1 — Cô lập dữ liệu theo đơn vị (multi-tenant, rủi ro R1)

### Vấn đề
`server/src/access.js`/`Access.cs` chỉ lọc `meetings` theo "có phải participant trực tiếp" — không có điều kiện đơn vị. User xã A thấy được tiêu đề/lịch/chương trình của MỌI phiên họp mọi đơn vị khác. Tương tự, `votes` (poll ngoài họp, `meetingId=null`) trước đây **hiển thị cho MỌI người đăng nhập bất kể đơn vị/eligibility** — một bug tương đương R1 mà báo cáo phân tích ban đầu chưa chỉ rõ (`inMeeting = vote.meetingId ? ... : true` — luôn `true` khi không có meetingId).

### Sửa
- **`server/src/open.js` dòng 96-103**: export `meetingInvolvesUnit(m, unitId, unitOfUser)` (tái sử dụng đúng logic Open API đã có, thêm guard `!unitId -> false`).
- **`server/src/access.js`**: `buildAccessCtx` nạp thêm `c_users` để có `unitOfUser`/`myUnitId`; thêm `myUnitMeetingIds` (dùng `meetingInvolvesUnit`). Thêm `canSeeMeetingList(m, user, ctx)` = participant trực tiếp HOẶC cùng đơn vị. `applyFilter['meetings']` lọc bằng hàm này TRƯỚC khi `projectMeeting` (redaction minutes/conclusions **giữ nguyên** — chỉ siết thêm 1 lớp lọc *trước* bước chiếu, không đổi mức độ chiếu). `projectVote` mở rộng điều kiện đọc: `inUnitViaMeeting` (phiếu trong họp — theo `myUnitMeetingIds`) HOẶC `sameUnitAsCreator` (phiếu ngoài họp — cùng đơn vị người tạo) — thay hẳn hành vi "luôn `true`" cũ.
- **`server-dotnet/ECabinet.Api/Access.cs`**: mirror 1:1 — `AccessCtx` thêm `MyUnitMeetingIds/MyUnitId/UnitOfUser`; `MeetingInvolvesUnit` viết lại độc lập (không phụ thuộc `OpenRoutes.Lookup` riêng — tránh coupling ngược) nhưng **cùng logic**; `CanSeeMeetingList`, `ProjectVote` mirror Node.

### Hợp đồng API
Không đổi shape response — chỉ đổi **tập bản ghi trả về** (list ẩn bớt, GET theo id trả 404 khi không đủ quyền — đúng triết lý cũ "ẩn = 404, không lộ tồn tại").

### Rà thêm theo yêu cầu (`votes`, `tasks`)
- **`tasks`** (`canReadTask`): đã RÀ — **không có leak chéo đơn vị** (chỉ dùng `myMeetingIds` participant-trực-tiếp, không có nhánh "luôn true" như votes cũ có). **Không sửa code** — giữ nguyên tiêu chí "người được giao/quản lý/admin" đúng như yêu cầu liệt kê (không có "cùng đơn vị" trong danh sách tiêu chí task được giao cho tasks, khác với votes). Có viết test khóa hành vi (Node: gián tiếp qua kiểm tra `myMeetingIds` không đổi; .NET: `votes (trong họp, v4/m4)` test dùng chung khái niệm).
- **`messages`/`speakRequests`/`questions`/`annotations`**: đã RÀ nhanh — đều dùng `ctx.myMeetingIds` (participant trực tiếp), **không mở rộng unit** — không có leak (thực ra UNDER-broad hơn cả meetings, an toàn). Quyết định: **giữ nguyên**, không nằm trong phạm vi yêu cầu tường minh (chỉ `meetings`/`votes`/`tasks` được liệt tên).
- **`canReadDoc`** (documents, đọc): giữ nguyên logic participant-trực-tiếp cho `doc.meetingId` — KHÔNG mở rộng theo đơn vị. Lý do: task P0-1 chỉ liệt tên `meetings/votes/tasks`; documents đã có bộ quy tắc riêng chặt hơn (secret/reviewStatus/owner/sharedWith) — mở rộng thêm có thể phá vỡ ý định "chỉ thành phần phiên đọc tài liệu chưa duyệt". Nếu cần mở rộng, đề xuất làm ở lượt sau với rà soát riêng.

### Test (mẫu)
- .NET `8-MULTITENANT`: dựng phiên `m-unit-test` (chủ trì `u-xd`/đơn vị `un-xd`, participants CHỈ 2 người) — `u-yt` (đơn vị khác hoàn toàn) → 404 + vắng mặt khỏi list; `u-pxd` (CÙNG đơn vị `un-xd`, KHÔNG phải participant) → 200 nhưng minutes/conclusions vẫn ẩn (đúng thiết kế); `u-xd` (participant) → thấy đầy đủ; admin → luôn đầy đủ. Poll `p-unit-test` (`meetingId=null`, `createdBy=u-xd`) — `u-pxd` (cùng đơn vị creator) thấy; `u-yt` (khác đơn vị) → 404. `v4` (gắn `m4`) — `u-gtvt` (participant `m4`, KHÔNG eligible `v4`) vẫn thấy; `u-xd` (đơn vị hoàn toàn không liên quan `m4`) → 404.
- Node smoke `2-MULTITENANT-ACCESS`: test thuần `meetingInvolvesUnit`/`canSeeMeetingList`/`projectMeeting`/`projectVote` với `ctx` tự dựng (19 ca).

---

## 2. P0-2 — Quản trị đơn vị (`unit_admin`) tạo phiên họp + gửi giấy mời

### Sửa
- **`server/src/acl.js`**: `meetings.create: [...MANAGE, 'unit_admin']` (giữ `update`/`remove` nguyên — KHÔNG mở rộng, xem "rủi ro còn lại"). Thêm ACL `feedbacks`.
- **`server/src/index.js`**: thêm `enforceMeetingWrite(req, 'create', body)` — đọc `unitId` của `unit_admin` TỪ DB (không tin JWT/body); `chairId`/`secretaryId` gửi lên PHẢI tra `unitId` thật từ DB và bằng đơn vị người gọi. Gọi trong route `POST /api/:collection` khi `col==='meetings'`.
- **`server/src/actions.js`**: action `meetings/:id/invite` — mở thêm cho `unit_admin` NẾU `unitId` của chính họ === `unitId` của **chủ trì phiên** (tra DB, không tin body) — cùng khái niệm "đơn vị của phiên" dùng ở bước tạo.
- **`.NET`**: `Acl.cs` (`meetings.create` += `unit_admin`), `App.cs` (`EnforceMeetingWrite`), `Actions.cs` (invite mở cho `unit_admin`) — mirror 1:1.

### Quyết định thiết kế
`Meeting` KHÔNG có field `unitId` riêng (không sửa `src/domain/types.ts` — ngoài phạm vi). "Đơn vị của phiên" suy ra ĐỘNG từ `unitId` của chủ trì (nhất quán với cách Open API tính `hostUnit`). Vì vậy `enforceMeetingWrite` bắt buộc `chairId` (và `secretaryId` nếu có) phải cùng đơn vị `unit_admin`.

### Rủi ro còn lại
**`meetings.update`/`remove` KHÔNG mở cho `unit_admin`** (chỉ `create` + action `invite`) — đúng phạm vi P0-2 được giao (chỉ liệt "tạo phiên họp" + "gửi giấy mời"). Hệ quả: sau khi `unit_admin` tạo phiên (status `draft`), `guardMeetings` (Node)/`GuardMeetings` (.NET) coi họ là "đại biểu thường" (không nằm trong `MANAGE`) khi PATCH — chỉ sửa được dòng tham dự CỦA MÌNH, KHÔNG sửa được agenda/room/title/participants khác sau khi tạo. Đây là hạn chế THẬT, cần quyết định P1/P2 tiếp theo có nên mở rộng `guardMeetings`'s `isManage` cho `unit_admin` (scoped theo đơn vị) hay không — KHÔNG tự mở rộng ở đợt này vì đó là thay đổi ACL rộng hơn phạm vi được giao, rủi ro side-effect lớn hơn (ảnh hưởng MỌI field PATCH meetings, không chỉ tạo/mời).

### Test
.NET `8-MULTITENANT`: `unit_admin` tạo họp chủ trì CÙNG đơn vị → 201; chủ trì KHÁC đơn vị → 403 "Chủ trì phiên họp phải thuộc đơn vị của bạn"; chủ trì đúng nhưng thư ký khác đơn vị → 403 "Thư ký phiên họp phải thuộc đơn vị của bạn"; delegate thường tạo họp → 403 (ACL). Invite: đúng đơn vị → 200; khác đơn vị (m1) → 403. Node smoke `1-ACL`: `allowed(ACL.meetings.create, ...)` cho `unit_admin`/`delegate`/MANAGE.

---

## 3. P0-3 — Thành viên dự họp duyệt tài liệu

### Vấn đề nghiệp vụ
HSMT: "Quản trị đơn vị chuẩn bị tài liệu họp và trình duyệt. **Thành viên dự họp thực hiện duyệt**." Code cũ: chỉ `MANAGE` (admin/secretary/chairman) duyệt được — loại trừ `delegate` dù họ đúng là "thành viên dự họp".

### Sửa (2 lớp — bắt buộc cả 2, thiếu 1 là vô hiệu hóa tính năng)

**Lớp 1 — `guardDocuments`** (logic nghiệp vụ thật): `guardPatch(col, existing, patch, user, extra)` nhận thêm `extra.meeting` (Node)/tham số `meeting` (.NET) — phiên họp chứa tài liệu, nạp từ `existing.meetingId` trước khi gọi. `allowedApprover = (isManage || isMeetingMember) && !isOwner && cur==='pending' && (next==='approved'||'rejected')`.

**Lớp 2 — ACL bypass hẹp (PHÁT HIỆN QUA TEST, xem mục 8)**: `ACL.documents.update = 'ownerOrManage'` chạy **TRƯỚC** `guardPatch` ở tầng route — một `delegate` không phải owner/MANAGE bị 403 ngay tại ACL, `guardDocuments` **không bao giờ được gọi tới**, vô hiệu hóa hoàn toàn Lớp 1. Sửa: thêm hàm `canReviewDocumentAsMeetingMember(doc, patch, user, meeting)` — cho "đi qua cổng ACL" CHỈ KHI: không phải owner, LÀ thành phần phiên (chủ trì/thư ký/participant), VÀ patch **CHỈ** chứa `reviewStatus`/`reviewNote` (chặn lách sửa field khác kèm theo), VÀ đúng transition `pending -> approved|rejected`. `guardDocuments` (Lớp 1) vẫn **độc lập kiểm tra lại toàn bộ điều kiện** — defense-in-depth, không "tin" ACL đã cho qua là đủ.

File: `server/src/guard.js` (hàm mới `canReviewDocumentAsMeetingMember`, sửa `guardDocuments`), `server/src/index.js` (route PATCH gọi hàm này khi ACL từ chối + tái dùng `meetingForDocs` đã nạp cho `extra`); `Guard.cs`/`App.cs` mirror.

### Lỗi tự phát hiện: owner tự duyệt qua "cùng phiên"
Khi thiết kế ban đầu chỉ có `allowedApprover = (isManage || isMeetingMember) && cur==='pending' && ...` (thiếu `!isOwner`) — test cũ **`documents: owner tự approve -> 403`** FAIL (nhận 200) vì owner `u-tc` của `d11` ĐỒNG THỜI là participant của `m2` (chính phiên chứa `d11`) → `isMeetingMember=true` → vô tình mở lại lỗ hổng "tự duyệt" mà logic owner phía trên đang chặn. Đã sửa: thêm `&& !isOwner` vào `allowedApprover` ở CẢ 2 backend. Test cũ (không sửa) bắt đúng lỗi này — minh chứng giá trị của bộ test hiện có.

### Hợp đồng API
`PATCH /api/documents/:id` — không đổi shape, chỉ đổi **ai được phép** gọi thành công khi `reviewStatus: pending->approved|rejected`. Response giữ nguyên field cũ (`reviewedById`, `reviewedAt`).

### Test
.NET `8-MULTITENANT`: `u-khdt` (participant `m2`, không phải owner) duyệt `d11` (pending) → 200, `reviewedById=u-khdt`; `u-tc` (owner VÀ participant `m2`) tự duyệt → 403 (khóa hồi quy); `u-yt` (ngoài `m2`) duyệt → 403; `unit_admin` (owner tài liệu của chính mình) trình duyệt draft→pending → 200 (đường cũ, không đổi, xác nhận không bị phá). Node smoke `3-DOC-APPROVAL` (11 ca): test trực tiếp `canReviewDocumentAsMeetingMember` + `guardPatch('documents', ...)` với mọi tổ hợp owner/member/outsider/manage/field-lách.

---

## 4. P0-4 — Ký số mô phỏng cho ballot (ý kiến văn bản)

### Hợp đồng API mới (đúng field theo yêu cầu — **frontend đã code khớp 100%**, xem mục 9)
`POST /api/actions/vote/:id/ballot` — body nhận thêm optional `signPin` (chuỗi 6 số). Nếu có, server gắn vào ballot:
```json
"signature": {
  "signedAt": "2026-07-18T00:00:00.000Z",
  "serialNumber": "VN-DEMO-CA:1234:a1b2c3",
  "hash": "<sha256 hex 64 ký tự>",
  "signerName": "Nguyễn Văn A"
}
```
`hash = SHA-256(voteId|userId|optionId|comment)` tính TẠI SERVER (không tin client). Sai định dạng PIN (không đúng 6 số) → **400** `"Mã PIN ký số ý kiến phải gồm 6 chữ số"`.

### Sửa
- **`server/src/actions.js`**: export `SIGN_PIN_RE = /^\d{6}$/` + hàm thuần `buildBallotSignature({voteId,userId,optionId,comment,signerName})` (tách khỏi route handler để Node smoke test được không cần HTTP). Route `/vote/:id/ballot`: kiểm PIN format NGAY (trước khi đụng DB) → 400 nếu sai; nạp `signer` (fullName) TRƯỚC `mutateDoc` (mutate phải thuần/sync, không gọi DB trong callback); nếu vote đang `draft` → thông điệp riêng "Phiếu chưa mở" (P1-5, xem mục 5).
- **`.NET`**: `Actions.cs` — `SignPinRe`, `BuildBallotSignature` (local, không cần export public vì .NET test dùng HTTP in-memory thật qua TestServer) — cùng công thức hash, cùng khuôn `serialNumber`.

### Biểu quyết KÍN — ẩn signature người khác
`projectVote`/`ProjectVote` (đã có từ trước) khi ẩn danh ballot người khác **dựng lại object mới CHỈ với `optionId`+`castAt`** — `signature` (và `comment`) tự động KHÔNG được đưa vào, **không cần sửa code thêm** cho riêng P0-4. Đã viết test khóa hành vi (không chỉ tin logic, xác nhận qua HTTP thật ở .NET + hàm thuần ở Node).

### Test
.NET `9-...`: PIN sai format → 400; PIN hợp lệ → ballot có `signature` đủ 4 field, `serialNumber` khớp regex `VN-DEMO-CA:...`; không gửi `signPin` → không có `signature`; vote kín có 1 ballot ký + 1 không ký → người khác đọc: ballot ẩn danh KHÔNG có `signature` (đếm đúng `others.Count==1`), ballot của mình (không ký) đúng là không `signature`; MANAGE đọc thấy đầy đủ `signature`. Node smoke `4-BALLOT-SIGNATURE` (6 ca): `SIGN_PIN_RE`, shape `buildBallotSignature`, công thức hash ĐÚNG (`sha256hex` tự tính lại so khớp), `comment=undefined` → hash dùng `''` không phải chuỗi `"undefined"`, `hash` xác định/`serialNumber` ngẫu nhiên mỗi lần gọi.

---

## 5. P1-5 — Vote nháp (`draft`) + Cán bộ theo dõi (`trackerUserId`)

### Sửa
- **Schema**: `guard.js`/`Guard.cs` — `VALID_VOTE_STATUS = ['draft','pending','open','closed']` (enum check mới, trước đây `status` chỉ kiểm kiểu `string` không giới hạn giá trị); `SCHEMA.votes.trackerUserId: 'string'`.
- **`actions.js`/`Actions.cs`**: `/vote/:id/open` — điều kiện mở rộng từ `status !== 'pending'` thành `!['draft','pending'].includes(status)` — cho phép `draft -> open` VÀ giữ nguyên `pending -> open` (không đổi hành vi cũ). `/vote/:id/ballot` — nếu `status === 'draft'` → 400 `"Phiếu chưa mở"` (thông điệp RIÊNG, tách biệt với thông điệp chung "chưa mở hoặc đã đóng" dùng cho `pending`/`closed`).

### Hợp đồng API
- `Vote.status` nay chấp nhận thêm giá trị `'draft'` (tạo qua `POST /api/votes` như bình thường — ACL `create` vẫn `MANAGE` như cũ, không đổi).
- `Vote.trackerUserId?: string` (optional) — round-trip qua CRUD chung, không có logic ACL riêng (chỉ kiểu dữ liệu).
- `POST /api/actions/vote/:id/ballot` khi `status==='draft'` → 400 `"Phiếu chưa mở"`.
- `POST /api/actions/vote/:id/open` nay nhận cả `draft` và `pending` làm trạng thái đầu vào hợp lệ.

### Test
.NET: tạo vote `draft` + `trackerUserId` → bỏ phiếu khi draft → 400 "Phiếu chưa mở"; `open` từ draft → 200, `status=open`; bỏ phiếu sau khi mở → 200; `trackerUserId` round-trip đúng; `trackerUserId` sai kiểu (số) → 400; `status` rác → 400. Node smoke `5-VOTE-DRAFT` (6 ca).

---

## 6. P1-6 — Collection mới `feedbacks`

### Hợp đồng API (khớp CHÍNH XÁC với `dev-frontend.md` mục "Phản hồi/Góp ý" — xem mục 9)
Schema: `{ id, userId, unitId?, category: 'bug'|'feature'|'question'|'other', content: string, status: 'new'|'processing'|'resolved', response?: string, handledBy?: string, createdAt, updatedAt }`.

- `POST /api/feedbacks` — bất kỳ ai đăng nhập; **server ÉP `userId = req.user.sub`** (bỏ qua giá trị client gửi, chống giả danh) VÀ **ÉP `unitId`** = đơn vị hiện tại của người gửi (đọc DB, không tin body/client) — mặc định `status: 'new'` nếu không gửi.
- `GET /api/feedbacks[/:id]` — của mình luôn thấy; `admin` thấy TẤT CẢ; `unit_admin` thấy phản hồi CÙNG `unitId`; vai trò khác chỉ thấy của chính mình. Không đủ quyền → ẩn khỏi list / 404 khi GET theo id.
- `PATCH /api/feedbacks/:id` — field `status`/`response`/`handledBy` **CHỈ `admin`** (secretary/chairman KHÔNG được, dù họ là `MANAGE` ở collection khác — đúng nghĩa "chỉ admin" theo yêu cầu). Người không phải admin: chỉ sửa được phản hồi CỦA CHÍNH MÌNH (nội dung/loại), không đụng `userId`/`unitId` (bất biến). `admin` đặt `handledBy` → SERVER ép = chính admin đang xử lý (không tin client khai người khác).
- `DELETE /api/feedbacks/:id` — chỉ `admin`.

### Sửa (cả 2 backend, vị trí tương ứng)
`db.js`/`Db.cs` (đăng ký collection → tự động có bảng/seed rỗng/realtime change event qua route CRUD chung — KHÔNG cần route riêng); `acl.js`/`Acl.cs` (`create:'any', update:'any', remove:['admin']` — ACL lỏng, `guardFeedbacks` siết field, cùng triết lý `votes`/`meetings`/`questions`); `guard.js`/`Guard.cs` (SCHEMA + `VALID_FEEDBACK_CATEGORY`/`VALID_FEEDBACK_STATUS` enum + hàm `guardFeedbacks` mới); `access.js`/`Access.cs` (`canReadFeedback` + thêm vào `SENSITIVE`); `index.js`/`App.cs` (ép `userId`/`unitId`/`status` mặc định khi `POST`).

### ⚠️ Cần đối chiếu với frontend — khả năng lệch đặc tả
`dev-frontend.md` mục "Phản hồi/Góp ý" ghi: *"`updateFeedback(actor, id, patch)` (chỉ quản lý — `can.manageMeetings` **hoặc `unit_admin`**...)"* — tức frontend dự kiến CẢ `unit_admin` (và có thể secretary/chairman qua `manageMeetings`) được cập nhật trạng thái/trả lời. Nhiệm vụ backend tôi nhận được ghi rõ **"PATCH status/response/handledBy: chỉ admin"** — tôi đã implement ĐÚNG theo chỉ dẫn này (chỉ admin). Đây là **KHẢ NĂNG LỆCH ĐẶC TẢ 2 phía cần điều phối** (không phải lỗi kỹ thuật của tôi) — nếu giữ "chỉ admin" ở backend mà frontend cho `unit_admin` bấm nút trả lời, user sẽ thấy nút nhưng nhận 403. Đề xuất: BA/orchestrator xác nhận lại 1 trong 2 hướng rồi tôi (hoặc dev tiếp theo) chỉnh `guardFeedbacks` cho khớp — hiện tại tôi **giữ đúng chỉ dẫn nhiệm vụ đã nhận (chỉ admin)**, không tự suy diễn mở rộng.

### Test
.NET `9-...`: tạo feedback với `userId` giả (client gửi id người khác) → server ép lại đúng người gửi + tự gán `unitId`; `unit_admin` cùng đơn vị thấy, khác đơn vị không thấy; admin thấy tất cả; non-admin PATCH `status` (dù chính chủ) → 403; người khác PATCH nội dung → 403; chính chủ PATCH nội dung của mình → 200; admin PATCH `status/response/handledBy` → 200, `handledBy` ép = admin; category/status rác → 400; chỉ admin xóa được. Node smoke `6-FEEDBACKS` (7 ca) + `db.js COLLECTIONS` có `feedbacks`.

---

## 7. P1-7 — Whitelist định dạng tệp (TT 39/2017/TT-BTTTT)

### Sửa
`validatePatch(col, body, existing)` (Node) / `ValidatePatch(col, bodyNode, existing=null)` (.NET) — thêm tham số `existing` (bản ghi hiện có khi PATCH, `undefined`/`null` khi POST) để suy ra trạng thái HIỆU LỰC (existing hợp nhất patch) của `documents.name`/`documents.dataUrl`. Chỉ áp whitelist KHI bản ghi hiệu lực có `dataUrl` khác rỗng (tài liệu THẬT có file, không áp cho tài liệu soạn trực tiếp chỉ có `content`). Danh sách 22 đuôi: `pdf, doc, docx, odt, xls, xlsx, ods, csv, ppt, pptx, odp, txt, rtf, jpg, jpeg, png, gif, tif, tiff, bmp, zip, rar`. Sai → 400 `"Định dạng tệp không hợp lệ. Định dạng cho phép: pdf, doc, ..."`.

**2 call site cập nhật** (mỗi backend): `POST /api/:collection` (không có `existing`) và `PATCH /api/:collection/:id` (`existing` = bản ghi trước patch — đã có sẵn trong scope route, không cần fetch thêm).

**Xử lý đúng ca PATCH-chỉ-đổi-tên**: một PATCH CHỈ đổi `name` (không kèm lại `dataUrl`) trên tài liệu ĐANG CÓ file vẫn bị kiểm — tránh lỗ hổng "đổi tên file .pdf đã upload thành .exe qua PATCH riêng, không kèm dataUrl".

### Test
.NET: `.exe` bị chặn (400, message liệt đủ whitelist); `.pdf` qua được; tài liệu chỉ `content` (không `dataUrl`) không bị áp; PATCH đổi tên sang đuôi cấm trên file đang có → vẫn 400. Node smoke `7-FILE-WHITELIST` (6 ca, gồm test đủ 22 đuôi hợp lệ).

---

## 8. P1-8 — Test Unicode round-trip

Không sửa code sản phẩm (đây là **bằng chứng tuân thủ** UTF-8/Unicode xuyên suốt pipeline JSON hiện có, đúng khuyến nghị Nhóm A #5 báo cáo Thép).

- **.NET**: ca test dựng chuỗi NFD **CHỦ ĐỘNG bằng `string.Normalize(NormalizationForm.FormD)`** từ một chuỗi NFC đã xác minh sẵn (không phụ thuộc text gõ tay có thể bị editor tự chuẩn hóa ngược) — gửi qua `feedbacks.content`, đọc lại, so khớp byte-for-byte + độ dài code unit. Kèm test tiếng Việt NFC + emoji (`🎉👍🇻🇳`) qua cùng đường ống, và test `units.adminType` (field mới của frontend) không bị guard chặn.
- **Node**: test `JSON.parse(JSON.stringify(...))` với chuỗi NFC+emoji và NFD (dùng `String.prototype.normalize('NFD')`, xác nhận trước `nfd !== nfc` để test không vô nghĩa); test `validatePatch`/`guardPatch` không làm hỏng nội dung Unicode; test `buildBallotSignature` với `signerName` chứa NFD + emoji.

---

## 9. Đối chiếu hợp đồng field với frontend (dev-frontend.md) — XÁC NHẬN KHỚP 100% (trừ mục 6 đã nêu)

Đã đọc `/agent/workspace/reports/dev-frontend.md` (báo cáo song song) để đối chiếu:

| Field/hợp đồng | Frontend kỳ vọng | Backend đã implement | Khớp? |
|---|---|---|---|
| `Ballot.signature.{signedAt,serialNumber,hash,signerName}` | Đúng 4 field này | Đúng 4 field này | ✅ |
| action ballot field `signPin` | `POST /actions/vote/:id/ballot` body `{optionId,comment,signPin}` | Đúng | ✅ |
| `hash = sha256Hex(voteId\|userId\|optionId\|comment)` | Đúng công thức | Đúng công thức (SERVER tính, không tin client) | ✅ |
| `serialNumber` khuôn `VN-DEMO-CA:xxxx:xxxxxx` | Đúng khuôn | Đúng khuôn | ✅ |
| `Vote.trackerUserId?: string` | Có | Có (schema + round-trip) | ✅ |
| `Vote.status='draft'` + action `/vote/:id/open` cho draft→open | Có | Có | ✅ |
| `feedbacks` qua CRUD chung `/api/feedbacks` (không route riêng) | Đúng — dùng `RestRepo` pattern chung | Đúng — đăng ký `COLLECTIONS.feedbacks`, không route đặc biệt | ✅ |
| `Unit.adminType` | Field mới, cần backend không chặn | Xác nhận: KHÔNG có trong `SCHEMA.units` → tự động bỏ qua kiểm kiểu, không bị chặn (test khóa hành vi) | ✅ |
| `Feedback` update quyền hạn | "quản lý (`manageMeetings`) HOẶC `unit_admin`" | "CHỈ `admin`" (theo đúng chỉ dẫn nhiệm vụ được giao) | ⚠️ **LỆCH — xem mục 6** |

---

## 10. Tổng hợp file đã sửa

### Node (`server/src/`)
| File | Thay đổi chính |
|---|---|
| `open.js` | Export `meetingInvolvesUnit` (P0-1) |
| `access.js` | `buildAccessCtx` +users/unitOfUser/myUnitId/myUnitMeetingIds; `canSeeMeetingList`; `projectVote` mở rộng; `canReadFeedback`; `applyFilter` +meetings/feedbacks |
| `acl.js` | `meetings.create` += `unit_admin`; ACL `feedbacks` mới |
| `guard.js` | SCHEMA +`votes.trackerUserId`, +`feedbacks`; `VALID_VOTE_STATUS`/`VALID_FEEDBACK_*`; `ALLOWED_FILE_EXT`+`extOf`; `validatePatch(col,body,existing)`; `canReviewDocumentAsMeetingMember` (mới); `guardDocuments` +`meeting`+`!isOwner`; `guardFeedbacks` (mới); `guardPatch(...,extra)` |
| `actions.js` | `SIGN_PIN_RE`, `buildBallotSignature` (export, pure); ballot action +signPin/draft; `/vote/:id/open` +draft; `/invite` +unit_admin |
| `index.js` | `enforceMeetingWrite` (mới); PATCH route: ACL bypass hẹp cho documents + `meetingForDocs`; POST route: ép userId/unitId/status cho feedbacks |
| `db.js` | `COLLECTIONS.feedbacks = 'c_feedbacks'` |

### .NET (`server-dotnet/ECabinet.Api/`)
| File | Thay đổi chính |
|---|---|
| `Access.cs` | Mirror access.js (AccessCtx mở rộng, `MeetingInvolvesUnit` riêng, `CanSeeMeetingList`, `ProjectVote`, `CanReadFeedback`) |
| `Acl.cs` | `meetings.Create` += unit_admin; `feedbacks` rule |
| `Guard.cs` | Mirror guard.js (`ValidatePatch(...,existing)`, `CanReviewDocumentAsMeetingMember`, `GuardFeedbacks`, `GuardDocuments` +meeting+`!isOwner`) |
| `Actions.cs` | Mirror actions.js (`SignPinRe`, `BuildBallotSignature`, ballot/open/invite) |
| `App.cs` | `EnforceMeetingWrite`; PATCH route ACL bypass; POST route feedbacks force-identity |
| `Store/Db.cs` | `("feedbacks","c_feedbacks")` |
| `ECabinet.Tests/Program.cs` | 2 nhóm test mới: `8-MULTITENANT` (19 ca), `9-SIGN/VOTE/FEEDBACK/FILE/UNICODE` (25 ca) |

### Test mới
- `server/test/smoke.mjs` (mới, 65 ca, chạy `node server/test/smoke.mjs`, không HTTP/socket)

---

## 11. Rủi ro còn lại / quyết định cần theo dõi

1. **Lệch đặc tả `feedbacks` update quyền hạn** (mục 6, mục 9) — cần BA/orchestrator xác nhận "chỉ admin" hay "manage+unit_admin", rồi đồng bộ 1 phía.
2. **`unit_admin` không sửa được meeting sau khi tạo** (ngoài dòng tham dự của mình) — hạn chế thật, nằm ngoài phạm vi P0-2 được giao, cần quyết định P1/P2 kế tiếp.
3. **Hiệu năng `buildAccessCtx`**: P0-1 thêm 1 query `c_users` nữa vào mỗi request GET `meetings/votes/tasks/...` (đã có 2 query `meetings`+`documents`, nay +1). Ở quy mô demo hiện tại không đáng kể; ở quy mô ≥500 user/60 tháng (đã cảnh báo ở `phantich-hethong.md` mục 2.4) — vẫn là full-table scan không phân trang, rủi ro CŨ chưa giải quyết (ngoài phạm vi nhiệm vụ này).
4. **`canReadDoc` (đọc tài liệu) chưa mở theo đơn vị** — quyết định GIỮ NGUYÊN có chủ đích (mục 1), không phải bỏ sót — nếu cần mở rộng, làm ở lượt rà soát riêng.
5. **Không sửa `guardMeetings`/ACL update cho unit_admin, không sửa quyền đọc documents theo đơn vị, không đổi ACL `votes.create`/`tasks.create`** — đúng đúng phạm vi P0/P1 được giao, không tự mở rộng.
6. **File `server/src/seed.mjs`** đã có thay đổi nhỏ (thêm `feedbacks: []`) từ tiến trình build/sync khác (không phải do tôi sửa) — xác nhận tương thích 100% với `COLLECTIONS.feedbacks` tôi đăng ký (đặt tên khớp).

---

## 12. Lệnh kiểm thử để tái xác nhận

```bash
export PATH="$HOME/.dotnet:$PATH"
dotnet build server-dotnet/ECabinet.sln                 # kỳ vọng: 0 Warning, 0 Error
dotnet run --project server-dotnet/ECabinet.Tests       # kỳ vọng: 116/116 PASS
node server/test/smoke.mjs                               # kỳ vọng: 65/65 PASS
```
