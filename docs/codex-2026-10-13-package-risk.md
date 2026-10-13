# Проверка зависимостей · 13.10.2026

Профиль Endor dependency-reviewer/package-risk: UNKNOWN, Endor MCP/CLI подтверждённо недоступны; Endor PASS не заявлен

Точные версии: hls.js1.7.3 (новый лениво загружаемый HLS плеер), vue3.5.43 (патч с3.5.40)

Официальные релизы: https://github.com/video-dev/hls.js/releases/tag/v1.7.3 и https://github.com/vuejs/core/releases/tag/v3.5.43

Независимые данные основного workflow: npm audit после обновления —0уязвимостей; это не полная оценка malware/лицензий/здоровья
До обновления audit сообщал GHSA-g2v6-rqmx-r4w6 в @vue/server-renderer<3.5.42. Официальная база https://github.com/advisories/GHSA-g2v6-rqmx-r4w6 указывает исправление3.5.42; установлен3.5.43

Никаких Endor scans, авторизации, конфигурации MCP, серверных изменений и дополнительных платных API не выполнялось
