<script setup>
import {ref} from 'vue';const props=defineProps({pictures:Array});const index=ref(0);function move(delta){index.value=(index.value+delta+props.pictures.length)%props.pictures.length;}
</script>
<template><div class="design-gallery" v-if="pictures?.length"><img :src="pictures[index].src" :alt="pictures[index].alt"><button class="previous" aria-label="Предыдущее изображение" @click="move(-1)">‹</button><button class="next" aria-label="Следующее изображение" @click="move(1)">›</button></div></template>
<style scoped>.design-gallery{height:100%;width:100%;position:relative;overflow:hidden}.design-gallery img{height:100%;width:100%;object-fit:cover}.design-gallery button{position:absolute;top:45%;background:#474747;color:#fff;border-radius:50%;width:34px;height:34px;font-size:24px}.previous{left:10px}.next{right:10px}</style>
