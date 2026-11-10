'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {paragraphPlan,paragraphChronologyIssues}=require('../editorial-match-guidance133');
const {repairUnverifiedMatchComeback}=require('../editorial-match-narrative71');
const {evidenceIssues}=require('../editorial-facts');
const {reopenUtrechtNecHalfTimeV71}=require('../editorial-recovery136');
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
const record={matchId:'sm-19714594',articleKind:'match_report',publishedAt:'2026-11-08T15:00:00Z',verifiedFacts:facts,match:{homeTeam:'FC Utrecht',awayTeam:'NEC Nijmegen',homeScore:2,awayScore:3,playedAt:'2026-11-08'}};
test('Fase 71: verified half-time breaks match into 34,38 and 56,58,64',()=>{
 const p=paragraphPlan(record);
 assert.equal(p.format,'rich');
 assert.deepEqual(p.body[1].factIds,['F4','F5']);
 assert.deepEqual(p.body[2].factIds,['F6','F7','F8']);
});
test('Fase 71: remove only unsupported subjective comeback, preserve all registered goals',()=>{
 const draft={headline:'NEC Nijmegen wint met 2-3 bij FC Utrecht na tweede helft',
  standfirst:'NEC Nijmegen versloeg FC Utrecht met 2-3.',
  body:[
   'De Eredivisie-wedstrijd vond plaats op 8 november 2026. Volgens de Sportmonks-wedstrijdregistratie was de ruststand 0-2.',
   'In de eerste helft scoorde Kevin Kers in minuut 34 (0-1), gevolgd door Dusan Tadic in minuut 38 (0-2).',
   'Na de rust kwam FC Utrecht sterk terug. In minuut 56 scoorde Yoann Cathline de 1-2, waarna Dusan Tadic in minuut 58 de 1-3 maakte. In minuut 64 bracht Dani de Wit FC Utrecht op 2-3, waarmee FC Utrecht de achterstand verkleinde.'
  ]};
 const fixed=repairUnverifiedMatchComeback(draft,record);
 assert.doesNotMatch(fixed.body[2],/sterk terug|achterstand/);
 for(const minute of ['56','58','64'])assert.match(fixed.body[2],new RegExp('minuut '+minute));
 assert.equal(fixed.body[0],draft.body[0]);
 assert.equal(fixed.body[1],draft.body[1]);
 assert.equal(paragraphChronologyIssues(record,fixed).filter(x=>/verkeerde bodyalinea|achterstand of comeback/.test(x)).length,0);
 assert.equal(evidenceIssues(fixed,facts,record.match,'Sportmonks Football API').filter(x=>/achterstand of comeback/.test(x)).length,0);
 assert.match(draft.body[2],/sterk terug/); // original untouched
 const verified={...record,verifiedFacts:[...facts,'FC Utrecht verkleinde de achterstand.']};
 assert.deepEqual(repairUnverifiedMatchComeback(draft,verified),draft);
});
test('Fase 71: only the exact previously rejected match may be retried once',()=>{
 const job={matchId:record.matchId,status:'review',attempts:2,failureStage:'quality',
  failureCategory:'journalistic_rejection',errorHash:'38868ad260058cc8ed3623f523cb24308a0d668fee874e2e4b5a9e2ac73dd6b3',checkpoint:'bad'};
 const now=Date.parse('2026-11-10T18:32:00Z');
 assert.equal(reopenUtrechtNecHalfTimeV71(job,record,now),true);
 assert.equal(job.status,'pending');assert.equal(job.checkpoint,undefined);
 assert.equal(reopenUtrechtNecHalfTimeV71({...job,status:'review'},record,now),false);
 assert.equal(reopenUtrechtNecHalfTimeV71({...job,status:'review',utrechtNecHalfTimeRecoveryV71:false},record,now+100*3600000),false);
 assert.equal(reopenUtrechtNecHalfTimeV71({...job,status:'review',utrechtNecHalfTimeRecoveryV71:false,errorHash:'other'},record,now),false);
});
