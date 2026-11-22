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
 const f={id:'sm-19714594',competition:'eredivisie',status:'FT',resultSource:'Sportmonks Football API',
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
  fixtures:[{id:'sm-19714594',competition:'eredivisie',status:'FT',resultSource:'Sportmonks Football API',
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

test('109C Sportmonks fixture venue include drives safe daypart; invalid/mismatched venue never does',()=>{
 const item={id:'sm-19715873',competition:'eredivisie',status:'FT',resultSource:'Sportmonks Football API',
  home:{name:'FC Twente'},away:{name:'Ajax'},
  date:'2026-11-21T19:00:00Z',checkedAt:'2026-11-22T19:00:00Z',
  venueId:1001,venueName:'De Grolsch Veste',
  venue:{id:1001,name:'De Grolsch Veste',latitude:52.237,longitude:6.837,
   image_path:'unapproved-provider-photo-no-copy'}};
 const provider=f=>({source:'Sportmonks Football API',status:'available',
  competition:'eredivisie',fixtures:[f]});
 const evidence=audit.sportmonksEvidence(provider(item));
 assert.equal(evidence.length,1);
 assert.equal(evidence[0].venue.latitude,52.237);
 assert.ok(!JSON.stringify(evidence).includes('unapproved-provider-photo-no-copy'));
 const night=audit.auditQueue([job(item.id)],assets,evidence,now);
 assert.equal(night.rows[0].daypart,'night');
 assert.equal(night.rows[0].daypartEvidence,'solar_venue_coordinates');
 assert.equal(night.rows[0].classification,'pending_home_image_review');
 const dayItem={...item,date:'2026-11-21T12:00:00Z'};
 const day=audit.auditQueue([job(item.id)],assets,audit.sportmonksEvidence(provider(dayItem)),now);
 assert.equal(day.rows[0].daypart,'day');
 assert.equal(day.rows[0].classification,'requires_matching_scene_artwork');
 const wrongVenue={...item,venue:{...item.venue,id:999}};
 const without=audit.auditQueue([job(item.id)],assets,audit.sportmonksEvidence(provider(wrongVenue)),now);
 assert.equal(without.rows[0].daypart,'neutral');
 assert.equal(without.rows[0].classification,'requires_verified_daypart');
});

test('109D four Sportmonks competitions share one report without converting foreign league rows',()=>{
 const leagues=[
  ['eredivisie','Eredivisie','sm-9001'],
  ['kkd','Keuken Kampioen Divisie','sm-9002'],
  ['premierleague','Premier League','sm-9003'],
  ['knvbbeker','KNVB Beker','sm-9004']
 ];
 const snapshots=leagues.map(([competition,label,id])=>({
  status:'available',source:'Sportmonks Football API',competition,
  fixtures:[{id,competition,status:'FT',resultSource:'Sportmonks Football API',
   home:{name:'Home '+id},away:{name:'Away '+id},
   date:'2026-11-21T19:00:00Z',checkedAt:'2026-11-22T19:00:00Z'}]
 }));
 const result=audit.sportmonksEvidenceBatch(snapshots);
 assert.equal(result.length,4);
 assert.deepEqual(result.map(r=>r.competition),leagues.map(r=>r[1]));
 const checked=audit.auditQueue(leagues.map(x=>job(x[2])),assets,result,now);
 assert.equal(checked.artworkRetries,4);
 assert.equal(checked.verifiedFixtureCount,4);
 assert.equal(checked.blockedWithoutVerifiedFixture,0);
 assert.deepEqual(Object.keys(checked.verifiedCoverageByCompetition).sort(),
  leagues.map(x=>x[1]).sort());
 const mismatched={...snapshots[1],fixtures:snapshots[0].fixtures};
 assert.deepEqual(audit.sportmonksEvidence(mismatched),[]);
});

test('109D duplicates with incompatible fixture identities are unsafe and never overwrite proofs',()=>{
 const a=fact('sm-9005','FC Utrecht','NEC Nijmegen');
 const b={...a,homeTeam:'Ajax'};
 const report=audit.auditQueue([job(a.id)],assets,[a,b],now);
 assert.equal(report.fixtureConflicts,1);
 assert.equal(report.verifiedFixtureCount,0);
 assert.equal(report.blockedWithoutVerifiedFixture,1);
 assert.equal(report.rows[0].classification,'requires_verified_fixture');
 assert.deepEqual(report.rows[0].approvedAssetIds,[]);
 const duplicate=audit.auditQueue([job(a.id)],assets,[a,{...a}],now);
 assert.equal(duplicate.fixtureConflicts,0);
 assert.equal(duplicate.verifiedFixtureCount,1);
 assert.equal(duplicate.rows[0].classification,'requires_verified_daypart');
});

test('109D unavailable subscriber coverage is not misrepresented as fixture verification',()=>{
 const unavailable={source:'Sportmonks Football API',competition:'kkd',status:'source_unavailable',
  fixtures:[{id:'sm-9006',competition:'kkd',status:'FT',
   resultSource:'Sportmonks Football API',home:{name:'A'},away:{name:'B'},
   date:'2026-11-21T19:00:00Z',checkedAt:'2026-11-22T19:00:00Z'}]};
 assert.deepEqual(audit.sportmonksEvidenceBatch([unavailable]),[]);
 assert.throws(()=>audit.sportmonksEvidenceBatch(Array.from({length:5},()=>unavailable)),/vier competities/);
});

test('110B exact verified fixture art is a pending review, never a missing image or an approved report',()=>{
 const fixture=fact('sm-19715868','FC Eindhoven','RKC Waalwijk',{
  competition:'Keuken Kampioen Divisie',playedAt:'2026-11-21T15:30:00Z',
  venueId:402,venueName:'Jan Louwers Stadion',
  venue:{latitude:51.45,longitude:5.48}
 });
 const a=audit.auditQueue([job(fixture.id)],assets,[fixture],now);
 assert.equal(a.rows[0].daypart,'twilight');
 assert.equal(a.rows[0].classification,'pending_exact_fixture_review');
 assert.deepEqual(a.rows[0].approvedAssetIds,[]);
 assert.ok(a.rows[0].pendingExactCandidates.some(x=>
  x.id==='veldio110b-sm-19715868-eindhoven-rkc-report'&&
  x.reviewRequired===true&&x.requiresRework===false&&x.contextMatchesDaypart===true));
 const reversed=audit.auditQueue([job(fixture.id)],assets,
  [{...fixture,homeTeam:'RKC Waalwijk',awayTeam:'FC Eindhoven'}],now);
 assert.equal(reversed.rows[0].classification,'requires_new_original_artwork');
 const noon=audit.auditQueue([job(fixture.id)],assets,
  [{...fixture,playedAt:'2026-11-21T12:00:00Z'}],now);
 assert.equal(noon.rows[0].classification,'requires_matching_scene_artwork');
 assert.equal(noon.rows[0].pendingExactCandidates[0].contextMatchesDaypart,false);
});

test('110B pending exact report never becomes a publication claim through the production plan',()=>{
 const planner=require('../scripts/artwork-production-plan110');
 const fixture=fact('sm-19715868','FC Eindhoven','RKC Waalwijk',{
  competition:'Keuken Kampioen Divisie',playedAt:'2026-11-21T15:30:00Z',
  venueId:402,venueName:'Jan Louwers Stadion',venue:{latitude:51.45,longitude:5.48}
 });
 const a=audit.auditQueue([job(fixture.id)],assets,[fixture],now);
 const plan=planner.plan(a,now);
 assert.equal(plan.readyNow,0);
 assert.equal(plan.counts.independent_rights_review,1);
 assert.equal(plan.tasks[0].action,'independent_rights_review');
 assert.equal(plan.tasks[0].existingExactCandidates[0].reviewRequired,true);
 assert.equal(plan.tasks[0].imageBrief,undefined);
 assert.equal(plan.safety.createsImage,false);
 assert.equal(plan.safety.approvesImage,false);
});

test('110B second original day image is exact-match pending, not another generation job',()=>{
 const f=fact('sm-19714592','Ajax','ADO Den Haag',{
  competition:'Eredivisie',playedAt:'2026-11-22T13:30:00Z',
  venueId:1001,venueName:'Johan Cruijff ArenA',
  venue:{latitude:52.314,longitude:4.941}
 });
 const report=audit.auditQueue([job(f.id)],assets,[f],now);
 assert.equal(report.rows[0].daypart,'day');
 assert.equal(report.rows[0].classification,'pending_exact_fixture_review');
 assert.equal(report.rows[0].approvedAssetIds.length,0);
 assert.ok(report.rows[0].pendingExactCandidates.some(x=>x.id==='veldio110b-sm-19714592-ajax-ado-day-report'&&
  x.contextMatchesDaypart&&x.reviewRequired&&!x.requiresRework));
 const plan=require('../scripts/artwork-production-plan110').plan(report,now);
 assert.equal(plan.tasks[0].action,'independent_rights_review');
 assert.equal(plan.tasks[0].imageBrief,undefined);
 assert.equal(plan.readyNow,0);
 const swapped=audit.auditQueue([job(f.id)],assets,[{...f,homeTeam:'ADO Den Haag',awayTeam:'Ajax'}],now);
 assert.equal(swapped.rows[0].classification,'requires_new_original_artwork');
});
