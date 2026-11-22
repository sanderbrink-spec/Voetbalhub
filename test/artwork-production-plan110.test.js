'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../scripts/artwork-production-plan110');
const NOW=Date.parse('2026-11-22T21:44:24Z');
const item=(id,cls,options={})=>({
 matchId:id,classification:cls,
 homeTeam:'FC Eindhoven',awayTeam:'RKC Waalwijk',
 competition:'Keuken Kampioen Divisie',playedAt:'2026-11-21T15:30:00Z',
 fixtureSource:'Sportmonks',fixtureVerifiedAt:'2026-11-22T21:44:21Z',
 daypart:'twilight',daypartEvidence:'solar_venue_coordinates',
 ...options
});
const audit=(rows)=>({generatedAt:'2026-11-22T21:44:24Z',
 artworkRetries:rows.length,rows,
 safety:{readOnly:true,unlocksPublications:false}});

test('110A first three prioritized briefs use exactly verified fixture context',()=>{
 const rows=[
  item('sm-19715868','requires_new_original_artwork'),
  item('sm-19714591','requires_image_rework',{homeTeam:'FC Groningen',awayTeam:'SC Heerenveen',playedAt:'2026-11-21T20:00:00Z',competition:'Eredivisie',daypart:'night'}),
  item('sm-19714588','pending_home_image_review',{homeTeam:'Feyenoord',awayTeam:'Excelsior',playedAt:'2026-11-21T17:45:00Z',competition:'Eredivisie'}),
  item('sm-19714592','requires_matching_scene_artwork',{homeTeam:'Ajax',awayTeam:'ADO Den Haag',playedAt:'2026-11-22T13:30:00Z',competition:'Eredivisie',daypart:'day'}),
  item('sm-19722095','requires_new_original_artwork',{homeTeam:'Newcastle United',awayTeam:'Arsenal',playedAt:'2026-11-21T17:30:00Z',competition:'Premier League',daypart:'neutral',daypartEvidence:'insufficient_venue_coordinates'})
 ];
 const result=P.plan(audit(rows),NOW);
 assert.equal(result.artworkRetries,5);
 assert.equal(result.readyNow,3);
 assert.equal(result.counts.verify_venue_first,1);
 assert.equal(result.counts.independent_rights_review,1);
 assert.equal(result.counts.generate_new_original,1);
 assert.equal(result.counts.replace_failed_image,1);
 assert.equal(result.counts.generate_matching_daypart,1);
 assert.ok(result.firstBatch.includes('sm-19715868'));
 assert.ok(result.firstBatch.includes('sm-19714591'));
 assert.ok(result.firstBatch.includes('sm-19714592'));
 const f=result.tasks.find(x=>x.matchId==='sm-19715868');
 assert.equal(f.imageBrief.fixtureId,'sm-19715868');
 assert.match(f.imageBrief.visualPrompt,/schemersfeer/);
 assert.match(f.imageBrief.visualPrompt,/volle/i);
 assert.match(f.imageBrief.visualPrompt,/geen echte wedstrijdfoto/i);
 assert.ok(!f.imageBrief.visualPrompt.includes('AFAS Stadion'));
 assert.equal(result.safety.approvesImage,false);
 assert.equal(result.safety.publishesArticle,false);
});

test('110A unknown venue and commercial-rights pending image never become generated image approvals',()=>{
 const rows=[
  item('sm-22','requires_verified_daypart',{daypart:'neutral',daypartEvidence:'insufficient_venue_coordinates'}),
  item('sm-23','pending_home_image_review',{pendingHomeCandidates:[{id:'safe-name',sha256:'secret-not-needed',reviewRequired:true,requiresRework:false,contextMatchesDaypart:true}]}),
  item('sm-24','requires_new_original_artwork',{daypart:'neutral',daypartEvidence:'insufficient_venue_coordinates'}),
  item('sm-25','requires_new_original_artwork',{fixtureSource:'unknown'})
 ];
 const p=P.plan(audit(rows),NOW);
 assert.equal(p.readyNow,0);
 assert.deepEqual(p.tasks.filter(x=>x.imageBrief).map(x=>x.matchId),[]);
 assert.equal(p.counts.verify_venue_first,2);
 assert.equal(p.counts.verify_fixture,1);
 assert.equal(p.counts.independent_rights_review,1);
 const existing=p.tasks.find(t=>t.matchId==='sm-23').existingCandidates[0];
 assert.ok(!Object.hasOwn(existing,'sha256'));
 assert.equal(existing.reviewRequired,true);
});

test('110A aged match reports are not prioritized for fresh new image generation',()=>{
 const x=item('sm-123','requires_new_original_artwork',{playedAt:'2026-11-19T10:00:00Z'});
 const p=P.plan(audit([x]),NOW);
 assert.equal(p.readyNow,0);
 assert.equal(p.tasks[0].freshForEditorial,false);
 assert.equal(p.tasks[0].action,'generate_new_original');
 assert.equal(p.firstBatch.length,0);
});

test('110A refuse unsafe, duplicate or forged audit state and untrusted team strings',()=>{
 assert.throws(()=>P.plan(audit([item('sm-1','unexpected-state')]),NOW),/Onbekende/);
 assert.throws(()=>P.plan(audit([item('sm-1','requires_new_original_artwork'),item('sm-1','requires_new_original_artwork')]),NOW),/dubbele/);
 assert.throws(()=>P.plan({...audit([]),safety:{readOnly:false,unlocksPublications:false}},NOW),/onveilig/);
 assert.equal(P.safeTeam('<script>'),null);
 const p=P.plan(audit([item('sm-99','requires_new_original_artwork',{homeTeam:'<script>'})]),NOW);
 assert.equal(p.readyNow,0);
 assert.equal(p.tasks[0].action,'verify_fixture');
});
