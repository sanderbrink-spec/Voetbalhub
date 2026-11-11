'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const inventory=require('../stadium-desk74');
const venue=require('../stadium-venue74');
const library=require('../image-library49');
const premium=require('../premium-match-images72');
const manifest=require('../stadium-review74.json');
const assets=require('../image-library49.json').assets;
test('Fase 74: editorial intake covers every current Eredivisie stadium in two separate variants',()=>{
 const a=inventory.overview();
 assert.equal(a.clubsTotal,18);
 assert.equal(a.slotsTotal,36);
 assert.equal(new Set(manifest.clubs.map(c=>c.id)).size,18);
 for(const c of manifest.clubs){
  assert.deepEqual(Object.keys(c.slots).sort(),['preview','report']);
  assert.equal(c.slots.preview.occupancy,'empty');
  assert.equal(c.slots.report.occupancy,'full');
 }
 assert.equal(a.counts['stored-awaiting-review'],3);
 assert.ok(a.slots.every(s=>s.assetIds.length===0));
 assert.ok(a.slots.every(s=>!s.state.includes('auto-approved')));
});
test('Fase 74: pending Telstar and Willem II images remain absent from public catalogue',()=>{
 const ids=['veldio73-telstar-report-evening','veldio73-willem-ii-preview-day','veldio73-willem-ii-report-evening'];
 const approved=library.catalog();
 for(const id of ids){
  const a=assets.find(row=>row.id===id);
  assert.ok(a,'Missing reviewed intake '+id);
  assert.equal(a.approval,'pending');
  assert.equal(premium.accepted(a),false);
  assert.equal(approved.some(row=>row.id===id),false);
 }
});
test('Fase 74: verified same home stadium can be re-used for different opponents',()=>{
 const sample={id:'test',homeClubReusable:true,imageKind:'report',stadiumOccupancy:'full',
  fixtureId:undefined,stadiumIdentity:'home:telstar',clubs:['Telstar','*']};
 const ctx={category:'report',clubs:['Telstar','Ajax'],stadiumIdentity:'home:telstar'};
 assert.equal(venue.allowedForMatch(sample,ctx),true);
 assert.equal(venue.allowedForMatch(sample,{...ctx,clubs:['Telstar','PSV']}),true);
 assert.equal(venue.allowedForMatch(sample,{...ctx,clubs:['AZ','Telstar']}),false);
 assert.equal(venue.allowedForMatch(sample,{...ctx,category:'preview'}),false);
 assert.equal(venue.allowedForMatch(sample,{...ctx,stadiumIdentity:'venue:711stadion'}),true);
 assert.equal(venue.allowedForMatch(sample,{...ctx,stadiumIdentity:'venue:anotherplace'}),false);
 assert.equal(venue.allowedForMatch(sample,{...ctx,stadiumIdentity:'venue:999',venueName:'BUKO Stadion'}),true);
 assert.equal(venue.allowedForMatch(sample,{...ctx,stadiumIdentity:'venue:999'}),false);
});
test('Fase 74: reusable premium requires review explicitly scoped to exact home club',()=>{
 const a=assets.find(row=>row.id==='veldio72-utrecht-nec-report');
 assert.ok(a&&premium.accepted(a));
 const swapped={...a,fixtureId:undefined,homeClubReusable:true,clubs:['Telstar','*'],
  stadiumIdentity:'home:telstar'};
 assert.equal(premium.accepted(swapped),false);
 assert.equal(premium.accepted({...swapped,visualReview:{...a.visualReview,clubScope:'home-only',
  scopeHome:'telstar',reviewedStadiumIdentity:'home:telstar'}}),true);
});
test('Fase 74: existing approved fixture-specific report remains in the catalogue',()=>{
 const a=assets.find(row=>row.id==='veldio72-utrecht-nec-report');
 assert.ok(a);
 const ctx={category:'report',clubs:['FC Utrecht','NEC Nijmegen'],competition:'Eredivisie',
  fixtureId:'sm-19714594',daypart:'neutral',stadiumIdentity:'home:fcutrecht'};
 assert.equal(library.choose(ctx,[a])?.id,a.id);
 assert.equal(library.choose({...ctx,stadiumIdentity:'venue:unrelated'},[a]),null);
});
