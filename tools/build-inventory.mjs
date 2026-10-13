// Offline inventory of public source snapshots. Does not execute acquired HTML/JS.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base='https://medvediva.ru';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'sources/route-manifest.json'),'utf8'));
const known=new Map(manifest.routes.map(r=>[new URL(r.url).pathname,{...r,origins:['sitemap'],migration:'not_implemented'}]));
const storePath=path.join(root,'sources/live/sitemap-store.xml');
const external=[];
if(fs.existsSync(storePath)) for(const m of fs.readFileSync(storePath,'utf8').matchAll(/<loc>(.*?)<\/loc>/g)){
 const url=new URL(m[1]);
 if(url.hostname!=='medvediva.ru'){external.push({url:url.href,source:'sitemap-store',decision:'owner_confirmation_required'});continue;}
 if(!known.has(url.pathname))known.set(url.pathname,{url:url.href,origins:['sitemap-store'],status:'pending',migration:'not_implemented'});
}
const robots=fs.readFileSync(path.join(root,'sources/live/robots.txt'),'utf8');
const exclusions=[];
for(const m of robots.matchAll(/^Disallow:\s*(\S+)\s*$/gm)){
 const route=m[1];
 if(route.includes('*')){exclusions.push(route);continue;}
 if(!known.has(route))known.set(route,{url:base+route,origins:['robots'],status:'pending',migration:'not_implemented',indexing:'disallowed'});
 else known.get(route).indexing='disallowed';
}
const assets=new Map(),integrations=new Map();
for(const row of manifest.routes){
 if(row.status!=='captured'||!row.file)continue;
 const html=fs.readFileSync(path.join(root,row.file),'utf8');
 for(const href of row.links??[]){
  let url;try{url=new URL(href,row.url);}catch{continue;}
  if(url.hostname==='medvediva.ru'&&!url.pathname.startsWith('/members/')&&!url.pathname.startsWith('/tilda/')){
   if(!known.has(url.pathname)) known.set(url.pathname,{url:base+url.pathname,origins:['link'],status:'pending',migration:'not_implemented'});
  }
 }
 const urls=[...(row.assets??[]),...[...html.matchAll(/(?:url\(["']?|https?:\/\/)[^\s"'<>)}]+/g)].map(m=>m[0].replace(/^url\(["']?/,''))];
 for(const raw of urls){
  let url;try{url=new URL(raw.replaceAll('&amp;','&'),row.url);}catch{continue;}
  if(!['https:','http:'].includes(url.protocol))continue;
  const u=url.href;
  if(!assets.has(u))assets.set(u,{url:u,pages:[],acquisition:'pending',sha256:null});
  if(!assets.get(u).pages.includes(row.url))assets.get(u).pages.push(row.url);
  if(url.hostname!==new URL(row.url).hostname){
   if(!integrations.has(url.hostname))integrations.set(url.hostname,{host:url.hostname,pages:[],classification:/tilda/.test(url.hostname)?'replace_dependency':'review_business_or_media',verified:'source_only'});
   if(!integrations.get(url.hostname).pages.includes(row.url))integrations.get(url.hostname).pages.push(row.url);
  }
 }
}
const result={generatedAt:new Date().toISOString(),complete:false,sourceCaptureComplete:manifest.routes.every(r=>r.status==='captured'),routes:[...known.values()],externalLegacyRoutes:external,servicePatterns:exclusions,counts:{sitemap:manifest.routes.length,captured:manifest.routes.filter(r=>r.status==='captured').length,failed:manifest.routes.filter(r=>r.status==='capture_failed').length,discovered:[...known.values()].length,assetCandidates:assets.size},scope:'Inventory is not functional or visual QA. Asset candidates include integration URLs; reconcile before downloading.'};
fs.writeFileSync(path.join(root,'sources/migration-manifest.json'),JSON.stringify(result,null,2));
fs.writeFileSync(path.join(root,'sources/asset-candidates.json'),JSON.stringify([...assets.values()],null,2));
fs.writeFileSync(path.join(root,'sources/integration-hosts.json'),JSON.stringify([...integrations.values()],null,2));
fs.writeFileSync(path.join(root,'docs/ROUTES.md'),'# Маршруты Medvediva\n\nАвтоматический инвентарь; полнота не подтверждена. Ни один маршрут ещё не перенесён.\n\n| Путь | Источник | HTML | Миграция |\n|---|---|---|---|\n'+result.routes.map(r=>`| \`${new URL(r.url).pathname}\` | ${r.origins.join(', ')} | ${r.status} | ${r.migration} |`).join('\n')+'\n');
console.log(JSON.stringify(result.counts));
