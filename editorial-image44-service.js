'use strict';
const I=require('./editorial-image44');
async function create(payload){
 const images=require('./image-rotation65');
 const article={...payload, ...payload.draft};
 const context=images.context(article);
 const asset=images.eligible(article, undefined, context)[0];
 if(!asset)throw Error('Geen goedgekeurd bibliotheekbeeld beschikbaar.');
 const bytes=require('node:fs').readFileSync(require('node:path').join(__dirname,asset.file));
 return {plan:I.classify(payload, context),mode:'approved-library',assetId:asset.id,base64:bytes.toString('base64'),assetSha256:asset.sha256,attempts:0,reused:true,...images.assetFields(asset, context)};
}

async function remote(payload,{secret,fetcher=fetch,budget={remaining:2},priorHashes=[]}={}){
 const response=await fetcher('https://voetbalhub-redactie.onrender.com/editorial-image44',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({approvedGeneration:true,payload,remaining:budget.remaining,priorHashes}),signal:AbortSignal.timeout(420000)});
 if(!response.ok)throw Error('Render-beeldservice HTTP '+response.status);
 const article={...payload, ...payload.draft};
 const r=await response.json(),plan=I.classify(payload,require('./image-rotation65').context(article));
 if(r.plan?.identity!==plan.identity||!['ai-photographic','neutral-fallback','approved-library'].includes(r.mode)||typeof r.base64!=='string'||r.base64.length>500000||!Number.isInteger(r.attempts)||r.attempts<0||r.attempts>2||r.attempts>budget.remaining)throw Error('Ongeldig beeldbewijs van Render.');
 const bytes=Buffer.from(r.base64,'base64');
 if(r.mode==='approved-library'&&String(r.assetId||'').startsWith('stadium116-')){
  const rotation=require('./image-rotation65');
  const eligible=rotation.eligible(article);
  if(!eligible.some(asset=>asset.id===r.assetId&&asset.sha256===r.assetSha256))
   throw Error('Render-beeld ontbreekt in de goedgekeurde selectie.');
 }
 if(r.mode==='neutral-fallback'&&plan.imageKind)throw Error('Render-beeld mist een stadion met de vereiste bezetting.');
 let verifiedNeutral=false;
 if(r.mode==='approved-library'&&plan.imageKind&&r.imageReview?.neutralFootballIllustration===true){
  const rotation=require('./image-rotation65'),context=rotation.context(article);
  const expected=rotation.eligible(article,undefined,context)[0];
  verifiedNeutral=require('./stadium-selection116').approvedNeutral(expected)&&expected.sha256===r.assetSha256&&
   expected.id===r.assetId&&r.imageReview.imageIdentity===plan.imageIdentity;
  if(!verifiedNeutral)throw Error('Ongeldig neutraal bibliotheekbeeld.');
 }
 if(r.mode==='approved-library'&&plan.imageKind&&!verifiedNeutral&&
   (r.imageReview?.imageKind!==plan.imageKind||r.imageReview?.stadiumOccupancy!==plan.stadiumOccupancy||
    r.imageReview?.imageIdentity!==plan.imageIdentity))throw Error('Render-beeld heeft een onjuiste stadionbezetting of identiteit.');
 if(I.sha(bytes)!==r.assetSha256||r.mode==='ai-photographic'&&I.qualityIssues(plan,r.review).length)throw Error('Render-beeld wijkt af van de kwaliteitscontrole.');
 budget.remaining-=r.attempts;
 return {...r,bytes,base64:undefined};
}
module.exports={create,remote};
