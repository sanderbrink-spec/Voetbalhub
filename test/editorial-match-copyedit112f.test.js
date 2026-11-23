'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {repairProofBoundMatchLanguage112F}=require('../editorial-match-copyedit112f');
const {repairUnverifiedMatchComeback}=require('../editorial-match-narrative71');
const {halfTimeNarrativeIssues}=require('../editorial-chronology139');
function receipt(minute,name,home,away,team){
 return 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut '+minute+
  ' een doelpunt van '+name+', waarna de stand '+home+'-'+away+
  ' was. De Sportmonks-participantregistratie koppelt '+name+
  ' als doelpuntenmaker aan '+team+'.';
}
const facts=[
 'Sparta Rotterdam – AZ Alkmaar eindigde in 1-3.',
 'Ruststand 1-1.',
 receipt(15,'Isaac Babadi',1,0,'Sparta Rotterdam'),
 receipt(17,'Mateo Chávez',1,1,'AZ Alkmaar'),
 receipt(50,'Calvin Stengs',1,2,'AZ Alkmaar'),
 receipt(54,'Dave Kwakman',1,3,'AZ Alkmaar'),
 'Volgens de Sportmonks-wedstrijdregistratie kreeg Bruno Martins Indi een tweede gele kaart in minuut 78.'
];
const record={
 articleKind:'match_report',matchId:'sm-test-112f',
 verifiedFacts:facts,match:{
  homeTeam:'Sparta Rotterdam',awayTeam:'AZ Alkmaar',homeScore:1,awayScore:3
 }
};
test('112F: safely remove numerical goal gaps when both exact registered goals are identifiable in adjacent sentences',()=>{
 const draft={headline:'AZ Alkmaar wint bij Sparta Rotterdam',standfirst:'AZ versloeg Sparta Rotterdam met 1-3.',
  body:[
   'In de 15e minuut scoorde Isaac Babadi voor Sparta Rotterdam: 1-0. Twee minuten later maakte Mateo Chávez namens AZ Alkmaar gelijk: 1-1.',
   'In de 50e minuut scoorde Calvin Stengs voor AZ Alkmaar: 1-2. Vier minuten later maakte Dave Kwakman de 1-3.'
  ]};
 assert.ok(halfTimeNarrativeIssues(record,draft).some(x=>x.includes('tijdverschil')));
 const out=repairUnverifiedMatchComeback(draft,record);
 assert.notEqual(out,draft);
 assert.ok(out.body[0].includes('Daarna maakte Mateo Chávez'));
 assert.ok(out.body[1].includes('Daarna maakte Dave Kwakman'));
 assert.ok(out.body[0].includes('Isaac Babadi'));
 assert.ok(out.body[0].includes('1-0'));
 assert.ok(out.body[0].includes('1-1'));
 assert.ok(out.body[1].includes('1-2'));
 assert.ok(out.body[1].includes('1-3'));
 assert.deepEqual(halfTimeNarrativeIssues(record,out),[]);
 assert.strictEqual(repairUnverifiedMatchComeback(out,record),out);
});
test('112F: delete falsely ascribed card recipient club only for a separately verified card',()=>{
 const draft={body:[
  'In de 50e minuut scoorde Calvin Stengs: 1-2. Kort daarna kreeg Bruno\u00a0Martins\u00a0Indi van Sparta Rotterdam een tweede gele kaart in minuut 78.'
 ]};
 const out=repairProofBoundMatchLanguage112F(draft,record);
 assert.notEqual(out,draft);
 assert.match(out.body[0],/kreeg Bruno\s+Martins\s+Indi een tweede gele kaart in minuut 78/iu);
 assert.doesNotMatch(out.body[0],/Martins\s+Indi van Sparta Rotterdam/iu);
 assert.match(out.body[0],/minuut 78/);
 assert.strictEqual(repairProofBoundMatchLanguage112F(out,record),out);
});
test('112F: unregistered identity, wrong score, missing source and non-match report are never rewritten',()=>{
 const base={body:['In de 15e minuut scoorde Isaac Babadi: 1-0. Twee minuten later scoorde Mateo Chávez: 8-4.']};
 assert.strictEqual(repairProofBoundMatchLanguage112F(base,record),base);
 const ordinary={body:['Isaac Babadi opende de score. Twee minuten later schoot een onbekende speler op het doel.']};
 assert.strictEqual(repairProofBoundMatchLanguage112F(ordinary,record),ordinary);
 const plausible={body:['In de 15e minuut scoorde Isaac Babadi: 1-0. Twee minuten later maakte Mateo Chávez gelijk: 1-1.']};
 assert.strictEqual(repairProofBoundMatchLanguage112F(plausible,{...record,verifiedFacts:facts.slice(0,3)}),plausible);
 assert.strictEqual(repairProofBoundMatchLanguage112F(plausible,{...record,articleKind:'preview'}),plausible);
 assert.strictEqual(repairProofBoundMatchLanguage112F(plausible,{...record,articleKind:'score_update'}),plausible);
});
test('112F: no invented disciplinary minute or alternate role from a wrong model draft',()=>{
 const draft={body:['In de 75e minuut kreeg Bruno Martins Indi van Sparta Rotterdam een tweede gele kaart.']};
 const out=repairProofBoundMatchLanguage112F(draft,record);
 assert.ok(out.body[0].includes('in de 75e minuut'));
 assert.doesNotMatch(out.body[0],/Indi van Sparta Rotterdam/);
 // 112F fixes only attribution. The wrong minute must still be rejected by
 // the existing factual/chronology gate, never silently changed to 78.
 assert.ok(!out.body[0].includes('78'));
 const unrelated={body:['Bruno Martins Indi van Sparta Rotterdam hield de bal in bezit.']};
 assert.strictEqual(repairProofBoundMatchLanguage112F(unrelated,record),unrelated);
 const unsupported={...record,verifiedFacts:facts.slice(0,-1)};
 assert.strictEqual(repairProofBoundMatchLanguage112F(draft,unsupported),draft);
});
test('112F: source-verified scorer must occur in correct order; ambiguous duplicated receipts fail closed',()=>{
 const backwards={body:['In de 17e minuut scoorde Mateo Chávez: 1-1. Twee minuten later scoorde Isaac Babadi: 1-0.']};
 assert.strictEqual(repairProofBoundMatchLanguage112F(backwards,record),backwards);
 const ambiguous={...record,verifiedFacts:[...facts,receipt(18,'Mateo Chávez',2,1,'AZ Alkmaar')]};
 const draft={body:['In de 15e minuut scoorde Isaac Babadi: 1-0. Twee minuten later scoorde Mateo Chávez.']};
 assert.strictEqual(repairProofBoundMatchLanguage112F(draft,ambiguous),draft);
});
