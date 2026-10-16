> Копия инструкции админа (Telegram, 16.10.2026, файл `medvediva-preview-deploy.md`). Исторический документ: пункты про старые скрипты `deploy/` уже исправлены, см. `agent-setup/docs/ADMIN.md`.

# Medvediva preview на сервере kochfit

16.10.2026. Сборка из `github.com/ElenaSamanchuk/medvediva-site` (ветка `main`) выложена на **https://preview.medvediva.ru**.
Сервер общий с лендингом **kochfit.ru**. Сайты разделены: свои папки, свои конфиги nginx, свои сертификаты.

## Сервер

| | |
|---|---|
| IP | `212.233.93.50` (hostname `kochfit`) |
| ОС | Ubuntu 24.04, nginx **1.24** (Node и Docker не установлены) |
| Ресурсы | 2 ГБ RAM, около 55 ГБ свободного диска |
| Вход | `ssh -i <ключ ubuntu-STD3-8-16-200GB-M9I9y4Dw.pem> ubuntu@212.233.93.50`, sudo без пароля |
| DNS | A-запись `preview.medvediva.ru → 212.233.93.50` |

Это **другой** сервер, не `146.185.240.110`, который указан в `docs/DEPLOYMENT.md` и `deploy/common.sh`.

## Что где лежит

### Medvediva

| Что | Путь |
|---|---|
| Релизы (готовый `dist/`) | `/var/www/medvediva/releases/<REL>/`, первый — `20261016T061002Z` |
| Активный релиз | симлинк `/var/www/medvediva/current → releases/<REL>` |
| Конфиг nginx | `/etc/nginx/sites-available/medvediva`, симлинк в `sites-enabled/medvediva` |
| Каталог для проверки Let's Encrypt | `/var/www/letsencrypt-medvediva` |
| Сертификат | `/etc/letsencrypt/live/preview.medvediva.ru/`, действует до 14.01.2027 |
| Настройки продления | `/etc/letsencrypt/renewal/preview.medvediva.ru.conf`: `authenticator = webroot`, `renew_hook = systemctl reload nginx` |
| Бэкап первого конфига (только HTTP) | `/var/www/medvediva/nginx-http-only.conf.bak` |

### kochfit (не трогать)

| Что | Путь |
|---|---|
| Конфиг | `/etc/nginx/sites-available/kochfit` |
| Сайт | `/var/www/html` (+ копия `/var/www/kochfit`) |
| Сертификат | `/etc/letsencrypt/live/kochfit.ru/`, продлевается через `--nginx` |

## Конфиг nginx medvediva (кратко)

- **Порт 80**, `server_name preview.medvediva.ru`: `/.well-known/acme-challenge/` отдаётся из webroot, всё остальное — 301 на https.
- **Порт 443**, `server_name preview.medvediva.ru`:
  - отдаёт статику из `/var/www/medvediva/current`;
  - маршруты — `try_files $uri $uri/index.html =404`;
  - для ненайденного — `error_page 404 /404.html` (оформленная страница `/mist`).
- **Заголовки:** на всех ответах `X-Robots-Tag: noindex, nofollow`. Вместе с `robots.txt` (`Disallow: /`) из сборки это держит превью вне индекса.
- **Кэш:** `/assets/`, картинки, шрифты и видео — `expires 7d`, HTML — `Cache-Control: no-cache`.
- **Сжатие:** gzip для html, css, js, json и svg.
- Остальное повторяет шаблон из `deploy/server-activate.sh`, кроме `default_server`: его держит kochfit.

## Как обновить сайт

Локально, из папки репозитория:

```bash
npm ci
npm test
npm run build:site
node deploy/check-build.mjs        # проверка noindex и состава сборки
```

Выкладка:

```bash
KEY=~/Downloads/ubuntu-STD3-8-16-200GB-M9I9y4Dw.pem
REL=$(date -u +%Y%m%dT%H%M%SZ)
SSH="ssh -i $KEY -o IdentitiesOnly=yes"

$SSH ubuntu@212.233.93.50 "sudo mkdir -p /var/www/medvediva/releases/$REL && sudo chown ubuntu:ubuntu /var/www/medvediva/releases/$REL"
rsync -az --partial -e "$SSH" dist/ ubuntu@212.233.93.50:/var/www/medvediva/releases/$REL/
$SSH ubuntu@212.233.93.50 "sudo chmod -R a+rX /var/www/medvediva/releases/$REL && sudo ln -sfn releases/$REL /var/www/medvediva/current"
```

Перезагружать nginx не нужно: `root` смотрит на симлинк `current`.

**Откат** — переключить `current` на прошлый релиз:

```bash
$SSH ubuntu@212.233.93.50 "ls /var/www/medvediva/releases; sudo ln -sfn releases/<ПРОШЛЫЙ_REL> /var/www/medvediva/current"
```

Старые релизы сами не удаляются (один весит около 320 МБ). Чистить вручную, оставляя 2–3 последних.

## Подводные камни

1. **Скрипты из `deploy/` на этом сервере не запускать.**
   - `common.sh` жёстко ждёт IP `146.185.240.110` и путь `/var/www/medvediva-preview`.
   - `server-activate.sh` (строка ~91) **удаляет из `sites-enabled` все сайты, кроме своего**, и ставит себе `default_server`. Здесь это снесло бы kochfit.ru.
   - `server-check.sh` остановится на «existing site kochfit».
   - Выкладывать по разделу «Как обновить сайт» выше.

2. **`default_server` принадлежит kochfit.** Любой неизвестный домен и заход по голому IP на 80 и 443 уходят редиректом на `https://kochfit.ru`.
   - Medvediva работает только по имени `preview.medvediva.ru`.
   - Для нового домена (например, боевого `medvediva.ru`) нужно добавить его в `server_name` конфига medvediva и выпустить сертификат. Иначе посетитель попадёт на kochfit.

3. **nginx 1.24 не знает директиву `http2 on;`.** Если нужен HTTP/2, писать `listen 443 ssl http2;`.

4. **Перед каждым reload — `sudo nginx -t`.**
   - nginx один на оба сайта. Битый конфиг medvediva при перезапуске сервиса или ребуте VM положит и kochfit.
   - Проверка: `sudo nginx -t && sudo systemctl reload nginx`.

5. **Сертификат выпускать только `certbot certonly --webroot`**, без `--nginx`. Плагин `--nginx` сам переписывает конфиги и может задеть чужие server-блоки. Команда для нового домена:

   ```bash
   sudo certbot certonly --webroot -w /var/www/letsencrypt-medvediva -d <домен> --non-interactive --agree-tos
   ```

   Домен сначала должен быть в `server_name` на порту 80, иначе проверка уйдёт в редирект kochfit. После выпуска добавить пути к сертификату в server на 443, затем `nginx -t` и reload.

6. **Продление автоматическое**: таймер certbot плюс `renew_hook` с reload nginx. Пробное продление (`sudo certbot renew --dry-run --cert-name preview.medvediva.ru`) прошло успешно.

7. **DNS не менялся, кроме `preview`.** `medvediva.ru` по-прежнему на Tilda. Переводить боевой домен — отдельная задача, по `AGENTS.md` — только по отдельному поручению.

8. **Формы — демо-режим** (как в README): заявки и поддержка никуда не отправляются, backend и получатели не настроены. Превью нельзя отдавать как рабочий сайт для лидов.

9. **Ресурсы.** 2 ГБ RAM для двух статических сайтов достаточно. Собирать на сервере не нужно и не стоит: Node там нет, сборка делается локально.

10. **Права на файлы.** Релизы читаются nginx (`a+rX`). После rsync от пользователя `ubuntu` не забыть `chmod -R a+rX`, иначе nginx ответит 403 на новые файлы.

## Как адаптировать скрипты `deploy/` под эту VM

Скрипты писались под отдельную VM `146.185.240.110`, где кроме preview ничего не было. Поэтому они смело чистят nginx и считают сервер своим. На общем сервере с kochfit каждое такое место — риск уронить чужой сайт. Ниже по файлам: что мешает и что поменять.

Лучше не переписывать старые скрипты, а сделать второй профиль: `HOST=212.233.93.50` включает безопасную ветку, старый IP работает как раньше. Тогда выкладка остаётся той же командой `bash deploy/deploy-preview.sh`.

### `deploy/common.sh`

| Сейчас | Что сделать |
|---|---|
| `[[ "$HOST" == "146.185.240.110" ]] \|\| exit 2` — любой другой IP отклоняется | Разрешить и `212.233.93.50` |
| `DEPLOY_BASE=/var/www/medvediva-preview` | Для `212.233.93.50` — `/var/www/medvediva` |
| `KEY=~/Downloads/ubuntu-STD3-8-16-200GB-M9I9y4Dw.pem` | Подходит тот же ключ |
| Подсказки про VPN | Этот сервер доступен без VPN |

Удобно завести переменную профиля (например, `PROFILE=shared` при `HOST=212.233.93.50`) и по ней выбирать путь, имя конфига и домен.

### `deploy/server-check.sh`

- **Строка 16:** любой сайт в `sites-enabled`, кроме `medvediva-preview` и `default`, — `STOP: existing site …`. Здесь остановится на `kochfit`.
  Для профиля shared нужно разрешить `kochfit` (только по имени, не по маске) и `medvediva`. Остальные неизвестные сайты пусть по-прежнему останавливают выкладку.
- **Строки 10–15:** проверка «default = welcome nginx в `/var/www/html`». Здесь `/var/www/html` — **это сам сайт kochfit**, а `default` не включён. Ветка не сработает, но если кто-то включит `default`, проверка даст неверный результат.
- **Строка 19:** ищет IP `146.185.240.110` в `server_name`. Для shared искать `preview.medvediva.ru`: STOP, если домен есть в каком-то конфиге, кроме `medvediva`.
- **Строки 22–27:** `conf.d` здесь пустой — проверка пройдёт.

### `deploy/server-activate.sh` — главное

1. **Строка ~91 удаляет все остальные сайты:**

   ```bash
   sudo -n find /etc/nginx/sites-enabled -mindepth 1 -maxdepth 1 ! -name medvediva-preview -exec rm -f {} +
   ```

   На этой VM это **удалит kochfit**. В профиле shared строку убрать совсем.

2. **Конфиг, который он пишет (строки ~47–87), захватывает весь сервер:** `listen 80 default_server; server_name _;`. Здесь `default_server` уже держит kochfit. Две такие декларации — ошибка `duplicate default server`, nginx не пройдёт `nginx -t`.
   Для shared:
   - `server_name preview.medvediva.ru;` без `default_server`;
   - блок 80 только редиректит на https и отдаёт `/.well-known/acme-challenge/`;
   - блок 443 с сертификатом Let's Encrypt — образец в `/etc/nginx/sites-available/medvediva` на сервере.

3. **Самоподписанный сертификат на IP (строки ~38–46)** — для shared не нужен: есть настоящий `/etc/letsencrypt/live/preview.medvediva.ru/`. Генерацию пропустить, пути взять из Let's Encrypt.

4. **Откат (строки 15–23) включает сайт `default`**, если до этого его выключил:

   ```bash
   sudo -n ln -sfn /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
   ```

   Здесь это вдвойне опасно:
   - стоковый `default` тоже `listen 80 default_server` — конфликт с kochfit, nginx -t падает, и на диске остаётся конфиг, с которым nginx не поднимется после перезапуска;
   - его `root /var/www/html` — это файлы kochfit, которые начали бы отдаваться по голому http без редиректа.

   Для shared откат должен трогать **только** файлы medvediva: вернуть прошлый `current` и прошлый `medvediva` конфиг.

5. **`trap - ERR` стоит до `nginx -t` (строки 92–94).** Если новый конфиг битый, отката не будет, а следом идёт `systemctl restart nginx` — он с битым конфигом **останавливает nginx, и падают оба сайта**. Для shared:
   - проверка — `sudo nginx -t` **внутри** trap (при ошибке откат);
   - применение — `systemctl reload nginx`, а не `restart`: при неудачном reload старые воркеры продолжают работать.

6. **Конфиг смотрит на конкретный релиз.** `sed` (строка ~88) пишет в конфиг `root …/releases/$REL`, поэтому каждая выкладка меняет конфиг и требует reload. Проще как сделано сейчас: `root /var/www/medvediva/current`, выкладка только переключает симлинк, конфиг не меняется.

7. **Проверка после выкладки ходит на `http://127.0.0.1/`** (строки ~96–99). Здесь этот адрес — default_server kochfit, ответом будет 301 на kochfit.ru, и проверка покажет не тот сайт. Проверять так:

   ```bash
   curl -sS --resolve preview.medvediva.ru:443:127.0.0.1 https://preview.medvediva.ru/
   ```

   И отдельно — что `https://kochfit.ru/` по-прежнему 200.

8. **Имена:** `CFG=/etc/nginx/sites-available/medvediva-preview` и маркер `# Managed Medvediva static preview`. На сервере конфиг называется `medvediva` и маркера нет. Либо в профиле shared поменять `CFG` на `medvediva`, либо один раз переименовать файл на сервере и добавить маркер. Иначе появятся два конфига с одним доменом (`conflicting server name`).

### `deploy/deploy-preview.sh`

- В конце печатает `http://${HOST}/` и «самоподписанный сертификат». Здесь по IP откроется kochfit. Для shared печатать `https://preview.medvediva.ru/`.
- `rsync --delete` в **новую** папку релиза безопасен, его можно оставить.

### `deploy/upload-and-activate.sh`

Те же `common.sh` и `server-activate.sh`, значит те же исправления. Отдельно в нём ничего опасного нет.

### `deploy/server-setup.sh`

На этой VM **не запускать** и не нужно: nginx уже стоит и работает. Скрипт проверяет «стоковую welcome-страницу» в `/var/www/html`, а там kochfit.

### `deploy/server-tune.sh` — не запускать

- Пишет **глобальные** настройки: `/etc/nginx/conf.d/medvediva-tune.conf` (http-уровень nginx, действует и на kochfit) и `sysctl` с BBR (`/etc/sysctl.d/99-medvediva-bbr.conf`, `/etc/modules-load.d/…`) — это настройки всего сервера.
- В нём жёстко прописан старый релиз: `REL_ROOT=/var/www/medvediva-preview/releases/20261014T191900Z`.
- Если тюнинг нужен — согласовать отдельно: он меняет поведение и для kochfit.

### `deploy/diagnose-preview.sh`, `deploy/check-build.mjs`

`check-build.mjs` — только локальная проверка сборки, его оставить. `diagnose-preview.sh` вызывает `server-check.sh`, поэтому заработает после его правки.

### Чек-лист готовой адаптации

- [ ] На `HOST=212.233.93.50` ни один скрипт не удаляет и не включает чужие файлы в `sites-enabled`.
- [ ] Нигде нет `default_server` и `server_name _` для medvediva.
- [ ] Проверка конфига идёт внутри trap, применение — `reload`, не `restart`.
- [ ] Откат трогает только `/var/www/medvediva/current` и конфиг `medvediva`.
- [ ] Проверка после выкладки идёт на `preview.medvediva.ru`, плюс проверка, что kochfit.ru отвечает 200.
- [ ] Перед первым боевым запуском прогнать на сервере `sudo nginx -T > /tmp/before.txt`, после — сравнить, что блоки kochfit не изменились.

## Что было проверено после выкладки

- Тесты репозитория 49/49, `check-build.mjs` пройден: 1666 файлов, noindex на месте.
- Все 123 маршрута из `public/content/routes.json` отвечают 200 на `https://preview.medvediva.ru`.
- Несуществующий путь — 404 с оформленной страницей. http — 301 на https.
- `/assets/*.js`, `*.css` и `/content/*.css` отдаются. Сертификат с `CN=preview.medvediva.ru`.
- kochfit.ru до и после: главная (совпал md5), `www` → без www, http → https, `/mpod` → `/stlk`, 404 и заход по IP — ответы не изменились.
