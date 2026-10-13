// Native reveal using exported timing data. No source runtime or hidden content without JS.
const states=new WeakMap();
export function revealFrames(value,baseTransform='none'){
 const distance=Number(value.distance)||25;
 const transforms={fadeinup:`translateY(${distance}px)`,fadeindown:`translateY(-${distance}px)`,fadeinleft:`translateX(${distance}px)`,fadeinright:`translateX(-${distance}px)`,zoomin:`scale(${Number(value.scale)||0.9})`};
 const offset=transforms[value.style];const initial=offset?(baseTransform==='none'?offset:`${baseTransform} ${offset}`):baseTransform;
 return [{opacity:0,transform:initial},{opacity:1,transform:baseTransform}];
}
export const reveal={
 mounted(element,{value}){
  if(!value||states.has(element)||matchMedia('(prefers-reduced-motion: reduce)').matches||innerWidth<960&&value.mobile!=='y'||typeof IntersectionObserver==='undefined'||typeof element.animate!=='function')return;
  const state={observer:null,animation:null,started:false,originalOpacity:element.style.opacity};
  const restore=()=>{if(element.style.opacity==='0')element.style.opacity=state.originalOpacity;};
  const base=getComputedStyle(element).transform;
  // Prevent the first-frame flash before the observer dispatches its first callback.
  element.style.opacity='0';
  const observer=new IntersectionObserver(entries=>{
   if(state.started||!entries.some(e=>e.isIntersecting))return;
   state.started=true;observer.disconnect();
   try{
    const animation=element.animate(revealFrames(value,base),{duration:Math.max(0,Number(value.duration)||1)*1000,delay:Math.max(0,Number(value.delay)||0)*1000,easing:'ease-out',fill:'both'});
    state.animation=animation;
    animation.finished.then(()=>{restore();animation.cancel();},restore);
   }catch{restore();}
  });state.observer=observer;states.set(element,state);observer.observe(element);
 },
 unmounted(element){const state=states.get(element);state?.observer.disconnect();state?.animation?.cancel();if(state&&element.style.opacity==='0')element.style.opacity=state.originalOpacity;states.delete(element);}
};
