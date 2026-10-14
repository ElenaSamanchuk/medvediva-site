// Анимация шкал «Важность»: заливка растёт слева направо, проценты считаются от 0 (14.10.2026, по просьбе Елены).
// Шкала = два тонких shape-узла (трек и заливка) с общим началом в той же карточке, что и текст «NN%».
const done=new WeakSet();
export function initMeters(root){
 if(!root||typeof IntersectionObserver==='undefined')return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 for(const atom of root.querySelectorAll('.scene-text .scene-atom')){
  const m=atom.textContent.trim().match(/^(\d{1,3})\s*%$/);if(!m||done.has(atom))continue;
  let card=atom.closest('.scene-group');for(let i=0;i<2&&card?.parentElement?.closest('.scene-group');i++)card=card.parentElement.closest('.scene-group');
  if(!card)continue;
  const thin=[...card.querySelectorAll('.scene-shape')].map(n=>({n,r:n.getBoundingClientRect()})).filter(x=>x.r.height>0&&x.r.height<=12&&x.r.width>20);
  let fill=null;
  for(const a of thin)for(const b of thin)if(a!==b&&Math.abs(a.r.left-b.r.left)<2&&Math.abs(a.r.top-b.r.top)<2&&b.r.width<a.r.width)fill=b.n;
  done.add(atom);
  if(reduce)continue;
  const value=Number(m[1]);
  atom.textContent='0%';if(fill){fill.style.transformOrigin='left center';fill.style.transform='scaleX(0)';}
  const io=new IntersectionObserver(entries=>{
   if(!entries.some(e=>e.isIntersecting))return;io.disconnect();
   const t0=performance.now(),dur=1200,ease=t=>1-Math.pow(1-t,3);
   if(fill){fill.style.transition=`transform ${dur}ms cubic-bezier(.19,1,.22,1)`;requestAnimationFrame(()=>{fill.style.transform='scaleX(1)';});}
   const step=now=>{const k=Math.min(1,(now-t0)/dur);atom.textContent=Math.round(value*ease(k))+'%';if(k<1)requestAnimationFrame(step);};requestAnimationFrame(step);
  },{rootMargin:'0px 0px -10% 0px'});
  io.observe(atom);
 }
}
