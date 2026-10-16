#!/usr/bin/env bash
# Проверка общей VM 212.233.93.50 (kochfit.ru + preview.medvediva.ru) перед выкладкой.
# Только чтение: ничего не меняет на сервере.
set -euo pipefail
DOMAIN=preview.medvediva.ru
BASE=/var/www/medvediva
CFG=/etc/nginx/sites-available/medvediva
CERT=/etc/letsencrypt/live/$DOMAIN/fullchain.pem

command -v nginx >/dev/null || { echo 'STOP: nginx is not installed'; exit 3; }
sudo -n nginx -t

# В sites-enabled допустимы только kochfit и medvediva — по точному имени.
while IFS= read -r file; do
  case "$(basename "$file")" in
    kochfit|medvediva) ;;
    *) echo "STOP: unknown enabled site $(basename "$file"). Configuration must be reviewed before deployment."; exit 3 ;;
  esac
done < <(find /etc/nginx/sites-enabled -mindepth 1 -maxdepth 1 -print)

sudo -n test -f "$CFG" || { echo "STOP: $CFG is missing (vhost создаётся вручную, см. docs/DEPLOYMENT.md)"; exit 3; }
sudo -n test -L /etc/nginx/sites-enabled/medvediva || { echo 'STOP: medvediva site is not enabled'; exit 3; }
sudo -n grep -Eq "^\s*server_name\s+$DOMAIN\s*;" "$CFG" || { echo "STOP: $CFG has no server_name $DOMAIN"; exit 3; }
sudo -n grep -Eq "^\s*root\s+$BASE/current\s*;" "$CFG" || { echo "STOP: $CFG root is not $BASE/current"; exit 3; }
if sudo -n grep -Eq 'default_server|server_name\s+_\s*;' "$CFG"; then
  echo 'STOP: medvediva config claims default_server — it belongs to kochfit'; exit 3
fi

# Домен preview не должен встречаться в других конфигах.
while IFS= read -r file; do
  [[ "$(readlink -f "$file")" == "$CFG" ]] && continue
  if sudo -n grep -Eq "server_name[^;]*\b$DOMAIN\b" "$file"; then
    echo "STOP: $DOMAIN is also declared in $file"; exit 3
  fi
done < <(find /etc/nginx/sites-enabled /etc/nginx/conf.d -mindepth 1 -maxdepth 1 \( -type f -o -type l \) -print)

# conf.d на этой VM пустой; любой .conf действует и на kochfit.
if [[ -n "$(find /etc/nginx/conf.d -maxdepth 1 -name '*.conf' -print)" ]]; then
  echo 'STOP: conf.d contains configurations that need review (они общие с kochfit)'; exit 3
fi

sudo -n test -f "$CERT" || { echo "STOP: certificate $CERT is missing"; exit 3; }
sudo -n test -d "$BASE/releases" || { echo "STOP: $BASE/releases is missing"; exit 3; }

count=$(find "$BASE/releases" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
if (( count > 3 )); then
  echo "WARN: $count releases in $BASE/releases (~320 МБ каждый). Оставьте 2–3 последних, удалять вручную."
fi
echo "DISK: $(df -h "$BASE" | awk 'NR==2 {print $4 " free"}')"
echo 'Server check passed (shared profile): only kochfit and medvediva are enabled.'
