#!/usr/bin/env bash
set -euo pipefail
# Только для отдельной VM 146.185.240.110. На общей VM с kochfit (212.233.93.50) скрипт снёс бы чужой сайт.
if [[ -e /etc/nginx/sites-available/kochfit || -e /etc/nginx/sites-enabled/kochfit ]]; then
  echo 'STOP: shared VM with kochfit detected — use the shared profile (HOST=212.233.93.50), not this script.' >&2
  exit 3
fi
command -v nginx >/dev/null || { echo 'STOP: nginx is not installed. Send this result for the server setup step.'; exit 3; }
sudo -n nginx -t
# Refuse unknown sites. A stock nginx welcome page may coexist with an explicit IP vhost.
while IFS= read -r file; do
  case "$(basename "$file")" in
    medvediva-preview)
      sudo -n grep -q '^# Managed Medvediva static preview$' "$file" || { echo 'STOP: conflicting Medvediva config'; exit 3; } ;;
    default)
      sudo -n grep -Eq '^\s*root /var/www/html;' "$file" || { echo 'STOP: non-stock default site'; exit 3; }
      sudo -n grep -q 'Welcome to nginx' /var/www/html/index.nginx-debian.html || { echo 'STOP: default site is not the nginx welcome page'; exit 3; }
      if find /var/www/html -mindepth 1 -maxdepth 1 ! -name index.nginx-debian.html | read -r _; then
        echo 'STOP: default site contains other files'; exit 3
      fi ;;
    *) echo "STOP: existing site $(basename "$file"). Configuration must be reviewed before deployment."; exit 3 ;;
  esac
done < <(find /etc/nginx/sites-enabled -mindepth 1 -maxdepth 1 -print)
if sudo -n nginx -T 2>/dev/null | grep -E 'server_name[^;]*146\.185\.240\.110' >/dev/null; then
  sudo -n test -f /etc/nginx/sites-enabled/medvediva-preview || { echo 'STOP: IP already belongs to another vhost'; exit 3; }
fi
while IFS= read -r conf; do
  case "$(basename "$conf")" in
    medvediva-tune.conf) ;;
    *) echo 'STOP: conf.d contains configurations that need review'; exit 3 ;;
  esac
done < <(find /etc/nginx/conf.d -maxdepth 1 -name '*.conf' -print)
echo 'Server check passed; no unknown enabled sites.'
