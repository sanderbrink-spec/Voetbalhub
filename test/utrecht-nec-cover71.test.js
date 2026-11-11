'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const sharp=require('sharp');
const L=require('../image-library49');
const rotation=require('../image-rotation65');
const premium=require('../premium-match-images72');
const {inspect}=require('../scripts/premium-raster-preflight72');
const all=require('../image-library49.json').assets;
const retiredId='veldio71-utrecht-nec-report';
const approvedId='veldio72-utrecht-nec-report';
const sha='b841c104cebd6a7eda16270e4f20b2f669d51eebdebb8b72676db67f3236554e';
const fixture={
 matchId:'sm-19714594',status:'published',articleKind:'match_report',
 imageCategory:'report',category:'Eredivisie',
 match:{homeTeam:'FC Utrecht',awayTeam:'NEC Nijmegen',playedAt:'2026-11-08'}
};

test('Fase 72C: rejected Utrecht-NEC SVG stays rejected and inaccessible',()=>{
 const asset=all.find(a=>a.id===retiredId);
 assert.equal(asset.approval,'rejected');
 assert.equal(asset.visualReview.score,3);
 assert.equal(premium.accepted(asset),false);
 assert.equal(L.catalog().some(a=>a.id===retiredId),false);
 assert.equal(L.serve({method:'GET'},{},'/article-art71/utrecht-nec-report.webp'),false);
 assert.equal(L.serve({method:'GET'},{},'/article-art71/utrecht-nec-report.svg'),false);
});

test('Fase 72C: WebP exists with exact original hash, independent raster screening and 8.5 visual threshold',async()=>{
 const asset=all.find(a=>a.id===approvedId);
 assert.ok(asset);
 assert.equal(asset.approval,'approved');
 assert.equal(asset.rights,'original-ai');
 assert.equal(asset.imageKind,'report');
 assert.equal(asset.stadiumOccupancy,'full');
 assert.equal(asset.stadiumIdentity,'home:fcutrecht');
 assert.equal(asset.fixtureId,'sm-19714594');
 assert.deepEqual(asset.clubs,['FC Utrecht','NEC Nijmegen']);
 assert.equal(asset.sha256,sha);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(asset.file)).digest('hex'),sha);
 assert.equal(asset.visualReview.assetSha256,sha);
 assert.ok(asset.visualReview.score>=premium.MIN_SCORE);
 assert.equal(asset.visualReview.checked.aiNotDocumentary,true);
 assert.equal(premium.accepted(asset),true);
 assert.ok(L.catalog().find(a=>a.id===approvedId));
 const scan=await inspect(asset.file);
 assert.equal(scan.accepted,true,JSON.stringify(scan));
 assert.equal(scan.sha256,sha);
 assert.equal(scan.width,1280);
 assert.equal(scan.height,720);
 assert.match(asset.caption,/AI-illustratie/);
});

test('Fase 72C: same home-away fixture selects new photo, not old vector',()=>{
 const result=rotation.resolve(fixture);
 assert.equal(result.assignment.state,'approved');
 assert.deepEqual(result.assignment.assetIds,[approvedId]);
 assert.equal(result.article.imageAssetId,approvedId);
 assert.match(result.article.imageUrl,/article-art72\/utrecht-nec-report\.webp$/);
 assert.equal(result.article.imageReview.imageKind,'report');
 assert.equal(result.article.imageReview.stadiumOccupancy,'full');
 assert.equal(result.article.imageReview.visualQualityStatus,'premium-reviewed');
 assert.equal(result.article.imageReview.visualQualityScore,8.7);
 assert.match(result.article.imageCaption,/Geen foto/);
 for(const change of [
  {match:{...fixture.match,homeTeam:'NEC Nijmegen',awayTeam:'FC Utrecht'}},
  {match:{...fixture.match,awayTeam:'Ajax'}},
  {matchId:'sm-19714595'},
  {articleKind:'match_preview',imageCategory:'preview'}
 ]){
  const next=rotation.resolve({...fixture,...change});
  assert.ok(!next.assignment.assetIds.includes(approvedId));
 }
});

test('Fase 72C: approved photo serves WebP and HEAD without disclosing SVG',async()=>{
 const url='/article-art72/utrecht-nec-report.webp';
 const serve=method=>new Promise((resolve,reject)=>{
  let status,headers;
  const response={writableEnded:false,writeHead(s,h){status=s;headers=h;},
   end(data){this.writableEnded=true;resolve({status,headers,body:data});}};
  try{assert.equal(L.serve({method},response,url),true);}catch(err){reject(err);}
 });
 const get=await serve('GET');
 assert.equal(get.status,200);
 assert.equal(get.headers['Content-Type'],'image/webp');
 assert.equal(get.body.toString('ascii',0,4),'RIFF');
 assert.equal(get.body.toString('ascii',8,12),'WEBP');
 const meta=await sharp(get.body).metadata();
 assert.deepEqual([meta.width,meta.height],[1280,720]);
 const head=await serve('HEAD');
 assert.equal(head.status,200);
 assert.equal(head.headers['Content-Length'],get.body.length);
 assert.equal(head.body,undefined);
 assert.equal(L.serve({method:'POST'},{},url),false);
});

test('Fase 72C: existing published story swaps only retired image and retains text plus disclosure',async()=>{
 const article={...fixture,id:'published-utrecht-nec',headline:'NEC wint bij FC Utrecht',
  body:['Brongeverifieerde bestaande verslagtekst.'],imageAssetId:retiredId,
  imageUrl:'https://voetbalhub-redactie.onrender.com/article-art71/utrecht-nec-report.webp',
  imageReview:{qualityTier:'reviewed-fixture'}};
 const direct=L.applyFixtureCover(article);
 assert.equal(direct.headline,article.headline);
 assert.equal(direct.body,article.body);
 assert.equal(direct.imageAssetId,approvedId);
 assert.match(direct.imageCaption,/AI-illustratie/);
 const calls=[];
 const redis={hGetAll:async()=>({}),hSet:async(...args)=>calls.push(args)};
 const visible=await rotation.migrate(redis,[article]);
 assert.equal(visible.length,1);
 assert.equal(visible[0].headline,article.headline);
 assert.deepEqual(visible[0].body,article.body);
 assert.equal(visible[0].imageAssetId,approvedId);
 assert.match(visible[0].imageCaption,/AI-illustratie/);
 assert.equal(calls.length,1);
});

test('Fase 72C: scoped artwork retry reopens only original blocked fixture once',()=>{
 const {EditorialQueue}=require('../editorial-production45');
 const {reopenReviewedMatchArtworkV71}=require('../scripts/automatic-publication');
 const now=Date.parse('2026-11-10T20:05:00Z');
 const record={matchId:fixture.matchId,match:fixture.match,
  category:fixture.category,articleKind:fixture.articleKind};
 const queue=new EditorialQueue();
 const blocked={id:'same-fixture-reviewed-artwork',status:'pending',
  attempts:0,createdAt:now,nextAttemptAt:now};
 queue.fail(blocked,Error('Geen passend goedgekeurd artikelbeeld beschikbaar.'),now,{stage:'artwork'});
 assert.equal(blocked.status,'review');
 assert.equal(reopenReviewedMatchArtworkV71(blocked,record,now),true);
 assert.equal(blocked.status,'pending');
 assert.equal(blocked.reviewedArtworkRecoveryV71,true);
 assert.equal(reopenReviewedMatchArtworkV71(blocked,record,now),false);
 for(const changed of [
  {...record,matchId:'sm-19714595'},
  {...record,match:{homeTeam:'Ajax',awayTeam:'NEC Nijmegen'}}
 ]){
  const copy={...blocked,status:'review',reviewedArtworkRecoveryV71:false,
   failureStage:'artwork',failureCategory:'journalistic_rejection'};
  assert.equal(reopenReviewedMatchArtworkV71(copy,changed,now),false);
 }
});
