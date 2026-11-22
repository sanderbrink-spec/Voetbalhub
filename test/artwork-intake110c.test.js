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
const hull=Batch.artworks[0];
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
test('110C independently verified, non-imported image remains staged and never approved',()=>{
 const r=Intake.validate(Batch,audit(hull),Catalog,repo);
 assert.equal(r.artworks.length,1);
 assert.equal(r.artworks[0].status,'awaiting_exact_binary_import');
 assert.deepEqual(r.summary,{awaiting_exact_binary_import:1});
 assert.equal(r.safety.approvesImages,false);
 assert.equal(r.safety.publishesArticles,false);
 assert.equal(r.safety.approvalThreshold,8.5);
 assert.equal(r.artworks[0].fixtureId,'sm-19722098');
 assert.equal(r.artworks[0].classification,'requires_new_original_artwork');
 assert.ok(!fs.existsSync(path.join(repo,hull.suggestedRepoPath)));
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
  {approval:'approved'}, {status:'uploaded_repo_pending_review'}, {sourceInputImagesUsed:true}
 ]){
  assert.throws(()=>Intake.validate({...Batch,artworks:[{...hull,...change}]},audit(hull),Catalog,repo));
 }
 assert.throws(()=>Intake.validate({...Batch,artworks:[hull,hull]},audit(hull),Catalog,repo),/dubbel/);
});
test('110C actual 110B GitHub binary with correct SHA is pending independent review, not publication',()=>{
 const a=Original;
 const entry={...hull,fixtureId:a.fixtureId,homeTeam:a.homeTeam,awayTeam:a.awayTeam,
  competition:a.verifiedCompetition,playedAt:a.playedAt,daypart:a.verifiedDaypart,
  webpSha256:a.webpSha256,
  webpFilename:path.basename(a.repoFile),suggestedRepoPath:a.repoFile
 };
 const r=Intake.validate({...Batch,artworks:[entry]},audit(entry,'requires_new_original_artwork'),Catalog,repo);
 assert.equal(r.artworks[0].status,'ready_for_independent_review');
 const catalogRow=Catalog.find(x=>x.fixtureId===entry.fixtureId);
 assert.equal(catalogRow.approval,'pending');
 assert.equal(catalogRow.sha256,entry.webpSha256);
 assert.equal(r.safety.approvesImages,false);
});
test('110C duplicate or conflicting image registry cannot silently replace existing picture',()=>{
 const conflicting=[{fixtureId:hull.fixtureId,sha256:'f'.repeat(64),approval:'pending'}];
 assert.throws(()=>Intake.validate(Batch,audit(hull),conflicting,repo),/ander bestand/);
 const approved=[{fixtureId:hull.fixtureId,sha256:hull.webpSha256,approval:'approved'}];
 assert.throws(()=>Intake.validate(Batch,audit(hull),approved,repo),/goedgekeurd/);
});
