# Kiểm tra tải (Load Test) — eCabinet

**Công cụ:** `scripts/loadtest.mjs` — Node.js thuần, không phụ thuộc npm (chỉ dùng `fetch`/`AbortController` built-in của Node ≥18). Mục đích: có **số liệu thật** đối chiếu với SLA hiệu năng của HSMT gói thầu (Sở KH&CN TP Hải Phòng), thay cho tình trạng "chưa có benchmark tải thực tế" đã bị hai báo cáo đánh giá độc lập (`reports/techleader-verify.md`, `reports/danhgia-benmoithau.md`) nêu là **THIẾU BẰNG CHỨNG**.

**Trạng thái:** script đã kiểm `node --check` (cú pháp hợp lệ) và kiểm logic percentile độc lập. **CHƯA chạy thử thật trong sandbox** (không có server đang phục vụ để nhắm tới, nền tảng sandbox chặn mở HTTP server/tiến trình dài). Cần chạy trên máy triển khai thật theo hướng dẫn dưới đây trước khi đưa số liệu vào hồ sơ SLA chính thức.

---

## 1. Ngưỡng SLA cần đạt (theo HSMT, trích `docs/hsmt-chuong-v.md`)

| Chỉ tiêu | Giá trị HSMT | Cách script này đo |
|---|---|---|
| Thời gian đáp ứng thao tác | < 5 giây/thao tác | p95 độ trễ theo từng thao tác + tổng thể (script in bảng "Đạt <5s?" từng dòng) |
| Số người dùng đồng thời | ≥ 500 người dùng, 90 CCU (concurrent users) | Biến `CCU` (mặc định 90) — mỗi CCU là 1 "phiên ảo" lặp kịch bản liên tục |
| Tìm kiếm nhiều điều kiện | < 30 giây | Không có endpoint tìm kiếm đa điều kiện riêng trong kịch bản mặc định — nếu cần đo, thêm bước gọi endpoint tìm kiếm thật của hệ thống (xem mục 5 "Mở rộng kịch bản") |
| Báo cáo tổng hợp toàn TP | < 5 phút, không timeout | Ngoài phạm vi script này (cần dữ liệu nhiều năm/nhiều đơn vị thật — script chỉ đo API giao dịch thông thường) |

**Lưu ý quan trọng:** đạt ngưỡng trên **KHÔNG tự động nghĩa là "đáp ứng SLA chính thức"** — SLA chính thức cần: (a) chạy trên đúng hạ tầng sizing như HSMT đề xuất (không phải máy dev), (b) chạy đủ thời gian đại diện (không chỉ 1-2 phút), (c) có biên bản/log đầy đủ đưa vào hồ sơ nghiệm thu. Script này cung cấp **công cụ + số liệu thô**, không thay thế quy trình vận hành thử chính thức theo Nghị định 73/2019/NĐ-CP.

---

## 2. Cách chạy trên máy triển khai (KHÔNG chạy trong sandbox này)

### Bước 0 — Yêu cầu

- Node.js ≥ 18 (có `fetch`/`AbortController` built-in) trên máy chạy loadtest — **không cần cùng máy với server đích**, nhưng khuyến nghị chạy loadtest từ máy khác server để không lẫn tài nguyên CPU/RAM của loadtest (đơn luồng Node) vào kết quả đo của server (xem mục 4 "Giới hạn của công cụ").
- Server đích đã chạy và có dữ liệu seed mẫu (biến thể Node: `docker compose up -d --build`; biến thể .NET: `docker compose -f docker-compose.dotnet.yml up -d --build`).

### Bước 1 — Chạy nhanh với cấu hình mặc định (biến thể Node/pilot, cổng 8080)

```bash
BASE_URL=http://localhost:8080 node scripts/loadtest.mjs
```

Mặc định: `CCU=90`, `DURATION_S=120` (2 phút), dùng bộ 13 tài khoản demo có sẵn (round-robin), test trên `MEETING_ID=m1` / `VOTE_ID=v1` (khớp seed mẫu).

### Bước 2 — Chạy đúng theo ngưỡng HSMT (90 CCU, thời gian dài hơn để có số liệu ổn định)

```bash
BASE_URL=https://<domain-thật> \
CCU=90 \
DURATION_S=300 \
OUT_JSON=./loadtest-result-90ccu-$(date +%Y%m%d).json \
  node scripts/loadtest.mjs
```

### Bước 3 — Chạy cho biến thể .NET (cổng 8081, hoặc domain riêng nếu đã bật TLS profile — xem README mục 11)

```bash
BASE_URL=http://localhost:8081 CCU=90 DURATION_S=300 node scripts/loadtest.mjs
```

### Bước 4 — Test dưới ngưỡng trước (khuyến nghị quy trình tăng dần, không nhảy thẳng 90 CCU)

Chạy trước với CCU thấp (10, 30, 60) để xác nhận hệ thống ổn định trước khi thử 90 CCU — tránh trường hợp 90 CCU ngay từ đầu làm sập hệ thống mà không rõ ngưỡng chịu tải thật là bao nhiêu:

```bash
for ccu in 10 30 60 90; do
  echo "=== CCU=$ccu ==="
  CCU=$ccu DURATION_S=60 OUT_JSON=./loadtest-ccu-$ccu.json node scripts/loadtest.mjs
  sleep 10   # nghỉ giữa các lần chạy để hệ thống hạ nhiệt, tránh dồn tải chồng lấp
done
```

---

## 3. Đọc kết quả

### Output trên console

```
BẢNG ĐỘ TRỄ THEO THAO TÁC (ms) — đối chiếu ngưỡng HSMT <5000ms/thao tác
  Thao tác        Số lần    p50       p95       p99       max       Đạt <5s?
  ----------------------------------------------------------------------------
  login           90        120       340       410       520       ĐẠT
  list_meetings   1800      45        180       220       350       ĐẠT
  meeting_detail  1800      50        195       240       380       ĐẠT
  documents       1800      60        210       260       400       ĐẠT
  vote_ballot     1800      80        250       310       450       ĐẠT
  open_spec       1800      30        110       140       200       ĐẠT

  TỔNG THỂ: p50=55ms · p95=210ms · p99=280ms
  SLA HSMT "<5s/thao tác": ĐẠT (p95 tổng thể < 5000ms)
  SLA HSMT "90 CCU đồng thời không lỗi hàng loạt": ĐẠT (error rate < 1%)
```
*(số liệu ví dụ minh họa cách đọc — KHÔNG phải số liệu đã đo thật, chưa chạy trong sandbox)*

### Cách diễn giải các trường quan trọng

- **p95 (không phải p50/trung bình)** là số nên đối chiếu với ngưỡng "<5 giây" của HSMT — vì SLA thường được hiểu là "phần lớn thao tác" (95%) phải đạt, không phải "trung bình" (trung bình dễ bị lệch lạc quan bởi các request nhanh chiếm đa số).
- **`hardErrors` vs `businessErrors`**: script tách 2 loại lỗi.
  - `businessErrors` (bỏ qua, KHÔNG tính vào error rate): lỗi nghiệp vụ hợp lệ khi lặp lại kịch bản nhiều lần trên seed cố định — ví dụ "đã biểu quyết nội dung này" (400), "rate-limit đăng nhập" (429) khi nhiều phiên ảo dùng chung tài khoản. Đây là **tính năng đang hoạt động đúng**, không phải lỗi hạ tầng.
  - `hardErrors` (tính vào error rate, cần điều tra nếu > 1%): 5xx, timeout, lỗi network, hoặc 401/403 không mong đợi. Đây là dấu hiệu **hệ thống không chịu được tải** — nếu tỷ lệ này cao ở 90 CCU, đó là gap thật cần khắc phục trước khi cam kết SLA với chủ đầu tư.
- **File JSON xuất ra (`OUT_JSON`)** chứa toàn bộ sample thô (từng request: thao tác, thời gian, status) — dùng để vẽ biểu đồ chi tiết hoặc đính kèm phụ lục hồ sơ SLA nếu bên mời thầu yêu cầu bằng chứng đầy đủ (không chỉ số tổng hợp).

---

## 4. Giới hạn của công cụ (đọc để tránh diễn giải sai kết quả)

1. **Không phải công cụ load test chuyên dụng** (k6, Gatling, JMeter, Artillery) — đây là script HTTP đơn giản viết bằng Node thuần theo đúng ràng buộc "không phụ thuộc npm". Đủ để có SỐ LIỆU THẬT thay "chưa đo hoàn toàn", nhưng ở quy mô lớn hơn 90 CCU hoặc cần phân tích sâu (phân phối theo percentile chi tiết hơn, biểu đồ theo thời gian, distributed load từ nhiều máy) nên chuyển sang công cụ chuyên dụng.
2. **Chạy đơn luồng Node** — ở CCU rất cao (vài trăm+), chính tiến trình Node chạy loadtest có thể trở thành nút cổ chai (event loop bận xử lý fetch callback) trước khi server đích bị quá tải, khiến số liệu đo được là "giới hạn của công cụ đo" chứ không phải "giới hạn của hệ thống đích". Ở mức 90 CCU (đúng ngưỡng HSMT) rủi ro này thấp, nhưng nếu mở rộng CCU lên nhiều để tìm điểm giới hạn thật của hệ thống, cần theo dõi CPU của MÁY CHẠY LOADTEST song song với máy server.
3. **Không mô phỏng trình duyệt thật** — không tải JS/CSS/ảnh/font, không thực thi React render, không mở WebSocket realtime. Đây là load test tầng API/HTTP, phản ánh đúng "backend chịu được tải" nhưng không đo trải nghiệm người dùng cuối đầy đủ (thời gian tải trang lần đầu, render UI).
4. **Kịch bản biểu quyết dùng seed cố định** — sau vài vòng lặp, hầu hết request biểu quyết sẽ trả lỗi nghiệp vụ dự kiến ("đã biểu quyết rồi") vì seed không tự sinh nội dung biểu quyết mới. Điều này KHÔNG làm sai số liệu độ trễ (script vẫn đo đúng thời gian phản hồi của chính request đó, dù nó trả lỗi 400) nhưng có nghĩa là số liệu "vote_ballot thành công" sẽ giảm dần theo thời gian chạy — chấp nhận được cho mục đích đo độ trễ/tải, không phù hợp nếu mục đích là đo "tỷ lệ biểu quyết thành công".
5. **Rate-limit của chính hệ thống có thể ảnh hưởng kết quả** — `RATE_LIMIT_MAX` (mặc định 300 req/60s/IP) và `LOGIN_RATE_MAX` (mặc định 10 lần/15 phút/IP+tài khoản) đang hoạt động đúng thiết kế bảo mật (README mục 3 "Rate-limit GĐ4"). Khi chạy loadtest từ 1 máy (1 IP), tổng RPS của toàn bộ 90 phiên ảo có thể chạm `RATE_LIMIT_MAX` và bị 429 — đây là giới hạn CÓ CHỦ ĐÍCH chống brute-force, không phải bug. Nếu muốn đo hiệu năng thuần (loại trừ rate-limit), tạm tăng `RATE_LIMIT_MAX`/`LOGIN_RATE_MAX` qua biến môi trường của server khi chạy loadtest, rồi trả lại giá trị production sau khi đo xong — ghi rõ trong báo cáo SLA là đã tạm nới rate-limit để đo hiệu năng thuần túy.

---

## 5. Mở rộng kịch bản (tùy chọn, khi cần đo sâu hơn)

- **Thêm bước tìm kiếm đa điều kiện** (đối chiếu ngưỡng "<30s" của HSMT): thêm 1 `timedFetch` gọi đúng endpoint tìm kiếm/lọc cuộc họp của hệ thống (kiểm tra route thật trong `server/src/index.js`/`server-dotnet/ECabinet.Api/App.cs` trước khi thêm, vì endpoint tìm kiếm đa điều kiện có thể chưa tồn tại riêng — nếu chưa có, đây là gap cần nêu, không phải lỗi của loadtest).
- **Đo qua nhiều máy chạy loadtest song song** (để vượt giới hạn 1 máy đơn — mục 4.2): chạy cùng lệnh trên 2-3 máy khác nhau với `CCU` chia đều (ví dụ 30 CCU/máy × 3 máy = 90 CCU tổng), gộp file JSON kết quả lại để tính percentile tổng thể.
- **Đưa vào biểu đồ**: file `OUT_JSON` có mảng `samples` (mỗi sample có `op`, `ms`, `at` — timestamp) — có thể nạp vào công cụ vẽ biểu đồ (Excel, Python matplotlib, Grafana nếu có sẵn) để trực quan hóa độ trễ theo thời gian, hữu ích khi trình bày cho tổ nghiệm thu.

---

## 6. Đưa số liệu vào hồ sơ SLA / hồ sơ dự thầu

Khi đã chạy thật trên máy triển khai và có số liệu, nên đưa vào hồ sơ theo cấu trúc:

1. **Mô tả môi trường đo**: cấu hình máy chủ (CPU/RAM), phiên bản OS/DB, số CCU, thời gian chạy, ngày đo.
2. **Bảng kết quả tóm tắt** (copy từ output console: p50/p95/p99 theo thao tác + tổng thể, RPS, error rate).
3. **Kết luận đạt/không đạt** theo từng ngưỡng HSMT (bảng mục 1 ở trên).
4. **Đính kèm file JSON đầy đủ** (`OUT_JSON`) làm phụ lục — cho phép tổ nghiệm thu tự kiểm tra lại nếu cần.
5. **Ghi rõ giới hạn công cụ** (mục 4 ở trên) — minh bạch về phương pháp đo giúp tăng độ tin cậy của số liệu, tránh bị đánh giá "số liệu tự công bố không kiểm chứng được".

**Khuyến nghị:** chạy diễn tập này SONG SONG với diễn tập DR (`deploy/test-restore.sh`, xem `docs/dr-runbook.md`) trong cùng 1 đợt kiểm thử trước nghiệm thu — cả 2 đều tạo bằng chứng số liệu thật để nộp cùng hồ sơ SLA, tránh phải làm riêng 2 lần trên 2 môi trường khác nhau.
