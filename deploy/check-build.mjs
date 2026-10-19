import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const files=walk('dist');
for(const file of files){
 assert(!/(\.pem$|\/\.env|\/sources\/|\/node_modules\/|\.zip$)/i.test(file),`Forbidden release file: ${file}`);
 if(/\.(html|js|json|css)$/.test(file))assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(fs.readFileSync(file,'utf8')),`Private key found: ${file}`);
}
for(const route of ['support','delete','testform'])assert(!fs.existsSync(`dist/${route}`),`Excluded page built: /${route}`);
assert.match(fs.readFileSync('dist/404.html','utf8'),/noindex/);
if(process.env.VITE_SITE==='kg'){
 // Зеркало medvediva.kg: только его страницы, цены в сомах, без .ru (кроме технических скриптов и документов .kg)
 for(const route of ['index.html','pred/index.html','pit/index.html','tvg/index.html','intensiv/index.html','offer/index.html','personaldata/index.html'])assert(fs.existsSync(`dist/${route}`),`Missing kg page: ${route}`);
 assert(!fs.existsSync('dist/invent'),'invent must not be in kg build');
 for(const file of files.filter(f=>/\.(html|json)$/.test(f))){
  const text=fs.readFileSync(file,'utf8');
  assert.doesNotMatch(text,/₽|\bруб\.|lk\.medvediva\.ru|https?:\/\/(?:www\.)?medvediva\.ru/,`ru leftovers in ${file}`);
  assert.doesNotMatch(text,/vk\.com|Перейти в\s*ВК|Дублируем информацию/,`VK leftovers in ${file}`);
  assert.doesNotMatch(text,/copyright\.ru/,`copyright.ru in ${file}`);
 }
 assert.match(fs.readFileSync('dist/sitemap.xml','utf8'),/<loc>https:\/\/medvediva\.kg\/?<\/loc>/);
 assert.doesNotMatch(fs.readFileSync('dist/index.html','utf8'),/noindex/);
 console.log(`Release check passed: ${files.length} built files, medvediva.kg mirror.`);
}else if(process.env.SITE_MODE==='production'){
 for(const file of ['dist/index.html','dist/invent/index.html','dist/pit/index.html'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/noindex/,`noindex in production: ${file}`);
 assert.doesNotMatch(fs.readFileSync('dist/robots.txt','utf8'),/Disallow: \/\s/);
 assert.match(fs.readFileSync('dist/sitemap.xml','utf8'),/<loc>https:\/\/medvediva\.ru\/?<\/loc>/);
 assert.match(fs.readFileSync('dist/index.html','utf8'),/yandex-verification/);
 console.log(`Release check passed: ${files.length} built files, production (indexable, sitemap).`);
}else{
 for(const file of ['dist/index.html','dist/invent/index.html'])assert.match(fs.readFileSync(file,'utf8'),/noindex/);
 assert.match(fs.readFileSync('dist/robots.txt','utf8'),/Disallow: \/\s/);
 console.log(`Release check passed: ${files.length} built files, noindex retained.`);
}
