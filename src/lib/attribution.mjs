import {sessionStore,localStore} from './storage.mjs';
import {localLink,linkTarget} from './scene.mjs';
import {SITE} from './site.mjs';
const outbound=['medvediva.nn99.ru',...SITE.lkHosts];
const names=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','yclid','fbclid','msclkid','dclid'];
const storageKey='medvediva-preview-attribution';
// Source establishes persistent last-touch r; UTM lifetime is not documented.
// Preview keeps only this allowlist for the current tab, pending source confirmation.
export function captureAttribution(search){
 let stored={};try{stored=JSON.parse(sessionStore.getItem(storageKey)||'{}');}catch{}
 const query=new URLSearchParams(search);
 for(const name of names)if(query.has(name))stored[name]=query.get(name);
 sessionStore.setItem(storageKey,JSON.stringify(stored));return stored;
}
export function attributedLink(href,values,origin=SITE.origin){
 const normalized=localLink(href);if(!normalized||normalized.startsWith('#'))return normalized;
 let url;try{url=new URL(normalized,origin);}catch{return normalized;}
 if(!['https:','http:'].includes(url.protocol))return normalized;
 const internal=url.origin===origin||SITE.hosts.includes(url.hostname);
 if(!internal&&!outbound.includes(url.hostname))return normalized;
 if(internal&&/(?:policy|privacy|consent|oferta|offer|agreement|\.pdf$|\/media\/)/i.test(url.pathname))return normalized;
 for(const name of names)if(values[name]&&!url.searchParams.has(name))url.searchParams.set(name,values[name]);
 return internal?url.pathname+url.search+url.hash:url.href;
}
export function checkoutLink(href,values={},referral=localStore.getItem('r'),origin=SITE.origin){
 const attributed=attributedLink(href,values,origin);
 try{
  const url=new URL(attributed,origin);
  if(outbound.includes(url.hostname)&&referral&&!url.searchParams.has('r'))url.searchParams.set('r',referral);
  return outbound.includes(url.hostname)?url.href:attributed;
 }catch{return attributed;}
}
export function prepareLinks(root,values){
 if(!root)return;
 for(const a of root.querySelectorAll('a[href]')){
  const href=checkoutLink(a.getAttribute('href'),values,localStore.getItem('r'),location.origin);if(!href)continue;
  a.setAttribute('href',href);
  if(linkTarget(href)){a.target='_blank';a.rel='noopener noreferrer';}else{a.removeAttribute('target');a.removeAttribute('rel');}
 }
}
