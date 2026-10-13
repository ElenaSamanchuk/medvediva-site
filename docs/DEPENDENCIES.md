# Зависимости локальной сборки

09.10.2026. Точные версии взяты из текущего package.json соседнего Vue-проекта, без изменения его файлов: vue 3.5.40, vite 8.2.0, @vitejs/plugin-vue 6.0.8, tailwindcss 4.3.3, @tailwindcss/vite 4.3.3. Новая сборка изолирована в medvediva-site; зависимости закрепляются package-lock.json.

По advisory Endor выполнена маршрутизация в профиль dependency-reviewer/package-risk: прочитана инструкция установленного агента. MCP Endor в текущем наборе инструментов отсутствует; endorctl отсутствует. Для каждого перечисленного npm package-version posture UNKNOWN, data_gaps: unavailable:endor_mcp_package_risk; unavailable:endorctl. Это отсутствие доказательств, а не свидетельство уязвимости и не одобрение SAFE. Платные API/установка Endor/доступ к tenant не запускались. Риск зависимостей требуется подтвердить перед боевым выпуском.

Offline install не состоялся (ENOTCACHED). Сетевой install идёт через официальный npm, с --ignore-scripts и без автоматического аудита/публикации. Безопасность пакетов не считается подтверждённой фактом сборки.
