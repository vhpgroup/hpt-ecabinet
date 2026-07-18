# BÁO CÁO KIỂM CHỨNG HỌP TRỰC TUYẾN LIVEKIT (KẾT NỐI THẬT)

**Thời điểm:** 18/07/2026, ~13:25 (+07) · **Người thực hiện:** trưởng ca AI (trực tiếp, có bằng chứng ảnh + phản hồi API)
**Hạ tầng thử:** LiveKit Cloud, project `ecabinet-9uyxki4p.livekit.cloud` (API key/secret do chủ dự án cấp — ĐÃ KHUYẾN NGHỊ xoay key sau buổi test vì key được trao đổi qua kênh chat).

## Mục tiêu
Chứng minh chuỗi tích hợp họp trực tuyến của eCabinet hoạt động với LiveKit THẬT (không phải mô phỏng), ở mức sâu nhất có thể trong môi trường không có camera/micro vật lý.

## Kết quả — 4 lớp bằng chứng, tất cả PASS

| # | Lớp kiểm chứng | Cách làm | Kết quả |
|---|---|---|---|
| 1 | **Code mint token của eCabinet** (`server/src/rtc.js` — JWT HS256 tự ký bằng node:crypto, không SDK) | Import trực tiếp `rtcConfigured()`, `rtcUrl()`, `mintLiveKitToken()` với env thật | ✅ `rtcConfigured=true`; token join 399 ký tự sinh đúng cấu trúc grant LiveKit |
| 2 | **LiveKit Cloud chấp nhận token tự ký** | Gọi REST `POST /twirp/livekit.RoomService/ListRooms` với token HS256 ký cùng thuật toán | ✅ HTTP 200 — xác thực key hợp lệ + cách ký JWT của eCabinet ĐÚNG chuẩn LiveKit |
| 3 | **Trình duyệt thật join phòng** | Trang thử nghiệm nhúng inline thư viện `livekit-client` UMD (cùng cách app tải lúc chạy), token do rtc.js mint, `room.connect(wss://…)` từ Chrome thật (cloud) | ✅ **Kết nối thành công sau 649ms**, trạng thái `connected`, phòng `ecabinet-thu-nghiem`, định danh `hpt-test-agent`. Micro: `NotFoundError` (máy chủ không có thiết bị — đúng kỳ vọng); signaling + ICE hoàn tất |
| 4 | **Đối chứng phía máy chủ LiveKit** | Trong lúc trình duyệt giữ kết nối, gọi lại ListRooms từ sandbox | ✅ Phòng `ecabinet-thu-nghiem` (sid `RM_nSnWEGkFA5bj`) tồn tại, **`num_participants: 1`**, codecs H264/VP8/VP9/AV1 + opus sẵn sàng |

## Kết luận
- **Toàn bộ phần eCabinet chịu trách nhiệm đã được kiểm chứng với dịch vụ thật**: cấu hình gating theo env, mint access token (JWT HS256 tự viết), tương thích thư viện livekit-client, join phòng qua WSS.
- **Phần CHƯA kiểm chứng (không thể trong môi trường máy chủ):** truyền media 2 chiều thật (camera/micro/chia sẻ màn hình giữa ≥2 thiết bị) — cần chạy trên bản triển khai chế độ máy chủ + 2 thiết bị thật có camera.

## Hướng dẫn test media thật (15 phút, trên VPS/máy triển khai)
1. Đặt 3 biến môi trường cho service `api`: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (đã có sẵn — nên XOAY secret mới trên cloud.livekit.io trước).
2. Khởi động lại; kiểm `GET /api/rtc/config` trả `{"enabled":true}`.
3. Hai người đăng nhập 2 tài khoản trên 2 thiết bị có camera → cùng vào một phiên họp → trang Họp trực tuyến → cấp quyền camera/micro.
4. Kiểm: thấy hình/tiếng hai chiều, chia sẻ màn hình, rời phòng — phòng tự đóng sau 5 phút trống (`empty_timeout: 300`).

## Ghi chú an toàn
- Trang thử nghiệm công khai (chứa token join hạn 1 giờ) đã được GỠ ngay sau buổi test; token join chỉ cấp quyền vào 1 phòng thử, không lộ API secret.
- API secret KHÔNG được đưa vào repo/commit; chỉ nằm trong môi trường tạm của phiên làm việc.
- Khuyến nghị: xoay (rotate) API secret trên LiveKit Cloud vì đã trao đổi qua kênh chat.
