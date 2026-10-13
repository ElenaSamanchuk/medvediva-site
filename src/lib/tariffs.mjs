// Independent implementation of the public site's authored PF pricing rules.
// Config is parsed as data from T123, never executed as a Tilda script.
export const streams=[1,2,4,8];
function dateStamp(date,timezone){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));return Number(values.year+values.month+values.day);
}
const configuredStamp=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?Number(value.replaceAll('-','')):null;
export function tariffPhase(config,date=new Date()){
 if(config.page?.audience==='renewal')return'renewal';
 if(config.page?.phase&&config.page.phase!=='auto')return config.page.phase;
 const dates=config.dates||{},today=dateStamp(date,dates.timezone||'Europe/Moscow');
 const first=configuredStamp(dates.phase1Start),end=configuredStamp(dates.campaignEnd);
 if((first&&today<first)||(end&&today>end))return dates.outsideCampaign||'phase1';
 const third=configuredStamp(dates.phase3Start),second=configuredStamp(dates.phase2Start);
 if(third&&today>=third)return'phase3';if(second&&today>=second)return'phase2';return'phase1';
}
export function tariffLinks(config,phase,key){
 for(const candidate of [...new Set([phase,config.linksFallbackPhase||'phase1'])]){
  const list=config.links?.[candidate]?.[key];
  if(list?.some(item=>item?.link||item?.linkTvg))return list;
 }
 return null;
}
export function formatTariffPrice(value){return String(value).replace(/\B(?=(\d{3})+(?!\d))/g,'\u2009')+' ₽';}
export function tariffState(config,key,selectedIndex=0,withTvg=false,date=new Date()){
 const phase=tariffPhase(config,date),standard=config.prices?.std?.[key];
 const prices=phase==='phase3'?standard:config.prices?.[phase]?.[key],links=tariffLinks(config,phase,key);
 if(!standard||!prices||!links||prices.length!==streams.length)return null;
 const selected=Number.isInteger(selectedIndex)&&selectedIndex>=0&&selectedIndex<streams.length?selectedIndex:(config.defaults?.streamIndex||0);
 const index=selected>=0&&selected<streams.length?selected:0;
 const meta=config.texts?.[phase]||config.texts?.phase1||{},buttons=config.buttons||{};
 const showSale=!!meta.showSale,total=prices[index]+(withTvg?Number(config.tvg?.addon||0):0);
 const crossed=showSale&&!withTvg&&phase!=='phase3'&&standard[index]>0;
 const link=withTvg?links[index]?.linkTvg:links[index]?.link;
 let label=buttons.buy||'Купить';
 if(meta.buyRenewal)label=buttons.buyRenewal||label;
 else if(showSale&&!withTvg&&meta.buyDiscount)label=(buttons.buyWithDiscount||label)+' '+meta.buyDiscount;
 return {key,phase,index,streams:streams[index],accessWeeks:streams[index]*5,withTvg,total,newPrice:formatTariffPrice(total),oldTotal:crossed?standard[index]:0,oldPrice:crossed?formatTariffPrice(standard[index]):'',showCrossed:crossed,showSale,link:link||'',canBuy:!!link,label,perStream:formatTariffPrice(Math.floor(prices[3]/8))+(buttons.perStreamSuffix||''),cornerBadge:meta.cornerBadge||'',showPercentBadge:showSale&&!withTvg&&!!meta.cornerBadge&&meta.cornerBadge!=='Без скидки',showDiscountBadge:!withTvg&&((showSale&&!!meta.cornerBadge)||phase==='phase3'),phaseText:meta.phaseText||'',priceNote:meta.priceNote||'',deadline:meta.deadline||'',showFinalDeadline:phase==='phase3'};
}
