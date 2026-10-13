import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {tariffPhase,tariffState} from '../src/lib/tariffs.mjs';
const config=JSON.parse(fs.readFileSync(new URL('../sources/pf-pit-config.json',import.meta.url),'utf8'));
test('Phase boundaries use campaign Moscow days, including outsideCampaign policy',()=>{
 assert.equal(tariffPhase(config,new Date('2026-10-07T20:59:59Z')),'phase1');
 assert.equal(tariffPhase(config,new Date('2026-10-07T21:00:00Z')),'phase2');
 assert.equal(tariffPhase(config,new Date('2026-10-08T21:00:00Z')),'phase3');
 assert.equal(tariffPhase(config,new Date('2026-10-12T21:00:00Z')),'phase1');
});
test('All stream choices change both price and matching checkout; addon has separate checkout',()=>{
 const date=new Date('2026-10-03T12:00:00Z');
 for(const key of ['pit-bazovy','pit-komfortny'])for(let i=0;i<4;i++){
  const base=tariffState(config,key,i,false,date),addon=tariffState(config,key,i,true,date);
  assert.equal(base.total,config.prices.phase1[key][i]);assert.equal(base.link,config.links.phase1[key][i].link);
  assert.equal(addon.total,base.total+2500);assert.equal(addon.link,config.links.phase1[key][i].linkTvg);
  assert.equal(base.showCrossed,true);assert.equal(addon.showCrossed,false);assert.equal(addon.showPercentBadge,false);assert.equal(addon.label,'Купить');
 }
});
test('No-sale final phase uses full price; renewal falls back to configured links',()=>{
 const final=tariffState(config,'pit-komfortny',0,false,new Date('2026-10-10T12:00:00Z'));
 assert.equal(final.total,5790);assert.equal(final.showCrossed,false);assert.equal(final.showPercentBadge,false);assert.equal(final.label,'Купить');
 const renewal=tariffState({...config,page:{audience:'renewal',phase:'auto'}},'pit-bazovy',3,false);
 assert.equal(renewal.total,25290);assert.equal(renewal.label,'Продлить со скидкой');assert.equal(renewal.link,config.links.phase1['pit-bazovy'][3].link);
});
test('Missing or unknown tariff cannot produce a fake checkout',()=>{assert.equal(tariffState(config,'unknown'),null);});

test('UI selection is reactive and isolated between base and comfort cards',async()=>{
 const {ref}=await import('vue');const {createTariffUi,tariffNodeView}=await import('../src/lib/tariff-ui.mjs');
 const now=ref(Date.parse('2026-10-03T12:00:00Z')),ui=createTariffUi(ref(config),now);
 ui.select('pit-bazovy',8);ui.toggleAddon('pit-bazovy');
 assert.equal(ui.state('pit-bazovy').total,28190);assert.equal(ui.state('pit-komfortny').total,5290);
 assert.equal(tariffNodeView({classes:['pf-badge-percent'],html:'old'},ui.state('pit-bazovy')).hidden,true);
 assert.equal(tariffNodeView({classes:['pf-option','pf-option--8']},ui.state('pit-bazovy')).active,true);
 now.value=Date.parse('2026-10-10T12:00:00Z');assert.equal(ui.state('pit-bazovy').total,31890);
});
