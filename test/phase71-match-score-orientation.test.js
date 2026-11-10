'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {repairReversedVerifiedScores}=require('../editorial-score-orientation71');
const {reopenUtrechtNecScoreOrientationV71}=require('../editorial-recovery136');
const facts=[
 'FC Utrecht – NEC Nijmegen eindigde in 2-3.',
 'Eredivisie, speelronde 12, gespeeld op 2026-11-08.',
 'Ruststand 0-2.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 34 een doelpunt van Kevin Kers, waarna de stand 0-1 was.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 38 een doelpunt van Dusan Tadic, waarna de stand 0-2 was.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 56 een doelpunt van Yoann Cathline, waarna de stand 1-2 was.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 58 een doelpunt van Dusan Tadic, waarna de stand 1-3 was.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 64 een doelpunt van Dani de Wit, waarna de stand 2-3 was.'
];
const record={matchId:'sm-19714594',articleKind:'match_report',publishedAt:'2026-11-08T15:00:00Z',verifiedFacts:facts,match:{homeTeam:'FC Utrecht',awayTeam:'NEC Nijmegen',homeScore:2,awayScore:3}};
test('Fase 71: the full official home-away goal timeline corrects inverted AI scores',()=>{
 const draft={headline:'NEC Nijmegen wint met 3-2 bij FC Utrecht',
  standfirst:'NEC won met 3-2. De ruststand was 0-2.',body:[
   'Bij rust stond NEC met 2-0 voor tegen FC Utrecht.',
   'Na rust kwam de stand volgens de registratie op 1-3.',
   'NEC hield met 3–2 de eindzege vast na de 2-3.'
  ]};
 const fixed=repairReversedVerifiedScores(draft,record);
 assert.equal(fixed.headline,'NEC Nijmegen wint met 2-3 bij FC Utrecht');
 assert.equal(fixed.standfirst,'NEC won met 2-3. De ruststand was 0-2.');
 assert.equal(fixed.body[0],'Bij rust stond NEC met 0-2 voor tegen FC Utrecht.');
 assert.equal(fixed.body[1],draft.body[1]);
 assert.equal(fixed.body[2],'NEC hield met 2-3 de eindzege vast na de 2-3.');
 assert.equal(draft.headline,'NEC Nijmegen wint met 3-2 bij FC Utrecht');
 const {evidenceIssues}=require('../editorial-facts');
 assert.equal(evidenceIssues(fixed,facts,record.match,'Sportmonks Football API').filter(x=>/Uitslag of tussenstand wijkt/.test(x)).length,0);
});
test('Fase 71: no invented or ambiguous goal corrections',()=>{
 const draft={headline:'FC Utrecht 3-2 en 2-0',standfirst:'Geen gecontroleerde 3-2.',body:['Feiten eerst.']};
 const ambiguous={...record,verifiedFacts:[...facts,'Historisch scoremoment 3-2.','Stand 2-0.']};
 assert.deepEqual(repairReversedVerifiedScores(draft,ambiguous),draft);
 assert.deepEqual(repairReversedVerifiedScores(draft,{...record,match:{...record.match,homeScore:1}}),draft);
 assert.deepEqual(repairReversedVerifiedScores(draft,{...record,articleKind:'preview'}),draft);
});
test('Fase 71: the exact logged Utrecht-NEC failure reopens once only',()=>{
 const job={matchId:record.matchId,status:'review',attempts:2,failureStage:'quality',
  failureCategory:'journalistic_rejection',errorHash:'77eda278e452862d5033b25e7fd1b05e39cc9b965864d446c340a25b7de4197a',
  checkpoint:'discarded-unverified'};
 const now=Date.parse('2026-11-10T18:22:00Z');
 assert.equal(reopenUtrechtNecScoreOrientationV71(job,record,now),true);
 assert.equal(job.status,'pending');
 assert.equal(job.attempts,0);
 assert.equal(job.checkpoint,undefined);
 assert.equal(reopenUtrechtNecScoreOrientationV71({...job,status:'review'},record,now),false);
 assert.equal(reopenUtrechtNecScoreOrientationV71({...job,status:'review',utrechtNecScoreOrientationRecoveryV71:false,errorHash:'wrong'},record,now),false);
 assert.equal(reopenUtrechtNecScoreOrientationV71({...job,status:'review',utrechtNecScoreOrientationRecoveryV71:false},record,now+96*3600000),false);
});
