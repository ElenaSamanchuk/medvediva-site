#!/usr/bin/env bash
# Общие переменные и rsync/ssh для preview Medvediva.
# Профили по HOST:
#   212.233.93.50   — shared: общая VM с kochfit.ru, https://preview.medvediva.ru (по умолчанию с 16.10.2026)
#   146.185.240.110 — legacy: отдельная VM только под preview, вход через VPN
# Popovichfit — другой IP (146.185.241.179), тот же .pem возможен, хост — нет.
set -euo pipefail

# zsh сам экспортирует HOST=<имя Mac>, поэтому учитываем HOST, только если это IP.
if [[ -n "${DEPLOY_HOST:-}" ]]; then
  HOST="$DEPLOY_HOST"
elif [[ ! "${HOST:-}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  HOST=212.233.93.50
fi
case "$HOST" in
  212.233.93.50)
    PROFILE=shared
    DEPLOY_BASE=/var/www/medvediva
    PREVIEW_DOMAIN=preview.medvediva.ru
    CHECK_SCRIPT=deploy/server-check-shared.sh
    ACTIVATE_SCRIPT=deploy/server-activate-shared.sh
    ;;
  146.185.240.110)
    PROFILE=legacy
    DEPLOY_BASE=/var/www/medvediva-preview
    PREVIEW_DOMAIN=
    CHECK_SCRIPT=deploy/server-check.sh
    ACTIVATE_SCRIPT=deploy/server-activate.sh
    ;;
  *)
    echo "Unexpected HOST=$HOST (Medvediva: 212.233.93.50 shared или 146.185.240.110 legacy; Popovich 146.185.241.179 — не сюда)" >&2
    exit 2
    ;;
esac
SERVER="${SERVER:-ubuntu@${HOST}}"
KEY="${KEY:-$HOME/Downloads/ubuntu-STD3-8-16-200GB-M9I9y4Dw.pem}"
PORT="${PORT:-22}"
RSYNC_RETRIES="${RSYNC_RETRIES:-3}"
RSYNC_BWLIMIT="${RSYNC_BWLIMIT:-3000}"

export KEY HOST SERVER PORT PROFILE

[[ "$PORT" =~ ^[0-9]+$ ]] || { echo 'Invalid PORT' >&2; exit 2; }
[[ "$SERVER" == "ubuntu@${HOST}" ]] || { echo "SERVER must be ubuntu@${HOST} (got: $SERVER)" >&2; exit 2; }
[[ -f "$KEY" ]] || { echo "SSH key not found: $KEY" >&2; exit 2; }

SSH=(ssh -i "$KEY" -p "$PORT" -o IdentitiesOnly=yes -o ConnectTimeout=60 -o ServerAliveInterval=15)
RSYNC_SSH="ssh -i $KEY -p $PORT -o IdentitiesOnly=yes -o ConnectTimeout=60 -o ServerAliveInterval=15"

deploy_ssh_hint() {
  echo >&2
  echo "Подсказка по SSH (Medvediva, профиль $PROFILE — $HOST; Popovich 146.185.241.179 — другой сервер):" >&2
  if [[ "$PROFILE" == legacy ]]; then
    echo '  • Включите VPN, без него — timeout на banner exchange.' >&2
    echo '  • Первый раз на сервере: ssh … ubuntu@146.185.240.110 "bash -s" < deploy/server-setup.sh' >&2
  else
    echo '  • VPN не нужен. Сервер общий с kochfit.ru: server-setup.sh и server-tune.sh здесь не запускать.' >&2
  fi
  echo '  • Ключ: chmod 600 на .pem; при сомнениях: bash deploy/diagnose-preview.sh' >&2
}

# Куда смотреть после выкладки
print_preview_urls() {
  if [[ "$PROFILE" == shared ]]; then
    echo "Preview: https://${PREVIEW_DOMAIN}/"
  else
    echo "Preview: http://${HOST}/"
    echo "Preview: https://${HOST}/ (самоподписанный сертификат — подтвердите исключение в браузере)"
  fi
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
