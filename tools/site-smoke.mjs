// Adapted from tools/form-smoke.mjs (qa-kit workflow). Local only; synthetic data, no delivery.
import { chromium } from '/Users/elena/Projects/kinezio-hw-qa/node_modules/playwright/index.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';
const browser=await chromium.launch();const results=[];
try{
 for(const [width,height,mobile] of [[1440,1000,false],[390,844,true],[320,693,true],[768,1024,true]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:mobile?3:1,isMobile:mobile,hasTouch:mobile,locale:'ru-RU'});
  const p=await context.newPage();const requests=[],errors=[],failed=[];
  p.on('request',r=>requests.push({url:r.url(),method:r.method()}));p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>failed.push(r.url()));
  await p.goto('http://127.0.0.1:5176/',{waitUntil:'networkidle'});await p.waitForSelector('[data-scene]');await p.evaluate(()=>document.fonts.ready);
  await p.locator('[data-node="1773213623325000005"] button').click();assert.equal(await p.locator('.native-cookie').count(),0);
  await p.reload({waitUntil:'networkidle'});assert.equal(await p.locator('.native-cookie').count(),0);
  if(width<960){await p.locator('[href="#menuopen"]').click();assert.equal(await p.locator('.native-menu').count(),1);await p.getByRole('button',{name:'Закрыть меню',exact:true}).click();}
  await p.locator('[data-node="1731073040214"] a').click();assert.equal(await p.getByRole('dialog').count(),1);assert.equal(await p.locator('.native-dialog li').count(),12);await p.keyboard.press('Escape');assert.equal(await p.getByRole('dialog').count(),0);
  await p.goto('http://127.0.0.1:5176/#form_teh',{waitUntil:'networkidle'});await p.getByRole('button',{name:'Отправить',exact:true}).click();assert.equal(await p.getByText('Введите вопрос',{exact:true}).count(),1);
  await p.getByRole('textbox',{name:'Вопрос',exact:true}).fill('QA-локальная проверка');await p.getByRole('textbox',{name:'Адрес электронной почты',exact:true}).fill('qa@example.invalid');await p.getByRole('button',{name:'Отправить',exact:true}).click();assert.equal(await p.getByText('Тестовая проверка завершена. Сообщение не отправлено.',{exact:true}).count(),1);await p.keyboard.press('Escape');
  const dimensions=await p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)}));
  assert.ok(dimensions.scrollWidth<=dimensions.width);assert.deepEqual(dimensions.broken,[]);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  const external=requests.filter(r=>!r.url.startsWith('http://127.0.0.1:5176/'));assert.deepEqual(external,[]);assert.equal(requests.filter(r=>r.method==='POST').length,0);
  results.push({width,height,mobile,dimensions,cookie:'accepted and persisted',menu:width<960?'open/close':'desktop links',educationPopup:'12 items; Escape',support:'validation/dry-run',external,errors,failed});await context.close();
 }
 fs.writeFileSync('docs/site-smoke.json',JSON.stringify({date:new Date().toISOString(),scope:'local main page; no visual acceptance or delivery claim',results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
