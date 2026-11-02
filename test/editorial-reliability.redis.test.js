'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D=require('../editorial-drafts'),{publishOnce}=require('../editorial-publication');
const fixture=()=>structuredClone(require('./fixtures/editorial-chain.json'));
async function using(run){
 const redis=require('redis').createClient({url:process.env.REDIS_TEST_URL});await redis.connect();const prefix='audit24:'+crypto.randomUUID()+':';
 const client={get:k=>redis.get(prefix+k),set:(k,v,o)=>redis.set(prefix+k,v,o),keys:async p=>(await redis.keys(prefix+p)).map(k=>k.slice(prefix.length)),eval:(s,o)=>redis.eval(s,{...o,keys:o.keys.map(k=>prefix+k)})};
 try{await run(client);}finally{const keys=await redis.keys(prefix+'*');if(keys.length)await redis.del(keys);await redis.quit();}
}
test('automatic daily cap is atomic across runs, counts failed concepts and uses Amsterdam date',{skip:!process.env.REDIS_TEST_URL},()=>using(async c=>{
 const now=Date.parse('2026-10-31T22:55:00Z');const requests=Array.from({length:25},(_,i)=>({key:crypto.createHash('sha256').update(String(i)).digest('hex'),payload:fixture()}));
 const rows=await Promise.all(requests.map(x=>D.reserveAutomatic(c,x,now)));assert.equal(rows.filter(x=>x.reserved).length,20);assert.equal(rows.filter(x=>x.reason==='daily_limit').length,5);
 const first=rows.find(x=>x.reserved).record;assert.equal(first.status,'needs_review');assert.equal(first.automation.day,'2026-10-31');
 assert.equal((await D.reserveAutomatic(c,requests[0],now)).reason,'already_processed');
 assert.equal((await D.reserveAutomatic(c,requests[24],Date.parse('2026-10-31T23:05:00Z'))).reserved,true);
 assert.equal((await c.keys('editorial-draft:*')).length,21);
}));
test('rejection, failures and source evidence survive reopening; approval cannot publish an edited revision',{skip:!process.env.REDIS_TEST_URL},()=>using(async c=>{
 let r=await D.saveDraft(c,{payload:fixture(),state:'needs_review',issues:['Controleer de bron.'],verification:{method:'test',claims:[{text:'Feit',evidence:[{source:0,quote:'Letterlijke bronpassage voor controle.'}]}]}});
 r=await D.saveDraft(c,{id:r.id,expectedRevision:r.revision,payload:r.payload,state:'rejected'});assert.equal((await D.getDraft(c,r.id)).status,'rejected');assert.equal(r.verification.claims.length,1);
 r=await D.saveDraft(c,{id:r.id,expectedRevision:r.revision,payload:r.payload,approve:true});const approved=r;
 r=await D.saveDraft(c,{id:r.id,expectedRevision:r.revision,payload:r.payload,state:'publication_failed',issues:['Verbinding onderbroken.']});assert.equal(r.status,'publication_failed');
 await assert.rejects(publishOnce(c,{id:approved.id.slice(14),headline:approved.payload.draft.headline,publishedAt:new Date().toISOString()},approved),e=>e.status===409);
 assert.equal((await c.keys('article:*')).length,0);
}));
test('simultaneous approved publications write one article and one published draft; retry returns same article',{skip:!process.env.REDIS_TEST_URL},()=>using(async c=>{
 const a=await D.saveDraft(c,{payload:fixture(),approve:true}),b=await D.saveDraft(c,{payload:fixture(),approve:true});
 const make=r=>({id:r.id.slice(14),...r.payload.draft,status:'published',category:r.payload.category,publishedAt:new Date().toISOString()});
 const results=await Promise.allSettled([publishOnce(c,make(a),a),publishOnce(c,make(b),b)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 assert.equal((await c.keys('article:*')).length,1);const winner=results[0].status==='fulfilled'?a:b;
 const again=await publishOnce(c,make(winner),winner);assert.equal(again.id,winner.id.slice(14));assert.equal((await D.getDraft(c,winner.id)).status,'published');
}));

test('concurrent publication invalidates the earlier duplicate-scan snapshot, including different headlines',{skip:!process.env.REDIS_TEST_URL},()=>using(async c=>{
 const a=await D.saveDraft(c,{payload:fixture(),approve:true}),second=fixture();second.draft.headline='Ajax verzamelt reacties over de ontvangst van bezoekers';second.draft.body[2]+=' Dit wordt verder besproken.';
 const b=await D.saveDraft(c,{payload:second,approve:true});
 const make=r=>({id:r.id.slice(14),...r.payload.draft,status:'published',publishedAt:new Date().toISOString()});
 await publishOnce(c,make(a),a,'0');
 await assert.rejects(publishOnce(c,make(b),b,'0'),e=>e.status===503);
 assert.equal((await c.keys('article:*')).length,1);assert.equal((await D.getDraft(c,b.id)).status,'approved');
}));
