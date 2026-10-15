<script setup>
import {computed} from 'vue';
import {embedSrc} from '../lib/media.mjs';
const props=defineProps({url:String});
// Видео — iframe-плеер сервиса (Kinescope, YouTube, Vimeo, VK), лениво: грузится у экрана или при открытии попапа (15.10.2026)
const src=computed(()=>embedSrc(props.url));
</script>
<template>
 <div class="media-preview">
  <iframe v-if="src" :src="src" title="Видео" loading="lazy" allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; screen-wake-lock" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
  <p v-else>Видео пока недоступно</p>
 </div>
</template>
<style scoped>
.media-preview{position:relative;width:100%;aspect-ratio:16/9;min-height:160px;background:#191919;display:grid;place-items:center;color:white;overflow:hidden}
.media-preview iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block}
.media-preview p{font-size:14px;padding:20px;text-align:center}
</style>
