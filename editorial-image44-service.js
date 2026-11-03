'use strict';
const I=require('./editorial-image44');
async function create(payload,{client,key=process.env.OPENAI_API_KEY,remaining=2,priorHashes=[],fetcher=fetch,renderer=I.render,now=Date.now()}={}){
 const plan=I.classify(payload);
 const cacheKey='editorial-image44:'+plan.identity;
 if(client?.isReady){
  const cached=await client.get(cacheKey);
  if(cached){const r=JSON.parse(cached);if(r.plan?.identity===plan.identity&&r.mode==='ai-photographic'&&I.sha(Buffer.from(r.base64,'base64'))===r.assetSha256)return {...r,attempts:0};}
 }
 let allowed=Math.min(2,Math.max(0,Math.floor(Number(remaining)||0)));
 if(key){
  if(!client?.isReady)throw Error('Beeldopslag ontbreekt; betaalde generatie blijft geblokkeerd.');
  const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam'}).format(new Date(now));
  // Atomic reservation across overlapping desk and publication requests. Failed calls
  // are counted conservatively; never reset this counter on a server restart.
  const total=await client.eval("local n=tonumber(redis.call('GET',KEYS[1]) or '0'); local a=tonumber(ARGV[1]); if n+a>20 then return 0 end; redis.call('INCRBY',KEYS[1],a); redis.call('EXPIRE',KEYS[1],172800); return a",{keys:['editorial-image44-budget:'+day],arguments:[String(allowed)]});
  allowed=Number(total);
 }
 const budget={remaining:allowed};
 const r=await renderer(payload,{key,fetcher,budget,priorHashes});
 const result={...r,bytes:undefined,base64:r.bytes.toString('base64'),attempts:allowed-budget.remaining};
 if(r.mode==='ai-photographic')await client.set(cacheKey,JSON.stringify(result),{EX:30*86400});
 return result;
}
async function remote(payload,{secret,fetcher=fetch,budget={remaining:2},priorHashes=[]}={}){
 const response=await fetcher('https://voetbalhub-redactie.onrender.com/editorial-image44',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({approvedGeneration:true,payload,remaining:budget.remaining,priorHashes}),signal:AbortSignal.timeout(420000)});
 if(!response.ok)throw Error('Render-beeldservice HTTP '+response.status);
 const r=await response.json(),plan=I.classify(payload);
 if(r.plan?.identity!==plan.identity||!['ai-photographic','neutral-fallback'].includes(r.mode)||typeof r.base64!=='string'||r.base64.length>500000||!Number.isInteger(r.attempts)||r.attempts<0||r.attempts>2||r.attempts>budget.remaining)throw Error('Ongeldig beeldbewijs van Render.');
 const bytes=Buffer.from(r.base64,'base64');
 if(I.sha(bytes)!==r.assetSha256||r.mode==='ai-photographic'&&I.qualityIssues(plan,r.review).length)throw Error('Render-beeld wijkt af van de kwaliteitscontrole.');
 budget.remaining-=r.attempts;
 return {...r,bytes,base64:undefined};
}
module.exports={create,remote};
