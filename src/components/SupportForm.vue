<script setup>
import {localStore,sessionStore} from '../lib/storage.mjs';
import { reactive, ref } from 'vue';
import { submitSupport } from '../lib/support.mjs';
const props=defineProps({mode:{type:String,default:'unconfigured'},endpoint:{type:String,default:''},showIntro:{type:Boolean,default:true}});
const fields=reactive({telegram:'',message:'',email:'',phone:'',refId:typeof window==='undefined'?'':new URLSearchParams(location.search).get('r')||localStore.getItem('r')||''});
const errors=ref({}),state=ref('idle');
const notices={
 'dry-run':'Тестовая проверка завершена. Сообщение не отправлено.',
 delivered:'Сообщение отправлено.',
 unavailable:'Отправка временно недоступна. Обратитесь в поддержку.',
 unconfirmed:'Доставка пока не подтверждена. Не отправляйте сообщение повторно.',
 error:'Не удалось подтвердить отправку. Попробуйте позже или обратитесь в поддержку.'
};
async function submit(){
 if(state.value==='sending')return;
 state.value='sending'; errors.value={};
 const result=await submitSupport({...fields},{mode:props.mode,endpoint:props.endpoint});
 errors.value=result.errors??{}; state.value=result.state;
}
</script>
<template>
 <section class="mx-auto w-full max-w-[560px] rounded-[10px] bg-white" :class="showIntro?'p-5 sm:p-10':''">
  <div v-if="showIntro"><h2 class="mb-5 text-2xl font-semibold">Задать вопрос</h2>
  <p class="mb-4 text-sm leading-6">Обращаем ваше внимание, что самый быстрый способ получить ответ на вопрос — задать его в чат поддержки на сайте.</p>
  <p class="mb-4 text-sm leading-6">Если вы хотите задать вопрос по этой форме — то ответ придется ждать дольше.</p>
  <p class="mb-4 text-sm leading-6">❗️Техподдержка отвечает только на технические вопросы: доступ в личный кабинет, пароли, другие проблемы с сайтом или личным кабинетом и тому подобные.</p>
  <p class="mb-6 text-sm leading-6">❗️Время работы техподдержки: 10:00–19:00 МСК</p>
  </div>
  <form class="space-y-4" novalidate @submit.prevent="submit">
   <input type="hidden" name="ref_id" :value="fields.refId">
   <div v-for="field in [{key:'telegram',placeholder:'Ник в телеграм через @',type:'text'},{key:'message',placeholder:'Вопрос',type:'textarea'},{key:'email',placeholder:'Адрес электронной почты',type:'email'},{key:'phone',placeholder:'Номер телефона',type:'tel'}]" :key="field.key">
    <label :for="`support-${field.key}`" class="sr-only">{{ field.placeholder }}</label>
    <textarea v-if="field.type==='textarea'" :id="`support-${field.key}`" v-model="fields[field.key]" :placeholder="field.placeholder" required rows="3" maxlength="10000" :aria-invalid="Boolean(errors[field.key])" :aria-describedby="errors[field.key]?`error-${field.key}`:undefined" class="min-h-[102px] w-full rounded-[10px] border border-[#d6d6d6] p-4 focus:outline-2 focus:outline-support-blue"></textarea>
    <input v-else :id="`support-${field.key}`" v-model="fields[field.key]" :type="field.type" :placeholder="field.placeholder" :required="field.key==='email'" :autocomplete="field.key==='email'?'email':field.key==='phone'?'tel':'off'" :maxlength="field.key==='phone'?64:255" :aria-invalid="Boolean(errors[field.key])" :aria-describedby="errors[field.key]?`error-${field.key}`:undefined" class="min-h-14 w-full rounded-[10px] border border-[#d6d6d6] p-4 focus:outline-2 focus:outline-support-blue">
    <p v-if="errors[field.key]" :id="`error-${field.key}`" class="mt-1 text-sm text-red-700">{{ errors[field.key] }}</p>
   </div>
   <button :disabled="state==='sending'" class="min-h-14 w-full rounded-[10px] bg-support-blue px-5 py-4 font-semibold text-white hover:bg-[#48a3ff] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-support-blue disabled:opacity-60">{{ state==='sending'?'Отправка…':'Отправить' }}</button>
   <p v-if="notices[state]" role="status" aria-live="polite" class="text-sm leading-6">{{ notices[state] }}</p>
  </form>
 </section>
</template>
