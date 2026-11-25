'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const catalog=require('../image-library49.json');
const library=require('../image-library49');
const premium=require('../premium-match-images72');
const images=require('../image-rotation65');
const artwork=catalog.assets.find(a=>a.id==='veldio104d-fcgroningen-night-preview');
const preview={articleKind:'preview',category:'Eredivisie',
 fixture:{id:'sm-19714591',home:{name:'FC Groningen'},away:{name:'SC Heerenveen'},
 status:'NS',competition:'eredivisie',date:'2026-11-21T20:00:00Z'}};

test('104D: volledig bron- en bestandsgebonden nachtbeeld blijft in catalogus geldig',()=>{
 assert.ok(artwork);
 assert.equal(artwork.approval,'approved');
 assert.equal(artwork.sceneDaypart,'night');
 assert.equal(artwork.fixtureId,'sm-19714591');
 assert.equal(artwork.homeClubReusable,false);
 assert.equal(artwork.stadiumOccupancy,'empty');
 assert.equal(artwork.visualReview.assetSha256,artwork.sha256);
 assert.match(artwork.visualReview.reviewer,/AI/);
 assert.ok(artwork.visualReview.score>=8.5);
 assert.match(artwork.caption,/AI-illustratie/);
 assert.match(artwork.caption,/geen echte wedstrijdfoto/);
 assert.equal(artwork.rights,'original-ai');
 const bytes=fs.readFileSync(require('node:path').resolve(__dirname,'..',artwork.file));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),artwork.sha256);
 assert.equal(premium.accepted(artwork),false,'original raster contains forbidden text');
 assert.doesNotThrow(()=>library.validate(catalog.assets));
});
test('104D: juiste club en preview, geen verslag of andere thuisclub',t=>{
 require('../test-support/catalogue-before116')(t);
 assert.equal(images.resolve(preview).article,null);
 const synthetic={...artwork,id:'synthetic-104-preview',manualReview115:undefined,brandingAudit115:require('../test-support/branding-fixture115')(artwork.sha256)};
 const current=library.catalog();t.mock.method(library,'catalog',()=>[...current,synthetic]);
 const match=images.resolve(preview);
 assert.equal(match.article?.imageAssetId,synthetic.id,JSON.stringify({assignment:match.assignment,candidate:artwork.id}));
 assert.equal(match.article?.imageReview?.stadiumOccupancy,'empty');
 const away=images.resolve({...preview,fixture:{...preview.fixture,home:{name:'SC Heerenveen'},away:{name:'FC Groningen'}}});
 assert.notEqual(away.article?.imageAssetId,synthetic.id);
 const anotherFixture=images.resolve({...preview,fixture:{...preview.fixture,id:'sm-19714592'}});
 assert.notEqual(anotherFixture.article?.imageAssetId,synthetic.id);
 const report=images.resolve({...preview,articleKind:'match_report'});
 assert.notEqual(report.article?.imageAssetId,synthetic.id);
});

test('104D: alleen verzegeld oud previewconcept wordt eenmaal hervat wanneer rechtenbeeld beschikbaar is',t=>{
 require('../test-support/catalogue-before116')(t);
 const {reopenApprovedClubPreviewArtwork104D}=require('../scripts/automatic-publication');
 const fixture=preview.fixture;
 const candidate={kind:'preview',category:'Eredivisie',topic:'FC Groningen – SC Heerenveen',
  fixture,kickoff:Date.parse(fixture.date),facts:Array.from({length:5},(_,i)=>({text:'F'+i,evidence:[{source:0}]}))};
 const group=Object.assign([{url:'https://fcgroningen.nl/nieuws/',title:candidate.topic}],{clubPreview:candidate});
 const now=Date.parse('2026-11-20T23:15:00Z');
 const job={clubPreviewId:'sm-19714591',status:'retry',failureStage:'artwork',
  failureCategory:'missing_approved_artwork',reason:'awaiting_approved_artwork',
  nextAttemptAt:now+6*3600000,checkpoint:'sealed-reviewed-manuscript'};
 assert.equal(reopenApprovedClubPreviewArtwork104D({...job},group,now),false);
 const current=library.catalog();const synthetic={...artwork,id:'synthetic-104-preview',manualReview115:undefined,brandingAudit115:require('../test-support/branding-fixture115')(artwork.sha256)};
 t.mock.method(library,'catalog',()=>[...current,synthetic]);
 assert.equal(reopenApprovedClubPreviewArtwork104D(job,group,now),true);
 assert.equal(job.status,'pending');
 assert.equal(job.nextAttemptAt,now);
 assert.equal(job.checkpoint,'sealed-reviewed-manuscript');
 assert.equal(reopenApprovedClubPreviewArtwork104D(job,group,now),false);
 const other={...job,status:'retry',failureStage:'artwork',
  failureCategory:'missing_approved_artwork',reason:'awaiting_approved_artwork',artworkReadyRecovery104D:false};
 assert.equal(reopenApprovedClubPreviewArtwork104D(other,{...group,clubPreview:{...candidate,fixture:{...fixture,id:'sm-19714592'}}},now),false);
 assert.equal(reopenApprovedClubPreviewArtwork104D({...other,checkpoint:null},group,now),false);
 assert.equal(reopenApprovedClubPreviewArtwork104D({...other,status:'review'},group,now),false);
 assert.equal(reopenApprovedClubPreviewArtwork104D({...other},group,Date.parse(fixture.date)+1000),false);
});
