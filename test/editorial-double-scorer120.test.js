'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {repairProofBoundMatchLanguage112F}=require('../editorial-match-copyedit112f');
const facts=[
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 23 een doelpunt van Keane Lewis-Potter, waarna de stand 1-0 was. De Sportmonks-participantregistratie koppelt Keane Lewis-Potter als doelpuntenmaker aan Brentford.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 25 een doelpunt van Keane Lewis-Potter, waarna de stand 2-0 was. De Sportmonks-participantregistratie koppelt Keane Lewis-Potter als doelpuntenmaker aan Brentford.'
];
const record={articleKind:'match_report',match:{homeTeam:'Brentford',awayTeam:'Everton'},verifiedFacts:facts};
const draft={body:['Keane Lewis-Potter opende de score voor Brentford in de 23e minuut en verdubbelde de voorsprong twee minuten later.']};
test('120F exact repeated scorer receipt supplies second recorded minute',()=>{
 const result=repairProofBoundMatchLanguage112F(draft,record);
 assert.match(result.body[0],/minuut 25 ook het tweede doelpunt/);
 assert.doesNotMatch(result.body[0],/twee minuten later/);
 assert.match(result.body[0],/23e minuut/);
});
test('120F missing second goal or mismatched first minute stays rejected',()=>{
 assert.equal(repairProofBoundMatchLanguage112F(draft,{...record,verifiedFacts:facts.slice(0,1)}),draft);
 const wrong={body:[draft.body[0].replace('23e','24e')]};
 assert.equal(repairProofBoundMatchLanguage112F(wrong,record),wrong);
});
test('120F no unverified club attribution is repaired',()=>{
 const wrong={body:[draft.body[0].replace('Brentford','Everton')]};
 assert.equal(repairProofBoundMatchLanguage112F(wrong,record),wrong);
});
