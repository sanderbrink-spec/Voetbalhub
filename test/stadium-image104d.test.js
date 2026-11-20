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
 fixture:{id:'sm-104d-check',home:{name:'FC Groningen'},away:{name:'SC Heerenveen'},
 status:'NS',competition:'eredivisie',date:'2026-11-21T20:00:00Z'}};

test('104D: volledig bron- en bestandsgebonden nachtbeeld blijft in catalogus geldig',()=>{
 assert.ok(artwork);
 assert.equal(artwork.approval,'approved');
 assert.equal(artwork.sceneDaypart,'night');
 assert.equal(artwork.stadiumOccupancy,'empty');
 assert.equal(artwork.visualReview.assetSha256,artwork.sha256);
 assert.match(artwork.visualReview.reviewer,/AI/);
 assert.ok(artwork.visualReview.score>=8.5);
 assert.match(artwork.caption,/AI-illustratie/);
 assert.match(artwork.caption,/geen echte wedstrijdfoto/);
 assert.equal(artwork.rights,'original-ai');
 const bytes=fs.readFileSync(require('node:path').resolve(__dirname,'..',artwork.file));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),artwork.sha256);
 assert.equal(premium.accepted(artwork),true);
 assert.doesNotThrow(()=>library.validate(catalog.assets));
});
test('104D: juiste club en preview, geen verslag of andere thuisclub',()=>{
 const match=images.resolve(preview);
 assert.equal(match.article?.imageAssetId,artwork.id);
 assert.equal(match.article?.imageReview?.stadiumOccupancy,'empty');
 const away=images.resolve({...preview,fixture:{...preview.fixture,home:{name:'SC Heerenveen'},away:{name:'FC Groningen'}}});
 assert.notEqual(away.article?.imageAssetId,artwork.id);
 const report=images.resolve({...preview,articleKind:'match_report'});
 assert.notEqual(report.article?.imageAssetId,artwork.id);
});
