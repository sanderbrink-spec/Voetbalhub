'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const library=require('../image-library49');
const rotation=require('../image-rotation65');
const premium=require('../premium-match-images72');
const intake=require('../stadium-intake73.json');
const source=require('../image-library49.json').assets.find(a=>a.id==='veldio72-utrecht-nec-report');

const base=(club,kind='report')=>({
 ...source,
 id:'synthetic-'+club.toLowerCase().replace(/[^a-z]/g,'')+'-'+kind,
 fixtureId:undefined,homeClubReusable:true,
 subject:club+' neutrale thuisstadionafbeelding',clubs:[club,'*'],
 categories:[kind],competitions:['Eredivisie'],daypart:'neutral',
 imageKind:kind,stadiumOccupancy:kind==='report'?'full':'empty',
 stadiumIdentity:'home:'+club.toLowerCase().replace(/[^a-z0-9]/g,''),
 homeVenueAliases:['Stadion '+club],variant:'base-'+kind,
 visualReview:{...source.visualReview,reviewedAt:'2026-11-11',clubScope:'home-only',
  scopeHome:club.toLowerCase().replace(/[^a-z0-9]/g,''),reviewedStadiumIdentity:'home:'+club.toLowerCase().replace(/[^a-z0-9]/g,'')}
});
const article=(home,away,kind='match_report',extra={})=>({
 id:'reuse73-'+home+'-'+away,
 status:'published',articleKind:kind,category:'Eredivisie',matchId:'sm-112233',
 headline:'Test verslag',match:{homeTeam:home,awayTeam:away,...extra}
});

test('Fase 73: three requested binaries are in repository and image desk, but remain unpublished pending review',()=>{
 const fs=require('node:fs'),crypto=require('node:crypto');
 assert.equal(intake.entries.length,3);
 assert.ok(intake.entries.every(e=>e.status==='staged-in-github-and-library-pending-visual-and-legal-review'));
 assert.ok(intake.entries.every(e=>e.visualScore===null && e.artifactPresentInRepo===true));
 const rows=require('../image-library49.json').assets;
 for(const row of intake.entries){
  const a=rows.find(x=>x.id===row.id);
  assert.ok(a,'missing registered intake asset '+row.id);
  assert.equal(a.file,row.targetFile);
  assert.ok(['pending','approved'].includes(a.approval));
  assert.equal(a.sha256,row.sha256);
  assert.equal(a.homeClubReusable,true);
  assert.equal(a.clubs[1],'*');
  assert.equal(a.fixtureId,undefined);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(a.file)).digest('hex'),a.sha256);
  assert.equal(premium.accepted(a),a.approval==='approved');
  assert.equal(library.catalog().some(x=>x.id===a.id),a.approval==='approved');
 }
 assert.doesNotThrow(()=>library.validate(rows));
});
test('Fase 73: a reviewed home-only artwork safely serves more than one opponent',()=>{
 const image=base('Telstar');
 assert.equal(premium.accepted(image),true);
 assert.deepEqual(rotation.eligible(article('Telstar','Ajax'),[image]).map(x=>x.id),[image.id]);
 assert.deepEqual(rotation.eligible(article('Telstar','PSV'),[image]).map(x=>x.id),[image.id]);
 assert.equal(rotation.eligible(article('Ajax','Telstar'),[image]).length,0);
 assert.equal(rotation.eligible(article('Willem II','Telstar'),[image]).length,0);
 const ctx={category:'report',clubs:['Telstar','Ajax'],competition:'Eredivisie',daypart:'neutral'};
 assert.equal(library.choose(ctx,[image]).id,image.id);
 assert.equal(library.choose({...ctx,clubs:['PSV','Telstar']},[image]),null);
});
test('Fase 73: known fixture venue must match approved aliases; never borrow another stadium',()=>{
 const image=base('Willem II');
 assert.equal(rotation.eligible(article('Willem II','Ajax','match_report',{venue:{name:'Stadion Willem II'}}),[image]).length,1);
 assert.equal(rotation.eligible(article('Willem II','Ajax','match_report',{venue:{name:'Other city alternate venue'}}),[image]).length,0);
});
test('Fase 73: full/empty occupancy and reviewed 8.5 remain mandatory',()=>{
 const report=base('Willem II','report'),preview=base('Willem II','preview');
 assert.equal(rotation.eligible(article('Willem II','AZ','match_report'),[preview]).length,0);
 assert.equal(rotation.eligible(article('Willem II','AZ','match_preview'),[report]).length,0);
 assert.equal(rotation.eligible(article('Willem II','AZ','match_preview'),[preview]).length,1);
 assert.equal(premium.accepted({...report,visualReview:{...report.visualReview,score:8.49}}),false);
 assert.equal(premium.accepted({...report,visualReview:{...report.visualReview,checked:{...report.visualReview.checked,rights:false}}}),false);
 assert.equal(premium.accepted({...report,clubs:['Willem II','Ajax']}),false);
 assert.equal(premium.accepted({...report,fixtureId:'sm-123'}),false);
});
test('Fase 73: fixture-specific originals always outrank reusable stadium image',()=>{
 const generic=base('FC Utrecht');
 const exact={...source};
 const ctx={category:'report',fixtureId:source.fixtureId,clubs:source.clubs,competition:'Eredivisie',daypart:'neutral'};
 assert.equal(library.choose(ctx,[generic,exact]).id,source.id);
});
