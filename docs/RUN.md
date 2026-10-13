# Локальный запуск

Требуется Node.js с поддержкой установленного Vite; в текущей среде Node 26.0.0. Версии закреплены package.json/package-lock.json.

```sh
cd /Users/elena/Projects/medvediva-site
npm ci --ignore-scripts
npm test
npm run build
npm run dev
```

Workbench формы: http://127.0.0.1:5176/. По умолчанию dry-run; использовать вымышленные значения, например qa@example.invalid. Он не отправляет обращения и не создаёт заказы. Это не главная страница нового сайта.

Повторный offline инвентарь: `npm run inventory`. `tools/capture_sources.py` — read-only приобретение исходников, требует сети; не выполнять без необходимости повторную массовую загрузку. `tools/source-shot.mjs` адаптирован из существующего QA-инструмента и снимает публичный эталон, mobile использует touch/DPR3.

Архив, полученный от Елены, хранить неизменным в sources/export, checksum фиксировать до распаковки. Перед распаковкой проверить пути ZIP на traversal, домен и project ID. Не исполнять код исходного экспорта.
