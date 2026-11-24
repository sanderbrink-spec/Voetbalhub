'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const staging=require('../artwork-staging110.json');
const catalog=require('../image-library49.json').assets;
const images=require('../image-library49');
const premium=require('../premium-match-images72');
test('110B/110D exact source image bytes imported but approval remains pending',()=>{
 assert.equal(staging.items.length,3);
 assert.deepEqual(staging.items.map(x=>x.fixtureId).sort(),['sm-19714592','sm-19715868','sm-19722098']);
 assert.doesNotThrow(()=>images.validate(catalog));
 for(const item of staging.items){
  assert.match(item.fixtureId,/^sm-\d+$/);
  assert.match(item.webpSha256,/^[a-f0-9]{64}$/);
  assert.match(item.pngSha256,/^[a-f0-9]{64}$/);
  assert.deepEqual(item.webpDimensions,[1280,720]);
  assert.equal(item.status,'uploaded_repo_pending_review');
  assert.equal(item.approval,'pending');
  assert.equal(item.visualAssessment,'not_yet_independently_approved');
  const asset=catalog.find(a=>a.id===item.assetId);
  assert.ok(asset,item.assetId);
  assert.equal(asset.file,item.repoFile);
  const currentSha=asset.correction115?.originalSha256===item.webpSha256?asset.sha256:item.webpSha256;
  if(currentSha!==item.webpSha256){
   const q=require('../branding-correction-queue115.json').items.find(x=>x.id===asset.id);
   assert.equal(q.originalSha256,item.webpSha256);
   assert.equal(q.correctedSha256,currentSha);
  }
  assert.equal(asset.sha256,currentSha);
  assert.equal(asset.fixtureId,item.fixtureId);
  assert.equal(asset.approval,'pending');
  assert.equal(asset.reviewer,undefined);
  assert.equal(asset.visualReview,undefined);
  assert.equal(premium.accepted(asset),false);
  const bytes=fs.readFileSync(path.resolve(__dirname,'..',asset.file));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),currentSha);
  assert.match(item.nextAction,/eindcontrole|goedkeuring|vrijgave/i);
 }
});
