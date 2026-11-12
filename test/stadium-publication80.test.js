'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const library=require('../image-library49');
const premium=require('../premium-match-images72');
const {norm}=require('../stadium-venue74');
const staged=require('../image-library49.json').assets.filter(a=>a.homeClubReusable===true);

// All receipts in this test are synthetic fixtures. No real image is approved or released.
function syntheticApproved(a){
 const home=norm(a.clubs[0]);
 return {...a,approval:'approved',reviewer:'Synthetic QA only',visualReview:{
  score:8.5,style:'photorealistic',assetSha256:a.sha256,
  checked:{photorealism:true,clubNames:true,stadiumContext:true,rights:true,aiNotDocumentary:true},
  reviewer:'Synthetic QA only',reviewedAt:'2026-11-12',
  clubScope:'home-only',scopeHome:home,reviewedStadiumIdentity:'home:'+home
 }};
}
test('Fase 80: goedgekeurde stadionbeelden zijn per thuisclub en beeldtype selecteerbaar, andere clubs nooit',()=>{
 assert.equal(staged.length,36);
 const reviewed=staged.map(syntheticApproved);
 for(const a of reviewed)assert.equal(premium.accepted(a),true,a.id);
 for(const a of staged){
  const pending={...a,approval:'pending',reviewer:'',visualReview:undefined};
  assert.equal(premium.accepted(pending),false,a.id);
  const club=a.clubs[0],opponent=norm(club)==='ajax'?'PSV':'Ajax';
  const ctx={category:a.imageKind,clubs:[club,opponent],daypart:'neutral',
   competition:'Eredivisie',stadiumIdentity:'home:'+norm(club),articleId:'synthetic-'+a.id};
  const selected=library.choose(ctx,reviewed);
  assert.equal(selected?.id,a.id,a.id);
  assert.equal(library.choose({...ctx,clubs:[opponent,club],stadiumIdentity:'home:'+norm(opponent)},[reviewed.find(x=>x.id===a.id)]),null,'No away club reuse '+a.id);
  assert.equal(library.choose({...ctx,category:a.imageKind==='preview'?'report':'preview'},[reviewed.find(x=>x.id===a.id)]),null,'Wrong kind '+a.id);
  assert.equal(library.choose(ctx,[pending]),null,'Pending must never publish '+a.id);
 }
});
