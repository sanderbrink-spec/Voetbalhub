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
 assert.equal(r.rows[0].classification,'pending_home_image_review');
 assert.deepEqual(r.rows[0].approvedAssetIds,[]);
 assert.ok(r.rows[0].pendingHomeCandidates.some(x=>x.id==='veldio74-fctwente-report'));
 assert.ok(r.rows[0].pendingHomeCandidates.every(x=>x.reviewRequired===true));
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
