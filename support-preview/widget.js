/**
 * Shumann Widget - Embeddable Chat Widget
 * Usage: <script src="https://senndder.ru/widget.js" data-widget-id="xxx" data-api-key="yyy" async></script>
 * Превью меню FAB без бэкенда: data-fab-stub-telegram="https://t.me/username" data-fab-stub-label="Подпись"
 */

(function () {
  "use strict";

  // Local preview adapter: every API call stays in memory, no delivery or visitor registration.
  const previewConfig = {primaryColor:'#7da1d4',assistantName:'Поддержка · демо',assistantDescription:'Сообщения в этой версии не отправляются',chatBackgroundColor:'#f4f5f6'};
  const fetch = async url => {
    const init=String(url).endsWith('/init');
    if(!init&&!String(url).includes('/config?'))throw new Error('Preview: delivery disabled');
    return {ok:true,json:async()=>({config:previewConfig,channels:[],...(init?{chatId:'QA-preview',messages:[]}: {})})};
  };
  // Get script configuration
  // currentScript = null при динамической вставке <script> — тогда берём bootstrap
  const script = document.currentScript;
  const boot =
    (typeof window !== "undefined" && window.__SENNDER_WIDGET_BOOTSTRAP__) || {};
  const widgetId = 'QA-preview';
  const apiKey = 'QA-preview';
  const apiUrl = '/support-preview/api';
  const apiBaseUrl = '/support-preview';
  const wsUrl = '';
  /** Демо-канал: только для превью, не подставляйте на прод без нужды */
  const fabStubTelegramUrl = (
    script?.getAttribute("data-fab-stub-telegram") ||
    boot.fabStubTelegram ||
    ""
  ).trim();
  const fabStubTelegramLabel =
    (script?.getAttribute("data-fab-stub-label") || boot.fabStubLabel || "").trim() ||
    "Telegram (заглушка)";
  // Default widget icons paths (relative to site root or full URL)
  const DEFAULT_SEND_ICON = `${apiBaseUrl}/images/icons/widget-send-icon-default.svg`;
  const DEFAULT_ESCALATE_ICON = `${apiBaseUrl}/images/icons/widget-escalate-icon.svg`;
  const DEFAULT_EMOJI_ICON = `${apiBaseUrl}/images/icons/widget-emoji-icon.svg`;
  const DEFAULT_ATTACH_ICON = `${apiBaseUrl}/images/icons/widget-attach-icon.svg`;
  const DEFAULT_CHAT_BACKGROUND = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

  if (!widgetId || !apiKey) {
    console.error("Shumann Widget: data-widget-id and data-api-key are required");
    return;
  }

  /**
   * t.me / telegram.me → tg://resolve|join, чтобы открывалось приложение,
   * а не веб-Telegram (часто недоступен без VPN).
   */
  function toTelegramAppDeepLink(rawUrl) {
    const raw = String(rawUrl || "").trim();
    if (!raw) return "";
    if (/^tg:\/\//i.test(raw)) return raw;
    try {
      const u = new URL(raw);
      const host = u.hostname.replace(/^www\./i, "").toLowerCase();
      if (host !== "t.me" && host !== "telegram.me" && host !== "telegram.dog") {
        return raw;
      }
      const parts = u.pathname.split("/").filter(Boolean);
      if (!parts.length) return raw;

      // Инвайты: t.me/+HASH или t.me/joinchat/HASH
      if (parts[0].startsWith("+")) {
        return `tg://join?invite=${encodeURIComponent(parts[0].slice(1))}`;
      }
      if (parts[0].toLowerCase() === "joinchat" && parts[1]) {
        return `tg://join?invite=${encodeURIComponent(parts[1])}`;
      }

      const domain = parts[0].replace(/^@/, "");
      if (!domain || /[^a-zA-Z0-9_]/.test(domain)) return raw;

      const params = new URLSearchParams();
      params.set("domain", domain);
      const start = u.searchParams.get("start");
      if (start) params.set("start", start);
      const startapp = u.searchParams.get("startapp");
      if (startapp) params.set("startapp", startapp);
      return `tg://resolve?${params.toString()}`;
    } catch {
      return raw;
    }
  }

  function isTelegramChannelUrl(url) {
    const s = String(url || "").trim();
    return /^tg:\/\//i.test(s) || /^https:\/\/(t\.me|telegram\.me|telegram\.dog)\//i.test(s);
  }

  function openTelegramDeepLink(url) {
    const deep = toTelegramAppDeepLink(url);
    if (!deep) return;
    // tg:// через <a> надёжнее открывает приложение, чем window.open(_blank)
    const a = document.createElement("a");
    a.href = deep;
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const visitorId = 'QA-preview-in-memory';

  /** Варианты причин (как на бэкенде supportCsat) */
  const CSAT_REASON_OPTIONS = [
    { id: "not_resolved", label: "Не решили вопрос" },
    { id: "slow", label: "Долго отвечали" },
    { id: "off_topic", label: "Ответ не по делу" },
    { id: "unclear", label: "Ответ непонятен" },
    { id: "service_bug", label: "Проблема в сервисе / баг" },
    { id: "repeat_contact", label: "Пришлось обращаться повторно" },
    { id: "other", label: "Другое" },
  ];

  // State
  let isOpen = false;
  let chatId = null;
  let messages = [];
  let socket = null;
  /** @type {null | { status: string; id?: string; scheduledFor?: string; negativeReasons?: { id: string; label: string }[]; questionMain?: string; questionLowFollowup?: string; questionHighFollowup?: string }} */
  let csatState = null;
  let csatUi = { score: null, reasons: [], comment: "" };
  let csatSubmitted = false;
  let csatThanksHideTimer = null;
  /** @type {{ type: string; url: string; label?: string; botId?: string }[]} */
  let embedChannels = [];
  let fabMenuOpen = false;
  let config = {
    primaryColor: "#6366f1",
    position: "bottom-right",
    avatarUrl: null,
    assistantName: "AI-ассистент",
    assistantDescription: null,
    chatBackgroundColor: null,
    chatBackgroundImage: null,
    // Новые настройки дизайна
    visitorMessageColor: "#3F79B9", // По умолчанию синий (справа)
    visitorTextColor: "#FFFFFF",
    aiMessageColor: "#FFFFFF", // По умолчанию белый (слева)
    aiTextColor: "#272727",
    // Настройки даты/времени сообщений
    messageTimeColor: "#AAAFB9",
    messageTimeFontSize: "12px",
    messageTimeFontWeight: "500",
    messageTimeFontFamily: "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    // Настройки шрифта сообщений
    messageFontFamily: "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    messageFontSize: "12px",
    messageFontWeight: "600",
      escalateButtonColor: "#e5e7eb",
      escalateButtonTextColor: "#374151",
      sendButtonIconUrl: null,
      sendButtonInactiveBg: "#F4F5F6",
      sendButtonActiveBg: "#3F79B9",
      sendButtonInactiveIcon: "#AAAFB9",
      sendButtonActiveIcon: "#FFFFFF",
      escalateIconUrl: null,
      emojiIconUrl: null,
      attachIconUrl: null,
      iconInactiveColor: "#AAAFB9",
      iconHoverColor: "#3F79B9",
  };

  // Create styles
  const styles = `
    /* Prevent horizontal scroll and ensure proper viewport */

    
    .sw-container {
      position: fixed;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 100vw;
      box-sizing: border-box;
    }
    .sw-container.bottom-right {
      bottom: 20px;
      right: 20px;
    }
    .sw-container.bottom-left {
      bottom: 20px;
      left: 20px;
    }
    .sw-image-lightbox {
      position: fixed;
      inset: 0;
      z-index: 10000000;
      background: rgba(15, 16, 22, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 20px 20px;
      box-sizing: border-box;
    }
    .sw-image-lightbox-inner {
      max-width: min(90vw, 1200px);
      max-height: 90vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sw-image-lightbox-img {
      max-width: 90vw;
      max-height: 90vh;
      width: auto;
      height: auto;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
    }
    .sw-image-lightbox-close {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 40px;
      height: 40px;
      padding: 0;
      border: none;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
      font-size: 26px;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sw-image-lightbox-close:hover {
      background: rgba(255, 255, 255, 0.24);
    }
    /* Ensure button is always in bottom-right on mobile regardless of container position */
    @media (max-width: 480px) {
      .sw-container.bottom-left .sw-fab-stack {
        right: 16px !important;
        left: auto !important;
      }
    }
    .sw-close-button {
      position: absolute;
      bottom: -18px;
      left: 50%;
      transform: translateX(-50%);
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid var(--sw-primary, #3F79B9);
      background: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
      transition: all 0.2s ease;
    }
    .sw-close-button:hover {
      transform: translateX(-50%);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
    }
    .sw-close-button svg {
      width: 8px;
      height: 8px;
      fill: var(--sw-primary, #3F79B9);
    }
    .sw-button {
      width: 60px !important;
      height: 60px !important;
      min-width: 60px !important;
      min-height: 60px !important;
      max-width: 60px !important;
      max-height: 60px !important;
      border-radius: 50% !important;
      border: none !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      appearance: none;
      -webkit-appearance: none;
      cursor: pointer;
      display: flex !important;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px var(--sw-shadow-color, rgba(99, 102, 241, 0.3));
      transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
      flex-shrink: 0;
      aspect-ratio: 1;
      background: var(--sw-toggle-button-color, var(--sw-primary, #3F79B9));
    }
    .sw-button:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 30px var(--sw-shadow-color, rgba(99, 102, 241, 0.4));
    }
    .sw-button:focus,
    .sw-button:focus-visible,
    .sw-button:active {
      outline: none;
      background: var(--sw-toggle-button-color, var(--sw-primary, #3F79B9));
      box-shadow: 0 4px 20px var(--sw-shadow-color, rgba(99, 102, 241, 0.3));
    }
    .sw-button svg {
      width: 28px !important;
      height: 28px !important;
      fill: white;
      flex-shrink: 0;
    }

    .sw-fab-stack {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      position: relative;
    }
    .sw-fab-satellites {
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .sw-fab-stack.sw-fab-menu-open .sw-fab-satellites {
      display: flex;
    }
    .sw-fab-satellite {
      width: 56px !important;
      height: 56px !important;
      min-width: 56px !important;
      min-height: 56px !important;
      max-width: 56px !important;
      max-height: 56px !important;
      border-radius: 50% !important;
      border: none !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      cursor: pointer;
      display: flex !important;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px var(--sw-shadow-color, rgba(99, 102, 241, 0.3));
      transition: transform 0.2s, box-shadow 0.2s, background 0.2s, opacity 0.2s;
      flex-shrink: 0;
      -webkit-tap-highlight-color: transparent;
    }
    .sw-fab-satellite:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 30px var(--sw-shadow-color, rgba(99, 102, 241, 0.4));
    }
    .sw-fab-satellite:focus,
    .sw-fab-satellite:focus-visible {
      outline: none;
    }
    .sw-fab-satellite svg {
      width: 26px !important;
      height: 26px !important;
      fill: white;
      flex-shrink: 0;
    }
    /* Логотип Telegram по мотивам Wikimedia (три слоя как в оригинале) */
    .sw-fab-satellite.sw-fab-telegram svg.sw-fab-tg-mark {
      fill: none;
      width: 30px !important;
      height: 30px !important;
    }
    .sw-fab-satellite.sw-fab-telegram svg.sw-fab-tg-mark .tg-i-a {
      fill: #c8daea;
    }
    .sw-fab-satellite.sw-fab-telegram svg.sw-fab-tg-mark .tg-i-b {
      fill: #a9c6d8;
    }
    .sw-fab-satellite.sw-fab-telegram svg.sw-fab-tg-mark .tg-i-c {
      fill: #ffffff;
    }
    .sw-fab-satellite.sw-fab-web {
      background: var(--sw-toggle-button-color, var(--sw-primary, #3F79B9));
    }
    .sw-fab-satellite.sw-fab-telegram {
      background: linear-gradient(180deg, #37aee2 0%, #1e96c8 100%);
      box-shadow:
        0 0 0 3px rgba(55, 174, 226, 0.35),
        0 4px 20px var(--sw-shadow-color, rgba(99, 102, 241, 0.3));
    }
    .sw-fab-satellite.sw-fab-telegram:hover {
      box-shadow:
        0 0 0 4px rgba(55, 174, 226, 0.45),
        0 6px 30px var(--sw-shadow-color, rgba(99, 102, 241, 0.4));
    }
    .sw-fab-launcher.sw-fab-close-mode {
      background: #ffffff !important;
      border: 2px solid var(--sw-toggle-button-color, var(--sw-primary, #3F79B9)) !important;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
    }
    .sw-fab-launcher.sw-fab-close-mode svg {
      fill: var(--sw-toggle-button-color, var(--sw-primary, #3F79B9)) !important;
    }

    .sw-window {
      position: absolute;
      bottom: 80px;
      width: 380px;
      height: 520px;
      background: #ffffff;
      border-radius: 12px !important;
      box-shadow: 0 10px 50px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05);
      display: none;
      flex-direction: column;
      overflow: hidden;
    }
    .sw-container.bottom-right .sw-window {
      right: 0;
    }
    .sw-container.bottom-left .sw-window {
      left: 0;
    }
    .sw-window.open {
      display: flex !important;
      visibility: visible;
      opacity: 1;
    }
    .sw-header {
      padding: 18px 20px;
      color: var(--sw-header-text-color, #FFFFFF);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--sw-header-bg-color, #3F79B9);
      font-family: var(--sw-header-font-family, Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    }
    .sw-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .sw-header-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid rgba(255, 255, 255, 0.3);
    }
    .sw-header-avatar-placeholder svg {
      fill: var(--sw-header-text-color, #FFFFFF);
    }
    .sw-header-avatar-placeholder {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sw-header-avatar-placeholder svg {
      width: 24px;
      height: 24px;
      fill: white;
      opacity: 0.8;
    }
    .sw-header-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .sw-header-title {
      font-weight: var(--sw-header-font-weight, 600);
      font-size: var(--sw-header-font-size, 14px);
      letter-spacing: 0.01em;
      color: var(--sw-header-text-color, #FFFFFF);
      font-family: var(--sw-header-font-family, Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    }
    .sw-header-description {
      font-size: 12px;
      opacity: 0.85;
      font-weight: 400;
      color: var(--sw-header-text-color, #FFFFFF);
      font-family: var(--sw-header-font-family, Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    }
    .sw-header-close {
      background: none !important;
      border: none;
      color: white;
      cursor: pointer;
      padding: 2px;
      opacity: 0.8;
      z-index: 1000000;
      position: relative;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
      width: auto;
      height: auto;
      min-width: auto;
      min-height: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s;
    }
    .sw-header-close svg {
      width: 14px !important;
      height: 14px !important;
    }
    .sw-header-close:hover,
    .sw-header-close:active {
      opacity: 1;
      background: none !important;
      border-radius: 0;
    }
    .sw-header-close:focus {
      outline: none;
      opacity: 1;
      background: none !important;
    }
    .sw-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .sw-messages::-webkit-scrollbar {
      width: 0;
      height: 0;
    }
    .sw-message {
      display: flex;
      flex-direction: column;
      gap: 4px;
      position: relative;
      max-width: 100%;
    }
    .sw-message.ai, .sw-message.operator {
      align-items: flex-start;
    }
    .sw-message.visitor {
      align-items: flex-end;
    }
    .sw-message-content {
      padding: 12px 16px;
      border-radius: 16px;
      line-height: 1.4;
      word-wrap: break-word;
      white-space: pre-wrap;
      font-size: var(--sw-message-font-size, 12px);
      font-weight: var(--sw-message-font-weight, 600);
      font-family: var(--sw-message-font-family, Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    }
    .sw-message.ai .sw-message-content,
    .sw-message.operator .sw-message-content {
      background: #FFFFFF !important;
      color: #272727 !important;
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
      border-bottom-left-radius: 4px;
    }
    .sw-message.operator .sw-message-content {
      background: #FFFFFF !important;
      color: #272727 !important;
    }
    .sw-message.visitor .sw-message-content {
      background: #3F79B9 !important;
      color: #FFFFFF !important;
      border-bottom-right-radius: 4px;
    }
    .sw-message.system .sw-message-content {
      background: #f1f5f9 !important;
      color: #64748b !important;
      border-radius: 12px;
      text-align: center;
      font-style: italic;
      font-size: 11px;
      padding: 8px 12px;
      margin: 4px auto;
      max-width: 90%;
    }
    .sw-message-container.system {
      align-items: center;
      align-self: center;
      max-width: 100%;
      width: 100%;
    }
    .sw-message.system {
      width: 100%;
      display: flex;
      justify-content: center;
    }
    .sw-message-time {
      font-size: var(--sw-message-time-font-size, 12px);
      font-weight: var(--sw-message-time-font-weight, 500);
      font-family: var(--sw-message-time-font-family, Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      color: var(--sw-message-time-color, #AAAFB9);
      text-align: center;
      margin: 8px 0;
      width: 100%;
    }
    .sw-message-time-container {
      width: 100%;
      text-align: center;
      margin: 8px 0;
    }
    .sw-csat-card {
      margin-top: 8px;
      padding: 12px 14px;
      border-radius: 12px;
      background: #f8fafc;
      border: 1px solid rgba(15, 23, 42, 0.1);
      max-width: 100%;
      box-sizing: border-box;
    }
    .sw-csat-title {
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 8px;
      line-height: 1.35;
    }
    .sw-csat-subtitle {
      font-size: 12px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 8px;
    }
    .sw-csat-scale-labels {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #64748b;
      margin-bottom: 6px;
      gap: 8px;
    }
    .sw-csat-scale {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .sw-csat-score {
      flex: 1;
      min-width: 36px;
      padding: 8px 4px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #fff;
      color: #0f172a;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
    }
    .sw-csat-score:hover {
      border-color: #3F79B9;
      color: #3F79B9;
    }
    .sw-csat-skip {
      background: none;
      border: none;
      color: #64748b;
      font-size: 11px;
      cursor: pointer;
      text-decoration: underline;
      padding: 4px 0;
    }
    .sw-csat-reasons {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 8px;
    }
    .sw-csat-reason {
      text-align: left;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #fff;
      font-size: 11px;
      color: #334155;
      cursor: pointer;
    }
    .sw-csat-reason--on {
      border-color: #3F79B9;
      background: #eff6ff;
    }
    .sw-csat-comment {
      width: 100%;
      box-sizing: border-box;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      padding: 8px 10px;
      font-size: 12px;
      font-family: inherit;
      resize: vertical;
      min-height: 48px;
      margin-bottom: 8px;
    }
    .sw-csat-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .sw-csat-back {
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #fff;
      font-size: 12px;
      cursor: pointer;
    }
    .sw-csat-send {
      padding: 8px 14px;
      border-radius: 8px;
      border: none;
      background: #3F79B9;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .sw-csat-waiting,
    .sw-csat-done {
      font-size: 12px;
      color: #64748b;
    }
    .sw-csat-done {
      color: #334155;
      font-weight: 500;
    }
    .sw-message-status {
      font-size: 10px;
      opacity: 0.7;
      margin-top: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
      justify-content: flex-end;
      color: #94a3b8;
      padding-right: 0;
      width: 100%;
    }
    .sw-message-status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #94a3b8;
    }
    .sw-message-media {
      margin-bottom: 8px;
    }
    .sw-message-media img {
      max-width: 100%;
      border-radius: 8px;
      display: block;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .sw-message-media img:hover {
      opacity: 0.9;
    }
    .sw-message-media audio {
      max-width: 100%;
      height: 32px;
    }
    .sw-message-container {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      max-width: 85%;
      width: 100%;
    }
    .sw-message-container.visitor {
      align-items: flex-end;
      align-self: flex-end;
    }
    .sw-message-container.ai,
    .sw-message-container.operator {
      align-self: flex-start;
    }
    .sw-message-row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      width: 100%;
    }
    .sw-message-row.visitor {
      flex-direction: row;
    }
    .sw-message-row.visitor .sw-message-avatar,
    .sw-message-row.visitor .sw-message-avatar-placeholder {
      order: 2;
      align-self: flex-end;
      margin-bottom: 0;
      margin-top: 0;
    }
    .sw-message-content-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0;
      position: relative;
      align-items: flex-start;
      flex: 1;
    }
    .sw-message-row.visitor .sw-message-content-wrapper {
      order: 1;
      align-items: flex-end;
      align-self: flex-end;
    }
    .sw-message-row.ai .sw-message-avatar,
    .sw-message-row.ai .sw-message-avatar-placeholder,
    .sw-message-row.operator .sw-message-avatar,
    .sw-message-row.operator .sw-message-avatar-placeholder {
      align-self: flex-end;
      margin-bottom: 0;
    }
    .sw-message-container.visitor .sw-message-status {
      padding-right: 0;
      margin-top: 4px;
      align-self: flex-end;
    }
    .sw-message-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      overflow: hidden;
      background: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      align-self: flex-end;
    }
    .sw-message-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .sw-message-avatar-placeholder {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
      align-self: flex-end;
    }
    .sw-message-avatar-placeholder svg {
      width: 12px;
      height: 12px;
      fill: #94a3b8;
    }
    .sw-typing-container {
      align-self: flex-start;
      display: none;
      flex-direction: column;
      gap: 4px;
    }
    .sw-typing-container.show {
      display: flex;
    }
    .sw-typing-label {
      font-size: 11px;
      color: #64748b;
      padding-left: 4px;
    }
    .sw-typing {
      padding: 12px 16px;
      background: var(--sw-ai-message-bg, #FFFFFF);
      border-radius: 16px;
      border-bottom-left-radius: 4px;
      display: flex;
      gap: 4px;
    }
    .sw-typing span {
      width: 8px;
      height: 8px;
      background: #64748b;
      border-radius: 50%;
      animation: sw-bounce 1.4s infinite ease-in-out;
    }
    .sw-typing span:nth-child(1) { animation-delay: -0.32s; }
    .sw-typing span:nth-child(2) { animation-delay: -0.16s; }
    @keyframes sw-bounce {
      0%, 80%, 100% { transform: scale(0.8); }
      40% { transform: scale(1.2); }
    }
    .sw-input-container {
      padding: 12px 16px;
      border-top: 1px solid rgba(0, 0, 0, 0.06);
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: #fafafa;
      position: relative;
      overflow: visible;
      border-bottom-left-radius: 12px;
      border-bottom-right-radius: 12px;
    }
    .sw-closed-banner {
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 16px;
      border-top: 1px solid rgba(0, 0, 0, 0.06);
      background: #fafafa;
      border-bottom-left-radius: 12px;
      border-bottom-right-radius: 12px;
      text-align: center;
    }
    .sw-closed-banner__text {
      font-size: 13px;
      color: #64748b;
    }
    .sw-closed-banner__btn {
      padding: 9px 20px;
      border-radius: 8px;
      border: none;
      background: var(--sw-primary, #6366f1);
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .sw-closed-banner__btn:hover { opacity: 0.85; }
    .sw-action-buttons-row {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
      position: relative;
      min-width: 0;
    }
    .sw-input-actions {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .sw-input-action-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1px solid #e2e8f0;
      background: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      color: transparent;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }
    .sw-input-action-btn:hover {
      border-color: var(--sw-icon-hover-color, #3F79B9);
      background: white;
    }
    .sw-input-action-btn svg,
    .sw-input-action-btn img {
      width: 18px;
      height: 18px;
      transition: filter 0.2s ease;
      filter: var(--sw-icon-inactive-filter, brightness(0) saturate(100%) invert(67%) sepia(2%) saturate(200%) hue-rotate(180deg) brightness(95%) contrast(90%));
    }
    .sw-input-action-btn:hover svg,
    .sw-input-action-btn:hover img {
      filter: var(--sw-icon-hover-filter, brightness(0) saturate(100%) invert(25%) sepia(95%) saturate(2000%) hue-rotate(200deg) brightness(95%) contrast(90%));
    }
    .sw-input-action-btn img {
      object-fit: contain;
    }
    /* Скрепка: видимая без внешнего файла (иначе пустая кнопка при 404/CORS) */
    #sw-attach-btn {
      color: #64748b;
    }
    #sw-attach-btn svg {
      filter: none !important;
    }
    #sw-attach-btn svg path {
      fill: currentColor;
    }
    #sw-attach-btn:hover {
      color: var(--sw-icon-hover-color, #3F79B9);
    }
    #sw-attach-btn:hover svg {
      filter: none !important;
    }
    .sw-media-input {
      display: none;
    }
    .sw-emoji-picker {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 8px;
      right: 8px;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      padding: 12px;
      width: calc(100% - 16px);
      box-sizing: border-box;
      display: none;
    }
    .sw-emoji-picker.show {
      display: block;
    }
    .sw-emoji-grid {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 6px;
      max-height: 240px;
      overflow-y: auto;
      overflow-x: hidden;
      min-height: 120px;
      width: 100%;
    }
    .sw-emoji-item {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      cursor: pointer;
      border-radius: 6px;
      transition: background 0.2s ease;
    }
    .sw-emoji-item:hover {
      background: #f1f5f9;
    }
    .sw-attach-menu {
      position: absolute;
      bottom: calc(100% + 8px);
      right: 0;
      margin-bottom: 0;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      padding: 4px;
      white-space: nowrap;
      display: none;
      gap: 4px;
      flex-direction: column;
      width: fit-content;
      max-width: 100%;
      box-sizing: border-box;
    }
    .sw-attach-menu.show {
      display: flex;
    }
    .sw-attach-menu-item {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      padding: 10px;
      cursor: pointer;
      border-radius: 8px;
      transition: background 0.2s;
      width: 40px;
      height: 40px;
    }
    .sw-attach-menu-item:hover {
      background: #f1f5f9;
    }
    .sw-attach-menu-item svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }
    .sw-recording-indicator {
      display: none;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #fee2e2;
      border-radius: 20px;
      color: #dc2626;
      font-size: 13px;
      margin-left: 8px;
    }
    .sw-recording-indicator.active {
      display: flex;
    }
    .sw-recording-dot {
      width: 8px;
      height: 8px;
      background: #dc2626;
      border-radius: 50%;
      animation: pulse 1s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .sw-input {
      flex: 1;
      min-width: 0;
      border: none;
      padding: 12px 0;
      box-shadow: none;
      background: transparent;
      font-size: 12px;
      line-height: 1.4;
      font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-weight: 600;
      color: #272727;
      outline: none;
      /* textarea: перенос вместо бесконечного скролла влево */
      resize: none;
      overflow-x: hidden;
      overflow-y: hidden;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      min-height: 40px;
      max-height: 96px; /* ~4 строки: padding + 12px * 1.4 * 4 */
      box-sizing: border-box;
    }
    .sw-input-wrapper {
      flex: 1;
      display: flex;
      align-items: flex-end;
      gap: 8px;
      background: #F4F5F6;
      border: 1px solid #e2e8f0;
      border-radius: 24px;
      padding: 0 4px 0 18px;
      position: relative;
      box-shadow: none;
      transition: background 0.2s, border-color 0.2s;
    }
    .sw-input-wrapper .sw-send {
      margin-right: 4px;
      margin-bottom: 2px;
    }
    .sw-input-wrapper:focus-within,
    .sw-input-wrapper.has-text {
      background: white;
      border-color: #3F79B9;
      box-shadow: none;
    }
    .sw-input-wrapper .sw-input {
      border: none;
      padding: 12px 0;
      box-shadow: none;
      background: transparent;
    }
    .sw-input-wrapper .sw-input:focus {
      border: none;
      box-shadow: none;
    }
    .sw-input::placeholder {
      color: #94a3b8;
      white-space: nowrap;
    }
    .sw-send {
      width: 36px !important;
      height: 36px !important;
      min-width: 36px !important;
      min-height: 36px !important;
      max-width: 36px !important;
      max-height: 36px !important;
      border-radius: 50% !important;
      border: none !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s;
      margin-right: 4px;
      box-shadow: none;
      background: var(--sw-send-inactive-bg, #F4F5F6);
    }
    .sw-send.active {
      background: var(--sw-send-active-bg, #3F79B9);
      box-shadow: none;
    }
    .sw-send:hover:not(:disabled).active {
      opacity: 0.9;
      box-shadow: none;
    }
    .sw-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
    }
    .sw-send svg {
      width: 18px !important;
      height: 18px !important;
      flex-shrink: 0;
      transition: filter 0.2s ease;
      filter: brightness(0) saturate(100%) invert(67%) sepia(2%) saturate(200%) hue-rotate(180deg) brightness(95%) contrast(90%);
    }
    .sw-send.active svg {
      filter: brightness(0) saturate(100%) invert(100%);
    }
    .sw-send img {
      width: 18px !important;
      height: 18px !important;
      object-fit: contain;
      flex-shrink: 0;
      transition: filter 0.2s ease;
      filter: brightness(0) saturate(100%) invert(67%) sepia(2%) saturate(200%) hue-rotate(180deg) brightness(95%) contrast(90%);
    }
    .sw-send.active img {
      filter: brightness(0) saturate(100%) invert(100%);
    }
    .sw-escalate {
      padding: 8px 12px;
      background: #F4F5F6;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      color: var(--sw-icon-inactive-color, #AAAFB9);
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      white-space: nowrap;
      margin: 0;
      box-shadow: none;
    }
    .sw-escalate:hover {
      border-color: var(--sw-icon-hover-color, #3F79B9);
      color: var(--sw-icon-hover-color, #3F79B9);
      background: #F4F5F6;
      transform: none;
    }
    .sw-escalate-icon {
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sw-escalate-icon svg,
    .sw-escalate-icon img {
      width: 100%;
      height: 100%;
      transition: filter 0.2s ease;
      filter: brightness(0) saturate(100%) invert(67%) sepia(2%) saturate(200%) hue-rotate(180deg) brightness(95%) contrast(90%);
    }
    .sw-escalate:hover .sw-escalate-icon svg,
    .sw-escalate:hover .sw-escalate-icon img {
      filter: brightness(0) saturate(100%) invert(25%) sepia(95%) saturate(2000%) hue-rotate(200deg) brightness(95%) contrast(90%);
    }
    .sw-escalate-icon img {
      object-fit: contain;
    }
    
    /* Mobile Responsive Styles */
    @media (max-width: 480px) {
      /* iOS requires 16px to prevent zoom - use 16px for input */
      /* For Android we can use smaller, but iOS will zoom if < 16px */
      .sw-input,
      .sw-input-wrapper input,
      .sw-input-wrapper textarea {
        font-size: 16px !important;
        -webkit-text-size-adjust: 100%;
        -webkit-appearance: none;
        appearance: none;
      }
      
      /* Keep 16px for other form elements to prevent zoom */
      select,
      textarea {
        font-size: 16px !important;
      }
      
      /* Use safe-area-inset-bottom for devices with notches/home indicators */
      .sw-window {
        padding-bottom: env(safe-area-inset-bottom, 0);
      }
      
      /* Ensure input container is always visible above keyboard */
      .sw-input-container {
        position: sticky;
        bottom: 0;
        background: #fafafa;
        z-index: 10;
        padding-bottom: max(12px, env(safe-area-inset-bottom, 0px));
      }
      
      /* Container positioning - full width on mobile */
      .sw-container.bottom-right,
      .sw-container.bottom-left {
        bottom: 0;
        right: 0;
        left: 0;
        width: 100%;
        max-width: 100vw;
        margin: 0;
        padding: 0;
      }
      
      /* Prevent body scroll when widget is open */
      body.sw-widget-open {
        overflow: hidden;
        position: fixed;
        width: 100%;
      }
      
      /* Window - full width and height on mobile */
      /* Use 100dvh (dynamic viewport height) for better keyboard handling */
      .sw-window {
        position: fixed !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        top: 0 !important;
        width: 100% !important;
        height: 100dvh !important;
        max-width: 100% !important;
        max-height: 100dvh !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        z-index: 999999 !important;
        display: none !important;
        flex-direction: column !important;
        overflow: hidden !important;
        visibility: hidden !important;
        opacity: 0 !important;
      }
      
      /* Only show when open */
      .sw-window.open {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      
      /* Ensure messages area can scroll independently */
      .sw-messages {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        min-height: 0; /* Important for flex children */
      }
      
      .sw-container.bottom-right .sw-window,
      .sw-container.bottom-left .sw-window {
        right: 0 !important;
        left: 0 !important;
      }
      
      /* FAB stack — always bottom-right on mobile */
      .sw-container.bottom-right .sw-fab-stack,
      .sw-container.bottom-left .sw-fab-stack {
        position: fixed !important;
        bottom: 16px !important;
        right: 16px !important;
        left: auto !important;
        z-index: 999998 !important;
        margin: 0 !important;
      }
      .sw-container.bottom-right .sw-fab-stack .sw-button,
      .sw-container.bottom-left .sw-fab-stack .sw-button {
        position: relative !important;
        bottom: auto !important;
        right: auto !important;
        left: auto !important;
        width: 56px !important;
        height: 56px !important;
        min-width: 56px !important;
        min-height: 56px !important;
        max-width: 56px !important;
        max-height: 56px !important;
        margin: 0 !important;
      }
      .sw-container.bottom-right .sw-fab-satellite,
      .sw-container.bottom-left .sw-fab-satellite {
        width: 52px !important;
        height: 52px !important;
        min-width: 52px !important;
        min-height: 52px !important;
        max-width: 52px !important;
        max-height: 52px !important;
      }
      .sw-container.bottom-right .sw-fab-satellite.sw-fab-telegram svg.sw-fab-tg-mark,
      .sw-container.bottom-left .sw-fab-satellite.sw-fab-telegram svg.sw-fab-tg-mark {
        width: 27px !important;
        height: 27px !important;
      }
      
      /* Hide FAB when widget panel open on mobile */
      .sw-window.open ~ .sw-fab-stack,
      .sw-container .sw-window.open + .sw-fab-stack,
      .sw-container.sw-widget-open .sw-fab-stack,
      .sw-fab-stack.sw-fab-hidden {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      .sw-fab-stack .sw-button.sw-button-hidden {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      
      .sw-button svg {
        width: 26px !important;
        height: 26px !important;
      }
      
      /* Ensure widget window has higher z-index than button */
      .sw-window {
        z-index: 999999 !important;
      }
      
      /* Header adjustments */
      .sw-header {
        padding: 14px 16px;
        min-height: 60px;
        position: relative;
        z-index: 10;
      }
      
      .sw-header-close {
        width: auto;
        height: auto;
        min-width: auto;
        min-height: auto;
        padding: 2px;
        z-index: 11;
        background: none !important;
      }
      .sw-header-close svg {
        width: 14px !important;
        height: 14px !important;
      }
      .sw-header-close:hover,
      .sw-header-close:active {
        background: none !important;
      }
      
      .sw-header-avatar,
      .sw-header-avatar-placeholder {
        width: 36px;
        height: 36px;
      }
      
      .sw-header-title {
        font-size: 13px !important;
      }
      
      .sw-header-description {
        font-size: 11px;
      }
      
      /* Messages area */
      .sw-messages {
        padding: 12px;
        gap: 10px;
      }
      
      .sw-message-content {
        padding: 10px 14px;
        font-size: 13px !important;
        max-width: 85%;
      }
      
      .sw-message-time {
        font-size: 11px !important;
        margin: 6px 0;
      }
      
      .sw-message-avatar,
      .sw-message-avatar-placeholder {
        width: 20px;
        height: 20px;
      }
      
      .sw-message-avatar-placeholder svg {
        width: 10px;
        height: 10px;
      }
      
      /* Input container */
      .sw-input-container {
        padding: 10px 12px;
        gap: 6px;
      }
      
      .sw-action-buttons-row {
        gap: 6px;
        margin-bottom: 6px;
      }
      
      .sw-input-action-btn {
        width: 28px;
        height: 28px;
      }
      
      .sw-input-action-btn svg,
      .sw-input-action-btn img {
        width: 16px;
        height: 16px;
      }
      
      .sw-escalate {
        padding: 6px 10px;
        font-size: 12px;
      }
      
      .sw-escalate-icon {
        width: 14px;
        height: 14px;
      }
      
      .sw-input-wrapper {
        padding: 0 3px 0 14px;
      }
      
      .sw-input {
        font-size: 16px !important;
        line-height: 1.35;
        padding: 10px 0;
        min-height: 38px;
        max-height: 94px; /* ~4 строки при 16px */
      }
      
      .sw-send {
        width: 32px !important;
        height: 32px !important;
        min-width: 32px !important;
        min-height: 32px !important;
        max-width: 32px !important;
        max-height: 32px !important;
      }
      
      .sw-send svg,
      .sw-send img {
        width: 16px !important;
        height: 16px !important;
      }
      
      /* Emoji picker */
      .sw-emoji-picker {
        left: 4px;
        right: 4px;
        width: calc(100% - 8px);
        padding: 10px;
        max-height: 200px;
      }
      
      .sw-emoji-grid {
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
        max-height: 180px;
      }
      
      .sw-emoji-item {
        width: 28px;
        height: 28px;
        font-size: 18px;
      }
      
      /* Attach menu */
      .sw-attach-menu {
        right: 0;
        left: auto;
        width: fit-content;
        max-width: calc(100vw - 24px);
      }
      
      .sw-attach-menu-item {
        padding: 10px;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .sw-attach-menu-item svg {
        width: 18px;
        height: 18px;
      }
      
      /* Typing indicator */
      .sw-typing {
        padding: 10px 14px;
      }
      
      .sw-typing span {
        width: 7px;
        height: 7px;
      }
      
      /* Media in messages */
      .sw-message-media img {
        max-width: 100%;
        cursor: pointer;
      }
      .sw-message-media img:hover {
        opacity: 0.9;
      }
      
      .sw-message-media audio {
        width: 100%;
        max-width: 100%;
      }
      
      /* Close button positioning */
      .sw-close-button {
        bottom: -18px;
        width: 20px;
        height: 20px;
      }
      
      .sw-close-button svg {
        width: 8px;
        height: 8px;
      }
    }
    
    /* Small mobile devices (iPhone SE, etc.) */
    @media (max-width: 375px) {
      .sw-header {
        padding: 12px 14px;
      }
      
      .sw-messages {
        padding: 10px;
      }
      
      .sw-message-content {
        padding: 9px 12px;
        font-size: 12px !important;
      }
      
      .sw-input-container {
        padding: 8px 10px;
      }
      
      .sw-input-wrapper {
        padding: 0 2px 0 12px;
      }
      
      .sw-input {
        font-size: 16px !important;
        line-height: 1.35;
        padding: 9px 0;
        min-height: 36px;
        max-height: 90px;
      }
      
      .sw-action-buttons-row {
        gap: 4px;
      }
      
      .sw-input-action-btn {
        width: 26px;
        height: 26px;
      }
      
      .sw-send {
        width: 30px !important;
        height: 30px !important;
        min-width: 30px !important;
        min-height: 30px !important;
        max-width: 30px !important;
        max-height: 30px !important;
      }
    }
    
    /* Landscape mobile orientation */
    @media (max-width: 768px) and (orientation: landscape) {
      .sw-window {
        height: 100vh !important;
      }
      
      .sw-messages {
        max-height: calc(100vh - 200px);
      }
    }
  `;

  // Create container
  const container = document.createElement("div");
  container.className = `sw-container ${config.position}`;
  container.innerHTML = `
    <style>${styles}</style>
    <div class="sw-window" id="sw-window">
      <div class="sw-header" id="sw-header">
        <div class="sw-header-left">
          <div class="sw-header-avatar-placeholder" id="sw-header-avatar">
            <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </div>
          <div class="sw-header-info">
            <span class="sw-header-title" id="sw-header-title">Чат поддержки</span>
            <span class="sw-header-description" id="sw-header-description"></span>
          </div>
        </div>
        <button class="sw-header-close" id="sw-close">
          <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>
      <div class="sw-messages" id="sw-messages"></div>
      <div class="sw-closed-banner" id="sw-closed-banner">
        <span class="sw-closed-banner__text">Диалог завершён</span>
        <button class="sw-closed-banner__btn" id="sw-new-chat-btn">Начать новый чат</button>
      </div>
      <div class="sw-input-container">
        <div class="sw-action-buttons-row">
          <button class="sw-escalate" id="sw-escalate">
            <span class="sw-escalate-icon">
              <svg id="sw-escalate-icon-svg" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              <img id="sw-escalate-icon-img" style="display: none; width: 16px; height: 16px; object-fit: contain;" alt="Operator" />
            </span>
            Позвать оператора
          </button>
          <button class="sw-input-action-btn" id="sw-emoji-btn" title="Эмодзи">
            <svg id="sw-emoji-icon-svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            <img id="sw-emoji-icon-img" style="display: none; width: 18px; height: 18px; object-fit: contain;" alt="Emoji" />
          </button>
          <div class="sw-emoji-picker" id="sw-emoji-picker">
            <div class="sw-emoji-grid" id="sw-emoji-grid"></div>
          </div>
          <input type="file" class="sw-media-input" id="sw-media-input" accept="image/*" />
          <input type="file" class="sw-media-input" id="sw-audio-input" accept="audio/*" />
          <button class="sw-input-action-btn" id="sw-attach-btn" title="Прикрепить файл" type="button">
            <svg id="sw-attach-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
            <img id="sw-attach-icon-img" style="display: none; width: 18px; height: 18px; object-fit: contain;" alt="Attach" />
          </button>
          <div class="sw-attach-menu" id="sw-attach-menu">
            <div class="sw-attach-menu-item" id="sw-attach-image" title="Прикрепить скриншот">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
            <div class="sw-attach-menu-item" id="sw-record-audio" title="Записать аудиосообщение">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </div>
          </div>
          <div class="sw-recording-indicator" id="sw-recording-indicator">
            <div class="sw-recording-dot"></div>
            <span>Запись...</span>
            <button id="sw-stop-recording" style="margin-left: auto; background: #dc2626; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">Стоп</button>
          </div>
        </div>
        <div class="sw-input-wrapper">
          <textarea class="sw-input" id="sw-input" rows="1" placeholder="Написать сообщение..." enterkeyhint="send"></textarea>
          <button class="sw-send" id="sw-send">
            <svg id="sw-send-icon-svg" style="display: none;" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            <img id="sw-send-icon-img" style="width: 100%; height: 100%; object-fit: contain;" alt="Send" />
          </button>
        </div>
      </div>
    </div>
    <div class="sw-fab-stack" id="sw-fab-stack">
      <div class="sw-fab-satellites" id="sw-fab-satellites" aria-hidden="true"></div>
      <button type="button" class="sw-button sw-fab-launcher" id="sw-toggle" aria-expanded="false" aria-label="Открыть чат">
        <svg class="sw-fab-icon-chat" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
        <svg class="sw-fab-icon-close" viewBox="0 0 24 24" aria-hidden="true" style="display:none"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>
    </div>
  `;

  // Add to page
  document.body.appendChild(container);

  // Get elements
  const toggleBtn = document.getElementById("sw-toggle");
  const windowEl = document.getElementById("sw-window");
  const closeBtn = document.getElementById("sw-close");
  const messagesEl = document.getElementById("sw-messages");
  const inputEl = document.getElementById("sw-input");
  const sendBtn = document.getElementById("sw-send");
  const escalateBtn = document.getElementById("sw-escalate");
  const headerEl = document.getElementById("sw-header");
  const emojiBtn = document.getElementById("sw-emoji-btn");
  const attachBtn = document.getElementById("sw-attach-btn");
  const mediaInput = document.getElementById("sw-media-input");
  const audioInput = document.getElementById("sw-audio-input");
  const emojiPicker = document.getElementById("sw-emoji-picker");
  const emojiGrid = document.getElementById("sw-emoji-grid");
  const attachMenu = document.getElementById("sw-attach-menu");
  const recordingIndicator = document.getElementById("sw-recording-indicator");
  const stopRecordingBtn = document.getElementById("sw-stop-recording");
  const attachImageBtn = document.getElementById("sw-attach-image");
  const recordAudioBtn = document.getElementById("sw-record-audio");
  const closeBottomBtn = document.getElementById("sw-close-bottom");
  const closedBanner = document.getElementById("sw-closed-banner");
  const newChatBtn = document.getElementById("sw-new-chat-btn");
  const fabStack = document.getElementById("sw-fab-stack");
  const satellitesEl = document.getElementById("sw-fab-satellites");

  let swImageLightboxEl = null;
  let swImageLightboxKeyHandler = null;

  function closeImageLightbox() {
    if (swImageLightboxEl) {
      swImageLightboxEl.remove();
      swImageLightboxEl = null;
    }
    if (swImageLightboxKeyHandler) {
      document.removeEventListener("keydown", swImageLightboxKeyHandler);
      swImageLightboxKeyHandler = null;
    }
  }

  function openImageLightbox(url) {
    if (!url || !container) return;
    closeImageLightbox();
    const overlay = document.createElement("div");
    overlay.className = "sw-image-lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "sw-image-lightbox-close";
    closeBtn.setAttribute("aria-label", "Закрыть");
    closeBtn.innerHTML = "\u00d7";
    const inner = document.createElement("div");
    inner.className = "sw-image-lightbox-inner";
    const img = document.createElement("img");
    img.className = "sw-image-lightbox-img";
    img.src = url;
    img.alt = "";
    inner.appendChild(img);
    overlay.appendChild(closeBtn);
    overlay.appendChild(inner);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeImageLightbox();
    });
    inner.addEventListener("click", (e) => e.stopPropagation());
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeImageLightbox();
    });
    swImageLightboxKeyHandler = (e) => {
      if (e.key === "Escape") closeImageLightbox();
    };
    document.addEventListener("keydown", swImageLightboxKeyHandler);
    container.appendChild(overlay);
    swImageLightboxEl = overlay;
  }

  if (messagesEl) {
    messagesEl.addEventListener("input", (ev) => {
      const t = ev.target;
      if (t && t.matches && t.matches("[data-sw-csat-comment]")) {
        csatUi.comment = t.value;
      }
    });
    messagesEl.addEventListener("click", (ev) => {
      const thumb = ev.target.closest("img[data-sw-lightbox-url]");
      if (thumb) {
        ev.preventDefault();
        ev.stopPropagation();
        const raw = thumb.getAttribute("data-sw-lightbox-url");
        if (raw) openImageLightbox(raw);
        return;
      }

      const scoreEl = ev.target.closest("[data-sw-csat-score]");
      if (scoreEl) {
        ev.preventDefault();
        const n = parseInt(scoreEl.getAttribute("data-sw-csat-score") || "0", 10);
        if (n >= 1 && n <= 5) {
          csatUi.score = n;
          csatUi.reasons = [];
          renderMessages();
        }
        return;
      }

      const reasonEl = ev.target.closest("[data-sw-csat-reason]");
      if (reasonEl) {
        ev.preventDefault();
        const ta = messagesEl.querySelector("[data-sw-csat-comment]");
        if (ta) csatUi.comment = ta.value;
        const id = reasonEl.getAttribute("data-sw-csat-reason") || "";
        const i = csatUi.reasons.indexOf(id);
        if (i >= 0) csatUi.reasons.splice(i, 1);
        else csatUi.reasons.push(id);
        renderMessages();
        return;
      }

      const backEl = ev.target.closest("[data-sw-csat-back]");
      if (backEl) {
        ev.preventDefault();
        csatUi.score = null;
        csatUi.reasons = [];
        csatUi.comment = "";
        renderMessages();
        return;
      }

      const submitEl = ev.target.closest("[data-sw-csat-submit]");
      if (submitEl) {
        ev.preventDefault();
        const ta = messagesEl.querySelector("[data-sw-csat-comment]");
        if (ta) csatUi.comment = ta.value;
        submitCsat();
        return;
      }

      const skipEl = ev.target.closest("[data-sw-csat-skip]");
      if (skipEl) {
        ev.preventDefault();
        dismissCsat();
      }
    });
  }

  // Плашка «Спасибо за обратную связь» не должна висеть до перезагрузки —
  // прячем её автоматически через несколько секунд
  function scheduleCsatThanksAutoHide() {
    if (csatThanksHideTimer) clearTimeout(csatThanksHideTimer);
    csatThanksHideTimer = setTimeout(() => {
      csatThanksHideTimer = null;
      if (csatSubmitted && !csatState) {
        csatSubmitted = false;
        renderMessages();
      }
    }, 4000);
  }

  async function dismissCsat() {
    if (!chatId || !csatState || csatState.status === "WAITING") return;
    try {
      const res = await fetch(`${apiUrl}/widget-chat/${chatId}/csat/dismiss`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Widget-Api-Key": apiKey,
        },
        body: JSON.stringify({ visitorId }),
      });
      if (res.ok) {
        csatSubmitted = true;
        csatState = null;
        renderMessages();
        scheduleCsatThanksAutoHide();
      }
    } catch (e) {
      console.warn("CSAT dismiss", e);
    }
  }

  async function submitCsat() {
    if (!chatId || !csatState || !csatUi.score) return;
    const score = csatUi.score;
    let comment = (csatUi.comment || "").trim();
    let negativeReasons = [];
    if (score <= 3) {
      negativeReasons = [...csatUi.reasons];
      if (negativeReasons.length === 0) return;
      if (negativeReasons.includes("other") && !comment) return;
    }
    try {
      const res = await fetch(`${apiUrl}/widget-chat/${chatId}/csat/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Widget-Api-Key": apiKey,
        },
        body: JSON.stringify({
          visitorId,
          score,
          comment: comment || null,
          negativeReasons: score <= 3 ? negativeReasons : [],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn("CSAT submit", err);
        return;
      }
      csatSubmitted = true;
      csatState = null;
      csatUi = { score: null, reasons: [], comment: "" };
      renderMessages();
      scheduleCsatThanksAutoHide();
    } catch (e) {
      console.warn("CSAT submit", e);
    }
  }

  function buildCsatCardHtml() {
    if (csatSubmitted) {
      return `<div class="sw-csat-card sw-csat-done" data-sw-csat-root role="region">Спасибо за обратную связь.</div>`;
    }
    if (!csatState) return "";
    if (csatState.status === "WAITING") {
      return `<div class="sw-csat-card sw-csat-waiting" data-sw-csat-root role="region">Опрос появится после завершения диалога или паузы в переписке.</div>`;
    }
    if (csatState.status !== "READY" && csatState.status !== "PENDING") return "";

    const reasons =
      Array.isArray(csatState.negativeReasons) && csatState.negativeReasons.length
        ? csatState.negativeReasons
        : CSAT_REASON_OPTIONS;

    const qMain = csatState.questionMain || "Насколько вам помог этот ответ?";
    const qLow = csatState.questionLowFollowup || "Что пошло не так?";
    const qHigh = csatState.questionHighFollowup || "Что было полезно?";

    if (!csatUi.score) {
      const scale = [1, 2, 3, 4, 5]
        .map(
          (n) =>
            `<button type="button" class="sw-csat-score" data-sw-csat-score="${n}" aria-label="Оценка ${n}">${n}</button>`
        )
        .join("");
      return `
        <div class="sw-csat-card" data-sw-csat-root role="region" aria-label="Оценка поддержки">
          <div class="sw-csat-title">${escapeHtml(qMain)}</div>
          <div class="sw-csat-scale-labels"><span>1 — совсем не помог</span><span>5 — очень помог</span></div>
          <div class="sw-csat-scale">${scale}</div>
          <button type="button" class="sw-csat-skip" data-sw-csat-skip>Пропустить</button>
        </div>`;
    }

    const s = csatUi.score;
    if (s <= 3) {
      const reasonBtns = reasons
        .map((r) => {
          const id = typeof r === "string" ? r : r.id;
          const label = typeof r === "string" ? r : r.label;
          const on = csatUi.reasons.includes(id) ? " sw-csat-reason--on" : "";
          return `<button type="button" class="sw-csat-reason${on}" data-sw-csat-reason="${escapeHtmlAttr(id)}">${escapeHtml(label)}</button>`;
        })
        .join("");
      return `
        <div class="sw-csat-card" data-sw-csat-root>
          <div class="sw-csat-subtitle">${escapeHtml(qLow)}</div>
          <div class="sw-csat-reasons">${reasonBtns}</div>
          <textarea class="sw-csat-comment" data-sw-csat-comment rows="2" placeholder="Комментарий (обязателен для «Другое»)"></textarea>
          <div class="sw-csat-actions">
            <button type="button" class="sw-csat-back" data-sw-csat-back>Назад</button>
            <button type="button" class="sw-csat-send" data-sw-csat-submit>Отправить</button>
          </div>
        </div>`;
    }

    return `
      <div class="sw-csat-card" data-sw-csat-root>
        <div class="sw-csat-subtitle">${escapeHtml(qHigh)}</div>
        <textarea class="sw-csat-comment" data-sw-csat-comment rows="2" placeholder="Необязательно"></textarea>
        <div class="sw-csat-actions">
          <button type="button" class="sw-csat-back" data-sw-csat-back>Назад</button>
          <button type="button" class="sw-csat-send" data-sw-csat-submit>Отправить</button>
        </div>
      </div>`;
  }

  let chatClosed = false;

  function showClosedBanner() {
    chatClosed = true;
    if (closedBanner) closedBanner.style.display = "flex";
    const inputContainer = container.querySelector(".sw-input-container");
    if (inputContainer) inputContainer.style.display = "none";
  }

  function hideClosedBanner() {
    chatClosed = false;
    if (closedBanner) closedBanner.style.display = "none";
    const inputContainer = container.querySelector(".sw-input-container");
    if (inputContainer) inputContainer.style.display = "flex";
  }

  function mergeFabStubChannels() {
    embedChannels = embedChannels.filter((c) => c.botId !== "_stub");
    if (fabStubTelegramUrl && isTelegramChannelUrl(fabStubTelegramUrl)) {
      embedChannels.push({
        type: "telegram",
        url: fabStubTelegramUrl,
        label: fabStubTelegramLabel,
        botId: "_stub",
      });
    }
    renderFabSatellites();
  }

  function syncEmbedChannelsFromApi(raw) {
    // Не затираем каналы из preload /config, если в ответе нет поля channels
    if (raw === undefined || raw === null) {
      mergeFabStubChannels();
      return;
    }
    if (!Array.isArray(raw)) {
      mergeFabStubChannels();
      return;
    }
    const filtered = raw.filter(
      (c) =>
        c &&
        c.type === "telegram" &&
        typeof c.url === "string" &&
        isTelegramChannelUrl(c.url) &&
        c.botId !== "_stub"
    );
    // Пустой массив от init часто приходит после preload с ботами — не затираем FAB
    if (filtered.length > 0) {
      embedChannels = filtered;
    }
    mergeFabStubChannels();
  }

  function closeFabMenu() {
    fabMenuOpen = false;
    if (fabStack) fabStack.classList.remove("sw-fab-menu-open");
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-expanded", "false");
      toggleBtn.setAttribute("aria-label", "Открыть чат");
      toggleBtn.classList.remove("sw-fab-close-mode");
      const chatIc = toggleBtn.querySelector(".sw-fab-icon-chat");
      const closeIc = toggleBtn.querySelector(".sw-fab-icon-close");
      if (chatIc) chatIc.style.display = "";
      if (closeIc) closeIc.style.display = "none";
    }
    if (satellitesEl) satellitesEl.setAttribute("aria-hidden", "true");
  }

  function renderFabSatellites() {
    if (!satellitesEl) return;
    satellitesEl.innerHTML = "";
    if (embedChannels.length === 0) return;

    const tgSvg =
      '<svg class="sw-fab-tg-mark" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path class="tg-i-a" d="M81.229,128.772l14.237,39.406s1.78,3.687,3.686,3.687,30.255-29.492,30.255-29.492l31.525-60.89L81.737,118.6Z"/><path class="tg-i-b" d="M100.106,138.878l-2.733,29.046s-1.144,8.9,7.754,0,17.415-15.763,17.415-15.763"/><path class="tg-i-c" d="M81.486,130.178L52.2,120.636s-3.5-1.42-2.373-4.64c.232-.664.7-1.229,2.1-2.2,6.489-4.523,120.106-45.36,120.106-45.36s3.208-1.081,5.1-.362a2.766,2.766,0,0,1,1.885,2.055,9.357,9.357,0,0,1,.254,2.585c-.009.752-.1,1.449-.169,2.542-.692,11.165-21.4,94.493-21.4,94.493s-1.239,4.876-5.678,5.043A8.13,8.13,0,0,1,146.1,172.5c-8.711-7.493-38.819-27.727-45.472-32.177a1.27,1.27,0,0,1-.546-.9c-.093-.469.417-1.05.417-1.05s52.426-46.6,53.821-51.492c.108-.379-.3-.566-.848-.4-3.482,1.281-63.844,39.4-70.506,43.607A3.21,3.21,0,0,1,81.486,130.178Z"/></svg>';
    const webSvg =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';

    for (const ch of embedChannels) {
      if (ch.type !== "telegram" || !ch.url) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sw-fab-satellite sw-fab-telegram";
      btn.title = ch.label || "Telegram";
      btn.setAttribute("aria-label", ch.label || "Telegram");
      btn.innerHTML = tgSvg;
      const url = ch.url.trim();
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openTelegramDeepLink(url);
        closeFabMenu();
      });
      satellitesEl.appendChild(btn);
    }

    const webBtn = document.createElement("button");
    webBtn.type = "button";
    webBtn.className = "sw-fab-satellite sw-fab-web";
    webBtn.id = "sw-open-web-chat";
    webBtn.title = "Чат на сайте";
    webBtn.setAttribute("aria-label", "Чат на сайте");
    webBtn.innerHTML = webSvg;
    webBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      closeFabMenu();
      if (!isOpen) toggle(null);
    });
    satellitesEl.appendChild(webBtn);
  }

  function openFabMenu() {
    if (embedChannels.length === 0) return;
    fabMenuOpen = true;
    renderFabSatellites();
    if (fabStack) fabStack.classList.add("sw-fab-menu-open");
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-expanded", "true");
      toggleBtn.setAttribute("aria-label", "Закрыть меню");
      toggleBtn.classList.add("sw-fab-close-mode");
      const chatIc = toggleBtn.querySelector(".sw-fab-icon-chat");
      const closeIc = toggleBtn.querySelector(".sw-fab-icon-close");
      if (chatIc) chatIc.style.display = "none";
      if (closeIc) closeIc.style.display = "";
    }
    if (satellitesEl) satellitesEl.setAttribute("aria-hidden", "false");
  }

  function launcherClick(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Если чат-виджет уже открыт — та же кнопка должна его закрывать,
    // а не показывать выбор каналов (интуитивный тумблер открыть/закрыть)
    if (isOpen) {
      if (fabMenuOpen) closeFabMenu();
      toggle(e);
      return;
    }
    if (embedChannels.length === 0) {
      toggle(e);
      return;
    }
    if (!fabMenuOpen) {
      openFabMenu();
      return;
    }
    closeFabMenu();
  }

  if (newChatBtn) {
    newChatBtn.addEventListener("click", () => {
      chatId = null;
      messages = [];
      csatState = null;
      csatUi = { score: null, reasons: [], comment: "" };
      csatSubmitted = false;
      hideClosedBanner();
      initChat();
    });
  }

  // MediaRecorder for voice recording
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;

  function normalizeAssetUrl(url) {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("//")) return `${window.location.protocol}${url}`;
    // /uploads/* отдаётся с корня сайта, не под /api (иначе 401 и нет превью медиа)
    let base = apiBaseUrl;
    if (url.startsWith("/uploads")) {
      base = String(base).replace(/\/api\/?$/, "");
    }
    if (url.startsWith("/")) return `${base}${url}`;
    return `${base}/${url}`;
  }

  // Helper to adjust color brightness
  function adjustBrightness(hex, percent) {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + percent));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent));
    return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
  }

  // Helper function to convert hex color to CSS filter
  function hexToFilter(hex) {
    // For white (#FFFFFF) - invert to white
    if (hex === "#FFFFFF" || hex === "#ffffff" || hex === "FFFFFF" || hex === "ffffff") {
      return "brightness(0) saturate(100%) invert(100%)";
    }
    // For gray (#AAAFB9) - approximate filter
    if (hex === "#AAAFB9" || hex === "#aaafb9" || hex === "AAAFB9" || hex === "aaafb9") {
      return "brightness(0) saturate(100%) invert(67%) sepia(2%) saturate(200%) hue-rotate(180deg) brightness(95%) contrast(90%)";
    }
    // For blue (#3F79B9) - approximate filter
    if (hex === "#3F79B9" || hex === "#3f79b9" || hex === "3F79B9" || hex === "3f79b9") {
      return "brightness(0) saturate(100%) invert(25%) sepia(95%) saturate(2000%) hue-rotate(200deg) brightness(95%) contrast(90%)";
    }
    // Default: try to approximate the color
    // This is a simplified approach - for exact colors, we'd need a more complex conversion
    return "brightness(0) saturate(100%) invert(67%) sepia(2%) saturate(200%) hue-rotate(180deg) brightness(95%) contrast(90%)";
  }

  // Apply colors and config
  function applyConfig() {
    const color = config.primaryColor;
    
    // Parse color to get RGB for shadow
    const tempEl = document.createElement("div");
    tempEl.style.color = color;
    document.body.appendChild(tempEl);
    const computedColor = getComputedStyle(tempEl).color;
    document.body.removeChild(tempEl);
    const rgbMatch = computedColor.match(/\d+/g);
    const shadowColor = rgbMatch 
      ? `rgba(${rgbMatch[0]}, ${rgbMatch[1]}, ${rgbMatch[2]}, 0.3)` 
      : "rgba(99, 102, 241, 0.3)"; // RGB для #6366f1
    
    // Set CSS variables
    container.style.setProperty("--sw-primary", color);
    const toggleButtonColor = config.toggleButtonColor || config.primaryColor || "#3F79B9";
    container.style.setProperty("--sw-toggle-button-color", toggleButtonColor);
    container.style.setProperty("--sw-shadow-color", shadowColor);
    
    // Visitor message colors (right side - blue) - FORCE correct values
    container.style.setProperty("--sw-visitor-message-bg", "#3F79B9");
    container.style.setProperty("--sw-visitor-text", "#FFFFFF");
    
    // AI message colors (left side - white) - FORCE correct values
    container.style.setProperty("--sw-ai-message-bg", "#FFFFFF");
    container.style.setProperty("--sw-ai-message-text", "#272727");
    
    // Message font settings
    container.style.setProperty("--sw-message-font-family", config.messageFontFamily || "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif");
    container.style.setProperty("--sw-message-font-size", config.messageFontSize || "12px");
    container.style.setProperty("--sw-message-font-weight", config.messageFontWeight || "600");
    
    // Message time settings
    container.style.setProperty("--sw-message-time-color", config.messageTimeColor || "#AAAFB9");
    container.style.setProperty("--sw-message-time-font-size", config.messageTimeFontSize || "12px");
    container.style.setProperty("--sw-message-time-font-weight", config.messageTimeFontWeight || "500");
    container.style.setProperty("--sw-message-time-font-family", config.messageTimeFontFamily || "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif");
    
    // Escalate button colors
    container.style.setProperty("--sw-escalate-bg", config.escalateButtonColor || "#e5e7eb");
    container.style.setProperty("--sw-escalate-text", config.escalateButtonTextColor || "#374151");
    container.style.setProperty("--sw-escalate-hover-bg", config.escalateButtonColor ? adjustBrightness(config.escalateButtonColor, -10) : "#d1d5db");
    
    // Send button colors
    container.style.setProperty("--sw-send-inactive-bg", config.sendButtonInactiveBg || "#F4F5F6");
    container.style.setProperty("--sw-send-active-bg", config.sendButtonActiveBg || "#3F79B9");
    
    // Header settings
    container.style.setProperty("--sw-header-bg-color", config.headerBackgroundColor || "#3F79B9");
    container.style.setProperty("--sw-header-text-color", config.headerTextColor || "#FFFFFF");
    container.style.setProperty("--sw-header-font-family", config.headerFontFamily || "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif");
    container.style.setProperty("--sw-header-font-size", config.headerFontSize || "14px");
    container.style.setProperty("--sw-header-font-weight", config.headerFontWeight || "600");
    
    // Update header title
    const headerTitle = document.getElementById("sw-header-title");
    if (headerTitle && config.assistantName) {
      headerTitle.textContent = config.assistantName;
    }
    
    // Update header description
    const headerDescription = document.getElementById("sw-header-description");
    if (headerDescription) {
      if (config.assistantDescription) {
        headerDescription.textContent = config.assistantDescription;
        headerDescription.style.display = "block";
      } else {
        headerDescription.style.display = "none";
      }
    }
    
    // Update header avatar
    const headerAvatarContainer = document.getElementById("sw-header-avatar");
    if (headerAvatarContainer && config.avatarUrl) {
      headerAvatarContainer.outerHTML = `<img class="sw-header-avatar" id="sw-header-avatar" src="${config.avatarUrl}" alt="${config.assistantName}" onerror="this.style.display='none'" />`;
    }

    const windowContainer = document.getElementById("sw-window");
    if (windowContainer) {
      // Check if custom background image is set (not null, undefined, empty string, or "null")
      const hasCustomBackground = config.chatBackgroundImage && 
                                  config.chatBackgroundImage !== "null" && 
                                  config.chatBackgroundImage !== "";
      
      if (hasCustomBackground) {
        windowContainer.style.backgroundImage = `url('${normalizeAssetUrl(config.chatBackgroundImage)}')`;
        windowContainer.style.backgroundSize = "cover";
        windowContainer.style.backgroundPosition = "center";
        windowContainer.style.backgroundRepeat = "no-repeat";
      } else {
        // Always use default background image if no custom image
        windowContainer.style.backgroundImage = `url('${DEFAULT_CHAT_BACKGROUND}')`;
        windowContainer.style.backgroundSize = "cover";
        windowContainer.style.backgroundPosition = "center";
        windowContainer.style.backgroundRepeat = "no-repeat";
      }

      // Apply background color if set (will be behind the image)
      // If no color is set, use white as default to ensure readability
      if (config.chatBackgroundColor) {
        windowContainer.style.backgroundColor = config.chatBackgroundColor;
      } else {
        // Use white background by default, but image will show through
        windowContainer.style.backgroundColor = "#ffffff";
      }
    }

    // Update send button icon
    const sendBtn = document.getElementById("sw-send");
    const sendIconSvg = document.getElementById("sw-send-icon-svg");
    const sendIconImg = document.getElementById("sw-send-icon-img");
    if (sendBtn && sendIconSvg && sendIconImg) {
      if (config.sendButtonIconUrl) {
        // Use custom icon if uploaded
        sendIconImg.src = normalizeAssetUrl(config.sendButtonIconUrl, apiBaseUrl);
        sendIconImg.style.display = "block";
        sendIconSvg.style.display = "none";
      } else {
        // Use default icon (custom or fallback SVG)
        sendIconImg.src = DEFAULT_SEND_ICON;
        sendIconImg.style.display = "block";
        sendIconSvg.style.display = "none";
        // If default icon fails to load, fallback to SVG
        sendIconImg.onerror = () => {
          sendIconImg.style.display = "none";
          sendIconSvg.style.display = "block";
          // Update state after fallback
          setTimeout(() => updateSendButtonState(), 0);
        };
      }
      // Update button state after icon is set
      setTimeout(() => updateSendButtonState(), 0);
    }
    
    // Set icon colors CSS variables
    const inactiveColor = config.iconInactiveColor || "#AAAFB9";
    const hoverColor = config.iconHoverColor || "#3F79B9";
    container.style.setProperty("--sw-icon-inactive-color", inactiveColor);
    container.style.setProperty("--sw-icon-hover-color", hoverColor);
    
    // Set icon filters based on colors
    const inactiveFilter = hexToFilter(inactiveColor);
    const hoverFilter = hexToFilter(hoverColor);
    container.style.setProperty("--sw-icon-inactive-filter", inactiveFilter);
    container.style.setProperty("--sw-icon-hover-filter", hoverFilter);
    
    // Update escalate button icon
    const escalateBtnEl = document.getElementById("sw-escalate");
    const escalateIconSvg = document.getElementById("sw-escalate-icon-svg");
    const escalateIconImg = document.getElementById("sw-escalate-icon-img");
    if (escalateBtnEl && escalateIconSvg && escalateIconImg) {
      if (config.escalateIconUrl) {
        escalateIconImg.src = normalizeAssetUrl(config.escalateIconUrl);
        escalateIconImg.style.display = "block";
        escalateIconSvg.style.display = "none";
      } else {
        escalateIconImg.src = DEFAULT_ESCALATE_ICON;
        escalateIconImg.style.display = "block";
        escalateIconSvg.style.display = "none";
      }
      escalateIconImg.onerror = () => {
        escalateIconImg.style.display = "none";
        escalateIconSvg.style.display = "block";
      };
    }
    
    // Update emoji button icon
    const emojiBtnEl = document.getElementById("sw-emoji-btn");
    const emojiIconSvg = document.getElementById("sw-emoji-icon-svg");
    const emojiIconImg = document.getElementById("sw-emoji-icon-img");
    if (emojiBtnEl && emojiIconSvg && emojiIconImg) {
      if (config.emojiIconUrl) {
        emojiIconImg.src = normalizeAssetUrl(config.emojiIconUrl);
        emojiIconImg.style.display = "block";
        emojiIconSvg.style.display = "none";
      } else {
        emojiIconImg.src = DEFAULT_EMOJI_ICON;
        emojiIconImg.style.display = "block";
        emojiIconSvg.style.display = "none";
      }
      emojiIconImg.onerror = () => {
        emojiIconImg.style.display = "none";
        emojiIconSvg.style.display = "block";
      };
    }
    
    // Update attach button icon (SVG по умолчанию — не оставляем пустую кнопку без onerror)
    const attachBtnEl = document.getElementById("sw-attach-btn");
    const attachIconSvg = document.getElementById("sw-attach-icon-svg");
    const attachIconImg = document.getElementById("sw-attach-icon-img");
    if (attachBtnEl && attachIconSvg && attachIconImg) {
      const showAttachSvg = () => {
        attachIconImg.style.display = "none";
        attachIconSvg.style.display = "block";
      };
      const showAttachImg = () => {
        attachIconImg.style.display = "block";
        attachIconSvg.style.display = "none";
      };
      showAttachSvg();
      const attachUrl = config.attachIconUrl ? normalizeAssetUrl(config.attachIconUrl) : DEFAULT_ATTACH_ICON;
      attachIconImg.onload = () => showAttachImg();
      attachIconImg.onerror = () => showAttachSvg();
      attachIconImg.src = attachUrl;
    }
    
    // Update send button state after config is applied
    setTimeout(() => {
      updateSendButtonState();
    }, 0);

    if (messagesEl) {
      messagesEl.style.backgroundImage = "";
      messagesEl.style.backgroundColor = "transparent";
    }
  }

  // Ensure widget starts closed
  if (windowEl) {
    windowEl.classList.remove("open");
    windowEl.style.display = "none";
  }
  if (toggleBtn) {
    toggleBtn.style.display = "flex";
  }
  if (closeBottomBtn) {
    closeBottomBtn.style.display = "none";
  }
  isOpen = false;
  
  // Apply config immediately so button has correct color on load
  applyConfig();
  
  // Set default send icon on initial load
  const sendIconImg = document.getElementById("sw-send-icon-img");
  if (sendIconImg) {
    sendIconImg.src = DEFAULT_SEND_ICON;
    sendIconImg.onerror = () => {
      // Fallback to SVG if default icon doesn't exist
      const sendIconSvg = document.getElementById("sw-send-icon-svg");
      if (sendIconSvg) {
        sendIconImg.style.display = "none";
        sendIconSvg.style.display = "block";
      }
    };
  }
  
  // Initialize send button state after elements are created
  setTimeout(() => {
    updateSendButtonState();
  }, 0);

  async function preloadConfig() {
    try {
      const response = await fetch(`${apiUrl}/widget-chat/config?apiKey=${encodeURIComponent(apiKey)}`);
      if (!response.ok) {
        syncEmbedChannelsFromApi(undefined);
        return;
      }
      const data = await response.json();
      syncEmbedChannelsFromApi(data?.channels);
      if (!data?.config) return;
      config = { ...config, ...data.config };
      const resolvedAvatar = config.avatarUrl || config.avatarUrls?.medium || null;
      config.avatarUrl = normalizeAssetUrl(resolvedAvatar);
      config.chatBackgroundImage = config.chatBackgroundImage ? normalizeAssetUrl(config.chatBackgroundImage) : null;
      if (config.sendButtonIconUrl) {
        config.sendButtonIconUrl = normalizeAssetUrl(config.sendButtonIconUrl);
      }
      if (config.escalateIconUrl) {
        config.escalateIconUrl = normalizeAssetUrl(config.escalateIconUrl);
      }
      if (config.emojiIconUrl) {
        config.emojiIconUrl = normalizeAssetUrl(config.emojiIconUrl);
      }
      if (config.attachIconUrl) {
        config.attachIconUrl = normalizeAssetUrl(config.attachIconUrl);
      }
      container.className = `sw-container ${config.position}`;
      applyConfig();
    } catch (error) {
      console.error("Shumann Widget: Failed to preload config", error);
      syncEmbedChannelsFromApi(undefined);
    }
  }

  preloadConfig();

  // Format time
  function formatTime(date) {
    return new Date(date).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Get avatar HTML for AI/operator messages
  function getAvatarHtml() {
    if (config.avatarUrl) {
      return `<div class="sw-message-avatar"><img src="${config.avatarUrl}" alt="${config.assistantName}" onerror="this.parentElement.innerHTML='<svg viewBox=\\'0 0 24 24\\' width=\\'12\\' height=\\'12\\'><path d=\\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\\' fill=\\'#94a3b8\\'/></svg>'" /></div>`;
    }
    return `<div class="sw-message-avatar-placeholder"><svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="#94a3b8"/></svg></div>`;
  }

  // Render messages with debounce for performance
  let renderTimeout = null;
  let pendingRender = false;
  
  function renderMessages() {
    if (!messagesEl) return;
    
    // Debounce rapid updates to prevent performance issues
    if (renderTimeout) {
      clearTimeout(renderTimeout);
      pendingRender = true;
      renderTimeout = setTimeout(() => {
        pendingRender = false;
        doRenderMessages();
      }, 50);
      return;
    }
    
    doRenderMessages();
  }
  
  function escapeHtmlAttr(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function doRenderMessages() {
    if (!messagesEl) return;
    
    // Use requestAnimationFrame for smooth rendering
    requestAnimationFrame(() => {
      let html = "";
      
      messages.forEach((m, index) => {
      const senderClass = m.sender.toLowerCase();
      const isSystem = senderClass === "system";
      const time = m.createdAt ? formatTime(m.createdAt) : "";
      const showAvatar = (senderClass === "ai" || senderClass === "operator") && !isSystem;
      const isVisitor = senderClass === "visitor" && !isSystem;
      
      // Format date for timestamp
      const messageDate = m.createdAt ? new Date(m.createdAt) : null;
      const dateStr = messageDate ? messageDate.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      }) : "";
      const fullTime = dateStr && time ? `${dateStr} ${time}` : time;
      
      // Show timestamp for each message (centered)
      if (fullTime) {
        html += `<div class="sw-message-time-container"><div class="sw-message-time">${fullTime}</div></div>`;
      }
      
      // System messages - special handling
      if (isSystem) {
        html += `
          <div class="sw-message-container system">
            <div class="sw-message system">
              <div class="sw-message-content">${linkifyText(m.content || "")}</div>
            </div>
          </div>
        `;
        return; // Skip rest of processing for system messages
      }
      
      // Media content
      let mediaHtml = "";
      if (m.imageUrl) {
        const imageUrl = normalizeAssetUrl(m.imageUrl);
        const safeAttr = escapeHtmlAttr(imageUrl);
        mediaHtml += `<div class="sw-message-media"><img class="sw-message-media-img sw-message-media-img--lightbox" src="${safeAttr}" alt="Изображение" data-sw-lightbox-url="${safeAttr}" style="max-width: 100%; border-radius: 8px; margin-bottom: 8px; display: block; cursor: pointer;" /></div>`;
      }
      if (m.audioUrl) {
        const audioUrl = normalizeAssetUrl(m.audioUrl);
        mediaHtml += `<div class="sw-message-media"><audio controls style="max-width: 100%; margin-bottom: 8px; display: block;"><source src="${audioUrl}" type="audio/mpeg" /><source src="${audioUrl}" type="audio/webm" /><source src="${audioUrl}" type="audio/wav" /></audio></div>`;
      }
      
      // Build message container structure matching preview
      // Get colors for this message type - FORCE correct defaults
      // Left (AI): white background, dark text
      // Right (Visitor): blue background, white text
      const messageBg = isVisitor 
        ? "#3F79B9"  // Visitor (right) - BLUE
        : "#FFFFFF"; // AI (left) - WHITE
      const messageText = isVisitor
        ? "#FFFFFF"  // Visitor (right) - WHITE text
        : "#272727"; // AI (left) - DARK text
      
      // Only show content div if there's actual text content or no media
      const hasContent = m.content && m.content.trim().length > 0;
      const hasMedia = m.imageUrl || m.audioUrl || m.videoUrl || m.documentUrl;
      const showContent = hasContent || !hasMedia;
      const editedHint =
        senderClass === "operator" && m.editedAt
          ? `<div class="sw-message-edited" style="font-size:10px;opacity:.6;margin-top:4px;">изменено</div>`
          : "";
      
      if (isVisitor) {
        // Visitor message: content-wrapper left, avatar right
        html += `
          <div class="sw-message-container ${senderClass}">
            <div class="sw-message-row ${senderClass}">
              <div class="sw-message-content-wrapper">
                <div class="sw-message ${senderClass}">
                  ${mediaHtml}
                  ${showContent ? `<div class="sw-message-content" style="background: ${messageBg} !important; color: ${messageText} !important;">${linkifyText(m.content || "")}</div>` : ''}
                </div>
              </div>
              <div class="sw-message-avatar-placeholder">
                <svg viewBox="0 0 24 24" width="12" height="12">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="#94a3b8"/>
                </svg>
              </div>
            </div>
            <div class="sw-message-status">
              <span>Отправлено</span>
              <span class="sw-message-status-dot"></span>
            </div>
          </div>
        `;
      } else {
        // AI/Operator message: avatar left, content-wrapper right
        html += `
          <div class="sw-message-container ${senderClass}">
            <div class="sw-message-row ${senderClass}">
              ${getAvatarHtml()}
              <div class="sw-message-content-wrapper">
                <div class="sw-message ${senderClass}">
                  ${mediaHtml}
                  ${showContent ? `<div class="sw-message-content" style="background: ${messageBg} !important; color: ${messageText} !important;">${linkifyText(m.content || "")}</div>` : ''}
                  ${editedHint}
                </div>
              </div>
            </div>
          </div>
        `;
      }
    });
    
      const csatHtml = buildCsatCardHtml();
      messagesEl.innerHTML = html + csatHtml + `
        <div class="sw-typing-container" id="sw-typing-container">
          <div class="sw-typing-label">${config.assistantName} печатает...</div>
          <div class="sw-typing"><span></span><span></span><span></span></div>
        </div>
      `;

      const taCsat = messagesEl.querySelector("[data-sw-csat-comment]");
      if (taCsat && csatUi.comment) taCsat.value = csatUi.comment;
      
      // Scroll to bottom after a brief delay to ensure DOM is updated
      setTimeout(() => {
        if (messagesEl) {
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      }, 10);

      // Mark messages as read
      markMessagesAsRead();
    });
  }

  // Mark messages as read (send to server)
  function markMessagesAsRead() {
    if (!socket || !chatId) return;
    socket.emit("messages_read", { chatId, visitorId });
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /** Убирает markdown-хвосты и пунктуацию у конца URL (модель часто шлёт `https://x**`). */
  function stripTrailingUrlJunk(url) {
    return String(url).replace(/\*+$/g, "").replace(/[.,;:!?)_\]]+$/g, "");
  }

  function normalizeUrlKey(u) {
    if (!u) return "";
    let x = stripTrailingUrlJunk(u).toLowerCase();
    if (x.endsWith("/")) x = x.slice(0, -1);
    return x;
  }

  function lastUrlInLine(line) {
    const re = /(?:https?:\/\/|tg:\/\/)[^\s<>"']+/gi;
    let m;
    let last = null;
    while ((m = re.exec(line)) !== null) last = m[0];
    return last ? stripTrailingUrlJunk(last) : null;
  }

  /**
   * LLM часто дублирует ссылку отдельной строкой или оборачивает в **…**;
   * тогда linkify даёт кликабельную ссылку и второй раз тот же URL как текст.
   */
  function normalizeWidgetMessageText(raw) {
    if (raw == null) return "";
    let t = String(raw);
    t = t.replace(/\*\*((?:https?:\/\/|tg:\/\/)\S+?)\*\*/gi, "$1");
    t = t.replace(/\*((?:https?:\/\/|tg:\/\/)\S+?)\*/g, "$1");
    for (let pass = 0; pass < 4; pass++) {
      const next = t.replace(/((?:https?:\/\/|tg:\/\/)[^\s<>"']+)(\s+)((?:https?:\/\/|tg:\/\/)[^\s<>"']+)/gi, (full, u1, _sp, u2) =>
        normalizeUrlKey(u1) === normalizeUrlKey(u2) ? u1 : full
      );
      if (next === t) break;
      t = next;
    }
    const lines = t.split(/\r?\n/);
    const out = [];
    let prevLineLastUrlKey = "";
    for (const line of lines) {
      const trimmed = line.trim();
      const only = trimmed.match(/^((?:https?:\/\/|tg:\/\/)[^\s<>"']+)(\*+)?$/i);
      if (only && prevLineLastUrlKey && normalizeUrlKey(only[1]) === prevLineLastUrlKey) {
        continue;
      }
      out.push(line);
      const last = lastUrlInLine(line);
      prevLineLastUrlKey = last ? normalizeUrlKey(last) : "";
    }
    // Убираем ведущие/хвостовые пустые строки и схлопываем 3+ переносов в 2,
    // иначе модель, прислав "\n\n..." в начале, создаёт пустоту над текстом в пузыре.
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function linkifyText(text) {
    // split() с захватывающей группой: чётные индексы — текст, нечётные — URL (без повторного вывода URL).
    const t = normalizeWidgetMessageText(text);
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|tg:\/\/[^\s]+)/gi;
    const parts = t.split(urlRegex);
    let result = "";
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        result += escapeHtml(parts[i] || "").replace(/\r?\n/g, "<br>");
      } else {
        const url = stripTrailingUrlJunk(parts[i]);
        let href;
        if (/^tg:\/\//i.test(url)) {
          href = url;
        } else if (/^https?:\/\//i.test(url)) {
          // t.me → tg://, чтобы открывалось приложение, а не веб
          href = isTelegramChannelUrl(url) ? toTelegramAppDeepLink(url) : url;
        } else {
          href = `https://${url}`;
        }
        const safeHref = href.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const isDeepTg = /^tg:\/\//i.test(href);
        // tg:// надёжнее без target=_blank (как openTelegramDeepLink)
        const targetAttr = isDeepTg ? "" : ' target="_blank"';
        result += `<a href="${safeHref}"${targetAttr} rel="noopener noreferrer" style="color: inherit; text-decoration: underline; word-break: break-all;">${escapeHtml(url)}</a>`;
      }
    }
    return result;
  }

  // Initialize chat
  async function initChat() {
    try {
      const response = await fetch(`${apiUrl}/widget-chat/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, visitorId }),
      });

      if (!response.ok) {
        throw new Error("Failed to init chat");
      }

      const data = await response.json();
      chatId = data.chatId;
      messages = data.messages || [];
      csatState = data.csat != null ? data.csat : null;
      csatUi = { score: null, reasons: [], comment: "" };
      csatSubmitted = false;
      syncEmbedChannelsFromApi(data.channels);
      config = { 
        ...config, 
        ...data.config,
        // FORCE correct colors - ignore database values
        visitorMessageColor: "#3F79B9", // Right side - BLUE
        visitorTextColor: "#FFFFFF", // Right side - WHITE text
        aiMessageColor: "#FFFFFF", // Left side - WHITE
        aiTextColor: "#272727", // Left side - DARK text
        messageTimeColor: data.config?.messageTimeColor || "#AAAFB9",
        messageTimeFontSize: data.config?.messageTimeFontSize || "12px",
        messageTimeFontWeight: data.config?.messageTimeFontWeight || "500",
        messageTimeFontFamily: data.config?.messageTimeFontFamily || "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        messageFontFamily: data.config?.messageFontFamily || "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        messageFontSize: data.config?.messageFontSize || "12px",
        messageFontWeight: data.config?.messageFontWeight || "600",
        escalateButtonColor: data.config?.escalateButtonColor || "#e5e7eb",
        escalateButtonTextColor: data.config?.escalateButtonTextColor || "#374151",
        sendButtonIconUrl: data.config?.sendButtonIconUrl || null,
        sendButtonInactiveBg: data.config?.sendButtonInactiveBg || "#F4F5F6",
        sendButtonActiveBg: data.config?.sendButtonActiveBg || "#3F79B9",
        sendButtonInactiveIcon: data.config?.sendButtonInactiveIcon || "#AAAFB9",
        sendButtonActiveIcon: data.config?.sendButtonActiveIcon || "#FFFFFF",
        escalateIconUrl: data.config?.escalateIconUrl || null,
        emojiIconUrl: data.config?.emojiIconUrl || null,
        attachIconUrl: data.config?.attachIconUrl || null,
        iconInactiveColor: data.config?.iconInactiveColor || "#AAAFB9",
        iconHoverColor: data.config?.iconHoverColor || "#3F79B9",
        headerBackgroundColor: data.config?.headerBackgroundColor || "#3F79B9",
        headerTextColor: data.config?.headerTextColor || "#FFFFFF",
        headerFontFamily: data.config?.headerFontFamily || "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        headerFontSize: data.config?.headerFontSize || "14px",
        headerFontWeight: data.config?.headerFontWeight || "600",
      };
      const resolvedAvatar = config.avatarUrl || config.avatarUrls?.medium || null;
      config.avatarUrl = normalizeAssetUrl(resolvedAvatar);
      config.chatBackgroundImage = config.chatBackgroundImage ? normalizeAssetUrl(config.chatBackgroundImage) : null;
      if (config.sendButtonIconUrl) {
        config.sendButtonIconUrl = normalizeAssetUrl(config.sendButtonIconUrl);
      }
      if (config.escalateIconUrl) {
        config.escalateIconUrl = normalizeAssetUrl(config.escalateIconUrl);
      }
      if (config.emojiIconUrl) {
        config.emojiIconUrl = normalizeAssetUrl(config.emojiIconUrl);
      }
      if (config.attachIconUrl) {
        config.attachIconUrl = normalizeAssetUrl(config.attachIconUrl);
      }

      container.className = `sw-container ${config.position}`;
      applyConfig();
      hideClosedBanner();
      renderMessages();

      // Connect WebSocket after chatId is set
      connectSocket();
      
      // If socket already exists and connected, join chat room immediately
      if (socket && socket.connected && chatId) {
        console.log("Shumann Widget: Socket already connected, joining chat", chatId);
        socket.emit("join_chat", { chatId, visitorId, apiKey });
      }
    } catch (error) {
      console.error("Shumann Widget: Failed to initialize", error);
    }
  }

  // Connect WebSocket
  function connectSocket() {
    return; // Preview never connects Socket.IO or loads its CDN.

    if (socket && socket.connected) {
      // Socket already exists and connected, just join chat if chatId is available
      if (chatId) {
        console.log("Shumann Widget: Socket already connected, joining chat", chatId);
        socket.emit("join_chat", { chatId, visitorId, apiKey });
      }
      return;
    }
    
    if (socket) return; // Socket exists but not connected, wait for connection

    // Load Socket.IO via script tag to avoid Vite URL transformation issues
    const script = document.createElement("script");
    script.src = "https://cdn.socket.io/4.7.5/socket.io.min.js";
    script.onload = () => {
      socket = window.io(wsUrl, {
        path: "/socket.io",
        transports: ["websocket", "polling"],
      });

      socket.on("connect", () => {
        if (chatId) {
          console.log("Shumann Widget: Connected, joining chat", chatId);
          socket.emit("join_chat", { chatId, visitorId, apiKey });
        } else {
          console.warn("Shumann Widget: Connected but chatId is not set yet");
        }
      });

      socket.on("message", (data) => {
        console.log("Shumann Widget: Received message via socket", { chatId: data.chatId, currentChatId: chatId, message: data.message });
        if (data.chatId === chatId && data.message) {
          // Skip own VISITOR messages (already added via HTTP response)
          if (data.message.sender === "VISITOR") {
            return;
          }
          // Avoid duplicates
          if (!messages.find((m) => m.id === data.message.id)) {
            console.log("Shumann Widget: Adding message to chat", data.message);
            messages.push(data.message);
            renderMessages();
          } else {
            console.log("Shumann Widget: Message already exists, skipping", data.message.id);
          }
        } else {
          console.log("Shumann Widget: Message chatId mismatch or no message", { receivedChatId: data.chatId, currentChatId: chatId });
        }
      });

      socket.on("message_updated", (data) => {
        if (data.chatId !== chatId || !data.message?.id) return;
        const i = messages.findIndex((m) => m.id === data.message.id);
        if (i === -1) return;
        messages[i] = { ...messages[i], ...data.message };
        renderMessages();
      });

      socket.on("operator_joined", (data) => {
        escalateBtn.style.display = "none";
      });

      socket.on("escalated", (data) => {
        if (data.chatId === chatId) {
          escalateBtn.style.display = "none";
        }
      });

      socket.on("chat_closed", (data) => {
        if (data.chatId === chatId) {
          showClosedBanner();
        }
      });

      socket.on("csat_ready", (data) => {
        if (data.chatId !== chatId) return;
        csatState = {
          id: data.surveyId,
          status: "READY",
          negativeReasons: CSAT_REASON_OPTIONS,
          questionMain: "Насколько вам помог этот ответ?",
          questionLowFollowup: "Что пошло не так?",
          questionHighFollowup: "Что было полезно?",
        };
        csatUi = { score: null, reasons: [], comment: "" };
        csatSubmitted = false;
        renderMessages();
      });

      socket.on("typing", (data) => {
        // Only show for operator/AI typing, not our own
        if (data.sender !== "VISITOR") {
          document.getElementById("sw-typing-container")?.classList.add("show");
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      });

      socket.on("stop_typing", (data) => {
        if (data.sender !== "VISITOR") {
          document.getElementById("sw-typing-container")?.classList.remove("show");
        }
      });
    };
    document.head.appendChild(script);
  }

  // Upload media file
  async function uploadMedia(file) {
    if (!chatId || !file) return null;

    const formData = new FormData();
    formData.append("media", file);

    try {
      const response = await fetch(`${apiUrl}/widget-chat/${chatId}/upload-media`, {
        method: "POST",
        headers: {
          "X-Widget-Api-Key": apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload media");
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error("Shumann Widget: Failed to upload media", error);
      return null;
    }
  }

  // Transcribe audio
  async function transcribeAudio(audioUrl) {
    if (!chatId || !audioUrl) return null;

    try {
      const response = await fetch(`${apiUrl}/widget-chat/${chatId}/transcribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Widget-Api-Key": apiKey,
        },
        body: JSON.stringify({ audioUrl }),
      });

      if (!response.ok) {
        throw new Error("Failed to transcribe audio");
      }

      const data = await response.json();
      return data.transcript;
    } catch (error) {
      console.error("Shumann Widget: Failed to transcribe audio", error);
      return null;
    }
  }

  // Send message
  // Flag to prevent multiple simultaneous sends
  let isSending = false;
  
  async function sendMessage(contentOverride = null, audioUrl = null, imageUrl = null) {
    if(!inputEl.value.trim()&&!contentOverride)return;
    let notice=document.getElementById('sw-preview-notice');
    if(!notice){notice=document.createElement('p');notice.id='sw-preview-notice';notice.setAttribute('role','status');notice.style.cssText='padding:16px;font-size:14px;color:#272727';document.getElementById('sw-messages').append(notice);}
    notice.textContent='Демонстрационный режим. Сообщение не отправлено.';
    return;

    // Prevent multiple simultaneous sends
    if (isSending) {
      console.log("Shumann Widget: Message already sending, please wait");
      return;
    }
    
    const content = contentOverride || inputEl.value.trim();
    const hasContent = content && content.length > 0;
    const hasMedia = audioUrl || imageUrl;

    if ((!hasContent && !hasMedia) || !chatId) {
      console.log("Shumann Widget: Cannot send - no content/media or no chatId");
      return;
    }

    isSending = true;
    inputEl.value = "";
    adjustInputHeight();
    updateSendButtonState();
    
    // Disable send button while sending
    sendBtn.disabled = true;

    // Stop typing indicator
    clearTimeout(typingTimeout);
    if (isTyping) {
      isTyping = false;
      socket?.emit("stop_typing", { chatId, sender: "VISITOR" });
    }

    // Optimistically add message
    const tempId = "temp_" + Date.now();
    messages.push({ 
      id: tempId, 
      sender: "VISITOR", 
      content: content || null, // Don't add placeholder text for media-only messages
      audioUrl: audioUrl || null,
      imageUrl: imageUrl || null,
    });
    renderMessages();

    try {
      const response = await fetch(`${apiUrl}/widget-chat/${chatId}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Widget-Api-Key": apiKey,
        },
        body: JSON.stringify({ 
          content: hasContent ? content : null,
          audioUrl: audioUrl || null,
          imageUrl: imageUrl || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();

      // Replace temp message with real one
      const idx = messages.findIndex((m) => m.id === tempId);
      if (idx !== -1 && data.visitorMessage) {
        messages[idx] = data.visitorMessage;
      }

      // Add AI response if present (avoid duplicates from socket)
      if (data.aiMessage && !messages.find((m) => m.id === data.aiMessage.id)) {
        messages.push(data.aiMessage);
      }

      renderMessages();
    } catch (error) {
      console.error("Shumann Widget: Failed to send message", error);
      // Remove temp message on error
      messages = messages.filter((m) => m.id !== tempId);
      renderMessages();
      // Show error feedback to user
      if (inputEl) {
        inputEl.value = content; // Restore message on error
        adjustInputHeight();
      }
    } finally {
      isSending = false;
      updateSendButtonState();
      sendBtn.disabled = false;
    }
  }

  // Flag to prevent multiple simultaneous escalations
  let isEscalating = false;
  
  // Escalate to operator
  async function escalate() {
    return; // Preview never contacts an operator.

    if (!chatId || isEscalating) {
      console.log("Shumann Widget: Cannot escalate - no chatId or already escalating");
      return;
    }

    isEscalating = true;
    
    // Visual feedback
    const originalText = escalateBtn.textContent;
    escalateBtn.style.opacity = "0.6";
    escalateBtn.disabled = true;
    escalateBtn.style.pointerEvents = "none";

    try {
      const response = await fetch(`${apiUrl}/widget-chat/${chatId}/escalate`, {
        method: "POST",
        headers: { "X-Widget-Api-Key": apiKey },
      });
      
      if (!response.ok) {
        throw new Error("Failed to escalate");
      }
      
      // Show success message in chat
      messages.push({
        id: "escalate_" + Date.now(),
        sender: "SYSTEM",
        content: "Запрос на подключение оператора отправлен",
        createdAt: new Date().toISOString(),
      });
      renderMessages();
      
      // Hide button after successful escalation
      escalateBtn.style.display = "none";
    } catch (error) {
      console.error("Shumann Widget: Failed to escalate", error);
      // Restore button on error
      escalateBtn.style.opacity = "1";
      escalateBtn.disabled = false;
      escalateBtn.style.pointerEvents = "auto";
      
      // Show error message in chat
      messages.push({
        id: "escalate_error_" + Date.now(),
        sender: "SYSTEM",
        content: "Не удалось отправить запрос оператору. Попробуйте еще раз.",
        createdAt: new Date().toISOString(),
      });
      renderMessages();
    } finally {
      isEscalating = false;
    }
  }

  // Toggle window
  function toggle(e) {
    // Prevent event bubbling
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    const wasOpen = isOpen;
    isOpen = !isOpen;

    if (isOpen) closeFabMenu();

    console.log("Shumann Widget: Toggle called, wasOpen:", wasOpen, "isOpen:", isOpen);
    
    // Ensure windowEl exists
    if (!windowEl) {
      console.error("Shumann Widget: windowEl not found");
      return;
    }
    
    // Explicitly set open/closed state
    if (isOpen) {
      windowEl.classList.add("open");
      windowEl.style.display = "flex";
      windowEl.style.visibility = "visible";
      windowEl.style.opacity = "1";
      container.classList.add("sw-widget-open");
    } else {
      windowEl.classList.remove("open");
      windowEl.style.display = "none";
      windowEl.style.visibility = "hidden";
      windowEl.style.opacity = "0";
      container.classList.remove("sw-widget-open");
    }
    
    if (closeBottomBtn) {
      closeBottomBtn.style.display = isOpen ? "flex" : "none";
    }
    if (toggleBtn) {
      toggleBtn.style.display = isOpen ? "none" : "flex";
      // Also hide with CSS class for mobile
      if (isOpen) {
        toggleBtn.classList.add("sw-button-hidden");
      } else {
        toggleBtn.classList.remove("sw-button-hidden");
      }
    }
    
    // Prevent body scroll on mobile when widget is open
    const isMobile = window.innerWidth <= 480;
    if (isMobile) {
      if (isOpen) {
        // Save current scroll position
        const scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        document.body.classList.add('sw-widget-open');
      } else {
        // Restore scroll position
        const scrollY = document.body.style.top;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.classList.remove('sw-widget-open');
        if (scrollY) {
          window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }
      }
    }
    
    // Stop recording if window is closed
    if (!isOpen && isRecording) {
      stopRecording();
    }
    
    // Close menus when toggling
    if (emojiPicker) emojiPicker.classList.remove("show");
    if (attachMenu) attachMenu.classList.remove("show");
    
    if (isOpen && !chatId) {
      initChat();
    }
    if (isOpen) {
      inputEl.focus();
    }
  }

  // Typing indicator
  let typingTimeout = null;
  let isTyping = false;

  function emitTyping() {
    if (!socket || !chatId) return;
    if (!isTyping) {
      isTyping = true;
      socket.emit("typing", { chatId, sender: "VISITOR" });
    }
    // Reset timeout
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isTyping = false;
      socket.emit("stop_typing", { chatId, sender: "VISITOR" });
    }, 2000);
  }

  // Handle media upload
  async function handleMediaUpload(files) {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith("image/");
      const isAudio = file.type.startsWith("audio/") || file.name.endsWith(".webm");

      if (!isImage && !isAudio) {
        alert("Поддерживаются только изображения и аудио файлы");
        continue;
      }

      // Show loading indicator
      const tempId = "upload_" + Date.now();
      messages.push({ 
        id: tempId, 
        sender: "VISITOR", 
        content: isAudio ? "🎤 Загрузка аудио..." : "📷 Загрузка изображения...",
      });
      renderMessages();

      try {
        // Upload file
        const url = await uploadMedia(file);
        if (!url) {
          throw new Error("Ошибка загрузки файла");
        }

        // Remove loading message
        messages = messages.filter(m => m.id !== tempId);
        renderMessages();

        // If audio, transcribe it
        if (isAudio) {
          const transcript = await transcribeAudio(url);
          if (transcript) {
            await sendMessage(transcript, url, null);
          } else {
            await sendMessage(null, url, null);
          }
        } else {
          await sendMessage(null, null, url);
        }
      } catch (error) {
        console.error("Shumann Widget: Failed to upload media", error);
        // Remove loading message
        messages = messages.filter(m => m.id !== tempId);
        renderMessages();
        alert("Ошибка загрузки файла");
      }
    }
  }

  // Popular emojis for picker
  const popularEmojis = [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣",
    "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰",
    "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜",
    "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏",
    "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣",
    "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠",
    "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "👏",
    "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💪", "🦾",
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
    "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘",
  ];

  // Initialize emoji picker
  if (emojiGrid) {
    popularEmojis.forEach(emoji => {
      const emojiItem = document.createElement("div");
      emojiItem.className = "sw-emoji-item";
      emojiItem.textContent = emoji;
      emojiItem.addEventListener("click", () => {
        const cursorPos = inputEl.selectionStart || inputEl.value.length;
        const textBefore = inputEl.value.substring(0, cursorPos);
        const textAfter = inputEl.value.substring(cursorPos);
        inputEl.value = textBefore + emoji + textAfter;
        inputEl.focus();
        inputEl.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
        adjustInputHeight();
        updateSendButtonState();
        emitTyping();
        if (emojiPicker) emojiPicker.classList.remove("show");
      });
      emojiGrid.appendChild(emojiItem);
    });
  }

  // Emoji button - toggle picker
  if (emojiBtn && emojiPicker) {
    emojiBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isShowing = emojiPicker.classList.contains("show");
      if (isShowing) {
        emojiPicker.classList.remove("show");
      } else {
        if (attachMenu) attachMenu.classList.remove("show");
        emojiPicker.classList.add("show");
      }
    });
  }

  // Close emoji picker when clicking outside
  document.addEventListener("click", (e) => {
    if (emojiPicker && !emojiPicker.contains(e.target) && emojiBtn && !emojiBtn.contains(e.target)) {
      emojiPicker.classList.remove("show");
    }
    if (attachMenu && !attachMenu.contains(e.target) && attachBtn && !attachBtn.contains(e.target)) {
      attachMenu.classList.remove("show");
    }
  });

  // Attach button - show menu
  if (attachBtn && attachMenu) {
    attachBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isShowing = attachMenu.classList.contains("show");
      if (isShowing) {
        attachMenu.classList.remove("show");
      } else {
        if (emojiPicker) emojiPicker.classList.remove("show");
        attachMenu.classList.add("show");
      }
    });
  }

  // Attach image
  if (attachImageBtn && mediaInput) {
    attachImageBtn.addEventListener("click", () => {
      if (attachMenu) attachMenu.classList.remove("show");
      mediaInput.click();
    });

    mediaInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleMediaUpload(e.target.files);
        e.target.value = ""; // Reset input
      }
    });
  }

  // Audio file input is no longer used - only recording is available

  // Record audio
  if (recordAudioBtn) {
    recordAudioBtn.addEventListener("click", async () => {
      if (attachMenu) attachMenu.classList.remove("show");
      if (!isRecording) {
        await startRecording();
      } else {
        stopRecording();
      }
    });
  }

  // Stop recording button
  if (stopRecordingBtn) {
    stopRecordingBtn.addEventListener("click", () => {
      stopRecording();
    });
  }

  // Start recording audio
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        const audioFile = new File([audioBlob], "recording.webm", { type: "audio/webm" });
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Upload and send audio
        await handleMediaUpload([audioFile]);
        
        isRecording = false;
        if (recordingIndicator) {
          recordingIndicator.classList.remove("active");
        }
      };

      mediaRecorder.start();
      isRecording = true;
      if (recordingIndicator) {
        recordingIndicator.classList.add("active");
      }
    } catch (error) {
      console.error("Shumann Widget: Failed to start recording", error);
      alert("Не удалось начать запись. Проверьте разрешения микрофона.");
    }
  }

  // Stop recording audio
  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
    }
  }

  // Helper function to handle both click and touch events for mobile
  function addMobileEventListener(element, eventType, handler) {
    if (!element) return;
    
    let touchStartTime = 0;
    let touchStartY = 0;
    
    // Handle touch events for mobile
    element.addEventListener("touchstart", (e) => {
      touchStartTime = Date.now();
      touchStartY = e.touches[0].clientY;
      // Prevent default to avoid double-tap zoom and other issues
      e.preventDefault();
    }, { passive: false });
    
    element.addEventListener("touchend", (e) => {
      const touchEndTime = Date.now();
      const touchEndY = e.changedTouches[0].clientY;
      const timeDiff = touchEndTime - touchStartTime;
      const yDiff = Math.abs(touchEndY - touchStartY);
      
      // Only trigger if it was a quick tap (not a scroll) and within reasonable distance
      if (timeDiff < 300 && yDiff < 10) {
        e.preventDefault();
        e.stopPropagation();
        handler(e);
      }
    }, { passive: false });
    
    // Handle click events for desktop
    element.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handler(e);
    });
  }
  
  // Debounce function to prevent multiple rapid clicks
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  // Throttle function for rapid events
  function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  // Event listeners with mobile support
  addMobileEventListener(toggleBtn, "click", launcherClick);
  addMobileEventListener(closeBtn, "click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Shumann Widget: Close button clicked, isOpen:", isOpen);
    toggle(e);
  });

  document.addEventListener("click", (e) => {
    if (!fabMenuOpen || embedChannels.length === 0) return;
    if (!fabStack || fabStack.contains(e.target)) return;
    closeFabMenu();
  });
  
  if (closeBottomBtn) {
    addMobileEventListener(closeBottomBtn, "click", toggle);
  }
  
  // Send button handler - immediate response for better UX
  function handleSendClick(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (sendBtn.disabled || isSending) {
      return;
    }
    
    // Visual feedback
    sendBtn.style.opacity = "0.7";
    
    // Send immediately (no debounce for better responsiveness)
    sendMessage().finally(() => {
      sendBtn.style.opacity = "1";
    });
  }
  
  addMobileEventListener(sendBtn, "click", handleSendClick);
  
  // Escalate button handler - immediate response
  function handleEscalateClick(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (isEscalating) {
      return;
    }
    
    escalate();
  }
  
  addMobileEventListener(escalateBtn, "click", handleEscalateClick);

  // Update send button state based on input
  function updateSendButtonState() {
    const hasText = inputEl.value.trim().length > 0;
    const sendIconSvg = document.getElementById("sw-send-icon-svg");
    const sendIconImg = document.getElementById("sw-send-icon-img");
    const inputWrapper = inputEl.closest('.sw-input-wrapper');
    
    if (hasText) {
      sendBtn.classList.add("active");
      sendBtn.disabled = false;
      if (inputWrapper) {
        inputWrapper.classList.add("has-text");
      }
      // Update icon color for active state using config
      const activeIconColor = config.sendButtonActiveIcon || "#FFFFFF";
      const activeFilter = hexToFilter(activeIconColor);
      if (sendIconSvg && sendIconSvg.style.display !== "none") {
        sendIconSvg.style.filter = activeFilter;
      }
      if (sendIconImg && sendIconImg.style.display !== "none") {
        sendIconImg.style.filter = activeFilter;
      }
    } else {
      sendBtn.classList.remove("active");
      sendBtn.disabled = true;
      if (inputWrapper) {
        inputWrapper.classList.remove("has-text");
      }
      // Update icon color for inactive state using config
      const inactiveIconColor = config.sendButtonInactiveIcon || "#AAAFB9";
      const inactiveFilter = hexToFilter(inactiveIconColor);
      if (sendIconSvg && sendIconSvg.style.display !== "none") {
        sendIconSvg.style.filter = inactiveFilter;
      }
      if (sendIconImg && sendIconImg.style.display !== "none") {
        sendIconImg.style.filter = inactiveFilter;
      }
    }
  }

  /** Автовысота композера: растёт до ~4 строк, дальше вертикальный скролл. */
  function adjustInputHeight() {
    if (!inputEl) return;
    const cs = window.getComputedStyle(inputEl);
    const maxH = parseFloat(cs.maxHeight) || 84;
    const minH = parseFloat(cs.minHeight) || 40;
    inputEl.style.height = "auto";
    const next = Math.min(Math.max(inputEl.scrollHeight, minH), maxH);
    inputEl.style.height = `${next}px`;
    inputEl.style.overflowY = inputEl.scrollHeight > maxH + 1 ? "auto" : "hidden";
  }

  // Enter — отправить, Shift+Enter — новая строка
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if (!isSending && !sendBtn.disabled) {
        sendMessage();
      }
    }
  });
  inputEl.addEventListener("input", () => {
    adjustInputHeight();
    updateSendButtonState();
    emitTyping();
  });
  
  // Initialize send button state
  adjustInputHeight();
  updateSendButtonState();

  // Handle window resize (e.g., device rotation)
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const isMobile = window.innerWidth <= 480;
      // Update body scroll lock if widget is open
      if (isOpen && isMobile) {
        const scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        document.body.classList.add('sw-widget-open');
      } else if (!isMobile) {
        // Remove scroll lock on desktop
        const scrollY = document.body.style.top;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.classList.remove('sw-widget-open');
        if (scrollY) {
          window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }
      }
    }, 100);
  });

  // Handle Visual Viewport API for better keyboard handling on mobile
  // This ensures input field stays visible when keyboard opens
  function setupKeyboardHandling() {
    if (!window.visualViewport || window.innerWidth > 480) return;
    
    function handleViewportResize() {
      if (!isOpen || !windowEl) return;
      
      const viewport = window.visualViewport;
      const viewportHeight = viewport.height;
      const windowHeight = window.innerHeight;
      
      // If keyboard is open (viewport height is significantly less than window height)
      if (viewportHeight < windowHeight * 0.75) {
        // Adjust window height to visual viewport height
        windowEl.style.height = `${viewportHeight}px`;
        windowEl.style.maxHeight = `${viewportHeight}px`;
        
        // Ensure input container is visible
        const inputContainer = document.querySelector('.sw-input-container');
        if (inputContainer) {
          inputContainer.style.position = 'sticky';
          inputContainer.style.bottom = '0';
        }
        
        // Scroll messages to show input area
        const messagesEl = document.querySelector('.sw-messages');
        if (messagesEl) {
          setTimeout(() => {
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }, 100);
        }
      } else {
        // Keyboard is closed, restore full height
        windowEl.style.height = '100dvh';
        windowEl.style.maxHeight = '100dvh';
      }
    }
    
    // Debounce viewport resize handler
    let viewportResizeTimeout;
    const debouncedHandleViewportResize = () => {
      clearTimeout(viewportResizeTimeout);
      viewportResizeTimeout = setTimeout(handleViewportResize, 50);
    };
    
    window.visualViewport.addEventListener('resize', debouncedHandleViewportResize);
    window.visualViewport.addEventListener('scroll', debouncedHandleViewportResize);
    
    // Also handle input focus to ensure it's visible
    if (inputEl) {
      inputEl.addEventListener('focus', () => {
        setTimeout(() => {
          handleViewportResize();
          // Scroll input container into view
          const inputContainer = document.querySelector('.sw-input-container');
          if (inputContainer) {
            inputContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
        }, 300);
      });
      
      // Also handle when input loses focus
      inputEl.addEventListener('blur', () => {
        setTimeout(() => {
          if (windowEl) {
            windowEl.style.height = '100dvh';
            windowEl.style.maxHeight = '100dvh';
          }
        }, 200);
      });
    }
  }
  
  // Setup keyboard handling after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupKeyboardHandling);
  } else {
    setupKeyboardHandling();
  }

  // Preview disables uploading/recording/escalation; text is kept only in the input.
  for(const id of ['sw-attach-btn','sw-escalate']){const button=document.getElementById(id);if(button){button.disabled=true;button.title='Недоступно в демонстрационном режиме';}}
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&isOpen)toggle();});
  document.getElementById('sw-close')?.setAttribute('aria-label','Закрыть чат');
  // Expose API
  window.ShumannWidget = {
    open: () => {
      if (!isOpen) toggle();
    },
    close: () => {
      if (isOpen) toggle();
    },
  };
})();

