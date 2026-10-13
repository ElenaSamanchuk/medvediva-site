import {test} from 'node:test';
import assert from 'node:assert/strict';
import {submitSupport,validateSupport} from '../src/lib/support.mjs';
const valid={telegram:'@QA_example',message:'QA-проверка формы',email:'qa@example.invalid',phone:''};
test('dry-run never sends or stores a request',async()=>{
 assert.equal((await submitSupport(valid,{mode:'dry-run',fetchImpl:()=>{throw new Error('must not send')}})).state,'dry-run');
});
test('invalid input cannot reach delivery',async()=>{
 assert.equal((await submitSupport({...valid,email:'wrong'},{mode:'live',endpoint:'https://example.invalid/api',fetchImpl:()=>{throw new Error('must not send')}})).state,'invalid');
 assert.ok(validateSupport({...valid,message:' '.repeat(20)}).message);
});
test('HTTP 200 or accepted receipt does not claim delivery',async()=>{
 const result=await submitSupport(valid,{mode:'live',endpoint:'https://example.invalid/api',fetchImpl:async()=>({ok:true,json:async()=>({delivery:'accepted',id:'QA-1'})})});
 assert.equal(result.state,'unconfirmed');
});
test('requires an explicit delivered receipt and identifier',async()=>{
 for(const receipt of [{delivery:'delivered'},{delivery:'delivered',id:''},{delivery:'delivered',id:'QA-1'}]){
  const result=await submitSupport(valid,{mode:'live',endpoint:'https://example.invalid/api',fetchImpl:async()=>({ok:true,json:async()=>receipt})});
  assert.equal(result.state,receipt.id?'delivered':'unconfirmed');
 }
});
test('unconfigured and Tilda receiver cannot send',async()=>{
 assert.equal((await submitSupport(valid)).state,'unavailable');
 assert.equal((await submitSupport(valid,{mode:'live',endpoint:'https://forms.tilda.ru/api',fetchImpl:()=>{throw new Error('must not send')}})).state,'unavailable');
});

test('Tilda API and members hosts cannot become a live receiver',async()=>{
 for(const endpoint of ['https://forms.tildaapi.com/submit','https://members.tildaapi.com/submit','https://project.tilda.ws/submit']){
  let called=false;const result=await submitSupport({message:'QA-test',email:'qa@example.invalid'},{mode:'live',endpoint,fetchImpl:async()=>{called=true;}});assert.equal(result.state,'unavailable');assert.equal(called,false);
 }
});
