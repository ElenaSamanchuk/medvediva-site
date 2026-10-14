import { createApp } from 'vue';
import App from './App.vue';
import {stripBase} from './lib/site-base.mjs';
import './style.css';
const seed=document.getElementById('site-page');
const data=seed?JSON.parse(seed.textContent):undefined;
const currentPath=stripBase(location.pathname);
// 404.html несёт модель /mist с флагом notFound — показываем её на любом неизвестном адресе
const initialPage=data&&(data.notFound||data.path===currentPath||data.aliases?.includes(currentPath))?data:undefined;
const layoutSeed=document.getElementById('site-layout');
createApp(App,{initialPage,initialLayout:layoutSeed?JSON.parse(layoutSeed.textContent):undefined}).mount('#app');
