// Generates only local files. No upload, DNS changes, third-party scripts or API calls.
import {compileLayouts} from './compile-layout.mjs';
import {compileSharedLayout} from './compile-shared-layout.mjs';
import {normalizeBase,prefixRootUrls,withBase} from '../src/lib/site-base.mjs';
import {build} from 'vite';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs/promises';import path from 'node:path';
const root=process.cwd();const dist=path.join(root,'dist');
const pagesBase=normalizeBase(process.env.SITE_BASE||'/');
const asset=target=>withBase(target,pagesBase);
compileLayouts();
const sharedLayout=compileSharedLayout();
await build();
const shell=await fs.readFile(path.join(dist,'index.html'),'utf8');
const routes=JSON.parse(await fs.readFile('public/content/routes.json','utf8'));
await build({publicDir:false,build:{ssr:'src/entry-server.js',outDir:'.ssr',emptyOutDir:true}});
const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=s=>JSON.stringify(s).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
function heroImages(page){
 const skip=new Set(['860237765','1063609261','2019108731','2322512891',...(page.popups||[]).flatMap(p=>(p.scenes||[]).map(x=>String(x).replace(/^rec/,'')))]);
 const first=(page.blocks||[]).find(b=>b.kind!=='anchor'&&b.kind!=='spacer'&&!skip.has(String(b.id)));const scene=(page.scenes||[]).find(sc=>sc.id===first?.id);if(!scene)return [];
 const urls=[];const walk=o=>{if(!o||typeof o!=='object')return;if(Array.isArray(o))return o.forEach(walk);
  if(o.type&&o.background)urls.push(o.background);
  if(o.type&&typeof o.atomStyle==='string')for(const m of o.atomStyle.matchAll(/url\(['"]?([^'")]+)['"]?\)/g))urls.push(m[1]);
  if(o.type==='image'&&typeof o.html==='string')for(const m of o.html.matchAll(/src="([^"]+)"/g))urls.push(m[1]);
  Object.values(o).forEach(walk);};
 walk(scene.nodes);
 return [...new Set(urls)].filter(u=>u.startsWith('/media/')&&!u.endsWith('.svg')).slice(0,5);
}
const written=[];
try{
 const {render}=await import(pathToFileURL(path.join(root,'.ssr/entry-server.js')).href);
 for(const route of routes){
  const page=JSON.parse(await fs.readFile(`public/content/${route.page}.json`,'utf8'));
  page.aliases=[`/page${route.page}.html`];
  const body=await render(page,sharedLayout);
  let html=shell.replace(/<title>.*?<\/title>/s,`<title>${escape(page.title)}</title>`).replace('<meta name="description" content="">',`<meta name="description" content="${escape(page.description)}">`);
  const image=page.image?.startsWith('/media/')?`<meta property="og:image" content="https://medvediva.ru${escape(page.image)}">`:'';
  const structured=(page.structuredData||[]).map(d=>`<script type="application/ld+json">${json(d)}</script>`).join('');
  html=html.replace('</head>',image+structured+`<link rel="canonical" href="${escape(page.canonical)}"><meta property="og:title" content="${escape(page.title)}"><meta property="og:description" content="${escape(page.description)}"><meta property="og:url" content="${escape(page.canonical)}"><link rel="stylesheet" href="${asset(`/content/${route.page}.css`)}"><link rel="stylesheet" href="${asset(`/content/${route.page}-layout.css`)}"></head>`);
  html=html.replace('</head>',`<link rel="stylesheet" href="${asset('/content/shared-layout.css')}"></head>`);
  // Предзагрузка картинок первого экрана: фоны и img первого блока качаются сразу, с высоким приоритетом (15.10.2026)
  html=html.replace('</head>',heroImages(page).map(u=>`<link rel="preload" as="image" href="${asset(u)}" fetchpriority="high">`).join('')+'</head>');
  html=html.replace('<div id="app"></div>',`<div id="app">${body}</div><script type="application/json" id="site-page">${json(page)}</script><script type="application/json" id="site-layout">${json(sharedLayout)}</script>`);
  const filename=route.path==='/'?'index.html':route.path.endsWith('.html')?route.path.slice(1):route.path.slice(1)+'/index.html';const target=path.resolve(dist,filename);
  if(!target.startsWith(dist+path.sep))throw new Error('Invalid output path');
  await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,html);written.push(route.path);
  const alias=`/page${route.page}.html`;if(!routes.some(r=>r.path===alias))await fs.writeFile(path.join(dist,alias.slice(1)),html);
 }
 // 404 — оформленная страница /mist, как настроено на Тильде (14.10.2026)
 const mist=await fs.readFile(path.join(dist,'mist/index.html'),'utf8').catch(()=>null);
 await fs.writeFile(path.join(dist,'404.html'),mist?mist.replace('</head>','<meta name="robots" content="noindex"></head>').replace(/(<script type="application\/json" id="site-page">)\{/,'$1{"notFound":true,'):shell.replace('<div id="app"></div>',`<div id="app"><main><h1>Страница не найдена</h1><a href="${asset('/')}">На главную</a></main></div>`));
 await fs.writeFile(path.join(dist,'robots.txt'),'User-agent: *\nDisallow: /\n');
 if(pagesBase){
  await fs.writeFile(path.join(dist,'.nojekyll'),'');
  const cssFiles=[];
  const walkCss=async dir=>{for(const entry of await fs.readdir(dir,{withFileTypes:true})){const target=path.join(dir,entry.name);if(entry.isDirectory())await walkCss(target);else if(entry.name.endsWith('.css'))cssFiles.push(target);}};
  await walkCss(dist);
  for(const file of cssFiles){
   const css=await fs.readFile(file,'utf8');
   const next=prefixRootUrls(css,pagesBase);
   if(next!==css)await fs.writeFile(file,next);
  }
 }
 // Картинки PNG → WebP без потерь (то же разрешение, cwebp -lossless -exact), если WebP легче хотя бы на 5% (15.10.2026).
 // og:image и "image" страницы оставляем PNG: не все мессенджеры понимают WebP.
 {
  const media=path.join(dist,'media');const lighter=new Set();
  for(const name of await fs.readdir(media).catch(()=>[])){if(!name.endsWith('.webp'))continue;const png=name.replace(/\.webp$/,'.png');
   const [a,b]=await Promise.all([fs.stat(path.join(media,png)).catch(()=>null),fs.stat(path.join(media,name))]);if(a&&b.size<a.size*0.95)lighter.add(png.replace(/\.png$/,''));}
  const files=[];const walk=async dir=>{for(const entry of await fs.readdir(dir,{withFileTypes:true})){const target=path.join(dir,entry.name);if(entry.isDirectory()){if(entry.name!=='media')await walk(target);}else if(/\.(html|css|json)$/.test(entry.name))files.push(target);}};
  await walk(dist);
  const keep=/(og:image|twitter:image)"\s+content="[^"]*$|"image":"[^"]*$/;
  for(const file of files){const text=await fs.readFile(file,'utf8');
   const next=text.replace(/\/media\/([0-9a-f]{24})\.png/g,(m,h,offset,whole)=>lighter.has(h)&&!keep.test(whole.slice(Math.max(0,offset-120),offset))?`/media/${h}.webp`:m);
   if(next!==text)await fs.writeFile(file,next);}
  // PNG, заменённые на WebP и больше нигде не упомянутые, в сборку не кладём — без дублей (15.10.2026)
  const used=new Set();for(const file of files){for(const m of (await fs.readFile(file,'utf8')).matchAll(/\/media\/([0-9a-f]{24})\.png/g))used.add(m[1]);}
  for(const h of lighter)if(!used.has(h))await fs.rm(path.join(media,h+'.png'),{force:true});
 }
 // Дизайн-система: почти одинаковые оттенки → токены, кегли 13/15 → шкала (аудит 15.10.2026, решение Елены).
 // Только в CSS-значениях (после «:», «,», «(» или пробела); атрибуты SVG fill="#…" не трогаем — там var() не работает.
 {
  const colorTokens={'4369a3':'--c-pit,#4269a3','4c72aa':'--c-pit,#4269a3','7195c9':'--c-pit-light,#7697c7','7b9ed1':'--c-pit-light,#7697c7','7697c7':'--c-pit-light,#7697c7','282930':'--c-ink,#262626','252628':'--c-ink,#262626','242424':'--c-ink,#262626','ebebeb':'--c-line-soft,#eaeaea','ececec':'--c-line-soft,#eaeaea','e9e9e9':'--c-line-soft,#eaeaea','f6f6f6':'--c-surface,#f5f5f5'};
  const colorRe=new RegExp(`(?<=[:,(\\s])#(${Object.keys(colorTokens).join('|')})(?![0-9a-f])`,'gi');
  const files=[];const walk=async dir=>{for(const entry of await fs.readdir(dir,{withFileTypes:true})){const target=path.join(dir,entry.name);if(entry.isDirectory()){if(!['media','fonts','assets'].includes(entry.name))await walk(target);}else if(/\.(css|json)$/.test(entry.name))files.push(target);}};
  await walk(path.join(dist,'content'));
  for(const file of files){const text=await fs.readFile(file,'utf8');
   const next=text.replace(colorRe,(m,h)=>`var(${colorTokens[h.toLowerCase()]})`).replace(/font-size:\s*(13|15)px/g,(m,v)=>`font-size:var(--fs-${v},${v}px)`);
   if(next!==text)await fs.writeFile(file,next);}
 }
 await fs.writeFile('docs/static-build.json',JSON.stringify({at:new Date().toISOString(),mode:'local preview; noindex',base:pagesBase||'/',count:written.length,routes:written},null,2));
 console.log(`Generated ${written.length} static preview pages with Vue SSR. Noindex; deployment not performed.`);
}finally{await fs.rm(path.join(root,'.ssr'),{recursive:true,force:true});}
