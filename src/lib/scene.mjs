export const screens = [1200,960,640,480,320];
export function screenFor(width,points=screens) { return [...points].sort((a,b)=>b-a).find(s=>width>=s) || Math.min(...points); }
export function field(fields,key,screen,board=false) {
 let value=fields[board?key:`${key}-value`] ?? fields[key];
 const points=[...new Set(Object.keys(fields).flatMap(k=>{const m=k.match(/-res-(\d+)/);return m?[Number(m[1])]:[]}))].sort((a,b)=>b-a);
 for (const point of points) {
  if(point<screen) break;
  const override=fields[board?`${key}-res-${point}`:`${key}-res-${point}-value`] ?? fields[`${key}-res-${point}`];
  if(override!==undefined)value=override;
 }
 return value;
}
export function localLink(href,scene) {
 if(!href)return undefined;
 if(href.startsWith('#'))return href;
 let url;
 try {url=new URL(href,typeof location==='undefined'?'https://medvediva.ru':location.origin);}catch{return href;}
 if(!['http:','https:','mailto:','tel:','tg:','whatsapp:','viber:'].includes(url.protocol))return undefined;
 if(['medvediva.ru','www.medvediva.ru'].includes(url.hostname)||typeof location!=='undefined'&&url.origin===location.origin) {
  // r переносится как в авторских скриптах Тильды: карточки курсов на главной и меню (рек 860237765, скрипты 857516649/860263697)
  if(scene==='1423616591' && ['/pit','/intensiv','/tvg'].includes(url.pathname) || scene==='860237765' && url.pathname!=='/members/login') {
   const referral=new URLSearchParams(typeof location==='undefined'?'':location.search).get('r');if(referral&&!url.searchParams.has('r'))url.searchParams.set('r',referral);
  }
  return `${url.pathname}${url.search}${url.hash}`;
 }
 return href;
}
export function linkTarget(href){return /^https?:\/\//i.test(localLink(href)||'')?'_blank':undefined;}
