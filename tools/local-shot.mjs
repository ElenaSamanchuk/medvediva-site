// Adapted from platformax-app-hw-qa/chats37/tools/mshot.mjs.
// Public baseline only: no credentials, clicks, forms or payments.
import { chromium } from '/Users/elena/Projects/kinezio-hw-qa/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const [,,url,w,h,out,mode='mobile']=process.argv;
if (!url.startsWith('http://127.0.0.1:5176/')) throw new Error('Local preview only');
const b=await chromium.launch();
try {
 const c=await b.newContext({viewport:{width:+w,height:+h},deviceScaleFactor:mode==='mobile'?3:1,isMobile:mode==='mobile',hasTouch:mode==='mobile',locale:'ru-RU'});
 const p=await c.newPage();
 await p.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 await p.waitForSelector('[data-scene]');
 await p.evaluate(()=>document.fonts.ready);
 await p.waitForTimeout(1000);
 // Trigger source lazy media and scroll animations before the full-page baseline.
 const height=await p.evaluate(()=>document.documentElement.scrollHeight);
 for(let y=0;y<height;y+=Math.floor(+h*0.75)) {
  await p.evaluate(top=>window.scrollTo(0,top),y);
  await p.waitForTimeout(350);
 }
 await p.evaluate(()=>window.scrollTo(0,0));
 await p.waitForTimeout(2000);
 await p.screenshot({path:out,fullPage:true});
 fs.writeFileSync(out+'.json',JSON.stringify({url,viewport:{width:+w,height:+h},deviceScaleFactor:mode==='mobile'?3:1,isMobile:mode==='mobile',hasTouch:mode==='mobile',capturedAt:new Date().toISOString(),title:await p.title(),purpose:'local scene preview; visual acceptance pending'},null,2));
 console.log(out);
} finally {await b.close();}
