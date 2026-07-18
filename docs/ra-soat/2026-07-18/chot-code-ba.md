# CHỐT NGHIỆP VỤ 6 ĐIỂM VÁ HÔM NAY — RÀ SOÁT ĐỘC LẬP BẰNG ĐỌC CODE

**Người thực hiện:** Minh — Business Analyst, dự án eCabinet (HPT TECH)
**Ngày:** 2026-07-18
**Phương pháp:** ĐỌC TRỰC TIẾP mã nguồn working tree (chưa commit, đồng bộ origin `414d774`), KHÔNG dùng browser, KHÔNG chạy server. Đã chạy `node scripts/build-cdn.mjs` → PASS ("✔ Bundle xong", "✔ dist/index.html sẵn sàng") để xác nhận code hợp lệ cú pháp tại thời điểm rà soát.
**Góc nhìn:** "tổ chấm thầu sẽ thấy gì khi thao tác trên bản demo" + "có đúng câu chữ HSMT không". Làm độc lập, không đọc báo cáo Tech Leader song song — có trích các báo cáo dev khác (`dungthu-fixes.md`, `dungthu-thethuc.md`) chỉ như GIẢ THUYẾT cần kiểm chứng, mọi kết luận đều dựa trên code đọc trực tiếp (đường dẫn + số dòng cụ thể).
**Nguồn đối chiếu:** `docs/hsmt-chuong-v.md` (mục 13 dòng 409; quy trình chuẩn bị cuộc họp dòng 352-358; quy trình lấy ý kiến văn bản dòng 367-374); `docs/ra-soat/2026-07-18/dungthu-so-khcn.md` (2 điều kiện bắt buộc nghiệm thu); `docs/ra-soat/2026-07-18/doi-chieu-hsmt-cuoi-ngay.md` (ma trận đối chiếu).

---

## 1. SỬA PHIẾU NHÁP (mục 13 HSMT — "sửa nội dung văn bản chưa lấy ý kiến")

**(i) Luồng UI theo code:** Vai Thư ký/Chủ trì/Admin (`can.manageMeetings`) vào trang "Lấy ý kiến" → tab "Chưa gửi" (badge số lượng, `PollsPage.tsx` dòng 52-54) → mỗi thẻ phiếu ở trạng thái `draft` hiện 2 nút song song: "Sửa" (icon bút) và "Gửi lấy ý kiến" (dòng 158-169). Bấm "Sửa" mở lại `PollCreateModal` ở chế độ `editing` (title đổi "Sửa phiếu lấy ý kiến (nháp)", dòng 353), prefill toàn bộ state từ phiếu cũ, footer chỉ còn 1 nút "Lưu thay đổi" (dòng 357-358, không trộn với hành động Gửi).

**(ii) Đối chiếu câu chữ HSMT:** `updateDraftVote()` (`src/services/voteService.ts` dòng 109-134) qua interface `DraftPollUpdate` (dòng 78-87) cho sửa ĐỦ 8 trường nghiệp vụ orchestrator liệt: `title` (tiêu đề), `description` (mô tả), `optionLabels` (phương án), `eligibleIds` (người xin ý kiến), `documentIds` (tài liệu), `deadline` (hạn), `secret` (kín/công khai), `trackerUserId` (cán bộ theo dõi). UI modal cũng render đủ 8 field này ở chế độ sửa (không ẩn field nào so với chế độ tạo mới). Sau khi Lưu, phiếu vẫn ở `draft` → nút "Gửi lấy ý kiến" vẫn hiện bình thường (không bị đổi trạng thái/mất nút) — khớp đúng nghĩa "sửa nội dung văn bản CHƯA lấy ý kiến" của mục 13.

**Ai KHÔNG được sửa:** `updateDraftVote` chặn 3 lớp: (1) chỉ `kind='poll'`; (2) chỉ khi `status==='draft'` — ném lỗi rõ nếu phiếu đã `open`/`closed` (dòng 113); (3) chỉ `createdBy===actor.id` HOẶC role thuộc `['admin','secretary','chairman']` (dòng 114-117). Ở tầng UI, nút Sửa chỉ hiện khi `isOwner && isDraft` (dòng 158, `isOwner = createdBy===user.id || can.manageMeetings`) — người ngoài không thấy nút, kể cả đại biểu thường không có quyền tạo phiếu nên không có phiếu nào của họ để sửa.

**Đối chiếu server (REST mode) — kiểm tra độc lập, KHÔNG chỉ tin comment:** `guardVotes()` cả ở Node (`server/src/guard.js` dòng 427-438) và .NET (`Guard.cs` `GuardVotes` dòng 465-…) đều cho MANAGE PATCH nội dung phiếu, chỉ xóa `ballots/status/openedAt/closedAt` khỏi patch — khớp 100% với logic demo mode. Cả 2 backend đồng bộ.

**(iii) Edge case còn hở:** `guardVotes` (server) chỉ kiểm `MANAGE.includes(user.role)`, KHÔNG kiểm `createdBy===actor.id` như `updateDraftVote` (demo mode) làm. Hiện tại 2 điều kiện luôn trùng nhau vì nút Tạo phiếu chỉ hiện cho MANAGE (comment trong code cũng tự nhận thức điều này). Nhưng đây là **giả định ẩn (implicit invariant) không được server enforce độc lập** — nếu tương lai mở quyền tạo phiếu cho vai khác (ví dụ `unit_admin`, tương tự cách đã mở cho tạo phiên họp ở điểm 2), người tạo đó sẽ bị 403 ở REST mode dù demo mode cho qua, tạo lệch hành vi 2 môi trường. Ngoài ra: không có giới hạn số lần sửa/không có log "đã sửa lần thứ mấy" hiển thị cho đại biểu (không quan trọng vì đại biểu chưa nhận được phiếu draft).

**(iv) Phán quyết: ✅ ĐẠT.** Đủ cả 8 hành động con nêu trong HSMT mục 13, chặn đúng 3 lớp quyền, cả 2 backend REST đồng bộ với demo mode. Chỉ có 1 giả định ẩn (không phải lỗi hiện tại) cần ghi chú khi mở rộng vai trò tạo phiếu.

---

## 2. QUẢN TRỊ ĐƠN VỊ TẠO PHIÊN HỌP (quy trình HSMT dòng 352-355)

**(i) Luồng UI theo code:** `unit_admin` đăng nhập → trang "Phiên họp" thấy nút "Tạo phiên họp" (`can.createMeeting`, `MeetingsPage.tsx` dòng 52-53, cho phép cả `unit_admin` — `authService.ts` dòng 55). Mở `MeetingFormModal`: vì `isUnitAdminCreating = !initial && role==='unit_admin'` (dòng 21), dropdown Chủ trì/Thư ký CHỈ hiện người `unitId===user.unitId` (`chairSecCandidates`, dòng 22-24), kèm ghi chú UI "chủ trì và thư ký chỉ chọn được trong phạm vi đơn vị của bạn" (dòng 158-162). Sau khi tạo (trạng thái `draft`), vào trang Detail phiên: `unit_admin` thấy nút "Gửi giấy mời" (qua `canInviteThis`, dòng 45 `MeetingDetailPage.tsx`) nhưng KHÔNG thấy "Chỉnh sửa"/"Xóa" (2 nút này lồng trong điều kiện riêng `{manage && (...)}` dòng 79-86 — chỉ MANAGE toàn cục). Ở tab Tài liệu, `unit_admin` thấy nút "Thêm tài liệu vào phiên họp" (`canUpload = manage || role==='unit_admin'`, dòng 411).

**(ii) Đối chiếu câu chữ HSMT + demo/REST có khớp không:** Đọc riêng 3 lớp code độc lập — FE mirror `enforceUnitAdminMeetingCreate` (`meetingService.ts` dòng 38-44), Node REST `enforceMeetingWrite` (`server/src/index.js` dòng 131-147), .NET REST `EnforceMeetingWrite` (`App.cs` dòng 578-598) — cả 3 cùng logic: chỉ áp `op==='create'` (không siết SỬA), chỉ role `unit_admin`, chairId+secretaryId PHẢI cùng `unitId` với actor (unitId của actor đọc từ DB/store, KHÔNG tin JWT/body; unitId của chair/secretary cũng tra thật từ DB, không tin nhãn client gửi lên). **3 lớp code khớp 1:1 về ngữ nghĩa** — đây là điểm ĐẠT thực chất, không chỉ ở tầng UI demo.

**Còn thiếu so với "ĐỦ trọn quy trình HSMT":** HSMT dòng 354-355 nói "Quản trị đơn vị nhập thông tin cuộc họp... thông báo cho Thành viên dự họp... chuẩn bị tài liệu và trình duyệt". Đã có: tạo phiên (✅), gửi giấy mời/thông báo (✅ qua `canInviteThis`), thêm tài liệu (✅ qua `canUpload`), trình duyệt tài liệu (✅ — `defaultReviewStatus` trả `'draft'` cho non-MANAGE nên `unit_admin` upload phải qua "Trình duyệt" như quy trình yêu cầu, xem điểm 3). Nhưng: nút upload tài liệu KHÔNG ràng buộc "chỉ đơn vị chủ trì của phiên đó" — bất kỳ `unit_admin` (đơn vị khác) truy cập được trang Detail của MỘT phiên (do phiên không có cơ chế ẩn theo đơn vị ở UI danh sách) đều thấy nút "Thêm tài liệu" cho phiên đó, dù không phải người chuẩn bị tài liệu chính danh của quy trình.

**(iii) Edge case còn hở:** (1) `unit_admin` sau khi TẠO phiên không tự SỬA lại được phiên đó qua UI Detail (nút Chỉnh sửa chỉ dành MANAGE) — nếu chairId/secretaryId chọn nhầm lúc tạo, phải nhờ MANAGE sửa hộ, không tự khắc phục được; (2) ràng buộc cùng đơn vị chỉ áp khi TẠO MỚI, khi SỬA (`initial` có giá trị) hoàn toàn không siết lại (comment tự nhận "ngoài phạm vi vá", đúng — vì SỬA vốn chỉ MANAGE mới thấy nút nên không phải lỗ hổng thực tế hiện tại, nhưng là giả định ẩn khác); (3) nút "Thêm tài liệu vào phiên họp" mở cho MỌI `unit_admin` bất kể đơn vị (không giới hạn theo đơn vị chủ trì phiên) — không sai HSMT (không có câu chữ giới hạn rõ) nhưng lỏng hơn thiết kế "quản trị đơn vị mình" nhất quán với việc tạo phiên.

**(iv) Phán quyết: ⚠️ ĐẠT CÓ KHUYẾN NGHỊ.** Lõi ràng buộc "cùng đơn vị" khi tạo phiên đã khớp chuẩn xác cả 3 lớp code (đây là phần khó nhất, đã ĐẠT thật). Khuyến nghị: (a) làm rõ với tổ chấm là nút Sửa/Xóa phiên vẫn giữ nguyên chỉ-MANAGE (chủ ý thiết kế, không phải thiếu); (b) xem lại có nên giới hạn nút "Thêm tài liệu" theo đơn vị chủ trì phiên để nhất quán logic.

---

## 3. THÀNH VIÊN DỰ HỌP DUYỆT TÀI LIỆU (HSMT dòng 356-358)

**(i) Luồng UI theo code:** Nút Duyệt/Từ chối nằm trong component DÙNG CHUNG `DocReviewControls` (`src/ui/pages/shared.tsx` dòng 193-236) — xuất hiện ở CẢ 2 nơi: tab "Tài liệu" trong Detail phiên (`MeetingDetailPage.tsx DocsTab`, khối "Tài liệu chờ duyệt" dòng 432-437 + mọi `DocRow` trong chương trình/tham khảo) VÀ trang "Tài liệu" độc lập (`DocumentsPage.tsx`). Đại biểu là thành phần phiên (`isMeetingMember` — chairId/secretaryId/participant khớp `meeting.id`) thấy nút "Duyệt"/"Từ chối" khi tài liệu ở `pending` (dòng 220-229), người trình (owner) thấy nút "Trình duyệt" khi `draft`/`rejected` (dòng 214-219).

**(ii) Đối chiếu câu chữ HSMT + có chặn tự duyệt, bắt buộc lý do, thông báo kết quả không:** `canApprove = (manage || isMeetingMember) && !isOwner` (shared.tsx dòng 205) — CHẶN tự duyệt tài liệu mình trình, đúng dù người trình CÓ là thành phần phiên (comment tự giải thích rõ lý do). Modal Từ chối bắt buộc lý do — nút "Từ chối tài liệu" `disabled={!note.trim()}` (dòng 244) VÀ service `rejectDocument()` (`documentService.ts` dòng 234-247) double-check `if (!note.trim()) throw` (dòng 237). Người trình được thông báo cả 2 kết quả: `approveDocument` gọi `notify([doc.ownerId], 'Tài liệu đã được duyệt', ...)` (dòng 227-230); `rejectDocument` gọi `notify([doc.ownerId], 'Tài liệu bị từ chối — yêu cầu làm lại', ...)` kèm lý do (dòng 242-246). Đối chiếu server Node `guardDocuments`/`canReviewDocumentAsMeetingMember` (`guard.js` dòng 293-360): khớp 100% — cùng điều kiện `!isOwner`, cùng bắt buộc `reviewNote` khi rejected (dòng 344), `reviewedById`/`reviewedAt` do server ép (không tin client).

**(iii) Edge case còn hở:** Đường thông báo (`notify()`) ở CẢ demo mode VÀ REST mode đều chạy qua CÙNG code path client-side (`documentService.ts` gọi `notify()` → `db.notifications.create()` → REST `POST /api/notifications`, ACL `create:'any'`) — KHÔNG có nhánh `db.action` riêng như `openVote`/`castBallot`. Nghĩa là 2 lệnh PATCH-document-rồi-POST-notification chạy KHÔNG ATOMIC ở REST mode: nếu client mất kết nối ngay sau khi PATCH document (duyệt) thành công nhưng TRƯỚC khi POST notification, tài liệu đã duyệt nhưng người trình KHÔNG nhận được thông báo (dữ liệu tài liệu vẫn đúng, chỉ mất phần thông báo — không phải mất dữ liệu nghiệp vụ, nhưng trải nghiệm "không được biết" có thể xảy ra dưới điều kiện mạng yếu, đúng loại rủi ro mà VHT-B02 trong `dungthu-so-khcn.md` đã từng ghi nhận cho API danh mục).

**(iv) Phán quyết: ✅ ĐẠT.** Đủ cả 4 câu hỏi orchestrator nêu, khớp chính xác giữa demo mode và cả 2 backend REST. Edge case về tính atomic của thông báo là rủi ro hạ tầng (mạng yếu), không phải lỗi logic nghiệp vụ.

---

## 4. PHIẾU KÍN

**(i) Luồng UI theo code:** Checkbox "Phiếu kín (ẩn danh người góp ý)" trong `PollCreateModal` (`PollsPage.tsx` dòng 390-393), có kèm ghi chú giải thích khi tick (dòng 394-398). Sau khi có người góp ý:
- **NGƯỜI TẠO (`isOwner`)** thấy đầy đủ danh tính mọi người trong "Tổng hợp ý kiến góp ý" (`canSeeIdentities = !p.secret || isOwner`, dòng 98) — đúng vai trò quản lý cần biết ai nói gì.
- **NGƯỜI GÓP Ý KHÁC (không phải owner)** thấy CHÍNH MÌNH bình thường, mọi người khác hiện "Đại biểu (ẩn danh — phiếu kín)" (`identityFor`, dòng 99-100).
- **ĐẠI BIỂU CHƯA GÓP Ý (không phải owner)** thấy CÙNG cách redact như trên (không có nhánh riêng — logic `identityFor` không phân biệt "đã góp ý hay chưa", chỉ phân biệt "là chính mình hay không, là owner hay không") — đúng nghĩa ẩn danh nhất quán.

**(ii) Đối chiếu HSMT/nghiệm thu:** Không có mục HSMT nào bắt buộc "phiếu kín" theo tên riêng, đây là tính năng bổ sung theo phản hồi tester (V3/P1-2). Đối chiếu điều kiện nghiệm thu: không liên quan trực tiếp 2 điều kiện bắt buộc của `dungthu-so-khcn.md` nhưng liên quan gián tiếp đến "cô lập dữ liệu/bảo mật" (tiêu chí 3.1 HSMT).

**Soi kỹ chỗ dễ hở nhất (đã rà toàn bộ PollsPage.tsx, ReportsPage.tsx, components.tsx):**
- `VoteResultBars`/`VoteOutcomePanel` (`src/ui/components.tsx` dòng 183-242) CHỈ render số liệu tổng (count/percent theo `optionId`), KHÔNG có danh sách tên theo lựa chọn — an toàn, không rò rỉ gián tiếp "ai chọn phương án nào".
- `ReportsPage.tsx` (PollStatsTab mới thêm hôm nay cho mục 48/53) chỉ dùng `v.ballots.length` (số lượng), không truy cập `b.userId` — an toàn, KHÔNG bị bỏ quên khi thêm tính năng thống kê mới (đây là rủi ro thực tế cần soi vì code mới thêm dễ quên áp lại rule redact).
- Badge "Đã ký số" tổng (`showSignedCount = !p.secret || isOwner`, dòng 107) VÀ badge ký số cạnh mỗi bình luận (`identityVisible = canSeeIdentities || b.userId===user?.id`, dòng 237) đều có điều kiện riêng, không lộ theo đường phụ.
- Server REST (`access.js` `projectVote` dòng 94-111, `Access.cs` `ProjectVote` dòng 133-166): với phiếu kín và người xem không phải manage/creator, server STRIP hẳn `userId`/`comment`/`signature` khỏi ballot của người khác TRƯỚC KHI GỬI VỀ CLIENT (chỉ giữ `optionId`/`castAt`) — chặt hơn demo mode (data về đã sạch, không dựa vào client tự redact).

**(iii) Trường hợp biên nghiệp vụ:** DEMO MODE (localStorage) không hề ẩn dữ liệu ở tầng lưu trữ — client PHẢI tự redact khi RENDER (đúng như comment code tự thừa nhận, dòng 93-97). Điều này có nghĩa: nếu người dùng demo-mode mở DevTools/Console và gõ `JSON.parse(localStorage.getItem('ecab.votes'))`, họ sẽ thấy TOÀN BỘ `userId` thật của mọi ballot dù phiếu là "kín" — vì redact chỉ xảy ra ở tầng UI, không phải ở tầng dữ liệu. Đây là rủi ro CHỈ tồn tại ở chế độ demo cục bộ (dữ liệu vốn nằm ngay trên máy người dùng, khác bản chất với REST mode có server phân tách rõ), nhưng CẦN nêu rõ với tổ chấm nếu họ dùng bản demo (không phải bản có server thật) để không hiểu nhầm "ẩn danh tuyệt đối" — vì đây chính xác là bản demo public đang dùng để nghiệm thu theo `dungthu-so-khcn.md`.

**(iv) Phán quyết: ⚠️ ĐẠT CÓ KHUYẾN NGHỊ.** Toàn bộ đường render UI đã redact đúng và nhất quán (đã rà kỹ, không tìm thấy điểm rò rỉ nào qua UI). Khuyến nghị bắt buộc phải nêu rõ với tổ chấm: bản demo (localStorage) KHÔNG ẩn dữ liệu ở tầng lưu trữ, chỉ ẩn ở tầng hiển thị — tính "kín" chỉ đảm bảo tuyệt đối ở chế độ máy chủ (REST) nơi server strip dữ liệu trước khi trả về.

---

## 5. KHÓA BIÊN BẢN SAU KÝ (điều kiện toàn vẹn pháp lý)

**(i) Luồng UI theo code:** Sau khi ký 1 chữ ký (chưa cần đủ 2): `hasAnySignature = (m.minutes?.signatures.length ?? 0) > 0` (`MeetingDetailPage.tsx` dòng 821) → nút "Lưu biên bản"/"Tạo lại dự thảo" biến mất hoàn toàn (điều kiện `chairCtl && !hasAnySignature`, dòng 962), textarea chuyển `readOnly` (dòng 959), thông điệp "Biên bản đã ký số — không thể chỉnh sửa" hiện ngay trên khung (dòng 953-956). Badge riêng "Đã ký số — khóa chỉnh sửa" chỉ hiện khi `m.minutes.locked` (đủ CẢ 2 chữ ký, dòng 937) — tức có 2 mức hiển thị: khóa-sửa-nội-dung (từ 1 chữ ký) và khóa-hoàn-toàn-badge (đủ 2 chữ ký).

**(ii) Đối chiếu điều kiện toàn vẹn pháp lý:** `saveMinutes()` (`meetingService.ts` dòng 500-508) — service tầng ứng dụng — chặn RÕ: `if ((m.minutes?.signatures.length ?? 0) > 0) throw new Error('Biên bản đã ký số — không thể chỉnh sửa...')`. Đây đúng là điều kiện chặt (bất kỳ 1 chữ ký cũng chặn), khắc phục đúng lỗ hổng cũ mà `dungthu-fixes.md` V4 mô tả (trước đây chỉ chặn theo `locked`, có thể ghi đè khi mới 1 chữ ký).

**Đường sửa gián tiếp — PHÁT HIỆN ĐỘC LẬP, kiểm chứng bằng đọc trực tiếp code, KHÔNG phải trích lại báo cáo khác:**
1. **Sửa kết luận KHÔNG ảnh hưởng biên bản đã sinh:** `updateConclusion`/`removeConclusion` (`meetingService.ts` dòng 305-332) chỉ thao tác trên `m.conclusions` — trường ĐỘC LẬP hoàn toàn với `m.minutes.content` (text tĩnh được snapshot 1 lần qua `buildMinutesDraft` rồi lưu qua `saveMinutes`). Nút "Sửa kết luận"/"Xóa kết luận" (`MeetingDetailPage.tsx` dòng 884-891) chỉ điều kiện `chairCtl`, KHÔNG có điều kiện `!hasAnySignature` — nghĩa là chủ trì/thư ký VẪN sửa/xóa được kết luận SAU KHI biên bản đã ký số. Về mặt hash/toàn vẹn ký số thì AN TOÀN (vì `minutes.content` không tự đổi theo, hash chữ ký vẫn khớp nội dung đã ký) — nhưng tạo ra **nghịch lý nghiệp vụ**: kết luận hiển thị trên tab "Kết luận của chủ tọa" có thể khác với nội dung mục "V. KẾT LUẬN CỦA CHỦ TỌA" đã đóng băng trong biên bản đã ký, KHÔNG có cảnh báo nào cho người dùng biết 2 nơi đang lệch nhau.
2. **Gap giữa demo-mode service và REST-mode guard cho field `minutes`:** Đọc `guardMeetings()` cả Node (`server/src/guard.js` dòng 477-487) và .NET (`Guard.cs` dòng 500-513) — server CHỈ chặn PATCH trực tiếp field `minutes` khi `existing.minutes?.locked === true` (đủ CẢ 2 chữ ký), KHÁC với ngưỡng chặt hơn `signatures.length > 0` (bất kỳ 1 chữ ký) mà demo-mode service `saveMinutes` dùng. Nghĩa là: nếu chỉ có 1 chữ ký (`locked=false`), MANAGE/chairman/secretary của phiên VẪN CÓ THỂ PATCH đè `minutes.content` trực tiếp qua REST API (ví dụ gọi thẳng API, không qua UI — vì UI đã ẩn nút/readOnly đúng). Đây là khoảng hở "defense-in-depth" 2 lớp KHÔNG khớp nhau 100% — không lộ ra qua thao tác UI thông thường (không phải điều tổ chấm gặp khi click demo) nhưng là rủi ro kỹ thuật thật nếu có ai gọi API trực tiếp.

**(iii)** Đã trình bày ở trên — 2 edge case: (1) sửa/xóa kết luận sau ký không đồng bộ ngược vào biên bản đã sinh, không cảnh báo lệch; (2) gap ngưỡng khóa `minutes` giữa demo service (1 chữ ký) và REST guard (2 chữ ký, đủ cả 2 vai).

**(iv) Phán quyết: ⚠️ ĐẠT CÓ KHUYẾN NGHỊ.** Đường UI chính (nút Lưu/Tạo lại dự thảo trên trang Detail) đã khóa đúng và chặt (từ 1 chữ ký) — đây là con đường 99% tổ chấm sẽ thao tác và sẽ thấy ĐÚNG. Nhưng có 2 đường phụ (sửa kết luận; PATCH REST trực tiếp field minutes khi mới 1 chữ ký) chưa được khóa đồng bộ ở cùng mức chặt — khuyến nghị nâng ngưỡng guard server từ `locked` lên `signatures.length>0` để khớp 100% với demo-mode service, và xem xét khóa luôn nút Sửa/Xóa kết luận khi `hasAnySignature=true` (hoặc cảnh báo rõ khi sửa kết luận sau khi biên bản đã có chữ ký).

---

## 6. THỂ THỨC BIÊN BẢN NĐ 30/2020

**(i)/(ii) Đọc hàm sinh dự thảo (`buildMinutesDraft`, `meetingService.ts` dòng 402-491) + template in (`MeetingDetailPage.tsx` khối `print-root`/`print-sig` dòng 1002-1037, CSS `src/styles.css` dòng 580-589) — liệt kê theo bảng chuyên viên Sở:**

| Yếu tố thể thức NĐ 30/2020 | Biên bản MỚI sinh (code hiện tại) | Bằng chứng dòng code |
|---|---|---|
| Quốc hiệu, tiêu ngữ | **CÓ** | `meetingService.ts` dòng 435-436: `'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'`, `'Độc lập - Tự do - Hạnh phúc'` |
| Tên cơ quan ban hành | **CÓ** | dòng 414, 440: `orgName` tra theo đơn vị của chủ tọa (`chairUnit?.name`), in hoa |
| Số, ký hiệu văn bản | **CÓ** | dòng 417, 442: `documentNumber` = "Số: N/BB-{ký hiệu}", cấp thật qua `ensureMinutesNumber`/`nextMinutesNumber` (dòng 358-389, đếm theo năm, không trùng) |
| Địa danh, ngày ban hành | **CÓ** | dòng 418, 441: `${location}, ngày dd tháng mm năm yyyy` |
| Tên loại văn bản + trích yếu | **CÓ** | dòng 445-447: `'BIÊN BẢN'` + tên phiên họp + mã phiên |
| Nội dung văn bản | **CÓ, đầy đủ** | mục I-V (dòng 452-483): thành phần, chương trình, diễn biến, kết quả biểu quyết, kết luận chủ tọa |
| Khối chữ ký đúng vị trí | **CÓ** | `MeetingDetailPage.tsx` dòng 1016-1035: 2 cột "THƯ KÝ"/"CHỦ TỌA" LUÔN hiện diện (chưa ký: "(Ký, ghi rõ họ tên)" + họ tên tra từ `secretaryId`/`chairId`; đã ký: "(Đã ký số)" + thời điểm), CSS `.print-sig` (styles.css dòng 588-589) canh 2 cột `space-between` đúng cuối văn bản. Nhãn "CHỦ TỌA" khớp đúng mục "V. KẾT LUẬN CỦA CHỦ TỌA" trong nội dung (không lệch "Chủ trì"/"Chủ tọa") |
| Nơi nhận | **CÓ** | dòng 486-488: `'Nơi nhận:'` + danh sách `recipients` (mặc định "Như thành phần dự họp") + `'Lưu: VT, {ký hiệu}.'` |

**Kết luận đối chiếu:** biên bản MỚI SINH (từ nút "Tạo dự thảo từ dữ liệu phiên họp") có đủ CẢ 9 yếu tố — khắc phục đúng và đủ nhận định của chuyên viên Sở trong `dungthu-so-khcn.md` mục 3(a) (từng ghi "KHÔNG" cho 4/9 yếu tố dựa trên bản demo public cũ chưa sync code này).

**Chi tiết nhỏ (không phải lỗi chức năng):** CSS định nghĩa sẵn class `.quochieu`/`.tieungu` (in đậm/gạch chân riêng, `styles.css` dòng 585-586) nhưng nội dung `buildMinutesDraft` trả về PLAIN TEXT render qua `<pre>{m.minutes.content}</pre>` (dòng 1007) — không có element nào gán 2 class này, nên khi in, quốc hiệu/tiêu ngữ hiện ĐÚNG NỘI DUNG nhưng KHÔNG có định dạng đậm/gạch chân riêng biệt (chỉ đúng font chữ chung `Times New Roman`). Không ảnh hưởng "có/thiếu yếu tố" (nội dung vẫn đầy đủ) chỉ ảnh hưởng phần trình bày thẩm mỹ thể thức.

**Biên bản mẫu CŨ trong seed sẽ hiển thị thế nào (đọc trực tiếp `src/data/seed.ts` dòng 240-248, phiên `m4`, `locked: true`):** `content` là TEXT TĨNH hard-code sẵn từ trước (`'BIÊN BẢN PHIÊN HỌP THƯỜNG KỲ UBND TỈNH THÁNG 6/2026\n\nThời gian:...'`) — xác nhận KHÔNG chứa quốc hiệu/tiêu ngữ/tên cơ quan riêng/số-ký hiệu/nơi nhận (đúng khớp 100% với quan sát của Hà — chuyên viên Sở trong `dungthu-so-khcn.md` mục 3(a), đây KHÔNG phải lỗi chưa vá mà là dữ liệu mẫu cũ chủ ý KHÔNG được sửa ngược để tránh phá vỡ hash SHA-256 gắn với `content` gốc đã ký — `signatures[].hash` của m4 được tính trên đúng `content` này). Riêng khối CHỮ KÝ (view riêng, độc lập với `content`, dựa vào field `signatures`/`chairId`/`secretaryId`) VẪN hiển thị đúng "CHỦ TỌA"/"THƯ KÝ" đã ký cho m4 vì code view áp dụng chung cho MỌI meeting.

**(iii) Trường hợp biên:** Khi demo cho tổ chấm, nếu mở biên bản m4 (phiên "tháng 6/2026" — mẫu có sẵn duy nhất đã ký trong seed) sẽ THẤY phần NỘI DUNG thiếu thể thức (đúng như phát hiện gốc), NHƯNG khối CHỮ KÝ bên dưới lại đã đúng chuẩn mới — tạo ấn tượng "nửa vá nửa chưa" nếu tổ chấm không được giải thích trước. Đây chính xác là **nguy cơ gây hiểu nhầm khi demo** mà orchestrator hỏi.

**(iv) Phán quyết: ⚠️ ĐẠT CÓ KHUYẾN NGHỊ.** Hàm sinh MỚI (`buildMinutesDraft`) đã đủ cả 9/9 yếu tố thể thức bắt buộc — đây là điều kiện bắt buộc số 1 của `dungthu-so-khcn.md` ĐÃ được khắc phục ở tầng code cho biên bản SINH MỚI. Nhưng biên bản mẫu CŨ duy nhất có sẵn trong seed (m4, phiên hay được dùng để demo vì có đủ dữ liệu điểm danh/biểu quyết/kết luận) vẫn thiếu thể thức ở phần nội dung — **khuyến nghị bắt buộc trước khi demo chính thức:** hoặc (a) tạo THÊM 1 phiên mẫu mới đã kết thúc, bấm "Tạo dự thảo từ dữ liệu phiên họp" thật để có biên bản mẫu ĐỦ thể thức (không đụng m4 cũ, giữ nguyên tính pháp lý của nó), hoặc (b) khi demo m4 phải giải thích rõ trước với tổ chấm "đây là biên bản mẫu tạo trước khi vá thể thức, biên bản mới tạo từ nay sẽ đủ" để tránh bị hiểu nhầm là lỗi chưa khắc phục.

---

## BẢNG PHÁN QUYẾT TỔNG

| # | Điểm vá | Phán quyết | Lý do chính |
|---|---|---|---|
| 1 | Sửa phiếu nháp (mục 13) | ✅ ĐẠT | Đủ 8/8 trường nội dung, 3 lớp code (demo + Node REST + .NET REST) khớp nhau, chặn đúng quyền/trạng thái |
| 2 | Quản trị đơn vị tạo phiên họp | ⚠️ ĐẠT CÓ KHUYẾN NGHỊ | Ràng buộc cùng đơn vị khớp chuẩn 3 lớp code khi TẠO; nhưng SỬA/XÓA phiên vẫn chỉ MANAGE, nút Thêm-tài-liệu chưa giới hạn theo đơn vị chủ trì |
| 3 | Thành viên dự họp duyệt tài liệu | ✅ ĐẠT | Chặn tự duyệt, bắt buộc lý do từ chối, thông báo cả 2 chiều — khớp demo mode và cả 2 backend REST |
| 4 | Phiếu kín | ⚠️ ĐẠT CÓ KHUYẾN NGHỊ | UI redact đúng và nhất quán mọi nơi (đã rà kỹ, không rò rỉ qua UI); nhưng demo-mode (localStorage) không ẩn ở tầng lưu trữ — cần nói rõ với tổ chấm |
| 5 | Khóa biên bản sau ký | ⚠️ ĐẠT CÓ KHUYẾN NGHỊ | Đường UI chính (Lưu/Tạo lại dự thảo) khóa đúng từ 1 chữ ký; nhưng sửa kết luận không đồng bộ, và guard REST chỉ khóa field `minutes` ở ngưỡng `locked` (2 chữ ký) — lỏng hơn demo service |
| 6 | Thể thức biên bản NĐ 30/2020 | ⚠️ ĐẠT CÓ KHUYẾN NGHỊ | Hàm sinh MỚI đủ 9/9 yếu tố; biên bản mẫu CŨ duy nhất trong seed (m4) vẫn thiếu — dễ gây hiểu nhầm nếu demo nhầm mẫu cũ mà không giải thích trước |

**Tổng: 2/6 ✅ ĐẠT tuyệt đối · 4/6 ⚠️ ĐẠT CÓ KHUYẾN NGHỊ · 0/6 ❌ CHƯA.**
