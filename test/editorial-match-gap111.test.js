'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {repairUnsupportedGoalGap111,verifiedGoals}=require('../editorial-match-gap111');
const {repairUnverifiedMatchComeback}=require('../editorial-match-narrative71');
const {halfTimeNarrativeIssues}=require('../editorial-chronology139');
const facts=[
 'SC Heerenveen – Feyenoord eindigde in 2-2.',
 'Ruststand 1-2.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 25 een doelpunt van Anis Hadj Moussa, waarna de stand 0-1 was.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 31 een benutte strafschop van Nacho Ferri, waarna de stand 0-2 was.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 45+3 een doelpunt van Maas Willemsen, waarna de stand 1-2 was.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 47 een doelpunt van Levi Smans, waarna de stand 2-2 was.'
];
const record={
 matchId:'sm-19714570',articleKind:'match_report',verifiedFacts:facts,
 match:{homeTeam:'SC Heerenveen',awayTeam:'Feyenoord',homeScore:2,awayScore:2}
};
const stopped='In blessuretijd van de eerste helft bracht Maas Willemsen Heerenveen op 1-2, en twee minuten later maakte Levi Smans gelijk op 2-2.';
test('111A: source-verified half boundary removes false numeric gap but preserves both scored goals',()=>{
 const original={body:[stopped]};
 const corrected=repairUnsupportedGoalGap111(original,record);
 assert.notStrictEqual(corrected,original);
 assert.match(corrected.body[0],/Maas Willemsen.*1-2, en na rust maakte Levi Smans.*2-2/);
 assert.doesNotMatch(corrected.body[0],/twee minuten later/);
 assert.deepEqual(halfTimeNarrativeIssues(record,corrected),[]);
 assert.equal(original.body[0],stopped);
 assert.strictEqual(repairUnsupportedGoalGap111(corrected,record),corrected);
});
test('111A: verified same-half goals may be connected by later, never an unsupported exact interval',()=>{
 const draft={headline:'SC Heerenveen – Feyenoord',body:[
  'Anis Hadj Moussa zette de stand op 0-1, en zes minuten later scoorde Nacho Ferri voor 0-2.'
 ]};
 const result=repairUnsupportedGoalGap111(draft,record);
 assert.match(result.body[0],/0-1, en later scoorde Nacho Ferri voor 0-2/);
 assert.equal(result.headline,draft.headline);
});
test('111A: missing source receipts, unverified scorers or incorrect score prevent a rewrite',()=>{
 const drafts=[
  {body:[stopped]},
  {body:[stopped.replace('Levi Smans','Onbekende Speler')]},
  {body:[stopped.replace('2-2','3-2')]},
  {body:['Een doelpunt van Maas Willemsen werd twee minuten later gevolgd door een tweede treffer.']}
 ];
 assert.strictEqual(repairUnsupportedGoalGap111(drafts[0],{...record,verifiedFacts:facts.slice(0,3)}),drafts[0]);
 for(const draft of drafts.slice(1))assert.strictEqual(repairUnsupportedGoalGap111(draft,record),draft);
});
test('111A: conflicting evidence and score-update formats stay blocked',()=>{
 const conflict={...record,verifiedFacts:[...facts,
  'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 49 een doelpunt van Andere Speler, waarna de stand 2-2 was.'
 ]};
 assert.deepEqual(verifiedGoals(conflict),[]);
 const draft={body:[stopped]};
 assert.strictEqual(repairUnsupportedGoalGap111(draft,conflict),draft);
 assert.strictEqual(repairUnsupportedGoalGap111(draft,{...record,articleKind:'score_update'}),draft);
});
test('111A: existing production copyedit invokes the safe repair without suppressing unrelated reviews',()=>{
 const draft={body:[stopped]};
 const result=repairUnverifiedMatchComeback(draft,record);
 assert.match(result.body[0],/en na rust maakte Levi Smans gelijk op 2-2/);
 assert.deepEqual(halfTimeNarrativeIssues(record,result),[]);
 const unresolved={body:['Twee minuten later was het spelbeeld dominant, zonder bewezen score.']};
 assert.strictEqual(repairUnverifiedMatchComeback(unresolved,record),unresolved);
});
