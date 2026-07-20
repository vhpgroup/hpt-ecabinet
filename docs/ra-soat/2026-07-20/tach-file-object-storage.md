# TÁCH NỘI DUNG TỆP ĐÍNH KÈM RA KHỎI CSDL → OBJECT STORAGE S3/MinIO

**Người thực hiện:** Khôi — Backend Architect dự án eCabinet (HPT TECH)
**Ngày:** 20/07/2026
**Nhiệm vụ:** Tách nội dung tệp (PDF/Word/Excel/ảnh) khỏi cột JSON của CSDL, lưu vào object storage S3-compatible — đúng mô hình "Cụm Server-File" của HSMT, chống phình DB.
**Đầu vào:** báo cáo hiện trạng `docs/ra-soat/2026-07-20/luu-tru-file-hsmt.md` (đã xác minh: base64 nằm trong `DocFile.dataUrl`/`GuideDoc.fileData` trong cột JSON bảng chung; MinIO đã comment sẵn trong compose; lệch size 15↔25MB).
**Ràng buộc tuân thủ:** KHÔNG thêm dependency (npm/NuGet) · KHÔNG test S3 thật trong sandbox (dùng mock + test-vector) · TƯƠNG THÍCH NGƯỢC + GATED · GIỮ NGUYÊN API contract với FE · Parity 2 backend · KHÔNG commit git.

---

## 1. THIẾT KẾ CHỐT

### 1.1. Tầng blobStore (2 backend, parity)
- **Node**: `server/src/blob.js` — hàm thuần + `blobStore { configured(), put(key,bytes,ct), get(key)->Buffer, delete(key) }` (impl S3 qua `fetch`).
- **.NET**: `server-dotnet/ECabinet.Api/Store/BlobStore.cs` — `interface IBlobStore` + `S3BlobStore` (qua `HttpClient`) + lớp static `Blob` (SigV4 + tách/dựng thuần).
- **KHÔNG có impl "InlineNull" riêng**: khi S3 tắt (`configured()==false`), các điểm móc **không gọi** blobStore — bản ghi giữ base64 trong DB y như cũ. Đây chính là hành vi "InlineNull" nhưng thực thi bằng nhánh `if (configured())` tại điểm móc, đơn giản và ít bề mặt lỗi hơn (ghi rõ điều chỉnh so với đề xuất ban đầu).

### 1.2. Khóa lưu trữ (storage key)
- Tài liệu: `documents/<docId>/v<version>.<ext>` — ổn định theo version (E-HSMT có versioning, các version không đè nhau).
- HDSD: `guides/<docId>/file.<ext>`.
- `ext` suy từ tên tệp, fallback theo mime, cuối cùng `bin`.

### 1.3. Điểm móc (đường ghi/đọc CRUD chung — nơi FE thực sự đi qua)
| Hành động | Node (`server/src/index.js`) | .NET (`ECabinet.Api/App.cs`) |
|---|---|---|
| POST tạo | ~dòng 495: sau `validatePatch`, trước INSERT — `externalizeDocumentWrite/GuideWrite` | ~dòng 418: sau `ValidatePatch`, trước InsertAsync |
| PATCH sửa | ~dòng 590: trên `merged` trước UPDATE; trả về dựng lại dataUrl | ~dòng 510: trên `merged2` trước UpdateAsync |
| GET :id | ~dòng 449: `inlineDocumentRead/GuideRead` sau `readOne` | ~dòng 366: `Blob.InlineDocument/GuideReadAsync` sau `ReadOne` |
| LGSP nội dung | `open.js` `handleDocumentContent` + router dựng dataUrl, XÓA storageKey | `OpenRoutes.cs` `HandleDocumentContent` + handler dựng, XÓA storageKey |

### 1.4. Schema/guard (2 backend)
- `DocFile` thêm `storageKey?: string` (đã có `size`); `GuideDoc` thêm `storageKey?` — `src/domain/types.ts` (~dòng 230, 116). OPTIONAL, không phá tương thích.
- Guard SCHEMA cho phép field mới: `server/src/guard.js` (documents +`size`,`storageKey`; guides +`storageKey`); `Guard.cs` tương ứng. Whitelist định dạng tệp (TT 39/2017) nay coi **storageKey** cũng là "có tệp" → vẫn chặn đổi tên sang đuôi cấm.

### 1.5. Bảo mật (điểm quan trọng — KHÔNG nới lỏng)
- `storageKey` (khóa S3) **không bao giờ lộ ra client**: GET :id trả `dataUrl` dựng lại (giữ storageKey trong bản ghi nội bộ, FE bỏ qua); LGSP `/documents/{id}/content` **xóa storageKey** khỏi phản hồi trước khi trả.
- Lọc quyền đọc theo bản ghi (`access.js`/`Access.cs`, `isPublishableDoc`) chạy **trước** khi dựng nội dung — tài liệu mật/chưa duyệt vẫn 404 (đã có ca test khẳng định).
- Bucket khởi tạo là **private** (không mở đọc ẩn danh).

---

## 2. CƠ CHẾ GATED + TƯƠNG THÍCH NGƯỢC

| Trạng thái env | Hành vi ghi | Hành vi đọc |
|---|---|---|
| **Không đặt `S3_*`** (mặc định) | base64 giữ nguyên trong cột JSON (như cũ) | trả base64 như cũ |
| **Đặt đủ** `S3_ENDPOINT`,`S3_BUCKET`,`S3_ACCESS_KEY`,`S3_SECRET_KEY` (+`S3_REGION`=us-east-1, `S3_FORCE_PATH_STYLE`=true) | tệp MỚI: PUT S3, set `storageKey`+`size`, xóa `dataUrl` khỏi bản ghi | có storageKey → GET S3, dựng lại `dataUrl` |
| Bản ghi **CŨ** (chỉ dataUrl, không storageKey) khi S3 bật | — | trả nguyên dataUrl (không gọi S3) |

- Demo localStorage/dev/test cũ: không có env → **0 thay đổi hành vi** (đã kiểm: mọi ca cũ vẫn xanh).
- API contract giữ nguyên: FE vẫn POST/PATCH `dataUrl` base64, đọc lại nhận `dataUrl`. FE **không phải sửa gì**.

---

## 3. KÝ AWS SIGNATURE V4 (TỰ VIẾT, KHÔNG DEP)

- Giống cách mint JWT LiveKit (`rtc.js`/`Rtc.cs`): Node dùng `node:crypto` (HMAC-SHA256, SHA-256); .NET dùng `System.Security.Cryptography` (`HMACSHA256`, `SHA256`). Gọi S3 REST qua `fetch`/`HttpClient`.
- Header-based SigV4: canonical request → string-to-sign → khóa ký phái sinh (kDate→kRegion→kService→kSigning) → `Authorization: AWS4-HMAC-SHA256 ...`. `x-amz-content-sha256 = sha256(body)` (ký payload thật, không UNSIGNED). Path-style cho MinIO. RFC-3986 encode tự viết (giữ `/` trong key).
- **Kiểm đúng chuẩn bằng TEST VECTOR CHÍNH THỨC** (`aws-sig-v4-test-suite`), assert **byte**:
  - `get-vanilla`: canonicalRequest + stringToSign + signature `5fa00fa3…fbf31` + Authorization header — **khớp cả 2 backend**.
  - `get-vanilla-query-order-key-case`: signature `b97d918c…f2500` — khớp (xác minh sort query theo key đã encode).
  - `uriEncode`: space=%20, `~` giữ nguyên, `/` tùy chọn, UTF-8 tiếng Việt đúng byte.

---

## 4. KẾT QUẢ TEST (không cần S3 thật)

| Suite | Trước | Sau | Ca mới | FAIL |
|---|---|---|---|---|
| `node scripts/build-cdn.mjs` | PASS | **PASS** | — | 0 |
| `node server/test/smoke.mjs` | 92 | **105** | +13 (nhóm `11-BLOB-S3`) | 0 |
| `dotnet run --project server-dotnet/ECabinet.Tests` | 143 | **153** | +10 (nhóm `11-BLOB-S3`) | 0 |

Phủ: (a) **SigV4 test-vector AWS** (2 vector) + uriEncode; (b) data-URI decode/encode round-trip bytes; (c) tách/dựng round-trip với blobStore in-memory giả — bản ghi lưu có storageKey, KHÔNG dataUrl, đọc lại dựng đúng dataUrl gốc; (d) tương thích ngược S3 tắt (giữ base64) + bản ghi cũ đọc được; (e) tài liệu soạn tay (content) không externalize. Riêng .NET còn có **6 ca END-TO-END qua HTTP** (TestHost + `MemBlob` giả): POST→DB có storageKey/không dataUrl; GET dựng lại dataUrl khớp gốc; LGSP dựng + ẩn storageKey; **tài liệu MẬT vẫn 404** (giữ lọc quyền); guides parity; S3 tắt giữ base64.

---

## 5. HẠ TẦNG (đã cập nhật)

- `docker-compose.yml` + `docker-compose.dotnet.yml`: bật service **minio** (+ volume `ecabinet_minio`) + **minio-init** (tạo bucket private 1 lần, idempotent); thêm env `S3_*` cho service `api` (GATED, để trống mặc định). YAML đã validate.
- **Thống nhất giới hạn size = 25MB** (chọn 25MB vì backend đã enforce 25MB ở `nginx.conf` + `util.js`/`HttpUtil` — đổi ít bề mặt load-bearing nhất; và khi có S3 thì JSONB không còn là ràng buộc). Sửa FE `src/services/documentService.ts` 15→25MB. nginx (25m) và readBody (25MB) giữ nguyên (đã đúng).
- README `6.1` (mới) + `docs/HUONG-DAN-TRIEN-KHAI-VA-HSMT.md` `A3.1` (mới) + bảng B2 (dòng 3b).

---

## 6. HƯỚNG DẪN CHỦ DỰ ÁN KIỂM CHỨNG THẬT VỚI MinIO

Tạo `.env` cạnh compose:
```env
MINIO_USER=ecabinet
MINIO_PASSWORD=<mật-khẩu-mạnh>
S3_ENDPOINT=http://minio:9000
S3_BUCKET=ecabinet-docs
S3_ACCESS_KEY=ecabinet
S3_SECRET_KEY=<mật-khẩu-mạnh>
S3_FORCE_PATH_STYLE=true
```
Chạy (Node): `docker compose up -d --build` · (.NET): `DB_PASSWORD='MatKhauManh!123' docker compose -f docker-compose.dotnet.yml up -d --build`
→ compose khởi động thêm `minio` + `minio-init`. Console MinIO: `http://<máy-chủ>:9001`.

**Đăng nhập ứng dụng, tải 1 tài liệu PDF lên phiên họp, rồi kiểm:**
```bash
# (A) DB CHỈ có storageKey, KHÔNG có base64 (bản Node/PostgreSQL):
docker exec ecabinet-db psql -U ecabinet -d ecabinet \
  -c "SELECT data->>'name', data->>'storageKey', (data ? 'dataUrl') AS con_base64 FROM c_documents WHERE data ? 'storageKey';"
# kỳ vọng: storageKey='documents/<id>/v1.pdf', con_base64 = f
#   (bản .NET/SQL Server: SELECT JSON_VALUE(data,'$.storageKey'), JSON_VALUE(data,'$.dataUrl') FROM c_documents;)

# (B) Đối tượng có thật trong bucket:
#   Xem trên Console MinIO :9001 (bucket ecabinet-docs) HOẶC:
docker run --rm --network <mạng-compose> minio/mc sh -c \
  "mc alias set s3 http://minio:9000 $MINIO_USER $MINIO_PASSWORD && mc ls --recursive s3/ecabinet-docs"

# (C) FE hiển thị/tải tệp bình thường (backend dựng lại dataUrl từ S3) — mở lại tài liệu trong app.
```
Kết luận đạt: nội dung tệp **nằm ở bucket S3**, cột `data` trong DB **không** còn base64 (chỉ metadata + storageKey).

---

## 6bis. TỐI ƯU ĐỢT 2: PRESIGNED URL + DỌN S3 KHI XÓA (20/07/2026)

Hai tối ưu tiếp theo (đã ghi "việc sau" ở #7.1 và #7.7 báo cáo gốc), **cùng ràng buộc**: KHÔNG dep, KHÔNG S3 thật trong sandbox (mock + test-vector), tương thích ngược tuyệt đối, parity 2 backend, KHÔNG commit.

### 6bis.1. Ký PRESIGNED URL (SigV4 query-string) — tự viết, tái dùng logic ký
- Thêm hàm **thuần** `presignV4()` (Node `blob.js`) / `Blob.PresignV4()` (.NET `BlobStore.cs`): ký **SigV4 query-string** — `X-Amz-Algorithm/Credential/Date/Expires/SignedHeaders` nằm trong QUERY, `payloadHash='UNSIGNED-PAYLOAD'`, **chỉ ký `host`** (chuẩn tối thiểu cho presigned GET). Tái dùng `uriEncode`/`signingKey`/`amzDates` đã có (không lặp code).
- `blobStore.presignGetUrl(key, ttlSec, {filename, contentType})` (Node) / `IBlobStore.PresignGetUrl(...)` (.NET): dựng target path-style rồi gọi presignV4. TTL mặc định **300s** (env `S3_PRESIGN_TTL`, kẹp 1..604800). `filename` → gắn `response-content-disposition=attachment; filename="..."; filename*=UTF-8''...` (RFC 5987/6266 — tải đúng tên tiếng Việt). **KHÔNG log URL** (chứa chữ ký).
- **Kiểm chuẩn bằng ROUND-TRIP tự tính chéo** (mạnh hơn test-vector cố định cho query-signing): test **parse lại query** của URL đã ký, **tự tính lại `X-Amz-Signature`** đúng quy trình canonical (sort key đã encode, `UNSIGNED-PAYLOAD`, `host:<host>\n`), assert **khớp** chữ ký trong URL và chữ ký hàm trả về. Có cả ca TTL/expiry nằm trong query + kẹp biên, và ca `response-content-disposition` tiếng Việt vẫn round-trip đúng.

### 6bis.2. Quyết định: **302 REDIRECT tới presigned** (mặc định) — vì sao (không stream)
- **Mục tiêu tối ưu là RAM/băng thông backend.** 302 redirect cho client tải **thẳng từ S3/MinIO** → backend **0 byte** tệp vào RAM (chỉ ký chuỗi, không I/O). Streaming vẫn phải kéo toàn bộ bytes qua tiến trình Node/.NET (đỡ base64 nhưng vẫn tốn băng thông + giữ kết nối) — nên redirect thắng rõ.
- **Escape hatch có kiểm soát:** env `S3_DOWNLOAD_MODE` = `redirect` (mặc định) | `stream`. Đặt `stream` khi client **không tới được endpoint S3 trực tiếp** (vd MinIO chỉ trong mạng docker sau proxy) → backend kéo bytes rồi trả với `Content-Type/Content-Disposition/Content-Length` đúng. Một công tắc duy nhất, áp cho **cả** đường nội bộ lẫn LGSP, 2 backend.
- **Bản ghi cũ (base64) / S3 tắt:** endpoint tải **giải mã base64 rồi stream** (vẫn tải được, KHÔNG nhồi base64 vào JSON) — tương thích ngược tuyệt đối.

### 6bis.3. Endpoint tải & TƯƠNG THÍCH FE (không phá)
- **Phát hiện quan trọng:** FE đọc `doc.dataUrl` **TRỰC TIẾP** để render (`<img src>`, `<iframe src>`) và tải (`a.href = doc.dataUrl`) trong `src/ui/pages/shared.tsx` — dữ liệu lấy từ tầng `db` (GET document), KHÔNG qua endpoint nội dung riêng. → **GET `/api/:collection/:id` GIỮ NGUYÊN** hành vi dựng-lại-`dataUrl` (không đổi, FE 0 sửa).
- **CHỈ THÊM endpoint tải MỚI** cho tệp lớn (không phá gì): `GET /api/documents/:id/download` và `/api/guides/:id/download` (đăng ký TRƯỚC CRUD chung để không bị bắt nhầm). Kiểm quyền đọc **Y HỆT** GET :id (`readOne`/`Access.ReadOne`) → redirect presigned / stream / giải mã base64 theo nhánh trên.
- **LGSP** `GET /api/open/v1/documents/{id}/content`: ở chế độ `redirect` trả **302 → presigned**; chế độ `stream` giữ **JSON + `dataUrl`** như cũ (đúng spec đã công bố ở `openapi.js` — KHÔNG sửa spec). Lọc quyền `isPublishableDoc` (đã duyệt + KHÔNG mật) chạy **TRƯỚC** → tài liệu mật vẫn 404, chưa cấp presigned. `storageKey` **luôn bị xóa** khỏi phản hồi.

### 6bis.4. BẢO MẬT presigned (điểm cốt tử — không nới lỏng)
- Presigned **bỏ qua ACL của app** (ai có URL tải được trong TTL) → chỉ cấp **SAU KHI** đã qua kiểm quyền đọc bản ghi Y HỆT luồng hiện tại: nội bộ dùng `readOne` (tài liệu mật/lọc theo bản ghi → 404 trước khi ký); LGSP dùng `isPublishableDoc` + **scope khóa API** (sai scope → 403 trước khi ký). **TTL ngắn** (300s). **KHÔNG log URL.** Đã có test khẳng định: người không quyền đọc tài liệu mật → 404 **và** `presignGetUrl` **KHÔNG** được gọi (không rò URL); khóa API sai scope → 403 + không cấp presigned.

### 6bis.5. TỐI ƯU 2 — XÓA tài liệu dọn luôn object S3 (best-effort)
- DELETE document/guide có `storageKey` + S3 bật → gọi `blob.delete(key)` **SAU KHI** xóa DB thành công. **Best-effort:** lỗi S3 chỉ **log cảnh báo**, KHÔNG ném (rác S3 không chặn nghiệp vụ xóa). S3 tắt → KHÔNG gọi (giữ hành vi cũ).
- **Đa version:** `documentStorageKeys(doc)` / `Blob.DocumentStorageKeys` gom `storageKey` hiện tại **+** `storageKey` mỗi phần tử `versions[]` (các version cũ không đè nhau vì key theo `v<version>`), loại trùng/rỗng → xóa **hết** key liên quan doc. `guideStorageKeys` (1 tệp/guide).

### 6bis.6. File / dòng (đợt 2)
| Việc | Node | .NET |
|---|---|---|
| presign SigV4 query (thuần) | `blob.js` `presignV4()` | `Store/BlobStore.cs` `Blob.PresignV4()` + record `PresignResult` |
| presignGetUrl (store) | `blob.js` `blobStore.presignGetUrl` | `BlobStore.cs` `IBlobStore.PresignGetUrl` + `S3BlobStore` impl |
| cấu hình tải + gom khóa (thuần) | `blob.js` `downloadMode/presignTtlSec/documentStorageKeys/guideStorageKeys/mimeFromKey(export)` | `BlobStore.cs` `Blob.DownloadMode/PresignTtlSec/DocumentStorageKeys/GuideStorageKeys/ContentDisposition` |
| endpoint tải nội bộ | `index.js` `handleFileDownload` + 2 route `/api/{documents,guides}/:id/download` | `App.cs` `HandleFileDownload` + `SendRedirect`/`SendBinary` + 2 route |
| LGSP /content redirect | `open.js` router (nhánh redirect/stream) | `OpenRoutes.cs` router (nhánh redirect/stream) |
| DELETE dọn S3 | `index.js` DELETE (vòng lặp best-effort) | `App.cs` DELETE (vòng lặp best-effort) |
| test | `server/test/smoke.mjs` (nhóm 11, **+6** ca) | `ECabinet.Tests/Program.cs` (nhóm 11, **+13** ca) + `TestClient.cs` `SendNoRedirect` + `MemBlob` (đếm delete/presign, mô phỏng lỗi) |

### 6bis.7. KẾT QUẢ TEST (đợt 2 — không cần S3 thật)
| Suite | Trước đợt 2 | Sau đợt 2 | Ca mới | FAIL |
|---|---|---|---|---|
| `node scripts/build-cdn.mjs` | PASS | **PASS** | — | 0 |
| `node server/test/smoke.mjs` | 105 | **111** | +6 | 0 |
| `dotnet run --project server-dotnet/ECabinet.Tests` | 153 | **166** | +13 | 0 |

Phủ đợt 2: (a) **presigned SigV4 round-trip** tự tính lại chữ ký khớp (2 backend) + TTL/expiry trong query + kẹp biên + content-disposition tiếng Việt; (b) **tải nội bộ redirect** → 302 tới presigned đúng key, thân không chứa base64; (c) **bảo mật**: tài liệu mật → 404 + KHÔNG cấp presigned; khóa API sai scope → 403 + KHÔNG cấp; (d) **stream mode** → 200 + bytes khớp + `Content-Disposition attachment`; (e) **tương thích ngược**: S3 tắt + bản ghi base64 cũ vẫn tải được; LGSP stream-mode vẫn dựng `dataUrl` JSON như cũ; (f) **DELETE dọn S3**: `blob.delete` gọi đúng TỪNG key (kể cả version cũ) + xóa DB; **S3 lỗi → vẫn xóa DB + không ném** (best-effort, có log); S3 tắt → không gọi delete; (g) gom khóa đa version loại trùng/rỗng.

---

## 7. RỦI RO / GIỚI HẠN CÒN LẠI

1. ~~**Dựng lại dataUrl (không streaming) / đường XEM vẫn nạp base64 vào RAM**~~ — **ĐÃ XỬ LÝ HẾT (đợt 2 + đợt 3)**: đợt 2 thêm `/api/{documents,guides}/:id/download` + LGSP `/content` → **302 presigned** (tải thẳng từ S3, backend 0 byte RAM). **Đợt 3** (mục 7bis) chuyển ĐƯỜNG XEM sang **`contentUrl`**: GET document/guide/list/PATCH KHÔNG còn dựng base64 — FE fetch nội dung qua `/download` (helper `src/services/fileContent.ts`) rồi objectURL cho iframe/img/tải; có fallback `?mode=stream` khi MinIO chưa mở CORS. Đã chuyển `shared.tsx` (DocViewerModal + GuideViewBody), GuidesAdminPage, HelpPage. **Còn lại:** hop trình duyệt→MinIO chỉ kiểm chứng được với MinIO thật (sandbox không có) — bù bằng unit-test fallback + hướng dẫn mục 7bis.8.
2. **Không kiểm chứng S3 thật trong sandbox** (không Docker/MinIO, không mở socket) — đã bù bằng test-vector SigV4 chính thức + mock round-trip + E2E HTTP. Chủ dự án chạy mục 6 để xác nhận cuối.
3. **PUT bulk `/api/:collection` (admin) và seed KHÔNG externalize** — giữ nguyên dữ liệu import/seed (thường nhỏ, chạy trước khi bật S3). Nếu cần import khối lượng lớn khi S3 đã bật → viết migration riêng.
4. **Tắt S3 sau khi đã bật**: bản ghi đã externalize (chỉ storageKey) khi S3 tắt sẽ không dựng được dataUrl (GET trả metadata, thiếu nội dung). Không nên tắt S3 sau khi đã dùng; nếu cần → chạy migration kéo tệp về base64 trước.
5. **Migrate bản ghi cũ (base64→S3) là TÙY CHỌN, chưa làm** — bản ghi cũ vẫn đọc bình thường. Nếu muốn dọn DB, viết script duyệt bản ghi có dataUrl → PUT S3 → set storageKey → xóa dataUrl.
6. **Chưa có virus scan / mã hóa at-rest** — ngoài phạm vi đợt này (đã ghi ở báo cáo hiện trạng #4, #5). MinIO/S3 hỗ trợ SSE server-side; virus scan cần dịch vụ ngoài (ClamAV).
7. ~~**Xóa tài liệu chưa xóa object trên S3**~~ — **ĐÃ XỬ LÝ (đợt 2, mục 6bis.5)**: DELETE document/guide có `storageKey` + S3 bật → dọn `blob.delete` best-effort (lỗi S3 chỉ log, không chặn xóa DB); gom hết key kể cả version cũ (`versions[]`). **Còn lại:** dữ liệu import/PUT-bulk/seed hoặc key mồ côi do lỗi cũ vẫn nên có **rà quét rác định kỳ** (liệt kê object S3 không còn bản ghi DB tham chiếu) — chưa làm, là công cụ vận hành riêng.

8. ~~**LGSP `/content` ở chế độ redirect ≠ spec `application/json`**~~ — **ĐÃ XỬ LÝ (đợt 3, mục 7bis.3)**: cập nhật OpenAPI (`openapi.js` + `OpenApiCatalog.cs`) mô tả rõ `/content` mặc định **302→presigned**, `?mode=stream` trả bytes/JSON dataUrl; thêm param `mode` + response 302. Sửa lệch spec đã ghi nhận đợt 2.

---

## 7bis. ĐỢT 3 — contentUrl CHO ĐƯỜNG XEM (backend NGỪNG dựng base64 khi GET) + query mode + CORS MinIO (20/07/2026)

**Mục tiêu:** đường **XEM** tài liệu trên FE dùng `contentUrl` thay vì `dataUrl` base64 → backend KHÔNG còn dựng lại base64 vào RAM mỗi lần GET document/guide (đường ghi/tải đợt 1–2 giữ nguyên). **Cùng ràng buộc:** KHÔNG dep, KHÔNG S3 thật trong sandbox (mock + test-vector; hop trình duyệt→MinIO ghi hướng dẫn kiểm chứng thật), tương thích ngược tuyệt đối, parity 2 backend, KHÔNG commit.

### 7bis.1. CẠM BẪY TRUNG TÂM (auth/CORS) + GIẢI PHÁP FALLBACK
- `<iframe src>` / `<img src>` / `<a href download>` **KHÔNG gửi được header `Authorization`** → FE KHÔNG thể trỏ thẳng iframe vào `/api/documents/:id/download` (endpoint cần Bearer JWT).
- **Giải pháp:** FE `fetch('/api/documents/:id/download', {headers: Authorization})` → fetch **TỰ THEO 302** sang presigned URL của MinIO (hop này không cần auth vì đã ký) → nhận **Blob** → `URL.createObjectURL(blob)` → dùng làm `src` cho iframe/img/link tải. Hop **trình duyệt→MinIO là cross-origin** → cần **CORS trên MinIO**.
- **FALLBACK BẮT BUỘC:** nếu fetch-theo-302→MinIO lỗi (MinIO chưa mở CORS / mạng chặn endpoint S3) → FE **tự gọi lại** `/api/documents/:id/download?mode=stream` (same-origin, backend stream bytes) → **luôn xem/tải được**. Để làm được, backend hỗ trợ **override chế độ theo QUERY** `?mode=stream|redirect` (ưu tiên query > env `S3_DOWNLOAD_MODE`) ở CẢ 2 backend.

### 7bis.2. Query mode override (`?mode=`) — parity 2 backend
- Hàm THUẦN `downloadModeFrom(query)` (Node `blob.js`) / `Blob.DownloadModeFrom(IQueryCollection)` (.NET `BlobStore.cs`): chỉ nhận `stream`/`redirect`; giá trị lạ/thiếu → rơi về `downloadMode()` (env, mặc định `redirect`). **Ưu tiên query > env.**
- Wire vào: `handleFileDownload` (`index.js`) / `HandleFileDownload` (`App.cs`) cho **cả** `/api/documents/:id/download` + `/api/guides/:id/download`; và LGSP `/content` router (`open.js` / `OpenRoutes.cs`). **Kiểm quyền đọc GIỮ NGUYÊN** — chạy TRƯỚC khi cấp presigned/stream (không nới lỏng).

### 7bis.3. GET document/guide NGỪNG dựng base64 → trả `contentUrl`
- Hàm THUẦN `projectDocumentRead(doc)` / `projectGuideRead(guide)` (Node) + `Blob.ProjectDocumentRead/ProjectGuideRead` (.NET). Chiếu bản ghi cho client (trả BẢN SAO):
  - Có `storageKey` (đã externalize) → **XÓA storageKey** (không lộ khóa S3), **THÊM `contentUrl: "/api/documents/<id>/download"`** (guides: `/api/guides/<id>/download`), **KHÔNG dựng dataUrl**.
  - Bản ghi CŨ còn `dataUrl`/`fileData` trong DB → **giữ nguyên** (tương thích ngược).
  - Tài liệu soạn tay (chỉ `content`) → trả nguyên.
- Điểm móc: `GET /api/:collection/:id` (index.js / App.cs), **PATCH response**, và **danh sách `GET /api/:collection`** — tất cả nhất quán project cho documents/guides. **Danh sách** vốn không dựng dataUrl (giữ nhẹ) — nay project thêm để **ẩn `storageKey`** (đóng lỗ rò khóa S3 ở danh sách — trước đây data thô lộ storageKey) + gắn `contentUrl`.
- **Escape khẩn `S3_INLINE_READ=on`** (`inlineReadEnabled()` / `Blob.InlineReadEnabled()`): khôi phục hành vi cũ trước đợt 3 — GET/PATCH dựng lại `dataUrl` từ S3 (dùng `inlineDocumentRead`, KHÔNG project). Mặc định TẮT.
- **OpenAPI `/content`** (`openapi.js` + `OpenApiCatalog.cs`): mô tả rõ 302→presigned mặc định + `?mode=stream` trả bytes; thêm param `mode` + response 302. (Sửa lệch spec ghi nhận đợt 2 — mục #8.)

### 7bis.4. FRONTEND — helper dùng chung + rà tất cả nơi đọc dataUrl/fileData
- **File mới `src/services/fileContent.ts`**: `getDocContentUrl(doc)` / `getGuideContentUrl(guide)` → `FileContent{url,isObjectUrl,mime}`:
  - (a) `doc.dataUrl` / `guide.fileData` sẵn (demo / bản ghi cũ / `S3_INLINE_READ`) → trả THẲNG (KHÔNG fetch).
  - (b) `contentUrl` có → `fetch` kèm `Authorization` (token lấy qua `db.getToken()` — tái dùng cơ chế của `restAdapter`) → fetch tự theo 302 sang MinIO → Blob → `objectURL`; lỗi → **tự thử lại `?mode=stream`**.
  - URL tuyệt đối dựng qua `getServerOrigin()` (đúng cả web same-origin lẫn app native khác origin).
  - **Cache theo `id+version` (doc) / `id+updatedAt` (guide)** tránh fetch/objectURL trùng; `revokeDocContent/revokeGuideContent/revokeAllContent` dọn objectURL (chống rò).
- **Đã rà & chuyển (grep `dataUrl`/`fileData` trong `src/ui/`):**
  - `src/ui/pages/shared.tsx` — **`DocViewerModal`** (modal xem tài liệu dùng ở DocumentsPage, MeetingDetailPage, LiveMeetingPage, OnlineMeetingPage, PollsPage — tab tài liệu phiên họp, thư mục cá nhân, đính kèm kết luận đều đi qua modal này): iframe PDF/img + nút tải xuống nay dùng helper; có **trạng thái loading** ("Đang tải nội dung tệp…") + **lỗi → nút "Thử tải trực tiếp"** (retry) + toast tiếng Việt; dọn objectURL khi đóng/đổi tài liệu.
  - `src/ui/pages/shared.tsx` — thêm `GuideViewBody` + `guideHasFile` **dùng chung** cho HDSD.
  - `src/ui/pages/admin/GuidesAdminPage.tsx` — `GuideViewModal` dùng `GuideViewBody`; danh sách + form sửa dùng `guideHasFile` (guide đã externalize chỉ còn `contentUrl` vẫn nhận là "có tệp"; **sửa tiêu đề KHÔNG bắt tải lại tệp** — giữ tệp cũ).
  - `src/ui/pages/HelpPage.tsx` (HDSD người dùng) — `HelpViewModal` dùng `GuideViewBody`.
  - Đã kiểm: MeetingDetailPage/LiveMeetingPage/OnlineMeetingPage/PollsPage chỉ hiển thị **metadata** tài liệu + mở `DocViewerModal` (không đọc nội dung tệp trực tiếp); SupportPage/SupportAdminPage (phản hồi) không có tệp; **không có màn hình TV** đọc nội dung tệp.
- **Type**: `DocFile.contentUrl?` + `GuideDoc.contentUrl?` (OPTIONAL) — `src/domain/types.ts`.
- **Demo mode (localStorage): 0 thay đổi** — `db` demo không có `getToken`; documents luôn có `dataUrl` → helper trả thẳng, KHÔNG fetch.

### 7bis.5. HẠ TẦNG — CORS MinIO
- CẢ 2 compose (`docker-compose.yml` + `docker-compose.dotnet.yml`): service `minio` thêm `MINIO_API_CORS_ALLOW_ORIGIN: ${MINIO_CORS_ORIGIN:-*}` (mặc định `*` cho dễ dựng; **vận hành nên đặt = origin THẬT** của web). YAML đã validate.
- Docs: `docs/HUONG-DAN-TRIEN-KHAI-VA-HSMT.md` mục **A3.1** (thêm dòng `.env` CORS + giải thích 2 chế độ redirect/stream + contentUrl + escape) và README mục **6.1** tương ứng.

### 7bis.6. File / dòng (đợt 3)
| Việc | Node | .NET |
|---|---|---|
| query mode override (thuần) | `blob.js` `downloadModeFrom` | `BlobStore.cs` `Blob.DownloadModeFrom` |
| escape inline read (thuần) | `blob.js` `inlineReadEnabled` | `BlobStore.cs` `Blob.InlineReadEnabled` |
| chiếu contentUrl (thuần) | `blob.js` `projectDocumentRead/projectGuideRead` | `BlobStore.cs` `Blob.ProjectDocumentRead/ProjectGuideRead` |
| GET/PATCH/list dùng project + escape | `index.js` (GET :id, PATCH, GET list) | `App.cs` (GET :id, PATCH, GET list) |
| `/download` + LGSP `/content` dùng `downloadModeFrom` | `index.js` `handleFileDownload`, `open.js` router | `App.cs` `HandleFileDownload`, `OpenRoutes.cs` router |
| OpenAPI `/content` 302/mode | `openapi.js` | `OpenApiCatalog.cs` |
| helper FE + type | `src/services/fileContent.ts`, `src/domain/types.ts` | — |
| UI chuyển sang helper | `shared.tsx` (DocViewerModal, GuideViewBody), `admin/GuidesAdminPage.tsx`, `HelpPage.tsx` | — |
| CORS MinIO | `docker-compose.yml`, `docs`, `README` | `docker-compose.dotnet.yml` |

### 7bis.7. KẾT QUẢ TEST (đợt 3 — không cần S3 thật)
| Suite | Trước đợt 3 | Sau đợt 3 | Ca mới | FAIL |
|---|---|---|---|---|
| `node scripts/build-cdn.mjs` (×2) | PASS | **PASS** | — | 0 |
| `node server/test/smoke.mjs` | 111 | **119** | +8 | 0 |
| `dotnet run --project server-dotnet/ECabinet.Tests` | 166 | **173** | +9 (net; **2 ca cũ SỬA có chủ đích**) | 0 |

**Ca .NET SỬA có chủ đích (vì đường XEM đổi từ dataUrl → contentUrl):**
- *"E2E S3 BẬT: GET document dựng lại dataUrl…"* → đổi thành *"GET document trả contentUrl (KHÔNG dataUrl/storageKey)"* — vì backend nay không nhồi base64 khi GET. Việc khôi phục dataUrl chuyển sang ca **`S3_INLINE_READ=on`** riêng.
- *"E2E GUIDES: … GET dựng lại fileData khớp"* → đổi thành *"GET trả contentUrl (KHÔNG fileData)"* + kiểm khôi phục qua `S3_INLINE_READ=on` ngay trong ca. DB vẫn lưu `storageKey` (không đổi).

**Ca MỚI (2 backend):** query `?mode=` ưu tiên > env (+ giá trị lạ → env); `inlineReadEnabled` toggle; `projectDocumentRead/ProjectGuideRead` (contentUrl + ẩn storageKey + không base64; bản ghi cũ/soạn tay giữ nguyên; id encode an toàn URL); GET doc S3-on trả contentUrl không dataUrl/storageKey; bản ghi cũ trả dataUrl; **`S3_INLINE_READ=on` khôi phục dataUrl** (round-trip khớp); guides parity. **.NET E2E thêm:** `?mode=stream` GHI ĐÈ env redirect → 200 bytes (fallback); danh sách documents ẩn storageKey + gắn contentUrl không base64.

### 7bis.8. HƯỚNG DẪN KIỂM CHỨNG THẬT (MinIO + trình duyệt — sandbox không chạy được)
Sandbox KHÔNG có MinIO và không mở socket → **hop trình duyệt→MinIO không test được ở đây** (đã bù: logic fallback unit-test bằng mock fetch lỗi → gọi lại `mode=stream`; SigV4/presigned test-vector; E2E TestHost). Chủ dự án kiểm chứng thật:
1. Dựng `.env` như mục A3.1 (điền `S3_*` + `MINIO_CORS_ORIGIN=<origin web thật>`), `docker compose up -d --build`.
2. Đăng nhập app, tải 1 PDF vào phiên họp, **mở xem**:
   - Kỳ vọng: xem trước PDF/ảnh inline bình thường; nút "Tải xuống" hoạt động.
   - DevTools → Network: request `GET /api/documents/<id>/download` trả **302** → request tiếp tới **MinIO :9000** (presigned, có `X-Amz-Signature`) trả **200** + header `Access-Control-Allow-Origin`.
   - `GET /api/documents/<id>` (khi mở danh sách) trả JSON có **`contentUrl`**, KHÔNG có `dataUrl`/`storageKey`.
3. **Thử fallback:** tạm đặt `MINIO_CORS_ORIGIN` sai (vd `https://khac.example`) + `docker compose up -d` lại service minio → mở xem tài liệu: hop→MinIO bị CORS chặn, FE **tự** gọi lại `GET /api/documents/<id>/download?mode=stream` (200, same-origin) → **vẫn xem được**. Khôi phục `MINIO_CORS_ORIGIN` đúng sau khi kiểm.
4. **Escape khẩn:** đặt `S3_INLINE_READ=on` + khởi động lại `api` → `GET /api/documents/<id>` trả lại **`dataUrl`** base64 như hành vi cũ (dùng khi cần gấp, chấp nhận tốn RAM).
5. LGSP: `curl -H "X-API-Key: <key>" -i https://<host>/api/open/v1/documents/<id>/content` → **302** tới presigned; thêm `?mode=stream` → **200** bytes / JSON dataUrl.
