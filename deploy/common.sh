#!/usr/bin/env bash
# Общие переменные и rsync/ssh для preview Medvediva.
# Сервер — общая VM 212.233.93.50 с kochfit.ru, сайт https://preview.medvediva.ru, каталог /var/www/medvediva.
# Старая VM 146.185.240.110 выключена (16.10.2026). Popovichfit — 146.185.241.179, тестовая VM — 212.233.93.151: не сюда.
set -euo pipefail

# zsh сам экспортирует HOST=<имя Mac>, поэтому учитываем HOST, только если это IP.
if [[ -n "${DEPLOY_HOST:-}" ]]; then
  HOST="$DEPLOY_HOST"
elif [[ ! "${HOST:-}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  HOST=212.233.93.50
fi
[[ "$HOST" == 212.233.93.50 ]] || { echo "Unexpected HOST=$HOST (Medvediva preview: 212.233.93.50)" >&2; exit 2; }
DEPLOY_BASE=/var/www/medvediva
PREVIEW_DOMAIN=preview.medvediva.ru
CHECK_SCRIPT=deploy/server-check-shared.sh
ACTIVATE_SCRIPT=deploy/server-activate-shared.sh
SERVER="${SERVER:-ubuntu@${HOST}}"
KEY="${KEY:-$HOME/Downloads/ubuntu-STD3-8-16-200GB-M9I9y4Dw.pem}"
PORT="${PORT:-22}"
RSYNC_RETRIES="${RSYNC_RETRIES:-3}"
RSYNC_BWLIMIT="${RSYNC_BWLIMIT:-3000}"

export KEY HOST SERVER PORT

[[ "$PORT" =~ ^[0-9]+$ ]] || { echo 'Invalid PORT' >&2; exit 2; }
[[ "$SERVER" == "ubuntu@${HOST}" ]] || { echo "SERVER must be ubuntu@${HOST} (got: $SERVER)" >&2; exit 2; }
[[ -f "$KEY" ]] || { echo "SSH key not found: $KEY" >&2; exit 2; }

SSH=(ssh -i "$KEY" -p "$PORT" -o IdentitiesOnly=yes -o ConnectTimeout=60 -o ServerAliveInterval=15)
RSYNC_SSH="ssh -i $KEY -p $PORT -o IdentitiesOnly=yes -o ConnectTimeout=60 -o ServerAliveInterval=15"

deploy_ssh_hint() {
  echo >&2
  echo "Подсказка по SSH (Medvediva — $HOST):" >&2
  echo '  • Включите своё VPN-подключение: из обычной сети сервер не открывается.' >&2
  echo '  • Сервер общий с kochfit.ru: настройки nginx и сервера скриптами не меняем.' >&2
  echo '  • Ключ: chmod 600 на .pem; при сомнениях: bash deploy/diagnose-preview.sh' >&2
}

# Куда смотреть после выкладки
print_preview_urls() {
  echo "Preview: https://${PREVIEW_DOMAIN}/"
}

# rsync_with_retry local… remote (аргументы rsync после опций по умолчанию)
rsync_with_retry() {
  local attempt=1
  local delay=5
  while true; do
    if rsync -az --partial --bwlimit="$RSYNC_BWLIMIT" -e "$RSYNC_SSH" "$@"; then
      return 0
    fi
    if (( attempt >= RSYNC_RETRIES )); then
      echo "rsync failed after ${RSYNC_RETRIES} attempts" >&2
      return 1
    fi
    echo "rsync attempt ${attempt} failed, retry in ${delay}s…" >&2
    sleep "$delay"
    attempt=$((attempt + 1))
    delay=$((delay * 2))
  done
}

prepare_release_dir() {
  local rel="$1"
  "${SSH[@]}" "$SERVER" "sudo mkdir -p ${DEPLOY_BASE}/releases/${rel} && sudo chown -R \$USER ${DEPLOY_BASE}/releases/${rel}"
}
