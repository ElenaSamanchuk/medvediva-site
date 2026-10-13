// Native data-only counterpart of the author's PF/countdown scripts.
// Config is supplied from the audited source; dates are never inferred from promo copy.
const phases=new Set(['phase1','phase2','phase3','renewal']);
export function zonedParts(now=Date.now(),timezone='Europe/Moscow'){
 const date=new Date(now);if(!Number.isFinite(date.getTime()))return null;
 try{return Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));}catch{return null;}
}
export function getActivePhase(config,now=Date.now()){
 if(!config)return null;
 if(config.page?.audience==='renewal')return 'renewal';
 if(config.page?.phase&&config.page.phase!=='auto')return phases.has(config.page.phase)?config.page.phase:null;
 const dates=config.dates;if(!dates)return null;
 const p=zonedParts(now,dates.timezone||'Europe/Moscow');if(!p)return null;
 const today=`${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
 const outside=phases.has(dates.outsideCampaign)?dates.outsideCampaign:'phase1';
 if(dates.phase1Start&&today<dates.phase1Start||dates.campaignEnd&&today>dates.campaignEnd)return outside;
 if(dates.phase3Start&&today>=dates.phase3Start)return 'phase3';
 if(dates.phase2Start&&today>=dates.phase2Start)return 'phase2';
 return 'phase1';
}
export function promotionVisible(markers,config,now=Date.now()){
 if(!markers?.length)return true;
 const phase=getActivePhase(config,now);if(!phase)return false;
 return markers.some(marker=>{const value=marker.replace(/^pf-show-/,'');if(value==='phase4')return phase==='renewal';if(value==='with-sale')return phase==='phase1'||phase==='phase2';if(value==='nosale')return phase==='phase3';return value===phase;});
}
export function zonedTimeToUtc(parts,timezone='Europe/Moscow'){
 const target=Date.UTC(parts.year,parts.month-1,parts.day,parts.hour||0,parts.minute||0,parts.second||0);
 if(!Number.isFinite(target))return null;
 let guess=target;
 for(let i=0;i<3;i++){const p=zonedParts(guess,timezone);if(!p)return null;const asUtc=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);const next=target-(asUtc-guess);if(next===guess)return next;guess=next;}
 return guess;
}
export function countdownTarget(config,now=Date.now()){
 if(!config)return null;const timezone=config.timezone||'Europe/Moscow';
 if(config.mode==='fixed'){
  const value=config.endDate;if(value instanceof Date)return Number.isFinite(value.getTime())?value.getTime():null;
  if(typeof value==='object'&&value?.year)return zonedTimeToUtc(value,timezone);
  if(typeof value!=='string')return null;
  const m=value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);if(!m)return null;
  return zonedTimeToUtc({year:+m[1],month:+m[2],day:+m[3],hour:+(m[4]||0),minute:+(m[5]||0),second:+(m[6]||0)},timezone);
 }
 if(config.mode==='endOfDay'){const p=zonedParts(now,timezone);return p?zonedTimeToUtc({...p,hour:23,minute:59,second:59},timezone):null;}
 return null;
}
const labels={days:['день','дня','дней'],hours:['час','часа','часов'],mins:['минута','минуты','минут'],secs:['секунда','секунды','секунд']};
export function russianPlural(value,forms){const n=Math.abs(value);if(n%100>=11&&n%100<=14)return forms[2];return n%10===1?forms[0]:n%10>=2&&n%10<=4?forms[1]:forms[2];}
export function countdownState(config,now=Date.now()){
 const target=countdownTarget(config,now);const epoch=new Date(now).getTime();if(target===null||!Number.isFinite(epoch))return null;
 const remaining=Math.max(0,Math.floor((target-epoch)/1000));
 const values={days:Math.floor(remaining/86400),hours:Math.floor(remaining%86400/3600),mins:Math.floor(remaining%3600/60),secs:remaining%60};
 return {target,remaining,expired:remaining===0,values,text:Object.fromEntries(Object.entries(values).flatMap(([key,n])=>[[`cd-${key}-num`,String(n).padStart(2,'0')],[`cd-${key}-text`,russianPlural(n,labels[key])]]))};
}
