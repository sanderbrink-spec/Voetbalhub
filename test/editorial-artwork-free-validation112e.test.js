'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const p=require('../scripts/automatic-publication');
const now=Date.parse('2026-11-23T12:00:00Z');
function record(patch={}){
 const full={
  matchId:'sm-training-evidence',articleKind:'match_report',
  match:{playedAt:new Date(now-48*3600000).toISOString(),homeTeam:'Ajax',awayTeam:'PSV',
   homeScore:2,awayScore:1},
  verifiedFacts:[
   'Ajax – PSV eindigde in 2-1.',
   'Eredivisie gespeeld op 2026-11-21.',
   'Ruststand 1-0.',
   'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 28 een doelpunt van Speler A, waarna de stand 1-0 was.',
   'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 61 een doelpunt van Speler B, waarna de stand 1-1 was.',
   'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 76 een doelpunt van Speler C, waarna de stand 2-1 was.',
   'De wedstrijdregistratie bevestigt de eindstand 2-1.',
   'De wedstrijd was een competitieduel.'
  ]
 };
 return {...full,...patch};
}
test('112E: verify two or more literal goal events from rich source receipts for image-free validation only',()=>{
 const g={matchRecord:record()};
 assert.equal(p.shouldValidateMatchCopyWithoutArtwork(g,now),true);
 assert.equal(p.shouldDraftVerifiedMatchBeforeArtwork(g,now),false);
 assert.equal(p.shouldValidateMatchCopyWithoutArtwork(g,now+73*3600000),false);
});
test('112E: sparse score updates, invented events, future and stale match dates cannot enter isolated writer',()=>{
 const good=record();
 const unsafe=[
  {articleKind:'score_update'},
  {verifiedFacts:good.verifiedFacts.slice(0,6)},
  {verifiedFacts:good.verifiedFacts.map(s=>s.replace(/^Volgens de Sportmonks-wedstrijdregistratie/,'Media zeggen'))},
  {match:{playedAt:new Date(now+3600000).toISOString()}},
  {match:{playedAt:new Date(now-75*3600000).toISOString()}},
  {matchId:null}
 ];
 for(const patch of unsafe)assert.equal(p.shouldValidateMatchCopyWithoutArtwork({matchRecord:record(patch)},now),false,
  JSON.stringify(patch).slice(0,100));
});
test('112E: production artwork gate and publication reviewer stay intact in source code',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../scripts/automatic-publication.js'),'utf8');
 assert.match(s,/validationCopyProbeRemaining=2/);
 assert.match(s,/const dryRun=validationOnly&&validationCopyProbeRemaining>0/);
 assert.match(s,/const draftFirst=validationCopyProbe\|\|shouldDraftBeforeArtwork/);
 assert.match(s,/if\(validationOnly\)\{\s*report\.validated\.push/);
 assert.match(s,/const finalArt=preflightArtwork\(group,candidate,topic\)/);
 assert.match(s,/if\(finalArt\.checked&&!finalArt\.approved\)/);
 assert.match(s,/Object\.assign\(payload,await uploadCover\(payload\)\)/);
 assert.match(s,/await storeReviewedArticle\(payload,assessment,matchRecord\?'match':'news'/);
 assert.match(s,/durable=discoveryOnly\?.+isolated:validationOnly/);
});
test('112E: editorial dry run never bypasses independent score / evidence checks',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../scripts/automatic-publication.js'),'utf8');
 assert.match(s,/const evidenceIssues=matchRecord\?\[\]:validateEvidence\(candidate,group,now\)/);
 assert.match(s,/const insufficientStory=M\.storyIssues/);
 assert.match(s,/report\.counts\.approved\+\+/);
 assert.match(s,/await reviseDraft/);
 assert.match(s,/if\(validationOnly\)\{\s*report\.validated\.push/);
});
