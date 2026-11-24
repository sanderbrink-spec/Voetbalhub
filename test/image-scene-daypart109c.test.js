'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const library=require('../image-library49');
const rotation=require('../image-rotation65');
const premium=require('../premium-match-images72');
const registered=require('../image-library49.json').assets;
const original=registered.find(a=>a.id==='veldio74-fctwente-report');
function inMemoryApproval(){
 const home=library.context?require('../stadium-venue74').norm(original.clubs[0]):'fctwente';
 return {...original,brandingAudit115:require('../test-support/branding-fixture115')(original.sha256),approval:'approved',reviewer:'synthetic test only, not a real review',
  approvedAt:'2026-11-22',visualReview:{
   score:9,style:'photorealistic',assetSha256:original.sha256,
   checked:{photorealism:true,clubNames:true,stadiumContext:true,rights:true,aiNotDocumentary:true},
   reviewer:'synthetic test only',reviewedAt:'2026-11-22',
   clubScope:'home-only',scopeHome:home,reviewedStadiumIdentity:original.stadiumIdentity
  }};
}
const fixture=(time,venue)=>({id:'test109c',articleKind:'match_report',matchId:'sm-1999',category:'Eredivisie',
 match:{homeTeam:'FC Twente',awayTeam:'Ajax',date:time,...(venue?{venue}:{})}});
const knownVenue={latitude:52.237,longitude:6.837};

test('109C actual scene night must not be treated as neutral daylight for reusable stadium',()=>{
 assert.equal(original.daypart,'neutral');
 assert.equal(original.sceneDaypart,'night');
 assert.equal(original.approval,'pending');
 assert.equal(premium.accepted(original),false);
 const synthetic=inMemoryApproval();
 assert.equal(premium.accepted(synthetic),true);
 assert.equal(library.daypartMatches(synthetic,'night'),true);
 assert.equal(library.daypartMatches(synthetic,'day'),false);
 assert.equal(library.daypartMatches(synthetic,'twilight'),false);
 assert.equal(library.daypartMatches(synthetic,'neutral'),false);
});

test('109C both editorial match rotation and library choose require independently verified matching sun position',()=>{
 const synthetic=inMemoryApproval();
 const day=fixture('2026-11-21T12:00:00Z',knownVenue);
 const night=fixture('2026-11-21T19:00:00Z',knownVenue);
 const unknown=fixture('2026-11-21T19:00:00Z');
 const ctxDay=rotation.context(day),ctxNight=rotation.context(night),ctxUnknown=rotation.context(unknown);
 assert.equal(ctxDay.daypart,'day');
 assert.equal(ctxNight.daypart,'night');
 assert.equal(ctxUnknown.daypart,'neutral');
 assert.deepEqual(rotation.eligible(day,[synthetic],ctxDay),[]);
 assert.deepEqual(rotation.eligible(unknown,[synthetic],ctxUnknown),[]);
 assert.deepEqual(rotation.eligible(night,[synthetic],ctxNight).map(a=>a.id),[synthetic.id]);
 const simplified={category:'report',fixtureId:'sm-1999',
  clubs:['FC Twente','Ajax'],competition:'Eredivisie',
  stadiumIdentity:'home:fctwente',articleId:'test109c'};
 assert.equal(library.choose({...simplified,daypart:'day'},[synthetic]),null);
 assert.equal(library.choose({...simplified,daypart:'neutral'},[synthetic]),null);
 assert.equal(library.choose({...simplified,daypart:'night'},[synthetic])?.id,synthetic.id);
});

test('109C reusable images cannot omit visual lighting metadata for selection',()=>{
 const synthetic=inMemoryApproval();
 const withoutScene={...synthetic};
 delete withoutScene.sceneDaypart;
 assert.equal(library.daypartMatches(withoutScene,'night'),false);
 assert.equal(rotation.eligible(fixture('2026-11-21T19:00:00Z',knownVenue),[withoutScene]).length,0);
 assert.equal(original.approval,'pending');
});
