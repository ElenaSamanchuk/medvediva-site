#!/usr/bin/env bash
# Однократная подготовка Ubuntu на 146.185.240.110 (запуск с Mac через VPN):
#   ssh -i "$KEY" ubuntu@146.185.240.110 'bash -s' < deploy/server-setup.sh
# Нужен passwordless sudo (стандартный образ Ubuntu в облаке). DNS и чужие сайты не трогает.
set -euo pipefail
# Только для отдельной VM 146.185.240.110. На общей VM с kochfit (212.233.93.50) скрипт снёс бы чужой сайт.
if [[ -e /etc/nginx/sites-available/kochfit || -e /etc/nginx/sites-enabled/kochfit ]]; then
  echo 'STOP: shared VM with kochfit detected — use the shared profile (HOST=212.233.93.50), not this script.' >&2
  exit 3
fi
export DEBIAN_FRONTEND=noninteractive
if ! command -v nginx >/dev/null; then
  sudo apt-get update -qq
  sudo apt-get install -y nginx curl
fi
sudo systemctl enable nginx
sudo systemctl start nginx
sudo nginx -t
# Оставляем только штатный default + welcome (deploy/server-check.sh это проверяет).
if [[ ! -f /var/www/html/index.nginx-debian.html ]]; then
  echo 'WARN: нет index.nginx-debian.html — проверьте, что default site не перезаписан вручную.'
fi
echo 'OK: nginx установлен и запущен. Дальше с Mac: bash deploy/deploy-preview.sh'
