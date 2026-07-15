#!/usr/bin/env bash
# ============================================================
# eCabinet — SAO LƯU CƠ SỞ DỮ LIỆU (PostgreSQL)
#   ./deploy/backup.sh
# Tạo bản dump nén, đặt trong deploy/backups/, tự xoay vòng giữ BACKUP_KEEP bản.
# Dùng với cron để sao lưu tự động (xem cuối pilot.sh).
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env; set +a

COMPOSE="docker compose -f docker-compose.pilot.yml --env-file .env"
DIR="./backups"; mkdir -p "$DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$DIR/ecabinet-${STAMP}.sql.gz"

echo "• Đang sao lưu -> $OUT"
$COMPOSE exec -T db pg_dump -U ecabinet ecabinet | gzip > "$OUT"

# kiểm tra file không rỗng
if [ ! -s "$OUT" ]; then echo "✗ Sao lưu THẤT BẠI (file rỗng)."; rm -f "$OUT"; exit 1; fi

# xoay vòng: giữ BACKUP_KEEP bản mới nhất
KEEP="${BACKUP_KEEP:-30}"
ls -1t "$DIR"/ecabinet-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "✔ Xong. Dung lượng: $(du -h "$OUT" | cut -f1). Đang giữ $(ls -1 "$DIR"/ecabinet-*.sql.gz | wc -l) bản."
