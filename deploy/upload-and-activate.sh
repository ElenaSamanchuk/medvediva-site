#!/usr/bin/env bash
# Одношаговая загрузка и активация (без server-check). Нужен KEY и VPN. Сервер — 212.233.93.50, см. deploy/common.sh.
#
# Rsync dist/ (после сборки или SKIP_BUILD=1):
#   export KEY=~/Downloads/ubuntu-STD3-8-16-200GB-M9I9y4Dw.pem HOST=212.233.93.50
#   export REL=20261009T173948Z SKIP_BUILD=1
#   bash deploy/upload-and-activate.sh
#
# Докачка уже собранного tarball (обрыв scp):
#   export KEY=… HOST=212.233.93.50 REL=20261009T173948Z
#   export TAR=/tmp/medvediva-preview-20261009T173948Z.tar.gz
#   bash deploy/upload-and-activate.sh
#
# Только активация (файлы уже на сервере):
#   SKIP_UPLOAD=1 REL=… bash deploy/upload-and-activate.sh
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=deploy/common.sh
source deploy/common.sh

REL="${REL:-$(date -u +%Y%m%dT%H%M%SZ)}"
[[ "$REL" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || { echo 'REL must match YYYYMMDDTHHMMSSZ' >&2; exit 2; }
export REL

TAR="${TAR:-/tmp/medvediva-preview-${REL}.tar.gz}"
SKIP_UPLOAD="${SKIP_UPLOAD:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"

if [[ "$SKIP_UPLOAD" != 1 ]]; then
  if [[ -n "${UPLOAD_MODE:-}" ]]; then
    mode="$UPLOAD_MODE"
  elif [[ -f "$TAR" ]]; then
    mode=tar
  elif [[ -d dist ]] && [[ -f dist/index.html ]]; then
    mode=dist
  else
    echo "Нет dist/index.html и нет TAR=$TAR — соберите или задайте TAR=" >&2
    exit 2
  fi

  case "$mode" in
    dist)
      if [[ "$SKIP_BUILD" != 1 ]]; then
        echo '→ сборка'
        npm run build:site
        node deploy/check-build.mjs
      else
        echo '→ SKIP_BUILD=1, используем существующий dist/'
        [[ -f dist/index.html ]] || { echo 'dist/index.html missing' >&2; exit 2; }
        node deploy/check-build.mjs
      fi
      echo "→ rsync dist/ → releases/${REL}/"
      prepare_release_dir "$REL"
      if ! rsync_with_retry --delete dist/ "${SERVER}:${DEPLOY_BASE}/releases/${REL}/"; then
        deploy_ssh_hint
        exit 255
      fi
      ;;
    tar)
      echo "→ rsync tarball (--partial) → /tmp/medvediva-preview-${REL}.tar.gz"
      [[ -f "$TAR" ]] || { echo "TAR not found: $TAR" >&2; exit 2; }
      if ! rsync_with_retry --partial "$TAR" "${SERVER}:/tmp/medvediva-preview-${REL}.tar.gz"; then
        deploy_ssh_hint
        exit 255
      fi
      ;;
    *)
      echo "Unknown UPLOAD_MODE=$mode" >&2
      exit 2
      ;;
  esac
fi

echo "→ активация релиза ${REL} на сервере"
if ! "${SSH[@]}" "$SERVER" "bash -s -- '${REL}'" < "$ACTIVATE_SCRIPT"; then
  echo 'Активация не удалась — см. вывод выше; rollback должен восстановить previous current.' >&2
  exit 1
fi

print_preview_urls
