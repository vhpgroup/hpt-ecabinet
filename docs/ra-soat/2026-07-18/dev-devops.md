# Báo cáo DevOps — Trục (dự án eCabinet)

**Người thực hiện:** Trục — DevOps Engineer (subagent)
**Ngày:** 2026-07-18
**Repo:** `/agent/workspace/hpt-ecabinet`
**Phạm vi:** chỉ `deploy/`, `docker-compose.dotnet.yml`, `nginx.conf`, `scripts/loadtest.mjs` (mới), `README.md`, và 4 file mới trong `docs/`. Không commit/push git, không chạy docker/HTTP server trong sandbox (không có Docker daemon; nền tảng giết tiến trình mở socket dài).

**Nguồn giao việc:** `reports/techleader-verify.md` mục (b) Nhóm A việc #1, #2, #4, #6, #7; `reports/danhgia-benmoithau.md` mục A việc code #2, #3, #4, #5, #6.

---

## Tổng quan file đã tạo/sửa

| File | Loại | Việc # |
|---|---|---|
| `deploy/backup-mssql.sh` | Mới | 1 |
| `deploy/restore-mssql.sh` | Mới | 1 |
| `deploy/test-restore.sh` | Mới | 2 |
| `docs/dr-runbook.md` | Mới | 2 |
| `docker-compose.dotnet.yml` | Sửa (thêm service `caddy`, profile `tls`) | 3 |
| `scripts/loadtest.mjs` | Mới | 4 |
| `docs/loadtest.md` | Mới | 4 |
| `nginx.conf` | Sửa (thêm `listen [::]:80;`) | 5 |
| `deploy/Caddyfile`, `deploy/Caddyfile.internal` | Sửa (ghi chú dual-stack, không đổi hành vi) | 5 |
| `README.md` | Sửa (mục 11 bảng 3 trạng thái, mục "Giới hạn HA", mục "Sẵn sàng IPv6", TLS .NET, backup MSSQL, DR/loadtest links, LiveKit) | 5, 6, 7 (liên kết) |
| `docs/livekit-va-du-lieu.md` | Mới | 7 |

**Lưu ý quan trọng về phạm vi:** `git status` trong repo cho thấy nhiều file `server/`, `server-dotnet/`, `src/` đang bị 3 agent khác sửa song song (đúng như đề bài cảnh báo). Tôi đã xác nhận bằng `git diff --stat` rằng **không có thay đổi nào của tôi** trong các thư mục này — chỉ 5 file sửa (`README.md`, `deploy/Caddyfile`, `deploy/Caddyfile.internal`, `docker-compose.dotnet.yml`, `nginx.conf`) + 7 file mới đúng phạm vi được giao.

---

## Việc 1 — Sao lưu/phục hồi SQL Server

**File:** `deploy/backup-mssql.sh`, `deploy/restore-mssql.sh` (mới); README mục 11 mục con "Sao lưu / phục hồi SQL Server".

**Thiết kế:** đối tác 1:1 phong cách với `deploy/backup.sh`/`restore.sh` hiện có nhưng dùng `BACKUP DATABASE`/`RESTORE DATABASE ... WITH REPLACE` qua `sqlcmd -C` (image `mssql/server:2022-latest` cần cờ `-C` để tin cậy chứng thư tự ký, giống healthcheck có sẵn trong `docker-compose.dotnet.yml`). Vì `BACKUP DATABASE` ghi file `.bak` bên trong container (không stream qua stdout như `pg_dump`), script phải: ghi `.bak` trong container → `docker cp` ra host → nén gzip → rotate giữ `KEEP` bản (mặc định 14, env override) → xóa file tạm trong container. `restore-mssql.sh` đảo ngược quy trình, có bước `ALTER DATABASE ... SET SINGLE_USER WITH ROLLBACK IMMEDIATE` trước khi `RESTORE ... WITH REPLACE` (bắt buộc nếu DB đích đang có kết nối từ API .NET đang chạy). Đọc `DB_PASSWORD` từ env hoặc `deploy/.env.mssql` (tùy chọn, tương tự cách `.env` được nạp trong `backup.sh` hiện có). Comment tiếng Việt đầy đủ giải thích từng bước và lý do (vd vì sao không dùng cách stream như Postgres).

**Đã kiểm chứng trong sandbox:** `bash -n` cả 2 file — PASS (cú pháp shell hợp lệ).

**CHƯA kiểm chứng được (cần chạy trên máy triển khai thật):**
```bash
DB_PASSWORD='Ecabinet#2026' docker compose -f docker-compose.dotnet.yml up -d --build
DB_PASSWORD='Ecabinet#2026' ./deploy/backup-mssql.sh
DB_PASSWORD='Ecabinet#2026' ./deploy/restore-mssql.sh deploy/backups-mssql/ecabinet-<STAMP>.bak.gz
```
Rủi ro kỹ thuật lớn nhất: chưa xác nhận `docker cp` giữa host và container hoạt động đúng với đường dẫn đã chọn (`/var/opt/mssql/backup/...`), và chưa xác nhận cờ `-C`/cú pháp `sqlcmd` chạy đúng 100% trên phiên bản image thật (đã viết đúng theo cú pháp chuẩn + tham khảo `healthcheck` sẵn có trong compose, nhưng chưa tự thực thi được).

---

## Việc 2 — Kịch bản diễn tập khôi phục (DR drill)

**File:** `deploy/test-restore.sh` (mới, nhận tham số `postgres` hoặc `mssql`), `docs/dr-runbook.md` (mới).

**Thiết kế `test-restore.sh`:** cho MỖI biến thể — sao lưu DB nguồn (chỉ đọc) → khôi phục vào **database tạm riêng** (`ecabinet_drtest`, KHÔNG đụng DB đang chạy — an toàn tuyệt đối cho production) → đếm số bản ghi từng bảng (16 bảng: `c_users`, `c_units`, `c_rooms`, `c_meetings`, `c_documents`, `c_annotations`, `c_votes`, `c_speak_requests`, `c_questions`, `c_messages`, `c_tasks`, `c_notifications`, `c_audit`, `c_catalogs`, `c_guides`, `c_apikeys` — lấy từ `server/src/db.js` `COLLECTIONS`) so sánh nguồn vs bản khôi phục → in PASS/FAIL + thời gian từng bước (backup/restore/verify/cleanup) → dọn database tạm. Biến thể mssql phức tạp hơn: dùng `RESTORE FILELISTONLY` để đọc động tên logical file (`.mdf`/`.ldf`) từ header bản backup, rồi `RESTORE DATABASE ... WITH MOVE` đổi đường dẫn vật lý sang tên riêng cho DB tạm (tránh đụng file của DB `ecabinet` đang chạy — đây là điểm kỹ thuật SQL Server bắt buộc, không có ở Postgres).

**Thiết kế `docs/dr-runbook.md`:** quy trình DR đầy đủ theo đúng SLA HSMT — mục 2 "Phát hiện & phân tích nguyên nhân (≤8h)" (bảng bước + người chịu trách nhiệm + thời gian tối đa), mục 3 "Quy trình khôi phục (≤24h, 100% dữ liệu)" cho cả 2 biến thể + cách đo RTO thực tế bằng `test-restore.sh`, mục 3.4 làm rõ file đính kèm nằm TRONG CSDL (base64) nên sao lưu CSDL = sao lưu file (vá hiểu nhầm "chưa backup file đính kèm" từng bị nêu trong `reports/danhgia-benmoithau.md`), mục 4 "Lịch diễn tập định kỳ" (hằng ngày backup, hằng quý diễn tập test-restore, hằng năm diễn tập mất toàn bộ container), mục 5 "Bảng ghi nhận kết quả" (mẫu điền sau khi chạy thật) + mẫu báo cáo sự cố thật, mục 6 liệt kê rõ những gì CHƯA kiểm chứng.

**Đã kiểm chứng trong sandbox:** `bash -n test-restore.sh` — PASS.

**CHƯA kiểm chứng được (rủi ro cao nhất trong toàn bộ deliverable, cần chạy trên máy thật):**
```bash
cd deploy && ./test-restore.sh postgres    # cần docker-compose.pilot.yml đang chạy có dữ liệu
DB_PASSWORD='<mật-khẩu-SA-thật>' ./deploy/test-restore.sh mssql   # cần docker-compose.dotnet.yml đang chạy
```
Rủi ro cụ thể nhất: logic đọc `RESTORE FILELISTONLY` bằng `awk 'NR==1{print $1}'` để lấy tên logical file giả định output có đúng 2 dòng dữ liệu (data + log) theo thứ tự cố định — đây là cách hợp lý cho DB seed nhỏ nhưng **chưa xác nhận format output thật của `sqlcmd -h -1 -W`** khớp đúng giả định cột/khoảng trắng. Nếu sai, bước `WITH MOVE` sẽ lỗi ngay — cần chạy thật để xác nhận, hoặc dev backend .NET kiểm tra thủ công `RESTORE FILELISTONLY FROM DISK = ...` một lần để xác nhận format trước khi tin tưởng script tự động 100%.

---

## Việc 3 — TLS cho biến thể .NET

**File:** `docker-compose.dotnet.yml` (sửa — thêm service `caddy`).

**Thiết kế:** thêm service `caddy` (image `caddy:2-alpine`) với `profiles: ["tls"]` — chỉ được tạo khi chạy `docker compose --profile tls up`. Caddy sinh Caddyfile động lúc container start (qua `command: sh -c '...'` dùng `printf`) dựa vào `CADDY_TLS_MODE` (mặc định `letsencrypt`, hoặc `internal` cho mạng air-gapped) — mô phỏng đúng logic `deploy/pilot.sh` chọn giữa `Caddyfile`/`Caddyfile.internal` của bản pilot Node. Reverse proxy vào `web:80`; WebSocket `/api/realtime` hoạt động qua Caddy mặc định (không cần cấu hình `reverse_proxy` thêm — Caddy tự forward header `Upgrade`/`Connection`, và nginx bên trong `web` đã có location xử lý sẵn).

**Đảm bảo không đổi hành vi mặc định:** cổng `web` giữ nguyên `8081:80`; không truyền `--profile tls` → service `caddy` không được Docker Compose tạo ra (đã tự kiểm bằng cách parse YAML với PyYAML, xác nhận service tồn tại trong file nhưng có `profiles` field, đúng cơ chế opt-in của Docker Compose).

**Đã kiểm chứng trong sandbox:**
- YAML hợp lệ: `python3 -c "import yaml; yaml.safe_load(open('docker-compose.dotnet.yml'))"` — PASS, đọc được 4 service (`web`, `api`, `db`, `caddy`), `profiles: ['tls']` đúng, 3 volume.
- Logic sinh Caddyfile trong `command`: đã trích xuất đúng đoạn `sh -c` và chạy thử bằng `sh` thuần trong sandbox (không mở socket, chỉ chạy `printf` để in ra Caddyfile) — xác nhận output đúng cấu trúc cho cả 2 nhánh `letsencrypt`/`internal`, khớp định dạng `deploy/Caddyfile`/`Caddyfile.internal` hiện có.

**CHƯA kiểm chứng được (cần Docker thật):**
```bash
DOMAIN=<domain-thật> ACME_EMAIL=<email> DB_PASSWORD='Ecabinet#2026' \
  docker compose -f docker-compose.dotnet.yml --profile tls up -d --build
# xác nhận: Caddy container start OK, xin được chứng chỉ Let's Encrypt thật (cần domain
# công khai + cổng 80/443 mở), curl https://<domain> trả 200, WebSocket /api/realtime
# nâng cấp thành công qua Caddy.
```
Chưa xác nhận Caddy image `caddy:2-alpine` chạy `sh` (không phải `bash`) hỗ trợ đúng cú pháp đã viết — đã cố ý dùng cú pháp POSIX sh thuần (không dùng bashism) nên rủi ro thấp, nhưng chưa tự thực thi trong container Alpine thật.

---

## Việc 4 — Script kiểm tra tải

**File:** `scripts/loadtest.mjs` (mới, KHÔNG phụ thuộc npm — chỉ Node built-in `fetch`/`AbortController`), `docs/loadtest.md` (mới).

**Thiết kế:** cấu hình qua env (`BASE_URL`, `CCU=90`, `DURATION_S=120`, `RAMP_UP_MS`, `ACCOUNTS` mặc định 13 tài khoản demo có sẵn round-robin, `MEETING_ID=m1`, `VOTE_ID=v1` khớp seed thật đã xác nhận trong `src/data/seed.ts`, `OUT_JSON`). Mỗi "phiên ảo" lặp kịch bản: đăng nhập (1 request duy nhất, `parseJson: true` để lấy token ngay, không gọi lại lần 2) → danh sách phiên họp → chi tiết + tài liệu → thử biểu quyết → tra cứu (`/api/open/v1/spec`), lặp liên tục tới hết `DURATION_S`. Đo p50/p95/p99/max theo từng thao tác + tổng thể, RPS, error rate — có **phân loại lỗi**: lỗi nghiệp vụ dự kiến (400 "đã biểu quyết", 429 rate-limit login, 404 khi ID không tồn tại trên máy đích) tách riêng khỏi lỗi hạ tầng thật (5xx/timeout/network/401-403 bất ngờ), để error rate phản ánh đúng sức chịu tải, không lẫn logic nghiệp vụ của seed cố định. In bảng kết quả + xuất JSON đầy đủ (mọi sample thô) ra `OUT_JSON`.

**Xác thực API đã đọc trực tiếp mã nguồn trước khi viết** (không đoán): `POST /api/auth/login {username,password}` → `{token,user}` (`server/src/index.js`), `GET /api/meetings`, `GET /api/meetings/:id`, `GET /api/documents?meetingId=`, `POST /api/actions/vote/:id/ballot {optionId}` (`server/src/actions.js`), `GET /api/open/v1/spec` (không cần khóa API) — đúng route thật, đúng thứ tự router matching.

**Đã kiểm chứng trong sandbox:**
- `node --check scripts/loadtest.mjs` — PASS (cả trước và sau khi sửa logic login gọi 2 lần thành 1 lần).
- Logic `percentile()` đã test độc lập bằng script riêng ngoài repo (copy công thức, không mở socket): xác nhận p50/p95/p99 tính đúng trên mảng mẫu, xử lý đúng case rỗng và mảng 1 phần tử.

**CHƯA chạy trong sandbox (theo đúng ràng buộc không mở HTTP server/docker) — cần chạy trên máy triển khai:**
```bash
BASE_URL=http://localhost:8080 node scripts/loadtest.mjs                          # test nhanh cấu hình mặc định
BASE_URL=<domain-thật> CCU=90 DURATION_S=300 OUT_JSON=./loadtest-90ccu.json \
  node scripts/loadtest.mjs                                                       # test đúng ngưỡng HSMT
```
Rủi ro cần xác nhận khi chạy thật: (a) tổng RPS của 90 phiên ảo có thể tự chạm `RATE_LIMIT_MAX`/`LOGIN_RATE_MAX` của server (đã ghi rõ trong `docs/loadtest.md` mục 4 — đây là tính năng bảo mật hoạt động đúng, không phải bug của script); (b) chưa xác nhận endpoint `/api/documents?meetingId=` filter đúng theo query param này ở tầng route thật (route CRUD chung `GET /api/:collection` — cần xác nhận server có đọc query `meetingId` để filter hay trả toàn bộ documents rồi client tự filter; nếu là trường hợp sau, số liệu "documents" vẫn đo đúng độ trễ nhưng payload trả về sẽ lớn hơn dự kiến).

---

## Việc 5 — IPv6-ready

**File:** `nginx.conf` (sửa), `deploy/Caddyfile`, `deploy/Caddyfile.internal` (sửa — chỉ thêm comment, không đổi hành vi), README mục con "Sẵn sàng IPv6".

**Đã sửa:**
- `nginx.conf`: thêm `listen [::]:80;` cạnh `listen 80;` → dual-stack.
- `deploy/Caddyfile`, `Caddyfile.internal`: xác nhận (đọc code, không có `bind` nào ép IPv4) và ghi chú rằng Caddy mặc định dual-stack khi site block không chỉ định host cụ thể — KHÔNG cần sửa cấu hình, chỉ thêm dòng comment minh bạch.

**Phát hiện quan trọng (gap thật, NGOÀI phạm vi sửa vì thuộc `server-dotnet/`):** `server-dotnet/ECabinet.Api/Program.cs` dòng 9 ép cứng `Environment.SetEnvironmentVariable("ASPNETCORE_URLS", $"http://0.0.0.0:{port}")` — Kestrel sẽ CHỈ bind IPv4 (không tự động dual-stack như Node's `server.listen(PORT)` không truyền host). Đã ghi rõ vào bảng README "Sẵn sàng IPv6" (đánh 🔴) — **không sửa file này** vì `server-dotnet/` nằm ngoài phạm vi được giao (đang bị agent khác sửa song song). Đã nêu rõ mức impact thực tế thấp (API .NET chỉ được `web`/Caddy gọi nội bộ trong cấu hình mặc định, không expose thẳng port 3000 ra ngoài) nhưng vẫn là gap thật cần dev .NET khắc phục (đổi `0.0.0.0` → `[::]` hoặc bỏ hostbind cụ thể) trước khi công bố "IPv6-ready toàn hệ thống".

**Đã kiểm chứng trong sandbox:** đọc trực tiếp source `server/src/index.js` (`server.listen(PORT, callback)` không truyền host → Node mặc định dual-stack) và `server-dotnet/ECabinet.Api/Program.cs` (xác nhận IPv4-only tường minh) — đây là kiểm chứng bằng đọc code, không phải chạy thật.

**CHƯA kiểm chứng được (cần môi trường có IPv6 thật):**
```bash
# Sau khi triển khai, từ máy có IPv6:
curl -6 http://<domain-hoặc-IPv6-của-máy-chủ>/health
# Xác nhận Docker daemon có publish port ra IPv6 (cần daemon.json bật "ipv6": true — cấu hình hạ tầng, không phải compose)
docker network inspect bridge | grep -i ipv6
```

---

## Việc 6 — Sửa README trung thực

**File:** `README.md` (sửa nhiều mục, không đổi cấu trúc mục lục — đã kiểm bằng `grep "^## \|^### "` xác nhận vẫn đủ `## 1.` đến `## 11.`, anchor `#10-api-công-bố-cho-bên-thứ-3-lgsp-ready` vẫn khớp heading không đổi).

**(a) Mục 11:** câu mở đầu "port 1:1 ... đáp ứng yêu cầu nền tảng của E-HSMT" được giữ nguyên câu gốc nhưng bổ sung ngay bảng 3 dòng theo đúng yêu cầu: .NET 8 ✅ (build 0 lỗi + 72/72 test) · SQL Server 2022 🟡 (mã sẵn sàng, chưa kiểm thử instance thật, kèm lệnh compose cần chạy để kiểm) · Windows Server + IIS 🔴 (outline 6 bước văn bản, chưa kiểm chứng thực tế, Dockerfile build Linux). Kèm 1 câu giải thích cách đọc bảng để tránh đọc lướt hiểu nhầm.

**(b) Mục "Giới hạn HA hiện tại":** thêm mục con mới trong mục 11 — nêu rõ rate-limit + WebSocket realtime là state per-process (`RateLimit.cs`/`ratelimit.js`, `Ws.cs`/`ws.js`), hệ quả cụ thể khi chạy multi-instance (rate-limit không đồng bộ; client A trên instance 1 không nhận broadcast từ ghi ở instance 2), xác nhận refresh-token KHÔNG có gap này (đã lưu qua CSDL), và đường nâng cấp đề xuất (Redis pub/sub hoặc sticky session) — **không sửa code**, đúng yêu cầu.

**Các mục khác đã thêm (mở rộng hợp lý ngoài yêu cầu tối thiểu, phục vụ tính mạch lạc):** mục con "TLS cho biến thể .NET" (việc 3), "Sao lưu / phục hồi SQL Server" (việc 1), "Sẵn sàng IPv6" (việc 5), link tới `docs/dr-runbook.md`/`docs/loadtest.md`/`docs/livekit-va-du-lieu.md` (việc 2, 4, 7).

**Đã kiểm chứng:** đọc lại toàn bộ diff bằng `Read` tool sau khi sửa — xác nhận không có heading `##`/`###` nào bị trùng lặp hay đánh số sai, các mục lục `## 1.` → `## 11.` giữ nguyên thứ tự.

---

## Việc 7 — Ghi chú dữ liệu LiveKit

**File:** `docs/livekit-va-du-lieu.md` (mới), README mục 6 (thêm 1 dòng liên kết ngắn, không viết lại toàn mục).

**Nội dung:** đối chiếu HSMT dòng 643 ("không chia sẻ dữ liệu cho bên thứ 3 khi chưa được phép") với 2 phương án — LiveKit Cloud (media đi qua hạ tầng bên thứ 3, chỉ khuyến nghị pilot/demo) vs self-host (khuyến nghị bắt buộc khi vận hành chính thức tại TTDL TP, đã có hướng dẫn kỹ thuật ở README mục 6 "Cách 2"). Nêu rõ cơ chế gate hiện có (`LIVEKIT_URL`/`API_KEY`/`API_SECRET` để trống → mô phỏng, không kết nối bên thứ 3 nào — mặc định AN TOÀN nhất về tuân thủ). Kết luận khuyến nghị hành động cụ thể theo từng giai đoạn (demo/pilot vs vận hành chính thức) và lưu ý rõ đây là ghi chú đối chiếu kỹ thuật, không thay thế tư vấn pháp lý/cơ yếu nếu dữ liệu thuộc diện bí mật nhà nước.

**Đã kiểm chứng:** đọc trực tiếp `deploy/docker-compose.pilot.yml` (cơ chế gate 3 biến LIVEKIT_*, comment giải thích self-host cần host networking + dải UDP) và README mục 6 hiện có — không suy diễn, trích dẫn đúng cấu hình thật trong repo.

---

## Bảng tổng hợp "CHƯA kiểm chứng — cần chạy trên máy triển khai thật"

| # | Lệnh cần chạy | Mục đích |
|---|---|---|
| 1 | `DB_PASSWORD='...' docker compose -f docker-compose.dotnet.yml up -d --build` | Khởi động stack .NET+MSSQL thật (tiền đề cho mọi kiểm chứng .NET dưới đây) |
| 2 | `DB_PASSWORD='...' ./deploy/backup-mssql.sh` rồi `./deploy/restore-mssql.sh <file>` | Xác nhận backup/restore MSSQL hoạt động đúng trên container thật |
| 3 | `cd deploy && ./test-restore.sh postgres` (cần `docker-compose.pilot.yml` chạy có dữ liệu) | Xác nhận DR drill Postgres — đo RTO thật, PASS/FAIL đối chiếu dữ liệu |
| 4 | `DB_PASSWORD='...' ./deploy/test-restore.sh mssql` | Xác nhận DR drill MSSQL — RỦI RO CAO NHẤT (logic `RESTORE FILELISTONLY`/`WITH MOVE` chưa tự thực thi) |
| 5 | `DOMAIN=... ACME_EMAIL=... DB_PASSWORD='...' docker compose -f docker-compose.dotnet.yml --profile tls up -d --build` | Xác nhận Caddy service mới xin được chứng chỉ TLS thật, proxy đúng, WebSocket qua Caddy hoạt động |
| 6 | `BASE_URL=<domain> CCU=90 DURATION_S=300 node scripts/loadtest.mjs` | Có số liệu p50/p95/p99/RPS/error-rate thật đối chiếu SLA HSMT (90 CCU, <5s/thao tác) |
| 7 | `curl -6 http://<host>/health` từ máy có IPv6 (sau khi bật `ipv6: true` ở Docker daemon nếu cần) | Xác nhận dual-stack hoạt động thật ở tầng network, không chỉ ở tầng cấu hình app |

---

## Tóm tắt

Đã hoàn thành đủ 7 việc trong phạm vi file cho phép: (1) `deploy/backup-mssql.sh` + `restore-mssql.sh` — vá gap "chỉ có backup cho PostgreSQL"; (2) `deploy/test-restore.sh` (2 biến thể) + `docs/dr-runbook.md` — DR drill chứng minh RTO 24h bằng số liệu, không chỉ lý thuyết; (3) thêm service `caddy` (profile `tls`, opt-in) vào `docker-compose.dotnet.yml` — TLS cho biến thể .NET, không đổi hành vi mặc định; (4) `scripts/loadtest.mjs` (Node thuần) + `docs/loadtest.md` — kiểm tải 90 CCU đối chiếu SLA <5s/thao tác; (5) IPv6 dual-stack ở `nginx.conf` (đã sửa) và Caddy (đã dual-stack sẵn) — phát hiện thêm gap thật ở `server-dotnet/Program.cs` (IPv4-only tường minh, ngoài phạm vi sửa, đã ghi rõ trong README); (6) README mục 11 tách bảng 3 trạng thái (.NET ✅/MSSQL 🟡/Windows+IIS 🔴) thay câu khẳng định gộp, thêm mục "Giới hạn HA hiện tại" (rate-limit + WebSocket per-process, đường nâng cấp Redis); (7) `docs/livekit-va-du-lieu.md` đối chiếu LiveKit Cloud vs self-host với yêu cầu "không chia sẻ dữ liệu bên thứ 3". Mọi script `.sh` đã qua `bash -n`, YAML compose đã parse bằng PyYAML, `loadtest.mjs` đã qua `node --check`, README đã đọc lại xác nhận không phá mục lục/anchor. Rủi ro cần chạy thật để xác nhận cao nhất: logic T-SQL `RESTORE FILELISTONLY`/`WITH MOVE` trong `test-restore.sh mssql` chưa tự thực thi được trong sandbox (không có Docker). Không có file nào ngoài phạm vi bị sửa — đã xác nhận bằng `git diff --stat` so với các thay đổi đồng thời của 3 agent khác trong `server/`, `server-dotnet/`, `src/`.
