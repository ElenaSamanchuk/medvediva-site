// Independent responsive group layout from source coordinates, also usable without JavaScript.
import fs from 'node:fs';import {field} from '../src/lib/scene.mjs';
export function compileLayouts(){
 const routes=JSON.parse(fs.readFileSync('public/content/routes.json','utf8'));
 for(const route of routes){
  const page=JSON.parse(fs.readFileSync(`public/content/${route.page}.json`,'utf8'));const rules=[];
  for(const scene of page.scenes){
   const minimum=parseFloat(scene.min),maximum=parseFloat(scene.max);
   if(Number.isFinite(minimum))rules.push(`@media(max-width:${minimum-.02}px){#scene-${scene.id},#rec${scene.id}{display:none!important}}`);
   if(Number.isFinite(maximum))rules.push(`@media(min-width:${maximum}px){#scene-${scene.id},#rec${scene.id}{display:none!important}}`);
   const points=(scene.board.screens||'320,480,640,960,1200').split(',').map(Number).sort((a,b)=>b-a);
   function walk(nodes,parent){
    for(const node of nodes){if(node.type!=='group')continue;
     points.forEach((point,index)=>{
      const get=k=>field(node.fields,k,point);const parentValue=k=>parent?Number(field(parent.fields,k,point)||0):0;
      const flex=!!parent?.fields.flex&&parent.fields.flex!=='none';const top=flex?0:Number(get('top')||0)-parentValue('top');const left=flex?0:Number(get('left')||0)-parentValue('left');
      const x=parent||get('container')==='window'?`${left}px`:`calc(50% - ${point/2}px + ${left}px)`;
      let rule=`#scene-${scene.id} [data-node="${node.id}"]{position:${flex?'relative':'absolute'};top:${top}px;left:${x};}`;
      if(index)rule=`@media(max-width:${points[index-1]-1}px){${rule}}`;rules.push(rule);
     });walk(node.children,node);
    }
   }walk(scene.nodes,null);
  }
  fs.writeFileSync(`public/content/${route.page}-layout.css`,rules.join('\n'));
 }
 return routes.length;
}
if(process.argv[1]?.endsWith('compile-layout.mjs'))console.log(`Compiled layout for ${compileLayouts()} pages.`);
