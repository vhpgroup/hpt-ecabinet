# Đóng gói eCabinet thành app Android / iOS bằng Capacitor

Tài liệu này hướng dẫn **đóng gói frontend eCabinet hiện có** (React + TS, build
esbuild) thành ứng dụng di động Android/iOS bằng [Capacitor](https://capacitorjs.com/)
**mà KHÔNG viết lại UI**. WebView của app nạp thẳng bản build web ở thư mục `dist/`.

> Các bước dưới đây chạy ở **máy dev có Node.js + npm** (và Android Studio / Xcode).
> Trong repo này, registry npm bị chặn nên **không cài** `@capacitor/*` được — repo
> chỉ chuẩn bị sẵn code, khung cấu hình và tài liệu.

---

## 0. Vì sao cần cấu hình máy chủ lúc chạy (điểm mấu chốt)

Bản web chạy **cùng origin** với máy chủ, nên:
- API base `/api` (tương đối) trỏ đúng máy chủ.
- URL WebSocket suy từ `location.origin` cũng đúng.

App native **KHÔNG cùng origin**: nội dung nạp từ `https://localhost` (Android) hoặc
`capacitor://localhost` (iOS). Nếu giữ `/api` tương đối và suy WS từ `location`, app
sẽ trỏ vào **chính nó** → hỏng đăng nhập, tài liệu, realtime.

Giải pháp đã cài trong mã nguồn: **địa chỉ máy chủ phân giải lúc chạy** qua
`src/data/apiBase.ts`, theo thứ tự ưu tiên:

1. `localStorage['ecabinet.serverUrl']` — người dùng nhập trong app (màn Đăng nhập → **Đổi máy chủ**).
2. `import.meta.env.VITE_API_URL` — đóng cứng lúc build (nếu có).
3. rỗng → chế độ demo cục bộ (LocalStorage).

Nhờ (1), có thể **build app MỘT lần** rồi trỏ tới **bất kỳ máy chủ nào** — chỉ cần
người dùng nhập URL trong app. `apiBase.ts` cũng tự dựng URL WebSocket đúng
(`https://host/api` → `wss://host/api/realtime`).

**Contract API/WS KHÔNG đổi**: path `/api/...`, header `Authorization: Bearer`,
shape body, path WS `/realtime` giữ nguyên — chỉ đổi cách _resolve_ base URL.

---

## 1. Cài Capacitor

```bash
cd ecabinet

# Lõi + CLI
npm install @capacitor/core
npm install -D @capacitor/cli

# Nền tảng
npm install @capacitor/android
npm install @capacitor/ios
```

`capacitor.config.ts` đã có sẵn ở **gốc dự án**:

```ts
appId: 'vn.hpt.ecabinet'
appName: 'eCabinet'
webDir: 'dist'                    // thư mục build web
server: { androidScheme: 'https' } // WebView Android chạy https://localhost (secure context)
```

> `androidScheme: 'https'` là bắt buộc để `getUserMedia` (camera/mic họp video
> LiveKit) hoạt động — trình duyệt chỉ cho phép trong **secure context**.

---

## 2. Build web (`dist/`)

Có **2 lựa chọn**:

### Lựa chọn A — App đa máy chủ (khuyến nghị): KHÔNG đặt VITE_API_URL
```bash
npm run build          # hoặc: node scripts/build-cdn.mjs
```
App build một lần, **người dùng nhập địa chỉ máy chủ ngay trong app** (màn Đăng
nhập → “⚙ Đổi máy chủ”). Panel **tự mở** trong app native khi chưa cấu hình.
Phù hợp khi phát hành cho nhiều đơn vị / máy chủ khác nhau.

### Lựa chọn B — Đóng cứng một máy chủ: đặt VITE_API_URL
```bash
VITE_API_URL=https://ecabinet.example.gov.vn/api npm run build
# hoặc: VITE_API_URL=https://ecabinet.example.gov.vn/api node scripts/build-cdn.mjs
```
App luôn trỏ tới máy chủ này. Người dùng vẫn có thể tạm đổi máy chủ trong app
(ghi đè bằng `localStorage`), nhưng mặc định là URL đã đóng cứng.

> Kiểm tra build thành công: log in ra `✔ dist/index.html sẵn sàng`.
> **Sau MỖI lần đổi mã web phải build lại rồi `npx cap sync`** (xem mục 4).

---

## 3. Thêm nền tảng

```bash
npx cap add android
npx cap add ios        # cần macOS + Xcode
```

Lệnh này tạo thư mục `android/` và `ios/` (dự án gốc Gradle / Xcode).

---

## 4. Đồng bộ & mở IDE

```bash
npx cap sync           # copy dist/ vào android|ios + cập nhật plugin
npx cap open android   # mở Android Studio
npx cap open ios       # mở Xcode
```

Từ IDE: Run để chạy trên máy ảo/thiết bị; hoặc Build để tạo APK/AAB/IPA.

> Quy trình lặp: sửa web → `npm run build` → `npx cap sync` → Run.

---

## 5. Quyền ứng dụng (BẮT BUỘC cho họp video)

Họp trực tuyến dùng LiveKit (WebRTC) cần **camera + micro**.

### Android — `android/app/src/main/AndroidManifest.xml`
Thêm trong thẻ `<manifest>` (trước `<application>`):
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```
> `INTERNET` gần như luôn có sẵn; ba quyền còn lại cần cho họp video.
> Nếu dùng plugin `@capacitor/camera`/tải tệp, cân nhắc thêm quyền lưu trữ theo
> hướng dẫn plugin (Android 13+ dùng `READ_MEDIA_*`).

### iOS — `ios/App/App/Info.plist`
Thêm các khóa mô tả quyền (chuỗi tiếng Việt hiển thị cho người dùng):
```xml
<key>NSCameraUsageDescription</key>
<string>Ứng dụng cần truy cập camera để bạn tham gia họp trực tuyến bằng hình ảnh.</string>
<key>NSMicrophoneUsageDescription</key>
<string>Ứng dụng cần truy cập micro để bạn phát biểu trong phiên họp trực tuyến.</string>
```
> Thiếu các khóa này, iOS sẽ **crash** khi app xin camera/mic.

---

## 6. Icon & Splash screen

Dùng công cụ chính thức tạo icon/splash từ 1 ảnh nguồn:
```bash
npm install -D @capacitor/assets
# Đặt logo tại: assets/icon.png (1024x1024) và assets/splash.png (2732x2732)
npx capacitor-assets generate --android --ios
```
Công cụ sinh đầy đủ kích cỡ và đặt vào `android/` + `ios/`.

---

## 7. Phát hành Android (AAB + Google Play)

1. Tạo keystore (giữ **an toàn tuyệt đối** — mất là không cập nhật app được):
   ```bash
   keytool -genkey -v -keystore ecabinet.keystore -alias ecabinet \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Khai báo ký trong `android/app/build.gradle` (`signingConfigs.release`) hoặc
   dùng Android Studio → **Build → Generate Signed Bundle / APK → Android App Bundle**.
3. Tạo **AAB** bản `release`.
4. Lên [Google Play Console](https://play.google.com/console): tạo ứng dụng, tải AAB
   lên track Nội bộ/Thử nghiệm → Sản xuất; điền phân loại nội dung, chính sách
   quyền riêng tư, ảnh chụp màn hình.

## 8. Phát hành iOS (Signing + TestFlight)

1. Trong Xcode: **Signing & Capabilities** → chọn Team (Apple Developer Program),
   bật **Automatically manage signing**, đặt Bundle Identifier `vn.hpt.ecabinet`.
2. **Product → Archive** để tạo bản lưu trữ.
3. **Distribute App → App Store Connect → Upload**.
4. Trong [App Store Connect](https://appstoreconnect.apple.com): tạo app, phát hành
   qua **TestFlight** để thử nội bộ trước khi nộp App Review.

---

## 9. CORS máy chủ (bắt buộc cho app native)

App native gọi API từ origin cục bộ, nên **máy chủ phải cho phép CORS** các origin:

```
capacitor://localhost
ionic://localhost
http://localhost
https://localhost
```

> Máy chủ eCabinet đã cấu hình cho phép các origin này (do nhóm backend phụ trách;
> `nginx.conf` / cấu hình server nằm ngoài phạm vi frontend). Nếu triển khai máy chủ
> mới, đảm bảo whitelist đủ các origin trên cho cả REST `/api` và WebSocket `/realtime`.

---

## 10. Đối chiếu nhanh 38 mục mobile E-HSMT (mục 60–97) → UI hiện có

Toàn bộ 38 mục mobile dùng chung UI web đã đóng gói (không cần màn hình riêng cho
native). Bảng đối chiếu nhóm chức năng → trang trong app:

| Nhóm mục (E-HSMT 60–97) | Chức năng mobile | Trang UI hiện có |
|---|---|---|
| 60–63 | Đăng nhập, phiên, đổi máy chủ, hồ sơ | `LoginPage` (kèm panel Đổi máy chủ), `AppContext` |
| 64–68 | Danh sách/chi tiết phiên họp, giấy mời, lịch | `MeetingsPage`, `MeetingDetailPage`, `CalendarPage`, `DashboardPage` |
| 69–73 | Tài liệu: xem, tải, ghi chú cá nhân, chia sẻ | `DocumentsPage`, `MeetingDetailPage` (tab tài liệu) |
| 74–77 | Điểm danh, đăng ký phát biểu, hàng đợi phát biểu | `LiveMeetingPage`, `MeetingDetailPage` |
| 78–82 | Biểu quyết / lấy ý kiến điện tử, xem kết quả | `PollsPage`, `LiveMeetingPage`, `MeetingDetailPage` |
| 83–86 | Họp trực tuyến (video/mic LiveKit) | `OnlineMeetingPage`, `LiveMeetingPage` |
| 87–90 | Hỏi đáp / chất vấn, tin nhắn phiên họp | `MeetingDetailPage` (hỏi đáp), chat realtime |
| 91–94 | Nhiệm vụ sau họp, kết luận, thông báo đẩy | `TasksPage`, `NotificationsPage` |
| 95–97 | Biên bản điện tử, ký số, tra cứu lịch sử | `MeetingDetailPage` (biên bản/ký), `HelpPage` |

> Ghi chú: cập nhật thời gian thực (realtime WebSocket) áp dụng xuyên suốt các mục
> họp trực tiếp (điểm danh, phát biểu, biểu quyết, chat) qua `src/data/realtime.ts`.

---

## 11. Checklist kiểm thử app

- [ ] **Đổi máy chủ**: mở app native lần đầu → panel “Đổi máy chủ” tự mở → nhập URL
      máy chủ thật → **Kiểm tra** hiện ✓ → **Lưu & kết nối** → app khởi động lại.
- [ ] **Đăng nhập máy chủ thật**: đăng nhập bằng tài khoản thật (không phải demo),
      nhận JWT, vào được Dashboard.
- [ ] **Chuẩn hóa URL**: nhập `https://host` (không `/api`) vẫn kết nối đúng
      (`apiBase` tự thêm `/api`).
- [ ] **Realtime**: mở một phiên họp trên 2 thiết bị → thao tác ở máy A (biểu quyết,
      phát biểu) → máy B cập nhật tức thời (WebSocket `wss://.../api/realtime`).
- [ ] **Camera/Mic (cần HTTPS)**: vào họp trực tuyến → app xin quyền camera/mic →
      thấy hình + tiếng (kiểm chứng `androidScheme: 'https'` + quyền Manifest/Plist).
- [ ] **Tài liệu**: mở, tải, ghi chú tài liệu; ảnh/PDF hiển thị đúng.
- [ ] **Đổi sang máy chủ khác**: vào Đăng nhập → Đổi máy chủ → nhập URL khác → kết
      nối lại đúng máy chủ mới.
- [ ] **Về bản demo** (chỉ bản build Lựa chọn A): nút “Về bản demo” xóa cấu hình,
      quay lại dữ liệu mẫu cục bộ.
- [ ] **Đăng xuất / hết phiên**: đăng xuất thu hồi refresh token; token hết hạn tự
      gia hạn (refresh) rồi gọi lại API.

---

## 12. Bổ sung `.gitignore` (làm ở máy dev — KHÔNG sửa trong repo này)

Sau khi `npx cap add`, thêm các dòng sau vào `.gitignore` để **không commit** thư
mục nền tảng và phụ thuộc (chúng tái tạo được bằng `cap add` / `npm install`):

```gitignore
# Capacitor native
/android/
/ios/
/node_modules/
```

> Lưu ý: tài liệu này **chỉ ghi chú**; không tự sửa `.gitignore` của repo.

---

## Tóm tắt 3 việc cần làm ở máy có npm để ra app

1. `npm install @capacitor/core @capacitor/android @capacitor/ios && npm install -D @capacitor/cli`
   rồi **build web**: `npm run build` (đa máy chủ) *hoặc*
   `VITE_API_URL=https://domain/api npm run build` (đóng cứng máy chủ).
2. `npx cap add android` (và `npx cap add ios` trên macOS) → `npx cap sync`.
3. Thêm quyền (Manifest: INTERNET/CAMERA/RECORD_AUDIO/MODIFY_AUDIO_SETTINGS; Plist:
   NSCamera/NSMicrophone), tạo icon/splash (`@capacitor/assets`), rồi
   `npx cap open android|ios` để Build/ký và phát hành (AAB + Play / Archive + TestFlight).
