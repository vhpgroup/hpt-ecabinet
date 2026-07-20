# KIẾN TRÚC LƯU TRỮ & XỬ LÝ FILE — ĐỐI CHIẾU HSMT vs CODE THẬT

**Người thực hiện:** Minh — Business Analyst dự án eCabinet (HPT TECH)
**Ngày:** 20/07/2026
**Câu hỏi gốc của Chủ đầu tư:** *"HSMT quy định lưu trữ & xử lý file thế nào? SQL Server hiện đang lưu GÌ? File PDF/Word/Excel/video lưu Ở ĐÂU?"*
**Phương pháp:** đọc nguyên văn HSMT (`docs/hsmt-chuong-v.md`, 668 dòng) + đọc thật toàn bộ code liên quan lưu trữ ở cả 2 backend (Node/PostgreSQL và .NET/SQL Server). Không sửa code, không chạy server, không commit.

**Nguồn tham chiếu trước đó (đã có trong repo, đối chiếu để không mâu thuẫn):**
- `docs/ra-soat/2026-07-18/phantich-hethong.md` mục 2.4 — đã phát hiện đúng vấn đề "dataUrl nhồi trong JSONB" và đề xuất tách sang MinIO.
- `docs/phan-tich-hsmt-TechLeader.md` mục 3.3 — đã ghi nhận gap sizing "File-Server 8 vCPU/16GB — dung lượng cần tính lại theo khối lượng video thực tế".
- `docs/livekit-va-du-lieu.md` — đã phân tích LiveKit Cloud vs self-host, xác nhận không ghi lại (recording) mặc định.
- `docs/ra-soat/2026-07-18/livekit-test.md` — đã kiểm chứng thật LiveKit Cloud (mint token, join phòng) — xác nhận eCabinet chỉ mint token, không chạm vào luồng media.
- `docs/ho-so/06-phuong-an-chuyen-giao-du-lieu.md` — văn bản hồ sơ dự thầu, dòng 36 đã viết "tệp ghi âm/ghi hình cuộc họp (**nếu có lưu trữ**)" — cách viết có điều kiện, đúng với thực tế code hiện KHÔNG ghi hình.

---

## PHẦN 1 — HSMT QUY ĐỊNH LƯU TRỮ & XỬ LÝ FILE THẾ NÀO (trích nguyên văn, có số dòng)

### 1.1. Mô hình triển khai — có "Cụm Server-File" riêng, sizing cụ thể

`docs/hsmt-chuong-v.md` dòng 308–323, mục **"Mô hình triển khai phần mềm"**:

> **Dòng 310–315:**
> "Hệ thống phần mềm được cài đặt tập trung tại Trung tâm tích hợp dữ liệu thành phố... Cụm Server-Web: Các module web cần được public ra internet... Cụm Server-App: Cụm các module tiến trình xử lý nghiệp vụ hệ thống... **Cụm Server-Database: Xử lý lưu trữ, truy xuất dữ liệu; Cụm Server-File: Xử lý lưu trữ file như video, media, tệp đính kèm,....**"

> **Dòng 316–323, bảng sizing:**
> | Máy chủ | Hệ điều hành | vCPU | vRam | Dung lượng lưu trữ | Số lượng |
> |---|---|---|---|---|---|
> | Database-Server | Windows Server | 32 Core | 64 Gb | 500 Gb | 2 |
> | Web-Server | Windows Server | 16 Core | 32 Gb | 200 Gb | 2 |
> | App-Server | Windows Server | 16 Core | 32 Gb | 200 Gb | 2 |
> | **File-Server** | **Ubuntu Server** | **8 Core** | **16 Gb** | *(để trống — không ghi số)* | **1** |

**Kết luận HSMT:** đây là **kiến trúc 4 cụm máy chủ tách biệt**, trong đó file/video/media đính kèm được **quy định lưu ở một máy chủ riêng (File-Server, chạy Linux)**, **KHÔNG nằm trong Database-Server**. Đáng chú ý: dòng "File-Server" không ghi dung lượng lưu trữ cụ thể (cột "Dung lượng lưu trữ" để trống) — đây là điểm cần làm rõ với Bên mời thầu (đã được `docs/phan-tich-hsmt-TechLeader.md` mục 3.3 ghi nhận là gap).

### 1.2. Mô hình CSDL tập trung — yêu cầu dung lượng lớn, đa định dạng

Dòng 519–524, mục **"Yêu cầu cần đáp ứng đối với cơ sở dữ liệu"**:

> "Mô hình cơ sở dữ liệu tập trung, đảm bảo đầy đủ các thông tin cơ bản cần lưu trữ của nghiệp vụ phần mềm:
> - **Cơ sở dữ liệu phải có khả năng lưu trữ với dung lượng lớn**;
> - **Có khả năng lưu trữ được nhiều định dạng dữ liệu khác nhau như: dữ liệu tệp văn bản, ảnh**;
> - Có cơ chế tự động sao lưu dữ liệu theo lịch trình đặt sẵn hoặc tùy chọn; có khả năng phục hồi cơ sở dữ liệu từ dữ liệu đã được sao lưu;
> - Chuẩn hóa dữ liệu để lưu trữ theo chuẩn ký tự Unicode"

Dòng 542–546, mục ràng buộc hệ thống:
> "Phụ thuộc nền tảng: **MS SQL Server**, Windows Server, Microsoft Visual Studio, **.NET 8.0 trở lên**."

Dòng 331–336, mục nền tảng công nghệ:
> "Nền tảng công nghệ lập trình: .NET. Hệ quản trị Cơ sở dữ liệu: **Microsoft SQL Server 2022 trở lên**."

**Nhận xét:** HSMT nói CSDL "có khả năng lưu trữ được... tệp văn bản, ảnh" — đây là câu **mơ hồ**, không nói rõ tệp được lưu **trong** CSDL (BLOB/base64) hay CSDL chỉ lưu **metadata + con trỏ** tới file nằm ở Cụm Server-File. Tuy nhiên khi đọc CÙNG với mục 1.1 (Cụm Server-File tách riêng để "xử lý lưu trữ file như video, media, tệp đính kèm"), cách đọc hợp lý nhất là: **CSDL (SQL Server) lưu dữ liệu nghiệp vụ có cấu trúc; file/video/media lưu ở File-Server riêng** — tức mô hình **tách BLOB khỏi DB**, không phải nhồi base64 vào cột DB.

### 1.3. Định dạng tệp — TT 39/2017/TT-BTTTT, Unicode TCVN 6909

Dòng 80, mục 4.1.1:
> "Các định dạng tập tin (tập tin nhập vào hệ thống, tập tin dược xuất ra từ hệ thống, tập tin được lưu trữ trong hồ sơ điện tử,…) tuân thủ theo các định dạng tập tin (về văn bản, hình ảnh...) được quy định tại **Thông tư số 39/2017/TT-BTTTT** ngày 15/12/2017 của Bộ trưởng Bộ Thông tin và Truyền thông"

Dòng 562, mục giao diện:
> "Sử dụng thống nhất bộ mã các ký tự chữ Việt theo **tiêu chuẩn TCVN 6909:2001** (Tiếng Việt Unicode)."

### 1.4. Sao lưu/phục hồi — có nói "các dữ liệu liên quan khác" nhưng KHÔNG tách riêng file đính kèm

Dòng 592–597, mục **"Yêu cầu về sao lưu, phục hồi dữ liệu"**:

> "Phải có cơ chế sao lưu dữ liệu định kỳ, đột xuất đảm bảo nhanh chóng đưa hệ thống hoạt động trở lại trong trường hợp có sự cố xảy ra. Các dữ liệu cần sao lưu:
> - **Dữ liệu cấu hình hệ thống**
> - **Cơ sở dữ liệu lưu trữ nội dung.**
> - **Các dữ liệu liên quan khác.**
> Có cơ chế phục hồi dữ liệu khi hệ thống gặp sự cố"

**Nhận xét:** HSMT KHÔNG nói rõ file đính kèm (nếu nằm ở File-Server riêng) có nằm trong phạm vi sao lưu hay không — cụm từ "các dữ liệu liên quan khác" đủ rộng để bao gồm cả file trên File-Server, nhưng đây là điểm mơ hồ khác cần làm rõ trong giải pháp kỹ thuật của nhà thầu.

### 1.5. Chuyển giao dữ liệu khi kết thúc HĐ — "dữ liệu có thể truy xuất"

Dòng 639–650, mục **"Yêu cầu về việc sở hữu các thông tin, dữ liệu"**:

> Dòng 642: "Thông tin, dữ liệu hình thành trong quá trình thuê dịch vụ công nghệ thông tin **thuộc sở hữu của cơ quan, đơn vị thuê**. Nhà cung cấp dịch vụ có trách nhiệm bảo đảm an ninh, an toàn thông tin, **chuyển giao đầy đủ** cho chủ trì thuê dịch vụ các thông tin, dữ liệu khi kết thúc hợp đồng."
>
> Dòng 649: "...nhà cung cấp dịch vụ phải có trách nhiệm cung cấp toàn bộ các thông tin, dữ liệu, và tài sản hình thành thuộc sở hữu của chủ trì thuê dịch vụ **dưới dạng dữ liệu có thể truy xuất**..."

**Nhận xét:** yêu cầu "dữ liệu có thể truy xuất" áp dụng cho MỌI dữ liệu hình thành — bao gồm cả file đính kèm/video nếu có lưu trữ. Nếu file bị nhồi base64 trong cùng cột JSON với metadata (xem Phần 2), việc "chuyển giao dưới dạng có thể truy xuất" vẫn khả thi (JSON dump), nhưng KÉM thân thiện hơn so với việc bàn giao file gốc (PDF/DOCX) riêng biệt từ File-Server — điều này đã được xử lý trong `docs/ho-so/06-phuong-an-chuyen-giao-du-lieu.md` (2 lớp định dạng: kỹ thuật + thân thiện).

### 1.6. Mã hóa dữ liệu lưu trữ (at-rest) & mã hóa cơ yếu cho dữ liệu mật

Dòng 75, mục 3.7 (bảng tiêu chí chất lượng):
> "Yêu cầu về truy cập, truy xuất, mã hóa, giải mã dữ liệu | Thiết lập cơ chế truy cập/truy xuất an toàn và **áp dụng mã hóa dữ liệu khi truyền và lưu trữ** theo tiêu chuẩn ATTT... **các dữ liệu thuộc diện bắt buộc phải mã hóa được thực hiện mã hóa/giải mã bằng mật mã cơ yếu khi lưu trữ, truyền, nhận và chia sẻ trên mạng máy tính**..."

Dòng 77:
> "...bao gồm **mã hóa dữ liệu khi lưu trữ và khi truyền**, phân quyền truy cập, tường lửa ứng dụng..."

Dòng 645 (mục sở hữu dữ liệu):
> "...tuân thủ quy định của pháp luật về an toàn, an ninh thông tin, **cơ yếu** và Pháp lệnh bảo vệ bí mật nhà nước"

**Nhận xét:** HSMT yêu cầu mã hóa **at-rest** (khi lưu trữ) cho dữ liệu bắt buộc mã hóa (dùng mật mã cơ yếu), không chỉ mã hóa in-transit (TLS). Đây là yêu cầu áp dụng cho CẢ CSDL và file đính kèm nếu chứa nội dung mật.

### 1.7. Video họp trực tuyến — HSMT KHÔNG có mục riêng về ghi hình/lưu media họp

Rà toàn bộ 668 dòng: HSMT có nhắc "video" ở **2 vị trí duy nhất**:
1. Dòng 315: "Cụm Server-File: Xử lý lưu trữ file như **video**, media, tệp đính kèm,...." — chỉ nói Server-File CÓ THỂ xử lý video nếu có, không bắt buộc phải có video.
2. Dòng 89, 577: nói về **video hướng dẫn sử dụng** (tài liệu HDSD dạng video), KHÔNG liên quan đến ghi hình cuộc họp.

**Không có mục nào trong HSMT yêu cầu ghi hình/lưu trữ video CUỘC HỌP trực tuyến.** Chức năng "Tổ chức cuộc họp" (mục VII, dòng 425–507) chỉ mô tả các nghiệp vụ điểm danh, phát biểu, biểu quyết, chất vấn — không có mục nào là "ghi hình cuộc họp" hoặc "xem lại video cuộc họp đã họp". Đây là kết luận quan trọng: **HSMT không bắt buộc chức năng ghi hình họp**, nên việc hệ thống hiện tại KHÔNG ghi hình (xem Phần 2.5) không phải là một GAP so với HSMT.

---

## PHẦN 2 — RÀ CODE HIỆN TRẠNG

### 2.1. `src/domain/types.ts` — các trường chứa nội dung file

File: `/agent/workspace/hpt-ecabinet/src/domain/types.ts`

**`DocFile`** (dòng 219–266) — thực thể "Tài liệu":
```
size: number;
mime: string;
content?: string;   // dòng 229 — nội dung văn bản (tài liệu MẪU, soạn trực tiếp trên UI, KHÔNG phải base64)
dataUrl?: string;    // dòng 230 — "file tải lên (base64)"
```
- `content`: dùng khi người dùng SOẠN trực tiếp trên hệ thống (ví dụ kết luận cuộc họp dạng text) — lưu chuỗi text thuần, KHÔNG phải file nhị phân.
- `dataUrl`: dùng khi người dùng TẢI LÊN file thật (PDF/DOCX/XLSX/ảnh…) — là **data URL base64** (`data:<mime>;base64,<...>`), tức TOÀN BỘ nội dung nhị phân của file được encode base64 và nhúng thẳng vào trường string này.
- 2 trường loại trừ nhau về ngữ nghĩa nhưng cùng tồn tại trên 1 object — không có union type tách riêng.

**`GuideDoc`** (dòng 107–120) — tài liệu Hướng dẫn sử dụng:
```
content?: string;   // dòng 111 — nội dung soạn trực tiếp
fileName?: string;  // dòng 113
fileData?: string;  // dòng 115 — "dữ liệu tệp dạng data URL (base64) — lưu giống DocFile.dataUrl"
```
Comment tại dòng 115 tự xác nhận `fileData` giống cơ chế `dataUrl` của `DocFile`.

**`Snapshot`** (dòng 495–516) — gói toàn bộ dữ liệu ứng dụng: `documents: DocFile[]` và `guides: GuideDoc[]` là 2 trong ~16 mảng con của cùng 1 snapshot object — đây là cấu trúc dữ liệu tổng dùng cho seed/export, phản ánh đúng việc mỗi collection (bao gồm collection chứa BLOB) được lưu độc lập ở tầng CSDL (xem 2.2).

Không có trường nào riêng cho "video cuộc họp" trong toàn bộ `types.ts` — không có `Meeting.recordingUrl`, không có entity `MeetingRecording` nào.

### 2.2. Cách lưu document ở 2 backend — XÁC NHẬN file base64 NẰM TRONG SQL Server / PostgreSQL

**Backend Node.js/PostgreSQL** — `/agent/workspace/hpt-ecabinet/server/src/db.js`:
- Dòng 14–32 (`COLLECTIONS`): mỗi bộ dữ liệu nghiệp vụ (kể cả `documents` → `c_documents`, `guides` → `c_guides`) map tới 1 bảng riêng.
- Dòng 100–107 (`migrate()`): mọi bảng trong `COLLECTIONS` được tạo với đúng schema:
  ```sql
  CREATE TABLE IF NOT EXISTS ${table} (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  ```
- Không có schema riêng cho `c_documents` — nó dùng ĐÚNG cấu trúc `(id, data JSONB, updated_at)` như mọi bảng khác. Vì `DocFile` (bao gồm `dataUrl` base64) được `JSON.stringify()` nguyên object rồi `INSERT ... VALUES ($1, $2::jsonb)` (thấy ở `seedIfEmpty`, dòng 144–147, và tương tự ở `server/src/index.js`/`actions.js` cho luồng CRUD runtime — không đọc lại ở đây nhưng cùng cơ chế `query(INSERT/UPDATE ... $2::jsonb)`), **toàn bộ base64 của file đính kèm nằm TRONG cột `data` JSONB của PostgreSQL**.

**Backend .NET/SQL Server** — `/agent/workspace/hpt-ecabinet/server-dotnet/ECabinet.Api/Store/SqlServerDocStore.cs`:
- Dòng 56–61 (`MigrateAsync`): mọi bảng trong `Db.Ordered` (bao gồm `c_documents`, `c_guides` — xem `Db.cs` dòng 12–31) được tạo với:
  ```sql
  CREATE TABLE {table} (
    id NVARCHAR(64) NOT NULL PRIMARY KEY,
    data NVARCHAR(MAX) NOT NULL CHECK (ISJSON(data) = 1),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  ```
- Dòng 113–129 (`InsertAsync`/`UpdateAsync`): `INSERT INTO {table} (id, data) VALUES (@id, @data)` với `@data = J.Stringify(data)` — cùng cơ chế: object `DocFile` (chứa `dataUrl` base64) được stringify toàn bộ vào 1 cột `NVARCHAR(MAX)`.
- Comment tự nhận tại dòng 8–9: *"Mô hình: mỗi bộ dữ liệu 1 bảng (id NVARCHAR(64) PK, **data NVARCHAR(MAX)** CHECK ISJSON=1, ...)"* — không có bảng/kiểu dữ liệu riêng cho BLOB (không dùng `VARBINARY(MAX)` hay `FILESTREAM` của SQL Server, dù SQL Server hỗ trợ sẵn các kiểu này cho lưu trữ tệp lớn).

**KẾT LUẬN 2.2:** ở CẢ 2 backend, đường đi của 1 file PDF/DOCX/XLSX người dùng tải lên là:
```
File nhị phân → base64 (client, browser FileReader)
             → gửi lên trong JSON body { ..., dataUrl: "data:application/pdf;base64,JVBERi0..." }
             → server stringify NGUYÊN object → ghi vào 1 CỘT DUY NHẤT
               (PostgreSQL: data JSONB | SQL Server: data NVARCHAR(MAX))
             → CÙNG bảng, CÙNG hàng với metadata (name, size, mime, reviewStatus, folder...)
```
Không có bảng/cột riêng cho nội dung nhị phân tệp ở bất kỳ backend nào; **KHÔNG có tầng object storage hay File-Server nào được implement trong code** (xác nhận thêm ở mục 2.6).

### 2.3. Giới hạn kích thước — có 3 con số KHÔNG THỐNG NHẤT với nhau

| Nơi giới hạn | File:dòng | Giá trị | Vai trò |
|---|---|---|---|
| Frontend, client-side | `src/services/documentService.ts:44` | `db.remote ? 15*1024*1024 : 1.5*1024*1024` | **15MB** khi chạy chế độ máy chủ (chặn TRƯỚC khi gửi request) |
| nginx reverse proxy | `nginx.conf:13` | `client_max_body_size 25m;` | 25MB — chặn ở tầng proxy nếu request lớn hơn |
| Node API, đọc body | `server/src/util.js:29` | `readBody(req, limitBytes = 25 * 1024 * 1024)` | 25MB — chặn ở tầng application Node |

**Có độ lệch nội tại trong repo:** README dòng 276 viết *"tệp ≤ 15MB base64 trong JSONB"* nhưng số THỰC trong code backend (`util.js`, `nginx.conf`) là 25MB — 15MB chỉ là giới hạn ở FRONTEND (chặn sớm, UX tốt hơn, không phải giới hạn cứng của hệ thống). Server sẵn sàng chấp nhận tới 25MB nếu có client khác (ví dụ mobile app, hoặc gọi API trực tiếp) không áp giới hạn 15MB này. Vấn đề này đã được `docs/ra-soat/2026-07-18/phantich-hethong.md` dòng 179 phát hiện trước, kết quả đọc code của tôi hôm nay xác nhận LẠI đúng con số đó — không có gì thay đổi từ 18/07 đến nay.

**Không tìm thấy** validate size RIÊNG cho `dataUrl` ở tầng `guard.js` (`SCHEMA.documents` dòng 31 chỉ kiểm `dataUrl: 'string'` — kiểm KIỂU, không kiểm ĐỘ DÀI chuỗi). Nghĩa là nếu request lọt qua nginx (25MB) và `readBody` (25MB), server sẽ ghi thẳng vào DB không kiểm tra thêm — không có giới hạn "cứng" ở tầng nghiệp vụ, chỉ có giới hạn ở tầng hạ tầng (proxy + HTTP body reader).

### 2.4. Whitelist định dạng tệp — CÓ áp dụng TT 39/2017/TT-BTTTT (một phần)

`server/src/guard.js` dòng 68–71 (`ALLOWED_FILE_EXT`):
```js
const ALLOWED_FILE_EXT = [
  'pdf', 'doc', 'docx', 'odt', 'xls', 'xlsx', 'ods', 'csv', 'ppt', 'pptx', 'odp',
  'txt', 'rtf', 'jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'bmp', 'zip', 'rar',
];
```
Dòng 179–191 (`validatePatch`, mục `documents`): chỉ khi bản ghi HIỆU LỰC có `dataUrl` thật (khác rỗng) mới ép kiểm phần mở rộng tên file nằm trong whitelist trên, 400 nếu không hợp lệ. Comment dòng 66–67 tự dẫn chiếu đúng TT 39/2017/TT-BTTTT. Cơ chế tương đương có ở `Guard.cs` (dòng 41, 74, 155, 242-246 — cùng logic port sang .NET).

**Hạn chế:** đây là kiểm tra PHẦN MỞ RỘNG TÊN TỆP (extension theo tên file), KHÔNG kiểm tra magic-byte/nội dung thật của file — 1 file `.pdf` giả (thực chất là file khác đổi tên) sẽ lọt qua whitelist này. Không có antivirus/malware scan nào trong code (đã grep toàn repo, không tìm thấy `virus`/`clamav`/`malware scan`).

### 2.5. Video họp trực tuyến (LiveKit) — CHỈ mint token, KHÔNG lưu/ghi video

`server/src/rtc.js` (55 dòng) và bản port `server-dotnet/ECabinet.Api/Rtc.cs` (94 dòng): toàn bộ logic chỉ có **2 việc**:
1. `rtcConfigured()`/`Configured()`: kiểm 3 biến môi trường `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` có đủ không.
2. `mintLiveKitToken()`/`MintLiveKitToken()`: tự ký JWT HS256 (không dùng SDK LiveKit), gán `video.roomJoin/canPublish/canSubscribe/canPublishData = true`, trả token cho client tự `room.connect(wss://...)` tới LiveKit (Cloud hoặc self-host).

**Không có bất kỳ API nào của LiveKit Egress/Recording được gọi** (đã grep `egress`/`recording`/`Recording` trên toàn repo — không có kết quả nào ngoài các match không liên quan như `RECORD_AUDIO` permission Android trong `docs/mobile-app.md`, vốn chỉ là quyền micro cho WebRTC, không phải chức năng ghi file). LiveKit hoạt động thuần túy như **SFU (Selective Forwarding Unit) truyền media thời gian thực** giữa các client — audio/video/screen-share đi qua SFU và tới các participant khác, **không được ghi lại thành file** ở bất kỳ đâu (không ở server eCabinet, không tự động ở LiveKit trừ khi ai đó CHỦ ĐỘNG gọi Egress API riêng của LiveKit — điều mà eCabinet không làm).

`docs/ra-soat/2026-07-18/livekit-test.md` (kiểm chứng thật với LiveKit Cloud) xác nhận độc lập: eCabinet chỉ chịu trách nhiệm mint token + client join phòng, không đụng đến luồng media.

### 2.6. Tầng object storage (MinIO/S3) hoặc File-Server riêng — CHƯA TRIỂN KHAI, nhưng ĐÃ được dự trù trong hạ tầng

Grep toàn repo cho `minio|s3\b|multipart|upload.dir|fs.writeFile|multer` chỉ khớp:
- `README.md` (mô tả nợ kỹ thuật, xem 2.7)
- `docs/ra-soat/2026-07-18/phantich-hethong.md` (đề xuất trước đó)
- `scripts/loadtest.mjs`, `docs/dr-runbook.md`, `src/ui/emojiIcons.ts` — không liên quan lưu trữ file thật
- `docker-compose.yml` — **khối comment "MỞ RỘNG GIAI ĐOẠN 3"**:

```yaml
# ---------- MỞ RỘNG GIAI ĐOẠN 3 (khai báo sẵn) ----------
# minio:
#   image: minio/minio:latest      # lưu trữ file tài liệu dung lượng lớn
#   command: server /data --console-address ":9001"
#   environment:
#     MINIO_ROOT_USER: ${MINIO_USER:-ecabinet}
#     MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD:-ecabinet-secret}
#   volumes:
#     - ecabinet_minio:/data
#   restart: unless-stopped
...
volumes:
  ecabinet_pgdata:
  # ecabinet_minio:
```
(`docker-compose.yml` dòng 65–78)

**Nhận xét quan trọng:** đội phát triển đã **biết trước và chuẩn bị sẵn** service MinIO trong `docker-compose.yml` (comment sẵn, chỉ cần bỏ comment + set biến môi trường để kích hoạt) nhưng **chưa bật/tích hợp vào code nghiệp vụ**. Đây là bằng chứng mạnh cho thấy việc tách BLOB khỏi DB là **lộ trình đã dự tính**, không phải phát hiện mới — chỉ chưa triển khai.

### 2.7. README — tự thừa nhận nợ kỹ thuật đúng vấn đề này

`README.md`:
- Dòng 113: *"CSDL: PostgreSQL — mô hình bảng JSONB (id, data, updated_at)..."*
- Dòng 265–266 (bảng lộ trình mở rộng):
  > | Chuẩn hóa CSDL | Tách dần bảng JSONB thành bảng quan hệ cho thực thể nóng... |
  > | **Lưu trữ tài liệu lớn** | **MinIO (S3-compatible), virus scan, streaming (thay base64 trong JSONB)** |
- Dòng 276: *"tệp ≤ 15MB (base64 trong JSONB)"* (số 15MB là giới hạn frontend, xem 2.3)
- Dòng 432 (bảng so sánh 2 backend): "Lưu trữ | bảng JSONB (id,data,updated_at) | bảng NVARCHAR(MAX) ISJSON + (id,data,updated_at)" — README tự xác nhận đúng những gì tôi đọc từ code ở mục 2.2.

---

## PHẦN 3 — ĐỐI CHIẾU & KẾT LUẬN

### 3.1. Bảng đối chiếu: loại dữ liệu → nơi lưu hiện tại → HSMT yêu cầu → khớp/lệch

| Loại dữ liệu | Hiện lưu ở đâu (code thật) | HSMT yêu cầu gì | Khớp/Lệch |
|---|---|---|---|
| Metadata nghiệp vụ (tên cuộc họp, người dùng, biểu quyết, chương trình họp...) | PostgreSQL `data JSONB` / SQL Server `data NVARCHAR(MAX)` — 1 cột/1 bảng mỗi collection | "CSDL tập trung... đảm bảo thông tin cơ bản" (dòng 520) — tuân thủ SQL Server 2022+/.NET 8+ (dòng 331-333, 544) | **KHỚP** — mô hình CSDL tập trung, tuân thủ nền tảng .NET + SQL Server đúng yêu cầu (với backend .NET) |
| Nội dung soạn trực tiếp (`DocFile.content`, text thuần) | Cùng cột `data` JSON, dạng string | "lưu trữ được... dữ liệu tệp văn bản" (dòng 522) | **KHỚP** — text nghiệp vụ trong CSDL là hợp lý |
| **File PDF/DOCX/XLSX/ảnh tải lên** (`DocFile.dataUrl`, base64) | **CÙNG cột `data` JSON/NVARCHAR(MAX) với metadata** — SQL Server/PostgreSQL | Dòng 315: file/media/tệp đính kèm lưu ở **Cụm Server-File riêng** (Ubuntu, 8 Core/16GB) | **LỆCH** — HSMT ngụ ý tách file khỏi DB sang máy chủ riêng; code hiện tại nhồi TẤT CẢ vào DB |
| Tài liệu HDSD (`GuideDoc.fileData`, base64) | Cùng cơ chế `dataUrl`, cùng cột `c_guides.data` | Dòng 315 (tương tự trên) | **LỆCH** (tương tự trên) |
| Video họp trực tuyến (audio/video/screen-share realtime) | **KHÔNG lưu ở đâu** — chỉ truyền qua LiveKit SFU (Cloud hoặc self-host), server eCabinet chỉ mint token | HSMT KHÔNG có mục nào yêu cầu ghi hình cuộc họp (chỉ nhắc "video" ở Cụm Server-File như khả năng CÓ THỂ có, không bắt buộc) | **KHÔNG LỆCH** — HSMT không bắt buộc ghi hình, hệ thống không ghi hình là hợp lý, nhưng chưa có File-Server nào để lưu NẾU về sau cần |
| Object storage / File-Server | **Chưa triển khai** — chỉ có comment sẵn MinIO trong `docker-compose.yml` | Cụm Server-File là 1 trong 4 cụm bắt buộc của mô hình triển khai (dòng 312-315, 322) | **LỆCH** — thiếu 1 thành phần hạ tầng mà HSMT liệt kê rõ trong mô hình 4 cụm |
| Mã hóa dữ liệu tại chỗ (at-rest) | **Không có** — không TDE, không mã hóa cột, chỉ có TLS in-transit qua HTTPS (README/docs khác) | Dòng 75, 77: "mã hóa dữ liệu khi lưu trữ", "mã hóa/giải mã bằng mật mã cơ yếu khi lưu trữ" (cho dữ liệu mật) | **LỆCH** — chưa có cơ chế mã hóa at-rest nào trong code storage layer |
| Virus/malware scan tệp tải lên | **Không có** | Không có mục riêng, nhưng hàm ý trong "an toàn hệ thống thông tin Cấp độ 3" (dòng 71, 527-528) | **LỆCH nhẹ** — README đã tự ghi nhận là nợ kỹ thuật (dòng 266) |
| Sao lưu (backup) | Chỉ có backup CSDL (Postgres/SQL Server dump) — vì file NẰM TRONG DB nên "vô tình" cũng được backup cùng | Dòng 592-597: sao lưu "CSDL lưu trữ nội dung" + "dữ liệu liên quan khác" | **KHỚP về mặt kỹ thuật (file được backup cùng DB) nhưng KHÔNG khớp về mô hình** (backup DB kèm BLOB rất nặng, không tách riêng lịch backup file như mô hình 4-cụm ngụ ý) |

### 3.2. Trả lời trực tiếp 3 câu hỏi của Chủ đầu tư

**(a) SQL Server hiện đang lưu GÌ?**
SQL Server (và bản Node dùng PostgreSQL tương đương) lưu **TẤT CẢ** trong một mô hình duy nhất: mỗi loại dữ liệu nghiệp vụ (người dùng, đơn vị, cuộc họp, biểu quyết, tài liệu, thông báo, nhật ký...) là 1 bảng, mỗi bảng chỉ có 3 cột `(id, data, updated_at)`, trong đó `data` là `NVARCHAR(MAX)` chứa **toàn bộ object JSON** của bản ghi đó. Với riêng bảng `c_documents` và `c_guides`, cột `data` này chứa CẢ metadata (tên, kích thước, người sở hữu, trạng thái duyệt...) VÀ **nội dung nhị phân base64 của file đính kèm** (`dataUrl`/`fileData`) — tức **SQL Server đang đóng vai trò vừa là CSDL nghiệp vụ vừa là nơi lưu BLOB tệp**, gộp chung trong 1 cột JSON của 1 bảng.

**(b) File PDF/Word/Excel lưu ở đâu?**
**Lưu base64 trực tiếp trong SQL Server/PostgreSQL**, cụ thể trong trường `DocFile.dataUrl` (dòng 230, `types.ts`), nằm trong cột `data` của bảng `c_documents`. **Không có File-Server, không có MinIO/S3, không có filesystem riêng nào lưu file này** — mặc dù `docker-compose.yml` đã có sẵn khối MinIO bị comment, chưa được bật. Giới hạn kích thước tệp: 15MB (chặn ở frontend), 25MB (chặn ở nginx + Node backend) — 2 số không khớp nhau, và không có validate độ dài `dataUrl` ở tầng nghiệp vụ (`guard.js`).

**(c) Video lưu ở đâu?**
**Không lưu ở đâu cả.** Video/audio cuộc họp trực tuyến chỉ **truyền qua LiveKit SFU (Selective Forwarding Unit)** — thời gian thực, theo luồng (streaming), không được ghi lại. Server eCabinet (`rtc.js`/`Rtc.cs`) chỉ mint JWT token cho client tự kết nối tới LiveKit (chạy trên LiveKit Cloud hoặc self-host tại hạ tầng do đơn vị vận hành kiểm soát — xem `docs/livekit-va-du-lieu.md`), không hề chạm vào luồng media, không gọi API Egress/Recording của LiveKit. HSMT không yêu cầu chức năng ghi hình cuộc họp, nên đây KHÔNG phải một gap so với yêu cầu chức năng — nhưng nếu về sau chủ đầu tư MUỐN có ghi hình (để lưu trữ/tra soát), hệ thống sẽ cần bổ sung tính năng Egress + nơi lưu file video (chính là vai trò của File-Server mà HSMT đã dự kiến).

### 3.3. Khoảng cách với HSMT + rủi ro

**Khoảng cách lớn nhất:** HSMT mô tả rõ mô hình **4 cụm máy chủ tách biệt** (Web/App/Database/File), trong đó **Cụm Server-File được định nghĩa RIÊNG để xử lý lưu trữ file như video, media, tệp đính kèm** (dòng 315) — ngụ ý rõ ràng kiến trúc "tách BLOB khỏi CSDL". Code hiện tại của eCabinet **KHÔNG có Cụm Server-File nào** — mọi file (PDF/DOCX/XLSX/ảnh của tài liệu họp, HDSD) đều bị nhồi base64 vào CÙNG cột JSON với metadata nghiệp vụ, trong CSDL chính (SQL Server/PostgreSQL).

**Rủi ro cụ thể của việc nhồi base64 vào DB:**
1. **Phình DB nhanh bất thường:** base64 làm tăng ~33% dung lượng so với file gốc; với 500+ người dùng, 60 tháng vận hành, hàng nghìn tài liệu họp (mỗi phiên có agenda + tài liệu đính kèm) → dung lượng bảng `c_documents`/`c_guides` tăng rất nhanh, lấn hết Database-Server (HSMT chỉ cấp 500GB cho DB, dòng 319) trong khi bảng lẽ ra chỉ chứa metadata (vài KB/bản ghi) lại phải chứa cả file (có thể tới 15-25MB/bản ghi).
2. **Chậm truy vấn & sao lưu:** mỗi lần `SELECT *`/backup DB đều phải đọc/ghi luôn cả BLOB dù chỉ cần metadata — ảnh hưởng trực tiếp tới yêu cầu hiệu năng của HSMT (dòng 62: "tra cứu... dưới 30 giây"), và làm backup CSDL (dòng 592-597) nặng hơn nhiều lần, kéo dài thời gian phục hồi (HSMT yêu cầu phục hồi trong 24h — dòng 93).
3. **Giới hạn 15MB không đủ cho nhiều loại tài liệu thực tế** (văn bản pháp lý scan nhiều trang, file trình chiếu có hình ảnh) — và số 25MB (backend thật) khác số 15MB (README/frontend công bố) là mâu thuẫn cần thống nhất trước khi đưa vào hồ sơ dự thầu.
4. **CAS retry (`mutateDoc`) đọc lại TOÀN BỘ row mỗi lần retry** — nếu áp dụng cho `documents` (hiện actions.js/OpenRoutes.cs chưa dùng CAS cho documents, chỉ dùng cho votes/meetings) sẽ rất nặng vì phải đọc/viết lại cả BLOB mỗi lần tranh chấp ghi đồng thời (đã cảnh báo trước ở `phantich-hethong.md`).
5. **Không có File-Server riêng cho video/media** — nếu về sau bổ sung ghi hình họp, sẽ không có nơi lưu đúng theo mô hình HSMT quy định, buộc phải làm gấp hạ tầng mới giữa lúc vận hành.
6. **Thiếu mã hóa at-rest** cho cả CSDL và (giả định) File-Server tương lai — HSMT yêu cầu mã hóa lưu trữ cho dữ liệu mật (dòng 75, 645) nhưng code hiện chưa có TDE/column encryption nào.
7. **Thiếu virus/malware scan** — whitelist hiện tại chỉ kiểm PHẦN MỞ RỘNG tên file, không kiểm nội dung thật, không quét mã độc trước khi lưu.

### 3.4. Khuyến nghị kỹ thuật (xếp ưu tiên, ước lượng công + phân loại code/hạ tầng)

| # | Khuyến nghị | Ưu tiên | Ước lượng | Code hay hạ tầng |
|---|---|---|---|---|
| 1 | **Tách BLOB khỏi DB sang object storage** (bật MinIO đã có sẵn comment trong `docker-compose.yml`, hoặc dùng File-Server Ubuntu riêng như HSMT đề xuất) — DB chỉ giữ `fileKey`/`fileUrl` con trỏ + metadata | **CAO** | **M** (2-3 tuần: sửa `documentService.ts`, `guard.js`/`Guard.cs`, `db.js`/`SqlServerDocStore.cs` để tách luồng upload/download; viết migration chuyển dữ liệu base64 hiện có sang object storage) | **Cả 2** — cần code (API upload/download mới, đổi schema `DocFile`) + hạ tầng (bật MinIO container hoặc cấp máy File-Server Ubuntu tại TTDL TP) |
| 2 | **Streaming upload/download thay base64** (multipart/form-data hoặc presigned URL tới object storage, không nhồi vào JSON body) | **CAO** | **M** (đi cùng #1, không tách riêng được vì phụ thuộc kiến trúc lưu trữ mới) | Code (thay đổi API contract FE-BE) |
| 3 | **Thống nhất lại số giới hạn kích thước tệp** (15MB frontend vs 25MB backend) và ghi rõ 1 số duy nhất trong hồ sơ dự thầu + README, tăng hạn mức khi đã có object storage (không còn ràng buộc bởi JSONB) | **CAO** | **S** (vài giờ — chỉnh 3 nơi: `documentService.ts`, `util.js`, `nginx.conf`, README) | Code (thuần sửa hằng số) |
| 4 | **Virus/malware scan** cho mọi tệp tải lên trước khi lưu vào object storage (ClamAV hoặc dịch vụ scan tương đương) | **TRUNG BÌNH** | **M** (1-2 tuần: thêm service scan + hàng chờ xử lý async, chặn file cho tới khi scan xong) | **Cả 2** — cần cài đặt ClamAV daemon (hạ tầng) + code gọi API scan trong luồng upload |
| 5 | **Mã hóa at-rest** cho CSDL (TDE của SQL Server 2022, hoặc pgcrypto/disk encryption cho PostgreSQL) + mã hóa file trên object storage (server-side encryption của MinIO/S3), đáp ứng riêng yêu cầu mật mã cơ yếu cho dữ liệu mật (`DocFile.secret = true`) | **TRUNG BÌNH** | **M** (1-2 tuần cấu hình TDE/SSE; phần "mật mã cơ yếu" cho dữ liệu bí mật nhà nước cần tư vấn Ban Cơ yếu — nằm ngoài phạm vi kỹ thuật thuần) | Chủ yếu **hạ tầng** (bật TDE/SSE là cấu hình, không phải code nghiệp vụ) |
| 6 | **Sao lưu file riêng khỏi sao lưu DB** — sau khi tách BLOB (#1), thiết lập lịch backup riêng cho object storage/File-Server (rsync/snapshot), độc lập với backup DB, đúng mô hình 4-cụm của HSMT | **TRUNG BÌNH** | **S** (vài ngày — cấu hình cron/snapshot, không cần sửa code ứng dụng) | Hạ tầng |
| 7 | **Ghi hình cuộc họp (nếu chủ đầu tư yêu cầu bổ sung)** — bật LiveKit Egress API để xuất file MP4 sau mỗi phiên họp, lưu vào object storage (#1), gắn `Meeting.recordingUrl` mới | **THẤP** (HSMT không bắt buộc — chỉ làm nếu có yêu cầu bổ sung rõ ràng) | **L** (3-4 tuần: tích hợp Egress API, xử lý webhook hoàn tất, UI xem lại, chi phí lưu trữ video lớn hơn nhiều so với tài liệu) | **Cả 2** — code (gọi Egress API, model mới, UI player) + hạ tầng (dung lượng lưu trữ lớn hơn nhiều, băng thông) |
| 8 | **Cập nhật bảng sizing File-Server trong hồ sơ dự thầu** — làm rõ với Bên mời thầu về cột "Dung lượng lưu trữ" đang để trống ở dòng File-Server (HSMT dòng 322), đề xuất số cụ thể dựa trên khối lượng tài liệu ước tính 60 tháng | **CAO** (thuộc phạm vi hồ sơ dự thầu, không phải code) | **S** (nửa ngày làm việc — tính toán + viết văn bản làm rõ) | Không phải code/hạ tầng — là **hồ sơ dự thầu** |

**Việc code làm được ngay** (không cần chờ hạ tầng mới): #3 (thống nhất số giới hạn size).
**Việc cần hạ tầng trước khi code có ý nghĩa:** #1, #2 cần có object storage/File-Server thật (MinIO container hoặc máy Ubuntu) mới triển khai được; #4, #5 cần cài thêm dịch vụ ngoài (ClamAV, TDE).
**Việc thuộc phạm vi hồ sơ/pháp lý, không phải kỹ thuật thuần:** #8 (làm rõ HSMT), và phần "mã hóa cơ yếu cho dữ liệu bí mật nhà nước" trong #5 (cần tư vấn Ban Cơ yếu, đã được `docs/livekit-va-du-lieu.md` dòng 49 lưu ý tương tự).
