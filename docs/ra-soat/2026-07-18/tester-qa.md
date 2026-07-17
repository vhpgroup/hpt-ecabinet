# BÁO CÁO NGHIỆM THU CHÉO ĐỘC LẬP — TESTER/QA

**Người thực hiện:** Kiểm — Tester/QA, HPT TECH
**Ngày:** 2026-07-18
**Phạm vi:** Nghiệm thu chéo đợt vá của 4 dev (Bách-backend, Phong-frontend, Trục-devops, Văn-hồ sơ) trước khi trưởng nhóm commit lên GitHub.
**Ràng buộc đã tuân thủ:** KHÔNG sửa file nào trong repo; script thử nghiệm đặt tại `/agent/workspace/qa/tester-deep.mjs` (ngoài repo); không commit/push; không mở HTTP server/socket thật trong sandbox.

---

## 1. BẢNG KẾT QUẢ T1–T6

| # | Nhiệm vụ | Kết quả | Chi tiết |
|---|---|---|---|
| T1 | Build FE (`node scripts/build-cdn.mjs`) | **PASS** | `✔ Đồng bộ server/src/seed.mjs · ✔ Bundle xong · ✔ dist/index.html sẵn sàng`. Deps đã fetch sẵn, không cần `fetch-deps.mjs`. |
| T1 | .NET build (`dotnet build server-dotnet/ECabinet.sln`) | **PASS** | 0 Warning, 0 Error — khớp đúng khai của dev-backend. |
| T1 | .NET test (`dotnet run --project server-dotnet/ECabinet.Tests`) | **PASS — 116/116** | Xác nhận đúng số dev-backend khai (9 nhóm: 1-AUTH 9/9, 2-ACL 9/9, 3-ACCESS 11/11, 4-GUARD 14/14, 5-ACTIONS/CAS 11/11, 6-OPEN/RTC 14/14, 7-WS 4/4, 8-MULTITENANT 19/19, 9-SIGN/VOTE/FEEDBACK/FILE/UNICODE 25/25). KHÔNG có FAIL, KHÔNG có ca bị skip. |
| T1 | Node smoke (`node server/test/smoke.mjs`) | **PASS — 65/65** | Xác nhận đúng số dev-backend khai (8 nhóm). KHÔNG có FAIL. |
| T2 | Đối soát diff ↔ báo cáo | **ĐẠT, có 1 điểm cần ghi chú** | Xem mục 2. |
| T3 | Khớp hợp đồng FE↔BE | **1 lệch đặc tả đã biết + 1 bug MỚI phát hiện + 1 gap thiết kế MỚI phát hiện** | Xem mục 3. |
| T4 | 15 ca kiểm thử sâu (script `/agent/workspace/qa/tester-deep.mjs`) | **29/29 PASS** (sau khi tự sửa 2 fixture sai của chính tôi, không phải bug sản phẩm) | Xem mục 4. |
| T5 | Hồi quy demo | **PASS, không hồi quy** | Giám đốc Sở KH&ĐT (delegate, đơn vị `un-khdt` khác `un-vp`) vẫn thấy đầy đủ phiên UBND `m1` vì là participant trực tiếp — xác nhận bằng dữ liệu THẬT trong seed, không chỉ suy luận. `feedbacks` đăng ký đủ ở cả `db.ts`/`repository.ts`/`restAdapter.ts`/`seed.ts`/`AppContext.tsx` (`emptySnapshot.feedbacks=[]` có sẵn, không crash lúc khởi tạo). `sim.ts`/`LiveMeetingPage`/`ScreenDisplayPage` không duyệt generic toàn collection nên không bị ảnh hưởng. |
| T6 | Website + hồ sơ + script | **ĐẠT** | Website: đúng 97/97 mã số liên tục 1–97 (đã đếm bằng script, không thiếu không trùng), chỉ 3 `<link>` toàn Google Fonts, có disclaimer trung thực không bịa khách hàng/chứng nhận, placeholder rõ (`[Hotline]`, `[Email]`...), 2 mục (#8, #48/#53) tự đánh dấu "Đang hoàn thiện theo lộ trình" — KHỚP đúng thực trạng code (xem bug P0-1). 12/12 file hồ sơ: **Đạt** tất cả (bảng chi tiết mục 6). Script: `bash -n` PASS cả 3 file `.sh` mới; YAML `docker-compose.dotnet.yml` parse OK (4 service, `caddy` có `profiles:[tls]` đúng cơ chế opt-in, cổng `web` giữ `8081:80`); `node --check scripts/loadtest.mjs` PASS. |

---

## 2. ĐỐI SOÁT DIFF ↔ BÁO CÁO (T2)

`git diff --stat`: 40 file sửa (2358 dòng thêm / 192 dòng xóa) + 15 mục mới. Đối chiếu từng file vào đúng 1 báo cáo dev:

- **40 file `M`**: 100% được giải trình — `README.md`/`deploy/Caddyfile*`/`docker-compose.dotnet.yml`/`nginx.conf` → dev-devops; `server-dotnet/*.cs` + `server/src/*.js` (kể cả `seed.mjs`) → dev-backend; `src/App.tsx`/`src/data/*`/`src/domain/*`/`src/services/{document,meeting,vote}Service.ts`/`src/store/AppContext.tsx`/`src/ui/*` (trừ Support*) → dev-frontend.
- **`server/src/seed.mjs`**: đã chạy lại `build-cdn.mjs` và xác nhận diff sinh ra SAU khi rebuild **giống byte-for-byte** diff đang có trong git status (chỉ thêm `feedbacks: []` + 1 dòng comment) — khớp 100% với diff của `src/data/seed.ts` (nguồn TS, dev-frontend sửa). Xác nhận cơ chế tự động đúng, KHÔNG đáng ngờ.
- **`scripts/.esbuild`**: cache build, đúng khuyến nghị đề bài — KHÔNG commit.
- **12 mục mới**: `deploy/{backup,restore,test-restore}-mssql*.sh` + `docs/{dr-runbook,loadtest,livekit-va-du-lieu}.md` + `scripts/loadtest.mjs` → dev-devops; `docs/ho-so/` (12 file) + `website/` → dev-hoso; `server/test/` (chỉ có `smoke.mjs`, không có file lạ nào khác) + `src/services/feedbackService.ts` + `src/ui/pages/SupportPage.tsx` + `src/ui/pages/admin/SupportAdminPage.tsx` → đúng như 2 báo cáo tương ứng khai.
- **`docs/hsmt-chuong-v.md`**: file MỚI (`git show HEAD:...` xác nhận chưa từng có trong bất kỳ commit nào) nhưng **KHÔNG được nhắc "đã tạo" trong bất kỳ báo cáo dev nào** — vì đây là văn bản HSMT gốc do bên mời thầu phát hành (668 dòng), được đặt vào `docs/` làm tài liệu tham chiếu chung cho các báo cáo phân tích nền (`phantich-hethong.md`, `danhgia-benmoithau.md`... đều trích dẫn số dòng từ file này), không phải "sản phẩm" của 1 trong 4 dev. **Không đáng ngờ về nội dung** (đã đọc đối chiếu khớp với trích dẫn trong `phantich-hethong.md`) nhưng khuyến nghị trưởng nhóm xác nhận nguồn gốc file 1 lần trước khi commit (đảm bảo đây đúng là văn bản do Sở KH&CN phát hành, không bị chỉnh sửa nội dung).

**Kết luận T2:** Không có file đáng ngờ hoặc không giải trình được về mặt "ai sửa, vì sao" — mọi thay đổi có chủ đích rõ ràng.

---

## 3. KHỚP HỢP ĐỒNG FE ↔ BE (T3) — điểm nghi ngờ số 1

### 3.1. `feedbacks` — LỆCH THẬT, backend đã tự khai đúng, KHÔNG PHẢI đoán

Đã đọc trực tiếp `SupportAdminPage.tsx` + `feedbackService.ts` (FE) và `guard.js`/`acl.js` + `Guard.cs`/`Acl.cs` (BE Node + .NET, cả hai đồng bộ 100% với nhau) để xác nhận đúng như dev-backend đã tự cảnh báo ở mục 6/9/11 báo cáo của mình:

- **FE `feedbackService.updateFeedback`**: `if (!can.manageMeetings(actor) && actor.role !== 'unit_admin') throw ...` — cho phép **admin/chairman/secretary/unit_admin** đổi trạng thái/trả lời.
- **BE (Node `guardFeedbacks` + .NET `GuardFeedbacks`, đồng bộ 1:1)**: `if (!isAdmin) { if (status/response/handledBy) throw 403 "Chỉ Quản trị hệ thống được cập nhật..." }` — **CHỈ `admin`**.
- **ACL cấp collection**: `feedbacks.update = 'any'` (Node)/`"any"` (.NET) — không chặn sớm, đi thẳng vào guard.

**Hành vi thực tế theo chế độ:**
- **Demo (localStorage, `db.feedbacks = LocalRepo`)**: KHÔNG có guard nào ở tầng data — `unit_admin`/chairman/secretary trong UI bấm nút trả lời sẽ **THÀNH CÔNG** (không có ràng buộc ACL ở LocalRepo).
- **REST (production, `db.feedbacks = RestRepo`, gọi `PATCH /api/feedbacks/:id` thật)**: `unit_admin`/chairman/secretary bấm CÙNG nút đó sẽ nhận **403** từ server, dù UI đã hiện nút và không disable.

**Mức nghiêm trọng: P1** (không phải P0 vì không phải lỗ hổng bảo mật — hướng lệch là "chặt hơn cần thiết" chứ không phải "hở hơn cần thiết"; nhưng là bug UX thật ở chế độ production — user thấy nút, bấm, nhận lỗi khó hiểu).

**Đề xuất sửa tối thiểu:** cần BA/trưởng nhóm xác nhận 1 trong 2 hướng rồi đồng bộ:
- (a) Nếu giữ "chỉ admin" đúng ý định gốc → sửa `src/services/feedbackService.ts` dòng 46 (`if (!can.manageMeetings(actor) && actor.role !== 'unit_admin')` → `if (actor.role !== 'admin')`) + ẩn/disable nút trả lời trong `SupportAdminPage.tsx` cho unit_admin/chairman/secretary (hiện đang hiện nút cho mọi người vào được trang, trang này guard bằng `RequireManage` — tức secretary/chairman VÀO ĐƯỢC trang quản trị nhưng bấm nút sẽ 403 ở production).
- (b) Nếu muốn mở cho unit_admin/manage như FE đã code → sửa `server/src/guard.js` dòng 406-414 + `server-dotnet/ECabinet.Api/Guard.cs` dòng 353-360 (đổi `isAdmin` thành điều kiện rộng hơn ở CẢ 2 backend, không chỉ 1).

### 3.2. `Ballot.signature`/`signPin` — KHỚP 100%, đã xác minh bằng test thực (không chỉ đọc code)

- Field `signPin` (FE `castBallotSigned` gửi `{optionId, comment, signPin}` qua `db.action('/vote/:id/ballot')`) khớp đúng route BE `POST /api/actions/vote/:id/ballot` đọc `body.signPin`.
- Shape `signature: {signedAt, serialNumber, hash, signerName}` khớp 100% cả 2 phía; công thức `hash = sha256(voteId|userId|optionId|comment)` khớp, tính TẠI SERVER (không tin client) — xác nhận qua `buildBallotSignature` import trực tiếp.
- Phiếu kín: `projectVote` chỉ giữ `{optionId, castAt}` cho ballot người khác — đã test bằng 3 ca độc lập (mục 4, nhóm QA8) xác nhận: (a) đại biểu thường khác thấy đúng bị ẩn userId/signature/comment; (b) MANAGE toàn cục (admin/secretary/chairman) và createdBy LUÔN xem đầy đủ mọi ballot — đây là quyền quản trị có chủ đích (khớp triết lý `projectMeeting`/`canReadFeedback`), KHÔNG PHẢI rò rỉ; (c) chính chủ ballot luôn xem đủ ballot của mình. FE (`PollsPage.tsx` dòng 206) chỉ hiện badge "Đã ký số" của người khác khi `!p.secret` — có double-defense vì BE đã strip `signature` trước nên dù FE quên check vẫn an toàn.

### 3.3. `Vote.status='draft'` + `trackerUserId`, `Unit.adminType`, `DocFile.docTypeId`, `Conclusion.documentIds` — soi kỹ SCHEMA cả 2 backend

- `VALID_VOTE_STATUS` (cả Node và .NET) = `['draft','pending','open','closed']` — có `'draft'`, khớp FE. `votes.trackerUserId: 'string'` có trong SCHEMA — round-trip OK.
- `Unit.adminType`/`DocFile.docTypeId`: **KHÔNG có trong `SCHEMA.units`/`SCHEMA.documents`** ở cả 2 backend → cơ chế `validatePatch` dòng 104 (Node): *"trường không quản trong schema: bỏ qua kiểm kiểu"* — field lạ ĐI QUA nguyên vẹn, KHÔNG bị xóa, KHÔNG bị chặn, chỉ đơn giản không được kiểm kiểu strict (rủi ro rất thấp, không phải lỗ hổng nghiêm trọng). Xác nhận đúng lời khai dev-backend mục 9.
- `Conclusion.documentIds` (field con trong `meetings.conclusions[]`): guard chỉ kiểm `conclusions` là `array` tổng, không kiểm sâu cấu trúc từng phần tử (khác với `participants`/`agenda`/`ballots` có kiểm sâu) — nhưng phát hiện **GAP THIẾT KẾ MỚI** khi lần theo quyền PATCH field này (xem mục 3.5).
- **`catalogs.type='docType'` — BUG THẬT MỚI PHÁT HIỆN, xem mục 3.4.**

### 3.4. BUG P0 MỚI PHÁT HIỆN — `catalogs.type='docType'` bị backend chặn 400, cả 2 backend, chưa ai vá

**Mô tả:** Frontend (`src/domain/types.ts` dòng 87) đã thêm `CatalogType = 'position' | 'meetingType' | 'issuingBody' | 'docType'` (mục "Danh mục loại tài liệu", HSMT mục 8) và `CatalogsAdminPage.tsx` đã thêm tab CRUD cho `docType`. Nhưng:
- `server/src/guard.js` dòng 56: `const VALID_CATALOG_TYPES = ['position', 'meetingType', 'issuingBody'];` — **THIẾU `'docType'`**.
- `server-dotnet/ECabinet.Api/Guard.cs` dòng 96: `private static readonly string[] ValidCatalogTypes = { "position", "meetingType", "issuingBody" };` — **THIẾU `'docType'`**, đồng bộ với Node (cả 2 backend nhất quán với nhau, chỉ cùng thiếu 1 tính năng).

**Tái hiện (đã xác nhận bằng test thực thi, không chỉ đọc tĩnh)** — script `/agent/workspace/qa/tester-deep.mjs` nhóm `QA9-CATALOG-DOCTYPE-GAP`:
```js
validatePatch('catalogs', { type: 'docType', name: 'Công văn' })
// -> throw httpError(400, 'Loại danh mục không hợp lệ (chỉ chức vụ / loại phiên họp / cơ quan ban hành)')
```
Kết quả: **THROW ĐÚNG NHƯ DỰ ĐOÁN — bug xác nhận 100%** (ca test PASS khi assert nó throw, tức bug tồn tại thật).

**Tác động:** Ở chế độ REST/production, `POST /api/catalogs {type:'docType', ...}` từ tab "Loại tài liệu" (`CatalogsAdminPage.tsx`) sẽ luôn nhận **400** — quản trị hệ thống KHÔNG tạo được danh mục loại tài liệu nào qua giao diện thật. Ở chế độ demo (localStorage) KHÔNG bị ảnh hưởng (validate chỉ chạy phía server thật).

**Căn nguyên:** khoảng trống giao tiếp giữa 2 dev — `dev-frontend.md` dòng 198 ghi rõ field `DocFile.docTypeId` "chờ backend dev hoàn thiện phía server song song", nhưng `dev-backend.md` (đọc toàn văn) **không có một dòng nào nhắc `docType`/`VALID_CATALOG_TYPES`** — backend không nhận nhiệm vụ này trong đợt vá vừa qua.

**Mức nghiêm trọng: P0** (chặn hoàn toàn 1 tính năng ở chế độ thật, dù đã có "cảnh báo" tự nguyện trên website — cảnh báo không thay thế việc sửa code).

**Đề xuất sửa tối thiểu (1 dòng mỗi backend):**
- `server/src/guard.js` dòng 56: `const VALID_CATALOG_TYPES = ['position', 'meetingType', 'issuingBody', 'docType'];`
- `server-dotnet/ECabinet.Api/Guard.cs` dòng 96: `private static readonly string[] ValidCatalogTypes = { "position", "meetingType", "issuingBody", "docType" };`
- (tùy chọn) sửa message lỗi dòng 205 (Node)/277 (.NET) để liệt đủ 4 loại thay vì 3.

### 3.5. GAP THIẾT KẾ MỚI PHÁT HIỆN — `chairCtl` (FE, id-match) vs `MANAGE` (BE, role-match) cho sửa/xóa kết luận

**Mô tả:** `MeetingDetailPage.tsx` cho nút sửa/xóa kết luận (`updateConclusion`/`removeConclusion`, HSMT mục 51) hiện khi `chairCtl = can.chairControls(user, m.chairId, m.secretaryId)` = *"user.id === chairId phiên NÀY hoặc secretaryId phiên NÀY hoặc role==='admin'"* — tức dựa vào **ai được GÁN làm chủ trì/thư ký CHO PHIÊN CỤ THỂ ĐÓ** (id-match), không quan tâm role tài khoản tổng thể.

Nhưng backend `guardMeetings` (Node dòng 480-484 / .NET tương đương) với người **KHÔNG thuộc `MANAGE = ['admin','secretary','chairman']`** (role tài khoản, không phải id-match) sẽ **XÓA SẠCH toàn bộ field patch NGOẠI TRỪ `participants`** trước khi ghi — silent no-op, không lỗi rõ ràng, PATCH `conclusions` biến mất.

**Tái hiện (test thực thi, nhóm `QA11-CONCLUSION-CHAIRCTL-VS-MANAGE-GAP`):** một user role=`delegate` nhưng được domain gán làm `chairId` thật của 1 phiên (nghiệp vụ hoàn toàn hợp lệ — chủ trì 1 buổi họp không nhất thiết phải có account role='chairman') → `chairCtl=true` ở FE (hiện nút) → gọi `guardPatch('meetings', existing, {conclusions:[...]}, user)` → kết quả patch = `{}` (rỗng, mất hoàn toàn thay đổi).

**Hiện trạng trong seed demo:** đã kiểm bằng script — **KHÔNG có case này xảy ra thật** (mọi `chairId` trong seed hiện tại đều thuộc role `chairman`, tức `u-ct`/`u-pct`). Vì vậy đây KHÔNG PHẢI bug đang vỡ ngay hôm nay, nhưng là rủi ro thiết kế thật khi mở rộng ra dữ liệu 500 user của các xã/phường (nơi chủ trì 1 buổi họp có thể là bất kỳ đại biểu, không chỉ tài khoản role='chairman').

**Mức nghiêm trọng: P2** (ghi nhận, chưa vỡ ở demo hiện tại, cần quyết định thiết kế trước khi mở rộng seed thật cho các xã/phường).

**Đề xuất:** khi thiết kế seed/dữ liệu thật cho xã/phường (nếu làm ở đợt sau), đảm bảo tài khoản được gán `chairId` của bất kỳ phiên nào PHẢI có `role` thuộc `MANAGE`, hoặc mở rộng `guardMeetings` để cũng cho phép "chairId/secretaryId của CHÍNH phiên đó" ghi field liên quan (tương tự cách `unit_admin` được mở qua kiểm tra sâu ở P0-2), việc này cần rà soát riêng ngoài phạm vi đợt vá vừa qua.

### 3.6. Action `vote/:id/open` từ draft

FE `openVote` (`src/services/voteService.ts` dòng 79) gọi đúng `db.action('/vote/${voteId}/open')` → route BE `POST /api/actions/vote/:id/open` (đã đối chiếu string route bằng test, không chỉ đọc mắt). BE cho phép cả `draft` và `pending` là input hợp lệ (`!['draft','pending'].includes(vote.status)` → 400 nếu KHÔNG thuộc 2 giá trị này). Demo mode: `openVote` gọi trực tiếp `db.votes.update(...)` — không có guard tương đương nhưng đạt hiệu ứng cuối giống nhau (status chuyển 'open'), nhất quán với triết lý toàn app "demo mode luôn permissive". **KHỚP, không có lệch.**

---

## 4. KIỂM THỬ NGHIỆP VỤ SÂU (T4) — 29 ca, script `/agent/workspace/qa/tester-deep.mjs`

Không thể mở HTTP/DB thật (không có Docker daemon, npm registry trả 403 nên không cài được `@electric-sql/pglite`) — theo đúng gợi ý đề bài, đã viết script import trực tiếp hàm thuần từ `server/src/{acl,guard,access,actions,open}.js` với fixture tự dựng phản chiếu chính xác shape dữ liệu thật (2 đơn vị xã A/xã B tách biệt + 1 phiên liên đơn vị), theo đúng khuôn mẫu `server/test/smoke.mjs`.

**Kết quả cuối: 29/29 PASS.** Trong lúc viết, 2 lần assertion của TÔI tự bắt lỗi SAI TRONG CHÍNH FIXTURE của mình (không phải bug sản phẩm) — đã điều tra bằng debug trực tiếp, xác nhận hành vi code là ĐÚNG THIẾT KẾ (không phải bug), rồi sửa lại fixture cho đúng ý định test:
1. Lần 1: dùng `admin` để test "người khác xem phiếu kín" — sai vì `admin` (MANAGE) luôn xem đủ theo đúng thiết kế `access.js` dòng 102, không đại diện "người khác" thông thường.
2. Lần 2: dùng user không `eligible`/không cùng đơn vị để test redaction — `projectVote` trả `null` đúng (ẩn hoàn toàn trước khi tới bước redaction), không phải lỗi.

| Nhóm | Nội dung | Kết quả |
|---|---|---|
| QA1 | unit_admin mời họp phiên đơn vị KHÁC | 3/3 PASS — 403 đúng, có đối chiếu source `actions.js` |
| QA2 | non-participant duyệt tài liệu (403) + tự duyệt tài liệu mình trình (chặn) | 3/3 PASS — cả `canReviewDocumentAsMeetingMember` và `guardPatch` (2 lớp phòng thủ) đều chặn đúng |
| QA3 | signPin sai định dạng "12ab56" | 4/4 PASS — không khớp regex, 6 số đúng thì khớp |
| QA4 | bỏ phiếu khi draft → "Phiếu chưa mở" | 2/2 PASS — xác nhận message chính xác qua đọc source |
| QA5 | tải .exe (400) + .PDF viết hoa (pass) + .ExE hoa/thường trộn (vẫn 400) | 3/3 PASS — `extOf` lowercase đúng cả 2 chiều, không có kẽ hở case-sensitivity |
| QA6 | feedback giả mạo userId người khác | 2/2 PASS — route POST ép `req.user.sub`, guard xóa `userId` khỏi mọi PATCH kể cả admin gửi |
| QA7 | user xã A GET meeting xã B (ẩn) / participant liên đơn vị GET được | 3/3 PASS — dùng đúng `meetingInvolvesUnit`/`canSeeMeetingList` |
| QA8 | phiếu kín — GET của người khác không lộ userId+signature; MANAGE/chủ ballot vẫn xem đủ (thiết kế đúng) | 3/3 PASS (sau khi tự sửa 2 fixture sai nêu trên) |
| QA9 | **BUG catalogs.docType bị chặn 400** | 2/2 PASS (ca đầu là bug được XÁC NHẬN xảy ra, ca đối chứng 3 type cũ không hồi quy) |
| QA10 | contract vote/:id/open FE↔BE | 2/2 PASS |
| QA11 | **GAP THIẾT KẾ chairCtl vs MANAGE** | 2/2 PASS (ca đầu xác nhận gap có thật khi giả lập, ca đối chứng role=chairman thật đi qua bình thường) |

**Không phủ lại các ca trùng với bộ 116+65 hiện có** (VD `.exe`/`.pdf` cơ bản, feedback userId giả mạo cơ bản, đơn vị khác GET 404 cơ bản đã có sẵn ở `8-MULTITENANT`/`9-...`/`server/test/smoke.mjs`) — tập trung vào biến thể/trường hợp biên chưa được phủ (case hoa/thường, chairCtl vs MANAGE, docType, redaction theo đúng ngữ nghĩa "người khác" chứ không lẫn MANAGE).

---

## 5. RÀ HỒI QUY DEMO (T5)

- Seed hiện tại (9 Sở của 1 UBND tỉnh) **CHƯA được đổi** sang mô hình xã/phường/đặc khu (đúng ghi chú "ngoài phạm vi" trong `dev-frontend.md` mục 10) — đây là ĐÃ BIẾT, không phải phát hiện mới, không phải lỗi của đợt vá này.
- Đã xác nhận **bằng dữ liệu thật trong seed** (không suy luận): `u-khdt` (Giám đốc Sở KH&ĐT, `unitId='un-khdt'`) là participant `attendStatus='accepted'` của phiên `m1` (chủ trì `u-ct`, `unitId='un-vp'` — đơn vị KHÁC hoàn toàn). Chạy `canSeeMeetingList`/`projectMeeting` với dữ liệu này: `canSeeMeetingList=true`, `minutes`/`conclusions` KHÔNG bị redact — **KHÔNG hồi quy sau P0-1.**
- `feedbacks` đăng ký đủ ở CẢ 5 nơi: `src/data/db.ts` (COLLECTIONS + LocalRepo), `src/data/repository.ts` (interface `DataSource`), `src/data/restAdapter.ts` (RestRepo), `src/data/seed.ts` (`feedbacks: []`), `src/store/AppContext.tsx` (`emptySnapshot.feedbacks=[]` + `refresh()` gọi `db.feedbacks.list()`) — KHÔNG có nguy cơ crash lúc khởi tạo demo.
- `sim.ts`/`LiveMeetingPage.tsx`/`ScreenDisplayPage.tsx` không duyệt generic toàn bộ `Snapshot` (chỉ dùng field cụ thể đã có sẵn từ trước) — không bị ảnh hưởng bởi collection mới.

---

## 6. DUYỆT SẢN PHẨM HỒ SƠ + WEBSITE (T6)

### 6.1. Website `website/index.html`

- Đếm bằng script: **97/97 mã số chức năng, liên tục 1→97, không thiếu không trùng** (Nhóm A I–IX web + Nhóm B di động).
- Chỉ 3 `<link>`, cả 3 là Google Fonts (preconnect x2 + stylesheet x1) — không có phụ thuộc CSS/JS ngoài nào khác.
- Footer có disclaimer trung thực rõ ràng: *"Trang không công bố danh sách khách hàng, hợp đồng đã triển khai hoặc chứng nhận nào không thuộc phạm vi đã được xác nhận."* — không bịa số liệu.
- Placeholder liên hệ rõ ràng: `[Tên đầy đủ pháp nhân HPT TECH]`, `[Mã số doanh nghiệp]`, `[Địa điểm]`, `[Hotline]`, `[Email]`.
- Mục #8 ("Quản lý danh mục loại tài liệu") và #48/#53 ("Thống kê ý kiến văn bản") tự đánh dấu `roadmap-note` "Đang hoàn thiện theo lộ trình" — **mục #8 KHỚP CHÍNH XÁC với bug P0 phát hiện ở mục 3.4** (backend thật sự chưa vá `docType`) — một tín hiệu tốt cho thấy dev-hoso đã thận trọng, không tuyên bố quá mức. Riêng #48/#53: theo báo cáo dev-frontend, tính năng "Thống kê ý kiến văn bản" ĐÃ được code đầy đủ trong đợt vá này (`ReportsPage.tsx` `PollStatsTab`) — khuyến nghị trưởng nhóm cân nhắc gỡ nhãn "đang hoàn thiện" cho 2 mục này SAU khi xác nhận build/test PASS (đã xác nhận ở T1), vì tính năng có vẻ đã hoàn thiện thật, không chỉ đúng như dev-hoso gợi ý rà lại ở báo cáo của mình mục 3.3.
- Tiếng Việt chuẩn công vụ, không lỗi chính tả rõ ràng qua các đoạn đã đọc.

**Chấm: ĐẠT.**

### 6.2. 12 file `docs/ho-so/` — Đạt/Cần sửa kèm 1 câu lý do

| # | File | Chấm | Lý do |
|---|---|---|---|
| 00 | `00-muc-luc.md` | **Đạt** | Bảng ánh xạ đầy đủ, placeholder tổng hợp rõ, hướng dẫn sử dụng bộ hồ sơ cụ thể theo từng nhóm tài liệu. |
| 01 | `01-cam-ket-bao-mat.md` | **Đạt** | Trích dẫn HSMT + luật đúng dòng cụ thể, nội dung cam kết cụ thể (không chỉ chép lại câu HSMT), có xử lý tình huống thực (dịch vụ bên thứ 3 cho WebRTC). |
| 02 | `02-cam-ket-sla.md` | **Đạt** | Chuyển đủ 19 chỉ tiêu SLA thành bảng định lượng kèm cơ chế đo lường cụ thể cho từng chỉ tiêu (không sáo rỗng). |
| 03 | `03-kich-ban-kiem-thu-van-hanh-thu.md` | **Đạt** | Bảng ca kiểm thử theo đúng cấu trúc 9 nhóm HSMT, mỗi ca có điều kiện/bước/kết quả mong đợi cụ thể, cột "Kết quả thực tế" để trống đúng mục đích khung mẫu. |
| 04 | `04-quy-trinh-quan-tri-van-hanh.md` | **Đạt** | Phân trách nhiệm 3 bên rõ ràng (Nhà thầu/Sở/Trung tâm dữ liệu), khớp đúng Phụ lục 11 TT18/2024. |
| 05 | `05-quy-trinh-bao-tri.md` | **Đạt** | Bảng chu kỳ/trách nhiệm cụ thể (hằng tuần/hằng quý/đột xuất), không chỉ liệt kê đầu việc chung. |
| 06 | `06-phuong-an-chuyen-giao-du-lieu.md` | **Đạt** | Phạm vi dữ liệu chuyển giao chi tiết theo nhóm, có lưu ý đúng về mật khẩu không chuyển giao dạng đọc được. |
| 07 | `07-phuong-an-nang-cap-quy-dinh-moi.md` | **Đạt** | Quy trình 5 bước tiếp nhận-đánh giá-thống nhất-phát triển-triển khai có thời hạn cụ thể trong 3 tháng, không chỉ cam kết chung. |
| 08 | `08-giao-trinh-dao-tao.md` | **Đạt** | Khung giờ chi tiết theo buổi, cột "Phân hệ/menu tương ứng" bám đúng menu THẬT của eCabinet (đã đối chiếu code) — không mô tả chức năng chưa có. |
| 09 | `09-ke-hoach-trien-khai.md` | **Đạt** | 12 tuần có mốc/giai đoạn/trách nhiệm rõ, ghi chú linh hoạt điều chỉnh theo phản hồi làm rõ HSMT nhưng giữ tổng hạn 3 tháng. |
| 10 | `10-van-ban-lam-ro-hsmt.md` | **Đạt** | 14 câu hỏi có trích dẫn + "Phương án nhà thầu đề xuất" thực tế (không chỉ hỏi khô khan), đã bắt đúng 1 mâu thuẫn nội tại HSMT (OS máy trạm) mà báo cáo phân tích nền đã chỉ ra. |
| 11 | `11-tai-lieu-hdsd-tong-quan.md` | **Đạt** | Khung outline bám đúng menu thật, ghi chú rõ liên kết với module HDSD tích hợp sẵn trong app — không tạo tài liệu "song trùng" vô nghĩa. |

**Tổng: 12/12 Đạt.** Không phát hiện file nào sáo rỗng hoặc thiếu căn cứ trích dẫn.

### 6.3. Script deploy + YAML + loadtest

- `bash -n deploy/backup-mssql.sh` / `restore-mssql.sh` / `test-restore.sh`: **PASS** cả 3.
- `python3 -c "yaml.safe_load(...)" docker-compose.dotnet.yml`: **PASS**, 4 service (`web`,`api`,`db`,`caddy`), `caddy.profiles=['tls']` đúng cơ chế opt-in, cổng `web` giữ `8081:80` (không đổi hành vi mặc định).
- `node --check scripts/loadtest.mjs`: **PASS**.

---

## 7. DANH SÁCH LỖI (đánh số theo mức)

### P0 — CHẶN COMMIT, PHẢI SỬA NGAY ĐÊM NAY

**P0-1. `catalogs.type='docType'` bị backend chặn 400 ở CẢ 2 backend — tính năng "Danh mục loại tài liệu" (HSMT mục 8) không hoạt động ở chế độ REST/production.**
- File/dòng: `server/src/guard.js` dòng 56 (`VALID_CATALOG_TYPES`); `server-dotnet/ECabinet.Api/Guard.cs` dòng 96 (`ValidCatalogTypes`).
- Tái hiện: gọi `validatePatch('catalogs', {type:'docType', name:'x'})` (Node) — throw 400 "Loại danh mục không hợp lệ". Qua UI thật: đăng nhập admin, vào Quản trị > Danh mục > tab "Loại tài liệu", thêm mục mới → 400 ở chế độ REST (không xảy ra ở demo localStorage).
- Đã xác nhận bằng test thực thi (script `/agent/workspace/qa/tester-deep.mjs`, nhóm QA9), không chỉ đọc tĩnh.
- Đề xuất sửa tối thiểu: thêm `'docType'`/`"docType"` vào cuối mảng ở CẢ 2 file (1 dòng mỗi file), cập nhật message lỗi liệt đủ 4 loại. Sau khi sửa, chạy lại `dotnet run --project server-dotnet/ECabinet.Tests` + `node server/test/smoke.mjs` + script QA9 để xác nhận không hồi quy và bug đã hết (ca QA9 đầu sẽ đổi từ "throw" — assertion hiện tại kỳ vọng throw để XÁC NHẬN bug, cần đảo ngược assertion sau khi vá).

### P1 — NÊN SỬA TRƯỚC KHI TRÌNH CHỦ DỰ ÁN

**P1-1. `feedbacks` — FE cho `unit_admin`/chairman/secretary đổi trạng thái/trả lời, BE (Node+.NET) chỉ cho `admin` — lệch đặc tả 2 phía, gây 403 khó hiểu ở production.**
- File/dòng: FE `src/services/feedbackService.ts` dòng 46 (`updateFeedback`); BE `server/src/guard.js` dòng 404-419 (`guardFeedbacks`) + `server-dotnet/ECabinet.Api/Guard.cs` dòng 350-365 (`GuardFeedbacks`).
- Tái hiện: đăng nhập secretary/chairman/unit_admin ở chế độ REST, vào `/support-admin`, bấm "Trả lời/sửa trạng thái" một phản hồi không phải của mình → 403 "Chỉ Quản trị hệ thống được cập nhật trạng thái/phản hồi góp ý" (dù UI không disable nút, không báo trước).
- Đã tự phát hiện và khai đúng bởi dev-backend (báo cáo mục 6/9/11) — Tester xác nhận LẠI bằng đọc code độc lập, khẳng định đúng như khai, không phải suy đoán.
- Đề xuất sửa tối thiểu: BA/trưởng nhóm chốt 1 hướng (chỉ admin HAY admin+unit_admin+manage), rồi sửa ĐÚNG 1 phía cho khớp — xem 2 phương án cụ thể tại mục 3.1 báo cáo này.

**P1-2. `docs/hsmt-chuong-v.md` là file mới không được bất kỳ báo cáo dev nào xác nhận nguồn gốc/tính nguyên vẹn trước khi đưa vào repo để commit.**
- File: `docs/hsmt-chuong-v.md` (668 dòng, `git show HEAD:...` xác nhận chưa từng tồn tại ở commit nào trước).
- Không phải lỗi nội dung (đã đối chiếu trích dẫn khớp với `phantich-hethong.md`/`danhgia-benmoithau.md`), nhưng là văn bản pháp lý gốc của bên mời thầu — trước khi commit vào lịch sử git công khai, trưởng nhóm nên xác nhận 1 lần: (a) đây đúng là bản do Sở KH&CN Hải Phòng phát hành, không bị chỉnh sửa; (b) có được phép đưa văn bản E-HSMT vào version control công khai/nội bộ hay không (một số HSMT có điều khoản bảo mật thông tin đấu thầu).
- Đề xuất: xác nhận nguồn + quyền commit văn bản này trước khi `git add`.

### P2 — GHI NHẬN LÀM SAU

**P2-1. Gap thiết kế `chairCtl` (FE, id-match theo `chairId`/`secretaryId` của phiên cụ thể) vs `MANAGE` (BE, role-match toàn cục) cho PATCH `meetings.conclusions` (sửa/xóa kết luận, HSMT mục 51).**
- File/dòng: FE `src/services/authService.ts` dòng 45-46 (`chairControls`); BE `server/src/guard.js` dòng 480-484 (`guardMeetings`, nhánh `if (!isManage) { xóa mọi field trừ participants }`).
- Chưa vỡ ở demo hiện tại (mọi `chairId` trong seed đều thuộc role `chairman` — đã xác nhận bằng script quét toàn bộ seed). Sẽ vỡ khi mở rộng dữ liệu 500 user thật của các xã/phường nếu có phiên do 1 `delegate` chủ trì (role tài khoản khác `chairman` nhưng được domain gán làm chủ trì phiên cụ thể) — PATCH kết luận sẽ bị âm thầm xóa sạch (không lỗi rõ, không mất mát dữ liệu hiện có nhưng cũng không cập nhật được).
- Đề xuất: rà soát khi thiết kế seed/dữ liệu thật cho xã/phường; đảm bảo tài khoản `chairId` luôn thuộc `MANAGE`, hoặc mở `guardMeetings` cho phép chairId/secretaryId của chính phiên đó ghi field liên quan.

**P2-2. `signedCount` (`PollsPage.tsx` dòng 84, đếm `p.ballots.filter(b => b.signature).length`) tính trên dữ liệu ĐÃ được BE redact theo vai trò người xem — số liệu này chỉ đúng khi người xem là MANAGE/owner/chính chủ; với người thường xem phiếu kín đang mở, số này sẽ đếm thiếu (chỉ đếm được ballot chưa bị ẩn).**
- File/dòng: `src/ui/pages/PollsPage.tsx` dòng 84, 115.
- Không phải bug UI thực tế xảy ra ngay: khối hiển thị `signedCount` chỉ render khi `showResults=true` (dòng 81), mà `showResults` yêu cầu `status==='closed' || myBallot || isOwner` — người thường xem phiếu kín ĐANG MỞ, chưa bỏ phiếu, không phải owner sẽ KHÔNG thấy khối này nên không có nguy cơ hiển thị sai ngay. Ghi nhận thuần túy để lưu ý nếu sau này thay đổi điều kiện `showResults`.

---

## 8. KẾT LUẬN

**CHƯA ĐỦ ĐIỀU KIỆN COMMIT** trong đêm nay, với điều kiện tối thiểu:

1. **Bắt buộc vá P0-1** (2 dòng, mỗi backend 1 dòng, rủi ro sửa gần như bằng 0) trước khi commit — đây là bug chức năng thật chặn hoàn toàn 1 tính năng ở chế độ production, nằm trong phạm vi "40 file đang sửa" nên sửa ngay trong cùng đợt là hợp lý nhất, tránh phải mở lại PR riêng.
2. **Khuyến nghị mạnh xử lý P1-1** (quyết định 1 hướng + sửa đồng bộ) trước khi trình chủ dự án — không bắt buộc chặn commit vì không phải lỗ hổng bảo mật, nhưng để nguyên sẽ gây trải nghiệm xấu rõ ràng ở demo/nghiệm thu thật với vai trò secretary/chairman/unit_admin.
3. **P1-2 cần xác nhận nhanh** (không phải sửa code, chỉ xác nhận nguồn gốc/quyền commit văn bản) trước khi `git add docs/hsmt-chuong-v.md`.
4. Sau khi vá P0-1, chạy lại đủ 3 bộ test (`dotnet build`, `dotnet run --project server-dotnet/ECabinet.Tests`, `node server/test/smoke.mjs`) + script QA (`node /agent/workspace/qa/tester-deep.mjs`, đảo ngược assertion QA9 đầu) để xác nhận 116/65/29 vẫn PASS đầy đủ, không hồi quy.

**Điểm tích cực đáng ghi nhận:** toàn bộ 3 con số dev tuyên bố (build 0/0 error, .NET 116/116, Node 65/65) đều XÁC THẬT 100% khi tester chạy lại độc lập — không có "con số ma". Đối soát diff↔báo cáo sạch, không có file lạ/không giải trình. Website + 12 file hồ sơ đạt chất lượng cao, trung thực, có căn cứ. 2 phát hiện mới (P0-1, gap P2-1) đều được xác nhận bằng test THỰC THI (không chỉ suy luận), và bản thân quá trình viết test đã tự bắt được 2 lỗi trong CHÍNH fixture của tester (đã sửa, không phải bug sản phẩm) — minh chứng phương pháp kiểm thử có độ tin cậy, không chỉ khẳng định một chiều.
