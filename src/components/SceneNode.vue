<script setup>
import {reveal as vReveal} from '../lib/reveal.mjs';
import {computed,inject,provide,unref} from 'vue';
import {authoredClasses,tariffKey,tariffStream,tariffNodeView} from '../lib/tariff-ui.mjs';
import {lazyImages} from '../lib/lazy-images.mjs';
import {prefixRootUrls} from '../lib/site-base.mjs';
import DesignForm from './DesignForm.vue';
import MediaPreview from './MediaPreview.vue';
import DesignGallery from './DesignGallery.vue';
import {field,localLink,linkTarget} from '../lib/scene.mjs';
const isPhysicalFlex=fields=>!!fields?.flex&&fields.flex!=='none';
const props=defineProps({node:Object,screen:Number,scene:String,parent:Object});
const authoredUi=inject('authoredUi',null);
const inheritedCard=inject('tariffCard',null);
const cardKey=computed(()=>tariffKey(props.node)||unref(inheritedCard));
provide('tariffCard',cardKey);
const sourceClasses=computed(()=>authoredClasses(props.node));
const state=computed(()=>authoredUi?.state(cardKey.value));
const view=computed(()=>{
 const result=tariffNodeView(props.node,state.value);
 if(authoredUi?.visible?.(sourceClasses.value)===false)result.hidden=true;
 const countdown=authoredUi?.countdownText?.(sourceClasses.value);
 if(countdown!==undefined)result.html=String(countdown).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
 return result;
});
const option=computed(()=>sourceClasses.value.includes('pf-option')?tariffStream(props.node):null);
const addon=computed(()=>sourceClasses.value.includes('pf-addon'));
const actionable=computed(()=>!!state.value&&(option.value!==null||addon.value));
function activate(event){
 if(!actionable.value)return;
 event.preventDefault();event.stopPropagation();
 if(addon.value)authoredUi.toggleAddon(cardKey.value);else authoredUi.select(cardKey.value,option.value);
}
function keyActivate(event){
 if(event.key==='Enter'||event.key===' '){activate(event);return;}
 if(actionable.value&&option.value!==null&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
  event.preventDefault();event.stopPropagation();const options=[1,2,4,8],delta=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;
  const next=options[(options.indexOf(option.value)+delta+options.length)%options.length];authoredUi?.select(cardKey.value,next);
  const card=event.currentTarget.closest('.pf-card');card?.querySelector(`.pf-option--${next}`)?.focus();
 }
}
const eagerImages=inject('eagerImages',false);
const skipReveal=inject('skipReveal',false);
const eager=computed(()=>unref(eagerImages)===true);
function revealOf(animation){return unref(skipReveal)||props.scene==='2322512891'?undefined:animation;}
const atomStyle=computed(()=>prefixRootUrls(props.node.atomStyle+(props.node.background?`;background-image:url("${props.node.background}")`:''))||'');
const renderedHtml=computed(()=>{
 const html=view.value.html||'';
 return eager.value?prefixRootUrls(html)||'':lazyImages(html);
});
// Ширина в %: Тильда пересчитывает её скриптом — от сетки (1200/960/640/480/320) при контейнере «сетка»;
// а на брейкпоинтах, где единицы сменились на px, её CSS-выгрузка всё равно пишет «%» (461% вместо 461px) (15.10.2026)
const gridPctStyle=computed(()=>{
 const f=props.node.fields;if(!f||props.parent)return undefined;
 if(!Object.entries(f).some(([k,v])=>k.startsWith('widthunits')&&v==='%'))return undefined;
 const get=(k)=>field(f,k,props.screen);
 const value=Number(get('width'));if(!(value>0))return undefined;
 if(get('widthunits')==='px')return {width:`${value}px`};
 if(get('widthunits')==='%'&&get('container')==='grid')return {width:`${props.screen*value/100}px`};
 return undefined;
});
const groupStyle=computed(()=>{
 if(props.node.type!=='group'||typeof window==='undefined')return undefined;
 const f=props.node.fields; const get=(k)=>field(f,k,props.screen); const pf=props.parent?.fields;
 const top=Number(get('top')||0)-(pf?Number(field(pf,'top',props.screen)||0):0);
 const left=Number(get('left')||0)-(pf?Number(field(pf,'left',props.screen)||0):0);
 const groupedFlex=isPhysicalFlex(pf);
 if(groupedFlex)return {top:'0px',left:'0px',position:'relative'};
 return {top:`${top}px`,left:pf||get('container')==='window'?`${left}px`:`calc(50% - ${props.screen/2}px + ${left}px)`,position:groupedFlex?'relative':'absolute'};
});
const href=computed(()=>{
 const original=sourceClasses.value.includes('pf-buy')&&state.value?state.value.link:props.node.href;
 const value=sourceClasses.value.includes('pf-buy')?authoredUi?.transformLink?.(original)||authoredUi?.checkoutHref?.(original)||original:original;
 return localLink(value,props.scene);
});
</script>
<template>
 <div v-if="node.type==='group'" v-reveal="revealOf(node.animation)" class="scene-group" :class="[sourceClasses,{'pf-active':view.active}]" :role="actionable?(addon?'checkbox':'radio'):undefined" :aria-checked="actionable?view.active:undefined" :tabindex="actionable?0:undefined" @click="activate" @keydown="keyActivate" :data-node="node.id" :data-native-tooltip="node.tooltipHook" :hidden="node.tooltipHook||view.hidden?true:undefined" :style="[groupStyle,gridPctStyle]">
  <div class="scene-group-inner" :class="{'scene-flex':isPhysicalFlex(node.fields)}" :id="`group-${node.id}`">
   <SceneNode v-for="child in node.children" :key="child.id" :node="child" :screen="screen" :scene="scene" :parent="node" />
  </div>
 </div>
 <div v-else v-reveal="revealOf(node.animation)" :style="gridPctStyle" class="scene-node" :class="[sourceClasses,`scene-${node.type}`,{'scene-group-child':isPhysicalFlex(parent?.fields),'pf-active':view.active}]" :hidden="view.hidden?true:undefined" :role="actionable?(addon?'checkbox':'radio'):undefined" :aria-checked="actionable?view.active:undefined" :tabindex="actionable?0:undefined" @click="activate" @keydown="keyActivate" :data-node="node.id">
  <DesignForm v-if="node.type==='form'" :node="node" :screen="screen" />
  <MediaPreview v-else-if="node.embed" :url="node.embed" />
  <DesignGallery v-else-if="node.type==='gallery'" :pictures="node.pictures" />
  <a v-else-if="href" class="scene-atom" :href="href" :target="linkTarget(href)" :rel="linkTarget(href)?'noopener noreferrer':undefined" :style="atomStyle" v-html="renderedHtml"></a>
  <button v-else-if="node.type==='button'" type="button" class="scene-atom" :style="atomStyle" v-html="renderedHtml"></button>
  <h1 v-else-if="node.tag==='h1'" class="scene-atom" :style="atomStyle" v-html="renderedHtml"></h1>
  <div v-else class="scene-atom" :style="atomStyle" v-html="renderedHtml"></div>
 </div>
</template>

<style scoped>
[hidden]{display:none!important}.pf-option,.pf-addon{cursor:pointer;user-select:none}.pf-option:focus-visible,.pf-addon:focus-visible{outline:2px solid #7da1d4;outline-offset:3px}
.pf-option :deep(.scene-atom__button-icon),.pf-addon :deep(.scene-atom__button-icon),.pf-option :deep(.tn-atom__button-icon),.pf-addon :deep(.tn-atom__button-icon){opacity:0!important;visibility:hidden!important}
.pf-option.pf-active :deep(.scene-atom__button-icon),.pf-addon.pf-active :deep(.scene-atom__button-icon),.pf-option.pf-active :deep(.tn-atom__button-icon),.pf-addon.pf-active :deep(.tn-atom__button-icon){opacity:1!important;visibility:visible!important}
</style>
