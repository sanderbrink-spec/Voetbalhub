'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {halfTimeNarrativeIssues}=require('../editorial-chronology139');
const {repairUnverifiedMatchComeback}=require('../editorial-match-narrative71');
const {reopenUtrechtNecDualScorerV71}=require('../editorial-recovery136');
const events=[
 [34,'Kevin Kers','0-1','NEC Nijmegen'],
 [38,'Dusan Tadic','0-2','NEC Nijmegen'],
 [56,'Yoann Cathline','1-2','FC Utrecht'],
 [58,'Dusan Tadic','1-3','NEC Nijmegen'],
 [64,'Dani de Wit','2-3','FC Utrecht']
];
const facts=['FC Utrecht – NEC Nijmegen eindigde in 2-3.',
 'Eredivisie, speelronde 12, gespeeld op 2026-11-08.','Ruststand 0-2.',
 ...events.map(([minute,player,score,club])=>
  'Volgens de Sportmonks-wedstrijdregistratie viel in minuut '+minute+
  ' een doelpunt van '+player+', waarna de stand '+score+' was. '+
  'De Sportmonks-participantregistratie koppelt '+player+' als doelpuntenmaker aan '+club+'.')];
const record={matchId:'sm-19714594',articleKind:'match_report',
 publishedAt:'2026-11-08T19:00:00Z',
 verifiedFacts:facts,match:{homeTeam:'FC Utrecht',awayTeam:'NEC Nijmegen',homeScore:2,awayScore:3}};
const draft=body=>({headline:'NEC Nijmegen wint bij FC Utrecht met 2-3',
 standfirst:'NEC won de Eredivisie-wedstrijd na een ruststand van 0-2.',body});
const first='In de eerste helft opende Kevin Kers de score in minuut 34 met 0-1. Dusan Tadic maakte in minuut 38 de 0-2.';
const second='Na de rust scoorde Yoann Cathline in minuut 56 de 1-2. Dusan Tadic maakte in minuut 58 de 1-3. Dani de Wit scoorde in minuut 64 de 2-3.';

test('A repeated scorer in both halves is not a false halftime-chronology rejection',()=>{
 const result=halfTimeNarrativeIssues(record,draft(['De ruststand was 0-2.',first,second]));
 assert.deepEqual(result,[]);
 const invalid=halfTimeNarrativeIssues(record,draft([
  'De ruststand was 0-2.',
  'In de eerste helft scoorde Dusan Tadic in minuut 58 de 1-3.',
  second]));
 assert.ok(invalid.some(x=>/zonder rustovergang/.test(x)),JSON.stringify(invalid));
});
test('Original score events stay intact when unverified interval and comeback prose is removed',()=>{
 const original=draft([
  'In de eerste helft scoorde Kevin Kers in minuut 34 de 0-1. Dusan Tadic scoorde in minuut 38 de 0-2.',
  'Na de rust kwam FC Utrecht terug in de wedstrijd met een doelpunt van Yoann Cathline in de 56e minuut. Twee minuten later, in minuut 58, maakte Dusan Tadic de 1-3. Dani de Wit scoorde in minuut 64 de 2-3, maar dit was niet genoeg om de achterstand om te buigen.'
 ]);
 const clean=repairUnverifiedMatchComeback(original,record);
 assert.doesNotMatch(clean.body.join(' '),/terug in de wedstrijd|achterstand|minuten later/i);
 assert.match(clean.body[1],/Na rust scoorde Yoann Cathline voor FC Utrecht in minuut 56/);
 for(const p of ['Yoann Cathline','Dusan Tadic','Dani de Wit','1-3','2-3'])
  assert.match(clean.body[1],new RegExp(p));
 assert.deepEqual(halfTimeNarrativeIssues(record,clean),[]);
 assert.match(original.body[1],/achterstand/);
});
test('Do not rewrite an unverified scorer-club reference or invented score',()=>{
 const missing={...record,verifiedFacts:facts.map(f=>f.replace('als doelpuntenmaker aan FC Utrecht','zonder bekende club'))};
 const text=draft(['Na de rust kwam FC Utrecht terug in de wedstrijd met een doelpunt van Yoann Cathline in minuut 56.',
 'Een oncontroleerbare 9-8 werd geregistreerd.']);
 assert.deepEqual(repairUnverifiedMatchComeback(text,missing),text);
});
test('Retry the exact known last rejection once, without bypassing editorial gates',()=>{
 const job={matchId:'sm-19714594',status:'review',
  failureStage:'quality',failureCategory:'journalistic_rejection',attempts:2,
  errorHash:'e6d65c46095e7da26e5ffa5f80463c05343faabe60d43ac2ca274f9289b88e03',checkpoint:'stale'};
 const now=Date.parse('2026-11-10T19:15:00Z');
 assert.equal(reopenUtrechtNecDualScorerV71(job,record,now),true);
 assert.equal(job.status,'pending');assert.equal(job.checkpoint,undefined);
 assert.equal(reopenUtrechtNecDualScorerV71({...job,status:'review'},record,now),false);
 assert.equal(reopenUtrechtNecDualScorerV71({...job,status:'review',utrechtNecDualScorerRecoveryV71:false,errorHash:'different'},record,now),false);
 assert.equal(reopenUtrechtNecDualScorerV71({...job,status:'review',utrechtNecDualScorerRecoveryV71:false},record,now+100*3600000),false);
});
