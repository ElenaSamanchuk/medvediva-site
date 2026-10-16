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

# Одно SSH-соединение на весь скрипт (ControlMaster): проверка, mkdir, rsync и активация идут через него.
# Без этого 3–4 новых соединения подряд обрывались «banner exchange timeout», хотя одиночные проходили (16.10.2026).
CM_PATH="/tmp/mdv-%C"  # короткий путь: у сокета предел 104 символа
SSH_OPTS=(-i "$KEY" -p "$PORT" -o IdentitiesOnly=yes -o ConnectTimeout=60 -o ServerAliveInterval=15 -o ControlMaster=auto -o "ControlPath=$CM_PATH" -o ControlPersist=300)
SSH=(ssh "${SSH_OPTS[@]}")
RSYNC_SSH="ssh -i $KEY -p $PORT -o IdentitiesOnly=yes -o ConnectTimeout=60 -o ServerAliveInterval=15 -o ControlMaster=auto -o ControlPath=$CM_PATH -o ControlPersist=300"
ssh_close_master() { ssh "${SSH_OPTS[@]}" -O exit "$SERVER" >/dev/null 2>&1 || true; }
trap ssh_close_master EXIT
# Открыть общее соединение с повторами: новые соединения к VM обрываются через раз (сеть по пути, 16.10.2026),
# а установленное держится. Дальше все ssh/rsync идут через него.
ssh_open_master() {
  local i
  if ssh "${SSH_OPTS[@]}" -O check "$SERVER" >/dev/null 2>&1; then echo "SSH: используем уже открытое соединение"; return 0; fi
  for i in 1 2 3 4 5 6 7 8; do
    if ssh "${SSH_OPTS[@]}" -o ConnectTimeout=25 -MNf "$SERVER" 2>/dev/null && ssh "${SSH_OPTS[@]}" -O check "$SERVER" >/dev/null 2>&1; then
      echo "SSH: соединение открыто (попытка $i)"; return 0
    fi
    echo "SSH: попытка $i не удалась, повтор через 20 с…" >&2; sleep 20
  done
  return 255
}

deploy_ssh_hint() {
  echo >&2
  echo "Подсказка по SSH (Medvediva — $HOST):" >&2
  echo '  • Включите своё VPN-подключение: из обычной сети сервер не открывается.' >&2
  echo '  • Сервер общий с kochfit.ru: настройки nginx и сервера скриптами не меняем.' >&2
  echo '  • Ключ: chmod 600 на .pem; при сомнениях: bash deploy/diagnose-preview.sh' >&2
  echo '  • «banner exchange timeout» / «Connection closed»: сервер временно не пускает адрес после серии оборванных соединений. Не повторяйте сразу — каждая попытка продлевает блок; подождите ~10 минут и запустите один раз.' >&2
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
