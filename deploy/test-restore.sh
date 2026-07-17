#!/usr/bin/env bash
# ============================================================
# eCabinet — DIỄN TẬP KHÔI PHỤC (DR DRILL)
# Chứng minh bằng SỐ LIỆU (không chỉ lý thuyết) khả năng đạt SLA HSMT:
#   "Phục hồi sự cố ≤24h, khôi phục 100% dữ liệu" (HSMT mục 4.3.2)
#
#   ./deploy/test-restore.sh postgres     # diễn tập biến thể Node + PostgreSQL
#   ./deploy/test-restore.sh mssql        # diễn tập biến thể .NET + SQL Server
#
# QUAN TRỌNG — an toàn dữ liệu:
#   Script này KHÔNG đụng vào database chính đang phục vụ người dùng.
#   Luồng: sao lưu DB chính (chỉ ĐỌC) -> khôi phục vào MỘT DATABASE TẠM
#   riêng (ecabinet_drtest) -> đối chiếu số bản ghi với DB chính -> DROP
#   database tạm khi xong. Không có bước nào ghi đè DB đang chạy.
#
# Đo & in:
#   - Thời gian từng bước (backup / copy / restore / đối chiếu)
#   - Tổng thời gian toàn bộ diễn tập (ước lượng RTO thực tế cho DB, chưa
#     tính thời gian phát hiện sự cố + điều phối con người — xem
#     docs/dr-runbook.md cho quy trình DR đầy đủ)
#   - Số bản ghi từng bảng: NGUỒN vs BẢN KHÔI PHỤC — PASS nếu khớp 100%,
#     FAIL nếu lệch bất kỳ bảng nào (không được coi là "khôi phục thành công"
#     nếu thiếu dữ liệu, đúng yêu cầu HSMT "100% dữ liệu")
#
# CHƯA CHẠY THỬ TRONG SANDBOX (không có Docker daemon ở đây) — cần chạy
# trên máy có Docker + docker compose, với stack tương ứng đang lên
# (docker-compose.pilot.yml cho postgres, docker-compose.dotnet.yml cho
# mssql). Xem docs/dr-runbook.md mục "Lịch diễn tập định kỳ".
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"          # -> thư mục deploy/
ROOT="$(cd .. && pwd)"

VARIANT="${1:-}"
if [ "$VARIANT" != "postgres" ] && [ "$VARIANT" != "mssql" ]; then
  echo "Cách dùng: $0 <postgres|mssql>"
  echo "  postgres — diễn tập stack docker-compose.pilot.yml (deploy/backup.sh + restore.sh)"
  echo "  mssql    — diễn tập stack docker-compose.dotnet.yml (backup-mssql.sh + restore-mssql.sh)"
  exit 1
fi

# ---------- tiện ích đo thời gian & in kết quả ----------
STEP_START=0
step_start() { STEP_START=$(date +%s); echo "• [$1] bắt đầu $(date '+%H:%M:%S')"; }
step_end() {
  local now; now=$(date +%s)
  local dur=$((now - STEP_START))
  echo "  [$1] xong sau ${dur}s"
  echo "$dur"   # trả ra để caller gom tổng
}

DRILL_START=$(date +%s)
declare -A DURATIONS
PASS=1
FAIL_REASON=""

# ============================================================
# BIẾN THỂ POSTGRES (docker-compose.pilot.yml)
# ============================================================
run_postgres() {
  local COMPOSE="docker compose -f docker-compose.pilot.yml --env-file .env"
  [ -f ./.env ] || { echo "✗ Chưa có deploy/.env — copy từ .env.example và cấu hình trước (xem README/pilot.sh)."; exit 1; }
  set -a; . ./.env; set +a

  local TMP_DB="ecabinet_drtest"
  local TABLES=(c_users c_units c_rooms c_meetings c_documents c_annotations c_votes \
                c_speak_requests c_questions c_messages c_tasks c_notifications \
                c_audit c_catalogs c_guides c_apikeys)

  step_start "1/5 Sao lưu DB nguồn"
  # Dùng chính pg_dump trực tiếp (không qua backup.sh) để có tên file cố định,
  # dễ dọn dẹp sau diễn tập — logic sao lưu giống backup.sh (pg_dump | gzip).
  local DUMP="./backups/drtest-$(date +%s).sql.gz"
  $COMPOSE exec -T db pg_dump -U ecabinet ecabinet | gzip > "$DUMP"
  DURATIONS[backup]=$(step_end "1/5")

  step_start "2/5 Tạo database tạm '${TMP_DB}'"
  $COMPOSE exec -T db psql -U ecabinet -d postgres -c "DROP DATABASE IF EXISTS ${TMP_DB};"
  $COMPOSE exec -T db psql -U ecabinet -d postgres -c "CREATE DATABASE ${TMP_DB} OWNER ecabinet;"
  DURATIONS[create_tmp]=$(step_end "2/5")

  step_start "3/5 Khôi phục bản sao lưu vào database tạm"
  gunzip -c "$DUMP" | $COMPOSE exec -T db psql -U ecabinet -d "${TMP_DB}"
  DURATIONS[restore]=$(step_end "3/5")

  step_start "4/5 Đối chiếu số bản ghi từng bảng (nguồn vs khôi phục)"
  echo
  printf "  %-22s %10s %10s %s\n" "Bảng" "Nguồn" "Khôi_phục" "Kết quả"
  printf "  %-22s %10s %10s %s\n" "----" "-----" "---------" "-------"
  for t in "${TABLES[@]}"; do
    local src rst
    src=$($COMPOSE exec -T db psql -U ecabinet -d ecabinet -tAc "SELECT COUNT(*) FROM ${t};" 2>/dev/null | tr -d '[:space:]' || echo "ERR")
    rst=$($COMPOSE exec -T db psql -U ecabinet -d "${TMP_DB}" -tAc "SELECT COUNT(*) FROM ${t};" 2>/dev/null | tr -d '[:space:]' || echo "ERR")
    local mark="OK"
    if [ "$src" != "$rst" ]; then mark="LỆCH"; PASS=0; FAIL_REASON="bảng ${t}: nguồn=${src} khôi_phục=${rst}"; fi
    printf "  %-22s %10s %10s %s\n" "$t" "$src" "$rst" "$mark"
  done
  echo
  DURATIONS[verify]=$(step_end "4/5")

  step_start "5/5 Dọn dẹp database tạm + file dump diễn tập"
  $COMPOSE exec -T db psql -U ecabinet -d postgres -c "DROP DATABASE IF EXISTS ${TMP_DB};"
  rm -f "$DUMP"
  DURATIONS[cleanup]=$(step_end "5/5")
}

# ============================================================
# BIẾN THỂ MSSQL (docker-compose.dotnet.yml)
# ============================================================
run_mssql() {
  if [ -f ./.env.mssql ]; then set -a; . ./.env.mssql; set +a; fi
  : "${DB_PASSWORD:?Chưa đặt DB_PASSWORD (mật khẩu SA). Ví dụ: DB_PASSWORD='Ecabinet#2026' ./test-restore.sh mssql}"
  local COMPOSE="docker compose -f ${ROOT}/docker-compose.dotnet.yml"

  local TMP_DB="ecabinet_drtest"
  local TABLES=(c_users c_units c_rooms c_meetings c_documents c_annotations c_votes \
                c_speak_requests c_questions c_messages c_tasks c_notifications \
                c_audit c_catalogs c_guides c_apikeys)

  local sqlcmd_src="/opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P ${DB_PASSWORD}"

  step_start "1/5 Sao lưu DB nguồn"
  local STAMP; STAMP=$(date +%s)
  local BAK_NAME="drtest-${STAMP}.bak"
  local CONTAINER_BAK="/var/opt/mssql/backup/${BAK_NAME}"
  $COMPOSE exec -T db mkdir -p /var/opt/mssql/backup
  $COMPOSE exec -T db $sqlcmd_src -Q \
    "BACKUP DATABASE [ecabinet] TO DISK = N'${CONTAINER_BAK}' WITH FORMAT, INIT;"
  DURATIONS[backup]=$(step_end "1/5")

  step_start "2/5 RESTORE bản sao lưu vào database tạm '${TMP_DB}' (WITH MOVE — không đụng file DB chính)"
  local CID; CID=$($COMPOSE ps -q db)
  [ -n "$CID" ] || { echo "✗ Không tìm thấy container 'db'. Kiểm tra: $COMPOSE ps"; exit 1; }
  $COMPOSE exec -T db $sqlcmd_src -Q "DROP DATABASE IF EXISTS [${TMP_DB}];"
  # Lấy đường dẫn logic file .mdf/.ldf của DB nguồn từ backup header để đổi tên
  # file vật lý khi restore vào DB tạm (WITH MOVE) — nếu không đổi, SQL Server
  # sẽ báo lỗi trùng đường dẫn file với database ecabinet đang chạy.
  local FILELIST; FILELIST=$($COMPOSE exec -T db $sqlcmd_src -h -1 -W -Q \
    "SET NOCOUNT ON; RESTORE FILELISTONLY FROM DISK = N'${CONTAINER_BAK}';" 2>/dev/null || true)
  # Trích LogicalName (cột 1) — cách đơn giản, ổn định cho DB seed nhỏ 2 file (data+log).
  local LOGICAL_DATA LOGICAL_LOG
  LOGICAL_DATA=$(echo "$FILELIST" | awk 'NR==1{print $1}')
  LOGICAL_LOG=$(echo "$FILELIST" | awk 'NR==2{print $1}')
  if [ -z "$LOGICAL_DATA" ] || [ -z "$LOGICAL_LOG" ]; then
    echo "✗ Không đọc được FILELISTONLY — không thể xác định tên logical file để MOVE. Xem log RESTORE FILELISTONLY thủ công."
    exit 1
  fi
  $COMPOSE exec -T db $sqlcmd_src -Q "
RESTORE DATABASE [${TMP_DB}] FROM DISK = N'${CONTAINER_BAK}'
WITH MOVE N'${LOGICAL_DATA}' TO N'/var/opt/mssql/data/${TMP_DB}.mdf',
     MOVE N'${LOGICAL_LOG}' TO N'/var/opt/mssql/data/${TMP_DB}_log.ldf',
     REPLACE, STATS = 10;
"
  DURATIONS[restore]=$(step_end "2/5")

  step_start "3/5 Đối chiếu số bản ghi từng bảng (nguồn vs khôi phục)"
  echo
  printf "  %-22s %10s %10s %s\n" "Bảng" "Nguồn" "Khôi_phục" "Kết quả"
  printf "  %-22s %10s %10s %s\n" "----" "-----" "---------" "-------"
  for t in "${TABLES[@]}"; do
    local src rst
    src=$($COMPOSE exec -T db $sqlcmd_src -h -1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM [ecabinet].dbo.${t};" 2>/dev/null | tr -d '[:space:]\r' || echo "ERR")
    rst=$($COMPOSE exec -T db $sqlcmd_src -h -1 -W -Q "SET NOCOUNT ON; IF OBJECT_ID(N'[${TMP_DB}].dbo.${t}') IS NOT NULL SELECT COUNT(*) FROM [${TMP_DB}].dbo.${t}; ELSE SELECT -1;" 2>/dev/null | tr -d '[:space:]\r' || echo "ERR")
    local mark="OK"
    if [ "$src" != "$rst" ]; then mark="LỆCH"; PASS=0; FAIL_REASON="bảng ${t}: nguồn=${src} khôi_phục=${rst}"; fi
    printf "  %-22s %10s %10s %s\n" "$t" "$src" "$rst" "$mark"
  done
  echo
  DURATIONS[verify]=$(step_end "3/5")

  step_start "4/5 Dọn dẹp database tạm"
  $COMPOSE exec -T db $sqlcmd_src -Q "DROP DATABASE IF EXISTS [${TMP_DB}];"
  DURATIONS[cleanup]=$(step_end "4/5")

  step_start "5/5 Dọn file sao lưu tạm trong container"
  $COMPOSE exec -T db rm -f "${CONTAINER_BAK}"
  DURATIONS[remove_bak]=$(step_end "5/5")
}

# ---------- chạy đúng biến thể ----------
cd "$ROOT/deploy" 2>/dev/null || true   # đảm bảo cwd = deploy/ cho các đường dẫn tương đối (.env, backups/)
if [ "$VARIANT" = "postgres" ]; then
  run_postgres
else
  run_mssql
fi

DRILL_END=$(date +%s)
TOTAL=$((DRILL_END - DRILL_START))

echo "============================================================"
echo "KẾT QUẢ DIỄN TẬP KHÔI PHỤC — biến thể: ${VARIANT}"
echo "  Thời gian: $(date '+%Y-%m-%d %H:%M:%S')"
for k in "${!DURATIONS[@]}"; do echo "  - Bước '${k}': ${DURATIONS[$k]}s"; done
echo "  Tổng thời gian diễn tập (chỉ phần kỹ thuật DB, chưa gồm phát hiện/điều phối): ${TOTAL}s"
if [ "$PASS" = "1" ]; then
  echo "  KẾT LUẬN: PASS — 100% số bản ghi khớp giữa nguồn và bản khôi phục."
else
  echo "  KẾT LUẬN: FAIL — lệch dữ liệu (${FAIL_REASON}). KHÔNG đạt yêu cầu '100% dữ liệu' — cần điều tra trước khi ghi nhận vào hồ sơ DR."
fi
echo "============================================================"
echo
echo "Ghi kết quả này vào bảng diễn tập tại docs/dr-runbook.md (mục 'Bảng ghi nhận kết quả')."

[ "$PASS" = "1" ] || exit 1
