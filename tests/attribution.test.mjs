import test from 'node:test';import assert from 'node:assert/strict';
import {attributedLink,checkoutLink} from '../src/lib/attribution.mjs';import {localLink,linkTarget} from '../src/lib/scene.mjs';
test('internal links normalize host, query and hash with current tab',()=>{assert.equal(localLink('https://www.medvediva.ru/invent?q=1#rec20'),'/invent?q=1#rec20');assert.equal(linkTarget('https://medvediva.ru/invent'),undefined);});
test('external HTTP links open in a new tab; special schemes retain their behavior',()=>{assert.equal(linkTarget('https://ozon.ru/item'),'_blank');assert.equal(linkTarget('tg://resolve?domain=example'),undefined);assert.equal(linkTarget('mailto:a@example.invalid'),undefined);});
test('attribution preserves destination values, hash and only allowlisted parameters',()=>{assert.equal(attributedLink('/invent?utm_source=fixed#rec1',{utm_source:'incoming',utm_campaign:'QA',secret:'no'}),'/invent?utm_source=fixed&utm_campaign=QA#rec1');});
test('attribution goes to the Medvediva LK and stays out of unrelated services and documents',()=>{assert.equal(attributedLink('https://medvediva.nn99.ru/buy?utm_source=fixed',{utm_source:'QA',gclid:'QA-click'}),'https://medvediva.nn99.ru/buy?utm_source=fixed&gclid=QA-click');for(const href of ['/privacy','/data-consent','#rec1','mailto:a@example.invalid','https://ozon.ru/item'])assert.equal(attributedLink(href,{utm_source:'QA'}),href);});
test('current checkout retains attribution after a tariff change without replacing destination values',()=>{
 const url=new URL(checkoutLink('https://lk.medvediva.ru/payments/tariff_test/checkout?utm_source=fixed',{utm_source:'incoming',utm_campaign:'QA',secret:'no'},'QA-ref'));
 assert.equal(url.searchParams.get('utm_source'),'fixed');assert.equal(url.searchParams.get('utm_campaign'),'QA');assert.equal(url.searchParams.get('r'),'QA-ref');assert.equal(url.searchParams.has('secret'),false);
 assert.equal(new URL(checkoutLink(url.href,{utm_campaign:'other'},'different')).searchParams.get('r'),'QA-ref');
});
test('referral is never forwarded to unrelated sites or legal documents',()=>{
 for(const href of ['https://ozon.ru/item','/offer','#rec1'])assert.equal(checkoutLink(href,{},'QA-ref'),href);
});
