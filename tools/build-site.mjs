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
 await fs.writeFile('docs/static-build.json',JSON.stringify({at:new Date().toISOString(),mode:'local preview; noindex',base:pagesBase||'/',count:written.length,routes:written},null,2));
 console.log(`Generated ${written.length} static preview pages with Vue SSR. Noindex; deployment not performed.`);
}finally{await fs.rm(path.join(root,'.ssr'),{recursive:true,force:true});}
