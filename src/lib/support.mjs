export function validateSupport(fields) {
 const message=String(fields.message??'').trim(),email=String(fields.email??'').trim();
 const errors={};
 if(!message)errors.message='Введите вопрос';
 else if(message.length>10000)errors.message='Вопрос слишком длинный';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))errors.email='Введите корректный адрес электронной почты';
 if(String(fields.telegram??'').length>255)errors.telegram='Ник слишком длинный';
 if(String(fields.phone??'').length>64)errors.phone='Номер слишком длинный';
 return errors;
}
export async function submitSupport(fields,{mode='unconfigured',endpoint,fetchImpl=fetch}={}) {
 const errors=validateSupport(fields);
 if(Object.keys(errors).length)return {state:'invalid',errors};
 if(mode==='dry-run')return {state:'dry-run'}; // Does not call fetch or retain contact information.
 if(mode!=='live'||!endpoint)return {state:'unavailable'};
 let url;try{url=new URL(endpoint);}catch{return {state:'unavailable'};}
 if(url.protocol!=='https:'||/(^|\.)tilda(?:cdn|api)?\.(com|cc|ru|ws)$/.test(url.hostname))return {state:'unavailable'};
 try {
  const response=await fetchImpl(url.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({telegram:fields.telegram,message:fields.message,email:fields.email,phone:fields.phone,...(fields.refId?{ref_id:fields.refId}:{})}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)return {state:'error'};
  const receipt=await response.json();
  return receipt.delivery==='delivered'&&typeof receipt.id==='string'&&receipt.id.length>0?{state:'delivered'}:{state:'unconfirmed'};
 }catch{return {state:'error'};}
}
