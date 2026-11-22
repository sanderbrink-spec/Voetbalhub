'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const audit=require('../scripts/artwork-queue-audit109');
const assets=require('../image-library49.json').assets;
const now=Date.parse('2026-11-22T20:00:00Z');
const job=(id,extras={})=>({
 id:'never-leak',status:'retry',reason:'awaiting_approved_artwork',
 failureStage:'artwork',matchId:id,createdAt:now-3600000,
 nextAttemptAt:now+3600000,
 checkpoint:{version:1,data:'secret-checkpoint-payload',iv:'secret-iv'},...extras
});
const fact=(id,homeTeam,awayTeam,additional={})=>({
 id,homeTeam,awayTeam,playedAt:'2026-11-21T19:00:00Z',
 competition:'Eredivisie',evidenceSource:'Sportmonks',
 verifiedAt:'2026-11-22T19:30:00Z',...additional
});
test('109A unknown fixture does not infer home/away or use a plausible-looking club image',()=>{
 const report=audit.auditQueue({records:[job('sm-19715873')]},assets,[],now);
 assert.equal(report.artworkRetries,1);
 assert.equal(report.classified.requires_verified_fixture,1);
 assert.equal(report.rows[0].classification,'requires_verified_fixture');
 assert.deepEqual(report.rows[0].approvedAssetIds,[]);
 assert.deepEqual(report.rows[0].pendingHomeCandidates,[]);
 assert.ok(!JSON.stringify(report).includes('secret-checkpoint-payload'));
 assert.ok(!JSON.stringify(report).includes('secret-iv'));
});
test('109A verified exact fixture and club order identify existing rights-approved report',()=>{
 const f=fact('sm-19714594','FC Utrecht','NEC Nijmegen');
 const r=audit.auditQueue([job(f.id)],assets,[f],now);
 assert.equal(r.rows[0].classification,'approved_match_available');
 assert.ok(r.rows[0].approvedAssetIds.includes('veldio72-utrecht-nec-report'));
 const reversed=fact(f.id,'NEC Nijmegen','FC Utrecht');
 const denied=audit.auditQueue([job(f.id)],assets,[reversed],now);
 assert.ok(!denied.rows[0].approvedAssetIds.includes('veldio72-utrecht-nec-report'));
 assert.equal(r.safety.unlocksPublications,false);
});
test('109A missing source, mismatch fixture id and missing date do not count as proof',()=>{
 for(const evidence of [
  fact('sm-19714594','FC Utrecht','NEC Nijmegen',{evidenceSource:'unknown'}),
  fact('sm-999','FC Utrecht','NEC Nijmegen'),
  fact('sm-19714594','FC Utrecht','NEC Nijmegen',{playedAt:''}),
  fact('sm-19714594','FC Utrecht','FC Utrecht'),
  fact('sm-19714594','FC Utrecht','NEC Nijmegen',{verifiedAt:'invalid'})
 ]){
  const r=audit.auditQueue([job('sm-19714594')],assets,[evidence],now);
  assert.equal(r.rows[0].classification,'requires_verified_fixture');
 }
});
test('109A pending generic stadium concept remains unapproved and cannot fill an image-blocked job',()=>{
 const f=fact('sm-19715873','FC Twente','Onbekende bezoekers');
 const r=audit.auditQueue([job(f.id)],assets,[f],now);
 assert.equal(r.rows[0].classification,'requires_verified_daypart');
 assert.deepEqual(r.rows[0].approvedAssetIds,[]);
 assert.ok(r.rows[0].pendingHomeCandidates.some(x=>x.id==='veldio74-fctwente-report'));
 assert.ok(r.rows[0].pendingHomeCandidates.every(x=>x.reviewRequired===true));
 assert.ok(r.rows[0].pendingHomeCandidates.every(x=>x.contextMatchesDaypart===false));
 assert.equal(r.rows[0].daypart,'neutral');
 assert.equal(r.rows[0].daypartEvidence,'insufficient_venue_coordinates');
});
test('109A only actual artwork-stage retries are considered and counters are consistent',()=>{
 const records=[job('sm-19715873'),job('sm-19715872',{status:'review'}),
  job('sm-19715874',{reason:'awaiting_reviewer_capacity'}),
  job('invalid-id'),{reason:'awaiting_approved_artwork',status:'retry',failureStage:'artwork'}];
 const r=audit.auditQueue({records},assets,[],now);
 assert.equal(r.queueRecords,5);
 assert.equal(r.artworkRetries,1);
 assert.equal(Object.values(r.classified).reduce((a,b)=>a+b,0),1);
 assert.deepEqual(Object.keys(r.rows[0]).filter(k=>/secret|checkpoint|urls/.test(k)),[]);
});

test('109A protected provider response is sanitized to independently checked Eredivisie finals',()=>{
 const base={source:'Sportmonks Football API',status:'available',competition:'eredivisie'};
 const f={id:'sm-19714594',status:'FT',resultSource:'Sportmonks Football API',
  home:{name:'FC Utrecht'},away:{name:'NEC Nijmegen'},
  date:'2026-11-21T19:00:00.000Z',checkedAt:'2026-11-22T19:00:00.000Z',
  verifiedStats:{shots:{home:9,away:12}},
  securityToken:'must-never-appear'};
 const converted=audit.sportmonksEvidence({...base,fixtures:[f,
  {...f,id:'sm-999',status:'LIVE'},
  {...f,id:'sm-123',resultSource:'unverified'},
  {...f,id:'sm-124',date:'not-a-date'}]});
 assert.equal(converted.length,1);
 assert.deepEqual(converted[0],{
  id:'sm-19714594',homeTeam:'FC Utrecht',awayTeam:'NEC Nijmegen',
  playedAt:'2026-11-21T19:00:00.000Z',
  verifiedAt:'2026-11-22T19:00:00.000Z',
  competition:'Eredivisie',evidenceSource:'Sportmonks'
 });
 assert.ok(!JSON.stringify(converted).includes('securityToken'));
 assert.ok(!JSON.stringify(converted).includes('must-never-appear'));
 const matching=audit.auditQueue([job('sm-19714594')],assets,converted,now);
 assert.equal(matching.rows[0].classification,'approved_match_available');
 assert.ok(matching.rows[0].approvedAssetIds.includes('veldio72-utrecht-nec-report'));
});
test('109A unverified provider status, wrong competition and unsafe payload never authenticate fixture context',()=>{
 const base={source:'Sportmonks Football API',competition:'eredivisie',status:'available',
  fixtures:[{id:'sm-19714594',status:'FT',resultSource:'Sportmonks Football API',
    home:{name:'FC Utrecht'},away:{name:'NEC Nijmegen'},
    date:'2026-11-21T19:00:00Z',checkedAt:'2026-11-22T19:00:00Z'}]};
 for(const x of [{...base,status:'source_unavailable'},
  {...base,competition:'kkd'},{...base,source:'Unknown'},
  {...base,fixtures:'untrusted'}]){
  const found=audit.sportmonksEvidence(x);
  assert.deepEqual(found,[]);
  const result=audit.auditQueue([job('sm-19714594')],assets,found,now);
  assert.equal(result.classified.requires_verified_fixture,1);
 }
});

test('109C triage only offers pending home images for verified matching daylight and without unresolved holds',()=>{
 const source=fact('sm-19715873','FC Twente','Onbekende bezoekers',{
  venue:{latitude:52.237,longitude:6.837}
 });
 const daytime={...source,playedAt:'2026-11-21T12:00:00Z'};
 const daylight=audit.auditQueue([job(source.id)],assets,[daytime],now);
 assert.equal(daylight.rows[0].daypart,'day');
 assert.equal(daylight.rows[0].classification,'requires_matching_scene_artwork');
 const candidates=daylight.rows[0].pendingHomeCandidates;
 assert.ok(candidates.some(x=>x.id==='veldio74-fctwente-report'));
 assert.ok(candidates.every(x=>!x.contextMatchesDaypart));
 const evening=audit.auditQueue([job(source.id)],assets,[source],now);
 assert.equal(evening.rows[0].daypart,'night');
 assert.equal(evening.rows[0].classification,'pending_home_image_review');
 assert.ok(evening.rows[0].pendingHomeCandidates.some(x=>x.contextMatchesDaypart));
 assert.equal(evening.rows[0].approvedAssetIds.length,0);
});

test('109C unresolved historic or independent-quality holds never count as ready for independent approval',()=>{
 const stamp={venue:{latitude:52.6,longitude:4.7}};
 const az=fact('sm-198','AZ','PSV',stamp);
 const azNight=audit.auditQueue([job(az.id)],assets,[az],now);
 assert.equal(azNight.rows[0].daypart,'night');
 assert.equal(azNight.rows[0].classification,'requires_image_rework');
 assert.ok(azNight.rows[0].pendingHomeCandidates.every(x=>x.requiresRework));
 assert.equal(azNight.rows[0].approvedAssetIds.length,0);
 const groningen=fact('sm-199','FC Groningen','PSV',{venue:{latitude:53.205,longitude:6.594}});
 const g=audit.auditQueue([job(groningen.id)],assets,[groningen],now);
 assert.equal(g.rows[0].classification,'requires_image_rework');
 assert.ok(g.rows[0].pendingHomeCandidates.some(x=>x.reviewBlockReasons.some(reason=>reason.includes('8,5'))));
});
