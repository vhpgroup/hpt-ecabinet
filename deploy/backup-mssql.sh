#!/usr/bin/env bash
# ============================================================
# eCabinet — SAO LƯU CƠ SỞ DỮ LIỆU (SQL Server 2022, biến thể .NET)
#   ./deploy/backup-mssql.sh
#
# Đối tác của deploy/backup.sh (bản PostgreSQL) — dùng cho stack
# docker-compose.dotnet.yml (server-dotnet/ + Microsoft SQL Server 2022).
#
# Cách hoạt động:
#   1) Chạy BACKUP DATABASE bên TRONG container `db` (ghi ra một đường dẫn
#      trong container, ví dụ /var/opt/mssql/backup/ecabinet-<STAMP>.bak).
#   2) `docker compose cp` file .bak đó RA HOST (deploy/backups-mssql/).
#   3) Xóa file tạm trong container, xoay vòng (rotate) giữ KEEP bản mới nhất
#      trên host.
#
# Vì sao không dùng `docker compose exec ... > file` như bản Postgres:
# BACKUP DATABASE của SQL Server ghi file nhị phân (.bak) qua T-SQL,
# không phải stream qua stdout như pg_dump — phải ghi trong container rồi
# copy ra, đây là cách làm chuẩn của SQL Server trong Docker.
#
# Biến môi trường:
#   DB_PASSWORD  — mật khẩu SA (BẮT BUỘC, đọc từ env hoặc deploy/.env.mssql
#                  nếu tồn tại; xem deploy/.env.example cho mẫu biến khác)
#   KEEP         — số bản sao lưu giữ lại trên host (mặc định 14, tức ~2 tuần
#                  nếu chạy 1 bản/ngày — HSMT yêu cầu phục hồi ≤24h/100% dữ liệu,
#                  giữ đủ lâu để có nhiều điểm khôi phục dự phòng)
#   COMPOSE_FILE — đường dẫn docker-compose (mặc định docker-compose.dotnet.yml
#                  ở thư mục gốc dự án, vì file NÀY nằm trong deploy/)
#   DB_NAME      — tên database (mặc định ecabinet, khớp seed & Store/*.cs)
#
# Dùng với cron để sao lưu tự động, ví dụ 2h sáng hằng ngày:
#   0 2 * * * DB_PASSWORD='...' /đường/dẫn/deploy/backup-mssql.sh >> /đường/dẫn/deploy/backups-mssql/backup.log 2>&1
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"          # -> thư mục deploy/
ROOT="$(cd .. && pwd)"        # -> thư mục gốc dự án (chứa docker-compose.dotnet.yml)

# Nạp deploy/.env.mssql nếu tồn tại (không bắt buộc — DB_PASSWORD có thể đặt
# trực tiếp qua biến môi trường khi gọi lệnh, giống thói quen của backup.sh)
if [ -f ./.env.mssql ]; then set -a; . ./.env.mssql; set +a; fi

: "${DB_PASSWORD:?Chưa đặt DB_PASSWORD (mật khẩu SA của SQL Server). Ví dụ: DB_PASSWORD='Ecabinet#2026' ./backup-mssql.sh}"
DB_NAME="${DB_NAME:-ecabinet}"
KEEP="${KEEP:-14}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT/docker-compose.dotnet.yml}"
COMPOSE="docker compose -f $COMPOSE_FILE"

DIR="./backups-mssql"; mkdir -p "$DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
BAK_NAME="ecabinet-${STAMP}.bak"
CONTAINER_PATH="/var/opt/mssql/backup/${BAK_NAME}"   # đường dẫn TRONG container
HOST_PATH="${DIR}/${BAK_NAME}"                        # đường dẫn TRÊN host sau khi copy

echo "• Đang sao lưu CSDL '${DB_NAME}' (SQL Server) -> ${HOST_PATH}"

# Đảm bảo thư mục backup tồn tại trong container (image mssql mặc định không có).
$COMPOSE exec -T db mkdir -p /var/opt/mssql/backup

# BACKUP DATABASE bằng sqlcmd. -C: tin cậy chứng thư máy chủ tự ký (bắt buộc với
# sqlcmd18 trong image mssql/server:2022-latest, giống healthcheck trong compose).
# WITH FORMAT, INIT: luôn ghi mới (không append lên set backup cũ); STATS=10: in
# tiến độ mỗi 10% (hữu ích khi CSDL lớn, dễ nhận biết tiến trình không bị treo).
$COMPOSE exec -T db /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "${DB_PASSWORD}" -Q \
  "BACKUP DATABASE [${DB_NAME}] TO DISK = N'${CONTAINER_PATH}' WITH FORMAT, INIT, STATS = 10;"

# Copy file .bak từ container ra host.
CONTAINER_ID="$($COMPOSE ps -q db)"
if [ -z "$CONTAINER_ID" ]; then
  echo "✗ Không tìm thấy container 'db' đang chạy. Kiểm tra: $COMPOSE ps"
  exit 1
fi
docker cp "${CONTAINER_ID}:${CONTAINER_PATH}" "${HOST_PATH}"

# Xóa file tạm trong container để không tích tụ dung lượng ổ đĩa container theo thời gian.
$COMPOSE exec -T db rm -f "${CONTAINER_PATH}"

# Kiểm tra file không rỗng trên host.
if [ ! -s "$HOST_PATH" ]; then
  echo "✗ Sao lưu THẤT BẠI (file rỗng sau khi copy)."
  rm -f "$HOST_PATH"
  exit 1
fi

# Nén lại bằng gzip cho gọn (tùy chọn nhưng khuyến nghị — file .bak SQL Server
# thường nén tốt vì có nhiều khoảng trắng/log dự phòng).
gzip -f "$HOST_PATH"
HOST_PATH="${HOST_PATH}.gz"

# Xoay vòng: giữ KEEP bản mới nhất, xóa các bản cũ hơn.
ls -1t "$DIR"/ecabinet-*.bak.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "✔ Xong. Dung lượng: $(du -h "$HOST_PATH" | cut -f1). Đang giữ $(ls -1 "$DIR"/ecabinet-*.bak.gz 2>/dev/null | wc -l) bản (KEEP=${KEEP})."
