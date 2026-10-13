import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const files=walk('dist');
for(const file of files){
 assert(!/(\.pem$|\/\.env|\/sources\/|\/node_modules\/|\.zip$)/i.test(file),`Forbidden release file: ${file}`);
 if(/\.(html|js|json|css)$/.test(file))assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(fs.readFileSync(file,'utf8')),`Private key found: ${file}`);
}
for(const file of ['dist/index.html','dist/invent/index.html','dist/404.html'])assert.match(fs.readFileSync(file,'utf8'),/noindex/);
assert.match(fs.readFileSync('dist/robots.txt','utf8'),/Disallow: \/\s/);
console.log(`Release check passed: ${files.length} built files, noindex retained.`);
