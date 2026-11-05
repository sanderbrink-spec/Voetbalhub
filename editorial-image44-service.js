'use strict';
const I=require('./editorial-image44');
async function create(payload,{client,key=process.env.OPENAI_API_KEY,remaining=2,priorHashes=[],fetcher=fetch,renderer=I.render,now=Date.now()}={}){
 const library=require('./image-library49'),asset=await library.select(payload,{client,now});
 if(!asset)throw Error('Geen goedgekeurd bibliotheekbeeld beschikbaar.');
 const bytes=require('node:fs').readFileSync(require('node:path').join(__dirname,asset.file));
 return {plan:I.classify(payload),mode:'approved-library',assetId:asset.id,base64:bytes.toString('base64'),assetSha256:asset.sha256,attempts:0,reused:true,...library.fields(asset)};
}

async function remote(payload,{secret,fetcher=fetch,budget={remaining:2},priorHashes=[]}={}){
 const response=await fetcher('https://voetbalhub-redactie.onrender.com/editorial-image44',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({approvedGeneration:true,payload,remaining:budget.remaining,priorHashes}),signal:AbortSignal.timeout(420000)});
 if(!response.ok)throw Error('Render-beeldservice HTTP '+response.status);
 const r=await response.json(),plan=I.classify(payload);
 if(r.plan?.identity!==plan.identity||!['ai-photographic','neutral-fallback','approved-library'].includes(r.mode)||typeof r.base64!=='string'||r.base64.length>500000||!Number.isInteger(r.attempts)||r.attempts<0||r.attempts>2||r.attempts>budget.remaining)throw Error('Ongeldig beeldbewijs van Render.');
 const bytes=Buffer.from(r.base64,'base64');
 if(I.sha(bytes)!==r.assetSha256||r.mode==='ai-photographic'&&I.qualityIssues(plan,r.review).length)throw Error('Render-beeld wijkt af van de kwaliteitscontrole.');
 budget.remaining-=r.attempts;
 return {...r,bytes,base64:undefined};
}
module.exports={create,remote};
