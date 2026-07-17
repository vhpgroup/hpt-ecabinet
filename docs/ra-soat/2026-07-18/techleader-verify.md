# Báo cáo kiểm chứng độc lập (Tech Leader) — dự án eCabinet

**Người thực hiện:** Thép — Tech Leader (subagent kiểm chứng)
**Ngày:** 2026-07-17
**Repo:** `/agent/workspace/hpt-ecabinet` — nhánh `main`, HEAD `5075f33` (commit gần nhất: "docs: hồ sơ bàn giao dự án (HANDOVER) + 2 báo cáo phân tích E-HSMT")
**Phương pháp:** trust-but-verify — chỉ tin vào build/test/đọc mã thực tế, không tin lời tài liệu. Không sửa file, không commit/push.

---

## 1. Build frontend — KẾT QUẢ: PASS

```
node scripts/fetch-deps.mjs   → ✔ Hoàn tất tải dependencies (react, react-dom, scheduler, react-router-dom, react-router, @remix-run/router)
node scripts/build-cdn.mjs    → ✔ Đồng bộ server/src/seed.mjs → ✔ Bundle xong → ✔ dist/index.html sẵn sàng
```

Output kiểm chứng: `dist/index.html` (700KB, chứa app bundle + CSS inline), `dist/assets/`, `dist/manifest.webmanifest`, `dist/sw.js`, `dist/favicon.svg`. Không có lỗi/warning esbuild. npm registry đúng như dự đoán bị chặn trong sandbox — không thử `npm install`, dùng đúng đường tải-sẵn-qua-CDN như tài liệu mô tả.

## 2. Backend .NET — KẾT QUẢ: PASS (build 0 lỗi, test 72/72)

Cài dotnet SDK 8 thành công qua `dot.net/v1/dotnet-install.sh --channel 8.0` → **8.0.423**, không gặp chặn mạng.

```
dotnet build server-dotnet/ECabinet.sln
  → Build succeeded. 0 Warning(s). 0 Error(s). (16.79s)

dotnet run --project server-dotnet/ECabinet.Tests
  → 1-AUTH          9/9
    2-ACL           9/9
    3-ACCESS       11/11
    4-GUARD        14/14
    5-ACTIONS/CAS  11/11
    6-OPEN/RTC     14/14
    7-WS            4/4
    TỔNG:          72/72 PASS  ✅
```

Kết quả **khớp chính xác** với tuyên bố của `docs/HANDOVER.md` dòng 21/38 ("72/72 PASS qua TestHost"). Không có ca fail, không cần liệt kê exception.

## 3. Backend Node — smoke test bằng import hàm trực tiếp (KHÔNG mở HTTP/socket)

Ràng buộc "tuyệt đối không chạy HTTP server rồi curl" được tuân thủ nghiêm: viết script `/tmp/smoketest/smoke.mjs` (nằm ngoài repo, absolute-path import — không copy file vào `server/src/`) import trực tiếp 6 module thuần của `server/src/`: `auth.js`, `acl.js`, `guard.js`, `router.js`, `rtc.js`, `open.js` (chỉ phần hàm không cần DB: `parsePaging`, `isPublishableDoc`, `extractApiKey`, `authenticateApiKey`, `handleUnitMeetings`, `handleMeetingDetail`).

**Kết quả: 41/41 PASS** — bao gồm: hash/verify mật khẩu (scrypt), sign/verify JWT HS256, ma trận ACL (`allowed()` cho từng rule `roles/self/ownerOrManage`), `validatePatch`/`guardPatch` (chặn kiểu sai, khóa field nhạy cảm votes/ballots), `Router` (path-matching + params + OPTIONS→204 + 404), `mintLiveKitToken` (JWT LiveKit đúng cấu trúc `video.room`), và các hàm nghiệp vụ Open API (phân trang, publishable-doc filter, xác thực API key theo scope, ẩn `minutes`/`conclusions` khỏi payload Open API).

Không phát hiện lỗi logic nào ở tầng module thuần. Module `db.js` (cần PGlite/WASM Postgres) không được test trực tiếp — nằm ngoài phạm vi cho phép của ràng buộc (không mở server), nhưng vì `db.js` chỉ là tầng SQL passthrough mỏng dùng chung 1 mã SQL cho cả Postgres/PGlite, rủi ro tại đây thấp hơn nhiều so với logic nghiệp vụ đã kiểm.

## 4. Parity contract Node ⇄ .NET

Đối chiếu **toàn bộ** cặp file tương ứng (không chỉ đọc lướt): `index.js`↔`App.cs`, `actions.js`↔`Actions.cs`, `open.js`↔`OpenRoutes.cs`, `rtc.js`↔`Rtc.cs`, `ws.js`↔`Ws.cs`, `router.js`↔`Http/Router.cs`, `guard.js`↔`Guard.cs`, `acl.js`↔`Acl.cs`, `access.js`↔`Access.cs`.

**Kết luận chung: đây là một trong những port .NET trung thực nhất tôi từng kiểm — logic khớp gần như từng dòng**, kể cả các chi tiết dễ bỏ sót (thứ tự đăng ký route để tránh route CRUD chung "vồ" nhầm path cụ thể; công thức ngưỡng biểu quyết `majority/two_thirds/all`; "khi không đổi `reviewStatus` thì xóa `reviewedById/reviewedAt` cũ"; logic ủy quyền chỗ ngồi `delegateOwnRowOnly`).

### 4 nhóm nhạy cảm — đối chiếu chi tiết

| Nhóm | Route | Node | .NET | Lệch? |
|---|---|---|---|---|
| `/api/actions/*` | `vote/:id/ballot` (CAS) | `mutateDoc` optimistic lock | `MutateDocAsync` + `MutateOutcome` | Không — cùng thứ tự kiểm tra, cùng mã lỗi 400/403/404 |
| | `vote/:id/open`, `/close` | check role/createdBy → mutate → notify → audit | giống 1:1 | Không |
| | `meetings/:id/checkin` (CAS) | no-op nếu đã điểm danh | `MutateOutcome.NoChange()` giống | Không |
| | `meetings/:id/sign` (CAS) | PIN regex `^\d{6}$`, hash SHA-256 nội dung phía server | `Regex.IsMatch(@"^\d{6}$")`, `Sha256Hex` | Không |
| `/api/open/v1/*` | 7 route + `/spec` + `/health` | hàm thuần `handleXxx(params,query,accessors)` | `HandleXxx` static, cùng field, cùng thứ tự đăng ký (`/meetings/:id/documents` trước `/meetings/:id`) | Không |
| | Xác thực khóa API | sha256(key) so `keyHash` active; rate-limit theo `prefix` | giống 1:1 | Không |
| `/api/rtc/*` | `config`, `token` (mint LiveKit JWT) | HS256 tự ký bằng `node:crypto` | `HMACSHA256` .NET, cùng payload `iss/sub/name/nbf/iat/exp/video.{roomJoin,room,canPublish,canSubscribe,canPublishData}` | Không |
| WebSocket `/api/realtime` | Handshake RFC 6455 tự viết (Node) vs WebSocket built-in ASP.NET Core (.NET) | Cơ chế bắt tay khác nhưng **hợp đồng với FE giữ nguyên**: path, `?token=` JWT tại upgrade, message `{type:'hello',name,at}` / `{type:'change',collection,action,id,at}` | Quyết định kỹ thuật hợp lý, không phải lỗ hổng |

### Lệch thật (nhỏ, có chủ đích, đã tự khai báo trong code/README)

1. **Băm mật khẩu**: Node dùng `scrypt`, .NET dùng `PBKDF2-SHA256` (210.000 vòng) vì .NET BCL không có scrypt. Có comment giải thích rõ trong `Auth.cs` dòng 22-26 và README mục 11. Không ảnh hưởng contract API (chỉ đổi định dạng lưu trong DB nội bộ, 2 backend có DB độc lập).
2. **CORS mobile**: .NET bổ sung origin `capacitor://localhost`, `ionic://localhost`, `http://localhost` mặc định (tắt bằng `MOBILE_CORS=off`) — cải tiến chủ đích cho app di động Capacitor, Node không có tương đương. Ghi rõ trong `App.cs` dòng 88-132 và README dòng 405-406.
3. **`/health` field `db`**: Node trả `"postgresql"|"pglite"`, .NET trả `"sqlserver"|"inmemory"` — chuỗi khác nhau nhưng field và semantics (đang dùng DB thật hay bộ nhớ) tương đương; không phải bug vì đây là 2 backend độc lập, không có client nào so sánh chuỗi cross-backend.

**Không phát hiện lệch nào ảnh hưởng đến tính đúng đắn nghiệp vụ hoặc bảo mật** trong 4 nhóm route nhạy cảm.

## 5. Đối chiếu yêu cầu kỹ thuật HSMT Chương V (668 dòng, đọc toàn văn)

Ký hiệu: ✅ ĐÁP ỨNG · 🟡 MỘT PHẦN · 🔴 CHƯA

| # | Yêu cầu HSMT | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | Nền tảng lập trình .NET | ✅ ĐÁP ỨNG | `server-dotnet/` ASP.NET Core 8, build 0 lỗi (mục 2). |
| 2 | Hệ QTCSDL MS SQL Server 2022+ | 🟡 MỘT PHẦN | `SqlServerDocStore.cs` viết theo cú pháp `Microsoft.Data.SqlClient` 5.2.2 (đúng driver), `docker-compose.dotnet.yml` dùng image `mcr.microsoft.com/mssql/server:2022-latest`. **NHƯNG chưa từng chạy thành công trên instance MSSQL thật** — README dòng 414 tự thừa nhận "chưa kiểm thử trên SQL Server thật trong môi trường sandbox"; 72/72 test chỉ chạy qua `InMemoryDocStore`. Đây là rủi ro thực sự: code SQL (câu lệnh, kiểu dữ liệu, `ISJSON`, CAS bằng `WHERE data=@old`) chưa có bằng chứng thực thi. |
| 3 | Hệ điều hành máy chủ Windows Server 2019+ (hoặc Linux) | 🔴 CHƯA (đối với nhánh Windows+IIS) | `server-dotnet/Dockerfile` build trên `mcr.microsoft.com/dotnet/aspnet:8.0` — **image Linux**, không phải Windows Server. README mục "Triển khai Windows Server + IIS" (dòng 416-422) chỉ là **outline 6 bước dạng văn bản mô tả**, không có `web.config`, publish profile, PowerShell script, hoặc bất kỳ artifact đã build/test trên Windows thật. HSMT chấp nhận cả Windows Server hoặc Linux cho OS máy chủ nói chung, nhưng bảng cấu hình máy chủ đề xuất trong HSMT (dòng 318-322) ghi rõ Database/Web/App-Server đều là **Windows Server** — nếu bên mời thầu diễn giải cứng theo bảng này thì gap là thật. |
| 4 | Hệ điều hành máy trạm Windows 10+ | ✅ ĐÁP ỨNG (không ràng buộc gì đặc biệt, ứng dụng web chuẩn) | Không có code phụ thuộc OS máy trạm. |
| 5 | Hỗ trợ trình duyệt phổ dụng (Edge/Firefox/Chrome) | ✅ ĐÁP ỨNG | SPA React chuẩn, không dùng API riêng browser (trừ Web Speech API cho ghi biên bản giọng nói — tính năng phụ, có fallback). |
| 6 | TLS 1.2+ cho HTTPS | 🟡 MỘT PHẦN | Biến thể **Node/pilot** có `deploy/Caddyfile` (Caddy tự xin Let's Encrypt, TLS tự động ≥1.2). Biến thể **.NET dự thầu** (`docker-compose.dotnet.yml`) **KHÔNG có TLS termination nào** — `web` service chỉ chạy `nginx.conf` cổng 80 thuần HTTP, README mục "Windows Server+IIS" bước 6 chỉ ghi "cấp chứng thư TLS hợp lệ" như một *lưu ý* chứ không phải cấu hình đã làm. Cần bổ sung Caddy/nginx-TLS hoặc IIS binding HTTPS cho nhánh .NET trước khi demo/nghiệm thu. |
| 7 | IPv6-ready | 🔴 CHƯA kiểm chứng | Không tìm thấy dòng code nào tham chiếu IPv6 explicit (bind `::`, `AF_INET6`). ASP.NET Core Kestrel về lý thuyết hỗ trợ dual-stack theo mặc định OS, nhưng **không có bằng chứng đã test** — cần khai báo rõ trong hồ sơ kỹ thuật thay vì để ngầm định "framework tự lo". |
| 8 | Unicode TCVN 6909:2001 | 🟡 MỘT PHẦN | Toàn hệ thống dùng UTF-8 nhất quán (`Content-Type: application/json; charset=utf-8` ở cả `util.js` và `HttpUtil.cs`; `Json.cs` dòng 19 "Giữ nguyên Unicode tiếng Việt không escape — parity với Node"). UTF-8 tương thích về mặt kỹ thuật với TCVN 6909:2001 (Unicode tiếng Việt) nhưng **chưa có tài liệu/test case chứng minh tuân thủ chuẩn cụ thể** này (ví dụ test round-trip các ký tự có dấu tổ hợp, chuẩn hóa NFC/NFD) — cần bổ sung phần "tuân thủ tiêu chuẩn" trong hồ sơ kỹ thuật dự thầu, không chỉ dựa vào "UTF-8 nói chung là ổn". |
| 9 | Định dạng tệp theo TT 39/2017/TT-BTTTT | 🔴 CHƯA kiểm chứng | Không tìm thấy validation định dạng file khi upload tài liệu (chỉ thấy field `mime` lưu tùy ý trong `documents`, không có whitelist định dạng theo Thông tư). Cần bổ sung validate MIME/extension theo phụ lục TT 39/2017 khi nhận file. |
| 10 | Sao lưu/phục hồi dữ liệu định kỳ | 🟡 MỘT PHẦN | `deploy/backup.sh` + `deploy/restore.sh` hoạt động, nhưng **chỉ hỗ trợ PostgreSQL** (`pg_dump -U ecabinet ecabinet`) — biến thể .NET/SQL Server dự thầu **hoàn toàn không có script backup/restore** tương ứng (không thấy `sqlcmd BACKUP DATABASE` hay tương đương). Đây là gap cần vá trước khi coi là "đáp ứng" cho nhánh nộp thầu chính thức. |
| 11 | Giám sát 24/7, cảnh báo tự động | 🔴 CHƯA | Chỉ có endpoint `/health` đơn giản (kiểm 1 query + đếm `realtimeClients`) và `healthcheck:` ở tầng Docker Compose (dùng cho container orchestration tự restart, không phải giám sát ứng dụng liên tục có cảnh báo). Không có tích hợp Prometheus/Grafana/ELK hay cơ chế cảnh báo (email/SMS/webhook) khi có sự cố. HSMT mục 4.4.3 yêu cầu "giám sát liên tục 24/7 + cảnh báo tự động" — đây là gap vận hành thật, thường được giải quyết ở tầng hạ tầng Trung tâm dữ liệu TP (do đơn vị quản lý TTDL chịu trách nhiệm theo phân công tại HSMT mục "Tổ chức thực hiện quản trị, vận hành"), nhưng phần mềm/API tự thân **chưa xuất log/metric theo chuẩn** (không có structured logging, không expose endpoint metrics). |
| 12 | HA / chuyển mạch tự động khi thay thành phần (mục 4.4.2) | 🔴 CHƯA | Phát hiện quan trọng: **rate-limit** (`RateLimit.cs`/`ratelimit.js`) và **WebSocket realtime client registry** (`Ws.cs`/`ws.js`) đều dùng **state tĩnh trong 1 tiến trình** (`ConcurrentDictionary`/`Map` static, không qua DB/Redis). Nếu triển khai nhiều instance Web/App-Server (đúng như bảng cấu hình HSMT đề xuất "Web-Server ×2", "App-Server ×2" cho HA) đứng sau load balancer: (a) rate-limit theo IP sẽ không đồng bộ giữa instance (giảm hiệu quả chống brute-force, không phải lỗi nghiệp vụ); (b) **client A kết nối WebSocket vào instance 1 sẽ không nhận được broadcast từ một ghi CRUD xảy ra ở instance 2** — tính năng realtime "đẩy sự kiện" sẽ hoạt động không đầy đủ trong cấu hình multi-instance, cần thêm pub/sub chia sẻ (Redis) trước khi triển khai HA thật. Refresh-token/session (`Sessions.cs`) thì OK vì đã lưu qua `IDocStore` (DB), không có gap này. |
| 13 | Mã hóa cơ yếu khi lưu trữ/truyền (mục 3.7, "dữ liệu thuộc diện bắt buộc phải mã hóa") | 🔴 CHƯA | Không tìm thấy bất kỳ mã hóa nội dung dữ liệu tại rest (AES trên `documents.content`/`meetings.minutes`, TDE ở tầng SQL Server, hay Always Encrypted trên cột). Cơ chế bảo vệ hiện tại là **hash một chiều** cho mật khẩu (scrypt/PBKDF2) và refresh token (SHA-256) — đúng thực hành, nhưng KHÔNG phải "mã hóa cơ yếu" theo nghĩa HSMT yêu cầu (dùng thuật toán mật mã được cấp phép — liên quan Pháp lệnh bảo vệ bí mật nhà nước, Ban Cơ yếu Chính phủ). README dòng 269 liệt "mã hóa at-rest" trong bảng **"Lộ trình tiếp theo (đề xuất)"** — tức là README tự nhận đây CHƯA làm, không phải nói quá; nhưng cách trình bày (gộp chung với "phân quyền chi tiết" đã có) dễ gây hiểu lầm khi đọc lướt. |
| 14 | Xử lý đồng thời (mục "Xử lý đồng thời — Yêu cầu truy cập dữ liệu đồng thời tại mọi thời điểm") | ✅ ĐÁP ỨNG (đã kiểm test thật) | CAS (`mutateDoc`/`MutateDocAsync`) chống mất phiếu/mất điểm danh/mất chữ ký khi ghi đồng thời — có test case thực nghiệm: "10 phiếu bỏ SONG SONG (Task.WhenAll) → đủ 10 phiếu (CAS không mất)" **PASS** trong bộ 72 test (mục 2). Đây là bằng chứng thực nghiệm mạnh, không chỉ lý thuyết. |
| 15 | Kiểm tra dữ liệu đầu vào, cô lập lỗi người dùng | ✅ ĐÁP ỨNG | `validatePatch`/`ValidatePatch` (schema kiểu cho từng collection, 393-442 dòng mỗi bên) chặn 400 trước khi ghi; đã smoke-test PASS (mục 3: "chặn participants sai kiểu", "chặn progress ngoài 0-100"). |
| 16 | Kết nối liên thông LGSP/NGSP, sẵn sàng cung cấp API | ✅ ĐÁP ỨNG (khung sẵn sàng — đặc tả cụ thể LGSP TP thì chưa có) | `/api/open/v1/*` 7 route + `/spec` (OpenAPI 3.0 JSON công khai) đúng 6 mục 54-59 HSMT (cuộc họp đơn vị/cá nhân sắp tới/đã qua, chi tiết cuộc họp, tài liệu cuộc họp), xác thực X-API-Key theo scope, rate-limit riêng. Đây là khung kỹ thuật đúng chuẩn REST/OpenAPI, nhưng **chưa có đặc tả LGSP Hải Phòng cụ thể** (endpoint đăng ký dịch vụ trên Trục LGSP, format XML theo Công văn 3788/BTTTT-THH nếu bên mời thầu yêu cầu XML thay JSON) — đúng như HANDOVER mục 4 item 5 đã tự nhận "chờ đặc tả TP". |
| 17 | Chức năng nghiệp vụ web (mục 3.4, 97 mục A+B) | 🟡 MỘT PHẦN (không tự kiểm chứng lại toàn bộ — ngoài phạm vi nhiệm vụ này) | HANDOVER tuyên bố "58/59 mục web đáp ứng, còn thiếu ký số PKI thật". Nhiệm vụ này **không yêu cầu** rà lại từng mục chức năng (đó là việc của BA/Tester), chỉ xác nhận: mục "ký số biên bản" (Actions.cs `meetings/:id/sign`) đúng là **mô phỏng** — PIN 6 số bất kỳ được chấp nhận, `serial` sinh ngẫu nhiên dạng `VN-DEMO-CA:...`, KHÔNG gọi CA thật (VNPT SmartCA/VGCA) — khớp đúng với tuyên bố "đang mô phỏng" của HANDOVER, không nói quá. |
| 18 | Nghiệm thu theo Nghị định 73/2019/NĐ-CP + TT 16/2024/TT-BTTTT | 🔴 CHƯA (việc pháp nhân, ngoài phạm vi code) | Đây là quy trình hành chính (vận hành thử có giám sát, lập báo cáo kết quả vận hành thử) — không thể "code" được, cần hoạt động thật với chủ đầu tư. |

### Lưu ý quan trọng về diễn giải bảng cấu hình máy chủ HSMT

Bảng cấu hình đề xuất trong HSMT (dòng 318-322 của `docs/hsmt-chuong-v.md`) ghi **Database-Server, Web-Server, App-Server đều Windows Server**, chỉ **File-Server là Ubuntu Server**. Đây là kiến trúc 4 tầng (Web/App/DB/File tách riêng) — repo hiện tại chỉ có kiến trúc 2 tầng đơn giản (nginx phục vụ tĩnh + 1 process API .NET) đóng gói Docker Linux, KHÔNG khớp với mô hình 4-tầng-2-node-mỗi-tầng mà HSMT đề xuất. Đây là gap kiến trúc triển khai (không phải gap code logic) — cần làm rõ với bên mời thầu liệu bảng cấu hình này là **bắt buộc** hay chỉ **gợi ý tham khảo** (thường trong HSMT VN, các bảng "cấu hình đề xuất" là để tính điểm/tham chiếu, không phải điều khoản cứng — nhưng cần xác nhận, không tự suy diễn).

## 6. Kết luận

### (a) Đối chiếu tuyên bố HANDOVER/README với thực tế

| Tuyên bố | Đúng/Sai | Ghi chú |
|---|---|---|
| "web 58/59 mục đáp ứng, còn ký số PKI thật" | **Không tự kiểm chứng lại 58/59** (ngoài phạm vi), nhưng phần ký số đã kiểm = **ĐÚNG là mô phỏng**, không nói quá. |
| ".NET port 72/72 test PASS" | **ĐÚNG 100%** — đã tự chạy lại, kết quả khớp chính xác. |
| "server-dotnet đáp ứng nền tảng .NET+MSSQL+Windows Server của HSMT" | **NÓI QUÁ MỘT PHẦN**: .NET ✅ đúng, MSSQL 🟡 (code viết đúng nhưng chưa chạy thật trên instance MSSQL), Windows Server 🔴 (Dockerfile build Linux, chưa có bất kỳ artifact Windows/IIS thật nào — chỉ có outline văn bản). Câu "port 1:1... đáp ứng yêu cầu nền tảng của E-HSMT" ở README dòng 331 dễ khiến người đọc tin rằng cả 3 yêu cầu nền tảng đã được thỏa mãn đầy đủ, trong khi thực chất mới là "code tương thích, hạ tầng thật chưa triển khai/kiểm thử". |
| "mã hóa at-rest" (README dòng 269) | **Không sai về bản chất** — nằm trong bảng "Lộ trình tiếp theo (đề xuất)", tức tự nhận CHƯA làm. Nhưng cách trình bày gộp cùng dòng với các mục đã hoàn thành dễ gây đọc lướt nhầm. Khuyến nghị tách rõ "đã có" / "đề xuất" thành 2 cột hoặc 2 dòng riêng khi cập nhật tài liệu lần tới. |
| "nhật ký bất biến" (README dòng 269) | **Không hoàn toàn đúng theo nghĩa chặt** — `ACL.audit.remove = ['admin']` cho phép admin xóa nhật ký (đây là tính năng chủ đích đáp ứng đúng HSMT mục 3 "Xóa nhật ký đăng nhập hệ thống", không phải bug), nên nhật ký "bất biến với người thường, có thể xóa bởi admin" — chính xác hơn là gọi "bất biến" không kèm điều kiện. |
| "Chưa test tích hợp trên MSSQL instance thật" (HANDOVER mục 4) | **ĐÚNG, đã xác nhận độc lập** — không tìm thấy bằng chứng nào cho thấy `SqlServerDocStore` đã từng chạy thành công với MSSQL thật trong repo (không có log, không có CI record, README tự thừa nhận). |

**Tổng thể: HANDOVER/README trung thực ở mức cao hơn phần lớn dự án tương tự** — các gap lớn (ký số mô phỏng, MSSQL chưa test thật, Windows/IIS chỉ outline) đều được **tự khai báo rõ trong tài liệu**, không bị giấu. Điểm "nói quá" duy nhất đáng chú ý là câu tổng quát ở README dòng 331 ("đáp ứng yêu cầu nền tảng của E-HSMT") nên được làm rõ ràng hơn theo bảng 3-cột (.NET/MSSQL/Windows Server) với trạng thái riêng từng cột, thay vì 1 câu khẳng định chung.

### (b) TOP việc kỹ thuật tồn đọng — xếp ưu tiên

**Nhóm A — code được ngay trong đêm (không cần bên ngoài, không cần pháp nhân/hạ tầng thật):**

1. Viết script `deploy/backup-mssql.sh` + `deploy/restore-mssql.sh` dùng `sqlcmd`/`BACKUP DATABASE ecabinet TO DISK=...` — vá gap "sao lưu/phục hồi chỉ có cho PostgreSQL". File liên quan: `deploy/backup.sh`, `deploy/restore.sh` (tham khảo cấu trúc), `docker-compose.dotnet.yml`.
2. Thêm TLS termination cho biến thể .NET (`docker-compose.dotnet.yml`): thêm service Caddy tương tự `deploy/Caddyfile` trỏ vào `web:80`, hoặc chuyển nginx sang cấu hình HTTPS tự ký cho demo nội bộ. File liên quan: `docker-compose.dotnet.yml`, `nginx.conf`, `deploy/Caddyfile` (mẫu).
3. Bổ sung validate định dạng file khi upload tài liệu (whitelist MIME/extension theo phụ lục TT 39/2017/TT-BTTTT: .docx/.pdf/.xlsx/.jpg/.png,...) vào `validatePatch`/`ValidatePatch` cho collection `documents`. File liên quan: `server/src/guard.js` (SCHEMA + validatePatch), `server-dotnet/ECabinet.Api/Guard.cs` (tương ứng).
4. Thêm structured logging tối thiểu (ghi log JSON có timestamp/level/route/status vào file hoặc stdout theo format dễ ingest) để hỗ trợ yêu cầu "giám sát 24/7" — chưa cần Prometheus đầy đủ, chỉ cần log có cấu trúc thay `console.log` tùy ý. File liên quan: `server/src/index.js`, `server-dotnet/ECabinet.Api/App.cs`, `Program.cs`.
5. Viết test case round-trip Unicode (chuỗi tiếng Việt có dấu tổ hợp, emoji, ký tự đặc biệt) qua toàn bộ pipeline lưu/đọc để có **bằng chứng** tuân thủ Unicode/TCVN 6909:2001 thay vì chỉ dựa vào "UTF-8 nói chung". File liên quan: `server-dotnet/ECabinet.Tests/TestRunner.cs`, tương tự phía Node (viết thêm vào bộ smoke test).
6. Cân nhắc thêm ghi chú/README rõ ràng về giới hạn HA hiện tại (rate-limit + WebSocket realtime là per-process, cần Redis pub/sub khi scale nhiều instance) để tránh đội vận hành sau này bị bất ngờ khi triển khai multi-instance thật. File liên quan: `server/src/ratelimit.js`, `server/src/ws.js`, `server-dotnet/ECabinet.Api/RateLimit.cs`, `server-dotnet/ECabinet.Api/Ws.cs`, `README.md`.
7. Sửa câu README dòng 331 ("port 1:1... đáp ứng yêu cầu nền tảng của E-HSMT") thành diễn đạt tách 3 cột trạng thái riêng (.NET ✅ / MSSQL 🟡 chưa test instance thật / Windows+IIS 🔴 chỉ outline) để tránh nói quá khi trình bày cho chủ đầu tư.

**Nhóm B — cần pháp nhân/đối tác/hạ tầng thật (không code được, cần tài khoản/hợp đồng/dịch vụ ngoài):**

8. Ký số VGCA/VNPT SmartCA thật — cần tài khoản CA + tích hợp SDK thật (hiện tại `Actions.cs`/`actions.js` mục `/sign` chỉ mô phỏng serial ngẫu nhiên).
9. Chạy thử `docker compose -f docker-compose.dotnet.yml up` với MSSQL container thật (cần máy có RAM ≥2GB cho container `db`, môi trường Docker đầy đủ — sandbox hiện tại không đủ để verify) để xác nhận `SqlServerDocStore` hoạt động đúng với 72 test case, không chỉ InMemory.
10. Triển khai thử nghiệm thật trên Windows Server + IIS theo outline README mục 11 để biến "outline 6 bước" thành bằng chứng đã build/publish/chạy thật (`web.config`, IIS site, WebSocket Protocol feature) — hiện tại 0% đã kiểm chứng thực tế trên Windows.
11. Hồ sơ ATTT cấp độ 3 chính thức + kiểm tra bảo mật bằng phần mềm chuyên dụng (pentest độc lập) theo đúng yêu cầu mục 3.1/3.4 HSMT — không lỗ hổng nào được đánh giá cấp độ 3+.
12. Xác nhận với bên mời thầu: bảng cấu hình máy chủ 4-tầng-Windows-Server (dòng 318-322 HSMT) là bắt buộc cứng hay chỉ tham khảo — ảnh hưởng trực tiếp đến việc có cần dựng lại kiến trúc triển khai 4-node hay giữ nguyên 2-tầng Docker hiện tại.
13. Đặc tả kỹ thuật LGSP Hải Phòng cụ thể (endpoint đăng ký, có yêu cầu XML theo Công văn 3788/BTTTT-THH hay JSON/OpenAPI hiện tại là đủ) — cần làm rõ với chủ đầu tư/đơn vị quản lý Trục LGSP trước khi coi mục 54-59 là "đã đấu nối được".
14. Mã hóa cơ yếu cho dữ liệu bắt buộc mã hóa (mục 3.7 HSMT) — cần tư vấn/thẩm định từ đơn vị có thẩm quyền về mật mã (liên quan Ban Cơ yếu Chính phủ nếu dữ liệu thuộc diện bí mật nhà nước), không tự ý chọn thuật toán mã hóa mà không có hướng dẫn chính thức.
