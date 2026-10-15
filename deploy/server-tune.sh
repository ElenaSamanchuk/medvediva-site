#!/usr/bin/env bash
# Отдача preview на этой VM: BBR (если ядро умеет) и http-директивы nginx.
# Не ставит пакеты, не удаляет сайт, не меняет релиз и не включает 443.
# Запуск с Mac (VPN), без комментариев в команде:
#   ssh -i "$KEY" -o ConnectTimeout=60 -o ServerAliveInterval=15 ubuntu@146.185.240.110 'bash -s' < deploy/server-tune.sh
set -euo pipefail

REL_ROOT=/var/www/medvediva-preview/releases/20261014T191900Z
VHOST=/etc/nginx/sites-available/medvediva-preview
TUNE=/etc/nginx/conf.d/medvediva-tune.conf
SYSCTL_FILE=/etc/sysctl.d/99-medvediva-bbr.conf
MODULE_FILE=/etc/modules-load.d/99-medvediva-bbr.conf
STAMP=$(date -u +%Y%m%dT%H%M%SZ)

VHOST_BACKUP=
TUNE_BACKUP=
TUNE_CREATED=0
nginx_ok=0
tmp=
orig=
tune_body=

cleanup() {
  rm -f "${tmp:-}" "${orig:-}" "${tune_body:-}"
}
trap cleanup EXIT

if ! sudo -n true; then
  echo FAIL
  echo 'passwordless sudo is required'
  exit 1
fi

http_has() {
  local name="$1"
  local file line trimmed token
  for file in /etc/nginx/nginx.conf /etc/nginx/conf.d/*.conf; do
    [[ -f "$file" && -r "$file" ]] || continue
    if [[ -f "$TUNE" && "$file" -ef "$TUNE" ]]; then
      continue
    fi
    while IFS= read -r line || [[ -n "${line:-}" ]]; do
      trimmed="${line#"${line%%[![:space:]]*}"}"
      [[ -z "$trimmed" || "$trimmed" == \#* ]] && continue
      token="${trimmed%%[[:space:]]*}"
      token="${token%%;*}"
      if [[ "$token" == "$name" ]]; then
        return 0
      fi
    done < "$file"
  done
  return 1
}

enable_bbr() {
  local avail has_bbr live
  has_bbr=0
  avail=$(sysctl -n net.ipv4.tcp_available_congestion_control 2>/dev/null || true)
  if printf '%s\n' "$avail" | grep -Eq '(^| )bbr( |$)'; then
    has_bbr=1
  elif sudo -n modprobe tcp_bbr >/dev/null 2>&1; then
    avail=$(sysctl -n net.ipv4.tcp_available_congestion_control 2>/dev/null || true)
    if printf '%s\n' "$avail" | grep -Eq '(^| )bbr( |$)'; then
      has_bbr=1
    fi
  fi
  if [[ "$has_bbr" -ne 1 ]]; then
    echo 'SKIP bbr'
    return 0
  fi
  sudo -n modprobe sch_fq >/dev/null 2>&1 || true
  sudo -n tee "$SYSCTL_FILE" >/dev/null <<'EOF'
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
EOF
  sudo -n tee "$MODULE_FILE" >/dev/null <<'EOF'
tcp_bbr
EOF
  sudo -n sysctl --system >/dev/null || true
  live=$(sysctl -n net.ipv4.tcp_congestion_control 2>/dev/null || true)
  if [[ "$live" != "bbr" ]]; then
    sudo -n sysctl -w net.core.default_qdisc=fq >/dev/null || true
    sudo -n sysctl -w net.ipv4.tcp_congestion_control=bbr >/dev/null || true
    live=$(sysctl -n net.ipv4.tcp_congestion_control 2>/dev/null || true)
  fi
  if [[ "$live" == "bbr" ]]; then
    echo bbr
  else
    sudo -n rm -f "$SYSCTL_FILE" "$MODULE_FILE"
    echo 'FAIL bbr'
  fi
}

restore_nginx() {
  if [[ -n "$VHOST_BACKUP" && -f "$VHOST_BACKUP" ]]; then
    sudo -n cp -a "$VHOST_BACKUP" "$VHOST"
  fi
  if [[ "$TUNE_CREATED" -eq 1 ]]; then
    sudo -n rm -f "$TUNE"
  elif [[ -n "$TUNE_BACKUP" && -f "$TUNE_BACKUP" ]]; then
    sudo -n cp -a "$TUNE_BACKUP" "$TUNE"
  fi
  if sudo -n nginx -t >/dev/null 2>&1; then
    echo 'restored previous nginx files'
  else
    echo 'restored files but nginx -t still failing'
  fi
}

write_tune() {
  local name line
  tune_body=$(mktemp)
  printf '%s\n' '# Medvediva preview http tune. Directives already set in this http context are omitted.' > "$tune_body"
  add_one() {
    name="$1"
    line="$2"
    if http_has "$name"; then
      echo "SKIP duplicate $name"
    else
      printf '%s\n' "$line" >> "$tune_body"
    fi
  }
  add_one sendfile 'sendfile on;'
  add_one tcp_nopush 'tcp_nopush on;'
  add_one tcp_nodelay 'tcp_nodelay on;'
  add_one keepalive_timeout 'keepalive_timeout 30;'
  add_one keepalive_requests 'keepalive_requests 1000;'
  add_one gzip 'gzip on;'
  add_one gzip_comp_level 'gzip_comp_level 5;'
  add_one gzip_min_length 'gzip_min_length 256;'
  add_one gzip_vary 'gzip_vary on;'
  add_one gzip_proxied 'gzip_proxied any;'
  add_one gzip_types 'gzip_types text/plain text/css application/javascript application/json image/svg+xml application/xml text/xml;'
  add_one open_file_cache 'open_file_cache max=1000 inactive=20s;'
  add_one open_file_cache_valid 'open_file_cache_valid 30s;'
  add_one open_file_cache_min_uses 'open_file_cache_min_uses 2;'
  if grep -E 'image/(png|jpe?g)' "$tune_body" >/dev/null; then
    echo FAIL
    echo 'refusing gzip_types for png/jpeg'
    exit 1
  fi
  if sudo -n test -f "$TUNE"; then
    TUNE_BACKUP="${TUNE}.bak-tune-${STAMP}"
    sudo -n cp -a "$TUNE" "$TUNE_BACKUP"
    TUNE_CREATED=0
  else
    TUNE_CREATED=1
  fi
  sudo -n cp "$tune_body" "$TUNE"
  sudo -n chown root:root "$TUNE"
  sudo -n chmod 644 "$TUNE"
}

patch_vhost() {
  tmp=$(mktemp)
  orig=$(mktemp)
  if ! sudo -n test -f "$VHOST"; then
    echo 'SKIP vhost: medvediva-preview is missing, conf.d only'
    return 0
  fi
  sudo -n cp -a "$VHOST" "$tmp"
  sudo -n chown "$USER" "$tmp"
  cp "$tmp" "$orig"
  if ! command -v python3 >/dev/null 2>&1; then
    echo 'SKIP vhost: python3 missing, conf.d only'
    return 0
  fi
  local rc
  set +e
  python3 - "$tmp" <<'PY'
import re
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as fh:
    original = fh.read()
text = original
marker = "location ~* \\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|eot)$ {"

def server_count(src):
    count = 0
    for line in src.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        if re.match(r"server\s*\{", stripped):
            count += 1
    return count

def root_lines(src):
    return [line for line in src.splitlines() if line.strip().startswith("root ")]

def location_lines(src):
    found = []
    for line in src.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        if re.match(r"location\b", stripped):
            found.append(line)
    return found

if "root /var/www/medvediva-preview/" not in text or server_count(text) != 1:
    sys.stderr.write("SKIP vhost: unexpected server file, conf.d only\n")
    sys.exit(2)

if not re.search(r"(?m)^[ \t]*access_log[ \t]+off[ \t]*;", text):
    anchor = re.search(r"(?m)^(?P<indent>[ \t]*)server_name[ \t]+_;[ \t]*$", text)
    if not anchor:
        sys.stderr.write("SKIP vhost: no server_name anchor, conf.d only\n")
        sys.exit(2)
    text = (
        text[: anchor.end()]
        + "\n"
        + anchor.group("indent")
        + "access_log off;"
        + text[anchor.end() :]
    )

idx = text.find(marker)
if idx < 0:
    sys.stderr.write("SKIP vhost gzip: image location missing, access_log only if it was safe\n")
else:
    brace = idx + len(marker) - 1
    if text[brace] != "{":
        sys.stderr.write("SKIP vhost gzip: location brace missing\n")
        text = original
        sys.exit(2)
    depth = 0
    end = None
    for pos, ch in enumerate(text[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = pos
                break
    if end is None:
        sys.stderr.write("SKIP vhost gzip: location block not closed\n")
        sys.exit(2)
    block = text[brace : end + 1]
    if not re.search(r"(?m)^[ \t]*gzip[ \t]+off[ \t]*;", block):
        inner = text[brace + 1 : end]
        indent_match = re.search(r"\n([ \t]+)\S", inner)
        indent = indent_match.group(1) if indent_match else "    "
        text = text[: brace + 1] + "\n" + indent + "gzip off;" + text[brace + 1 :]

if root_lines(original) != root_lines(text) or location_lines(original) != location_lines(text):
    sys.stderr.write("SKIP vhost: patch would change root or locations, conf.d only\n")
    sys.exit(2)

if text != original:
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)
    sys.stdout.write("vhost patched\n")
else:
    sys.stdout.write("vhost already tuned\n")
PY
  rc=$?
  set -e
  if [[ "$rc" -eq 2 ]]; then
    return 0
  fi
  if [[ "$rc" -ne 0 ]]; then
    echo 'SKIP vhost: patch error, conf.d only'
    return 0
  fi
  local roots_before roots_after locs_before locs_after
  roots_before=$(grep -E '^[[:space:]]*root[[:space:]]' "$orig" || true)
  roots_after=$(grep -E '^[[:space:]]*root[[:space:]]' "$tmp" || true)
  locs_before=$(grep -E '^[[:space:]]*location[[:space:]]' "$orig" || true)
  locs_after=$(grep -E '^[[:space:]]*location[[:space:]]' "$tmp" || true)
  if [[ "$roots_before" != "$roots_after" || "$locs_before" != "$locs_after" ]]; then
    echo 'SKIP vhost: root or locations would change, conf.d only'
    return 0
  fi
  if cmp -s "$orig" "$tmp"; then
    return 0
  fi
  VHOST_BACKUP="${VHOST}.bak-tune-${STAMP}"
  sudo -n cp -a "$VHOST" "$VHOST_BACKUP"
  sudo -n cp "$tmp" "$VHOST"
  sudo -n chown root:root "$VHOST"
  sudo -n chmod 644 "$VHOST"
}

measure() {
  local media png relpath url
  echo '--- sysctl ---'
  sysctl net.ipv4.tcp_congestion_control || true
  echo "root: $(sudo -n grep -E '^[[:space:]]*root[[:space:]]' "$VHOST" 2>/dev/null | head -n 1 || true)"
  if ! command -v curl >/dev/null 2>&1; then
    echo 'SKIP speed: curl is not installed'
    return 0
  fi
  echo '--- localhost / ---'
  curl -o /dev/null -sS --max-time 60 \
    -w 'local_bytes=%{size_download} local_speed=%{speed_download} local_time=%{time_total}\n' \
    --compressed http://127.0.0.1/ || echo 'FAIL curl /'
  media="${REL_ROOT}/media"
  if [[ ! -d "$media" ]]; then
    echo "SKIP png: no directory ${media}"
    return 0
  fi
  png=$(find "$media" -type f -iname '*.png' -size +200k -printf '%s\t%p\n' 2>/dev/null | sort -n | tail -n 1 | cut -f2- || true)
  if [[ -z "$png" ]]; then
    echo 'SKIP png: no png over 200KB'
    return 0
  fi
  relpath="${png#"$REL_ROOT"}"
  if ! command -v python3 >/dev/null 2>&1; then
    url="http://127.0.0.1${relpath}"
  else
    url=$(python3 -c 'import urllib.parse,sys; print("http://127.0.0.1"+urllib.parse.quote(sys.argv[1], safe="/"))' "$relpath")
  fi
  echo "--- localhost png ${url} ---"
  curl -o /dev/null -sS --max-time 60 \
    -w 'local_bytes=%{size_download} local_speed=%{speed_download} local_time=%{time_total}\n' \
    --compressed "$url" || echo 'FAIL curl png'
}

enable_bbr

if ! sudo -n nginx -v >/dev/null 2>&1; then
  echo FAIL
  echo 'nginx is not installed; not installing it'
  measure
  exit 1
fi

if ! sudo -n nginx -t >/dev/null 2>&1; then
  echo FAIL
  echo 'nginx -t already failing; files not changed'
  measure
  exit 1
fi

write_tune
patch_vhost

if sudo -n nginx -t; then
  if sudo -n systemctl reload nginx; then
    echo 'nginx ok'
    nginx_ok=1
  else
    echo FAIL
    restore_nginx
  fi
else
  echo FAIL
  restore_nginx
fi

measure

if [[ "$nginx_ok" -ne 1 ]]; then
  exit 1
fi
