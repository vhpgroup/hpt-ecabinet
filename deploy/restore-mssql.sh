#!/usr/bin/env bash
# ============================================================
# eCabinet — KHÔI PHỤC CƠ SỞ DỮ LIỆU (SQL Server 2022, biến thể .NET)
# từ bản sao lưu do deploy/backup-mssql.sh tạo
#   ./deploy/restore-mssql.sh deploy/backups-mssql/ecabinet-YYYYmmdd-HHMMSS.bak.gz
# CẢNH BÁO: ghi đè toàn bộ dữ liệu hiện tại của database đích.
#           Hãy sao lưu trước khi khôi phục (./backup-mssql.sh).
#
# Cách hoạt động (ngược lại với backup-mssql.sh):
#   1) Giải nén .bak.gz -> .bak tạm trên host.
#   2) `docker compose cp` file .bak vào TRONG container `db`.
#   3) RESTORE DATABASE ... WITH REPLACE — ghi đè database đích bằng nội dung
#      bản sao lưu (REPLACE bắt buộc vì SQL Server mặc định chặn ghi đè
#      database đang tồn tại/đang có kết nối để tránh khôi phục nhầm).
#   4) Dọn file .bak tạm trong container.
#
# Biến môi trường:
#   DB_PASSWORD  — mật khẩu SA (BẮT BUỘC)
#   DB_NAME      — tên database ĐÍCH sẽ bị ghi đè (mặc định ecabinet).
#                  Đổi biến này khi muốn khôi phục vào DB TẠM để diễn tập
#                  (xem deploy/test-restore.sh) mà không đụng DB đang chạy.
#   COMPOSE_FILE — đường dẫn docker-compose (mặc định docker-compose.dotnet.yml)
#   SKIP_CONFIRM — đặt =1 để bỏ qua xác nhận tương tác (dùng trong script tự
#                  động như test-restore.sh; KHÔNG dùng khi chạy tay trên
#                  production để tránh khôi phục nhầm)
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"          # -> thư mục deploy/
ROOT="$(cd .. && pwd)"

if [ -f ./.env.mssql ]; then set -a; . ./.env.mssql; set +a; fi

: "${DB_PASSWORD:?Chưa đặt DB_PASSWORD (mật khẩu SA của SQL Server).}"
DB_NAME="${DB_NAME:-ecabinet}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT/docker-compose.dotnet.yml}"
COMPOSE="docker compose -f $COMPOSE_FILE"

FILE="${1:-}"
[ -z "$FILE" ] && { echo "Cách dùng: ./restore-mssql.sh <đường-dẫn-file.bak.gz|.bak>"; exit 1; }
[ -f "$FILE" ] || { echo "✗ Không thấy file: $FILE"; exit 1; }

if [ "${SKIP_CONFIRM:-0}" != "1" ]; then
  read -r -p "Ghi đè toàn bộ DB '${DB_NAME}' hiện tại bằng '$FILE'? (gõ 'yes' để tiếp tục): " ans
  [ "$ans" = "yes" ] || { echo "Đã hủy."; exit 0; }
fi

# Giải nén nếu cần (chấp nhận cả .bak thô, tiện khi copy tay hoặc dùng trong test-restore.sh).
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
case "$FILE" in
  *.gz)
    LOCAL_BAK="$WORKDIR/restore.bak"
    gunzip -c "$FILE" > "$LOCAL_BAK"
    ;;
  *)
    LOCAL_BAK="$FILE"
    ;;
esac

CONTAINER_ID="$($COMPOSE ps -q db)"
if [ -z "$CONTAINER_ID" ]; then
  echo "✗ Không tìm thấy container 'db' đang chạy. Kiểm tra: $COMPOSE ps"
  exit 1
fi

CONTAINER_PATH="/var/opt/mssql/backup/restore-$(date +%s).bak"
echo "• Đang chép file sao lưu vào container…"
$COMPOSE exec -T db mkdir -p /var/opt/mssql/backup
docker cp "$LOCAL_BAK" "${CONTAINER_ID}:${CONTAINER_PATH}"

echo "• Đang khôi phục database '${DB_NAME}' (WITH REPLACE — ghi đè)…"
# WITH REPLACE: bắt buộc để SQL Server cho ghi đè database đã tồn tại (mặc định
# nó từ chối nếu database đích khác 'lịch sử sao lưu' để tránh khôi phục nhầm
# chồng lên database không liên quan). STATS=10: in tiến độ.
#
# LƯU Ý: nếu database ĐÍCH đang có phiên kết nối (ví dụ API .NET đang chạy),
# RESTORE sẽ bị chặn ("database in use"). Ta chủ động đưa DB về SINGLE_USER
# trước khi restore rồi trả lại MULTI_USER sau — làm gọn trong 1 lần gọi sqlcmd
# bằng script T-SQL nhiều câu lệnh (khớp cách vận hành thật khi restore production).
$COMPOSE exec -T db /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "${DB_PASSWORD}" -Q "
IF DB_ID(N'${DB_NAME}') IS NOT NULL
BEGIN
  ALTER DATABASE [${DB_NAME}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
END
RESTORE DATABASE [${DB_NAME}] FROM DISK = N'${CONTAINER_PATH}' WITH REPLACE, STATS = 10;
ALTER DATABASE [${DB_NAME}] SET MULTI_USER;
"

echo "• Dọn file tạm trong container…"
$COMPOSE exec -T db rm -f "${CONTAINER_PATH}"

# Chỉ khởi động lại API nếu đang khôi phục vào DB mặc định (production) — khi
# DB_NAME đã bị đổi (ví dụ dùng cho diễn tập DR vào DB tạm), KHÔNG restart API
# vì API không nối tới DB tạm đó.
if [ "$DB_NAME" = "ecabinet" ]; then
  echo "• Khởi động lại API…"
  $COMPOSE restart api || echo "  (bỏ qua: không restart được service 'api', có thể chưa chạy)"
fi

echo "✔ Khôi phục xong database '${DB_NAME}' từ $FILE"
