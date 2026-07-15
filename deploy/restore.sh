#!/usr/bin/env bash
# ============================================================
# eCabinet — KHÔI PHỤC CƠ SỞ DỮ LIỆU từ bản sao lưu
#   ./deploy/restore.sh deploy/backups/ecabinet-YYYYmmdd-HHMMSS.sql.gz
# CẢNH BÁO: ghi đè toàn bộ dữ liệu hiện tại. Hãy sao lưu trước khi khôi phục.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env; set +a
COMPOSE="docker compose -f docker-compose.pilot.yml --env-file .env"

FILE="${1:-}"
[ -z "$FILE" ] && { echo "Cách dùng: ./restore.sh <đường-dẫn-file.sql.gz>"; exit 1; }
[ -f "$FILE" ] || { echo "✗ Không thấy file: $FILE"; exit 1; }

read -r -p "Ghi đè toàn bộ DB hiện tại bằng '$FILE'? (gõ 'yes' để tiếp tục): " ans
[ "$ans" = "yes" ] || { echo "Đã hủy."; exit 0; }

echo "• Xóa & tạo lại schema…"
$COMPOSE exec -T db psql -U ecabinet -d ecabinet -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
echo "• Nạp dữ liệu…"
gunzip -c "$FILE" | $COMPOSE exec -T db psql -U ecabinet -d ecabinet
echo "• Khởi động lại API…"
$COMPOSE restart api
echo "✔ Khôi phục xong từ $FILE"
