// Картинки, которые ещё грузятся, появляются плавно, а не «выскакивают» (Елена 15.10.2026).
// Уже загруженные (в кеше, предзагруженные) не трогаем — им не нужна задержка.
// Фон-картинку проявляем только у атомов без своего цвета фона, чтобы не мигала заливка.
const URL_RE=/url\(["']?([^"')]+)["']?\)/;
export function fadeInImages(root){
 if(!root||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const reveal=el=>{el.classList.remove('img-fade');};
 for(const img of root.querySelectorAll('img')){
  if(img.complete&&img.naturalWidth)continue;
  img.classList.add('img-fade');
  img.addEventListener('load',()=>reveal(img),{once:true});img.addEventListener('error',()=>reveal(img),{once:true});
 }
 for(const atom of root.querySelectorAll('.scene-atom[style*="url("]')){
  const style=getComputedStyle(atom);const m=style.backgroundImage.match(URL_RE);
  if(!m||!/(rgba\(0, 0, 0, 0\)|transparent)/.test(style.backgroundColor))continue;
  const probe=new Image();probe.src=m[1];
  if(probe.complete&&probe.naturalWidth)continue;
  atom.classList.add('img-fade');
  const done=()=>reveal(atom);probe.addEventListener('load',done,{once:true});probe.addEventListener('error',done,{once:true});setTimeout(done,8000);
 }
}

// Фоновая докачка: после загрузки первого экрана, когда браузер свободен, ленивые картинки ниже
// качаются по порядку сверху вниз (по 4 одновременно) — к моменту прокрутки они уже готовы (Елена 15.10.2026).
export function warmLazyImages(root, parallel = 4) {
  if (!root || navigator.connection?.saveData) return;
  const start = () => {
    const queue = [...root.querySelectorAll('img[loading="lazy"]')].filter(img => !(img.complete && img.naturalWidth));
    const next = () => {
      const img = queue.shift();
      if (!img) return;
      const done = () => next();
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      img.loading = 'eager';
      if (img.complete) done();
    };
    for (let i = 0; i < parallel; i++) next();
  };
  const idle = cb => (window.requestIdleCallback ? requestIdleCallback(cb, { timeout: 2000 }) : setTimeout(cb, 300));
  if (document.readyState === 'complete') idle(start);
  else addEventListener('load', () => idle(start), { once: true });
}
