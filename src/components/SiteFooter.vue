<script setup>
import SceneBlock from './SceneBlock.vue';
defineProps({scene:Object,width:Number});
</script>
<template><footer v-if="scene"><SceneBlock :scene="scene" :width="width" /></footer></template>
