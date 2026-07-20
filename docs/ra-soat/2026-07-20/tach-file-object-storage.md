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

## 7. RỦI RO / GIỚI HẠN CÒN LẠI

1. **Dựng lại dataUrl (không streaming)**: bước 1 nạp toàn bộ tệp vào RAM backend rồi trả base64 (giữ API contract, FE 0 thay đổi). Tệp lớn nhiều/đồng thời → tốn RAM. **Bước sau**: streaming trực tiếp hoặc **presigned URL TTL ngắn** (SigV4 query-based) để client tải thẳng từ S3 — cần FE đổi nhẹ; presigned phải TTL ngắn để không rò tài liệu mật.
2. **Không kiểm chứng S3 thật trong sandbox** (không Docker/MinIO, không mở socket) — đã bù bằng test-vector SigV4 chính thức + mock round-trip + E2E HTTP. Chủ dự án chạy mục 6 để xác nhận cuối.
3. **PUT bulk `/api/:collection` (admin) và seed KHÔNG externalize** — giữ nguyên dữ liệu import/seed (thường nhỏ, chạy trước khi bật S3). Nếu cần import khối lượng lớn khi S3 đã bật → viết migration riêng.
4. **Tắt S3 sau khi đã bật**: bản ghi đã externalize (chỉ storageKey) khi S3 tắt sẽ không dựng được dataUrl (GET trả metadata, thiếu nội dung). Không nên tắt S3 sau khi đã dùng; nếu cần → chạy migration kéo tệp về base64 trước.
5. **Migrate bản ghi cũ (base64→S3) là TÙY CHỌN, chưa làm** — bản ghi cũ vẫn đọc bình thường. Nếu muốn dọn DB, viết script duyệt bản ghi có dataUrl → PUT S3 → set storageKey → xóa dataUrl.
6. **Chưa có virus scan / mã hóa at-rest** — ngoài phạm vi đợt này (đã ghi ở báo cáo hiện trạng #4, #5). MinIO/S3 hỗ trợ SSE server-side; virus scan cần dịch vụ ngoài (ClamAV).
7. **Xóa tài liệu chưa xóa object trên S3** (`delete` đã có trong blobStore nhưng đường DELETE tài liệu chưa gọi để tránh mất dữ liệu nếu nhiều version trỏ chung) — rác S3 tích lũy; bước sau thêm dọn rác định kỳ theo tham chiếu.
