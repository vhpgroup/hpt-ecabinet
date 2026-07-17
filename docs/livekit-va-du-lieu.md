# LiveKit và dữ liệu bên thứ 3 — đối chiếu HSMT mục 4 (sở hữu & chuyển giao dữ liệu)

**Yêu cầu HSMT liên quan** (dòng 643, mục 4 "Sở hữu & chuyển giao dữ liệu"): *"Không chia sẻ dữ liệu cho bên thứ 3 khi chưa được phép"*. Tài liệu này đối chiếu yêu cầu này với 2 phương án chạy **họp trực tuyến WebRTC qua LiveKit** (README mục 6) đang có trong hệ thống, vì đây là điểm dữ liệu **âm thanh/hình ảnh cuộc họp** có khả năng đi qua hạ tầng ngoài kiểm soát trực tiếp của đơn vị vận hành nếu chọn sai phương án.

---

## 1. Hai phương án — khác nhau về nơi dữ liệu media đi qua

| | LiveKit Cloud | LiveKit self-host |
|---|---|---|
| **Nơi media (audio/video/chia sẻ màn hình) đi qua** | Hạ tầng SFU của LiveKit Inc. (dịch vụ SaaS bên thứ 3, có mức dùng thử miễn phí) | Máy chủ do đơn vị vận hành tự quản lý, đặt tại **TTDL TP Hải Phòng** hoặc hạ tầng do đơn vị kiểm soát |
| **Ai lưu trữ nội dung media** | LiveKit Inc. (theo chính sách của họ — cần đọc kỹ Terms of Service/Privacy Policy nếu quyết định dùng) | Không ai ngoài đơn vị vận hành — dữ liệu không rời khỏi hạ tầng do TP quản lý |
| **Đối chiếu HSMT dòng 643** ("không chia sẻ dữ liệu cho bên thứ 3 khi chưa được phép") | **CÓ RỦI RO** — media đi qua hạ tầng LiveKit Inc. (một bên thứ 3) trong quá trình truyền tải thời gian thực, dù không nhất thiết "lưu trữ vĩnh viễn" | **KHÔNG có rủi ro này** — toàn bộ nằm trong hạ tầng do TP/đơn vị vận hành kiểm soát |
| **Khuyến nghị sử dụng** | **CHỈ pilot/demo/POC** — thử nghiệm nhanh, không cần lo cổng UDP/TURN/TLS, phù hợp giai đoạn chứng minh khái niệm trước khi có hạ tầng chính thức | **Khi vận hành chính thức** (production, dữ liệu họp thật của các xã/phường/đặc khu) — bắt buộc để tuân thủ nguyên tắc "dữ liệu không rời khỏi kiểm soát của đơn vị vận hành" |

**Lưu ý về bản chất kỹ thuật của WebRTC/SFU:** ngay cả với LiveKit Cloud, đây không phải "gửi file cho bên thứ 3 lưu trữ vĩnh viễn" theo nghĩa thông thường (dữ liệu media truyền theo luồng thời gian thực qua SFU, không mặc định ghi lại trừ khi bật tính năng recording) — nhưng luồng media **có đi qua** hạ tầng của bên thứ 3 trong thời gian thực, và cấu hình/metadata phòng họp (tên phòng, số người tham gia) cũng đi qua hạ tầng đó khi mint token/kết nối. Vì HSMT không định nghĩa chi tiết "chia sẻ dữ liệu" có bao gồm dữ liệu truyền qua (in-transit) hay chỉ dữ liệu lưu trữ (at-rest), **cách an toàn nhất về mặt tuân thủ là coi cả hai đều thuộc phạm vi cần "được phép"** — do đó khuyến nghị self-host là phương án duy nhất phù hợp cho vận hành chính thức, trừ khi có văn bản cho phép rõ ràng từ chủ đầu tư về việc dùng LiveKit Cloud.

---

## 2. Cơ chế gate hiện có trong hệ thống

Hệ thống đã có sẵn cơ chế **gate bằng biến môi trường** (README mục 6, `deploy/.env.example`) — **KHÔNG có LiveKit nào chạy nếu không chủ động cấu hình**:

```env
LIVEKIT_URL=            # để trống -> mô phỏng
LIVEKIT_API_KEY=        # để trống -> mô phỏng
LIVEKIT_API_SECRET=     # để trống -> mô phỏng
```

- **Mặc định (3 biến trống) → giao diện MÔ PHỎNG**, không có kết nối WebRTC thật, không có dữ liệu media nào rời khỏi trình duyệt của người dùng. An toàn tuyệt đối về mặt "chia sẻ dữ liệu cho bên thứ 3" vì không có bên thứ 3 nào được gọi tới.
- **Đặt `LIVEKIT_URL=wss://<project>.livekit.cloud` + API Key/Secret của LiveKit Cloud** → chuyển sang họp thật, media đi qua LiveKit Cloud (rủi ro như bảng mục 1).
- **Đặt `LIVEKIT_URL=wss://rtc.<domain-tự-host>` + API Key/Secret tự cấu hình** → chuyển sang họp thật, media đi qua máy chủ tự host (không rủi ro chia sẻ bên thứ 3).

**Kiểm tra nhanh trạng thái hiện tại:** `GET /api/rtc/config` trả `{"enabled":true}` khi đã cấu hình bất kỳ phương án nào (endpoint này không phân biệt Cloud hay self-host — cần xem giá trị `LIVEKIT_URL` thật trong `.env`/biến môi trường server để biết đang dùng phương án nào).

---

## 3. Khuyến nghị hành động

1. **Trong giai đoạn demo/pilot với tổ chấm thầu hoặc thử nghiệm ban đầu**: có thể dùng LiveKit Cloud (nhanh, đơn giản) — nhưng **cần ghi rõ trong hồ sơ/biên bản demo** rằng đây là cấu hình tạm cho mục đích demo, không phải cấu hình vận hành chính thức, để tránh hiểu nhầm khi đối chiếu với HSMT dòng 643.
2. **Trước khi vận hành chính thức (production) tại TTDL TP Hải Phòng**: PHẢI chuyển sang self-host LiveKit theo hướng dẫn đã có ở README mục 6 "Cách 2 — Tự host LiveKit (self-host)" (mở firewall cổng 7880/tcp, 7881/tcp, dải UDP 50000-60000, cấu hình TURN, subdomain riêng cho media).
3. **Nếu không dùng đến họp video WebRTC thật trong phạm vi gói thầu này** (ví dụ chỉ cần họp trực tiếp tại phòng họp, không cần điểm cầu video đa địa điểm): **giữ nguyên mặc định (3 biến trống)** — giao diện mô phỏng đáp ứng đủ nhu cầu demo/UI mà không phát sinh bất kỳ câu hỏi tuân thủ nào về dữ liệu bên thứ 3. Đây là lựa chọn AN TOÀN NHẤT nếu chưa có quyết định rõ ràng từ chủ đầu tư về việc có bắt buộc họp video WebRTC thật hay không.
4. **Ghi vào văn bản cam kết bảo mật thông tin** (tài liệu hồ sơ dự thầu riêng, chưa có trong repo — xem báo cáo đánh giá bên mời thầu mục "Danh mục hồ sơ bắt buộc") — nêu rõ: hệ thống có cơ chế gate cho phép LỰA CHỌN không chia sẻ dữ liệu media cho bên thứ 3 (self-host), và mặc định an toàn khi chưa cấu hình là không kết nối bên thứ 3 nào.

---

## 4. Trạng thái kiểm chứng

Đây là ghi chú đối chiếu chính sách/kiến trúc dựa trên đọc code thật (`deploy/docker-compose.pilot.yml`, `server/src/rtc.js`, README mục 6) — không phải văn bản pháp lý, không thay thế tư vấn từ đơn vị có thẩm quyền về an toàn thông tin/Ban Cơ yếu Chính phủ nếu dữ liệu cuộc họp thuộc diện "bí mật nhà nước" (mục này nằm ngoài phạm vi kỹ thuật, cần tư vấn riêng — xem `docs/hsmt-chuong-v.md` dòng 645/649 về "tuân thủ cơ yếu, Pháp lệnh bảo vệ bí mật nhà nước").
