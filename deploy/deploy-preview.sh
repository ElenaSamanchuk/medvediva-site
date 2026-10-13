#!/usr/bin/env bash
# Static preview only. Never uploads source exports, credentials or node_modules.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=deploy/common.sh
source deploy/common.sh

REL="$(date -u +%Y%m%dT%H%M%SZ)"
export REL
SKIP_BUILD="${SKIP_BUILD:-0}"

echo 'Checking server before upload…'
if ! "${SSH[@]}" "$SERVER" 'bash -s' < deploy/server-check.sh; then
  code=$?
  if [[ "$code" -eq 255 ]]; then deploy_ssh_hint; fi
  echo >&2 'server-check не прошёл — пришлите текст STOP (без ключа и секретов).'
  exit "$code"
fi

if [[ "$SKIP_BUILD" == 1 ]]; then
  echo 'SKIP_BUILD=1 — используем существующий dist/'
  [[ -d dist ]] && [[ -f dist/index.html ]] || { echo 'dist/index.html missing' >&2; exit 2; }
else
  echo 'Building static preview…'
  npm run build:site
fi
node deploy/check-build.mjs

echo "Uploading isolated release ${REL} (rsync dist/)…"
prepare_release_dir "$REL"
if ! rsync_with_retry --delete dist/ "${SERVER}:${DEPLOY_BASE}/releases/${REL}/"; then
  deploy_ssh_hint
  exit 255
fi

if ! "${SSH[@]}" "$SERVER" "bash -s -- '${REL}'" < deploy/server-activate.sh; then
  echo >&2 'Активация на сервере не удалась — см. вывод выше; предыдущий релиз должен восстановиться автоматически.'
  exit 1
fi
echo "Preview: http://${HOST}/"
echo "Preview: https://${HOST}/ (самоподписанный сертификат — подтвердите исключение в браузере)"
echo 'Формы остаются dry-run; noindex сохранён.'
