# BÁO CÁO RÀ SOÁT NGHIỆP VỤ + NỘI DUNG — eCabinet (đợt hoàn thiện sáng 18/07)

**Người thực hiện:** Minh — Business Analyst, HPT TECH
**Ngày:** 2026-07-18
**Bối cảnh:** Gói mục tiêu ban đầu (Sở KH&CN Hải Phòng, IB2600235546) đã trúng thầu bởi Tân Dân. Định hướng hiện tại: hoàn thiện eCabinet để dự thầu các gói "họp không giấy" tỉnh/thành khác. HSMT Hải Phòng (`docs/hsmt-chuong-v.md`) dùng làm khung yêu cầu tham chiếu.
**Phương pháp:** Đọc mã nguồn (`src/services/`, `src/ui/pages/`, `src/domain/`) + đối chiếu `docs/hsmt-chuong-v.md` + tham khảo 3 báo cáo hội đồng rà soát đêm 17→18/07 (`tester-qa.md`, `dev-backend.md`) để tránh trùng lặp phát hiện đã ghi nhận. KHÔNG sửa file, KHÔNG chạy server, KHÔNG dùng browser.

---

## 1. RÀ NGHIỆP VỤ TÍNH NĂNG MỚI ĐÊM QUA

### 1(a). Phiếu lấy ý kiến NHÁP (`src/services/voteService.ts`, `src/ui/pages/PollsPage.tsx`)

**Luồng hiện có:** `createVote(..., saveAsDraft: true)` → status `'draft'` → chỉ có 1 hành động khả dụng: **"Gửi lấy ý kiến"** (`openVote`, chuyển draft→open, thông báo toàn bộ `eligibleIds`). Sau khi gửi, **không thể quay lại draft**.

| Câu hỏi | Trả lời (đã đọc code xác nhận) |
|---|---|
| Sửa nội dung phiếu nháp được không? | **KHÔNG.** `voteService.ts` không có hàm `updateVote`/`editDraft`. `PollCard` (PollsPage.tsx dòng 134-138) chỉ hiện đúng 1 nút khi `isDraft`: "Gửi lấy ý kiến". Không có nút "Sửa". Tạo xong nháp là **cứng** — muốn đổi tiêu đề/phương án/hạn/danh sách gửi phải xóa và tạo lại. |
| Xóa phiếu nháp được không? | **KHÔNG.** Không có hàm `removeVote` nào được export/dùng cho `kind='poll'`. Không có nút xóa trên `PollCard` ở bất kỳ trạng thái nào (draft/open/closed). |
| Luồng nháp→gửi→đóng đủ chưa? | Đủ 3 trạng thái nối tiếp (`draft → open → closed`), nhưng thiếu vòng "sửa trước khi gửi" — với gói thầu HSMT có 500 user, việc thư ký lỡ tay tạo nháp sai tiêu đề/phương án trả lời không có đường lùi ngoài tạo phiếu mới (rác dữ liệu, gây nhiễu tab "Chưa gửi"). |
| Ai thấy phiếu nháp? | `PollsPage.tsx` dòng 24-33: filter `'all'` **ẩn draft với non-manage** (`!can.manageMeetings(user)` → loại draft khỏi "Tất cả"); tab riêng "Chưa gửi" (`filter==='draft'`) **chỉ hiện cho `can.manageMeetings(user)`** (admin/chairman/secretary) — đúng ý định thiết kế "chỉ quản lý xem nháp". Nhưng đây là **mọi quản lý** (admin+chairman+secretary), không riêng người tạo — một thư ký B có thể thấy & "Gửi" nháp do thư ký A tạo (không có ownership check ở `openVote`). Không phải lỗ hổng an ninh (đều thuộc nhóm quản lý được tin cậy) nhưng là điểm cần BA xác nhận có đúng ý định "chỉ người tạo thấy" hay "cả nhóm quản lý cùng thấy" — hiện tại code chọn phương án sau.

**Đối chiếu HSMT mục 13** ("DS văn bản CHƯA lấy ý kiến... sửa nội dung văn bản chưa lấy ý kiến") — dòng 409: *"Sửa nội dung văn bản chưa lấy ý kiến"* là yêu cầu **rõ ràng, có trong bảng chức năng chính thức**. Code hiện tại **KHÔNG đáp ứng** yêu cầu "sửa" này — chỉ đáp ứng "xem danh sách/tra cứu". Đây là **gap chức năng thật với HSMT**, mức trung bình (không chặn demo nhưng lộ khi tổ chấm đối chiếu bảng chức năng dòng 409 cụ thể).

### 1(b). Ký số ý kiến — hủy được không, có cần không?

**Đối chiếu HSMT dòng 367-374** (quy trình lấy ý kiến bằng văn bản): 4 bước — (1) Thư ký thêm văn bản, (2) Thư ký cập nhật cán bộ theo dõi/hạn/đính kèm, (3) **Chủ trì/Thành viên dự họp cho ý kiến, có thể ký số, gửi thư ký tổng hợp**, (4) Thư ký tổng hợp/thống kê. HSMT **không nhắc "hủy ý kiến đã ký"** ở bất kỳ đâu trong quy trình 4 bước này — nghĩa là **HSMT không yêu cầu tính năng hủy**.

Đọc `voteService.castBallotSigned` (dòng 114-134): sau khi ký, ballot được append vào `v.ballots` — không có hàm `revokeBallot`/`cancelBallot`. `PollCard` (PollsPage.tsx dòng 181-186) chỉ hiển thị "Bạn đã cho ý kiến: ..." (read-only), không có nút sửa/hủy. `castBallot`/`castBallotSigned` đều check `v.ballots.some(b => b.userId === actor.id)` → throw nếu đã bỏ phiếu — chặn gửi lại.

**Kết luận:** Không cho hủy ý kiến đã ký là **ĐÚNG THIẾT KẾ, khớp HSMT** (chữ ký số về bản chất pháp lý là bất biến — cho hủy tùy ý sẽ làm mất ý nghĩa "ký số"). Không cần bổ sung tính năng hủy. Điểm cần lưu ý duy nhất: **không có tính năng "sửa ý kiến TRƯỚC KHI ký"** — nếu người dùng chọn sai phương án rồi bấm "Ký số & gửi" ngay (không có bước xác nhận lại nội dung trong `PollSignModal`, chỉ hỏi PIN), họ bị kẹt vĩnh viễn với ý kiến sai. Đề xuất mức nhẹ: `PollSignModal` nên hiển thị lại phương án + nội dung góp ý đã chọn trước khi hỏi PIN (hiện tại modal chỉ có ô nhập PIN, không nhắc lại lựa chọn — rủi ro ký nhầm mà không biết).

### 1(c). Module Phản hồi (`feedbackService.ts`, `SupportPage.tsx`, `SupportAdminPage.tsx`)

**Vòng đời hiện có:** `FeedbackStatus = 'new' | 'processing' | 'resolved'` (`domain/types.ts` dòng 474) — đúng 3 trạng thái, khớp `FEEDBACK_STATUS` label (`domain/labels.ts` dòng 60-64) và UI filter (`SupportAdminPage.tsx` dòng 13).

| Câu hỏi | Trả lời |
|---|---|
| Thiếu trạng thái từ chối/đóng? | **Có thiếu, nhưng hợp lý ở mức độ chấp nhận được cho bản demo.** HSMT tiêu chí 5.2 chỉ yêu cầu "phương thức ghi nhận ý kiến... lưu trữ đầy đủ nội dung phản hồi để phục vụ tổng hợp, đánh giá" — không quy định cụ thể tập trạng thái. `'resolved'` (Đã trả lời) đóng vai trò "đóng" tự nhiên. Không có trạng thái riêng cho case "không xử lý được / không hợp lệ / trùng lặp" — quản trị buộc phải gắn nhãn `'resolved'` kèm response giải thích dù bản chất là "từ chối xử lý", hơi gượng nhưng không sai HSMT. Đề xuất P2 (không cấp bách hôm nay): có thể thêm `'rejected'` sau nếu khối lượng phản hồi thật lớn, không phải yêu cầu bắt buộc từ HSMT. |
| Người gửi tự sửa/xóa phản hồi của mình được không? | **KHÔNG có, và ĐÚNG nên giữ như vậy.** `SupportPage.tsx` (trang người dùng) chỉ có form gửi mới + danh sách "Phản hồi của tôi" **read-only** (dòng 84-105) — không có icon sửa/xóa trên từng dòng. `feedbackService.ts` không export hàm `updateOwnFeedback`/`removeFeedback` cho non-admin. Việc này hợp lý về nghiệp vụ: phản hồi/góp ý một khi gửi đi cần giữ nguyên để bộ phận hỗ trợ xử lý đúng nội dung ban đầu — cho sửa/xóa tùy ý sau khi gửi sẽ phá vỡ tính minh bạch của log phản hồi (tương tự lý do không cho hủy ballot đã ký ở mục 1b). Không cần bổ sung. |
| Quyền xử lý (đổi trạng thái/trả lời) | `updateFeedback` (feedbackService.ts dòng 44-68): chỉ `admin` (toàn hệ thống) hoặc `unit_admin` (giới hạn `unitId` của mình, có check `target.unitId !== actor.unitId` → throw). Đã khớp đúng theo báo cáo `dev-backend.md`/`tester-qa.md` P1-1 (BE Node/.NET đồng bộ "chỉ admin", **FE đã sửa để khớp "chỉ admin/unit_admin"** — không còn cho chairman/secretary như phiên bản trước đó tester ghi nhận). Đây là **tin tốt: lệch đặc tả P1-1 mà tester ghi nhận đêm qua ĐÃ ĐƯỢC ĐỒNG BỘ ở phía FE** (so với snapshot code lúc tester viết báo cáo, `feedbackService.ts` hiện tại dòng 47 đã đổi thành `actor.role !== 'admin' && actor.role !== 'unit_admin'`, không còn dùng `can.manageMeetings`). Cần xác nhận BE (`guard.js`/`Guard.cs`) đã đồng bộ y hệt "admin HOẶC unit_admin cùng đơn vị" — nằm ngoài phạm vi đọc của BA (thuộc rà soát backend), nên khuyến nghị Tech Lead double-check 1 lần trước khi coi P1-1 đã đóng. |

### 1(d). Duyệt tài liệu bởi thành viên phiên (`documentService.ts`, `shared.tsx`)

**Đối chiếu HSMT dòng 354-358:** *"Quản trị đơn vị chuẩn bị tài liệu họp và trình duyệt. **Thành viên dự họp thực hiện duyệt**"* — vai trò duyệt đúng ý HSMT là "Thành viên dự họp" (tức participant của phiên, bao gồm cả role `delegate`), KHÔNG phải chỉ "Quản lý" (chairman/secretary/admin).

| Câu hỏi | Trả lời |
|---|---|
| Người TRÌNH có bị tự duyệt không? | **CÓ CHẶN, đúng thiết kế.** `documentService.approveDocument`/`rejectDocument` chỉ check `can.manageMeetings(reviewer)` — KHÔNG có check `!isOwner` ở tầng service này, NHƯNG backend (`guard.js`/`Guard.cs`, theo `dev-backend.md` mục 3 "Lỗi tự phát hiện") đã thêm `&& !isOwner` vào `allowedApprover` sau khi phát hiện lỗ hổng "owner tự duyệt qua cùng phiên". Ở chế độ demo (localStorage, không guard), một chairman/secretary/admin VẪN tự duyệt được tài liệu do chính họ tạo (vì `defaultReviewStatus` đặt `'approved'` luôn cho manage — họ hiếm khi cần tự duyệt qua `pending`, nhưng về lý thuyết nếu 1 delegate được domain gán quyền `manage` tạo tài liệu `draft` rồi tự trình rồi tự duyệt ở demo mode sẽ KHÔNG bị chặn ở tầng FE-only). Rủi ro thấp ở demo hiện tại vì owner luôn được set `approved` ngay khi manage tạo (dòng `defaultReviewStatus`), nhưng cần lưu ý nếu mở rộng seed. |
| **GAP MỚI PHÁT HIỆN — nút Duyệt/Từ chối trên UI chỉ hiện cho MANAGE, không hiện cho "Thành viên dự họp" (delegate).** | **Xác nhận bằng đọc code, đây là phát hiện MỚI chưa có trong `tester-qa.md`/`dev-backend.md`.** `DocReviewControls` (`src/ui/pages/shared.tsx` dòng 184-220) dùng đúng 1 biến `manage = can.manageMeetings(user)` để quyết định hiện nút "Duyệt"/"Từ chối" (dòng 199: `{manage && st === 'pending' && (...)}`). Toàn bộ `src/` (grep xác nhận) **không có bất kỳ hàm `isMeetingMember` nào ở frontend** — khái niệm này chỉ tồn tại ở backend (`server/src/guard.js` hàm `canReviewDocumentAsMeetingMember`, theo `dev-backend.md` mục 3 P0-3). Backend ĐÃ mở quyền duyệt cho participant thường (delegate) của phiên chứa tài liệu (đúng ý HSMT "Thành viên dự họp thực hiện duyệt"), nhưng **frontend chưa cập nhật điều kiện hiện nút** — một đại biểu (role `delegate`, tham gia đúng phiên có tài liệu `pending`) đăng nhập, mở tab Tài liệu, sẽ **KHÔNG THẤY nút Duyệt/Từ chối nào cả** dù họ đúng là người HSMT muốn họ làm việc này và dù gọi API trực tiếp sẽ thành công (ở chế độ REST). Tính năng "vô hình" đúng với chính đối tượng phải dùng nó → cần sửa `shared.tsx` để thêm điều kiện `isMeetingMember` (participant/chairId/secretaryId của phiên chứa `doc.meetingId`) tương đương backend. **Đây là vấn đề P1 thật, ảnh hưởng trực tiếp đến việc demo/nghiệm thu đúng vai trò "Thành viên dự họp" theo đúng câu chữ HSMT dòng 358.** |
| Luồng TỪ CHỐI có bắt buộc nhập lý do? | **CÓ, bắt buộc đúng.** `RejectModal` (`shared.tsx` dòng 220-233): nút submit `disabled={!note.trim()}` — không nhập lý do thì không bấm được "Từ chối tài liệu". `documentService.rejectDocument` (dòng 217-230) cũng có double-check ở tầng service: `if (!note.trim()) throw new Error('Vui lòng nhập lý do từ chối để đơn vị làm lại')`. Defense-in-depth đúng chuẩn (giống pattern PIN 6 số ký số). Khớp đúng nghiệp vụ "Nếu tài liệu không đủ thông tin thì Thành viên dự họp yêu cầu quản trị đơn vị làm lại" (HSMT dòng 357-358) — lý do từ chối chính là nội dung "yêu cầu làm lại" cần truyền đạt. |

### 1(e). Danh mục loại tài liệu — tài liệu cũ không có docTypeId

Đọc `useDocTypeLabel` (`shared.tsx` dòng 14-18): `if (!docTypeId) return undefined` — hàm trả `undefined` an toàn, không throw, không crash. `DocRow` (dòng 142, 151): `{docTypeLabel && <Badge color="gray">{docTypeLabel}</Badge>}` — badge chỉ render khi có label, tài liệu cũ (không có `docTypeId`, hoặc `docTypeId` không khớp catalog nào) **đơn giản là không hiện badge "Loại tài liệu"**, không có ô trống/lỗi hiển thị, không có text "Chưa phân loại" hiện trên danh sách (chỉ hiện "— Chưa phân loại —" trong dropdown lúc CHỌN, không phải lúc XEM).

**Kết luận:** Xử lý tương thích ngược ĐÚNG VÀ AN TOÀN — không cần giá trị mặc định bắt buộc cho `docTypeId` (theo đúng comment tự khai trong `documentService.ts` dòng 46: "OPTIONAL"). Không có bug ở đây. Về UX, có thể cân nhắc thêm (không cấp bách): hiện badge xám nhạt "Chưa phân loại" khi xem danh sách tài liệu (thay vì im lặng không hiện gì) để cán bộ nghiệm thu dễ nhận biết field này ĐANG hoạt động (áp dụng cho tài liệu MỚI không chọn loại) — nhưng đây là "nice-to-have" không phải lỗi.

### 1(f). Thống kê ý kiến văn bản — khớp HSMT mục 48/53?

Đọc `voteService.pollStatsInRange`/`pollStatsByMonth` (dòng 277-343) + `ReportsPage.tsx` `PollStatsTab` (dòng 224-362).

| Yêu cầu HSMT mục 47/48/53 | Đối chiếu code |
|---|---|
| Mục 47 "Xem số người đã cho ý kiến, chưa có ý kiến" | `PollStatRow.responded`/`notResponded` (dòng 289-290) — tính đúng: `responded = v.ballots.length`, `notResponded = max(0, total - responded)`. ✅ Khớp. |
| Mục 48 "Xem thống kê theo lượt cho ý kiến, lựa chọn" | `optionBreakdown` (dòng 293, dùng `voteResults(v)`) — phân bố theo TỪNG phương án trả lời (Nhất trí / Không nhất trí / ...), hiển thị Donut ở `PollStatsTab` dòng 350-357. ✅ Khớp đúng "theo lựa chọn". |
| Mục 48 "Xuất thống kê ý kiến văn bản" | `exportSummaryCsv` (ReportsPage.tsx dòng 250-265) — xuất đủ 7 cột đúng tên tiếng Việt: Văn bản/Ngày tạo/Trạng thái/Số người được xin ý kiến/Đã cho ý kiến/Chưa cho ý kiến/Tỷ lệ. ✅ |
| Mục 53 "Chọn thời gian thống kê theo văn bản xin ý kiến" | `from`/`to` date picker (dòng 269-282), lọc theo `v.createdAt` (thời điểm TẠO phiếu, không phải deadline — có ghi rõ dòng 278: "được TẠO trong khoảng thời gian đã chọn"). ✅ Có bộ lọc thời gian tùy chỉnh, khớp mục 52 cùng logic (đã bỏ khung cố định 6 tháng). |
| Mục 53 "Xem chi tiết kết quả... theo biểu đồ" | `BarChart` theo tháng (dòng 293-294, dùng `pollStatsByMonth`) + `Donut` tổng hợp đã/chưa cho ý kiến (dòng 296-302) + `Donut` phân bố phương án cho văn bản được chọn (dòng 339-358). ✅ Đủ 3 loại biểu đồ. |
| **Số liệu tổng hợp có khớp định nghĩa "đã/chưa cho ý kiến"?** | **Khớp — đã kiểm công thức kỹ.** `totals.avgResponseRate = round(totalResponded/totalEligible*100)` — mẫu số ĐÚNG là tổng `eligibleIds` (người ĐƯỢC xin ý kiến), không lẫn với tổng user hệ thống. Không phát hiện lỗi số học. |

**Kết luận mục 1(f): Thống kê ý kiến văn bản ĐẠT, khớp đúng định nghĩa HSMT mục 48/53 (và mobile 92/97 dùng chung hàm thuần).** Đây khớp với ghi nhận của `tester-qa.md` mục 6.1 rằng website đang gỡ nhãn "đang hoàn thiện" cho mục #48/#53 là hợp lý — xác nhận LẠI độc lập bằng đọc code chi tiết công thức (không chỉ tin theo báo cáo trước).

---

## 2. RÀ NỘI DUNG TIẾNG VIỆT — NHÃN/THÔNG ĐIỆP

Đã đọc `src/domain/labels.ts` toàn văn + grep có hệ thống các trang `src/ui/pages/*.tsx` liên quan tính năng mới, đối chiếu tần suất dùng từ trong `docs/hsmt-chuong-v.md` (đếm bằng script, không suy diễn).

**Số liệu tần suất thuật ngữ (đếm occurrence, không đếm dòng):**

| Thuật ngữ | HSMT gốc | App (`src/ui/pages` + `labels.ts`) |
|---|---|---|
| "cuộc họp" | 137 lần | 4 lần |
| "phiên họp" | 10 lần | 72 lần |
| "đại biểu" | 9 lần | 29 lần |
| "thành viên dự họp" | 0 lần (chỉ dùng trong bảng vai trò, không dùng lại trong mô tả chi tiết) | 0 lần |
| "lấy ý kiến" | 27 lần | 18 lần |
| "xin ý kiến" | 12 lần | 17 lần |

### Bảng lỗi/không nhất quán cụ thể

| # | File : dòng | Chuỗi hiện tại | Vấn đề | Đề xuất |
|---|---|---|---|---|
| 1 | `src/ui/pages/CalendarPage.tsx:107` | "Không có cuộc họp trong tháng này" | **Không nhất quán nội tại** — toàn bộ menu/tiêu đề trang khác (MainLayout, MeetingsPage, MeetingDetailPage...) đều gọi "**phiên họp**" (72 lần), riêng dòng này lẻ loi dùng "cuộc họp". Cán bộ dùng app sẽ thấy 2 từ cho cùng 1 khái niệm ở 2 màn hình cạnh nhau (Lịch vs Danh sách phiên họp). | Đổi thành "Không có phiên họp trong tháng này" — khớp thuật ngữ chuẩn của app. |
| 2 | `src/ui/pages/LoginPage.tsx:152` | "Toàn bộ vòng đời **cuộc họp** trên một nền tảng..." | Cùng vấn đề #1 — trang đăng nhập là điểm chạm ĐẦU TIÊN của tổ chấm, dùng từ khác với menu ngay sau khi đăng nhập gây cảm giác thiếu chỉn chu. | Đổi "cuộc họp" → "phiên họp". |
| 3 | `src/ui/pages/admin/ApiAdminPage.tsx:33,319` | "chia sẻ dữ liệu **cuộc họp**..." (x2) | Cùng vấn đề #1, ở trang Quản trị API (đối tượng đọc là kỹ thuật/tích hợp — vẫn nên nhất quán). | Đổi "cuộc họp" → "phiên họp" ở cả 2 vị trí. |
| 4 | `src/ui/pages/PollsPage.tsx` (nhiều dòng: 2,39,80,257,281) và `src/ui/pages/admin/ReportsPage.tsx` (nhiều dòng: 5,22,220,254,278,285,286,293,309,315,316) | Trộn lẫn "**lấy ý kiến**" (tên trang, nút "Gửi phiếu lấy ý kiến") và "**xin ý kiến**" (tiêu đề cột CSV "Văn bản xin ý kiến", StatCard "Số văn bản xin ý kiến", comment code) cho **CÙNG MỘT khái niệm** (`Vote.kind='poll'`). | Cả hai từ ĐỀU có trong HSMT (không sai chính tả), nhưng dùng lẫn trong CÙNG một module tạo cảm giác thiếu nhất quán khi đọc báo cáo CSV cạnh giao diện tạo phiếu — ví dụ nút bấm nói "Lấy ý kiến" nhưng cột xuất báo cáo lại nói "Xin ý kiến". | Chọn 1 từ chuẩn cho toàn bộ luồng UI-facing: khuyến nghị **"lấy ý kiến"** (đã là tên trang + nút hành động chính, đổi ít chỗ hơn — chỉ cần sửa các nhãn StatCard/cột CSV trong `ReportsPage.tsx`, khoảng 8-10 chuỗi, không đụng logic). Giữ nguyên comment code (không phải nhãn UI, không ảnh hưởng người dùng cuối). |
| 5 | `src/domain/labels.ts:15` (comment) | "Nhãn loại đơn vị hành chính (bối cảnh xã/phường/đặc khu **TP Hải Phòng**)" | Comment code (không hiển thị cho user) nhưng là dấu hiệu hard-code tư duy "chỉ Hải Phòng" còn sót trong codebase — nên tổng quát hóa khi review code cho khách tỉnh khác (không phải nhãn UI nên không tính vào "lỗi nhãn" nhưng liệt ở đây để nhất quán với mục 3). | Đổi comment thành "bối cảnh xã/phường/đặc khu (mô hình sau sáp nhập hành chính)" — bỏ tên tỉnh cụ thể. |
| 6 | `src/ui/pages/PollsPage.tsx:151` | Nút "**Kết thúc**" (đóng phiếu lấy ý kiến vĩnh viễn, `btn danger`, KHÔNG có `window.confirm`) | **Nhãn mơ hồ + thiếu xác nhận cho hành động không thể hoàn tác.** So sánh: "Xóa phiên họp"/"Xóa kết luận" (MeetingDetailPage) đều có `window.confirm`; "Đóng biểu quyết" (MeetingDetailPage:634) và "Kết thúc" (đóng phiếu lấy ý kiến) đều KHÔNG có, dù cùng mức nghiêm trọng (đóng vĩnh viễn, ẩn nút phản hồi cho toàn bộ thành viên). Cán bộ xã/phường bấm nhầm 1 lần là mất khả năng nhận thêm ý kiến — không có "hối lại". | (a) Đổi nhãn "Kết thúc" → "Kết thúc lấy ý kiến" (rõ đối tượng, tránh mơ hồ với "Kết thúc phiên họp"/"Kết thúc chất vấn" ở màn hình khác). (b) Thêm `window.confirm('Kết thúc lấy ý kiến "{tên phiếu}"? Sau khi kết thúc sẽ không nhận thêm ý kiến.')` trước khi gọi `closeVote`. Áp dụng tương tự cho "Đóng biểu quyết" (MeetingDetailPage:634). |
| 7 | `src/ui/pages/PollsPage.tsx` `PollSignModal` (dòng 223-240) | Modal ký số chỉ có ô nhập PIN, KHÔNG nhắc lại phương án/nội dung đã chọn trước khi ký | Không phải lỗi chính tả nhưng là thông điệp thiếu thông tin — cán bộ xã/phường có thể quên đã chọn phương án nào trước khi bấm "Ký số & gửi ý kiến", modal không nhắc lại để xác nhận lần cuối (khác với việc chỉ hỏi PIN). | Thêm 1 dòng trong modal: "Bạn đang ký ý kiến: **{nhãn phương án đã chọn}**" trước ô nhập PIN — giảm rủi ro ký nhầm (nhất quán với việc `RejectModal` bắt buộc xem trước lý do). |
| 8 | `src/domain/labels.ts:71` | `hotline: { ..., value: '1900 xxxx' }` | Placeholder chưa điền số thật hiển thị trực tiếp trên `SupportPage.tsx` (trang Hỗ trợ, mọi user thấy) — "xxxx" trông như lỗi hiển thị hơn là placeholder có chủ đích với người dùng không biết ngữ cảnh demo. | Không cấp bách sửa hôm nay (đúng bản chất placeholder chờ điền số thật khi ký hợp đồng), nhưng nếu muốn demo thuyết phục hơn, đổi tạm thành số demo hợp lệ dạng "1900 xxxx (đang cập nhật)" hoặc ẩn dòng này khi chưa có số thật — tránh cảm giác "chưa hoàn thiện" khi tổ chấm nhìn thấy "xxxx" trần trụi. |

**Không phát hiện lỗi chính tả (sai dấu, thiếu dấu, gõ nhầm) nào trong các nhãn đã đọc** — nội dung tiếng Việt nhìn chung chuẩn công vụ, khớp nhận định của `tester-qa.md` mục 6.1 cho phần website. Các vấn đề tìm được đều thuộc dạng "không nhất quán thuật ngữ" hoặc "thiếu xác nhận/nhắc lại", không phải lỗi ngữ pháp/chính tả.

---

## 3. RÀ TÍNH "ĐA TỈNH" — HARD-CODE BỐI CẢNH HẢI PHÒNG / UBND TỈNH

### Tin tốt trước: `src/` (mã nguồn ứng dụng chạy) không hard-code tên "Hải Phòng"

Grep toàn bộ `README.md`, `src/ui/pages/LoginPage.tsx`, mọi trang `src/ui/pages/*.tsx`, `src/ui/pages/admin/*.tsx`, `index.html` — **KHÔNG có kết quả nào** chứa "Hải Phòng"/"Hai Phong". Đây khác với lo ngại ban đầu trong đề bài — sản phẩm KHÔNG lộ tên tỉnh cụ thể ở phần chạy thật.

### Vấn đề thật: 2 lớp mismatch khác, mức độ khác nhau

**Lớp 1 — Website công bố sản phẩm (`website/index.html`) — LỘ LIỄU NHẤT, cần sửa trước tiên:**

| Dòng | Nội dung |
|---|---|
| 7 | `<meta name="description" content="...Công bố chức năng sản phẩm dự thầu gói thầu Sở Khoa học và Công nghệ **thành phố Hải Phòng**.">` |
| 1039 | "...giải pháp của HPT TECH dự thầu gói thầu do Sở Khoa học và Công nghệ **thành phố Hải Phòng** làm Chủ đầu tư." |
| 1063 | "Gói thầu: Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu — Sở Khoa học và Công nghệ **TP Hải Phòng**" |

**Đây LÀ nơi cần sửa nhất và dễ gây hiểu nhầm nhất** — nếu website này được gửi cho tổ chấm ở tỉnh X, họ đọc ngay dòng meta description + footer thấy "dự thầu gói thầu Sở KH&CN Hải Phòng" (đã trúng thầu bởi đối thủ) sẽ đặt câu hỏi ngay "sao sản phẩm chào cho gói Hải Phòng lại nộp cho gói của chúng tôi?" — rủi ro mất điểm/mất uy tín ngay từ trang đầu.

**Lớp 2 — Mô hình tổ chức demo (seed.ts + UnitsAdminPage) — mismatch cấu trúc, không phải mismatch TÊN:**

- `src/data/seed.ts` KHÔNG hard-code "Hải Phòng" (comment dòng 2 chỉ ghi "mô phỏng hoạt động của một UBND tỉnh" — trung lập tên tỉnh), nhưng mô hình 9 đơn vị (`Văn phòng UBND tỉnh + 8 Sở`: KH&ĐT, Tài chính, Xây dựng, TN&MT, GTVT, Y tế, GD&ĐT, TT&TT) là mô hình **"tỉnh/sở"**, trong khi gói thầu tham chiếu (và định hướng sản phẩm mới) chào **"xã, phường, đặc khu"** — mô hình tổ chức khác hẳn (cấp xã không có "Sở").
- Field `Unit.adminType` (`'xa'|'phuong'|'dac_khu'`) đã có type + label + UI CRUD đầy đủ (`UnitsAdminPage.tsx` có cột "Loại đơn vị", dropdown chọn Xã/Phường/Đặc khu) — nhưng **KHÔNG có unit nào trong seed được gán giá trị này** (grep xác nhận `adminType` không xuất hiện trong `seed.ts`). Vào trang "Quản trị đơn vị" sẽ thấy toàn bộ 9 dòng ở cột "Loại đơn vị" hiện dấu "—" (chưa phân loại) — tính năng có code, không có dữ liệu minh họa.
- `README.md` mục "Tài khoản demo": vai trò ghi "Chủ tịch UBND **tỉnh**", "GĐ Sở KH&ĐT" — tên chung, không hard-code tỉnh cụ thể nhưng vẫn là mô hình tỉnh/sở.

**Mức độ gây hiểu nhầm:** thấp hơn Lớp 1 nhiều — tổ chấm tỉnh khác thấy mô hình "UBND tỉnh + Sở" generic sẽ hiểu đây là **kịch bản demo minh họa năng lực hệ thống** (không tuyên bố "sản phẩm CHỈ dành cho tỉnh"), không trực tiếp nói "chúng tôi đang chào gói Hải Phòng" như Lớp 1. Nhưng nếu định hướng mới nhắm đúng phân khúc "xã/phường/đặc khu", một demo minh họa đúng mô hình xã/phường sẽ thuyết phục hơn nhiều so với mô hình tỉnh/sở hiện tại — nhất là khi UI quản trị đã sẵn field `adminType` mà seed không dùng.

### Đề xuất mức sửa TỐI THIỂU (không cần làm seed mới)

| # | Việc | Mức nỗ lực | Vị trí |
|---|---|---|---|
| 1 | **BẮT BUỘC hôm nay:** sửa 3 chỗ "Hải Phòng" trong `website/index.html` thành trung lập (VD: "...dự thầu các gói Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu" — bỏ tên Sở/TP cụ thể, hoặc đổi placeholder `[Tên bên mời thầu]`) | S (3 dòng text, không đụng cấu trúc HTML) | `website/index.html` dòng 7, 1039, 1063 |
| 2 | Gán `adminType` cho ít nhất vài đơn vị demo hiện có (không cần seed xã/phường mới — chỉ cần set field cho unit đã có, ví dụ đặt tạm 2-3 "Sở" thành minh họa dạng "phường" để cột không toàn dấu "—") — **hoặc đơn giản hơn:** đổi tên hiển thị 2-3 unit mẫu (không đổi cấu trúc/id) từ "Sở X" thành "UBND phường X"/"UBND xã X" để khớp đúng mô hình HSMT chào | M (cân nhắc: đổi TÊN đơn vị ảnh hưởng nhiều chỗ tham chiếu tên trong seed — rủi ro cao hơn nếu làm vội hôm nay; ưu tiên chỉ set field `adminType` không đổi tên, an toàn hơn) | `src/data/seed.ts` mục `units` |
| 3 | Comment code `labels.ts:15` — đổi "TP Hải Phòng" thành trung lập (không ảnh hưởng người dùng cuối, chỉ vệ sinh code trước khi cho tổ chấm đọc source nếu cần) | S | `src/domain/labels.ts` dòng 15 |

---

## 4. DANH SÁCH CẢI TIẾN XẾP ƯU TIÊN — ĐỢT HOÀN THIỆN HÔM NAY

Ký hiệu độ lớn: **S** = dưới 30 phút/1 dev, sửa trực tiếp không rủi ro hồi quy. **M** = 30-90 phút, cần chạy lại test liên quan. **L** = cần thiết kế lại/đổi field, nên KHÔNG làm hôm nay (ghi nhận roadmap).

| Ưu tiên | Việc | Độ lớn | File cụ thể | Vì sao ưu tiên |
|---|---|---|---|---|
| **1** | Sửa 3 dòng "Hải Phòng" trong website công bố sản phẩm | **S** | `website/index.html` dòng 7, 1039, 1063 | **Rủi ro cao nhất, sửa dễ nhất.** Đây là tài liệu ĐẦU TIÊN tổ chấm tỉnh khác đọc — để nguyên là tự làm giảm điểm ngay từ ấn tượng đầu. |
| **2** | Thêm nút hiện Duyệt/Từ chối tài liệu cho "Thành viên dự họp" (participant của phiên), không chỉ MANAGE | **M** | `src/ui/pages/shared.tsx` hàm `DocReviewControls` (dòng 184) — thêm điều kiện `isMeetingMember` (participant/chairId/secretaryId của phiên chứa `doc.meetingId`, cần load `meeting` tương ứng — đã có sẵn `m` trong `MeetingDetailPage` khi gọi từ tab Tài liệu; ở `DocumentsPage.tsx` cần thêm lookup theo `doc.meetingId`) | Tính năng nghiệp vụ ĐÚNG THEO HSMT dòng 358 ("Thành viên dự họp thực hiện duyệt") backend đã làm, FE chưa theo — hiện đang là tính năng "vô hình" với đúng đối tượng phải dùng. Sửa xong cần test lại luồng demo với 1 tài khoản `delegate` là participant của phiên có tài liệu `pending`. |
| **3** | Thêm `window.confirm` cho 2 hành động không thể hoàn tác: "Kết thúc" (đóng phiếu lấy ý kiến) và "Đóng biểu quyết" | **S** | `src/ui/pages/PollsPage.tsx` dòng 151; `src/ui/pages/MeetingDetailPage.tsx` dòng 634 | Nhất quán với các hành động xóa đã có confirm; tránh cán bộ bấm nhầm mất khả năng nhận ý kiến. Đổi nhãn "Kết thúc" → "Kết thúc lấy ý kiến" cùng lúc. |
| **4** | Thống nhất "cuộc họp" → "phiên họp" ở 4 vị trí lẻ | **S** | `src/ui/pages/CalendarPage.tsx:107`; `src/ui/pages/LoginPage.tsx:152`; `src/ui/pages/admin/ApiAdminPage.tsx:33,319` | Sửa nhanh, giảm cảm giác thiếu chỉn chu khi tổ chấm lướt qua nhiều màn hình liên tiếp thấy 2 từ khác nhau cho cùng khái niệm — đặc biệt dòng LoginPage là màn hình đầu tiên. |
| **5** | Thống nhất "lấy ý kiến" vs "xin ý kiến" trong module Thống kê (ưu tiên "lấy ý kiến" cho nhãn UI-facing) | **M** | `src/ui/pages/admin/ReportsPage.tsx` (~8-10 chuỗi: StatCard label, tiêu đề cột CSV, tiêu đề bảng — dòng 254,278,285,286,293,309,315,316) | Cùng module, 2 từ lẫn nhau giữa màn hình tạo phiếu và màn hình xuất báo cáo — dễ gây ấn tượng thiếu đồng bộ khi tổ chấm đối chiếu 2 màn hình cạnh nhau. Cần đọc kỹ để không đổi nhầm comment code (không cần đổi, chỉ đổi chuỗi hiển thị JSX). |
| 6 (P2, không cấp bách) | Bổ sung khả năng "Sửa nội dung phiếu nháp" trước khi gửi | **L** | `src/services/voteService.ts` (thêm hàm `updateDraftVote`) + `src/ui/pages/PollsPage.tsx` (thêm modal sửa, tái dùng `PollCreateModal`) | Đúng yêu cầu HSMT dòng 409 ("Sửa nội dung văn bản chưa lấy ý kiến") nhưng cần thiết kế lại modal tạo phiếu để tái dùng cho sửa (không phải chỉ đổi 1-2 dòng) — khuyến nghị làm ở đợt sau, không gấp hôm nay vì rủi ro hồi quy cho tính năng vừa mới (draft poll) mới thêm đêm qua. |
| 7 (P2, không cấp bách) | Nhắc lại phương án đã chọn trong modal ký số ý kiến trước khi hỏi PIN | **S-M** | `src/ui/pages/PollsPage.tsx` hàm `PollSignModal` (dòng 223) | Giảm rủi ro ký nhầm — có thể làm cùng lúc với việc #3 nếu còn thời gian, không bắt buộc. |

---

## GHI CHÚ ĐỐI SOÁT VỚI CÁC BÁO CÁO ĐÊM QUA (tránh trùng lặp)

Các phát hiện SAU đây đã được `tester-qa.md`/`dev-backend.md` ghi nhận đêm 17→18/07 — KHÔNG lặp lại chi tiết trong báo cáo này, chỉ xác nhận trạng thái hiện tại khi đọc lại code:

- **P0-1 (`catalogs.docType` bị backend chặn 400):** thuộc phạm vi backend, BA không đọc lại `guard.js`/`Guard.cs` để xác minh đã vá hay chưa — đề nghị Tech Lead xác nhận riêng.
- **P1-1 (`feedbacks` quyền cập nhật lệch FE/BE):** BA xác nhận **phía FE (`feedbackService.ts`) đã sửa** để chỉ cho `admin`/`unit_admin` (mục 1c báo cáo này) — không còn dùng `can.manageMeetings` như bản tester đã đọc. Cần Tech Lead xác nhận BE đã đồng bộ y hệt.
- **P2-1 (gap `chairCtl` id-match vs `MANAGE` role-match cho sửa/xóa kết luận):** không thuộc phạm vi nhiệm vụ BA lần này (không phải 1 trong 6 mục a-f được giao), không rà lại.
- **P2-2 (`signedCount` đếm trên dữ liệu đã ẩn danh):** cùng lý do trên, không rà lại.

**Phát hiện MỚI của báo cáo này (không có trong 2 báo cáo đêm qua):** mục 1(d) — gap FE giữa nút Duyệt/Từ chối tài liệu (chỉ hiện cho MANAGE) và backend `isMeetingMember` (đã mở cho participant thường) — đây là gap khác với P2-1 (P2-1 nói về sửa/xóa KẾT LUẬN phiên họp, còn phát hiện này nói về DUYỆT TÀI LIỆU — 2 tính năng khác nhau, cùng dạng lỗi "FE chưa theo kịp BE mở rộng quyền").
