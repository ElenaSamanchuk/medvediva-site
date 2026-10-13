<script setup>
import {ref,computed,nextTick,onBeforeUnmount,watch} from 'vue';
import {mediaSource,useNativeHls} from '../lib/media.mjs';
const props=defineProps({url:String});
const source=computed(()=>mediaSource(props.url));
const started=ref(false),loading=ref(false),failure=ref(''),hint=ref(''),video=ref(null);
let engine=null,generation=0;
function stop(){
 generation++;engine?.destroy();engine=null;
 if(video.value){video.value.pause();video.value.removeAttribute('src');video.value.load();}
 loading.value=false;
}
function fail(){failure.value='Видео не удалось загрузить. Можно открыть его на сайте видеосервиса';loading.value=false;engine?.destroy();engine=null;video.value?.pause();}
async function requestPlay(){
 try{await video.value?.play();}catch{loading.value=false;hint.value='Нажмите кнопку воспроизведения в плеере';}
}
async function start(){
 if(!source.value?.manifest)return;
 started.value=true;loading.value=true;failure.value='';hint.value='';
 const token=++generation;
 await nextTick();
 if(token!==generation||!video.value)return;
 const target=video.value;
 if(useNativeHls(navigator.userAgent)&&target.canPlayType('application/vnd.apple.mpegurl')){
  target.src=source.value.manifest;target.load();await requestPlay();return;
 }
 try{
  const {default:Hls}=await import('hls.js');
  if(token!==generation)return;
  if(!Hls.isSupported()){fail();return;}
  engine=new Hls({startLevel:0,maxBufferLength:10,maxMaxBufferLength:20});
  engine.on(Hls.Events.MANIFEST_PARSED,()=>{if(token===generation)requestPlay();});
  engine.on(Hls.Events.ERROR,(_event,data)=>{if(token===generation&&data.fatal)fail();});
  engine.loadSource(source.value.manifest);engine.attachMedia(target);
 }catch{if(token===generation)fail();}
}
watch(()=>props.url,()=>{stop();started.value=false;failure.value='';hint.value='';});
onBeforeUnmount(stop);
</script>
<template>
 <div class="media-preview">
  <video v-if="started&&source?.manifest" ref="video" controls playsinline preload="none" aria-label="Видео" @error="fail" @playing="loading=false;hint=''" />
  <button v-else-if="source?.manifest" class="media-play" @click="start" aria-label="Воспроизвести видео">▶</button>
  <p v-else>{{source?.external ? 'Видео можно открыть на сайте видеосервиса' : 'Видео пока недоступно'}}</p>
  <p v-if="loading" class="media-status" role="status">Загрузка видео…</p>
  <p v-if="failure||hint" class="media-status" :role="failure?'alert':'status'">{{failure||hint}}</p>
  <a v-if="source?.external" class="media-external" :href="source.external" target="_blank" rel="noopener noreferrer">Открыть видео отдельно ↗</a>
 </div>
</template>
<style scoped>
.media-preview{position:relative;width:100%;height:100%;min-height:160px;background:#191919;display:grid;place-items:center;color:white;overflow:hidden}
.media-preview video{display:block;width:100%;height:100%;max-height:85vh;object-fit:contain}
.media-play{font-size:42px;padding:20px;cursor:pointer}.media-preview p{font-size:14px;padding:20px;text-align:center}
.media-status{position:absolute;top:0;left:0;right:0;background:rgba(0,0,0,.75);pointer-events:none}
.media-external{position:absolute;right:12px;top:12px;color:white;background:rgba(0,0,0,.8);font-size:12px;padding:6px 10px;border-radius:6px;max-width:calc(100% - 24px)}
.media-status+.media-external{top:auto;bottom:56px}
</style>
