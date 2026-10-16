#!/usr/bin/env bash
# Проверка доступа и готовности сервера без полной выкатки. VPN — только для legacy 146.185.240.110.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=deploy/common.sh
source deploy/common.sh
SSH=(ssh -i "$KEY" -p "$PORT" -o IdentitiesOnly=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o BatchMode=yes)

echo "=== Medvediva preview deploy — диагностика ==="
echo "Сервер: $SERVER (HOST=$HOST, профиль $PROFILE)  ключ: $KEY  порт: $PORT"
echo

if [[ "$(stat -f '%Lp' "$KEY" 2>/dev/null || stat -c '%a' "$KEY" 2>/dev/null)" != "600" ]]; then
  echo "WARN: права ключа не 600. Исправление: chmod 600 \"$KEY\""
fi

echo "1/4 SSH…"
if ! "${SSH[@]}" "$SERVER" 'echo "   SSH OK: $(whoami)@$(hostname -f 2>/dev/null || hostname)"'; then
  echo
  echo "FAIL: нет SSH. Типичные причины:"
  [[ "$PROFILE" == legacy ]] && echo "  • VPN не включён (нужен для 146.185.240.110)"
  echo "  • не тот сервер (Popovich — другой IP: 146.185.241.179)"
  echo "  • ключ не от этой VM (другой сервер — другой .pem)"
  echo "  • порт не 22: PORT=… bash deploy/diagnose-preview.sh"
  exit 255
fi

echo "2/4 nginx и sudo без пароля…"
if ! "${SSH[@]}" "$SERVER" 'command -v nginx >/dev/null && sudo -n nginx -t >/dev/null 2>&1 && echo "   nginx + sudo -n OK"'; then
  echo "FAIL: nginx не installed или sudo просит пароль."
  [[ "$PROFILE" == legacy ]] && echo "  Однократно: ssh … 'bash -s' < deploy/server-setup.sh"
  [[ "$PROFILE" == shared ]] && echo "  Общая VM с kochfit: server-setup.sh не запускать, разбирать с админом."
  exit 3
fi

echo "3/4 server-check (как перед deploy)…"
if ! "${SSH[@]}" "$SERVER" 'bash -s' < "$CHECK_SCRIPT"; then
  echo
  echo "FAIL: server-check. Скопируйте строки STOP выше — по ним правим конфиг nginx на сервере."
  exit 3
fi

echo "4/4 локальная сборка (без upload)…"
npm run build:site >/dev/null
node deploy/check-build.mjs

echo
echo "OK: можно выкатывать: bash deploy/deploy-preview.sh"
echo "Быстрая докачка без server-check: bash deploy/upload-and-activate.sh"
echo "После выкатки:"
print_preview_urls
