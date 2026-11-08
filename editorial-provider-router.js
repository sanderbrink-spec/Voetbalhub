'use strict';
const crypto=require('node:crypto');
const MODELS=Object.freeze({groq:'openai/gpt-oss-120b',openai:'gpt-4.1-mini',gemini:'gemini-2.5-pro',openrouter:'openai/gpt-oss-120b:free'});
const TASKS=Object.freeze({extraction:{budget:2400,effort:'low'},writing:{budget:3600,effort:'medium'},revision:{budget:4200,effort:'high'},review:{budget:4200,effort:'high'}});
const ENDPOINTS={groq:'https://api.groq.com/openai/v1/chat/completions',openai:'https://api.openai.com/v1/chat/completions',gemini:'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent',openrouter:'https://openrouter.ai/api/v1/chat/completions'};
function retryDelay(value,now=Date.now()){
 if(value===null||value===undefined||value==='')return 0;
 const seconds=Number(value),delay=Number.isFinite(seconds)?seconds*1000:Date.parse(value)-now;
 return Number.isFinite(delay)&&delay>0?Math.ceil(delay):0;
}
function parseObject(text){
 const value=JSON.parse(String(text||'').trim().replace(/^```(?:json)?\s*|\s*```$/g,''));
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_json');
 return value;
}
function validateResult(value,task){
 if(task==='review'){
  if(typeof value.approved!=='boolean'||!Array.isArray(value.issues)||!value.scores||!['actuality','reliability','nationalValue','originality','journalism','diversity'].every(k=>Number.isInteger(value.scores[k])&&value.scores[k]>=0&&value.scores[k]<=100))throw Error('invalid_json');
 }else if(['writing','revision'].includes(task)&&value.skip!==true&&value.editorialDecision!=='skip'){
  if(typeof value.headline!=='string'||typeof value.standfirst!=='string'||!Array.isArray(value.body)||!value.body.every(p=>typeof p==='string'))throw Error('invalid_json');
 }
 return value;
}
class ProviderUnavailable extends Error{
 constructor(attempts,retryAfterSeconds=3600){
  const reasons=attempts.map(a=>a.reason);
  const category=reasons.includes('invalid_json')?'invalid_response':reasons.includes('authentication')?'authentication':reasons.some(r=>['daily_quota','rate_limit','capacity','cooldown'].includes(r))?'capacity':'unavailable';
  super(category==='invalid_response'?'Redactionele AI gaf geen geldige gestructureerde uitvoer; taak blijft bewaard.':category==='authentication'?'Redactionele AI-toegang geweigerd; taak blijft bewaard.':'Geen geschikte redactionele AI-capaciteit beschikbaar; taak blijft bewaard.');
  this.code='EDITORIAL_AI_UNAVAILABLE';this.availabilityCategory=category;this.retryAfterSeconds=retryAfterSeconds;this.attempts=attempts;
 }
}
class EditorialProviderRouter{
 constructor({groqKey,openaiKey,openaiModel,geminiKey,openrouterKey,geminiFreeTierConfirmed=false,fetcher=fetch,now=Date.now,state={},onState=async()=>{},onAttempt=()=>{},intervalMs=35000,timeoutMs=180000,limits={}}={}){
  this.keys={groq:groqKey,openai:openaiKey,gemini:geminiKey,openrouter:openrouterKey};this.models={...MODELS,openai:openaiModel||MODELS.openai};
  this.geminiFreeTierConfirmed=geminiFreeTierConfirmed;this.fetcher=fetcher;this.now=now;this.state=state;this.onState=onState;this.onAttempt=onAttempt;this.intervalMs=intervalMs;this.timeoutMs=timeoutMs;this.trace=[];this.lastWriter=null;
  this.limits={groq:{requests:80,tokens:150000},openai:{requests:80,tokens:150000},gemini:{requests:20,tokens:100000},openrouter:{requests:45,tokens:150000},...limits};
  this.openrouterVerifiedUntil=0;this.pending=Promise.resolve();
 }
 configured(){return Object.entries(this.keys).map(([provider,key])=>({provider,model:this.models[provider],keyPresent:Boolean(key),enabled:Boolean(key)&&(provider!=='gemini'||this.geminiFreeTierConfirmed),reason:!key?'missing_key':provider==='gemini'&&!this.geminiFreeTierConfirmed?'free_project_not_confirmed':provider==='openrouter'?'requires_live_zero_price_check':'configured'}));}
 slot(provider){
  const day=new Date(this.now()).toISOString().slice(0,10),old=this.state[provider];
  if(!old||old.day!==day)this.state[provider]={day,requests:0,tokens:0,blockedUntil:old?.blockedUntil||0,nextAt:old?.nextAt||0};
  return this.state[provider];
 }
 async verifyOpenrouter(){
  if(this.openrouterVerifiedUntil>this.now())return true;
  try{
   const r=await this.fetcher('https://openrouter.ai/api/v1/models',{signal:AbortSignal.timeout(20000)});
   if(!r.ok)return false;
   const model=(await r.json()).data?.find(m=>m.id===MODELS.openrouter);
   // Unknown prices, automatic model routing and paid substitutions are forbidden.
   if(!model?.pricing||!['prompt','completion'].every(k=>model.pricing[k]!==undefined&&Number(model.pricing[k])===0)||Object.values(model.pricing).some(v=>!['string','number'].includes(typeof v)||String(v).trim()===''||!Number.isFinite(Number(v))||Number(v)!==0))return false;
   this.openrouterVerifiedUntil=this.now()+300000;return true;
  }catch{return false;}
 }
 complete(messages,options={}){
  // Serialize callers sharing a capacity ledger; reserve before issuing I/O.
  const next=this.pending.then(()=>this._complete(messages,options));this.pending=next.catch(()=>{});return next;
 }
 async _complete(messages,{task='extraction',requestOptions={},signal,writer=this.lastWriter,articleId=this.articleId||null}={}){
  const spec=TASKS[task];if(!spec)throw new RangeError('Onbekende redactietaak');
  const attempts=[],estimate=Math.ceil(JSON.stringify(messages).length/3)+spec.budget;
  let order=this.keys.openai?['openai','groq','gemini','openrouter']:['groq','gemini','openrouter'];
  if(task==='review'&&writer)order.sort((a,b)=>((a===writer.provider?2:(a==='gemini'?'gemini':a==='openai'?'openai':'gpt-oss')===writer.family?1:0)-(b===writer.provider?2:(b==='gemini'?'gemini':b==='openai'?'openai':'gpt-oss')===writer.family?1:0)));
  for(const provider of order){
   if(signal?.aborted)throw signal.reason;
   if(!this.keys[provider]||(provider==='gemini'&&!this.geminiFreeTierConfirmed))continue;
   const slot=this.slot(provider),limit=this.limits[provider],reserve=task==='review'?0:2;
   if(slot.blockedUntil>this.now()){attempts.push({provider,reason:slot.blockReason||'cooldown'});continue;}
   if(slot.requests+1+reserve>limit.requests||slot.tokens+estimate+(task==='review'?0:10000)>limit.tokens){attempts.push({provider,reason:'capacity'});continue;}
   if(provider==='openrouter'&&!await this.verifyOpenrouter()){attempts.push({provider,reason:'free_endpoint_unconfirmed'});continue;}
   const wait=Math.max(0,(slot.nextAt||0)-this.now());
   // Long Retry-After delays are persisted, not slept through during a round.
   if(wait>60000){attempts.push({provider,reason:'cooldown'});continue;}
   if(wait)await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,wait);signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});});
   let result,kind='temporary',delay=60000,outputShape;
   for(let jsonAttempt=0;jsonAttempt<2;jsonAttempt++){
    if(slot.requests+1+reserve>limit.requests||slot.tokens+estimate+(task==='review'?0:10000)>limit.tokens){kind='capacity';delay=3600000;break;}
    const budget=Math.min(requestOptions.max_completion_tokens||spec.budget,spec.budget);
    let body,headers={'Content-Type':'application/json'};
    if(provider==='gemini'){
     headers['x-goog-api-key']=this.keys[provider];
     body={systemInstruction:{parts:[{text:messages.filter(m=>m.role==='system').map(m=>m.content).join('\n')}]},contents:messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),generationConfig:{responseMimeType:'application/json',temperature:0,maxOutputTokens:budget}};
    }else{
     headers.Authorization='Bearer '+this.keys[provider];
     body={model:this.models[provider],messages,temperature:0,response_format:requestOptions.response_format||{type:'json_object'},...(provider==='groq'?{max_completion_tokens:budget,reasoning_effort:jsonAttempt?'medium':spec.effort,include_reasoning:false}:provider==='openai'?{max_completion_tokens:budget}:{max_tokens:budget,provider:{max_price:{prompt:0,completion:0},allow_fallbacks:false,require_parameters:true},reasoning:{effort:spec.effort,exclude:true}})};
    }
    slot.requests++;slot.tokens+=estimate;slot.nextAt=this.now()+this.intervalMs;
    await this.onState(this.state);this.onAttempt({provider,task,model:MODELS[provider]});
    try{
     const deadline=AbortSignal.timeout(this.timeoutMs),requestSignal=signal?AbortSignal.any([signal,deadline]):deadline;
     const response=await this.fetcher(ENDPOINTS[provider],{method:'POST',headers,body:JSON.stringify(body),signal:requestSignal});
     slot.observedLimits={remainingRequests:response.headers?.get('x-ratelimit-remaining-requests')||null,remainingTokens:response.headers?.get('x-ratelimit-remaining-tokens')||null,resetRequests:response.headers?.get('x-ratelimit-reset-requests')||null,resetTokens:response.headers?.get('x-ratelimit-reset-tokens')||null};
     let data;try{data=await response.json();}catch{data=null;}
     if(!response.ok){
      const message=String(data?.error?.message||'');
      kind=response.status===429?(/per day|\bTPD\b|\bRPD\b|daily|PerDay/i.test(message)?'daily_quota':'rate_limit'):[401,403].includes(response.status)?'authentication':response.status>=500?'temporary':'invalid_request';
      slot.quotaDimension=/token|TPD|TPM/i.test(message)?'tokens':/request|RPD|RPM/i.test(message)?'requests':'unknown';
      delay=retryDelay(response.headers?.get('retry-after'),this.now())||(kind==='daily_quota'?86400000:kind==='authentication'?3600000:60000);
      // One existing bounded GPT-OSS JSON recovery; no retry of quota failures.
      if(provider==='groq'&&response.status===400&&data?.error?.code==='json_validate_failed'&&!jsonAttempt)continue;
      break;
     }
     try{
      const text=provider==='gemini'?data?.candidates?.[0]?.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join(''):data?.choices?.[0]?.message?.content;
      const parsed=parseObject(text);outputShape={headline:typeof parsed.headline,standfirst:typeof parsed.standfirst,body:Array.isArray(parsed.body)?'array':typeof parsed.body,skip:parsed.skip===true,finishReason:['stop','length','content_filter'].includes(data?.choices?.[0]?.finish_reason)?data.choices[0].finish_reason:'unknown'};
      result=validateResult(parsed,task);kind='success';
     }catch{kind='invalid_json';delay=60000;}
     const usage=Number(data?.usage?.total_tokens??data?.usageMetadata?.totalTokenCount);
     if(Number.isFinite(usage)&&usage>=0)slot.tokens=Math.max(0,slot.tokens-estimate+usage);
     break;
    }catch(error){if(signal?.aborted)throw signal.reason;kind=['TimeoutError','AbortError'].includes(error?.name)?'timeout':'temporary';break;}
   }
   const record={provider,model:this.models[provider],family:provider==='gemini'?'gemini':provider==='openai'?'openai':'gpt-oss',task,outcome:kind,...(kind==='invalid_json'?{outputShape:outputShape||{parseableObject:false}}:{}),articleId,at:new Date(this.now()).toISOString()};
   this.trace.push(record);
   if(kind==='success'){
    if(['writing','revision'].includes(task)&&result.skip!==true)this.lastWriter={provider,model:MODELS[provider],family:record.family};
    await this.onState(this.state);return result;
   }
   slot.blockedUntil=this.now()+delay;slot.blockReason=kind;await this.onState(this.state);attempts.push({provider,reason:kind});
  }
  const delays=Object.values(this.state).map(s=>s.blockedUntil-this.now()).filter(n=>n>0);
  throw new ProviderUnavailable(attempts,Math.ceil((delays.length?Math.min(...delays):3600000)/1000));
 }
}
function createRouter({env=process.env,...options}={}){return new EditorialProviderRouter({groqKey:env.GROQ_API_KEY,openaiKey:env.OPENAI_API_KEY,openaiModel:env.OPENAI_MODEL,geminiKey:env.GEMINI_API_KEY||env.GOOGLE_API_KEY,openrouterKey:env.OPENROUTER_API_KEY,geminiFreeTierConfirmed:env.GEMINI_FREE_TIER_CONFIRMED==='true',...options});}
// Public durable queue contains only authenticated ciphertext, never source text.
function sealCheckpoint(value,secret,context){
 const iv=crypto.randomBytes(12),key=crypto.createHash('sha256').update(secret).digest(),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(context));
 const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
 return {version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')};
}
function openCheckpoint(value,secret,context){try{if(value?.version!==1)return null;const decipher=crypto.createDecipheriv('aes-256-gcm',crypto.createHash('sha256').update(secret).digest(),Buffer.from(value.iv,'base64'));decipher.setAAD(Buffer.from(context));decipher.setAuthTag(Buffer.from(value.tag,'base64'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data,'base64')),decipher.final()]).toString());}catch{return null;}}
module.exports={MODELS,TASKS,EditorialProviderRouter,ProviderUnavailable,createRouter,retryDelay,parseObject,validateResult,sealCheckpoint,openCheckpoint};
