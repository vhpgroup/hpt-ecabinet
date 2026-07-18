# Truy vết kỹ thuật đầu-cuối 6 điểm vá 18/07 — Báo cáo Tech Leader (Thép)

**Phương pháp:** đọc code (không sửa), chạy build/test có sẵn, viết 2 file test hàm thuần độc lập ngoài repo (`/agent/workspace/qa2/`, import trực tiếp `guard.js`/`acl.js`/`access.js`, không mở socket). KHÔNG dùng browser. KHÔNG sửa/commit repo.

**Ghi chú về trạng thái repo:** HEAD cục bộ tại `5075f33`; `origin/main` đã tiến xa hơn 6 commit (mới nhất `ab7e738`). Working tree hiện tại (chưa commit) là bản vá "hôm nay 18/07" — khớp nội dung với commit `ae834c7` ("fix(hsmt): đợt dùng thử 18/07 — unit_admin đủ thao tác trên UI, thành viên duyệt tài liệu, phiếu kín, khóa biên bản đã ký, thể thức NĐ 30/2020") cộng thêm bổ sung riêng cho "Sửa phiếu nháp" (điểm 1, chưa có trong `ae834c7`). Không tìm thấy hash `414d774` trong lịch sử git (`git cat-file -t 414d774` → not a valid object) — có thể là tham chiếu sai; đã truy vết trực tiếp trên working tree đang chạy.

---

## BẢNG KẾT QUẢ BUILD/TEST

| Lệnh | Kết quả | Chi tiết |
|---|---|---|
| `node scripts/build-cdn.mjs` | ✅ PASS | "Đồng bộ server/src/seed.mjs" → "Bundle xong" → "dist/index.html sẵn sàng" (760KB, single-file) |
| `node server/test/smoke.mjs` | ✅ PASS 79/79 | 9 nhóm, 0 fail. Nhóm 9-GUARD-CHAIR-VS-MANAGE có ca "minutes (dự thảo, CHƯA khóa) được" và "đã KHÓA (locked=true) — KHÔNG sửa được" — **không có ca giữa (1 chữ ký, locked=false)** |
| `dotnet run --project server-dotnet/ECabinet.Tests` | ✅ PASS 128/128 | 10 nhóm, 0 fail. Nhóm 10-CHAIR-VS-MANAGE có cùng khoảng trống ca giữa như Node |
| QA2 bổ sung: `test-diem5-khoa-bienban.mjs` | ⚠️ 3 PASS / 2 FAIL (có chủ ý) | Phát hiện lỗ hổng thật ở `guardMeetings` — xem Điểm 5 |
| QA2 bổ sung: `test-diem1-3-4-guard.mjs` | ✅ 9/9 PASS | Xác nhận điểm 1/3/4 đúng thiết kế + ghi nhận khác biệt redact ở điểm 4 |

---

## ĐIỂM 1 — Sửa phiếu nháp (HSMT mục 13)

**Demo (client):**
- Nút "Sửa" chỉ hiện khi `isOwner && isDraft` — `src/ui/pages/PollsPage.tsx:158-164`.
- `updateDraftVote` (`src/services/voteService.ts:109-134`): kiểm `v.kind !== 'poll'` (dòng 112), `v.status !== 'draft'` (dòng 113) → throw nếu không phải nháp; kiểm quyền `v.createdBy !== actor.id && !isManage` (dòng 115-117, `isManage = ['admin','secretary','chairman']`). Patch build (dòng 119-130) chỉ chứa field nội dung — KHÔNG có `status`/`ballots`/`openedAt`/`closedAt`.
- Prefill đủ field trong `PollCreateModal` khi có `editing`: title/description/deadline/opts/eligibleIds/documentIds/trackerUserId/**secret** — `PollsPage.tsx:310-322`.
- Chặn kép UI (nút không hiện với open/closed) + service (throw nếu status khác draft) → double defense, không phụ thuộc một lớp duy nhất.

**REST:** PATCH `/api/votes/:id` → `guardVotes` (`server/src/guard.js:427-438`): chỉ `MANAGE` mới qua được (403 nếu không), xóa `ballots/status/openedAt/closedAt` khỏi patch trước khi ghi.
- **Soi "owner nào có thể tạo poll mà KHÔNG thuộc MANAGE":** `acl.js:35` → `votes: { create: MANAGE, ... }` — tạo poll REST **chỉ dành cho MANAGE**, không có `unit_admin`. Client `can.manageMeetings` (`authService.ts:43`) dùng để gate nút "Tạo phiếu lấy ý kiến" **cũng không bao gồm `unit_admin`** (khác với `can.createMeeting`/`can.sendInvitations` CÓ mở cho unit_admin ở điểm 2). Do đó **không có owner poll nào ngoài MANAGE trong cả 2 chế độ** — comment tại `voteService.ts:96-101` ("hai điều kiện luôn trùng nhau") là đúng thực tế, không lệch demo/REST. QA2 `1a` xác nhận thực nghiệm.

**Phán quyết: ✅ XÁC NHẬN HOẠT ĐỘNG** — cả 2 chế độ nhất quán, không có kịch bản PATCH bị 403 do lệch demo/REST.

---

## ĐIỂM 2 — Quản trị đơn vị tạo phiên họp (P0-1)

**Demo (client):**
- Gate nút "Tạo phiên họp": `MeetingsPage.tsx:52` dùng `can.createMeeting` (`authService.ts:55`, bao gồm `unit_admin`).
- `MeetingFormModal.tsx:21-24`: `isUnitAdminCreating` giới hạn `chairSecCandidates` chỉ user cùng `unitId` khi unit_admin tạo mới (không áp khi sửa — đúng phạm vi đã công bố).
- `meetingService.saveMeeting` → `enforceUnitAdminMeetingCreate` (`meetingService.ts:38-44`): kiểm `chair.unitId !== actor.unitId` / `secretary.unitId !== actor.unitId` → throw tiếng Việt nếu sai đơn vị (chặn ở tầng service, không chỉ UI).
- Gửi giấy mời: `sendInvitations` (`meetingService.ts:154-176`) mirror đúng: `isManage` hoặc (`unit_admin` + `chair.unitId === actor.unitId`).
- Tải/trình tài liệu: `documentService.ts:19-22` (`defaultReviewStatus`) dùng `can.manageMeetings` (KHÔNG gồm unit_admin) → tài liệu unit_admin tải lên mặc định **`draft`** (không tự động approved như MANAGE) → phải qua `submitForReview` (`documentService.ts:179-198`, kiểm `doc.ownerId !== actor.id`) rồi chờ duyệt. `MeetingDetailPage.tsx:411`: `canUpload = manage || user?.role === 'unit_admin'` — nút "Thêm tài liệu" đã mở cho unit_admin (trước đây comment ghi rõ "chỉ hiện cho MANAGE khiến unit_admin không thấy đường vào" — đã vá).

**REST parity:**
- `acl.js:32`: `meetings: { create: [...MANAGE, 'unit_admin'], update: 'any', remove: MANAGE }` — khớp `can.createMeeting`.
- Kiểm sâu đơn vị: `server/src/index.js` có `enforceMeetingWrite` (được nêu trong comment các file khác, đã đối chiếu logic tương đương `enforceUnitAdminMeetingCreate` phía client) — test .NET/.js nhóm 8-MULTITENANT xác nhận: "unit_admin tạo phiên họp với chủ trì CÙNG đơn vị -> 201", "...KHÁC đơn vị -> 403", "...thư ký KHÁC đơn vị -> 403", "delegate thường... -> 403" — 4/4 PASS.
- Action invite: test "unit_admin gửi giấy mời cho phiên đơn vị mình -> 200" / "...KHÔNG thuộc đơn vị mình -> 403" — 2/2 PASS (cả Node và .NET).
- `documents.create = 'any'` (`acl.js:33`) khớp client (mọi vai trò tạo được); test .NET "unit_admin (owner) trình duyệt tài liệu của chính mình (draft -> pending) -> 200" PASS.

**Phán quyết: ✅ XÁC NHẬN HOẠT ĐỘNG** — cả 2 chế độ khớp, có test tự động phủ đủ 4 nhánh (cùng đơn vị/khác đơn vị chủ trì-thư ký/không phải unit_admin).

---

## ĐIỂM 3 — Thành viên dự họp duyệt tài liệu

**Demo (client):**
- `shared.tsx` `DocReviewControls` (dòng 193-236): `isMeetingMember` = chair/secretary/participant của `meeting` truyền vào; `canApprove = (manage || isMeetingMember) && !isOwner` (dòng 205) — chặn tự duyệt dù là thành phần phiên.
- `documentService.canReviewDocument` (dòng 209-215, private) và `DocReviewControls` **lặp lại đúng cùng logic** — cả UI và service đồng nhất, không có nơi nào chỉ kiểm 1 phía.
- `MeetingDetailPage.tsx:435/447/455` và `DocumentsPage.tsx:130/148/265`: đều truyền `meeting={d.meetingId ? meetings.get(d.meetingId) : undefined}` vào `DocReviewControls` — 2 trang mirror nhau chính xác.

**REST:** `server/src/index.js:428-446`: khi ACL thô `documents.update='ownerOrManage'` chặn (không phải owner/MANAGE), server tự nạp `meetingForDocs` rồi gọi `canReviewDocumentAsMeetingMember` (`guard.js:293-304`) — "lối đi hẹp" chỉ cho qua khi patch CHỈ chứa `reviewStatus`/`reviewNote` và đúng chuyển trạng thái `pending→approved|rejected`, không phải owner. `guardDocuments` (`guard.js:318-362`) độc lập kiểm lại toàn bộ (defense-in-depth 2 lớp, không chỉ tin ACL bypass).

**QA2 xác nhận thực nghiệm (4 ca, 4/4 PASS):**
- `3a`: participant (không owner) duyệt `pending→approved` → true.
- `3b`: OWNER dù là participant CHÍNH phiên → false (chống tự duyệt).
- `3c`: patch kèm field khác ngoài `reviewStatus/reviewNote` → false (chống lách sửa field khác qua đường duyệt).
- `3d`: `guardDocuments` ghi `reviewedById`/`reviewedAt` = chính người duyệt (server không tin client).

**Phán quyết: ✅ XÁC NHẬN HOẠT ĐỘNG** — logic 3 lớp (ACL bypass hẹp → guardDocuments độc lập → client mirror) nhất quán tuyệt đối giữa demo và REST.

---

## ĐIỂM 4 — Phiếu lấy ý kiến KÍN

**Demo (client, `PollsPage.tsx`):**
- Checkbox "Phiếu kín" trong `PollCreateModal` (dòng 390-397); badge "Kín" (dòng 130).
- Redact: `canSeeIdentities = !p.secret || isOwner` (dòng 98); `identityFor` (dòng 99-100) trả tên thật nếu `canSeeIdentities || b.userId === user?.id`, ngược lại "Đại biểu (ẩn danh — phiếu kín)" — **chính mình luôn thấy đủ**.
- `showSignedCount = !p.secret || isOwner` (dòng 107) — không đếm sai số "đã ký số" trên dữ liệu đã bị ẩn ở REST.
- **QUAN TRỌNG (nội dung comment vẫn hiện):** client demo chỉ redact TÊN hiển thị (`identityFor`), KHÔNG ẩn nội dung `b.comment` — dòng 239-247 hiện `{b.comment}` nguyên văn cho mọi người xem kể cả không phải owner.

**REST:** `access.js` `projectVote` (dòng 94-111): nếu `vote.secret && !(isManage || createdBy===user.sub)`, với mỗi ballot không phải của chính mình: rebuild thành `{ optionId: b.optionId, castAt: b.castAt }` — **loại bỏ CẢ `userId` VÀ `comment` VÀ `signature`**. Test `smoke.mjs` dòng 188-204 tự khẳng định: "phiếu ẩn danh CHỈ có đúng 2 field" (`castAt`,`optionId`) — đây là THIẾT KẾ CHỦ Ý, không phải bug.

**⚠️ Khác biệt thực chất phát hiện được (QA2 `4a`/`4b`, 2/2 PASS xác nhận đúng như quan sát):**
- Phiếu KHÔNG kín (`secret=false`): cả 2 chế độ giữ nguyên comment+identity — nhất quán (`4a` PASS).
- Phiếu KÍN (`secret=true`): **REST strip cả nội dung góp ý (comment) của người khác** khỏi payload trả về; **demo (localStorage) vẫn hiển thị comment nguyên văn**, chỉ đổi nhãn người nói thành "Đại biểu (ẩn danh)". README.md dòng 130 mô tả ý định là "ẩn `userId`" (không nói ẩn nội dung) — nên hành vi demo không hẳn "sai" theo văn bản thiết kế, nhưng **REST bảo mật chặt hơn demo cho cùng tính năng** — mức độ ẩn danh không đồng nhất tuyệt đối giữa 2 chế độ. Không gây lỗi 403/500, nhưng là điểm cần lưu ý khi đối chiếu hành vi giữa 2 chế độ (đặc biệt nếu tổ chấm thi thử cả 2 chế độ và so sánh trực tiếp mức độ ẩn danh).

**Phán quyết: ✅ XÁC NHẬN HOẠT ĐỘNG (không vỡ, không 403/500)** kèm **⚠️ 1 ghi nhận không nghiêm trọng**: mức độ redact nội dung góp ý ở phiếu kín không đồng nhất giữa demo (giữ comment) và REST (xóa comment) — nên cân nhắc thống nhất một trong hai hướng nếu cần bảo đảm hành vi giống nhau tuyệt đối giữa 2 chế độ.

---

## ĐIỂM 5 — Khóa biên bản sau ký (fix sáng nay)

**Demo (client + service, ĐÚNG và có chặn kép):**
- `MeetingDetailPage.tsx:821`: `hasAnySignature = (m.minutes?.signatures.length ?? 0) > 0` (>0, không cần đủ 2).
- Banner khóa (dòng 953-956) và điều kiện hiện nút Lưu/Tạo lại dự thảo (dòng 962: `chairCtl && !hasAnySignature`) đều dùng `hasAnySignature`.
- `meetingService.saveMinutes` (dòng 500-508): `if ((m.minutes?.signatures.length ?? 0) > 0) throw new Error('Biên bản đã ký số — không thể chỉnh sửa hoặc tạo lại dự thảo')` — throw tiếng Việt, chặn CẢ đường "Lưu biên bản" VÀ "Tạo lại dự thảo" (`makeDraft` cũng gọi `saveMinutes`, dòng 854) — **1 điểm chặn duy nhất dùng chung cho cả 2 nút, không thể quên vá 1 trong 2**.
- Seed cũ (`src/data/seed.ts` meeting `m4`): `locked: true`, 2 signatures (`u-tk`, `u-ct`) khớp đúng `secretaryId`/`chairId` của m4 → khối `print-sig` (dòng 1016-1034) hiển thị đúng "(Đã ký số)" cho cả 2 vai; `content` biên bản cũ (văn bản tự do, không qua `buildMinutesDraft`) hiển thị nguyên vẹn qua `<pre>{m.minutes.content}</pre>` — **không vỡ**.

**⚠️ REST — CÓ VẤN ĐỀ (bằng chứng thực nghiệm QA2, `test-diem5-khoa-bienban.mjs`):**
`guardMeetings` (`server/src/guard.js:476-487`) chỉ xóa hẳn `p.minutes` khi `existing.minutes?.locked === true` (đủ CẢ chairId VÀ secretaryId ký, theo logic tính `locked` ở `actions.js:281-283`). Khi biên bản **mới có 1 chữ ký** (ví dụ thư ký đã ký, chủ trì chưa ký) → `locked` vẫn `false` → nhánh `else if (p.minutes)` (dòng 480-486) **CHO PHÉP ghi content mới**, chỉ giữ nguyên mảng `signatures` cũ (không cho sửa signatures) nhưng KHÔNG chặn sửa `content` — đúng kịch bản rủi ro mà chính comment trong `saveMinutes` (`meetingService.ts:494-498`) mô tả: "ghi đè nội dung trong khi chữ ký cũ vẫn giữ nguyên → mismatch nội dung đã ký với nội dung hiện tại, mất toàn vẹn pháp lý".

Test QA2 (kịch bản B/D) tái tạo chính xác: `guardPatch('meetings', existing_với_1_ký, patch_content_mới, user)` → kết quả **VẪN GHI ĐƯỢC** content mới, dù người gọi là id-match chair HOẶC `admin` toàn cục. FAIL 2/5 ca có chủ ý (B1, D) — chứng minh guard không chặn.

**.NET (`Guard.cs` dòng 499-514) có logic MIRROR Y HỆT** — cùng điều kiện chỉ kiểm `locked` (`J.BoolOr(exMinutes, "locked", false)`), cùng khoảng trống — đây là lỗ hổng tồn tại đồng thời ở CẢ 2 backend REST (do cùng bản dịch song song).

**Vì sao smoke.mjs (79/79) và .NET test (128/128) đều PASS mà không lộ ra:** cả 2 bộ test hiện có chỉ phủ 2 cực — "chưa ký" (0 signature) và "đã khóa" (`locked=true`, đủ 2 ký) — KHÔNG có ca giữa "1 chữ ký, locked=false". Đây là khoảng trống test thật, không phải test sai.

**Mức độ rủi ro thực tế:** luồng UI thông thường KHÔNG lộ lỗ hổng này vì `saveMinutes` (TypeScript, dùng chung 2 chế độ) tự chặn ở tầng service TRƯỚC KHI gửi PATCH — chặn xảy ra phía client trước khi request tới server. Lỗ hổng chỉ lộ ra nếu có request PATCH `/api/meetings/:id` với `minutes.content` mới được gửi trực tiếp (không qua `saveMinutes`, ví dụ qua Postman/script/lỗi code tương lai gọi thẳng adapter) — tức là **thiếu 1 lớp defense-in-depth ở server, dựa hoàn toàn vào việc client luôn gọi đúng qua service**.

**Phán quyết: ⚠️ CÓ VẤN ĐỀ** — Demo (client + service TS) hoàn toàn đúng theo yêu cầu "khóa NGAY khi có bất kỳ chữ ký". REST (`guard.js` VÀ `Guard.cs`, cả 2 backend) **chưa được nâng cấp tương ứng** — guard hiện tại chỉ khóa khi ĐỦ 2 chữ ký (`locked=true`), để lộ khoảng hở giữa "1 chữ ký" và "đủ 2 chữ ký" nếu có request PATCH bỏ qua tầng service client. Kịch bản cũ đã khóa hoàn toàn (`locked:true`) trong seed vẫn an toàn tuyệt đối (test C xác nhận PASS: guard xóa hẳn `p.minutes`).

---

## ĐIỂM 6 — Thể thức biên bản NĐ 30/2020

**`buildMinutesDraft`** (`meetingService.ts:402-491`) — đủ các mục:
- Quốc hiệu/tiêu ngữ: dòng 435-437 (`CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM` / `Độc lập - Tự do - Hạnh phúc`).
- Tên cơ quan từ đơn vị chủ trì: `orgName` (dòng 411-414) tra `chairUnit` theo `chair.unitId`, in hoa.
- Số/ký hiệu BB: `documentNumber` (dòng 417, dùng `opts.documentNumber ?? m.documentNumber ?? 'Số: …/BB-{symbol}'`), cấp số nguyên tăng theo năm qua `nextMinutesNumber`/`ensureMinutesNumber` (dòng 358-389), ký hiệu chuẩn hóa qua `orgSymbol` (dòng 343-350, bỏ tiền tố VP/Sở/Ban/Phòng/UBND/Cục/Chi cục).
- Địa danh-ngày: dòng 418, 441 (`${location}, ngày dd tháng mm năm yyyy`).
- Nơi nhận: dòng 486-488 (`recipients` hoặc mặc định "Như thành phần dự họp"; luôn có "Lưu: VT, {symbol}").

**View in (`MeetingDetailPage.tsx`, khối `print-sig` dòng 1016-1034):** LUÔN render 2 cột "THƯ KÝ"/"CHỦ TỌA" bất kể đã ký hay chưa — tìm `signatures.find(x => x.signerId === m.secretaryId/chairId)`: có chữ ký → "(Đã ký số)" + thời điểm `fmtDT(sig.signedAt)` + tên; chưa có → "(Ký, ghi rõ họ tên)" + tên đầy đủ để trống dòng ký tay.

**Biên bản mẫu cũ trong seed (m4):** `content` là văn bản tự do (không qua `buildMinutesDraft`, không có mục I-V chuẩn NĐ 30) nhưng vẫn hiển thị nguyên vẹn qua `<pre>` độc lập với hàm build; `chairId='u-ct'`/`secretaryId='u-tk'` khớp đúng `signerId` trong `signatures` có sẵn → khối `print-sig` vẫn render đúng "(Đã ký số)" cho cả 2 vai dù nội dung không theo mẫu mới — **không vỡ**. `server/src/seed.mjs` đồng bộ y hệt `src/data/seed.ts` (đã đối chiếu byte-for-byte qua build-cdn.mjs "Đồng bộ server/src/seed.mjs").

**Phán quyết: ✅ XÁC NHẬN HOẠT ĐỘNG** — không phát hiện vấn đề, cả nội dung dựng mới và biên bản mẫu cũ đều đúng thể thức khi in.

---

## TỔNG HỢP PHÁN QUYẾT

| # | Điểm | Demo | REST | Phán quyết |
|---|---|---|---|---|
| 1 | Sửa phiếu nháp | Đúng | Đúng, không lệch (owner luôn ⊂ MANAGE) | ✅ XÁC NHẬN |
| 2 | Unit_admin tạo phiên họp | Đúng | Đúng, test tự động phủ đủ 4 nhánh | ✅ XÁC NHẬN |
| 3 | Thành viên duyệt tài liệu | Đúng | Đúng, 3 lớp defense nhất quán | ✅ XÁC NHẬN |
| 4 | Phiếu kín | Đúng (không vỡ) | Đúng (không vỡ) | ✅ XÁC NHẬN + ⚠️ 1 ghi nhận: REST redact comment chặt hơn demo |
| 5 | Khóa biên bản sau ký | Đúng, chặn kép | **guard.js + Guard.cs CHƯA khóa khi 1 chữ ký (chỉ khóa khi locked=true/đủ 2 ký)** | **⚠️ CÓ VẤN ĐỀ** ở tầng REST guard (cả 2 backend); luồng UI bình thường không lộ vì service chặn trước |
| 6 | Thể thức NĐ 30/2020 | Đúng | N/A (thuần render/build phía FE) | ✅ XÁC NHẬN |

**Khuyến nghị vá tiếp (không tự thực hiện — nằm ngoài phạm vi "chỉ đọc code" của nhiệm vụ):** sửa điều kiện trong `guard.js:478` và `Guard.cs:503` từ `locked === true` thành `(signatures?.length ?? 0) > 0` để đồng nhất với `saveMinutes` phía client, đồng thời bổ sung 1 ca test cho khoảng "1 chữ ký, locked=false" vào cả `smoke.mjs` và `ECabinet.Tests`.
