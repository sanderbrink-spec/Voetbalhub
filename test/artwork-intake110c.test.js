'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const Intake=require('../scripts/artwork-intake110c');
const Batch=require('../artwork-intake110c.json');
const Catalog=require('../image-library49.json').assets;
const Original=require('../artwork-staging110.json').items[0];
const repo=path.resolve(__dirname,'..');
// Intake operates on the current exact registered bytes, not a superseded import.
const historicalHull=Batch.artworks[0];
const hull={...historicalHull,webpSha256:Catalog.find(x=>x.fixtureId===historicalHull.fixtureId).sha256};
const CurrentBatch={...Batch,artworks:[hull]};
const audit=(entry,classification='requires_new_original_artwork')=>({
 generatedAt:'2026-11-22T22:16:37.441Z',
 safety:{readOnly:true,unlocksPublications:false},
 rows:[{
  matchId:entry.fixtureId,homeTeam:entry.homeTeam,awayTeam:entry.awayTeam,
  competition:entry.competition,playedAt:entry.playedAt,
  daypart:entry.daypart,daypartEvidence:entry.daypartEvidence,
  fixtureSource:entry.fixtureSource,classification
 }]
});
test('110D exact Hull–Brighton WEBP import is pending independent review and never approved',()=>{
 const r=Intake.validate(CurrentBatch,audit(hull),Catalog,repo);
 assert.equal(r.artworks.length,1);
 assert.equal(r.artworks[0].status,'ready_for_independent_review');
 assert.deepEqual(r.summary,{ready_for_independent_review:1});
 assert.equal(r.safety.approvesImages,false);
 assert.equal(r.safety.publishesArticles,false);
 assert.equal(r.safety.approvalThreshold,8.5);
 assert.equal(r.artworks[0].fixtureId,'sm-19722098');
 assert.equal(r.artworks[0].classification,'requires_new_original_artwork');
 assert.ok(fs.existsSync(path.join(repo,hull.suggestedRepoPath)));
 assert.equal(Intake.sha256(fs.readFileSync(path.join(repo,hull.suggestedRepoPath))),hull.webpSha256);
 assert.equal(Catalog.find(x=>x.fixtureId===hull.fixtureId).approval,'pending');
});
test('110C reject changed opponent, daytime, source or unsafe destination',()=>{
 for(const change of [
  {awayTeam:'Arsenal'}, {daypart:'night'}, {playedAt:'2026-11-21T14:00:00Z'},
  {competition:'Eredivisie'},{fixtureSource:'Unverified'}
 ]){
  assert.throws(()=>Intake.validate({...Batch,artworks:[{...hull,...change}]},audit(hull),Catalog,repo),/geverifieerde/);
 }
 for(const change of [
  {webpSha256:'bad'},
  {webpFilename:'../escape.webp'}, {suggestedRepoPath:'../escape.webp'},
  {approval:'approved'}, {status:'approved'}, {sourceInputImagesUsed:true}
 ]){
  assert.throws(()=>Intake.validate({...Batch,artworks:[{...hull,...change}]},audit(hull),Catalog,repo));
 }
 assert.throws(()=>Intake.validate({...Batch,artworks:[hull,hull]},audit(hull),Catalog,repo),/dubbel/);
});
test('110C actual 110B GitHub binary with correct SHA is pending independent review, not publication',()=>{
 const a=Original;
 const entry={...hull,fixtureId:a.fixtureId,homeTeam:a.homeTeam,awayTeam:a.awayTeam,
  competition:a.verifiedCompetition,playedAt:a.playedAt,daypart:a.verifiedDaypart,
  webpSha256:Catalog.find(x=>x.fixtureId===a.fixtureId).sha256,
  webpFilename:path.basename(a.repoFile),suggestedRepoPath:a.repoFile
 };
 const r=Intake.validate({...Batch,artworks:[entry]},audit(entry,'requires_new_original_artwork'),Catalog,repo);
 assert.equal(r.artworks[0].status,'ready_for_independent_review');
 const catalogRow=Catalog.find(x=>x.fixtureId===entry.fixtureId);
 assert.equal(catalogRow.approval,'pending');
 assert.equal(catalogRow.sha256,entry.webpSha256);
 assert.equal(r.safety.approvesImages,false);
});
test('115: superseded import hash cannot be reused after actual pixel correction',()=>{
 if(historicalHull.webpSha256!==hull.webpSha256)assert.throws(()=>Intake.validate(Batch,audit(historicalHull),Catalog,repo),/ander bestand/);
});
test('110C duplicate or conflicting image registry cannot silently replace existing picture',()=>{
 const conflicting=[{fixtureId:hull.fixtureId,sha256:'f'.repeat(64),approval:'pending'}];
 assert.throws(()=>Intake.validate(CurrentBatch,audit(hull),conflicting,repo),/ander bestand/);
 const approved=[{fixtureId:hull.fixtureId,sha256:hull.webpSha256,approval:'approved'}];
 assert.throws(()=>Intake.validate(CurrentBatch,audit(hull),approved,repo),/goedgekeurd/);
});

test('110C a fixture outside the current source window cannot pass as verified artwork',()=>{
 const p=Intake.validate(CurrentBatch,{...audit(hull),rows:[]},Catalog,repo);
 assert.equal(p.artworks[0].status,'missing_current_fixture_evidence');
 assert.equal(p.safety.approvesImages,false);
});
test('110D stale but verified imported binary remains pending review, not publication',()=>{
 const old=audit(hull);old.generatedAt='2026-11-25T22:16:37.441Z';
 const p=Intake.validate(CurrentBatch,old,Catalog,repo);
 assert.equal(p.artworks[0].status,'ready_for_independent_review');
 assert.equal(p.safety.publishesArticles,false);
});

test('110D an uploaded declaration without actual bytes or exact pending registration must fail closed',()=>{
 const otherAssets=Catalog.filter(x=>x.fixtureId!==hull.fixtureId);
 assert.throws(()=>Intake.validate(CurrentBatch,audit(hull),otherAssets,repo),/catalogusregistratie/);
 const wrongRoot=path.resolve(repo,'missing-artwork110d');
 assert.throws(()=>Intake.validate(CurrentBatch,audit(hull),Catalog,wrongRoot),/beeldbestand ontbreekt/);
});
test('110D imported fixture is recognized as pending exact review in production audit',()=>{
 const r=Intake.validate(CurrentBatch,audit(hull,'pending_exact_fixture_review'),Catalog,repo);
 assert.equal(r.artworks[0].status,'ready_for_independent_review');
 assert.equal(r.safety.approvesImages,false);
 assert.equal(r.safety.publishesArticles,false);
});
