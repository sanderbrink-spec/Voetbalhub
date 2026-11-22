'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const library=require('../image-library49');
const premium=require('../premium-match-images72');
const stadium=require('../stadium-venue74');
const data=require('../image-library49.json');
const reviewDay='2026-11-22';
const newlyReviewed=data.assets.filter(a=>a.visualReview?.reviewedAt===reviewDay &&
  a.homeClubReusable===true&&a.imageKind==='report');
const held=data.assets.filter(a=>a.visualReviewHold?.reviewedAt===reviewDay&&a.imageKind==='report');

test('106D individually reviewed new report art: exact files/hashes, rights, club scope and 8.5+ quality',()=>{
 assert.equal(newlyReviewed.length,13);
 assert.equal(held.length,5);
 assert.doesNotThrow(()=>library.validate(data.assets));
 for(const a of newlyReviewed){
  assert.equal(a.approval,'approved',a.id);
  assert.equal(a.rights,'original-ai',a.id);
  assert.equal(a.categories.includes('report'),true,a.id);
  assert.equal(a.fixtureId,undefined,a.id);
  assert.equal(a.clubs[1],'*',a.id);
  assert.equal(a.imageKind,'report',a.id);
  assert.equal(a.stadiumOccupancy,'full',a.id);
  assert.ok(['night','twilight'].includes(a.daypart),a.id);
  assert.ok(a.visualReview.score>=8.5,a.id);
  assert.equal(a.visualReview.assetSha256,a.sha256,a.id);
  assert.equal(a.visualReview.clubScope,'home-only',a.id);
  assert.equal(a.visualReview.scopeHome,stadium.norm(a.clubs[0]),a.id);
  assert.equal(a.visualReview.reviewedStadiumIdentity,a.stadiumIdentity,a.id);
  assert.equal(premium.reviewedPremium(a),true,a.id);
  assert.equal(premium.accepted(a),true,a.id);
 }
 for(const a of held){
  assert.equal(a.approval,'pending',a.id);
  assert.equal(premium.accepted(a),false,a.id);
  assert.ok(a.visualReviewHold.reason.length>=30,a.id);
 }
});

test('106D home-scoped assets never leak to away, other club, preview or wrong daypart',()=>{
 for(const a of newlyReviewed){
  const home=a.clubs[0],away='Andere tegenstander';
  const correct={category:'report',fixtureId:'sm-123',clubs:[home,away],
   daypart:a.daypart,stadiumIdentity:a.stadiumIdentity,
   competition:'Eredivisie',articleId:'test-106d'};
  assert.equal(library.choose(correct,[a])?.id,a.id,a.id);
  assert.equal(library.choose({...correct,clubs:['Andere thuisclub',home],
   stadiumIdentity:'home:anderethuisclub'},[a]),null,a.id);
  assert.equal(library.choose({...correct,category:'preview'},[a]),null,a.id);
  assert.equal(library.choose({...correct,daypart:'day'},[a]),null,a.id);
  assert.equal(library.choose({...correct,daypart:'neutral'},[a]),null,a.id);
  assert.equal(stadium.allowedForMatch(a,{...correct,category:'report'}),true,a.id);
 }
});

test('106D none of five held club-identity or potential trademark risks becomes selectable',()=>{
 for(const a of held){
  assert.equal(library.choose({category:'report',fixtureId:'sm-123',clubs:[a.clubs[0],'Test'],
   daypart:'night',stadiumIdentity:a.stadiumIdentity,articleId:'test'},[a]),null,a.id);
 }
});
