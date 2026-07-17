// ============================================================
// Cấu hình Capacitor — đóng gói frontend eCabinet thành app Android/iOS.
// KHÔNG viết lại UI: WebView nạp thẳng bản build web ở thư mục "dist".
//
// Lưu ý quan trọng về ORIGIN:
//  - App native nạp nội dung từ scheme cục bộ (Android: https://localhost
//    do androidScheme='https'; iOS: capacitor://localhost). Đây KHÔNG phải
//    origin của máy chủ, nên địa chỉ API/WS được cấu hình LÚC CHẠY trong app
//    (màn đăng nhập -> "Đổi máy chủ") — xem src/data/apiBase.ts.
//  - androidScheme='https' để WebView chạy trong ngữ cảnh "secure" (getUserMedia
//    cho camera/mic của họp video LiveKit yêu cầu HTTPS/secure context).
//  - Máy chủ cần cho phép CORS các origin: capacitor://localhost,
//    ionic://localhost, http://localhost, https://localhost (xem docs/mobile-app.md).
//
// Cài đặt & build đầy đủ: docs/mobile-app.md (chạy ở máy dev có npm).
// ============================================================
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'vn.hpt.ecabinet',   // ID gói ứng dụng (đảo ngược tên miền)
  appName: 'eCabinet',        // Tên hiển thị dưới icon
  webDir: 'dist',             // Thư mục build web (do scripts/build-cdn.mjs / npm run build tạo)
  server: {
    androidScheme: 'https',   // WebView Android chạy trên https://localhost (secure context)
  },
};

export default config;
