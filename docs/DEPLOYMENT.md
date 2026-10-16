# Развёртывание preview Medvediva (статика)

## Сервер: общая VM с kochfit.ru (16.10.2026)

С 16.10.2026 preview живёт на **https://preview.medvediva.ru** — VM `212.233.93.50` (hostname `kochfit`), общая с лендингом **kochfit.ru**. Выложил админ; его описание сервера — MD «Medvediva preview на сервере kochfit» (Telegram 16.10).

Сервер один: `deploy/common.sh` принимает только `HOST=212.233.93.50` (по умолчанию; zsh сам задаёт `HOST`=имя Mac, такое значение игнорируется). Каталог `/var/www/medvediva`, скрипты на сервере — `server-check-shared.sh` и `server-activate-shared.sh`.

Карта серверов (16.10.2026, со слов админа):

| IP | Что там |
|---|---|
| `212.233.93.50` | боевой **kochfit.ru** (`/var/www/html`) + **preview.medvediva.ru** (`/var/www/medvediva`) |
| `212.233.93.151` | тестовая VM Елены (Bi13, старый kochfit в `/kochfit/`) — к боевым сайтам отношения не имеет |
| `146.185.241.179` | Popovichfit (тестовый сервер, Nuxt) |
| `146.185.240.110` | старый preview Medvediva — выключен |

Из обычной сети Елены сервер не открывается (таймаут SSH и HTTPS). На самой VM ничего не фильтрует (ufw выключен, fail2ban нет — со слов админа), значит, блок снаружи: провайдер или маршрут. Выкладывать через VPN.

```bash
cd /Users/elena/Projects/medvediva-site
npm ci && npm test
bash deploy/diagnose-preview.sh    # SSH + server-check + локальная сборка, без выкладки
bash deploy/deploy-preview.sh      # сборка → rsync в releases/$REL → переключение current
```

Что делают скрипты:

- **check** (только чтение): в `sites-enabled` только `kochfit` и `medvediva`; у medvediva `server_name preview.medvediva.ru`, `root /var/www/medvediva/current`, нет `default_server`; домен не объявлен в других конфигах; `conf.d` пуст; сертификат Let's Encrypt на месте; предупреждение, если релизов больше 3.
- **activate**: только `chmod a+rX` релиза и симлинк `current`. Конфиги nginx не пишет, nginx не перезагружает, `sites-enabled` не трогает. Проверка по имени (`curl --resolve preview.medvediva.ru:443:127.0.0.1`): главная 200, несуществующий путь 404, заголовок `X-Robots-Tag: noindex`. Не прошло — `current` возвращается на прошлый релиз. Статус `https://kochfit.ru/` и контрольные суммы конфигов nginx сравниваются до и после.
- Откат вручную: `ssh … "sudo ln -sfn releases/<ПРОШЛЫЙ_REL> /var/www/medvediva/current"`. Старые релизы (~320 МБ) удалять вручную, оставляя 2–3.

Скрипты под старую VM (`server-setup.sh`, `server-tune.sh`, `server-activate.sh`, `server-check.sh`) удалены 16.10.2026 — есть в истории git.

Изменения nginx (новый домен, боевой `medvediva.ru`, HTTP/2) скриптами не делаются — вручную по правилам админа: домен в `server_name` на 80 → `certbot certonly --webroot -w /var/www/letsencrypt-medvediva -d <домен>` (не `--nginx`) → пути сертификата в блок 443 → `sudo nginx -t && sudo systemctl reload nginx` (не restart). nginx 1.24: `listen 443 ssl http2;`, директивы `http2 on;` нет. `default_server` принадлежит kochfit.

Формы на preview — демо (заявки никуда не уходят). Боевой перенос `medvediva.ru` — отдельная задача по поручению Елены.

## GitHub Pages: публикация без удаления старых assets (15.10.2026)

Имена файлов в `assets/` (index-*.js / *.css) меняются при каждой сборке. Браузеры держат HTML до 10 минут (`cache-control: max-age=600`); если при публикации удалить старые assets, закешированная страница грузится без стилей (так было у Елены 15.10). Публиковать так — старые assets остаются, отчёт `report/` не трогается:

```
SITE_BASE=/medvediva-site/ npm run build:site && node deploy/check-build.mjs
cd ../medvediva-gh-pages && git pull --ff-only origin gh-pages
rsync -a --delete --filter='P assets/*' --exclude .git --exclude .nojekyll --exclude report ../medvediva-site/dist/ ./
git add -A && git commit -m "Publish …" && git push origin gh-pages
cd ../medvediva-site && npm run build:site   # локальный dist снова от корня /
```

Для сервера (если включено кеширование HTML) — то же правило: старые `assets/*` удалять не сразу, а через сутки.
