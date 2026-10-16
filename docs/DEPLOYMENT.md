# Развёртывание preview Medvediva (статика)

## Текущий сервер: общая VM с kochfit.ru — профиль shared (16.10.2026)

С 16.10.2026 preview живёт на **https://preview.medvediva.ru** — VM `212.233.93.50` (hostname `kochfit`), общая с лендингом **kochfit.ru**. Выложил админ; его описание сервера — MD «Medvediva preview на сервере kochfit» (Telegram 16.10).

`deploy/common.sh` выбирает профиль по `HOST` (или `DEPLOY_HOST`; zsh сам задаёт `HOST`=имя Mac, такое значение игнорируется):

| HOST | Профиль | Каталог | Скрипты на сервере |
|---|---|---|---|
| `212.233.93.50` (по умолчанию) | shared | `/var/www/medvediva` | `server-check-shared.sh`, `server-activate-shared.sh` |
| `146.185.240.110` | legacy | `/var/www/medvediva-preview` | `server-check.sh`, `server-activate.sh` |

```bash
cd /Users/elena/Projects/medvediva-site
npm ci && npm test
bash deploy/diagnose-preview.sh    # SSH + server-check + локальная сборка, без выкладки
bash deploy/deploy-preview.sh      # сборка → rsync в releases/$REL → переключение current
```

Что делает профиль shared:

- **check** (только чтение): в `sites-enabled` только `kochfit` и `medvediva`; у medvediva `server_name preview.medvediva.ru`, `root /var/www/medvediva/current`, нет `default_server`; домен не объявлен в других конфигах; `conf.d` пуст; сертификат Let's Encrypt на месте; предупреждение, если релизов больше 3.
- **activate**: только `chmod a+rX` релиза и симлинк `current`. Конфиги nginx не пишет, nginx не перезагружает, `sites-enabled` не трогает. Проверка по имени (`curl --resolve preview.medvediva.ru:443:127.0.0.1`): главная 200, несуществующий путь 404, заголовок `X-Robots-Tag: noindex`. Не прошло — `current` возвращается на прошлый релиз. Статус `https://kochfit.ru/` и контрольные суммы конфигов nginx сравниваются до и после.
- Откат вручную: `ssh … "sudo ln -sfn releases/<ПРОШЛЫЙ_REL> /var/www/medvediva/current"`. Старые релизы (~320 МБ) удалять вручную, оставляя 2–3.

**На общей VM не запускать** `server-setup.sh`, `server-tune.sh`, `server-activate.sh`, `server-check.sh` — в них стоит защита: при наличии конфига `kochfit` они останавливаются.

Изменения nginx (новый домен, боевой `medvediva.ru`, HTTP/2) скриптами не делаются — вручную по правилам админа: домен в `server_name` на 80 → `certbot certonly --webroot -w /var/www/letsencrypt-medvediva -d <домен>` (не `--nginx`) → пути сертификата в блок 443 → `sudo nginx -t && sudo systemctl reload nginx` (не restart). nginx 1.24: `listen 443 ssl http2;`, директивы `http2 on;` нет. `default_server` принадлежит kochfit.

Формы на preview — демо (заявки никуда не уходят). Боевой перенос `medvediva.ru` — отдельная задача по поручению Елены.

## Legacy: отдельная VM 146.185.240.110

Ниже — исходная инструкция для отдельной VM; запускается с `HOST=146.185.240.110`.

Цель: показать текущую **незавершённую** статическую сборку на согласованном IP **146.185.240.110**. Это не medvediva.ru: DNS и Tilda не меняются, noindex и robots Disallow сохранены, формы — dry-run.

Popovichfit — **другой сервер** (`146.185.241.179`, Node/Nitro + `deploy/deploy.sh`). Medvediva — только `dist/` через `deploy/deploy-preview.sh`.

## Требования

- Mac с проектом `/Users/elena/Projects/medvediva-site`
- VPN, без которого SSH к `146.185.240.110` обычно **не доходит** (timeout на banner exchange)
- Ключ `~/Downloads/ubuntu-STD3-8-16-200GB-M9I9y4Dw.pem` (права `chmod 600`) — тот же файл может использоваться для разных VM облака, но **хост всегда свой**
- На сервере: Ubuntu, **passwordless sudo** (стандартный образ), nginx

## Порядок (Елена, с VPN)

```bash
cd /Users/elena/Projects/medvediva-site
bash deploy/diagnose-preview.sh    # SSH + server-check + локальная сборка, без upload
bash deploy/deploy-preview.sh      # полная выкатка
```

Первый раз, если diagnose пишет, что nginx нет или sudo просит пароль:

```bash
ssh -i ~/Downloads/ubuntu-STD3-8-16-200GB-M9I9y4Dw.pem ubuntu@146.185.240.110 'bash -s' < deploy/server-setup.sh
```

После успеха:

- http://146.185.240.110/
- https://146.185.240.110/ — самоподписанный сертификат на IP; предупреждение браузера нормально

## Что делает deploy-preview

1. `deploy/server-check.sh` на сервере — отказывается, если включены неизвестные сайты nginx, лишние файлы в `conf.d`, «чужой» default или IP уже занят другим vhost.
2. Локально: `npm run build:site` (или `SKIP_BUILD=1`, если уже есть `dist/`), `deploy/check-build.mjs`.
3. **rsync** `dist/` в `/var/www/medvediva-preview/releases/$REL/` с `--partial --bwlimit=3000` и `ServerAliveInterval=15` (докачка при обрыве VPN), затем `deploy/server-activate.sh`: symlink `current`, nginx, smoke curl. Если на сервер уже залит `.tar.gz`, activate распакует его; если каталог релиза уже заполнен (прямой rsync) — tar не нужен.

Старые релизы и бэкап nginx-конфига не удаляются автоматически.

### Быстрая загрузка без повторного server-check

`deploy/upload-and-activate.sh` — один шаг для докачки после обрыва или повторной активации:

```bash
export KEY=~/Downloads/ubuntu-STD3-8-16-200GB-M9I9y4Dw.pem
export HOST=146.185.240.110   # SERVER=ubuntu@146.185.240.110 задаётся автоматически
export REL=20261009T173948Z   # тот же, что в имени архива
export TAR=/tmp/medvediva-preview-20261009T173948Z.tar.gz
bash deploy/upload-and-activate.sh
```

Либо rsync готового `dist/`: `SKIP_BUILD=1 bash deploy/upload-and-activate.sh` (без `TAR`, если есть `dist/index.html`).

## Типичные STOP из server-check

| Сообщение | Что делать |
|-----------|------------|
| `nginx is not installed` | Запустить `deploy/server-setup.sh` на сервере (см. выше) |
| `existing site …` | На VM уже включён другой сайт — нужен разбор nginx вручную, не ломать чужие vhost |
| `conf.d contains configurations` | В `conf.d` есть неизвестный `.conf`. `medvediva-tune.conf` от `deploy/server-tune.sh` проверка пропускает; остальные убрать или согласовать |
| `non-stock default site` / welcome page | Default nginx переконфигурирован — привести к штатному welcome или согласовать правку check |
| `IP already belongs to another vhost` | IP привязан не к `medvediva-preview` — конфликт конфигов |
| `conflicting Medvediva config` | Файл `medvediva-preview` изменён вручную без маркера managed |

При любой ошибке присылайте **только текст STOP**, без ключа и паролей.

## Переменные окружения

```bash
export KEY=~/Downloads/ubuntu-STD3-8-16-200GB-M9I9y4Dw.pem
export HOST=146.185.240.110
SKIP_BUILD=1 bash deploy/deploy-preview.sh
```

`HOST` — IP preview; `SERVER` всегда `ubuntu@$HOST` (жёстко сверяется в `deploy/common.sh`). Popovich — **146.185.241.179**, не путать.

## Не входит в скрипт

Установка пакетов (кроме однократного server-setup), certbot/боевой TLS, DNS, удаление старых релизов, backend форм, аналитика, коммиты и push.

Боевой перенос medvediva.ru — отдельный этап после приёмки и согласования Елены.

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
