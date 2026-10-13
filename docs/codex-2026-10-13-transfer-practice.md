# Практика переноса Кочфит и Попович — точечный аудит 13.10.2026

Чтение локальных реализаций и прошлых отчётов. Чужие проекты не изменены, свежие acceptance-тесты по ним не запускались

## Какие проекты действительно относятся к переносу

- `/Users/elena/Projects/popovichfit-site`: Nuxt/Vue, полный перенос экспорта 220 страниц (219 +404), универсальные Zero/standard renderers, общие site компоненты, SSR и static generate
- `/Users/elena/Projects/kochfit-redesign`: Next/React, Figma редизайн плюс миграция старых Tilda страниц. Это другой дизайн, его голубую палитру/композицию в Медведеву переносить нельзя
- `/Users/elena/Projects/kochfit`: отдельная Figma реализация; `/kochfit-lk` — кабинет, не публичный перенос

## Что брать для Медведевой сейчас

| Готовая реализация | Файл | Применение и границы |
|---|---|---|
| Якорь между страницами, ожидание DOM, сохранённый scroll Back/Forward | Popovich `app/router.options.ts` | `waitFor(selector,4000)` и savedPosition. Для Medvediva без VueRouter адаптировать принцип после nextTick/fontReady, не импорт Nuxt config |
| Политика всех ссылок при реальном клике | Popovich `app/plugins/links.client.ts` | Свои адреса same-tab, внешние blank/noopener. Medvediva уже имеет более строгую подготовку ссылок, использовать как покрытие проверки, не заменять своей регрессией |
| Горизонтальная галерея со стрелками | Popovich `app/components/tilda/HScroll.vue` | Vue обёртка scrollBy от ширины контейнера и состояние canLeft/canRight; можно адаптировать для оборудования/слайдеров |
| Просмотр изображения крупно | Popovich `app/components/site/ImageZoom.vue` | Собственный zoom вместо Tilda runtime, подход для картинок Медведевой |
| Попапы из реестра hash | Popovich `app/composables/useModal.ts`, `app/plugins/modal-links.client.ts` | Регистрировать известные имена и корректно закрывать; не считать любую #ссылку модалкой |
| Типографика в compiler | Popovich `scripts/audit/build_tilda_json.py`, функция typograf_html | Неразрывные пробелы и конечные точки обрабатываются при компиляции HTML, не прямым regex всего JSON/CSS. Исключить URL/числа/документы из слепой редакторской замены |
| Проверка полноты миграции | Popovich `scripts/check-urls.mjs`, `check-links.mjs`, `check-no-tilda.mjs`, `check-seo.mjs` | Короткие автоматические ворота перед сборкой и точечный визуальный контроль отличий; адаптировать пути/source manifest |
| Свежесть экспорта | Popovich `scripts/check-live-drift.mjs`, `check-live-texts.mjs` | Сравнение IDs блоков/элементов до полного перетеста. Не запускать исходный full drift вслепую: там retry sleep60сек и2500мс между всеми219страницами |
| Визуальный diff + отдельно браузеры | Popovich `scripts/measure-diff*.mjs`, `check-browsers.mjs`, `docs/QA-REPORT.md` | Один batch на representative templates, не индивидуальная многочасовая ручная пересборка каждого маршрута |
| Перенос iframe собственного оборудования кодом | Kochfit `src/components/equipment/EquipmentCatalog.tsx`, `scripts/extract-equipment.mjs`, `docs/equipment-and-url-audit.md` | Реально переносит данные/изображения своего проекта в native UI. React нельзя прямо вставить во Vue, полезны схема данных и механизм popup/drag |
| Перенос iframe собственного тарифа кодом | Popovich `app/components/site/TariffsWidget.vue`, `scripts/build-tariffs-widget.mjs` | Свой GitHub widget/config может переноситься; это не замена видеохостинга |

## Что не брать автоматически

- Kinescope без iframe не реализован в обоих проектах: Popovich `VideoEmbed.vue` и Kochfit `VideoModal.tsx` создают iframe. Нельзя обещать готовое решение собственному videoplayer на основании переноса TariffsWidget/EquipmentCatalog
- Cookie Popovich `CookieBanner.vue` сознательно принимает любой клик кроме политики/плашкиВК, повторяя источник T123. Такой код не доказывает ошибку Medvediva — сначала сравнить её live договорённость
- Backend форм/CloudPayments/Cart из Popovich не подключать: у Медведевой формы только demo, покупки через ЛК. Наличие локальной записи заявки не доказывает внешнюю доставку
- Ключи Sender, переменные окружения, SSH и webhook endpoints одного проекта не переносить в другой
- Цвета/шрифты/композицию Figma Кочфит не переносить: Медведева должна оставаться похожей на собственную Tilda

## Что фактически подтверждалось раньше и что является только текущей кодовой возможностью

Popovich `docs/QA-REPORT.md` содержит результаты прошлой приёмки: все219URL/SSR/консоль, мобильные размеры, Chromium+WebKit+Firefox, ссылочная полнота, сборка/сервер, визуальные намеренные отличия. Это исторические доказательства его процесса, не свежийPASS Медведевой. В коде действительно существуют перечисленные компоненты и batch скрипты. Kochfit имеет старые before/after screenshots, equipmentaudit и e2e, но README стартовый и HANDOFF содержит одновременно выполненные пункты и будущие шаги — готовность не определять по одному слову «готово»

Самая полезная тактика: исходный manifest → сравнение структуры экспорта с live → единый compiler/render → batch автоматические ворота → руками только отклонения и интерактив → повторная сборка. Дизайн не переписывать по догадке и не подключать integration backend ради visual preview
