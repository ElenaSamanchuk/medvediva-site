// Аналитика как на Тильде (выгрузка 14.10.2026), только на боевом домене — не на превью и не локально (Елена 15.10.2026).
// Яндекс Метрика 91164461 — счётчик из настроек Тильды (старт через 2 с, вебвизор);
// Яндекс Метрика 96364189 — код в head страниц; пиксель Meta 2487307824736433 — PageView.
// Зеркало medvediva.kg — только Метрика 96364189, как на Тильде .kg (19.10.2026).
import { SITE } from './site.mjs';

export const ANALYTICS_HOSTS = SITE.hosts;

export function analyticsAllowed(hostname) {
  return ANALYTICS_HOSTS.includes(String(hostname || '').toLowerCase());
}

function loadScript(src) {
  if ([...document.scripts].some(s => s.src === src)) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.append(s);
}

export function initAnalytics(win = window) {
  if (!analyticsAllowed(win.location.hostname) || win.__medvedivaAnalytics) return false;
  win.__medvedivaAnalytics = true;
  // Яндекс Метрика
  win.ym = win.ym || function () { (win.ym.a = win.ym.a || []).push(arguments); };
  win.ym.l = 1 * new Date();
  loadScript('https://mc.yandex.ru/metrika/tag.js');
  win.ym(96364189, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true });
  if (SITE.id === 'kg') return true;
  setTimeout(() => {
    win.mainMetrikaId = '91164461';
    win.ym(91164461, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true, ecommerce: 'dataLayer' });
  }, 2000);
  // Пиксель Meta
  if (!win.fbq) {
    const n = win.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!win._fbq) win._fbq = n;
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    loadScript('https://connect.facebook.net/en_US/fbevents.js');
  }
  win.fbq('init', '2487307824736433');
  win.fbq('track', 'PageView');
  return true;
}
