'use strict';
const {createHash}=require('node:crypto');
const {isIP}=require('node:net');
const ERROR='Verzenden is niet gelukt. Probeer het opnieuw.';
const SUCCESS='Je bericht is verzonden naar de redactie van Veldio. Bedankt voor je reactie.';
const topics=['Vraag over de app','Tip voor de redactie','Samenwerking','Overige vraag'];
const hash=s=>createHash('sha256').update(s).digest('hex');
function validate(data){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('invalid');
 const single=(key,min,max)=>{const v=data[key];if(typeof v!=='string'||v.trim().length<min||v.length>max||/[\x00-\x1f\x7f]/.test(v))throw Error('invalid');return v.trim();};
 const name=single('name',1,80),email=single('email',3,254),subject=single('subject',1,140),topic=single('topic',1,50);
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||!topics.includes(topic))throw Error('invalid');
 if(typeof data.message!=='string'||data.message.trim().length<20||data.message.length>4000||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(data.message))throw Error('invalid');
 if(typeof data.website!=='string'||data.website!==''||!/^[-a-zA-Z0-9]{16,80}$/.test(data.requestId||''))throw Error('invalid');
 return {name,email,subject,topic,message:data.message.replace(/\r\n?/g,'\n').trim()};
}
function createContactHandler({env=process.env,fetchImpl=fetch,redis=null,now=Date.now}={}){
 const rates=new Map(),requests=new Map();
 async function rate(key){
  const bucket=Math.floor(now()/600000),k='contact:rate:'+bucket+':'+hash(key);
  if(redis){if(!redis.isReady)throw Error('storage');const n=await redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],660) end; return n",{keys:[k],arguments:[]});return n<=5;}
  for(const [k,v] of rates)if(v.expires<=now())rates.delete(k);
  if(!rates.has(k)&&rates.size>=10000)return false;
  const entry=rates.get(k)||{count:0,expires:now()+660000};entry.count++;rates.set(k,entry);return entry.count<=5;
 }
 return async function contact(req,res){
  const reply=(status,message,extra={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({message,...extra}));};
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end();}
  if(req.method!=='POST')return reply(405,ERROR);
  const origin=req.headers.origin,host=(env.CONTACT_PUBLIC_ORIGIN||'').trim();
  // Android uses a native HTTPS request without a browser Origin. Web pages must be explicitly allowed.
  const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(x=>x&&x!=='null');
  if(origin&&origin!==host&&!allowed.includes(origin))return reply(403,ERROR);
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return reply(415,ERROR);
  let ip=req.socket.remoteAddress||'unknown';
  if(env.CONTACT_TRUST_PROXY==='1'){const candidate=String(req.headers['x-forwarded-for']||'').split(',').pop().trim();if(isIP(candidate))ip=candidate;}
  try{if(!await rate(ip))return reply(429,ERROR);}catch{return reply(503,ERROR);}
  let raw='',size=0;const chunks=[];
  try{for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>24576)return reply(413,ERROR);chunks.push(Buffer.from(chunk));}raw=Buffer.concat(chunks).toString('utf8');}catch{return reply(400,ERROR);}
  let data,fields;try{data=JSON.parse(raw);fields=validate(data);}catch{return reply(400,ERROR);}
  if(!env.RESEND_API_KEY||!env.CONTACT_FROM||/[\r\n]/.test(env.CONTACT_FROM))return reply(503,ERROR);
  const key='veldio-contact-'+data.requestId,fingerprint=hash(JSON.stringify(fields)),storageKey='contact:request:'+hash(key);
  let entry;
  try{
   if(redis){
    const saved=await redis.get(storageKey);
    if(saved){const prior=JSON.parse(saved);if(prior.fingerprint!==fingerprint)return reply(409,ERROR);if(prior.accepted)return reply(200,SUCCESS,{accepted:true});}
    const lock=await redis.set(storageKey,JSON.stringify({fingerprint}),{NX:true,EX:86400});
    // A pending retry may reach the provider too; its stable idempotency key prevents a second email.
    if(!lock&&saved===null)return reply(409,ERROR);
   }else{
    for(const [k,v] of requests)if(v.expires<=now())requests.delete(k);
    entry=requests.get(key);
    if(entry){if(entry.fingerprint!==fingerprint)return reply(409,ERROR);const ok=await entry.promise;return reply(ok?200:502,ok?SUCCESS:ERROR,ok?{accepted:true}:{});}
    if(requests.size>=10000)return reply(503,ERROR);
   }
   const send=async()=>{
    try{
     const response=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':key},signal:AbortSignal.timeout(12000),redirect:'error',body:JSON.stringify({from:env.CONTACT_FROM,to:['redactie.veldio@gmail.com'],reply_to:fields.email,subject:'[Veldio] '+fields.topic+' · '+fields.subject,text:'Naam: '+fields.name+'\nE-mailadres: '+fields.email+'\nOnderwerp: '+fields.subject+'\nCategorie: '+fields.topic+'\n\n'+fields.message})});
     const result=await response.json();return response.ok&&typeof result.id==='string'&&result.id.length>0;
    }catch{return false;}
   };
   const promise=send();if(!redis)requests.set(key,{fingerprint,promise,expires:now()+86400000});
   const ok=await promise;
   if(redis&&ok)await redis.set(storageKey,JSON.stringify({fingerprint,accepted:true}),{EX:86400});
   // Keep no message text in our storage. Failed retries reuse the provider idempotency key.
   if(!redis&&!ok)requests.delete(key);
   return reply(ok?200:502,ok?SUCCESS:ERROR,ok?{accepted:true}:{});
  }catch{return reply(503,ERROR);}
 };
}
function contactConfiguration(env=process.env){return {provider:'resend',configured:!!(env.RESEND_API_KEY&&env.CONTACT_FROM&&!/[\r\n]/.test(env.CONTACT_FROM)),missing:['RESEND_API_KEY','CONTACT_FROM','CONTACT_PUBLIC_ORIGIN'].filter(key=>!env[key])};}
module.exports={validate,createContactHandler,contactConfiguration};
