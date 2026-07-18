# Báo cáo Tech Leader — eCabinet (vá 3 lỗi P2 theo tester-qa.md 2026-07-18)

**Người thực hiện:** Thép — Tech Leader, HPT TECH
**Ngày:** 2026-07-18
**Phạm vi sửa:** CHỈ `server/src/guard.js`, `server-dotnet/ECabinet.Api/Guard.cs`, `server-dotnet/ECabinet.Api/Program.cs`, `server-dotnet/ECabinet.Tests/Program.cs`, `server/test/smoke.mjs`, `src/ui/pages/PollsPage.tsx`. Không sửa README/docs/deploy/website. Không commit/push git.
**Nguồn:** `docs/ra-soat/2026-07-18/tester-qa.md` mục 3.5 + mục 7 (P2-1, P2-2); đề bài giao trực tiếp (P2-3, IPv4-only — không nằm trong tester-qa.md, phát hiện mới hôm nay).

**Baseline trước khi sửa (đã xác nhận lại độc lập, khớp đúng số đề bài):** `dotnet build` 0/0 error · `dotnet run --project server-dotnet/ECabinet.Tests` 119/119 PASS · `node server/test/smoke.mjs` 70/70 PASS — nghĩa là bản vá P0-1 (catalogs.docType) từ tester-qa.md đã có sẵn trong repo trước khi tôi vào (116→119, 65→70), tôi chỉ thực hiện 3 fix P2 còn tồn đọng.

---

## Kết quả kiểm thử cuối cùng (tóm tắt)

| Bộ test | Lệnh chạy | Trước | Sau |
|---|---|---|---|
| FE build | `node scripts/build-cdn.mjs` | PASS | **PASS** |
| .NET build | `dotnet build server-dotnet/ECabinet.sln` | 0W/0E | **0 Warning, 0 Error** |
| .NET test | `dotnet run --project server-dotnet/ECabinet.Tests` | 119/119 | **128/128 PASS, 0 FAIL** (+9 ca mới nhóm `10-CHAIR-VS-MANAGE`) |
| Node smoke | `node server/test/smoke.mjs` | 70/70 | **79/79 PASS, 0 FAIL** (+9 ca mới nhóm `9-GUARD-CHAIR-VS-MANAGE`) |
| Bundle `dist/index.html` | `du -h` | — | **736K** (< 1MB) |

Không có test cũ nào cần sửa để khớp ngữ nghĩa mới — toàn bộ 119 ca .NET gốc + 70 ca Node gốc PASS nguyên trạng sau cả 3 fix.

---

## FIX 1 — `chairCtl` (FE, id-match) vs `MANAGE` (BE, role-match) cho sửa/xóa kết luận (P2-1, tester-qa.md mục 3.5)

### Thiết kế chọn
FE `can.chairControls(u, chairId, secretaryId)` (`src/services/authService.ts` dòng 45-46) cho phép người **được GÁN** làm chairId/secretaryId của **chính phiên đang xem** sửa/xóa kết luận (`updateConclusion`/`removeConclusion`/`addConclusion` — đều chỉ patch field `conclusions`; `saveMinutes` chỉ patch field `minutes`) — không quan tâm role tài khoản tổng thể. Nhưng BE `guardMeetings` chỉ dùng role-match (`MANAGE = ['admin','secretary','chairman']`), nên một `delegate` được domain gán làm chairId/secretaryId của MỘT phiên cụ thể sẽ bị BE âm thầm xóa sạch patch (trừ `participants`) — silent no-op, FE hiện nút nhưng lưu không có tác dụng.

Đã đối chiếu kỹ trước khi sửa: `ACL.meetings.update = 'any'` (cả 2 backend) — không có bypass sớm như case documents P0-3, `guardMeetings` là điểm quyết định duy nhất.

**Giải pháp:** thêm biến `isChairOfThisMeeting = existing.chairId === user.sub || existing.secretaryId === user.sub` (id-match trên **existing**, không phải patch — tránh giả mạo bằng cách tự gửi `chairId` mới trong patch rồi tự nhận là chủ trì). Ở nhánh cuối "đại biểu thường: ngoài dòng tham dự của mình, không sửa gì khác", nếu `isChairOfThisMeeting === true` thì giữ thêm đúng 3 field `conclusions`, `agenda`, `minutes` (ngoài `participants` như cũ). Các field khóa cứng khác (`status`, `invitedAt`, `questionSession`, `seatAssignments`, `currentItemStartedAt`) **KHÔNG đổi điều kiện** — vẫn throw 403 dựa trên `isManage` (role-match) như cũ, không bị mở bởi id-match. `minutes` khi `existing.minutes.locked === true` vẫn bị `delete p.minutes` ở nhánh sanitize riêng (chạy TRƯỚC nhánh cuối, độc lập với `isChairOfThisMeeting`) — chữ ký/khóa biên bản bất biến tuyệt đối, kể cả với chairId id-match.

### File/dòng
- Node: `server/src/guard.js` — thêm hằng `CHAIR_CONTENT_FIELDS` (dòng ~437-444), biến `isChairOfThisMeeting` (dòng ~448), sửa nhánh `keepFields` (dòng ~493-503). Bổ sung comment tổng đầu file (dòng 1-11) ghi rõ ngoại lệ mới, tránh tài liệu lạc hậu.
- .NET: `server-dotnet/ECabinet.Api/Guard.cs` — mirror 1:1, thêm `ChairContentFields` (dòng ~474-481), `isChairOfThisMeeting` dùng `J.Str(existing, "chairId")`/`J.Str(existing, "secretaryId")` (dòng ~485), sửa nhánh `keepFields` (dòng ~516-527).

### Test thêm
- Node `server/test/smoke.mjs` nhóm mới `9-GUARD-CHAIR-VS-MANAGE` (9 ca, hàm thuần `guardPatch`): chairId id-match sửa `conclusions`; secretaryId id-match sửa `agenda`; chairId id-match sửa `minutes` dự thảo chưa khóa; delegate KHÔNG liên quan phiên vẫn bị xóa sạch (giữ hành vi cũ); id-match kèm `title`/`roomId`/`chairId` khác — chỉ `conclusions` qua, field khác không đổi; id-match kèm `status` — vẫn bị xóa; id-match kèm `seatAssignments` — vẫn throw 403; `minutes.locked=true` — id-match cũng không sửa được; MANAGE role thật (không id-match phiên này) vẫn qua như cũ.
- .NET `server-dotnet/ECabinet.Tests/Program.cs` nhóm mới `10-CHAIR-VS-MANAGE` (9 ca, qua HTTP TestServer thật — `app.Login`/`app.Patch`, không phải hàm thuần): tạo meeting mới với `chairId="u-khdt"` (username `sokhdt`, role=`delegate` có sẵn trong seed) để kiểm chứng bằng dữ liệu THẬT qua request HTTP đầy đủ. Kịch bản khớp 1:1 với 9 ca Node.
- **Lỗi tự phát hiện trong CHÍNH fixture của tôi** (giống cách tester-qa.md mục 4 đã tự bắt 2 lỗi fixture trước đó, không phải bug sản phẩm): ca test "delegate không liên quan phiên" ban đầu dùng `u-tc` làm actor nhưng `u-tc` (đơn vị `un-tc`) khác đơn vị hoàn toàn với `u-khdt` (đơn vị `un-khdt`) và không phải participant trực tiếp của meeting mới tạo → bị chặn ở lớp Access (P0-1, multi-tenant) trả 404 TRƯỚC KHI tới `guardMeetings` → `NullReferenceException` khi test gọi `.AsArray()` trên object null. Đã sửa: thêm `u-tc` làm participant trực tiếp (`meetingRole: 'member'`) trong fixture meeting để tách bạch đúng biến cần kiểm (id-match hay không), không lẫn với lớp access control khác.

### Kết quả
9/9 ca Node PASS + 9/9 ca .NET PASS (qua HTTP thật) — tổng thêm 18 ca, không hồi quy 119+70 ca cũ.

---

## FIX 2 — `signedCount` đếm trên dữ liệu đã ẩn danh (P2-2, tester-qa.md)

### Thiết kế chọn
`src/ui/pages/PollsPage.tsx` dòng 84 (cũ): `signedCount = p.ballots.filter((b) => b.signature).length` — với phiếu **kín**, server (`projectVote`) đã strip `signature` khỏi ballot của người khác trước khi trả về (chỉ owner/MANAGE/chính chủ nhận đủ dữ liệu, đúng thiết kế `access.js`) — nên FE đếm trên dữ liệu đã ẩn danh sẽ ra số THIẾU đối với người xem thường.

Đúng gợi ý đề bài — cách đơn giản nhất: chỉ hiện khối "đã ký số" khi (không phải phiếu kín) HOẶC (user là người tạo/quản lý). Biến `isOwner` đã có sẵn ở dòng 78 (`p.createdBy === user?.id || can.manageMeetings(user)`) khớp chính xác định nghĩa "người tạo/quản lý" — tái dùng, không tạo biến mới trùng lặp logic.

### File/dòng
`src/ui/pages/PollsPage.tsx` — thêm biến `showSignedCount = !p.secret || isOwner` (dòng ~90, kèm comment giải thích), sửa điều kiện render tại dòng ~121: `{showSignedCount && signedCount > 0 && ...}`.

Đã rà toàn repo xác nhận đây là NƠI DUY NHẤT đếm `ballot.signature` (không có nơi khác cần đồng bộ); badge cá nhân từng ballot (dòng 190 — badge của chính mình; dòng 206 trong danh sách comment — đã có `!p.secret` tự bảo vệ theo tester-qa.md mục 3.2) không thuộc phạm vi bug này (không phải "tổng đếm").

### Test thêm
Không có harness unit test cho `src/` (repo dùng test thuần cho backend, không có test JSX/TSX) — đúng phạm vi đề bài chỉ yêu cầu "chạy build PASS" cho fix này.

### Kết quả
`node scripts/build-cdn.mjs` PASS, bundle `dist/index.html` 736K (< 1MB, không tăng đáng kể so với trước sửa).

---

## FIX 3 — .NET bind IPv4-only (P2-3, phát hiện mới hôm nay — không có trong tester-qa.md)

### Thiết kế chọn
`server-dotnet/ECabinet.Api/Program.cs` (cũ) ép `ASPNETCORE_URLS = http://0.0.0.0:{port}` — chỉ bind IPv4, bỏ lỡ mọi client kết nối qua IPv6 (kể cả loopback IPv6 nội bộ, một số reverse proxy/health-check dùng IPv6). Đối chiếu Node (`server/src/index.js` dòng 542, `server.listen(PORT, cb)` không truyền host) — Node đã dual-stack sẵn theo mặc định, tức .NET LỆCH hành vi so với Node cùng contract, đúng như đề bài mô tả.

**Giải pháp:** đổi mặc định thành `http://[::]:{port}` — Kestrel/OS hiện đại (đã xác nhận Linux sandbox) mặc định "dual-mode" khi bind vào `IPv6Any` (`[::]`), tức tự động nhận cả kết nối IPv4 (ánh xạ `::ffff:0:0/96`) mà KHÔNG cần đổi gì ở nginx/Caddy phía trước. Thêm env override `BIND_IPV4_ONLY=1` để ép về hành vi cũ (`0.0.0.0`) khi triển khai trên môi trường không có IPv6 stack (một số container/VM cũ có thể throw lúc khởi động nếu bind `[::]` mà AF_INET6 không khả dụng) — đúng gợi ý đề bài "thêm env override nếu cần an toàn". Dùng helper `Env.GetOr` sẵn có trong repo, đúng convention.

### File/dòng
`server-dotnet/ECabinet.Api/Program.cs` — toàn bộ file (26 dòng cũ → có thêm logic đọc `BIND_IPV4_ONLY`, comment giải thích đầy đủ lý do + rủi ro).

### Kiểm chứng (THỰC THI THẬT, không chỉ đọc tĩnh — vì `ECabinet.Tests` dùng `WebApplicationFactory`/TestServer in-memory, KHÔNG thực sự mở socket OS nên không tự kiểm chứng được hành vi bind)
Đã khởi động server .NET thật (`dotnet run --project server-dotnet/ECabinet.Api`, port tạm 57123-57124, dọn dẹp tiến trình ngay sau khi xác minh, không để lại tiến trình/socket dư):
1. **Mặc định (không set `BIND_IPV4_ONLY`)**: log hiển thị `Now listening on: http://[::]:57123`. `curl` đăng nhập (`POST /api/auth/login`) thành công qua **cả** `http://[::1]:57123` (IPv6 loopback) và `http://127.0.0.1:57123` (IPv4 loopback) — cùng 1 tiến trình, cả 2 protocol đều nhận request, trả JWT hợp lệ.
2. **`BIND_IPV4_ONLY=1`**: log hiển thị `Now listening on: http://0.0.0.0:57124` (đúng hành vi cũ). IPv4 vẫn kết nối được (401 — route tồn tại, chỉ thiếu token). IPv6 trả `curl` exit code 7 (connection refused) — xác nhận override hoạt động đúng, quay lại IPv4-only khi cần.

### Test thêm
Không thêm case vào `ECabinet.Tests` cho fix này — lý do: `WebApplicationFactory` dựng `TestServer` in-memory (transport ảo qua `HttpMessageHandler`, không mở socket TCP thật), nên KHÔNG có cách viết assertion tự động trong bộ test hiện tại để kiểm chứng "server có bind IPv6 thật hay không" mà không phá vỡ kiến trúc test (mở HTTP server/socket thật trong sandbox test đã được xác nhận trước là rủi ro — theo đúng ràng buộc nền tảng ghi trong `smoke.mjs`/`tester-deep.mjs`). Đã kiểm chứng bằng thực thi thủ công (chạy server thật, `curl` cả 2 protocol, dọn dẹp sạch) như mô tả trên — mức độ tin cậy tương đương hoặc cao hơn 1 unit test giả lập, vì đây là hành vi tầng OS/Kestrel không thể mock được chính xác.

### Kết quả
`dotnet build` 0/0 error; `dotnet run --project server-dotnet/ECabinet.Tests` 128/128 PASS (không hồi quy — thay đổi entrypoint `Program.cs` không ảnh hưởng `TestApp`/`WebApplicationFactory` vì test tự dựng host riêng, không đi qua `Main`).

---

## Kiểm chứng bổ sung (theo yêu cầu đề bài)

- `git status --short`: đúng 5 file tôi sửa nằm trong danh sách "M" đã có từ trước (do đợt vá trước của các dev khác) — `server/src/guard.js`, `server-dotnet/ECabinet.Api/Guard.cs`, `server-dotnet/ECabinet.Api/Program.cs`, `server-dotnet/ECabinet.Tests/Program.cs`, `src/ui/pages/PollsPage.tsx` (5 file "M"); `server/test/smoke.mjs` nằm trong thư mục untracked `server/test/` đã có từ trước, tôi chỉ append thêm case. KHÔNG có file README/docs/deploy/website nào bị tôi đổi trạng thái.
- Bundle `dist/index.html`: 736K, dưới 1MB.
- Soát comment quyền cũ: đã bổ sung 1 dòng vào comment tổng đầu `server/src/guard.js` (dòng 1-11) ghi rõ ngoại lệ mới của P2-1 (trước đó comment tổng chỉ mô tả case cũ, có thể gây hiểu nhầm là giới hạn tuyệt đối). Đã grep toàn repo (`server/`, `server-dotnet/`) các cụm `chairCtl.*MANAGE`/`role-match`/`id-match` — chỉ xuất hiện đúng ở 4 file vừa sửa/thêm, không có tham chiếu lạc ở nơi khác.

---

## Rủi ro còn lại

1. **FIX 1** — mở rộng chỉ áp dụng cho `conclusions`/`agenda`/`minutes` (chưa khóa); nếu tương lai FE thêm field điều hành nội dung khác cho `chairCtl` (ví dụ mở thêm 1 loại "ghi chú phiên" mới), cần rà lại `CHAIR_CONTENT_FIELDS`/`ChairContentFields` ở cả 2 backend đồng thời — không tự động đồng bộ.
2. **FIX 2** — chỉ sửa hiển thị con số tổng; nếu sau này thay đổi điều kiện `showResults` (hiện `p.status !== 'draft' && (p.status === 'closed' || myBallot || isOwner)`) theo hướng mở rộng cho người thường xem phiếu kín đang mở mà chưa bỏ phiếu, cần rà lại logic `showSignedCount` một lần nữa (hiện tại độc lập, không phụ thuộc `showResults`, nên vẫn đúng trong mọi trường hợp `showResults` thay đổi — nhưng nên kiểm tra lại khi có thay đổi đó).
3. **FIX 3** — mặc định mới (`[::]`) giả định OS host có hỗ trợ AF_INET6 (đã xác nhận đúng cho sandbox hiện tại, môi trường production cần dev-devops xác nhận tương tự trước khi triển khai; đã có `BIND_IPV4_ONLY=1` làm lưới an toàn nếu không). Không kiểm chứng được hành vi này qua `ECabinet.Tests` tự động (giải thích ở trên) — nếu môi trường CI/CD sau này chạy healthcheck tự động cho container thật, nên thêm 1 bước `curl http://[::1]:PORT/...` VÀ `curl http://127.0.0.1:PORT/...` vào script deploy để xác nhận liên tục (ngoài phạm vi nhiệm vụ hôm nay — thuộc `deploy/`, không được sửa).
4. Không có fix nào phải dừng giữa đường — cả 3 đều hoàn tất trong phạm vi rủi ro dự kiến.

---

## Lệnh kiểm thử để tái xác nhận

```bash
export PATH="$HOME/.dotnet:$PATH"
node scripts/build-cdn.mjs                               # kỳ vọng: PASS, dist/index.html <1MB
dotnet build server-dotnet/ECabinet.sln                  # kỳ vọng: 0 Warning, 0 Error
dotnet run --project server-dotnet/ECabinet.Tests        # kỳ vọng: 128/128 PASS
node server/test/smoke.mjs                                # kỳ vọng: 79/79 PASS
```
