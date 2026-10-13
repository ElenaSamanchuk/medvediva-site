import {countdownState,promotionVisible} from './promotion.mjs';
const classesOf=node=>Array.isArray(node.sourceClasses)?node.sourceClasses:Array.isArray(node.classes)?node.classes:[];
export function promotionMarkers(scene){
 const markers=new Set(scene.phaseMarkers||[]);
 function visit(nodes){for(const node of nodes||[]){for(const name of classesOf(node))if(name.startsWith('pf-show-'))markers.add(name);visit(node.children);}}
 visit(scene.nodes);return [...markers];
}
function replaceText(html,value){
 let replaced=false;
 return String(html??'').replace(/(^|>)([^<]*)(?=<|$)/g,(whole,prefix,text)=>{if(replaced||!text.trim())return whole;replaced=true;return prefix+value;});
}
export function projectPromotionScene(scene,promotion,now=Date.now()){
 if(!scene||!promotion?.config)return scene;
 if(!promotionVisible(promotionMarkers(scene),promotion.config,now))return null;
 const clock=countdownState(promotion.countdown,now);if(!clock)return scene;
 function project(nodes){let changed=false;const values=(nodes||[]).map(node=>{
  const key=classesOf(node).find(name=>Object.hasOwn(clock.text,name));
  const html=key?replaceText(node.html,clock.text[key]):node.html;
  const children=node.children?project(node.children):node.children;
  if(html===node.html&&children===node.children)return node;
  changed=true;return {...node,html,...(children?{children}:{})};
 });return changed?values:nodes;}
 const nodes=project(scene.nodes);return nodes===scene.nodes?scene:{...scene,nodes};
}
