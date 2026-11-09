'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const I=require('../editorial-image44');
const article={draft:{headline:'Voorbeschouwing FC Groningen tegen Sparta Rotterdam',standfirst:'De clubs treffen elkaar in de Eredivisie.',body:['Een eigen analyse.']},topicTeams:['FC Groningen','Sparta Rotterdam']};
const accepted={relevant:true,coloursCorrect:true,highQuality:true,noLogos:true,noIdentifiablePeople:true,noMisleadingEvent:true,twoScarves:true,namesOnScarves:true,vOnBall:true,onlyVOnBall:true,texts:['FC Groningen','Sparta Rotterdam'],issues:[]};
async function pixels(){return require('sharp')({create:{width:1536,height:1024,channels:3,background:'#234530'}}).webp().toBuffer();}
test('match, transfer uncertainty and attributed club developments select distinct scenes',()=>{
 assert.equal(I.classify(article).category,'match');
 assert.equal(I.classify({draft:{headline:'FC Groningen koppelt duel met Sparta aan maatschappelijk programma'}}).category,'club');
 assert.equal(I.classify({...article,articleKind:'preview',draft:{headline:'PSV en Club Brugge geven supporters toegangsinstructies'}}).category,'match');
 assert.equal(I.classify({draft:{headline:'Ajax heeft mogelijk interesse in transfer'},transferStatus:'confirmed'}).scene,'rumour');
 assert.equal(I.classify({draft:{headline:'PSV bevestigt transfer'},transferStatus:'confirmed'}).scene,'confirmed');
 assert.equal(I.classify({draft:{headline:'PSV bevestigt transfer'}}).scene,'unconfirmed');
 assert.equal(I.classify({draft:{headline:'Bestuur Ajax bespreekt stadionontwikkeling'}}).scene,'boardroom');
 assert.equal(I.classify({draft:{headline:'Jaarrekening Feyenoord gepubliceerd'}}).scene,'finance');
 assert.equal(I.classify({...article,topicTeams:['PSV Eindhoven','Heerenveen']}).clubs[1].name,'sc Heerenveen');
});
test('full article and club identity determine distinct assets, with correct colours and crop-safe names',()=>{
 const plan=I.classify(article),prompt=I.promptFor(plan);
 assert.match(prompt,/FC Groningen/);assert.match(prompt,/Sparta Rotterdam/);assert.match(prompt,/#008f45/);assert.match(prompt,/#dc1927/);
 assert.match(prompt,/TWO/);assert.match(prompt,/no actual stadium identity/);assert.match(prompt,/V emblem/);assert.match(prompt,/Only this V|ONLY this V/);
 assert.notEqual(plan.identity,I.classify({...article,draft:{...article.draft,body:['Een andere analyse.']}}).identity);
 assert.notEqual(plan.identity,I.classify({...article,topicTeams:['Ajax','PSV']}).identity);
});
test('pixel QA blocks unreadable names, names outside scarves, fabricated crests and missing review fields',()=>{
 const plan=I.classify(article);assert.deepEqual(I.qualityIssues(plan,accepted),[]);
 for(const patch of [{texts:['FC Gronlngen','Sparta Rotterdam']},{namesOnScarves:false},{vOnBall:false},{onlyVOnBall:false},{noLogos:false},{coloursCorrect:false},{highQuality:undefined},{texts:['FC Groningen','Sparta Rotterdam','Sponsor']}])assert.ok(I.qualityIssues(plan,{...accepted,...patch}).length);
 assert.ok(I.qualityIssues(plan,null).length);
});
test('missing provider and unknown colours use an explicit neutral fallback without network or invented approvals',async()=>{
 const unavailable=()=>{throw Error('Unexpected paid call');};
 const result=await I.render(article,{key:'',fetcher:unavailable});
 assert.equal(result.mode,'neutral-fallback');assert.equal(result.review.method,'self-authored-neutral-template-v44');assert.match(result.reason,/niet geconfigureerd/);
 const unknown=await I.render({...article,topicTeams:['Unknown FC','PSV']},{key:'test',fetcher:unavailable});assert.equal(unknown.mode,'neutral-fallback');
 const meta=await require('sharp')(result.bytes).metadata();assert.equal(meta.width,1280);assert.equal(meta.height,720);assert.equal(meta.format,'webp');
});
test('failed text inspection regenerates once, checks final WebP pixels and stops at the shared cost budget',async()=>{
 let generated=0,inspected=0;const budget={remaining:2};
 const result=await I.render(article,{generate:async()=>{generated++;return pixels();},review:async bytes=>{const meta=await require('sharp')(bytes).metadata();assert.equal(meta.width,1280);assert.equal(meta.height,720);return ++inspected===1?{...accepted,texts:['wrong','text']}:accepted;},budget});
 assert.equal(result.mode,'ai-photographic');assert.equal(generated,2);assert.equal(budget.remaining,0);
 const blocked=await I.render(article,{key:'test',budget,generate:()=>{throw Error('Budget exceeded');}});assert.equal(blocked.mode,'neutral-fallback');
});
test('provider failures do not blindly retry; visually repeated images fail closed',async()=>{
 let calls=0;const broken=await I.render(article,{key:'test',fetcher:async()=>{calls++;return {ok:false,status:429};}});
 assert.equal(calls,1);assert.equal(broken.mode,'neutral-fallback');
 const bytes=await pixels(),vh=await I.visualHash(bytes);
 const repeated=await I.render(article,{generate:async()=>bytes,review:async()=>accepted,priorHashes:[vh]});
 assert.equal(repeated.mode,'neutral-fallback');assert.match(repeated.reason,/lijkt te veel/);
 assert.equal(I.similar('ffffffffffffffff','fffffffffffffffe'),true);assert.equal(I.similar('0000000000000000','ffffffffffffffff'),false);
});
test('automatic covers use approved library metadata without a paid call',async()=>{
 const {uploadCover}=require('../scripts/automatic-publication');
 const image=await uploadCover(article,{token:'test',fetcher:()=>{throw Error('No network for library selection');}});
 assert.equal(image.imageReview.mode,'approved-library');assert.equal(image.imageRights,'cleared');
});

test('match logo watermark is composed from the exact bundled Veldio brand image, not invented AI lettering',async()=>{
 const sharp=require('sharp'),fs=require('node:fs');
 assert.ok(fs.statSync('public/brand/veldio-logo.png').size>1000);
 const b=await pixels(),normal=await sharp(b).resize(1280,720,{fit:'cover'}).webp({quality:82}).toBuffer();
 const branded=await I.brandWatermark(normal);
 const metadata=await sharp(branded).metadata();
 assert.equal(metadata.width,1280);assert.equal(metadata.height,720);
 assert.notEqual(I.sha(branded),I.sha(normal));
});
