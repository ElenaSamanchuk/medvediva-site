# Развёртывание preview Medvediva (статика)

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
| `conf.d contains configurations` | Убрать или перенести `.conf` из `/etc/nginx/conf.d/` после согласования |
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
