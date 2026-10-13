// Local route sweep adapted from form-smoke.mjs. No public site mutations or external calls.
import {chromium} from '/Users/elena/Projects/kinezio-hw-qa/node_modules/playwright/index.mjs';import fs from 'node:fs';
const routes=JSON.parse(fs.readFileSync('public/content/routes.json','utf8'));const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ru-RU'});const page=await context.newPage();const results=[];let errors=[],external=[],failed=[];
const safeUrl=value=>{try{const url=new URL(value);return url.origin+url.pathname+(url.search?'?[redacted]':'');}catch{return '[invalid URL]';}};
page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(safeUrl(r.url())));
await page.route('**/*',async route=>{const request=route.request();if(!request.url().startsWith('http://127.0.0.1:5176/')||request.method()!=='GET'){external.push({url:safeUrl(request.url()),method:request.method()});await route.abort();}else await route.continue();});
try{
 for(const route of routes){errors=[];external=[];failed=[];let result;
  try{await page.goto('http://127.0.0.1:5176'+route.path,{waitUntil:'networkidle',timeout:20000});await page.waitForSelector('main',{timeout:10000,state:'attached'});
   result=await page.evaluate(()=>({title:document.title,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,scenes:document.querySelectorAll('[data-scene]').length,broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)}));
  }catch(e){result={exception:e.message.split('\n')[0]};}
  results.push({path:route.path,...result,errors:[...errors],external:[...external],failed:[...failed],unsupported:route.unsupported.map(b=>b.type),missingMediaCount:route.missingMediaCount});
  if(results.length%20===0)console.log(`Checked ${results.length}/${routes.length}`);
 }
 fs.writeFileSync('docs/routes-smoke.json',JSON.stringify({at:new Date().toISOString(),scope:'1440 local loading only; visual states/backend not accepted',results},null,2));
 console.log(JSON.stringify({count:results.length,issues:results.filter(r=>r.exception||r.errors.length||r.external.length||r.failed.length||r.broken?.length||r.scrollWidth>r.width).map(r=>({path:r.path,exception:r.exception,errors:r.errors,external:r.external,failed:r.failed,broken:r.broken,width:r.width,scrollWidth:r.scrollWidth}))}));
}finally{await context.close();await browser.close();}
