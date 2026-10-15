// Плавная прокрутка страницы колесом мыши на десктопе (Елена 15.10.2026).
// Тачпад и телефон не трогаем — у них своя плавная прокрутка; мелкие шаги колеса (тачпад) пропускаем.
// Не мешаем: зуму (Ctrl), горизонтальной прокрутке, попапам/меню, лентам и любым блокам со своей прокруткой.
const SKIP = '.native-modal,.native-menu,.scene-canvas--scrollable,textarea,select,[data-scroll-native]';

function scrollsItself(target, dy) {
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
    if (el.matches?.(SKIP)) return true;
    const style = getComputedStyle(el);
    if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1) {
      if ((dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) || (dy < 0 && el.scrollTop > 0)) return true;
    }
  }
  return false;
}

export function initSmoothScroll(win = window) {
  if (win.matchMedia('(prefers-reduced-motion: reduce)').matches || !win.matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};
  const root = document.scrollingElement || document.documentElement;
  let target = root.scrollTop, pos = target, frame = 0;
  const max = () => root.scrollHeight - root.clientHeight;
  const step = () => {
    const diff = target - pos;
    if (Math.abs(diff) < 0.5) { root.scrollTop = pos = target; frame = 0; return; }
    pos += diff * 0.14;
    root.scrollTop = pos;
    frame = requestAnimationFrame(step);
  };
  // Любая другая прокрутка (клавиши, якоря, тачпад, полоса) — останавливаем анимацию, чтобы не спорить с ней
  const stop = () => { if (frame) { cancelAnimationFrame(frame); frame = 0; } };
  const onWheel = e => {
    if (e.defaultPrevented || e.ctrlKey || e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (document.body.style.overflow === 'hidden') return;
    const px = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * root.clientHeight : e.deltaY;
    if (e.deltaMode === 0 && Math.abs(px) < 40) { stop(); return; } // тачпад
    if (scrollsItself(e.target, px)) { stop(); return; }
    e.preventDefault();
    if (!frame) target = pos = root.scrollTop;
    target = Math.max(0, Math.min(max(), target + px));
    if (!frame) frame = requestAnimationFrame(step);
  };
  const onKey = () => stop();
  win.addEventListener('wheel', onWheel, { passive: false });
  win.addEventListener('keydown', onKey);
  win.addEventListener('mousedown', onKey);
  win.addEventListener('medvediva:anchor', stop);
  return () => { stop(); win.removeEventListener('wheel', onWheel); win.removeEventListener('keydown', onKey); win.removeEventListener('mousedown', onKey); win.removeEventListener('medvediva:anchor', stop); };
}
