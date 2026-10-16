#!/usr/bin/env bash
set -euo pipefail
# Только для отдельной VM 146.185.240.110. На общей VM с kochfit (212.233.93.50) скрипт снёс бы чужой сайт.
if [[ -e /etc/nginx/sites-available/kochfit || -e /etc/nginx/sites-enabled/kochfit ]]; then
  echo 'STOP: shared VM with kochfit detected — use the shared profile (HOST=212.233.93.50), not this script.' >&2
  exit 3
fi
REL="$1"
[[ "$REL" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || exit 2
BASE=/var/www/medvediva-preview
CFG=/etc/nginx/sites-available/medvediva-preview
sudo -n mkdir -p "$BASE/releases/$REL" "$BASE/backups/$REL"
OLD=$(readlink "$BASE/current" || true)
HAD_CFG=0
DISABLED_DEFAULT=0
if sudo -n test -f "$CFG"; then
  HAD_CFG=1
  sudo -n cp -a "$CFG" "$BASE/backups/$REL/nginx.conf"
fi
rollback() {
  if [[ -n "$OLD" ]]; then sudo -n ln -sfn "$OLD" "$BASE/current"; else sudo -n rm -f "$BASE/current"; fi
  if [[ "$HAD_CFG" == 1 ]]; then sudo -n cp -a "$BASE/backups/$REL/nginx.conf" "$CFG";
  else sudo -n rm -f /etc/nginx/sites-enabled/medvediva-preview "$CFG"; fi
  if [[ "$DISABLED_DEFAULT" == 1 ]]; then
    sudo -n ln -sfn /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
  fi
  sudo -n nginx -t && sudo -n systemctl reload nginx
  echo 'Activation failed; previous configuration restored.' >&2
}
trap rollback ERR
TARBALL="/tmp/medvediva-preview-$REL.tar.gz"
if sudo -n test -f "$BASE/releases/$REL/index.html"; then
  echo "Release $REL already populated on disk — skipping tarball extract."
elif sudo -n test -f "$TARBALL"; then
  sudo -n tar -xzf "$TARBALL" -C "$BASE/releases/$REL" --no-same-owner
  rm -f "$TARBALL"
else
  echo "No tarball at $TARBALL and release dir has no index.html — upload dist/ or tarball first." >&2
  exit 1
fi
sudo -n chmod -R a+rX "$BASE/releases/$REL"
sudo -n ln -sfn "$BASE/releases/$REL" "$BASE/current"
SSL_DIR=/etc/nginx/ssl
SSL_CRT="$SSL_DIR/medvediva-preview.crt"
SSL_KEY="$SSL_DIR/medvediva-preview.key"
sudo -n mkdir -p "$SSL_DIR"
if ! sudo -n test -f "$SSL_CRT"; then
  sudo -n openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -keyout "$SSL_KEY" -out "$SSL_CRT" \
    -subj "/CN=146.185.240.110" -addext "subjectAltName=IP:146.185.240.110" >/dev/null 2>&1
fi
sudo -n tee "$CFG" >/dev/null <<'NGINX'
# Managed Medvediva static preview
server {
  listen 80 default_server;
  listen [::]:80 default_server;
  server_name _;
  root /var/www/medvediva-preview/current;
  index index.html;

  gzip on;
  gzip_comp_level 5;
  gzip_min_length 256;
  gzip_vary on;
  gzip_proxied any;
  gzip_types text/plain text/css application/javascript application/json image/svg+xml application/xml text/xml;

  sendfile on;
  tcp_nopush on;
  tcp_nodelay on;
  open_file_cache max=1000 inactive=20s;
  open_file_cache_valid 30s;
  open_file_cache_min_uses 2;

  location /assets/ {
    expires 7d;
    add_header Cache-Control "public";
    try_files $uri =404;
  }

  location ~* \.(?:png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|eot)$ {
    expires 7d;
    add_header Cache-Control "public";
    try_files $uri =404;
  }

  location / {
    try_files $uri $uri/index.html =404;
    add_header Cache-Control "no-cache";
  }
}
NGINX
sudo -n sed -i "s#root /var/www/medvediva-preview/current;#root $BASE/releases/$REL;#" "$CFG"
sudo -n ln -sfn "$CFG" /etc/nginx/sites-enabled/medvediva-preview
# This VM only had the stock welcome site. Drop every other enabled vhost so it cannot stay default_server.
sudo -n find /etc/nginx/sites-enabled -mindepth 1 -maxdepth 1 ! -name medvediva-preview -exec rm -f {} +
trap - ERR
sudo -n nginx -t
sudo -n systemctl restart nginx
echo "DISK: $(sudo -n head -c 80 "$BASE/releases/$REL/index.html" || true)"
echo "CURL: $(curl -sS --compressed http://127.0.0.1/ | head -c 80 || true)"
echo "HEADERS:"
curl -sSI -H 'Accept-Encoding: gzip' http://127.0.0.1/ || true
rm -f "$TARBALL"
printf 'Activated %s; previous release: %s\n' "$REL" "${OLD:-none}"
echo 'Existing releases and configuration backups were preserved.'
