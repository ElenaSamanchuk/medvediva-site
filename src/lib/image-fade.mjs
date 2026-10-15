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
