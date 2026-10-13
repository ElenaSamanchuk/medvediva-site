#!/usr/bin/env bash
# Общие переменные и rsync/ssh для preview Medvediva (146.185.240.110).
# Popovichfit — другой IP (146.185.241.179), тот же .pem возможен, хост — нет.
set -euo pipefail

DEPLOY_BASE=/var/www/medvediva-preview
HOST="${HOST:-146.185.240.110}"
SERVER="${SERVER:-ubuntu@${HOST}}"
KEY="${KEY:-$HOME/Downloads/ubuntu-STD3-8-16-200GB-M9I9y4Dw.pem}"
PORT="${PORT:-22}"
RSYNC_RETRIES="${RSYNC_RETRIES:-3}"
RSYNC_BWLIMIT="${RSYNC_BWLIMIT:-3000}"

export KEY HOST SERVER PORT

[[ "$PORT" =~ ^[0-9]+$ ]] || { echo 'Invalid PORT' >&2; exit 2; }
[[ "$HOST" == "146.185.240.110" ]] || { echo "Unexpected HOST (Medvediva preview: 146.185.240.110, not Popovich 146.185.241.179)" >&2; exit 2; }
[[ "$SERVER" == "ubuntu@${HOST}" ]] || { echo "SERVER must be ubuntu@${HOST} (got: $SERVER)" >&2; exit 2; }
[[ -f "$KEY" ]] || { echo "SSH key not found: $KEY" >&2; exit 2; }

SSH=(ssh -i "$KEY" -p "$PORT" -o ConnectTimeout=60 -o ServerAliveInterval=15)
RSYNC_SSH="ssh -i $KEY -p $PORT -o ConnectTimeout=60 -o ServerAliveInterval=15"

deploy_ssh_hint() {
  echo >&2
  echo 'Подсказка по SSH (Medvediva — 146.185.240.110, не Popovich 146.185.241.179):' >&2
  echo '  • Включите VPN, без него — timeout на banner exchange.' >&2
  echo '  • Ключ: chmod 600 на .pem; при сомнениях: bash deploy/diagnose-preview.sh' >&2
  echo '  • Первый раз на сервере: ssh … ubuntu@146.185.240.110 "bash -s" < deploy/server-setup.sh' >&2
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
