// Adapted from platformax-app-hw-qa/chats37/tools/mshot.mjs. Local QA data only.
import { chromium } from '/Users/elena/Projects/kinezio-hw-qa/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const b=await chromium.launch(),results=[];
try {
 for(const [width,height,mobile] of [[1440,1000,false],[390,844,true],[320,693,true]]){
  const c=await b.newContext({viewport:{width,height},deviceScaleFactor:mobile?3:1,isMobile:mobile,hasTouch:mobile,locale:'ru-RU'});
  const p=await c.newPage(),posts=[],errors=[];
  p.on('request',r=>{if(r.method()==='POST')posts.push(r.url())});
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:5176/__preview/support',{waitUntil:'networkidle'});
  await p.getByRole('button',{name:'Отправить',exact:true}).click();
  assert.equal(await p.getByText('Введите вопрос',{exact:true}).count(),1);
  assert.equal(await p.getByText('Введите корректный адрес электронной почты',{exact:true}).count(),1);
  await p.getByRole('textbox',{name:'Вопрос',exact:true}).fill('QA-локальная проверка');
  await p.getByRole('textbox',{name:'Адрес электронной почты',exact:true}).fill('qa@example.invalid');
  await p.getByRole('button',{name:'Отправить',exact:true}).click();
  assert.equal(await p.getByText('Тестовая проверка завершена. Сообщение не отправлено.',{exact:true}).count(),1);
  const measured=await p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
  assert.ok(measured.scrollWidth<=measured.width);
  assert.equal(posts.length,0);assert.deepEqual(errors,[]);
  const file=`screens-local/${mobile?'web-mob':'web'}-support-${width}.png`;
  if(mobile)await p.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  await p.screenshot({path:file,fullPage:!mobile});
  results.push({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?3:1,validation:'pass',dryRun:'pass',postCount:posts.length,pageErrors:errors,measured,screenshot:file});
  await c.close();
 }
 fs.writeFileSync('docs/form-smoke.json',JSON.stringify({capturedAt:new Date().toISOString(),scope:'local component only; no public site or delivery QA',results},null,2));
 console.log(JSON.stringify(results));
}finally{await b.close();}
