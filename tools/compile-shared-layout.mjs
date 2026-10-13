import fs from 'node:fs';
const ids=['1063609261','860237765','2322512891','2019108731','770878605'];
export function compileSharedLayout(){
 const home=JSON.parse(fs.readFileSync('public/content/51404777.json','utf8'));
 const layout={scenes:home.scenes.filter(s=>ids.includes(s.id)),popups:home.popups.filter(p=>['#form_teh','#popup_ed','#popup:bot'].includes(p.hook))};
 fs.writeFileSync('public/content/shared-layout.json',JSON.stringify(layout));
 const css=['public/content/51404777.css','public/content/51404777-layout.css'].flatMap(file=>fs.readFileSync(file,'utf8').split('\n')).filter(line=>ids.some(id=>line.includes(`#scene-${id} `)));
 fs.writeFileSync('public/content/shared-layout.css',css.join('\n'));
 return layout;
}
if(process.argv[1]?.endsWith('compile-shared-layout.mjs')){compileSharedLayout();console.log('Compiled shared header/menu/cookie/footer.');}
