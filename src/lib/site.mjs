// Какой сайт собираем: medvediva.ru (по умолчанию) или зеркало medvediva.kg — сборка с VITE_SITE=kg (19.10.2026).
// Зеркало: те же страницы, ЛК lk.medvediva.kg (та же школа, те же тарифы), цены в сомах, документы и футер с .kg.
const kg=import.meta.env?.VITE_SITE==='kg';

export const SITE=kg?{
 id:'kg',
 origin:'https://medvediva.kg',
 hosts:['medvediva.kg','www.medvediva.kg'],
 lkHosts:['lk.medvediva.kg']
}:{
 id:'ru',
 origin:'https://medvediva.ru',
 hosts:['medvediva.ru','www.medvediva.ru'],
 lkHosts:['lk.medvediva.ru']
};

// Сомы считаются как в ЛК: рубли × 1,05 с округлением до 5 (все тарифы lk.medvediva.kg, 19.10.2026)
export function kgsFromRub(rub){return Math.round(Number(rub)*1.05/5)*5;}
export function sitePrice(rub){return SITE.id==='kg'?kgsFromRub(rub):Number(rub);}
export const CURRENCY=SITE.id==='kg'?'сом':'₽';
