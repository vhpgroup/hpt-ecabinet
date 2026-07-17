# Quy trình khắc phục sự cố & khôi phục dữ liệu (DR Runbook) — eCabinet

**Phạm vi tài liệu:** quy trình kỹ thuật cho sự cố mất/hỏng dữ liệu CSDL (PostgreSQL bản Node hoặc SQL Server bản .NET), đối chiếu trực tiếp với các chỉ tiêu SLA trong HSMT gói thầu "Thuê phần mềm Họp không giấy tờ cho các xã, phường, đặc khu" (Sở KH&CN TP Hải Phòng):

| Chỉ tiêu HSMT | Giá trị yêu cầu | Cơ chế đáp ứng trong tài liệu này |
|---|---|---|
| Tính liên tục dịch vụ | Gián đoạn ≤ 3 lần/năm, cách nhau ≥ 4 tháng | Ngoài phạm vi tài liệu này (thuộc giám sát hạ tầng + vận hành 24/7) |
| Phục hồi sự cố | ≤ 24 giờ, khôi phục **100%** dữ liệu | Mục 3 "Quy trình khôi phục" + `deploy/test-restore.sh` đo thời gian thực tế |
| Phân tích nguyên nhân | ≤ 8 giờ kể từ khi phát hiện sự cố | Mục 2 "Quy trình phát hiện & phân tích" |
| Sao lưu định kỳ, kiểm tra toàn vẹn | Không có mốc giờ cụ thể, nhưng bắt buộc theo Phụ lục 12 TT 18/2024/TT-BTTTT | Mục 4 "Lịch diễn tập định kỳ" |

**Trạng thái tài liệu:** quy trình kỹ thuật — dựa trên script thật đã kiểm `bash -n` (`deploy/backup.sh`, `deploy/restore.sh`, `deploy/backup-mssql.sh`, `deploy/restore-mssql.sh`, `deploy/test-restore.sh`). **CHƯA chạy thử thật trên máy có Docker** (sandbox không có Docker daemon) — xem mục "Chưa kiểm chứng" ở cuối. Đây là runbook vận hành, không phải văn bản cam kết SLA có chữ ký (văn bản đó cần soạn riêng theo đúng thể thức hồ sơ dự thầu).

---

## 1. Nguyên tắc chung

- **Không bao giờ khôi phục trực tiếp lên database đang chạy** khi chưa xác nhận rõ nguyên nhân — luôn sao lưu trạng thái hiện tại (dù đã hỏng) trước khi ghi đè, để có thể điều tra / rollback quyết định khôi phục nếu chọn nhầm bản sao lưu.
- **Một người điều phối (Incident Commander) duy nhất** cho mỗi sự cố — tránh 2 người chạy song song 2 lệnh restore khác nhau.
- **Ghi log từng bước có mốc giờ** — dùng làm minh chứng khi tính RTO thực tế (đối chiếu SLA ≤24h) và làm báo cáo sau sự cố.
- Có 2 biến thể backend độc lập, **quy trình riêng theo biến thể đang chạy production**:
  - Node.js + PostgreSQL: `deploy/backup.sh` / `deploy/restore.sh` (stack `deploy/docker-compose.pilot.yml`)
  - .NET 8 + SQL Server: `deploy/backup-mssql.sh` / `deploy/restore-mssql.sh` (stack `docker-compose.dotnet.yml`)

---

## 2. Quy trình phát hiện & phân tích nguyên nhân (mục tiêu ≤ 8 giờ)

| Bước | Việc làm | Ai chịu trách nhiệm | Thời gian tối đa |
|---|---|---|---|
| 2.1 | Phát hiện sự cố: cảnh báo tự động (giám sát hạ tầng TTDL TP — ngoài phạm vi code repo này) hoặc báo cáo từ người dùng qua kênh hỗ trợ | Đội vận hành trực 24/7 | Ngay khi xảy ra |
| 2.2 | Xác nhận phạm vi: kiểm `GET /health` (trả `db: postgresql/pglite` hoặc `sqlserver/inmemory` — xem README mục 3, mục 11), kiểm log container (`docker compose logs api db --tail=200`) | Kỹ thuật viên trực | ≤ 30 phút |
| 2.3 | Phân loại sự cố: (a) lỗi ứng dụng không mất dữ liệu (restart service đủ) — (b) mất/hỏng dữ liệu CSDL (cần khôi phục) — (c) sự cố hạ tầng (mạng/máy chủ, ngoài phạm vi DB) | Kỹ thuật viên trực + Incident Commander | ≤ 2 giờ |
| 2.4 | Nếu (b): xác định **điểm khôi phục** (RPO) — bản sao lưu gần nhất còn nguyên vẹn trước thời điểm sự cố, liệt kê bằng `ls -lt deploy/backups/` (postgres) hoặc `ls -lt deploy/backups-mssql/` (mssql) | Kỹ thuật viên trực | ≤ 1 giờ |
| 2.5 | Ghi nhận nguyên nhân gốc (root cause) bước đầu vào báo cáo sự cố (mẫu ở mục 5) — có thể bổ sung chi tiết sau, nhưng bản sơ bộ phải có trong mốc 8 giờ | Incident Commander | ≤ 8 giờ (tổng từ 2.1) |

Nếu không xác định được nguyên nhân trong 8 giờ nhưng đã có đủ dữ kiện để quyết định khôi phục (mục 3), **vẫn tiến hành khôi phục ngay** — không chờ điều tra xong mới khôi phục, vì mốc RTO 24h chạy song song với mốc phân tích 8h, không phải sau nó.

---

## 3. Quy trình khôi phục (mục tiêu ≤ 24 giờ, 100% dữ liệu)

### 3.1. Biến thể PostgreSQL (Node.js — `deploy/docker-compose.pilot.yml`)

```bash
cd deploy
# 1) Xác định bản sao lưu cần dùng
ls -lt backups/*.sql.gz | head -5

# 2) (Khuyến nghị) sao lưu trạng thái hiện tại trước khi ghi đè — dù đang lỗi
./backup.sh   # có thể lỗi nếu DB không truy vấn được; bỏ qua nếu vậy, ghi log lý do

# 3) Khôi phục
./restore.sh backups/ecabinet-YYYYmmdd-HHMMSS.sql.gz
# Script sẽ: DROP SCHEMA public CASCADE -> nạp lại toàn bộ từ bản dump -> restart API

# 4) Xác nhận
curl -s http://localhost:8080/health   # hoặc domain thật qua Caddy
```

### 3.2. Biến thể SQL Server (.NET — `docker-compose.dotnet.yml`)

```bash
cd deploy
DB_PASSWORD='<mật-khẩu-SA>' bash -c '
  ls -lt backups-mssql/*.bak.gz | head -5
  ./restore-mssql.sh backups-mssql/ecabinet-YYYYmmdd-HHMMSS.bak.gz
'
# Script sẽ: SET SINGLE_USER (đóng kết nối cũ) -> RESTORE DATABASE ... WITH REPLACE
#            -> SET MULTI_USER -> restart api

curl -s http://localhost:8081/health
```

### 3.3. Đo & xác nhận RTO thực tế bằng số liệu (không chỉ ước lượng)

Chạy diễn tập trên **bản sao** (không phải production) để có số liệu thời gian thực tế của TỪNG bước, không lẫn với thời gian điều phối con người:

```bash
./deploy/test-restore.sh postgres    # hoặc: ./deploy/test-restore.sh mssql
```

Script tự: sao lưu DB nguồn → khôi phục vào **database tạm riêng** (`ecabinet_drtest`, không đụng DB đang chạy) → đối chiếu số bản ghi từng bảng nguồn vs khôi phục → in PASS/FAIL kèm thời gian từng bước → dọn dẹp database tạm. Dùng thời gian đo được (bước backup + restore) cộng thêm ước lượng thời gian phát hiện + điều phối (mục 2) để có RTO tổng thể thực tế — ghi vào bảng mục 5.

### 3.4. Trường hợp mất cả file đính kèm (không chỉ CSDL)

Tài liệu/tệp đính kèm hiện lưu **base64 trong cột JSONB/NVARCHAR của CSDL** (README mục 3, mục 9 "Giới hạn hiện tại") — nghĩa là sao lưu CSDL (mục 3.1/3.2 trên) **đã bao gồm** toàn bộ nội dung tệp, không cần quy trình sao lưu file riêng. Đây là điểm khác với hệ thống lưu file trên filesystem/S3 riêng — cần ghi rõ trong hồ sơ SLA để tránh hiểu nhầm "chưa backup file đính kèm" (gap này từng bị nêu trong báo cáo đánh giá bên mời thầu — nay không còn đúng nếu xác nhận lại: file NẰM TRONG CSDL, sao lưu CSDL = sao lưu file).

---

## 4. Lịch diễn tập định kỳ

| Hoạt động | Chu kỳ | Công cụ | Ghi chú |
|---|---|---|---|
| Sao lưu tự động | Hằng ngày, 2h sáng (khuyến nghị, xem `deploy/pilot.sh` mục cài cron) | `backup.sh` (postgres) hoặc `backup-mssql.sh` (mssql) qua cron | Giữ `BACKUP_KEEP`/`KEEP` bản (mặc định 30/14) |
| Kiểm tra file backup không rỗng | Mỗi lần chạy backup (tự động trong script) | tích hợp sẵn trong `backup.sh`/`backup-mssql.sh` | Không đảm bảo "phục hồi được" — chỉ đảm bảo "không rỗng" |
| **Diễn tập khôi phục đầy đủ (test-restore)** | **Tối thiểu 1 lần/quý** (khuyến nghị hằng tháng trong 3 tháng đầu vận hành để có đường cơ sở thời gian, sau đó giảm về hằng quý) | `deploy/test-restore.sh postgres|mssql` | Kết quả PASS/FAIL + thời gian ghi vào bảng mục 5 dưới — đây là **bằng chứng thực nghiệm cho SLA ≤24h**, không phải suy luận |
| Rà soát dung lượng lưu trữ backup | Hằng tháng | `du -sh deploy/backups*/` | Tránh backup đầy ổ đĩa gây fail âm thầm |
| Diễn tập kịch bản mất hoàn toàn container/máy chủ (không chỉ mất DB) | Tối thiểu 1 lần trước khi nghiệm thu chính thức, sau đó hằng năm | Dựng lại toàn bộ stack từ `docker compose ... up -d --build` trên máy trống + khôi phục backup mới nhất | Không nằm trong `test-restore.sh` (script chỉ diễn tập lớp DB) — cần làm tay, ghi log riêng |

---

## 5. Bảng ghi nhận kết quả diễn tập (mẫu — điền sau mỗi lần chạy thật)

| Ngày diễn tập | Biến thể | Người thực hiện | Thời gian backup | Thời gian restore | Thời gian đối chiếu | Tổng (kỹ thuật) | Số bảng khớp/tổng | Kết quả | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|
| _(vd 2026-08-01)_ | postgres | _(tên)_ | _(giây)_ | _(giây)_ | _(giây)_ | _(giây)_ | _(vd 16/16)_ | PASS/FAIL | _(vd lần đầu chạy trên máy thật, số liệu tham chiếu HSMT §4.3.2)_ |
| | mssql | | | | | | | | |

**Cách điền:** chạy `./deploy/test-restore.sh <postgres|mssql>` trên máy triển khai thật, copy phần "KẾT QUẢ DIỄN TẬP KHÔI PHỤC" ở cuối output vào bảng trên. Đính kèm log đầy đủ (không chỉ bảng tóm tắt) vào hồ sơ nghiệm thu nếu bên mời thầu yêu cầu bằng chứng chi tiết.

### Báo cáo sự cố thật (khi có sự cố production, không phải diễn tập)

Mẫu tối thiểu cần ghi (đúng tinh thần HSMT mục "báo cáo dịch vụ định kỳ" + "phân tích nguyên nhân ≤8h"):

```
Mã sự cố:            SC-YYYYMMDD-NN
Thời điểm phát hiện:  YYYY-MM-DD HH:MM
Thời điểm khôi phục xong: YYYY-MM-DD HH:MM   (RTO thực tế = ... giờ ... phút)
Nguyên nhân gốc:      ...
Bản sao lưu dùng khôi phục: deploy/backups[-mssql]/ecabinet-....gz  (thời điểm tạo: ...)
Dữ liệu mất (nếu có):  khoảng thời gian giữa bản sao lưu dùng và thời điểm sự cố
                       (đây là RPO thực tế — nếu backup hằng ngày, RPO tối đa ~24h;
                       cần đối chiếu với yêu cầu "100% dữ liệu" của HSMT — nếu RPO
                       > 0, cần nêu rõ mức chấp nhận với chủ đầu tư)
Số bảng đối chiếu khớp: n/16 (dùng cùng cách đối chiếu như test-restore.sh)
Người xử lý:          ...
Người phê duyệt báo cáo: ...
```

---

## 6. Những gì CHƯA kiểm chứng được (đọc trước khi tin tưởng tuyệt đối vào tài liệu này)

- **`deploy/test-restore.sh`, `backup-mssql.sh`, `restore-mssql.sh` chưa chạy thử lần nào trên máy có Docker thật** — sandbox hiện tại không có Docker daemon (nền tảng chặn mở socket/tiến trình dài). Đã kiểm `bash -n` (cú pháp shell hợp lệ) nhưng **chưa xác nhận logic T-SQL (`RESTORE FILELISTONLY`, `WITH MOVE`) chạy đúng trên SQL Server thật** — đây là phần rủi ro cao nhất vì tên logical file trong file `.bak` có thể khác quy ước script đang giả định (script đọc động qua `RESTORE FILELISTONLY` để giảm rủi ro này, nhưng vẫn cần xác nhận bằng chạy thật).
- **Thời gian trong bảng mục 5 hiện là placeholder** — cần điền số liệu thật sau khi chạy `test-restore.sh` trên máy triển khai.
- **RTO 24h trong tài liệu này chỉ tính phần kỹ thuật (backup+restore DB)** — chưa cộng thời gian thực tế phát hiện sự cố + điều phối con người + có thể chờ phê duyệt (đây phụ thuộc quy trình vận hành thật với Sở, không phải thứ đo được bằng code).
- **Chưa có cơ chế giám sát tự động phát hiện sự cố** (Prometheus/Grafana/cảnh báo email-SMS) trong repo — mục 2.1 "Phát hiện sự cố" hiện phụ thuộc giám sát hạ tầng TTDL TP hoặc báo cáo thủ công từ người dùng, không phải tự động 24/7 theo đúng nghĩa HSMT mục 4.4.3.

**Lệnh cần chạy trên máy triển khai thật để kiểm chứng đầy đủ:**
```bash
# Biến thể postgres — cần docker compose stack pilot đang chạy có dữ liệu
cd deploy && ./test-restore.sh postgres

# Biến thể mssql — cần docker-compose.dotnet.yml đang chạy, DB_PASSWORD đúng mật khẩu SA
DB_PASSWORD='<mật-khẩu-SA-thật>' ./deploy/test-restore.sh mssql
```
