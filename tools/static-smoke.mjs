// Local static build checks; synthetic query and no delivery.
import {chromium} from '/Users/elena/Projects/kinezio-hw-qa/node_modules/playwright/index.mjs';import assert from 'node:assert/strict';import fs from 'node:fs';
const origin='http://127.0.0.1:4176';const results=[];
for(const pathname of ['/','/pit','/intensiv','/tvg','/page51404777.html','/QA-not-existing-page']){
 const response=await fetch(origin+pathname);const html=await response.text();assert.equal(response.status,pathname.startsWith('/QA-')?404:200);assert.match(html,/noindex/);
 if(!pathname.startsWith('/QA-')){assert.match(html,/<link rel="canonical"/);assert.match(html,/<div id="app">[\s\S]+<main/);}
 results.push({path:pathname,status:response.status,bytes:Buffer.byteLength(html),noindex:true});
}
const reject=await fetch(origin+'/api/forms/support',{method:'POST',body:'QA-dry-run'});assert.equal(reject.status,405);
const browser=await chromium.launch();try{
 const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:1440,height:1000}});const page=await nojs.newPage();await page.goto(origin+'/');assert.match(await page.locator('main').innerText(),/КУРСЫ/);await page.screenshot({path:'screens-local/web-home-nojs-1440.png',fullPage:true});await nojs.close();
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});const p=await context.newPage();const errors=[],posts=[],external=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.method()==='POST')posts.push('POST');if(!r.url().startsWith(origin))external.push(new URL(r.url()).hostname);});
 await p.goto(origin+'/?r=QA-static#form_teh',{waitUntil:'networkidle'});await p.waitForSelector('form');assert.equal(await p.locator('[name="ref_id"]').inputValue(),'QA-static');await p.getByRole('textbox',{name:'Вопрос',exact:true}).fill('QA-проверка статической сборки');await p.getByRole('textbox',{name:'Адрес электронной почты',exact:true}).fill('qa@example.invalid');await p.getByRole('button',{name:'Отправить',exact:true}).click();assert.equal(await p.getByText('Тестовая проверка завершена. Сообщение не отправлено.',{exact:true}).count(),1);await p.screenshot({path:'screens-local/web-mob-support-popup-390.png'});await p.keyboard.press('Escape');
 assert.deepEqual(errors,[]);assert.deepEqual(posts,[]);assert.deepEqual(external,[]);await context.close();
 fs.writeFileSync('docs/static-smoke.json',JSON.stringify({at:new Date().toISOString(),routes:results,postGuard:405,noJS:'main text visible',mobile:'popup/referral/dry-run',errors,posts,external},null,2));console.log(JSON.stringify({routes:results,postGuard:405,noJS:'main text visible',errors,posts,external}));
}finally{await browser.close();}
