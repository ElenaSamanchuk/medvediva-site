<script setup>
import {localStore} from './lib/storage.mjs';
import supportWidget from './lib/support-widget.json';
import {initMeters} from './lib/meters.mjs';
import {localLink} from './lib/scene.mjs';
import {lazyImages} from './lib/lazy-images.mjs';
import {docLinks} from './lib/doc-links.mjs';
import {fadeInImages,warmLazyImages} from './lib/image-fade.mjs';
import {initAnalytics} from './lib/analytics.mjs';
import {eagerContentIds,loadsSecondBlockEager} from './lib/eager-blocks.mjs';
import {prefixRootUrls,stripBase,withBase} from './lib/site-base.mjs';
import {captureAttribution,prepareLinks,checkoutLink} from './lib/attribution.mjs';
import {ref,computed,onMounted,onUnmounted,nextTick,provide,watch} from 'vue';
import {createTariffUi} from './lib/tariff-ui.mjs';
import {getActivePhase,promotionVisible,countdownState} from './lib/promotion.mjs';
import './popup.css';
import StandardBlock from './components/StandardBlock.vue';
import DesignGallery from './components/DesignGallery.vue';
import SceneBlock from './components/SceneBlock.vue';
import MediaPreview from './components/MediaPreview.vue';
import SupportForm from './components/SupportForm.vue';
import SiteHeader from './components/SiteHeader.vue';
import SiteFooter from './components/SiteFooter.vue';
const props=defineProps({initialPage:Object,initialLayout:Object});
const shared=ref(props.initialLayout||null);
const client=typeof window!=='undefined';
const width=ref(client?innerWidth:1200); const page=ref(props.initialPage||null); const error=ref(''); const popup=ref(null);const menu=ref(false);const banner=ref(false);
const bannerWidth=computed(()=>width.value>768?Math.min(1200,width.value-32):width.value);
const now=ref(Date.now());
const authoredUi=createTariffUi(computed(()=>page.value?.promotion?.config),now);
const countdown=computed(()=>countdownState(page.value?.promotion?.countdown,now.value));
authoredUi.visible=classes=>promotionVisible((classes||[]).filter(c=>c.startsWith('pf-show-')),page.value?.promotion?.config,now.value);
authoredUi.countdownText=classes=>countdown.value?.text[(classes||[]).find(c=>c.startsWith('cd-'))];
provide('authoredUi',authoredUi);
// Открытое меню перекрывает VK, куки, чат поддержки и стрелку «наверх» (решение Елены 14.10.2026)
if(client)watch(menu,v=>document.documentElement.classList.toggle('menu-open',v));
const supportPreview=client&&stripBase(location.pathname)==='/__preview/support';
const cookie=ref(false);const showTop=ref(false);
const overlays=['860237765','1063609261','2019108731','2322512891','770878605'];
const popups=computed(()=>{const own=page.value?.popups||[];return [...own,...(shared.value?.popups||[]).filter(p=>!own.some(x=>x.hook===p.hook))];});
const sceneId=id=>String(id).replace(/^rec/,'');
const popupScenes=computed(()=>popups.value.flatMap(p=>(p.scenes||[]).map(sceneId)));
const blocks=computed(()=>page.value?.blocks.filter(b=>!overlays.includes(b.id)&&!popupScenes.value.includes(b.id)&&(!page.value.promotion?.bannerScenes?.[b.id]||page.value.promotion.bannerScenes[b.id]===getActivePhase(page.value.promotion.config,now.value)))||[]);
const eagerIds=computed(()=>eagerContentIds(blocks.value,loadsSecondBlockEager(page.value?.path)));
function isEager(id){return eagerIds.value.includes(id);}
function lazyHtml(html){return lazyImages(html||'');}
function shownHtml(html,eager){return eager?prefixRootUrls(html||'')||'':lazyHtml(html);}
function styleText(value){return typeof value==='string'?prefixRootUrls(value):value;}
const scene=id=>shared.value?.scenes.find(s=>s.id===sceneId(id))||page.value?.scenes.find(s=>s.id===sceneId(id));
const dialogScenes=computed(()=>(popup.value?.scenes||[]).map(scene).filter(Boolean));
let timer,showTimer,clockTimer;let previousFocus;
let attribution={};
authoredUi.checkoutHref=href=>checkoutLink(href,attribution,localStore.getItem('r'),client?location.origin:'https://medvediva.ru');
let activeTooltip=null;let tooltipTimer;let keyboardFocus=false;
function tooltipFor(trigger){
 const hook=trigger?.getAttribute('href');
 return hook?Array.from(document.querySelectorAll('[data-native-tooltip]')).find(x=>x.dataset.nativeTooltip===hook):null;
}
function hideTooltip(){
 clearTimeout(tooltipTimer);
 if(!activeTooltip)return;
 activeTooltip.panel.hidden=true;activeTooltip.trigger.setAttribute('aria-expanded','false');activeTooltip=null;
}
function showTooltip(trigger,panel){
 clearTimeout(tooltipTimer);
 if(activeTooltip?.panel===panel)return;
 hideTooltip();panel.hidden=false;
 trigger.setAttribute('aria-expanded','true');
 const id=panel.id||`tooltip-${trigger.getAttribute('href').slice(1)}`;panel.id=id;
 trigger.setAttribute('aria-controls',id);panel.setAttribute('role','region');panel.setAttribute('aria-label','Подсказка');
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches)panel.animate([{opacity:0},{opacity:1}],{duration:300,easing:'ease-in-out'});
 activeTooltip={trigger,panel};
}
function tooltipEnter(e){
 const trigger=e.target.closest('a[href]');const panel=tooltipFor(trigger);
 if(panel&&(e.type==='focusin'?keyboardFocus:matchMedia('(hover: hover)').matches))showTooltip(trigger,panel);
 if(activeTooltip?.panel.contains(e.target))clearTimeout(tooltipTimer);
}
function tooltipLeave(e){
 if(e.type==='mouseout'&&!matchMedia('(hover: hover)').matches||e.type==='focusout'&&!keyboardFocus)return;
 if(!activeTooltip)return;
 const {trigger,panel}=activeTooltip;const target=e.relatedTarget;
 if(target instanceof Node&&(trigger.contains(target)||panel.contains(target)))return;
 if(trigger.contains(e.target)||panel.contains(e.target))tooltipTimer=setTimeout(hideTooltip,100);
}
function backTop(){window.scrollTo({top:0,behavior:'smooth'});}
function anchorTarget(href){
 const anchor=page.value?.anchors?.find(a=>`#${a.name}`===href);
 let id;try{id=decodeURIComponent(href.slice(1));}catch{id=href.slice(1);}
 return document.getElementById(anchor?'scene-'+anchor.scene:id.replace(/^rec/,'scene-'));
}
function hashChange(){
 hideTooltip();
 if(location.hash==='#menuopen'){openMenu();return;}
 const item=popups.value.find(p=>p.hook===location.hash);
 if(item){open(item);return;}
 resetDialog();
 if(location.hash.length>1)nextTick(()=>anchorTarget(location.hash)?.scrollIntoView({behavior:'instant'}));
}
function resize(){hideTooltip();width.value=innerWidth;if(popup.value)nextTick(placeClose);nextTick(syncStripArrows);}
// Крестик Zero-попапа — в правом верхнем углу карточки, а не окна (Елена 15.10.2026).
// Карточка — самая большая непрозрачная фигура или группа сцены; без неё крестик остаётся в углу окна.
const closeSpot=ref(null);
function placeClose(){
 const dialog=document.querySelector('.native-dialog--scene');
 if(!dialog){closeSpot.value=null;return;}
 // Свой крестик в макете попапа (#closepopup) — тогда наш не дублируем
 if([...dialog.querySelectorAll('a[href="#closepopup"],a[href="#menuclose"]')].some(a=>{const n=a.closest('[data-node]');return !n||getComputedStyle(n).display!=='none';})){closeSpot.value={display:'none'};return;}
 const box=dialog.getBoundingClientRect();let card=null,area=0;
 for(const node of dialog.querySelectorAll('.scene-node.scene-shape,.scene-group')){
  const rect=node.getBoundingClientRect();const color=getComputedStyle(node.querySelector(':scope > .scene-atom,:scope > .scene-group-inner')||node).backgroundColor;
  if(!rect.width||!rect.height||color==='transparent'||/,\s*0\)$/.test(color))continue;
  if(rect.width*rect.height>area){area=rect.width*rect.height;card=rect;}
 }
 closeSpot.value=card?{top:`${card.top-box.top+10}px`,left:`${card.right-box.left-10}px`}:null;
}
function scroll(){showTop.value=window.scrollY>500;}
// Zero-попап на всю ширину: клик по пустому месту (не по содержимому сцены) закрывает, как клик вне окна (14.10.2026)
function dialogBackdropClick(e){if(!dialogScenes.value.length)return;if(e.target.closest('.scene-node,.scene-group,.dialog-close,a,button,input,textarea,video'))return;close();}
// Открытое меню закрывается кликом вне панели (решение Елены 14.10.2026)
function menuOutsideClick(e){const n=e.target.closest('.scene-node,.scene-group,.menu-close,a,button');/* 1748446143723 — прозрачная подложка слева от панели, считается «вне» */if(n&&n.dataset?.node!=='1748446143723')return;close();}
function resetDialog(){document.querySelectorAll('.native-dialog video').forEach(v=>v.pause());popup.value=null;menu.value=false;document.body.style.overflow='';previousFocus?.focus({preventScroll:true,focusVisible:keyboardFocus});}
function close(){const owned=history.state?.medvedivaOverlay;resetDialog();if(owned)history.back();else if(location.hash==='#menuopen'||popups.value.some(p=>p.hook===location.hash))history.replaceState(history.state,'',location.pathname+location.search);}
function overlayHistory(hook){if(location.hash!==hook)history.pushState({...history.state,medvedivaOverlay:true},'',hook);}
function open(item){if(!popup.value&&!menu.value)previousFocus=document.activeElement;menu.value=false;popup.value=item;document.body.style.overflow='hidden';nextTick(()=>{prepareLinks(document.querySelector('.native-dialog'),attribution);placeClose();requestAnimationFrame(placeClose);document.querySelector('.native-dialog button')?.focus({preventScroll:true,focusVisible:keyboardFocus});});}
function openMenu(){if(!menu.value&&!popup.value)previousFocus=document.activeElement;popup.value=null;menu.value=true;document.body.style.overflow='hidden';nextTick(()=>{prepareLinks(document.querySelector('.native-menu'),attribution);/* r из адреса — во внутренние ссылки меню, как скрипты Тильды 857516649/860263697 */{const r=new URLSearchParams(location.search).get('r');if(r)for(const a of document.querySelectorAll('.native-menu a[href^="/"]')){const u=new URL(a.getAttribute('href'),location.origin);if(stripBase(u.pathname)==='/members/login'||u.searchParams.has('r'))continue;u.searchParams.set('r',r);a.setAttribute('href',withBase(u.pathname)+u.search+u.hash);}}document.querySelector('.menu-close')?.focus({focusVisible:keyboardFocus});});}
// Стрелки у прокручиваемых лент (на Тильде их листал свой скрипт); лента — ближайший прокручиваемый блок после блока со стрелкой (Елена 15.10.2026)
const scrollArrows={'1745407681111':-1,'1745407739027':1,'1751618490035':-1,'1751618490132':1};
function stripFor(node){
 let block=node.closest('main > *');
 while(block){if(block.querySelector('.scene-canvas--scrollable'))return block.querySelector('.scene-canvas--scrollable');block=block.nextElementSibling;}
 return null;
}
function syncStripArrows(){
 for(const nodeId of Object.keys(scrollArrows))document.querySelectorAll(`[data-node="${nodeId}"]`).forEach(n=>{const box=stripFor(n);n.classList.toggle('strip-arrow--idle',!box||box.scrollWidth-box.clientWidth<8);});
}
function scrollStrip(node,dir){
 const box=stripFor(node);if(!box)return;
 box.scrollBy({left:dir*Math.max(160,box.clientWidth*0.8),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
function click(e){
 const a=e.target.closest('a[href]'); const node=e.target.closest('[data-node]');
 if(node?.dataset.node==='1779882150069'||node?.dataset.node==='1780491925286000001'){banner.value=false;localStore.setItem('medvedivaBannerClosed','1');clearTimeout(timer);return;}
 if(node?.dataset.node==='1745573793244'){/* handled by link below */}
 if(node?.dataset.node==='1773213623325000005'){localStore.setItem('cookieConsent','accepted');localStore.setItem('cookieConsentDate',new Date().toISOString());cookie.value=false;return;}
 if(node&&scrollArrows[node.dataset.node]){scrollStrip(node,scrollArrows[node.dataset.node]);return;}
 const tooltip=tooltipFor(a);
 if(tooltip){e.preventDefault();if(activeTooltip?.panel===tooltip&&!matchMedia('(hover: hover)').matches)hideTooltip();else showTooltip(a,tooltip);return;}
 if(activeTooltip&&!activeTooltip.panel.contains(e.target))hideTooltip();
 if(!a)return;
 const href=a.getAttribute('href');
 if(href==='#close'&&activeTooltip){e.preventDefault();hideTooltip();return;}
 const sceneId=a.closest('[data-scene]')?.dataset.scene;
 if((sceneId==='1423616591'||sceneId==='860237765')&&!href?.startsWith('#')){const target=localLink(a.href,sceneId);if(target)a.setAttribute('href',target);}
 if(href==='#menuopen'&&scene('860237765')){e.preventDefault();overlayHistory(href);openMenu();return;}
 if(href==='#menuclose'||href==='#closepopup'){e.preventDefault();close();return;}
 if(href==='#back'){e.preventDefault();if(history.length>1)history.back();else location.assign(withBase('/'));return;} /* «Назад» на Тильде — javascript:history.back() */
 const modal=popups.value.find(p=>p.hook===href);
 if(modal){e.preventDefault();overlayHistory(href);open(modal);return;}
  if(href?.startsWith('#')&&href.length>1){
  const target=anchorTarget(href);
  if(target){e.preventDefault();resetDialog();history.pushState(null,'',href);dispatchEvent(new Event('medvediva:anchor'));target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 }
}
function key(e){if(e.key==='Tab')keyboardFocus=true;if(e.key==='Escape'){hideTooltip();if(popup.value||menu.value)close();}if(e.key==='Tab'&&(popup.value||menu.value)){const root=document.querySelector(popup.value?'.native-dialog':'.native-menu');const items=[...root.querySelectorAll('button,a[href],input,textarea,select,[tabindex="0"]')].filter(x=>!x.disabled&&x.getClientRects().length);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}
onMounted(async()=>{
 clockTimer=setInterval(()=>{now.value=Date.now();},1000);
 addEventListener('resize',resize);addEventListener('keydown',key);addEventListener('hashchange',hashChange);addEventListener('popstate',hashChange);addEventListener('scroll',scroll,{passive:true});
 addEventListener('load',syncStripArrows);setTimeout(syncStripArrows,1200);
 fadeInImages(document.querySelector('main'));
 warmLazyImages(document.querySelector('main'));
 initAnalytics();
 if(supportPreview)return;
 attribution=captureAttribution(location.search);
 cookie.value=!['accepted','true'].includes(localStore.getItem('cookieConsent'));
 const referral=new URLSearchParams(location.search).get('r');if(referral)localStore.setItem('r',referral);
 try{
  if(!page.value){
  const here=stripBase(location.pathname);
  const routes=await fetch(withBase('/content/routes.json')).then(r=>r.json());const route=routes.find(r=>r.path===here||r.path===here.replace(/\/$/,''))||routes.find(r=>`/page${r.page}.html`===here);
  if(!route){error.value='Страница не найдена.';return;}
  const link=document.createElement('link');link.rel='stylesheet';link.href=withBase(`/content/${route.page}.css`);document.head.append(link);
  const layout=document.createElement('link');layout.rel='stylesheet';layout.href=withBase(`/content/${route.page}-layout.css`);document.head.append(layout);
  page.value=await fetch(withBase(`/content/${route.page}.json`)).then(r=>r.json());}
  if(!shared.value)shared.value=await fetch(withBase('/content/shared-layout.json')).then(r=>r.json());
  // в собранной странице shared-layout.css уже подключён в <head> — второй раз не качаем
  if(!document.querySelector('link[rel="stylesheet"][href$="/content/shared-layout.css"]')){const sharedCSS=document.createElement('link');sharedCSS.rel='stylesheet';sharedCSS.href=withBase('/content/shared-layout.css');document.head.append(sharedCSS);}
  document.title=page.value.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content',page.value.description);
  await document.fonts.ready;
  await nextTick();prepareLinks(document.getElementById('app'),attribution);initMeters(document.getElementById('app'));
  showTimer=setTimeout(()=>{banner.value=page.value?.path==='/'&&!localStore.getItem('medvedivaBannerClosed');/* VK только на главной (решение Елены 14.10.2026, как на Тильде) */if(banner.value)timer=setTimeout(()=>banner.value=false,10000);},500);
  hashChange();
  if(!document.getElementById('nn99-support-widget')){const widget=document.createElement('script');widget.id='nn99-support-widget';widget.src=supportWidget.src;widget.async=true;for(const [k,v] of Object.entries(supportWidget.attrs))widget.setAttribute(k,v);document.body.append(widget);}
 }catch(e){error.value='Не удалось загрузить страницу.';console.error(e);}
});
onUnmounted(()=>{removeEventListener('resize',resize);removeEventListener('keydown',key);removeEventListener('hashchange',hashChange);removeEventListener('popstate',hashChange);removeEventListener('scroll',scroll);clearTimeout(timer);clearTimeout(showTimer);clearTimeout(tooltipTimer);clearInterval(clockTimer);});
</script>
<template>
 <main v-if="supportPreview" class="min-h-screen p-4 sm:p-10"><SupportForm mode="dry-run" /></main>
 <div v-else-if="error" class="p-10"><h1>{{error}}</h1><a :href="withBase('/')">На главную</a></div>
 <div v-else-if="page" @click="click" @pointerdown="keyboardFocus=false" @mouseover="tooltipEnter" @mouseout="tooltipLeave" @focusin="tooltipEnter" @focusout="tooltipLeave">
  <SiteHeader :scene="scene('1063609261')" :width="width" />
  <main><template v-for="block in blocks" :key="block.id"><SceneBlock v-if="block.kind==='scene'" :scene="scene(block.id)" :width="width" :eager="isEager(block.id)" :skip-reveal="block.id===eagerIds[1]" /><div v-else-if="block.kind==='spacer'" class="native-spacer" :id="`scene-${block.id}`" :style="styleText(block.style)" aria-hidden="true"></div><article v-else-if="block.kind==='article'" class="native-article" :id="`scene-${block.id}`" :style="styleText(block.style)"><div v-html="shownHtml(docLinks(block.html),isEager(block.id))"></div></article><StandardBlock v-else-if="block.kind!=='anchor'&&block.kind!=='spacer'" :block="block" :width="width" :eager="isEager(block.id)" /><span v-else :id="`scene-${block.id}`"></span></template></main>
  <SiteFooter :scene="scene('770878605')" :width="width" />
  <Transition name="vk-banner"><aside v-if="banner&&scene('2322512891')" class="native-banner"><SceneBlock :scene="scene('2322512891')" :width="bannerWidth" eager /></aside></Transition>
  <aside v-if="cookie&&scene('2019108731')" class="native-cookie"><SceneBlock :scene="scene('2019108731')" :width="width" eager /></aside>
  <Transition name="menu-slide"><div v-if="menu" class="native-menu" @click="menuOutsideClick" role="dialog" aria-modal="true" aria-label="Меню сайта"><button class="menu-close" aria-label="Закрыть меню" @click="close">×</button><SceneBlock :scene="scene('860237765')" :width="width" eager /></div></Transition>
  <Transition name="popup-rise"><div v-if="popup" class="native-modal" :class="{'native-modal--scene':dialogScenes.length}" @click.self="close"><section class="native-dialog" @click="dialogBackdropClick" :data-popup-hook="popup.hook" :class="{'native-dialog--scene':dialogScenes.length}" role="dialog" aria-modal="true" :aria-label="popup.title||'Информация'"><button class="dialog-close" :class="{'dialog-close--card':closeSpot}" :style="closeSpot||undefined" aria-label="Закрыть" @click="close">×</button><h2 v-if="popup.title">{{popup.title}}</h2><div v-if="popup.html" class="popup-description" v-html="prefixRootUrls(popup.html)"></div><SceneBlock v-for="item in dialogScenes" :key="item.id" :scene="item" :width="Math.min(width,1200)" /><MediaPreview v-if="popup.embed" :url="popup.embed" /><div v-if="popup.pictures" class="gallery-popup"><DesignGallery :pictures="popup.pictures" /></div><SupportForm v-if="popup.form" mode="dry-run" :show-intro="false" /><a v-if="popup.button" class="popup-button" :href="withBase(popup.button.href)">{{popup.button.text}}</a></section></div></Transition>
  <button v-if="showTop&&!cookie" type="button" class="back-top" aria-label="Вернуться к началу страницы" @click="backTop"><svg role="presentation" width="50" height="50" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="50" height="50" rx="50" fill="#ffffff" fill-opacity="0.90" stroke="none"/><path d="M14 28L25 18l10 10" stroke="#000000" stroke-width="1" fill="none"/></svg></button>
 </div>
</template>
