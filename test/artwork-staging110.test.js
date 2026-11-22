'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const staging=require('../artwork-staging110.json');
const library=require('../image-library49.json').assets;
test('110A generated originals never imply publication rights or local GitHub bytes',()=>{
 assert.equal(staging.items.length,1);
 for(const item of staging.items){
  assert.match(item.fixtureId,/^sm-\d+$/);
  assert.match(item.webpSha256,/^[a-f0-9]{64}$/);
  assert.deepEqual(item.webpDimensions,[1280,720]);
  assert.equal(item.status,'staged_external_not_in_repository');
  assert.equal(item.approval,'pending');
  assert.equal(item.visualAssessment,'not_yet_independently_approved');
  assert.equal(library.some(x=>x.fixtureId===item.fixtureId&&x.sha256===item.webpSha256),false);
  assert.match(item.nextAction,/SHA256/);
 }
});
