#!/usr/bin/env bash
# ============================================================
# eCabinet — TRIỂN KHAI PILOT MỘT LỆNH
#   ./deploy/pilot.sh
# Tự: sinh secret ngẫu nhiên (lần đầu) -> chọn Caddyfile theo TLS_MODE
#     -> build & khởi động toàn bộ stack -> chờ khỏe -> in thông tin.
# Idempotent: chạy lại để cập nhật (build lại image, giữ dữ liệu & secret).
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"   # -> thư mục deploy/

COMPOSE="docker compose -f docker-compose.pilot.yml --env-file .env"

rand() { openssl rand -hex "$1" 2>/dev/null || head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }

# 1) Tạo .env lần đầu + sinh secret
if [ ! -f .env ]; then
  cp .env.example .env
  JWT="$(rand 32)"; DBP="$(rand 16)"
  # thay placeholder (tương thích cả GNU và BSD sed)
  sed -i.bak "s|__CHANGE_ME_JWT__|${JWT}|; s|__CHANGE_ME_DB__|${DBP}|" .env && rm -f .env.bak
  echo "✔ Đã tạo deploy/.env với JWT_SECRET & DB_PASSWORD ngẫu nhiên."
  echo "  → Hãy MỞ deploy/.env, đặt DOMAIN (và TLS_MODE=internal nếu chạy mạng nội bộ), rồi chạy lại lệnh này."
  exit 0
fi

# 2) Nạp cấu hình
set -a; . ./.env; set +a
: "${DOMAIN:?Chưa đặt DOMAIN trong deploy/.env}"

# 3) Chọn Caddyfile theo TLS_MODE
if [ "${TLS_MODE:-letsencrypt}" = "internal" ]; then
  export CADDYFILE=./Caddyfile.internal
  echo "• TLS: nội bộ (tự ký) cho ${DOMAIN}"
else
  export CADDYFILE=./Caddyfile
  case "$DOMAIN" in
    *example.gov.vn|localhost|"") echo "✗ DOMAIN chưa hợp lệ cho Let's Encrypt ('$DOMAIN'). Đặt tên miền thật hoặc TLS_MODE=internal."; exit 1;;
  esac
  echo "• TLS: Let's Encrypt cho ${DOMAIN} (cần mở cổng 80/443 & DNS trỏ đúng)"
fi

# 4) Build & khởi động
echo "• Đang build và khởi động (lần đầu vài phút)…"
$COMPOSE up -d --build

# 5) Chờ API khỏe
echo -n "• Chờ API sẵn sàng"
for i in $(seq 1 60); do
  if $COMPOSE exec -T api wget -qO- http://localhost:3000/health >/dev/null 2>&1; then ok=1; break; fi
  echo -n "."; sleep 2
done
echo
if [ "${ok:-0}" != "1" ]; then
  echo "✗ API chưa khỏe sau 120s. Xem log:  $COMPOSE logs api --tail=50"; exit 1
fi

cat <<EOF

============================================================
✅ eCabinet PILOT đã chạy.
   Truy cập:   https://${DOMAIN}
   Tài khoản mẫu: chutich / 123456  (ĐỔI NGAY sau khi đăng nhập; hoặc dùng quantri để tạo tài khoản thật)
   Thư ký:        thuky / 123456   ·  Quản trị: quantri / 123456

Lệnh hữu ích:
   Xem log:        $COMPOSE logs -f
   Dừng:           $COMPOSE down
   Sao lưu ngay:   ./backup.sh
   Cài sao lưu tự động (2h sáng hằng ngày):
      (crontab -l 2>/dev/null; echo "0 2 * * * $(pwd)/backup.sh >> $(pwd)/backups/backup.log 2>&1") | crontab -
============================================================
EOF
