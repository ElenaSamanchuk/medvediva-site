<script setup>
import {ref,computed} from 'vue';
import {field} from '../lib/scene.mjs';
const props=defineProps({node:Object,screen:Number});const checked=ref(false);
const get=k=>field(props.node.fields,k,props.screen);
const inputStyle=computed(()=>({fontFamily:get('inputfontfamily'),fontSize:get('inputfontsize')+'px',color:get('inputcolor'),background:get('inputbgcolor'),border:`${get('inputbordersize')||1}px solid ${get('inputbordercolor')||'#ddd'}`,borderRadius:get('inputradius')+'px',minHeight:get('inputheight')+'px'}));
const buttonStyle=computed(()=>({color:get('buttoncolor'),background:get('buttonbgcolor'),width:get('buttonwidth')+'px',height:get('buttonheight')+'px',borderRadius:get('buttonradius')+'px',fontFamily:get('buttonfontfamily'),fontSize:get('buttonfontsize')+'px',fontWeight:get('buttonfontweight')}));
const types={em:'email',ph:'tel',nm:'text',in:'text',uw:'file',cb:'checkbox'};
</script>
<template>
 <form class="design-form" @submit.prevent="checked=true">
  <div v-for="(input,i) in node.inputs" :key="i" :style="{marginBottom:get('inputmargbottom')+'px'}">
   <label :for="`field-${node.id}-${i}`" :style="{fontSize:get('inputtitlefontsize')+'px',color:get('inputtitlecolor')}" v-if="input.li_title">{{input.li_title}}</label>
   <textarea v-if="input.li_type==='ta'" :id="`field-${node.id}-${i}`" :required="input.li_req==='y'" :rows="Number(input.li_rows)||3" :placeholder="input.li_ph" :style="inputStyle"></textarea>
   <input v-else :id="`field-${node.id}-${i}`" :aria-label="input.li_title||input.li_ph||input.li_nm" :type="types[input.li_type]||'text'" :required="input.li_req==='y'" :placeholder="input.li_ph" :style="inputStyle">
  </div>
  <button :style="buttonStyle">{{get('buttontitle')||'Отправить'}}</button>
  <p v-if="checked" role="status">Тестовая проверка завершена. Данные не отправлены.</p>
 </form>
</template>
<style scoped>.design-form label{display:block;margin-bottom:5px}.design-form input,.design-form textarea{width:100%;padding:12px;display:block;box-sizing:border-box}.design-form p{font-size:12px;margin-top:12px}</style>
