// Зеркало medvediva.kg (19.10.2026): страницы .ru под домен .kg — ЛК lk.medvediva.kg, цены в сомах как в ЛК,
// документы и футер из выгрузки Тильды .kg (tools/normalize_kg.py), без «Оборудования» и без упоминаний .ru.
import fs from 'node:fs';
import {kgsFromRub} from '../src/lib/site.mjs';

// Страницы .ru, которые есть на .kg; /mist — оформление 404
export const KG_RU_PAGES=['/','/pred','/pit','/tvg','/intensiv','/mist'];
const FOOTER='770878605';
// Сноска «*Meta… на территории РФ» и звёздочка у Instagram на главной — на .kg не нужны
const DROP_NODES=['1748596991584','1748597085689'];
// Всё про ВК на .kg не показываем: баннер «Дублируем информацию…» и блок «Перейти в ВК» на главной
const VK_SCENES=['2322512891','2315110691'];
const OVERLAYS=['860237765','1063609261','2019108731','2322512891',FOOTER];
// Документы .ru, которых на .kg нет → киргизский документ того же смысла
const DOCS={'/data-consent':'/personaldata','/consent':'/personaldata','/part_oferta':'/offer','/termsofuse':'/offer'};

const SEP=/[ \u00a0\u2009\u202f]/;
const PRICE=/(\d{1,3}(?:[ \u00a0\u2009\u202f]\d{3})+|\d+)((?:[ \u00a0\u2009\u202f]|<[^>]*>)*)(₽|руб\.|руб|рублей|рубля)/g;
export const conversions=[];
function price(text){
 return text.replace(PRICE,(match,number,between,currency)=>{
  const sep=number.match(SEP)?.[0]||'';const rub=Number(number.replace(/\D/g,''));const kgs=kgsFromRub(rub);
  const out=sep||kgs>=10000?String(kgs).replace(/\B(?=(\d{3})+(?!\d))/g,sep||'\u00a0'):String(kgs);
  conversions.push(`${number.replace(SEP,' ')} ${currency} → ${out.replace(SEP,' ')} сом`);
  return out+between+'сом';
 });
}
function hosts(text){
 return text.replaceAll('lk.medvediva.ru','lk.medvediva.kg').replaceAll('www.medvediva.ru','www.medvediva.kg')
  .replace(/(https?:\/\/)medvediva\.ru/g,'$1medvediva.kg');
}
function docs(text){
 return text.replace(/(href=\\?")(\/(?:data-consent|consent|part_oferta|termsofuse))(?=[\\"?#])/g,(m,a,path)=>a+DOCS[path]);
}
// Узлы со ссылкой на /invent (пункты меню «Оборудование») — убираем
function dropInvent(nodes){
 return (nodes||[]).filter(n=>!(n.href==='/invent'||/href="\/invent"/.test(n.html||'')||DROP_NODES.includes(n.id))).map(n=>n.children?{...n,children:dropInvent(n.children)}:n);
}
function text(value){return docs(hosts(price(value)));}

export function kgPage(page){
 const own=page.path==='/offer'||page.path==='/personaldata';
 // У страниц .ru свои копии шапки/футера (не показываются — берутся из общего макета), у документов .kg — свой футер
 const drop=own?kgFooterId():null;
 const scenes=page.scenes.filter(s=>own?s.id!==drop:!OVERLAYS.includes(s.id)&&!VK_SCENES.includes(s.id));
 const blocks=page.blocks.filter(b=>!(b.kind==='scene'&&!scenes.some(s=>s.id===b.id)));
 const result=JSON.parse(text(JSON.stringify({...page,scenes,blocks})));
 for(const scene of result.scenes)scene.nodes=dropInvent(scene.nodes);
 // В документах .kg термины были ссылками на copyright.ru (и ГК РФ) — ссылки снимаем, текст не меняем
 for(const block of result.blocks)if(block.html)block.html=block.html.replace(/<a\b[^>]*href="[^"]*copyright\.ru[^"]*"[^>]*>([\s\S]*?)<\/a>/g,'$1');
 return result;
}

let footer;
function kgFooterId(){footer??=JSON.parse(fs.readFileSync('public/content/kg54435731.json','utf8')).scenes[0];return footer.id;}
export function kgFooterScene(){
 kgFooterId();
 const scene=JSON.parse(JSON.stringify(footer));scene.id=FOOTER;
 // Логотип разработчика без ссылки на .ru; ссылки на сайт — относительные
 const strip=nodes=>(nodes||[]).forEach(n=>{if(/shumann\.ru/.test(n.href||''))n.href='';if(n.children)strip(n.children);});
 strip(scene.nodes);
 return JSON.parse(JSON.stringify(scene).replace(/https?:\/\/medvediva\.kg(?=\/)/g,''));
}
export function kgFooterCss(){
 const css=['public/content/kg54435731.css','public/content/kg54435731-layout.css'].filter(f=>fs.existsSync(f)).map(f=>fs.readFileSync(f,'utf8')).join('\n');
 return css.replaceAll(`#scene-${kgFooterId()}`,`#scene-${FOOTER}`).replaceAll(`#rec${kgFooterId()}`,`#rec${FOOTER}`);
}

export function kgLayout(layout){
 const scenes=layout.scenes.filter(s=>s.id!==FOOTER&&!VK_SCENES.includes(s.id)).map(s=>({...s,nodes:dropInvent(s.nodes)}));
 const result=JSON.parse(text(JSON.stringify({...layout,scenes})));
 result.scenes.push(kgFooterScene());
 return result;
}
// Без «Оборудования» «Интенсив» (width:100%) растягивался на его место — три пункта по центру плашки
const MENU_CSS='#scene-1063609261 [data-node="1745573724652"]{width:auto!important;flex-shrink:0!important}\n#scene-1063609261 #group-174557372464764350{justify-content:center}';
export function kgLayoutCss(css){
 return css.split('\n').filter(line=>!line.includes(`#scene-${FOOTER} `)&&!line.includes(`#scene-${FOOTER}{`)).join('\n')+'\n'+kgFooterCss()+'\n'+MENU_CSS;
}
