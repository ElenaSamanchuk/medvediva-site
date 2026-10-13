<script setup>
import SceneBlock from './SceneBlock.vue';
defineProps({scene:Object,width:Number});
</script>
<template><header v-if="scene" class="native-header"><SceneBlock :scene="scene" :width="width" /></header></template>
