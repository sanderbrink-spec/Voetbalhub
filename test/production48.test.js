'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../scripts/production-health48');
const now=Date.parse('2026-11-05T12:00:00Z');
const story=()=>({id:'a',headline:'Ajax wint',publishedAt:new Date(now-3600000).toISOString(),body:['Eigen tekst'],sources:[{url:'https://ajax.nl/a'}],imageUrl:'https://example.org/a.webp'});
test('production audit detects duplicates, missing images, sources and stale news without treating columns as news production',()=>{
 assert.ok(M.articlesChecks([story()],now).every(c=>c.status==='pass'));
 const a=story();delete a.imageUrl;delete a.sources;
 const checks=M.articlesChecks([a,{...story(),id:'b'}],now);
 for(const key of ['news.image:a','news.sources:a','news.duplicate:b'])assert.ok(checks.some(c=>c.id===key&&c.status==='fail'));
 assert.ok(M.articlesChecks([{...story(),type:'column'}],now).some(c=>c.id==='news.freshness'&&c.status==='fail'));
 assert.ok(M.articlesChecks([{...story(),publishedAt:'invalid'}],now).some(c=>c.status==='fail'));
});
test('200 responses with missing/stale football data or expired rights fail; cached data exposes failed synchronization',()=>{
 const s={status:'available',updatedAt:new Date(now).toISOString(),rightsExpiresAt:now+3600000,fixtures:[{id:'a',home:{id:1},away:{id:2},date:new Date(now-2*86400000).toISOString(),status:'NS'}],standings:[]};
 assert.ok(M.footballChecks('eredivisie',s,now).some(c=>c.id.endsWith('missing-results')&&c.status==='fail'));
 for(const change of [{status:'source_unavailable'},{rightsExpiresAt:now-1},{updatedAt:'invalid'},{status:'cached'}])assert.ok(M.footballChecks('x',{...s,...change},now).some(c=>c.status==='fail'));
});
test('daily control catches failed, missing and stale automatic jobs',()=>{
 const run={path:'.github/workflows/automatic-publication.yml',status:'completed',conclusion:'success',id:1,created_at:new Date(now).toISOString()};
 assert.equal(M.workflowChecks([run],now).find(c=>c.id.includes('automatic-publication')).status,'pass');
 for(const change of [{conclusion:'failure'},{created_at:'2026-10-01T00:00:00Z'}])assert.equal(M.workflowChecks([{...run,...change}],now)[0].status,'fail');
 assert.ok(M.workflowChecks([],now).every(c=>c.status==='fail'));
});
test('link probes cannot follow arbitrary/private destinations or include credentials',async()=>{
 for(const u of ['http://ajax.nl','https://127.0.0.1/a','https://ajax.nl.evil.com/a','https://name:secret@ajax.nl/a','https://ajax.nl:8080/a'])assert.equal(M.allowedLink(u),false);
 assert.equal(M.allowedLink('https://www.ajax.nl/a'),true);
 await assert.rejects(M.request('https://ajax.nl/a',{fetcher:async()=>({status:302,headers:new Headers({location:'https://127.0.0.1/admin'})})}),/buiten toegestane/);
});
test('an unreachable production service yields explicit failures and a report; no writes or publishing calls',async()=>{
 const calls=[];const r=await M.audit({now,fetcher:async(u,options)=>{calls.push({u,options});throw Error('offline');},checkLinks:false,checkTasks:false});
 assert.equal(r.status,'fail');assert.ok(r.failed>=10);assert.ok(calls.every(c=>!c.options.method||c.options.method==='OPTIONS'));assert.ok(!calls.some(c=>/publish|draft|image44/.test(c.u)));assert.match(M.markdown(r),/\| fail \|/);
});

test('a snapshot refreshed during the audit is not falsely reported as future or stale',()=>{
 const s={status:'available',updatedAt:new Date(now+30000).toISOString(),rightsExpiresAt:now+3600000,fixtures:[{id:'a',home:{id:1},away:{id:2},date:new Date(now+86400000).toISOString(),status:'NS'}],standings:[{}]};
 assert.equal(M.footballChecks('x',s,now).find(c=>c.id.endsWith('freshness')).status,'pass');
 assert.equal(M.footballChecks('x',{...s,updatedAt:new Date(now+3600000).toISOString()},now).find(c=>c.id.endsWith('freshness')).status,'fail');
});

test('legacy logos and stadium photos are replaced without changing approved article text or date',()=>{
 const media=require('../media43'),fixture=require('./fixtures/media43-article.json');
 const legacy={...fixture,id:'older',imageReview:{method:'fixture-specific-stadium-and-logos-v4'}};
 const result=media.apply(legacy);assert.match(result.imageUrl,/editorial\/veldio-arena.webp$/);assert.equal(result.imageReview.noOfficialLogos,true);assert.deepEqual(result.body,legacy.body);assert.equal(result.publishedAt,legacy.publishedAt);
 for(const proof of require('../legacy-media48.json')){const bytes=require('../article-covers').readCover(proof.file);assert.ok(bytes);assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'),proof.assetSha256);}
});
test('legacy image endpoint never fetches or redistributes the original graphic',async()=>{
 let calls=0;const bytes=await require('../brand-images').remoteImage('https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/editorial-media/match-covers/old.png',()=>{calls++;throw Error('must not fetch');});assert.ok(bytes.length>10000);assert.equal(calls,0);
});

test('a previously cleared legacy logo/photo label is not accepted as current rights proof',()=>{
 const checks=M.articlesChecks([{...story(),imageRights:'cleared',imageReview:{method:'fixture-specific-stadium-and-logos-v4'}}],now);
 assert.ok(checks.some(c=>c.id==='news.image-rights:a'&&c.status==='fail'));
});

test('intentional skipped publication on deployment does not hide the latest real task result',()=>{
 const run={path:'.github/workflows/automatic-publication.yml',status:'completed',conclusion:'success',id:1,created_at:new Date(now-3600000).toISOString()};
 const skipped={...run,id:2,conclusion:'skipped',created_at:new Date(now).toISOString()};
 const c=M.workflowChecks([run,skipped],now)[0];assert.equal(c.status,'pass');assert.match(c.detail,/Run 1:/);
 assert.equal(M.workflowChecks([skipped],now)[0].status,'fail');
});
