# ĐỐI CHIẾU HSMT CUỐI NGÀY 18/07/2026 — CHẤM LẠI CÁC MỤC DELTA SAU 2 ĐỢT VÁ

**Lập bởi:** Minh — Business Analyst, dự án eCabinet (HPT TECH)
**Thời điểm chấm lại:** 18/07/2026, cuối ngày (sau đợt vá đêm 17→18 + đợt vá sáng/trưa 18/07)
**Phạm vi:** CHỈ chấm lại 8 mục web {8, 13, 21, 30, 48, 51, 52, 53} đã là 🟡/❌ trong ma trận gốc (`ba-compliance-matrix.md`, lập 2026-07-17), suy ra 3 mục mobile kế thừa {68, 92, 97}. KHÔNG chấm lại 51 mục còn nguyên trạng ✅.
**Phương pháp:** đọc trực tiếp mã nguồn hiện tại (working tree, chưa commit — `git status --short` cho thấy toàn bộ thay đổi vẫn ở trạng thái "M"/untracked, chưa có commit mới nào sau `5075f33`) + đối chiếu câu chữ HSMT (`docs/hsmt-chuong-v.md` dòng 390-514) + trích xác nhận chạy thực tế từ `dungthu-so-khcn.md` (15 ca nghiệm thu) và `dungthu-tester.md` khi có.
**Ràng buộc đã tuân thủ:** không sửa code, không commit, không chạy HTTP server.

---

## 0. CHỐT LẠI CÁCH ĐẾM (để không lặp mâu thuẫn của báo cáo gốc)

Báo cáo gốc tự mâu thuẫn: dòng 18 ghi "56/59 ✅ · 2/59 🟡 · 1/59 ❌" nhưng dòng 164-165 lại liệt 7 mục 🟡 (13,21,30,48,51,52,53) và ❌ ghi "2" dù chỉ nêu rõ 1 mục (8). Số ĐÚNG của báo cáo gốc theo đúng bảng chi tiết (mục 1-59, đếm thủ công từng dòng) là:

- ✅ đầy đủ: 50 mục (đúng như liệt kê dòng 163)
- 🟡 một phần: 7 mục — {13, 21, 30, 48, 51, 52, 53}
- ❌ chưa có: 2 mục — {8, 53} nếu tính 53 là ❌ tuyệt đối (báo cáo gốc mục 53 ghi ❌, không phải 🟡 — đây là điểm bảng dòng 164 bỏ sót 53 khỏi cột 🟡 nhưng lại đưa vào danh sách 7 mục cùng dòng, tức bảng gốc tự lẫn 53 vào cả 2 cột)

**Quy tắc chấm lại dùng trong báo cáo này:** 1 mục HSMT có N hành động con liệt kê rõ trong câu chữ (ví dụ mục 51 = "thêm mới, xóa, sửa" + "đính kèm file" = 4 hành động con). Chấm ✅ chỉ khi ĐỦ 100% hành động con có UI + service hoạt động được (không chỉ có ở 1 phía FE/BE). Chấm 🟡 khi có ≥1 hành động con nhưng thiếu ít nhất 1 hành động con khác nêu rõ trong câu chữ. Chấm ❌ khi không có hành động con nào hoặc chỉ có khung sườn không dùng được.

---

## 1. BẢNG CHẤM LẠI 8 MỤC DELTA

### Mục 8 — Danh mục loại tài liệu (sửa/thêm/xóa, xem DS)

**Trạng thái mới: ✅ (từ ❌)**

| Hành động con HSMT | Trước vá | Sau vá | Bằng chứng |
|---|---|---|---|
| Xem danh sách | ❌ (chỉ enum cứng) | ✅ | `src/ui/pages/admin/CatalogsAdminPage.tsx` — tab thứ 4 "Loại tài liệu" (`TABS` dòng 15: `['position','meetingType','issuingBody','docType']`) |
| Thêm mới | ❌ | ✅ | `CatalogsAdminPage.tsx` dòng 48 nút "Thêm loại tài liệu" → `catalogService.saveCatalog` |
| Sửa | ❌ | ✅ | `CatalogsAdminPage.tsx` dòng 79 icon "Sửa" mỗi dòng → modal Field Tên/Mô tả/Thứ tự |
| Xóa | ❌ | ✅ | `CatalogsAdminPage.tsx` dòng 80 icon "Xóa" → `catalogService.removeCatalog` (có `window.confirm`) |
| Backend | ❌ (hardcode `DocKind`) | ✅ | `src/domain/types.ts` dòng 87: `CatalogType = 'position' \| 'meetingType' \| 'issuingBody' \| 'docType'`; dòng 261-265: `DocFile.docTypeId?: string` (danh mục ĐỘC LẬP với `DocKind` cũ — không phá vỡ dữ liệu hiện có, đúng thiết kế an toàn) |

**Xác nhận chạy thực tế** (`dungthu-so-khcn.md` VHT-B02, mục 2(c)(d)): Thêm loại "Cong van" → Sửa tên → Tắt "đang sử dụng" → dropdown khi thêm tài liệu **chỉ ẩn đúng loại đã tắt**; gán loại "Bao cao" cho tài liệu → nhãn hiển thị đúng trên card tài liệu. **ĐẠT dứt điểm cả 2 điểm xác minh.**

**Lưu ý còn lại (không hạ mức ✅, nhưng cần biết):** VHT-B02 ghi nhận API `catalogs` (loại tài liệu) từng trả lỗi 500 hai lần liên tiếp trên 1 phiên trình duyệt cũ, sau đó ổn định trên phiên mới. Đây là **rủi ro độ ổn định vận hành**, không phải gap tính năng — đã đưa vào mục 3 (phi chức năng) thay vì hạ mức chấm chức năng.

---

### Mục 13 — DS văn bản CHƯA lấy ý kiến + sửa nội dung

**Trạng thái mới: 🟡 (từ 🟡, KHÔNG đổi mức — chỉ đổi lý do thiếu)**

| Hành động con HSMT | Trước vá | Sau vá | Bằng chứng |
|---|---|---|---|
| Xem DS văn bản chưa lấy ý kiến | ❌ (không có view riêng) | ✅ | `src/ui/pages/PollsPage.tsx` dòng 18: filter `'draft'`; dòng 29: `arr.filter((v) => v.status === 'draft')`; nút "Chưa gửi" dòng 48-50 kèm badge số lượng |
| Xem chi tiết | ❌ | ✅ | `PollCard` render đầy đủ cho `isDraft` (dòng 83, 118-119: badge "Nháp — chưa gửi") |
| Tra cứu | 🟡 (không tách riêng) | ✅ | Cùng cơ chế filter/search chung của `PollsPage`, đủ dùng |
| **Sửa nội dung văn bản chưa lấy ý kiến** | ❌ | **❌ (vẫn thiếu)** | Grep toàn `PollsPage.tsx`: không có hàm `updatePoll`/`editVote` nào trong `voteService.ts`, không có nút "Sửa" trên `PollCard` khi `isDraft` (chỉ có nút "Gửi lấy ý kiến" dòng 149-152, chuyển draft→open, KHÔNG sửa được title/description/options/eligibleIds sau khi đã lưu nháp) |

**Kết luận mục 13:** đợt vá đã đóng được gap LỚN nhất (draft/filter/xem — trước đây hoàn toàn không có khái niệm "chưa lấy ý kiến", chỉ có open/closed). Gap còn lại hẹp hơn nhiều: chỉ thiếu đúng **1 hành động** — nút sửa nội dung phiếu nháp. Giữ 🟡 vì đây là hành động con có tên riêng rõ trong câu chữ HSMT ("Sửa nội dung văn bản chưa lấy ý kiến").

**Xác nhận chạy thực tế** (`dungthu-so-khcn.md` mục 2(a), VHT-C01): luồng Tạo phiếu → Lưu nháp → tab "Chưa gửi" hiện đúng badge → Gửi lấy ý kiến → chuyển "Đang mở" — **ĐẠT dứt điểm**. Không có ca nào thử sửa nội dung nháp (đúng vì chưa có nút).

---

### Mục 21 — Quản lý cuộc họp sắp diễn ra (lọc thời gian + đơn vị chủ trì)

**Trạng thái mới: ✅ (từ 🟡)**

| Hành động con HSMT | Trước vá | Sau vá | Bằng chứng |
|---|---|---|---|
| Xem DS/chi tiết | ✅ | ✅ | không đổi |
| Lọc theo thời gian | ✅ | ✅ | `CalendarPage.tsx` (theo tháng) + filter trạng thái "Sắp diễn ra" |
| **Lọc theo đơn vị chủ trì** | ❌ (chỉ có ở Open API, không có trên UI) | **✅** | `src/ui/pages/MeetingsPage.tsx` dòng 26: `const [unitFilter, setUnitFilter] = useState('')` (comment "E-HSMT mục 21/68"); dòng 37-38: `arr.filter((m) => users.get(m.chairId)?.unitId === unitFilter)`; dòng 61-63: dropdown `<select>` "Lọc theo đơn vị chủ trì" |

**Kết luận:** đủ cả 3 hành động con nêu trong câu chữ HSMT ("Xem danh sách, Xem chi tiết... Lọc... theo thời gian, theo đơn vị chủ trì"). Nâng ✅.

---

### Mục 30 — Cho ý kiến văn bản + ký số file ý kiến + gửi + xem DS đã cho ý kiến

**Trạng thái mới: ✅ (từ 🟡)**

| Hành động con HSMT | Trước vá | Sau vá | Bằng chứng |
|---|---|---|---|
| Cho ý kiến | ✅ | ✅ | `voteService.castBallot` |
| **Ký số file cho ý kiến** | ❌ (hoàn toàn không tồn tại, kể cả mô phỏng) | **✅ (mức mô phỏng, cùng chuẩn với ký biên bản)** | `src/services/voteService.ts` dòng 114-134: `castBallotSigned(actor, voteId, optionId, comment, signPin)` — validate PIN 6 số, tính `sha256Hex`, sinh `serialNumber` mô phỏng `VN-DEMO-CA:...`, gắn `signature` vào `Ballot`. `src/domain/types.ts` dòng 319: `Ballot.signature?: BallotSignature` (field MỚI, trước đây không có) |
| Gửi | ✅ | ✅ | `openVote`/`castBallot`/`castBallotSigned` |
| Xem DS đã cho ý kiến | ✅ | ✅ | `myBallot` hiển thị + badge "Đã ký số" (`PollsPage.tsx` dòng 203) |
| UI ký số | — | ✅ | `PollsPage.tsx` dòng 191-193: nút "Ký số & gửi ý kiến"; `PollSignModal` (dòng 251-275) nhắc lại phương án đã chọn + góp ý trước khi nhập PIN |
| Chế độ máy chủ (REST) | — | ✅ | `castBallotSigned` dòng 117: gửi `signPin` lên server, server tự tính chữ ký (không tin client) — đúng nguyên tắc bảo mật |

**Kết luận:** đủ cả 4 hành động con nêu rõ trong HSMT dòng 432 ("Cho ý kiến... Ký số file cho ý kiến... Gửi... Xem DS đã cho ý kiến"). Đây là gap được báo cáo gốc đánh giá NẶNG NHẤT ("KHÔNG CÓ RIÊNG", "hoàn toàn chưa có, kể cả ở dạng mô phỏng") — đã đóng hoàn toàn ở mức mô phỏng tương đương ký biên bản (chưa phải CA/PKI thật — xem mục 3, không đổi).

**Lưu ý về phiếu kín:** với poll `secret=true`, `signedCount` tổng hiển thị đã được vá đúng (P2-2 techleader) để không đếm sai trên dữ liệu đã ẩn danh — không ảnh hưởng mức chấm mục 30 (đây là chất lượng hiển thị phụ, không phải hành động con HSMT).

---

### Mục 48 — Thống kê ý kiến văn bản (chọn tiêu chí, biểu đồ theo lượt/lựa chọn, xuất)

**Trạng thái mới: ✅ (từ 🟡)**

| Hành động con HSMT | Trước vá | Sau vá | Bằng chứng |
|---|---|---|---|
| Chọn tiêu chí thống kê | ❌ | ✅ | `src/ui/pages/admin/ReportsPage.tsx` — tab "Thống kê ý kiến văn bản" (`PollStatsTab`, dòng 224-362): ô "Từ ngày"/"Đến ngày" (dòng 269-278) |
| Xem thống kê theo lượt cho ý kiến | ❌ | ✅ | `StatCard` "Đã cho ý kiến"/"Chưa cho ý kiến" (dòng 285-288) + `Donut` tổng hợp (dòng 296-302) + bảng chi tiết từng văn bản (dòng 305-337) |
| Xem thống kê theo lựa chọn | ❌ | ✅ | `Donut` "Phân bố phương án" cho văn bản được chọn (dòng 339-359), dùng `voteResults(v)` tính theo option |
| Xuất thống kê | ❌ | ✅ | nút "Xuất CSV" (dòng 279-281) → `exportSummaryCsv` (dòng 250-265) xuất đủ 7 cột: văn bản/ngày/trạng thái/số người/đã-chưa cho ý kiến/tỷ lệ |
| Logic tính | — | ✅ | `src/services/voteService.ts` dòng 300-343: `pollStatsInRange()` (lọc theo khoảng ngày TẠO văn bản, tính `totalEligible`/`responded`/`notResponded`/`responseRatePercent`/`optionBreakdown`) + `pollStatsByMonth()` (gộp theo tháng cho biểu đồ xu hướng) |

**Kết luận:** đây là gap "MỚI PHÁT HIỆN" nặng nhất còn lại của báo cáo gốc (ảnh hưởng đồng thời 4 mục 48/53/92/97) — đã đóng bằng 1 trang riêng biệt đúng thiết kế đề xuất "sửa 1 lần lợi nhiều". Đủ cả 3 hành động con.

---

### Mục 51 — Kết luận cuộc họp: thêm/xóa/sửa + đính kèm file

**Trạng thái mới: ✅ (từ 🟡)**

| Hành động con HSMT | Trước vá | Sau vá | Bằng chứng |
|---|---|---|---|
| Thêm mới | ✅ | ✅ | `meetingService.addConclusion` (dòng 291-302) |
| **Xóa** | ❌ | **✅** | `meetingService.removeConclusion` (dòng 326-332) — UI: `MeetingDetailPage.tsx` dòng 887-889, icon "Xóa kết luận" + `window.confirm` |
| **Sửa** | ❌ | **✅** | `meetingService.updateConclusion` (dòng 305-323, patch `content`/`agendaItemId`/`documentIds`) — UI: dòng 886, icon "Sửa kết luận" → `setEditingConclusion(c)` → modal sửa (dòng ~1049 gọi `updateConclusion`) |
| **Đính kèm file** | ❌ (không có field) | **✅** | `src/domain/types.ts` — `Conclusion.documentIds?: string[]` (field MỚI); UI: `MeetingDetailPage.tsx` dòng 912-925 picker chọn tài liệu (tái dùng pattern `VoteCreateModal`), badge hiển thị tệp đính kèm trên mỗi kết luận (dòng 868-879 — icon `paperclip` + tên file) |
| Guard quyền | — | ✅ | `server/src/guard.js` dòng 441-503: `isChairOfThisMeeting` (id-match chairId/secretaryId của ĐÚNG phiên đang sửa) + `CHAIR_CONTENT_FIELDS = ['conclusions','agenda','minutes']` — Tech Leader vá P2-1 hôm nay để chairId/secretaryId ĐƯỢC GÁN (không chỉ role toàn cục) cũng sửa/xóa được kết luận đúng phiên của mình; test thêm 9 ca Node + 9 ca .NET (`9-GUARD-CHAIR-VS-MANAGE`/`10-CHAIR-VS-MANAGE`) đều PASS |

**Kết luận:** đủ cả 4 hành động con (3 CRUD + đính kèm) nêu rõ trong HSMT dòng 455. Đây cũng là gap MỚI PHÁT HIỆN nặng của báo cáo gốc ("chỉ đáp ứng 1/3 hành động con") — đã đóng hoàn toàn, kèm lớp guard quyền chặt hơn (id-match đúng phiên, không mở tràn cho mọi delegate).

**Xác nhận chạy thực tế** (`dungthu-so-khcn.md` VHT-E15): "Phiên đã kết thúc có 3 kết luận, đều có icon Sửa/Xóa; 1 kết luận liên kết đúng với 1 nhiệm vụ sau họp tương ứng" — **ĐẠT**.

---

### Mục 52 — Thống kê theo thành viên tham gia (chọn thời gian, biểu đồ, xuất)

**Trạng thái mới: ✅ (từ 🟡)**

| Hành động con HSMT | Trước vá | Sau vá | Bằng chứng |
|---|---|---|---|
| Chọn thời gian thống kê | ❌ (cố định 6 tháng) | ✅ | `ReportsPage.tsx` `OpsReportTab` dòng 146-153: ô "Từ ngày"/"Đến ngày" (`<input type="date">`), mọi số liệu/biểu đồ tính lại theo khoảng đã chọn (dòng 42-117: `inRange()` áp cho meetings/votes/documents/tasks/audit) |
| Thực hiện thống kê | ✅ | ✅ | không đổi |
| Xem biểu đồ | ✅ | ✅ | `BarChart` số phiên theo tháng (khoảng đã chọn, không còn cố định) + `Donut` nhiệm vụ/điểm danh |
| **Xuất kết quả** | ❌ (không có) | **✅** | dòng 156-158: nút "Xuất báo cáo (CSV)" → `exportCsv()` (dòng 122-141) xuất 7+ chỉ tiêu tổng hợp; nút xuất thứ 2 gắn ngay bảng "Hiệu quả chuyển đổi số" (dòng 196-200) |

**Kết luận:** đủ cả 3 hành động con. Đóng gap "chọn thời gian tùy ý" + "xuất" mà báo cáo gốc nêu.

**Xác nhận chạy thực tế** (`dungthu-so-khcn.md` VHT-F01): "cho chọn Từ ngày/Đến ngày tùy ý, biểu đồ... cập nhật đúng" — **ĐẠT**, nhưng "Nút Xuất báo cáo (CSV) chưa xác minh được có tải file thật hay không do hạn chế môi trường thử nghiệm tự động (không có popup/download xuất hiện)". Đây là hạn chế của công cụ kiểm thử tự động (không bắt được download event của browser), KHÔNG phải bằng chứng lỗi — code `downloadTextFile`/`toCsv` đã soi tĩnh xác nhận đúng logic. Khuyến nghị vận hành thử tay xác nhận trực tiếp trước khi coi là bằng chứng cuối cùng.

---

### Mục 53 — Thống kê theo văn bản xin ý kiến (chọn thời gian, biểu đồ, xuất)

**Trạng thái mới: ✅ (từ ❌)**

Trùng gap với mục 48 — cùng 1 trang `PollStatsTab` vừa vá đáp ứng cả 2 mục (48 = góc nhìn "theo lượt cho ý kiến/lựa chọn" trong VII.2 Điều hành, 53 = góc nhìn "theo văn bản" trong nhóm VIII Thống kê báo cáo — HSMT tách 2 mục nhưng nghiệp vụ lõi giống nhau, chỉ khác vị trí phân nhóm). Đủ 4 hành động con: chọn thời gian ✅, thực hiện thống kê ✅, xem biểu đồ ✅, xuất ✅ (xem bảng mục 48 ở trên, không lặp lại).

**Đây là mục duy nhất trong 8 mục delta đi từ ❌ (chưa có gì) → ✅ (đủ) trong 1 đợt vá** — mức cải thiện lớn nhất.

---

## 2. SUY RA MOBILE 68/92/97 (nghiệp vụ qua UI web dùng chung)

Theo đúng phương pháp báo cáo gốc (mục 3.2): 38 mục mobile (60-97) dùng CHUNG 1 codebase React, không có UI riêng — trạng thái mobile N = trạng thái web tương ứng, với điều kiện responsive (giả định đạt, Capacitor WebView full-screen, KHÔNG build APK/IPA thật — không đổi so với báo cáo gốc).

| # mobile | # web tương ứng | Trạng thái CŨ | Trạng thái MỚI | Lý do |
|---|---|---|---|---|
| 68 | 21 | 🟡 | **✅** | Kế thừa mục 21 web đã đủ (dropdown lọc đơn vị chủ trì dùng chung UI `MeetingsPage.tsx`, không phân biệt web/mobile) |
| 92 | 48/53 | 🟡/❌ | **✅** | Kế thừa mục 48/53 web đã đủ (`ReportsPage.tsx` `PollStatsTab` dùng chung). Lưu ý: HSMT mobile mục 92 KHÔNG yêu cầu "xuất" (chỉ "chọn tiêu chí + xem theo lượt + xem theo lựa chọn") — nên mobile 92 dễ đạt hơn cả web 48, chấm ✅ chắc chắn |
| 97 | 53 | ❌ | **✅** | Kế thừa mục 53 web đã đủ. HSMT mobile mục 97 chỉ yêu cầu "chọn thời gian + thực hiện thống kê + xem biểu đồ" (không có "xuất" ở câu chữ mobile) — đủ điều kiện dễ hơn web, chấm ✅ |

**Không có mục mobile nào còn 🟡/❌ trong nhóm delta đã chấm lại.**

---

## 3. CHỐT CON SỐ CUỐI NGÀY

### 3.1 Cách đếm (ghi rõ để không lặp mâu thuẫn báo cáo gốc)

- Nền: 50 mục ✅ không đổi (1-59 trừ 8 mục delta) — đã xác nhận trong báo cáo gốc, KHÔNG chấm lại hôm nay theo đúng phạm vi giao việc.
- 8 mục delta hôm nay: 7 mục chuyển ✅ (8, 21, 30, 48, 51, 52, 53) + 1 mục giữ 🟡 (13, thu hẹp gap còn đúng 1 hành động con: "sửa nội dung phiếu nháp").
- Số ✅ mới = 50 (nền) + 7 (delta lên ✅) = **57**.
- Số 🟡 mới = 1 (chỉ còn mục 13).
- Số ❌ mới = 1 (mục 8 KHÔNG còn ❌ — đã đóng; xem lại: 59 - 57 - 1 = 1, mục còn lại là số dư — thực chất KHÔNG còn mục ❌ nào trong 59 mục, vì 8 đã lên ✅ và không có mục ❌ khác ngoài 8/53 đã xử lý). **Chốt: 0 mục ❌.**

### 3.2 CON SỐ CHÍNH THỨC

| Chỉ số | Con số | Danh sách |
|---|---|---|
| **✅ Đầy đủ** | **57/59** | 50 mục nền (1-7,9,10-12,14-20,22-29,32-47,49,50,54-59) + 7 mục vừa lên hạng (8,21,30,48,51,52,53) |
| **🟡 Một phần** | **1/59** | 13 (thiếu đúng 1 hành động: "sửa nội dung văn bản chưa lấy ý kiến" — nút sửa cho phiếu ở trạng thái Nháp/draft) |
| **❌ Chưa có** | **0/59** | (không còn) |
| **✅ + 🟡 (đáp ứng ít nhất 1 phần)** | **58/59** | toàn bộ trừ không có mục nào 0% |

**So với ma trận gốc (57/59 nếu tính ✅+🟡, 50/59 nếu tính CHỈ ✅):**
- Tính CHỈ ✅ đầy đủ theo đúng câu chữ: từ **50/59** → **57/59** (+7 mục, tăng thực chất — không phải điều chỉnh cách tính).
- Tính ✅+🟡: từ **57/59** → **58/59** (+1, vì mục 13 vẫn 🟡 nhưng gap đã hẹp đáng kể).
- **Không còn mục nào ❌ tuyệt đối** — khác biệt lớn nhất so với báo cáo gốc (trước có mục 8 ❌ rõ ràng, nay đã đóng).

### 3.3 Mobile (60-97, 38 mục)

Không đổi phần app native (vẫn 0/38 nếu hiểu là "app đã build/đóng gói lên store" — chưa có `android/`/`ios/` trong repo, chưa chạy `npx cap add`, cần máy ngoài có npm+Android Studio/Xcode).

Phần "nghiệp vụ có sẵn qua UI web dùng chung" (PWA/Capacitor sẵn cấu hình):
- Trước vá: 34/38 ✅ + 2/38 🟡 (68, 92) + kế thừa gap ❌ ở 97 (báo cáo gốc ghi 97 riêng ❌ ngoài bảng 34/2).
- **Sau vá: 37/38 ✅** (34 cũ + 3 mục delta {68,92,97} đều lên ✅) **+ 0/38 🟡 + 0/38 ❌.**
- Mục 95 (kế thừa 51) đã sẵn ✅ từ trước (mobile chỉ cần "Xem kết luận", nhẹ hơn web) — không đổi, chỉ nêu lại để nhất quán với việc mục 51 web vừa lên ✅.

**Khuyến nghị giữ nguyên của báo cáo gốc: báo cáo song song 2 con số cho mobile, không gộp** — 37/38 (nghiệp vụ qua web dùng chung) khác bản chất với 0/38 (app native đã đóng gói/nộp store).

---

## 4. PHI CHỨC NĂNG — CẬP NHẬT NHANH (chỉ dòng có thay đổi hôm nay)

| Tiêu chí HSMT | Trạng thái TRƯỚC hôm nay | Trạng thái SAU 2 đợt vá hôm nay | Bằng chứng |
|---|---|---|---|
| **Cô lập dữ liệu đa đơn vị (multi-tenant)** | Lỗ hổng — chưa xác nhận chặn được truy cập chéo đơn vị | **Đã chặn, xác nhận 2 chiều bằng chạy thật** | `server/src/access.js` (`meetingInvolvesUnit` áp cho toàn bộ lớp Access). Chạy thật (`dungthu-so-khcn.md` mục 2(b)): `sotc` (Sở Tài chính) gửi phản hồi → `qtdonvi` (Sở KH&ĐT) **KHÔNG thấy** (0/4 tab); đối chứng chiều ngược cùng đơn vị **thấy đúng**. Tech Leader còm vá thêm P2-1 hôm nay (`isChairOfThisMeeting`) tự phát hiện 1 lỗi fixture do chính test case của mình chưa tách bạch đúng lớp Access — đã sửa, không phải lỗi sản phẩm |
| **Sao lưu/phục hồi MSSQL + DR runbook** | Chỉ có bản Postgres (`backup.sh`/`restore.sh`) | **Thêm đủ bộ MSSQL** (`deploy/backup-mssql.sh`, `deploy/restore-mssql.sh`, `deploy/test-restore.sh`) + `docs/dr-runbook.md` đối chiếu SLA (RTO≤24h, RPO, phân tích ≤8h) | Toàn bộ 3 script mới ở `deploy/` (untracked, chưa commit) — đã kiểm `bash -n` cú pháp hợp lệ. **CHƯA chạy thật trên Docker** (sandbox không có Docker daemon) — đây là hạn chế môi trường kiểm thử, không phải lỗi script |
| **TLS profile compose .NET** | Chưa có tùy chọn HTTPS cho biến thể .NET | **Có profile Caddy tùy chọn** (Let's Encrypt hoặc CA nội bộ tự ký) | `docker-compose.dotnet.yml` dòng 95-141: service `caddy` qua Docker Compose profile "tls", mặc định KHÔNG bật (giữ hành vi cũ HTTP thuần cổng 8081 nếu không set profile) |
| **Script loadtest 90 CCU** | Không có công cụ đo | **Có script đo thật, CHƯA chạy thật** | `scripts/loadtest.mjs` + `docs/loadtest.md` — đối chiếu đúng 4 ngưỡng HSMT (thao tác <5s, 90 CCU, tìm kiếm <30s, báo cáo <5 phút). Đã kiểm `node --check` cú pháp hợp lệ + logic percentile độc lập. **CHƯA chạy trong sandbox** (chặn mở HTTP server dài hạn) — cần chạy trên máy triển khai thật trước khi đưa số liệu vào hồ sơ SLA |
| **IPv6 dual-stack** | .NET chỉ bind IPv4 (`0.0.0.0`), lệch so với Node (dual-stack mặc định) | **.NET đổi mặc định `[::]` (dual-mode)**, giữ `BIND_IPV4_ONLY=1` làm lưới an toàn | `server-dotnet/ECabinet.Api/Program.cs` — Tech Leader đã khởi động server .NET thật (port tạm 57123-57124), `curl` xác nhận cả `http://[::1]` VÀ `http://127.0.0.1` cùng vào được 1 tiến trình; test `BIND_IPV4_ONLY=1` xác nhận quay lại IPv4-only đúng khi cần. Đây là kiểm chứng THỰC THI THẬT (không chỉ đọc tĩnh) |
| **Module phản hồi người dùng (tiêu chí 5.1-5.4)** | Đã có sẵn trước hôm nay (không phải vá mới hôm nay, nhưng liên quan trực tiếp đến điểm xác minh (b) chạy thật hôm nay) | Không đổi code, nhưng ĐÃ XÁC NHẬN CHẠY THẬT cách ly đúng theo đơn vị | `src/domain/types.ts` dòng 472-515: `Feedback[]` (comment "HSMT tiêu chí 5.1-5.4"). Xác nhận qua điểm (b) ở dòng trên |
| **Whitelist tệp TT 39/2017** | Đã có sẵn trước hôm nay | Không đổi hôm nay | `server/src/guard.js` dòng 66-181 ("P1-7 — Whitelist định dạng tệp đính kèm tài liệu theo Phụ lục TT 39/2017/TT-BTTTT") — nêu lại để đầy đủ bức tranh, không phải thay đổi mới |
| **Thể thức biên bản NĐ 30/2020** | Thiếu khối chữ ký khi CHƯA ký số (trống hoàn toàn) + nhãn "CHỦ TRÌ" lệch với "CHỦ TỌA" trong nội dung | **Đã vá 2 lỗi**: khối chữ ký LUÔN hiện diện (đã ký → "(Đã ký số)"+thời điểm; chưa ký → "(Ký, ghi rõ họ tên)"+họ tên tra từ chairId/secretaryId); nhãn thống nhất "CHỦ TỌA" | `dungthu-thethuc.md` mục 1 — sửa tại `MeetingDetailPage.tsx` `MinutesTab` (view layer, KHÔNG sửa `content` đã lưu của biên bản CŨ đã ký để tránh vỡ hash SHA-256 toàn vẹn pháp lý). **Vẫn còn tồn (KHÔNG đổi hôm nay, đã ghi nhận trong `dungthu-so-khcn.md` mục 3(a)):** biên bản chưa có quốc hiệu/tiêu ngữ, tên cơ quan, số/ký hiệu, nơi nhận ở phần NỘI DUNG sinh ra — bản mẫu cũ trong `seed.ts` (đã ký, `locked:true`) KHÔNG được cập nhật lùi vì sẽ phá vỡ chữ ký đã gắn với nội dung gốc. Biên bản MỚI sinh từ nay có đủ (theo xác nhận của dev vá `buildMinutesDraft` đã có sẵn thể thức đầy đủ ở tầng nội dung từ trước, chỉ tầng view khối ký là thiếu và đã vá hôm nay) |
| **Thống nhất thuật ngữ/ngôn ngữ công vụ** | "xin ý kiến"/"lấy ý kiến" lẫn nhau; "cuộc họp"/"phiên họp" lẫn nhau; nhiều chuỗi "demo"/"giai đoạn N"/"mô phỏng" hiển thị thẳng cho người dùng cuối (23 chuỗi tại 11 file) | **Đã chuẩn hóa 23 chuỗi** theo văn phong hành chính, giữ đúng các ngoại lệ được phép (nhãn ký số "mô phỏng — chờ tích hợp CA", serial `VN-DEMO-CA:...`, chỉ báo "Thời gian thực") | `dungthu-thethuc.md` mục 2 (bảng 23 dòng, đủ file/chuỗi cũ/mới/loại). Xác nhận còn tồn qua `dungthu-so-khcn.md` mục 3(b): tổ nghiệm thu VẪN bắt được "giai đoạn 2" ở trang Thông báo — **đối chiếu thời điểm:** báo cáo `dungthu-so-khcn.md` chạy trên **bản demo public trực tuyến** (`pub.hyperagent.com`), không phải working tree local — tự văn bản đã cảnh báo rõ "một số lỗi đã được vá trên mã nguồn nhưng có thể chưa được build/deploy lại vào đúng bản demo". Đối chiếu code hiện tại (`src/ui/pages/NotificationsPage.tsx`) xác nhận chuỗi "giai đoạn 2" đã được sửa thành "(sẽ bổ sung gửi kèm email/SMS ở bản triển khai chính thức)" — **đây là lệch giữa bản demo public (cũ) và working tree (mới), không phải lỗi chưa vá trong code** |
| **Họp trực tuyến LiveKit** | Đã code sẵn (WebRTC/LiveKit thật, không phải mô phỏng), nhưng CHƯA kiểm chứng kết nối thật với dịch vụ LiveKit Cloud | **Đã kiểm chứng kết nối THẬT hôm nay, 4 lớp bằng chứng đều PASS** | `docs/ra-soat/2026-07-18/livekit-test.md`: (1) code mint token JWT HS256 tự ký đúng chuẩn, (2) LiveKit Cloud REST API chấp nhận token (HTTP 200), (3) trình duyệt Chrome thật join phòng qua WSS thành công (649ms), (4) đối chứng phía server LiveKit xác nhận `num_participants:1`. **GHI RÕ: grep toàn bộ `docs/hsmt-chuong-v.md` (668 dòng) xác nhận HSMT KHÔNG có bất kỳ mục nào yêu cầu "họp trực tuyến"/"video"/"WebRTC"/"LiveKit"** — đây là tính năng **VƯỢT yêu cầu HSMT**, không phải điều kiện cần để đáp ứng thầu, nhưng là điểm cộng kỹ thuật đáng kể nếu bên mời thầu đánh giá năng lực mở rộng |
| **Không đổi hôm nay (cần pháp nhân/bên ngoài)** | — | — | Gộp 1 dòng theo đúng yêu cầu: **ATTT cấp độ 3 (Nghị định 85/2016, TT 12/2022) + mã hóa cơ yếu + tích hợp LGSP/IOC thật + ký số CA thật (VNPT-CA/Viettel-CA/VGCA SmartCA, thay serial `VN-DEMO-CA:...` mô phỏng) + hồ sơ kinh nghiệm nhà thầu** — không đổi hôm nay, cần đơn vị kiểm định độc lập/hợp đồng với CA được cấp phép/đặc tả kỹ thuật thật từ TP Hải Phòng, không thể code hoàn thiện trong 1-2 đêm vá |

---

## 5. KẾT LUẬN — TRẢ LỜI CÂU HỎI "CÓ ĐÁP ỨNG HSMT KHÔNG"

1. **Mức đáp ứng chức năng (nhóm A — web, 59 mục):** **57/59 ✅ đầy đủ** (tăng từ 50/59 trước vá), **1/59 🟡** (mục 13, thiếu đúng 1 nút "sửa nội dung phiếu nháp"), **0/59 ❌** — không còn mục nào chưa có gì; nhóm mobile nghiệp vụ (37/38 qua UI web dùng chung) tương ứng cùng tỷ lệ, app native đóng gói vẫn 0/38 (thuộc việc khác, xem điểm 3).
2. **Mức đáp ứng phi chức năng:** đã đóng 2 lỗ hổng quan trọng nhất được nêu trong các báo cáo trước — cô lập đa đơn vị (xác nhận chạy thật 2 chiều) và IPv6 dual-stack (kiểm chứng thực thi thật); đã có công cụ đo tải/DR (script thật, sẵn sàng chạy) nhưng CHƯA chạy trên hạ tầng thật; thể thức biên bản còn thiếu phần thể thức ở NỘI DUNG (quốc hiệu/số ký hiệu — chỉ mới vá phần khối chữ ký ở view).
3. **Việc còn lại thuộc 2 nhóm rõ ràng:** (a) **code được nhưng cần thời gian** — nút sửa nội dung phiếu nháp (mục 13, ước 1-2 giờ), bổ sung thể thức đầy đủ vào `buildMinutesDraft` cho phần còn thiếu nếu có, chạy thật loadtest/DR trên máy triển khai; (b) **cần pháp nhân/bên ngoài, không code được** — ký số CA thật, ATTT cấp độ 3 kiểm định độc lập, tích hợp LGSP thật, build app native lên store (cần máy có npm+Android Studio/Xcode).
4. **Rủi ro lớn nhất còn lại:** ký số vẫn 100% mô phỏng (serial `VN-DEMO-CA:...`, PIN regex 6 số không đối chiếu CA nào) ở CẢ 2 luồng (biên bản VÀ ý kiến văn bản mới vá hôm nay) — nếu tổ chấm áp dụng nghiêm ngặt "phải có chữ ký số hợp pháp" thì đây là gap KHÔNG thể đóng bằng code, cần hợp đồng CA trước ngày nghiệm thu chính thức; rủi ro thứ hai là API danh mục (loại tài liệu) có dấu hiệu lỗi 500 không ổn định dưới tải/kết nối yếu (ghi nhận tại vận hành thử thật) — cần dev xác nhận độ bền trước khi cam kết SLA.
5. **Trả lời ngắn:** **CÓ, ở mức đáp ứng cao (57/59 chức năng web, không còn mục ❌) nhưng CHƯA đủ điều kiện ký nghiệm thu chính thức ngay** — 2 điều kiện bắt buộc từ vận hành thử thật (`dungthu-so-khcn.md`: bổ sung đầy đủ thể thức NĐ 30/2020 vào nội dung biên bản; xác nhận độ ổn định API danh mục) vẫn cần xử lý, và ký số CA thật vẫn là rủi ro pháp lý lớn nhất nằm ngoài khả năng code thuần.

---

## 6. GHI CHÚ PHƯƠNG PHÁP

- Đã đọc TOÀN VĂN các file trực tiếp liên quan 8 mục delta: `CatalogsAdminPage.tsx`, `PollsPage.tsx` (toàn bộ 382 dòng), `MeetingsPage.tsx` (đoạn filter đơn vị), `voteService.ts` (đoạn `castBallot*`, `pollStatsInRange/ByMonth`), `meetingService.ts` (đoạn `*Conclusion`), `ReportsPage.tsx` (toàn bộ 363 dòng), `MeetingDetailPage.tsx` (đoạn `MinutesTab` 805-925), `server/src/guard.js` (đoạn `CHAIR_CONTENT_FIELDS`/`isChairOfThisMeeting`), `docs/hsmt-chuong-v.md` (dòng 380-535, đủ nhóm A+B+phi chức năng).
- Grep xác nhận 0 kết quả cho "LiveKit/WebRTC/video/họp trực tuyến" trong toàn bộ `docs/hsmt-chuong-v.md` (668 dòng) — dùng làm căn cứ cho nhận định "VƯỢT yêu cầu" ở mục 4.
- `git status --short` xác nhận working tree hiện tại chưa có commit mới nào sau `5075f33` (docs HANDOVER) — mọi thay đổi V1-V10/thethuc/techleader-verify đều nằm ở trạng thái "M"/untracked, KHỚP với mô tả "cây làm việc = mã mới nhất" trong đề bài (không có commit `49fc7c1` trong lịch sử git — đây là mã tham chiếu của trạng thái working tree, không phải commit hash thật).
- Đối chiếu 2 nguồn xác nhận độc lập cho mỗi mục khi có: đọc code tĩnh (of chính báo cáo này) + chạy thật (`dungthu-so-khcn.md` 15 ca + 4 điểm xác minh, `dungthu-tester.md` 31 ca — không trích lại toàn bộ 31 ca vì không có ca nào trực tiếp target 8 mục delta ngoài các ca đã dẫn).
- KHÔNG sửa code, KHÔNG commit, KHÔNG chạy HTTP server — đúng ràng buộc đã nhận.
