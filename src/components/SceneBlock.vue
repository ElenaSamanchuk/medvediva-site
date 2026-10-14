<script setup>
import {computed} from 'vue';
import SceneNode from './SceneNode.vue';
import {field,screenFor} from '../lib/scene.mjs';
const server=typeof window==='undefined';
const props=defineProps({scene:Object,width:Number});
// Tilda record visibility is separate from the scene's layout breakpoints.
const visible=computed(()=>{
 const min=Number.parseFloat(props.scene.min),max=Number.parseFloat(props.scene.max);
 return server||((!Number.isFinite(min)||props.width>=min)&&(!Number.isFinite(max)||props.width<max));
});
const screen=computed(()=>screenFor(props.width,(props.scene.board.screens||'320,480,640,960,1200').split(',').map(Number)));
const scale=computed(()=>field(props.scene.board,'upscale',screen.value,true)==='window'?props.width/screen.value:1);
// Exported auto-overflow boards contain horizontal card strips. Their canvas
// is the scroll container; make it reachable by keyboard as well as touch.
const scrollable=computed(()=>field(props.scene.board,'ovrflw',screen.value,true)==='auto'&&props.scene.board.pos!=='fixed');
// Перетаскивание ленты мышью, как в авторском скрипте Тильды для .uc-scroll (рек 2384968691); касание остаётся нативным
let drag=null;
function dragStart(e){if(!scrollable.value||e.pointerType!=='mouse'||e.button!==0)return;drag={x:e.clientX,left:e.currentTarget.scrollLeft,moved:false,el:e.currentTarget};}
function dragMove(e){if(!drag)return;const dx=e.clientX-drag.x;if(Math.abs(dx)>5){drag.moved=true;drag.el.classList.add('is-dragging');}if(drag.moved){drag.el.scrollLeft=drag.left-dx;e.preventDefault();}}
function dragEnd(){if(!drag)return;const d=drag;drag=null;d.el.classList.remove('is-dragging');if(d.moved){const block=ev=>{ev.preventDefault();ev.stopPropagation();};d.el.addEventListener('click',block,{capture:true,once:true});setTimeout(()=>d.el.removeEventListener('click',block,{capture:true}),0);}}
const height=computed(()=>{const design=Number(field(props.scene.board,'height',screen.value,true)||0);const vh=Number(field(props.scene.board,'height_vh',screen.value,true)||0);return vh?Math.max(design,(server?1000:innerHeight)/scale.value*vh/100):design;});
</script>
<template>
 <span v-show="visible" class="scene-anchor" :id="`rec${scene.id}`"></span>
  <section v-show="visible" class="scene-section" :id="`scene-${scene.id}`" :data-scene="scene.id" :style="server?undefined:{height:Math.floor(height*scale)+'px'}">
  <div class="scene-canvas" :class="{'scene-canvas--scrollable':scrollable}" :tabindex="scrollable?0:undefined" @pointerdown="dragStart" @pointermove="dragMove" @pointerup="dragEnd" @pointerleave="dragEnd" @dragstart.prevent :style="server?{width:'100%'}:{width:width/scale+'px',height:height+'px',transform:`scale(${scale})`}">
   <div class="scene-background"></div><div class="scene-filter"></div>
   <SceneNode v-for="node in scene.nodes" :key="node.id" :node="node" :screen="screen" :scene="scene.id" />
  </div>
 </section>
</template>
