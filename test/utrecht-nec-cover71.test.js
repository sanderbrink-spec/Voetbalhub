'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const L=require('../image-library49');
const rotation=require('../image-rotation65');
const premium=require('../premium-match-images72');
const assets=require('../image-library49.json').assets;
const id='veldio71-utrecht-nec-report';
const fixture={
 matchId:'sm-19714594',status:'published',articleKind:'match_report',
 imageCategory:'report',category:'Eredivisie',
 match:{homeTeam:'FC Utrecht',awayTeam:'NEC Nijmegen',playedAt:'2026-11-08'}
};
test('Fase 72: owner-rejected vector remains auditable but cannot be assigned',()=>{
 const asset=assets.find(a=>a.id===id);
 assert.ok(asset);
 assert.equal(asset.approval,'rejected');
 assert.equal(asset.visualReview.score,3);
 assert.equal(asset.fixtureId,fixture.matchId);
 assert.equal(asset.imageKind,'report');
 assert.equal(asset.stadiumOccupancy,'full');
 assert.equal(asset.sha256,crypto.createHash('sha256').update(fs.readFileSync(asset.file)).digest('hex'));
 assert.equal(premium.accepted(asset),false);
 assert.equal(L.catalog().some(a=>a.id===id),false);
 assert.equal(L.choose({category:'report',clubs:['FC Utrecht','NEC Nijmegen'],daypart:'neutral',competition:'Eredivisie',fixtureId:fixture.matchId},[asset]),null);
});
test('Fase 72: neither same fixture nor reverse fixture gets rejected image',()=>{
 const result=rotation.resolve(fixture);
 assert.equal(result.assignment.state,'unpublished_image_quality');
 assert.equal(result.article,null);
 assert.equal(result.assignment.assetIds.includes(id),false);
 for(const changed of [
  {match:{...fixture.match,homeTeam:'NEC Nijmegen',awayTeam:'FC Utrecht'}},
  {match:{...fixture.match,awayTeam:'Ajax'}},
  {matchId:'sm-19714595'},
  {articleKind:'match_preview',imageCategory:'preview'}
 ])assert.ok(!rotation.resolve({...fixture,...changed}).assignment.assetIds.includes(id));
});
test('Fase 72: retired SVG no longer serves WebP or its source',()=>{
 for(const method of ['GET','HEAD','POST']){
  assert.equal(L.serve({method},{},'/article-art71/utrecht-nec-report.webp'),false);
  assert.equal(L.serve({method},{},'/article-art71/utrecht-nec-report.svg'),false);
 }
});
test('Fase 72: revoked artwork does not reopen a previously failed publication queue',()=>{
 const {EditorialQueue}=require('../editorial-production45');
 const {reopenReviewedMatchArtworkV71}=require('../scripts/automatic-publication');
 const now=Date.parse('2026-11-10T20:05:00Z');
 const record={matchId:fixture.matchId,match:fixture.match,category:fixture.category,articleKind:fixture.articleKind};
 const queue=new EditorialQueue();
 const blocked={id:'exact-previous-artwork-failure',status:'pending',attempts:0,createdAt:now,nextAttemptAt:now};
 queue.fail(blocked,Error('Geen passend goedgekeurd artikelbeeld beschikbaar.'),now,{stage:'artwork'});
 assert.equal(blocked.status,'review');
 assert.equal(reopenReviewedMatchArtworkV71(blocked,record,now),false);
 assert.equal(blocked.status,'review');
});
test('Fase 72: a published report survives as text without its withdrawn image',async()=>{
 const article={...fixture,id:'already-published',headline:'NEC wint in Utrecht',
  imageAssetId:id,imageUrl:'https://voetbalhub-redactie.onrender.com/article-art71/utrecht-nec-report.webp',
  imageReview:{qualityTier:'reviewed-fixture'}};
 const writes=[];
 const client={hGetAll:async()=>({}),hSet:async(...args)=>writes.push(args)};
 const visible=await rotation.migrate(client,[article]);
 assert.equal(visible.length,1);
 assert.equal(visible[0].headline,article.headline);
 assert.equal(visible[0].imageQualityStatus,'awaiting-premium-replacement');
 assert.equal(visible[0].imageUrl,undefined);
 assert.equal(visible[0].imageReview,undefined);
 assert.equal(writes.length,1);
});
