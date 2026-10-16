#!/usr/bin/env bash
# Активация релиза на общей VM 212.233.93.50 (kochfit.ru + preview.medvediva.ru).
# Меняет только симлинк /var/www/medvediva/current. Конфиги nginx не пишет и nginx не перезагружает:
# root смотрит на current, поэтому новый релиз начинает отдаваться сразу.
# Откат — вернуть прежний current; файлы kochfit и sites-enabled не трогаются.
set -euo pipefail
REL="$1"
[[ "$REL" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || exit 2
DOMAIN=preview.medvediva.ru
BASE=/var/www/medvediva
CFG=/etc/nginx/sites-available/medvediva
KOCHFIT_CFG=/etc/nginx/sites-available/kochfit
TARBALL="/tmp/medvediva-preview-$REL.tar.gz"

# Состояние nginx до выкладки: в конце сверяем, что ничего не изменилось.
nginx_state() {
  sudo -n sha256sum "$CFG" "$KOCHFIT_CFG" 2>/dev/null
  ls -l /etc/nginx/sites-enabled
}
NGINX_BEFORE=$(nginx_state)

status_of() {
  curl -sS -o /dev/null -w '%{http_code}' --max-time 15 --resolve "$1:443:127.0.0.1" "https://$1$2" || echo 000
}

sudo -n nginx -t
KOCHFIT_BEFORE=$(status_of kochfit.ru /)

OLD=$(readlink "$BASE/current" || true)
rollback() {
  if [[ -n "$OLD" ]]; then sudo -n ln -sfn "$OLD" "$BASE/current"; fi
  echo "Activation failed; current restored to ${OLD:-<none>}." >&2
}
trap rollback ERR

sudo -n mkdir -p "$BASE/releases/$REL"
if sudo -n test -f "$BASE/releases/$REL/index.html"; then
  echo "Release $REL already populated on disk — skipping tarball extract."
elif sudo -n test -f "$TARBALL"; then
  sudo -n tar -xzf "$TARBALL" -C "$BASE/releases/$REL" --no-same-owner
else
  echo "No tarball at $TARBALL and release dir has no index.html — upload dist/ or tarball first." >&2
  exit 1
fi
sudo -n test -f "$BASE/releases/$REL/robots.txt" || { echo 'STOP: robots.txt missing in release' >&2; exit 1; }
sudo -n chmod -R a+rX "$BASE/releases/$REL"
sudo -n ln -sfn "releases/$REL" "$BASE/current"

# Проверка по имени: на 127.0.0.1 без SNI ответит default_server kochfit.
code=$(status_of "$DOMAIN" /)
[[ "$code" == 200 ]] || { echo "STOP: https://$DOMAIN/ answered $code" >&2; false; }
code=$(status_of "$DOMAIN" /qa-missing-page-$REL)
[[ "$code" == 404 ]] || { echo "STOP: missing page answered $code, expected 404" >&2; false; }
curl -sSI --max-time 15 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" | grep -qi '^x-robots-tag: *noindex' \
  || { echo 'STOP: X-Robots-Tag noindex header is missing' >&2; false; }
trap - ERR

KOCHFIT_AFTER=$(status_of kochfit.ru /)
NGINX_AFTER=$(nginx_state)
rm -f "$TARBALL"

echo "INDEX (начало загруженной главной): $(sudo -n head -c 80 "$BASE/releases/$REL/index.html" || true)"
echo "CHECK: https://$DOMAIN/ 200, 404 page 404, noindex header present"
echo "KOCHFIT: https://kochfit.ru/ before $KOCHFIT_BEFORE, after $KOCHFIT_AFTER"
if [[ "$NGINX_BEFORE" != "$NGINX_AFTER" ]]; then
  echo 'WARN: nginx configs or sites-enabled changed during deploy — check by hand (this script does not write them).'
fi
if [[ "$KOCHFIT_AFTER" != "$KOCHFIT_BEFORE" ]]; then
  echo 'WARN: kochfit.ru status changed — check it now (the release switch does not touch kochfit).'
fi
printf 'Activated %s; previous release: %s\n' "$REL" "${OLD:-none}"
echo "Rollback: sudo ln -sfn ${OLD:-releases/<REL>} $BASE/current"
echo 'Old releases are kept; remove by hand, keeping the last 2–3.'
