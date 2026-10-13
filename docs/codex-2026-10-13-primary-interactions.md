# Основные маршруты: анимации и взаимодействия — 13.10.2026

Проверены исходники и модели десяти основных маршрутов из codex-2026-10-13-primary-routes.json; прошлые скрипты Tilda локально не исполнялись, прод-формы/платежи не запускались

## Реальные проверки на статической сборке index-Cci-sjFg.js

- `/invent`, Chromium390 touch DPR3: один публичный native HLS ролик проигран muted5сек, поставлен на паузу, модалка закрыта. readiness3338мс, duration835.36, readyState4; iframe0, pageerrors0, после закрытия video/dialog0
- `/invent` popup без запуска видео, обычный motion: фокус на «Закрыть», Shift+Tab уходит на последний внешний link внутри диалога, Tab возвращает на Close. Escape закрывает, возвращает фокус исходной кнопке1723635093690, освобождает body scroll и убирает hash
- Тот же keyboard/focus/scroll цикл при prefers-reduced-motion=reduce: PASS; dialog animationName=none вместо dialog-enter. Ошибокстраницы0
- Прямые факты: codex-2026-10-13-primary-interactions.json и media-native-proof-codex-2026-10-13.json

## Source/code охват и ещё незакрытое

- На этих десяти маршрутах нет gallery-узлов или picture popups и source data-zoomable=yes; zoom/nextprev сюда искусственно не добавляем. DesignGallery существует для других страниц, их приёмка в этот основной набор не входила
- В моделях основной десятки417 animation-узлов: fadeinup257/fadein157/fadeindown3. Все их стили понимает reveal.mjs, reduced-motion и source mobile-флаг учитываются. Это кодовая сверка, не измерение точного совпадения417эффектов с эталоном
- Smooth-исчезновение остаётся gap: App.vue popup/menu используют v-if без Vue Transition; CSS native-dialog даёт только enter .3сек, exitDOM удаляется сразу. Меню также не имеет общего enter/exit. Это требование плавного появления/исчезновения, а не стопер навигации
- Сама Галерея вне10маршрутов и все56видео/iOSSafari не принимаются на основании одного прогона
