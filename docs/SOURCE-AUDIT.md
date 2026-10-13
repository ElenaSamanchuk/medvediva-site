# Medvediva: аудит источников для переноса Tilda → Vue + Tailwind

Дата: 09.10.2026. Выполнен поиск источников и чтение публичного сайта. Перенос, публикация, изменение Tilda и отправка форм не выполнялись.

## Итог

Подтверждённый экспорт **medvediva.ru** и начатая полноценная миграция Vue + Tailwind в проверенных местах не найдены. Старый чат «Перенести архив Tilda на Vue» (`01a11c50-c4ec-7811-a638-c7bae928b199`) содержит обсуждение возможности переноса; в доступных десяти turns нет переданного архива, пути к созданному проекту или результата миграции. Скрипт `tilda-zero-builder` относится к созданию Zero Block в редакторе, не к освобождению сайта от Tilda.

Рекомендуется свежий полный экспорт проекта Tilda **2075161**, сверенный с текущим опубликованным сайтом. Главная, `/pit`, `/pred` и `/tvg` имеют в sitemap время обновления 09.10.2026 около 12:01–12:02 по Минску. Архив с более ранним содержимым нельзя считать актуальной эталонной версией. Время sitemap — заявленное сайтом, не независимая история редактирования.

## Найденные локальные материалы

- `/Users/elena/Projects/medvediva-banner-states`: отдельный HTML/CSS/JS макет «МедведIVA — продажный блок ЛК». Нет `package.json`; это не полный сайт и не подтверждённая Vue-миграция.
- `medvediva-lk-screens`, `lk-medvediva-screenshots`: материалы ЛК, не подтверждённый исходник публичного сайта.
- `Downloads/september-highlights-2026-main.zip` и Telegram Desktop «Итоги сентября 2026 (сайт).zip»: сборники итогов со ссылками/изображениями нескольких брендов. Наличие ссылки `medvediva.ru` не делает их экспортом этого сайта.
- Три `kochfit_*.zip`: canonical только `kochfit.ru`, Tilda project **751301**. Проверены canonical и project IDs во всех HTML до 5 MB; canonical Medvediva не найден.
- `natalya-popovich_*.zip`: canonical `popovichfit.ru`, Tilda project **4517250**. Это отдельный сайт.
- Остальные ZIP верхнего уровня Downloads и Telegram Desktop проверены по инвентарю и ограниченной выборке HTML. Архив с подтверждённым canonical Medvediva не найден. Папки Projects/Codex проверены по именам материалов и поиску домена в MD/JS/TS/Vue/HTML вне зависимостей, Git и крупных QA-бандлов.

Отсутствие найденного файла не доказывает отсутствие архива на другом диске, в облаке, вложенном неизвестном архиве или недоступном чате.

## Карта маршрутов

Публичный `https://medvediva.ru/sitemap.xml` содержит **120 URL**. `sitemap-store.xml` дополнительно содержит **6 товарных/исторических URL**, из них один на другом домене. Robots перечисляет дополнительные закрытые для индексации страницы: это не запрет миграции и не подтверждение их актуальности. Следовательно, перенос только главной и меню недостаточен.

Приоритетный публичный путь: `/`, `/pit`, `/tvg`, `/intensiv`, `/invent`, `/pred`, `/taplink`, `/prolong_tariff`; поддержка и правовые страницы: `/support`, `/termsofuse`, `/offer`, `/personaldata`, `/consent`, `/part_oferta`, `/data-consent`, `/thank-you-page`, `/delete`. Также есть многочисленные `/pageNNN.html`, `/bNN`, `/zNN`, `/page_0N` — не удалять на основании имени.

Для каждого URL требуется решение «сохраняем идентично / сохраняем редирект на эквивалент / доказанно снимаем по решению владельца». Прямой вход и обновление страницы должны работать без SPA-404; исключить catch-all 200, маскирующий отсутствующие страницы. Сохранить slug, query/referral/UTM-параметры, якоря, canonical, title/description/OG, robots/noindex, sitemap и согласованные HTTP→HTTPS/host редиректы.

Прочитан HTML **пяти страниц**: `/`, `/pit`, `/tvg`, `/intensiv`, `/invent`. Остальные 120 маршрутов инвентаризированы по sitemap, но не проверены вживую. Функциональность форм, платежей, корзины и личного кабинета не тестировалась.

## Ассеты и поведение

Подтверждены Tilda Zero, lazyload, animation/SBS, popup, zero-scale/fixed, events, page blocks CSS/JS и глобальные стили. Нужно заменить поведение компонентами Vue и собственными стилями/анимациями; простое копирование HTML с подключением Tilda JS/CSS не выполняет требование независимости.

Медиа и favicon используют `static.tildacdn.com`, `thb.tildacdn.com`; page assets — `ws.tildacdn.com`, fallback — `neo.tildacdn.com`. На главной обнаружено 31 уникальное изображение в `src/data-original`, но число не включает все CSS backgrounds, видео, srcset и изображения других страниц. Шрифты в Google Fonts: Inter, Play, Tenor Sans. В экспорте проверить наличие исходных файлов, разрешения/варианты, лицензии на самостоятельное размещение; построить полный manifest со ссылкой на страницу и checksum. Бинарные медиа сейчас массово не скачивались.

Сохранить меню, якоря, popup, адаптивные Zero Block состояния, анимации, fixed элементы, сезонные даты/статусы продаж и корректный перенос текста. Эталон фиксировать скриншотами и видео взаимодействий на фактических размерах; особенно 320/360/375/390 px, также tablet/desktop. На этом этапе визуальное совпадение не измерялось.

## Интеграции и потенциальные блокеры

| Подтверждённая зависимость | Действие при переносе | Проверка сейчас |
|---|---|---|
| Внешний ЛК `lk.medvediva.ru`, включая `/referral` | Сохранить назначения и параметры ссылок, не смешивать публичный сайт с переносом ЛК | Ссылки обнаружены; сессии/покупки не проверялись |
| Tilda Forms (по одной форме в HTML главной, pit, tvg, intensiv) | Нужен самостоятельный backend/прямой совместимый приёмник, маршрутизация поддержки, consent и состояния ошибок | Только структура HTML; приёмник/доставка не подтверждены |
| `www.nn99.ru/widget.js` | Сохранить поддержку/чат как бизнес-интеграцию, выяснить зависимость от DOM Tilda и возможные параметры | Присутствует на главной, pit, tvg; не отправлялись сообщения |
| SaleBot `sbsite.pro`, Telegram-боты и deep links | Сохранить функции предзаписи/поддержки, сопоставить параметры и открыть штатные ссылки при приёмке | Домены/ссылки обнаружены; функциональность не тестировалась |
| Yandex Metrika, Facebook scripts | Сохранить согласованные события/согласия, не дублировать счётчики | Найдены в исходнике, IDs не копируются в документ |
| `cdn.postnikovmd.com/tilda@1.5/mods.min.js` | Переписать нужные модификации инициализации Tilda на самостоятельную реализацию | Назначение каждого мода не установлено |
| Скрипт `storage.yandexcloud.net/tilda-tools/...js` | Проверить исходник и перенести только нужную бизнес-логику без Tilda runtime | Загрузка в HTML найдена; код скрипта ещё не разобран |
| Товарные `/tproduct/...` и старый `medvedevaalyona.ru/gaid_karantin` | Проверить карточки, цены, способы оплаты и маршруты корзины без совершения оплаты; согласовать сохранение legacy host | Только sitemap; работа магазина не подтверждена |
| App Store / Google Play ссылки на `/pit` | Сохранить точные назначения | Найдены по HTML, переходы не проверены |
| Ozon / Wildberries / Structura / Fitnessroller на `/invent` | Сохранить ссылки на оборудование и связанное раскрытие | Только HTML |

Удаление всех упоминаний Tilda нельзя выполнять до сопоставления назначения пользовательских скриптов: вместе с названием могут исчезнуть поддержка, формы или бизнес-логика. Цель — отсутствие Tilda JS/CSS/CDN/runtime/forms backend и зависимых модов в итоговом приложении; сторонние бизнес-сервисы сохраняются либо явно отмечаются блокером до замены.

## Как принимать свежий экспорт

1. Проверить canonical `medvediva.ru` и project ID `2075161`, время экспорта, список страниц и текущий опубликованный контент.
2. Сопоставить 120 sitemap URL, 6 store URL, закрытые robots пути, страницы вне sitemap и глобальные header/footer, попапы, каталог, redirects, 404.
3. Проверить все ссылки на локальные изображения/шрифты/CSS/JS и внешние медиа; экспорт может ссылаться на CDN и не содержать backend форм/каталога.
4. Отдельно снять конфигурацию форм/интеграций/редиректов через уполномоченного владельца. Секреты хранить локально/в env, не в документах или Git.
5. Сохранить исходный архив неизменным, checksum и базовую карту соответствия URL→исходный page ID→новый Vue route. Новый экспорт не заменяет эту сверку.
6. Реализовать на Vue + Tailwind с повторно используемыми header/footer/course/support компонентами и независимыми интеграциями. Визуальные улучшения вынести отдельно от обязательного идентичного переноса.
7. Проверить маршруты/ассеты, формы на отдельном тестовом приёмнике, состояния ошибок, меню/якоря/попапы/чат, SEO, адаптив и отсутствие запросов к Tilda; только после этого готовить публикацию и план отката.

## Источники и ограничения

Публичные источники: [главная](https://medvediva.ru/), [sitemap](https://medvediva.ru/sitemap.xml), [store sitemap](https://medvediva.ru/sitemap-store.xml), [robots](https://medvediva.ru/robots.txt), [pit](https://medvediva.ru/pit), [tvg](https://medvediva.ru/tvg), [intensiv](https://medvediva.ru/intensiv), [invent](https://medvediva.ru/invent). Прочитано 09.10.2026 без формы/оплаты/авторизации. Статус 200 отдельных маршрутов, полный DOM/скриншоты, скрытые страницы, backend формы и экспорт из кабинета Tilda ещё не подтверждены.

## Приложение: URL из sitemap

- `https://medvediva.ru/`
- `https://medvediva.ru/fitness_for_health`
- `https://medvediva.ru/taplink`
- `https://medvediva.ru/1`
- `https://medvediva.ru/2`
- `https://medvediva.ru/page51876667.html`
- `https://medvediva.ru/work`
- `https://medvediva.ru/page59853835.html`
- `https://medvediva.ru/page60815917.html`
- `https://medvediva.ru/testform`
- `https://medvediva.ru/page62637493.html`
- `https://medvediva.ru/page74246813.html`
- `https://medvediva.ru/priut`
- `https://medvediva.ru/tv`
- `https://medvediva.ru/amotest`
- `https://medvediva.ru/page105401526.html`
- `https://medvediva.ru/page120016146.html`
- `https://medvediva.ru/page128221656.html`
- `https://medvediva.ru/prolong_tariff`
- `https://medvediva.ru/support`
- `https://medvediva.ru/termsofuse`
- `https://medvediva.ru/offer`
- `https://medvediva.ru/personaldata`
- `https://medvediva.ru/thank-you-page`
- `https://medvediva.ru/delete`
- `https://medvediva.ru/consent`
- `https://medvediva.ru/part_oferta`
- `https://medvediva.ru/data-consent`
- `https://medvediva.ru/intensiv`
- `https://medvediva.ru/b59`
- `https://medvediva.ru/z20`
- `https://medvediva.ru/b60`
- `https://medvediva.ru/b61`
- `https://medvediva.ru/b62`
- `https://medvediva.ru/b63`
- `https://medvediva.ru/z21`
- `https://medvediva.ru/z22`
- `https://medvediva.ru/z23`
- `https://medvediva.ru/z24`
- `https://medvediva.ru/b64`
- `https://medvediva.ru/b65`
- `https://medvediva.ru/b66`
- `https://medvediva.ru/page51597097.html`
- `https://medvediva.ru/b67`
- `https://medvediva.ru/b68`
- `https://medvediva.ru/b69`
- `https://medvediva.ru/b70`
- `https://medvediva.ru/b71`
- `https://medvediva.ru/b72`
- `https://medvediva.ru/b73`
- `https://medvediva.ru/b74`
- `https://medvediva.ru/b75`
- `https://medvediva.ru/b76`
- `https://medvediva.ru/b77`
- `https://medvediva.ru/b78`
- `https://medvediva.ru/b79`
- `https://medvediva.ru/b80`
- `https://medvediva.ru/b81`
- `https://medvediva.ru/b82`
- `https://medvediva.ru/b83`
- `https://medvediva.ru/b84`
- `https://medvediva.ru/b85`
- `https://medvediva.ru/b86`
- `https://medvediva.ru/pitanie`
- `https://medvediva.ru/pitanie_guide`
- `https://medvediva.ru/page_01`
- `https://medvediva.ru/page_02`
- `https://medvediva.ru/page_03`
- `https://medvediva.ru/page_04`
- `https://medvediva.ru/page_05`
- `https://medvediva.ru/pit`
- `https://medvediva.ru/pred`
- `https://medvediva.ru/time`
- `https://medvediva.ru/page36077418.html`
- `https://medvediva.ru/page41858117.html`
- `https://medvediva.ru/page43094989.html`
- `https://medvediva.ru/page43122762.html`
- `https://medvediva.ru/page59569323.html`
- `https://medvediva.ru/inventsjd`
- `https://medvediva.ru/page52708701.html`
- `https://medvediva.ru/page53417005.html`
- `https://medvediva.ru/page53417205.html`
- `https://medvediva.ru/page57938753.html`
- `https://medvediva.ru/page58191799.html`
- `https://medvediva.ru/page58551483.html`
- `https://medvediva.ru/page59461283.html`
- `https://medvediva.ru/page59693539.html`
- `https://medvediva.ru/page59882331.html`
- `https://medvediva.ru/page59927673.html`
- `https://medvediva.ru/page60244757.html`
- `https://medvediva.ru/page60259039.html`
- `https://medvediva.ru/page61490435.html`
- `https://medvediva.ru/page61670363.html`
- `https://medvediva.ru/page61678147.html`
- `https://medvediva.ru/page64977463.html`
- `https://medvediva.ru/long`
- `https://medvediva.ru/page67242767.html`
- `https://medvediva.ru/page67486639.html`
- `https://medvediva.ru/page67533869.html`
- `https://medvediva.ru/page67567619.html`
- `https://medvediva.ru/page67601801.html`
- `https://medvediva.ru/page67639341.html`
- `https://medvediva.ru/page67656165.html`
- `https://medvediva.ru/page68220891.html`
- `https://medvediva.ru/page74425479.html`
- `https://medvediva.ru/page77594406.html`
- `https://medvediva.ru/page83889216.html`
- `https://medvediva.ru/page84128326.html`
- `https://medvediva.ru/page84158536.html`
- `https://medvediva.ru/page84569796.html`
- `https://medvediva.ru/tvg`
- `https://medvediva.ru/page144427436.html`
- `https://medvediva.ru/page144943146.html`
- `https://medvediva.ru/invent`
- `https://medvediva.ru/page150587836.html`
- `https://medvediva.ru/page150748976.html`
- `https://medvediva.ru/page150752676.html`
- `https://medvediva.ru/page150757606.html`
- `https://medvediva.ru/page156348076.html`
- `https://medvediva.ru/page218430309.html`

### Store sitemap

- `https://medvediva.ru/tproduct/1-748916044417-nachni-zanovo`
- `https://medvediva.ru/tproduct/1-691399021024-telo-v-golove`
- `https://medvediva.ru/tproduct/1-873110895709-pitanie-i-trenirovki`
- `https://medvediva.ru/tproduct/1-110719578568-sama-sebe-trener`
- `https://medvediva.ru/tproduct/1-778276502414-gaid-po-po-trenirovke-yagodits`
- `http://medvedevaalyona.ru/gaid_karantin`
