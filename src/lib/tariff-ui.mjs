import {reactive,unref,computed} from 'vue';
import {tariffState,streams} from './tariffs.mjs';
export function createTariffUi(configRef,nowRef){
 const choices=reactive({});const states=new Map();
 const config=()=>{const value=unref(configRef);return value?.config||value;};
 const choice=key=>choices[key]||(choices[key]={index:config()?.defaults?.streamIndex||0,withTvg:false});
 return {
  state(key){if(!key)return null;if(!states.has(key))states.set(key,computed(()=>{if(!config())return null;const selected=choice(key);return tariffState(config(),key,selected.index,selected.withTvg,new Date(unref(nowRef)??Date.now()));}));return states.get(key).value;},
  select(key,stream){const index=streams.indexOf(Number(stream));if(key&&index>=0)choice(key).index=index;},
  toggleAddon(key){if(key)choice(key).withTvg=!choice(key).withTvg;},
  choices
 };
}
export function authoredClasses(node){const value=node?.classes||[];return Array.isArray(value)?value:String(value).split(/\s+/);}
export function tariffKey(node){return authoredClasses(node).find(c=>c.startsWith('pf-card--'))?.slice(9)||null;}
export function tariffStream(node){const classes=authoredClasses(node);const marked=classes.find(c=>/^pf-option--(?:1|2|4|8)$/.test(c));return marked?Number(marked.slice(11)):null;}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function tariffNodeView(node,state){
 const classes=authoredClasses(node),has=c=>classes.includes(c);let html=node.html,hidden=false;
 if(!state)return {html,hidden,active:false};
 const values={'pf-price-new':state.newPrice,'pf-per-stream':state.perStream,'pf-phase-text':state.phaseText,'pf-price-note':state.priceNote,'pf-deadline':state.deadline,'pf-discount':state.cornerBadge,'pf-badge-percent':state.cornerBadge,'pf-buy':state.label};
 for(const [name,value] of Object.entries(values))if(has(name))html=escape(value);
 if(has('pf-price-old')){html=state.showCrossed?`<s>${escape(state.oldPrice)}</s>`:'';hidden=!state.showCrossed;}
 if(has('pf-badge-percent'))hidden=!state.showPercentBadge;
 if(has('pf-discount'))hidden=!state.showDiscountBadge;
 if(has('pf-price-note'))hidden=!state.priceNote;
 if(has('pf-deadline-final'))hidden=!state.showFinalDeadline;
 if(has('pf-hide-on-tvg'))hidden||=state.withTvg;
 if(has('pf-hide-on-nosale'))hidden||=!state.showSale||state.withTvg;
 const active=has('pf-addon')?state.withTvg:tariffStream(node)===state.streams;
 return {html,hidden,active};
}
