'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {repairUnverifiedMatchComeback}=require('../editorial-match-narrative71');
const {reopenUtrechtNecVerifiedWordingV71}=require('../editorial-recovery136');
const {evidenceIssues}=require('../editorial-facts');

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
const record={matchId:'sm-19714594',articleKind:'match_report',
 publishedAt:'2026-11-08T15:00:00Z',verifiedFacts:facts,
 match:{homeTeam:'FC Utrecht',awayTeam:'NEC Nijmegen',homeScore:2,awayScore:3,playedAt:'2026-11-08'}};
const make=(headline,body)=>({headline,standfirst:'NEC Nijmegen wint met 2-3 bij FC Utrecht, ruststand 0-2.',body});

test('Fase 71: preserve official match goals while removing only unverifiable commentary',()=>{
 const draft=make('NEC Nijmegen wint met 2-3 bij FC Utrecht in Eredivisie',[
  'De wedstrijd vond plaats op 8 november 2026 in speelronde 12. Bij rust was de stand 0-2.',
  'Kevin Kers scoorde in minuut 34 de 0-1. Dusan Tadic scoorde in minuut 38 de 0-2.',
  'Na rust scoorde Yoann Cathline in minuut 56 de 1-2. Twee minuten later, in de 58e minuut, scoorde Dusan Tadic de 1-3. Dani de Wit maakte in minuut 64 de 2-3, maar dit was niet genoeg om de achterstand ongedaan te maken.'
 ]);
 const fixed=repairUnverifiedMatchComeback(draft,record);
 assert.doesNotMatch(fixed.body.join(' '),/achterstand|minuten later/i);
 assert.match(fixed.body[2],/In de 58e minuut/);
 for(const name of ['Yoann Cathline','Dusan Tadic','Dani de Wit'])
  assert.match(fixed.body[2],new RegExp(name));
 for(const score of ['1-2','1-3','2-3'])assert.match(fixed.body[2],new RegExp(score));
 assert.equal(evidenceIssues(fixed,facts,record.match,'Sportmonks Football API').filter(r=>/achterstand of comeback|tussenstand wijkt/.test(r)).length,0);
 assert.match(draft.body[2],/twee minuten|Twee minuten/); // source draft intact
});

test('Fase 71: headline cleanup leaves an accurate, substantive model-written title',()=>{
 const original=make('NEC Nijmegen wint met 2-3 bij FC Utrecht na rustseizoen met 0-2 achterstand',[
  'De ruststand was 0-2.','Kevin Kers scoorde in minuut 34 de 0-1.','Dusan Tadic scoorde in minuut 38 de 0-2.'
 ]);
 const fixed=repairUnverifiedMatchComeback(original,record);
 assert.equal(fixed.headline,'NEC Nijmegen wint met 2-3 bij FC Utrecht');
 assert.deepEqual(fixed.body,original.body);
});

test('Fase 71: verified score replaces only an unsupported trailing deficit claim',()=>{
 const original=make('NEC Nijmegen wint met 2-3 bij FC Utrecht',[
  'De wedstrijd vond plaats in speelronde 12 op 8 november 2026.',
  'Kevin Kers scoorde in minuut 34 de 0-1. Dusan Tadic scoorde in minuut 38 de 0-2.',
  'In minuut 56 scoorde Yoann Cathline, waarmee de achterstand werd verkleind tot 1-2. In minuut 58 maakte Dusan Tadic de 1-3. Dani de Wit scoorde in minuut 64 de 2-3.'
 ]);
 const fixed=repairUnverifiedMatchComeback(original,record);
 assert.match(fixed.body[2],/waarna de stand 1-2 was/);
 assert.doesNotMatch(fixed.body.join(' '),/achterstand/);
 assert.equal(evidenceIssues(fixed,facts,record.match,'Sportmonks Football API').filter(r=>/achterstand of comeback/.test(r)).length,0);
 const unverified=make('NEC Nijmegen wint met 2-3 bij FC Utrecht',[
  'De ruststand is 0-2.',
  'Kevin Kers scoorde in minuut 34 de 0-1.',
  'Onbewezen resultaat, waarmee de achterstand werd verkleind tot 9-8.'
 ]);
 assert.deepEqual(repairUnverifiedMatchComeback(unverified,record),unverified);
});

test('Fase 71: repeatable hard gate allows exactly one new check for the observed rejection',()=>{
 const base={matchId:'sm-19714594',status:'review',attempts:2,
  failureStage:'quality',failureCategory:'journalistic_rejection',
  errorHash:'e6d65c46095e7da26e5ffa5f80463c05343faabe60d43ac2ca274f9289b88e03',
  checkpoint:'rejected'};
 const now=Date.parse('2026-11-10T18:44:00Z'),job={...base};
 assert.equal(reopenUtrechtNecVerifiedWordingV71(job,record,now),true);
 assert.equal(job.status,'pending');assert.equal(job.checkpoint,undefined);
 assert.equal(reopenUtrechtNecVerifiedWordingV71({...job,status:'review'},record,now),false);
 assert.equal(reopenUtrechtNecVerifiedWordingV71({...base,errorHash:'different'},record,now),false);
 assert.equal(reopenUtrechtNecVerifiedWordingV71({...base},record,now+100*3600000),false);
});
