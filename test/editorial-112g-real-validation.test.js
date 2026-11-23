'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {evidenceIssues}=require('../editorial-facts');
const {repairUnverifiedMatchComeback}=require('../editorial-match-narrative71');
const {repairProofBoundMatchLanguage112F}=require('../editorial-match-copyedit112f');
const {halfTimeNarrativeIssues}=require('../editorial-chronology139');
function goal(minute,name,home,away,team){
 return 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut '+minute+
  ' een doelpunt van '+name+', waarna de stand '+home+'-'+away+
  ' was. De Sportmonks-participantregistratie koppelt '+name+
  ' als doelpuntenmaker aan '+team+'.';
}
const azFacts=[
 'Sparta Rotterdam – AZ Alkmaar eindigde in 1-5.',
 'Eredivisie, speelronde 13, gespeeld op 2026-11-22.',
 'Ruststand 1-1.',
 goal(15,'Isaac Babadi',1,0,'Sparta Rotterdam'),
 goal(17,'Mateo Chávez',1,1,'AZ Alkmaar'),
 goal(50,'Calvin Stengs',1,2,'AZ Alkmaar'),
 goal(54,'Dave Kwakman',1,3,'AZ Alkmaar'),
 goal(75,'Ro-Zangelo Daal',1,4,'AZ Alkmaar'),
 goal(88,'Seiya Maikuma',1,5,'AZ Alkmaar'),
 'Volgens de Sportmonks-wedstrijdregistratie kreeg Bruno Martins Indi een tweede gele kaart in minuut 78.'
];
const azRecord={articleKind:'match_report',matchId:'sm-112g-sparta',
 verifiedFacts:azFacts,match:{homeTeam:'Sparta Rotterdam',awayTeam:'AZ Alkmaar',
  homeScore:1,awayScore:5,playedAt:'2026-11-22'}};
const utrechtFacts=[
 'FC Utrecht – SC Cambuur eindigde in 2-3.',
 'Eredivisie, speelronde 13, gespeeld op 2026-11-21.',
 'Ruststand 0-1.',
 goal(25,'Nicolas Binder',0,1,'SC Cambuur'),
 goal(55,'Ilyes Hamache',0,2,'SC Cambuur'),
 goal(60,'Artem Stepanov',1,2,'FC Utrecht'),
 goal(81,'Sem van Duijn',2,2,'FC Utrecht'),
 goal(83,'Morgan Costarelli',2,3,'SC Cambuur')
];
const utrecht={articleKind:'match_report',matchId:'sm-112g-utrecht',
 verifiedFacts:utrechtFacts,match:{homeTeam:'FC Utrecht',awayTeam:'SC Cambuur',
  homeScore:2,awayScore:3,playedAt:'2026-11-21'}};
test('112G: real 112F Sparta revision 2 loses only unsupported gaps and card affiliation',()=>{
 const draft={
  headline:'AZ Alkmaar wint overtuigend bij Sparta Rotterdam',
  standfirst:'In de Eredivisie verloor Sparta Rotterdam met 1-5 van AZ Alkmaar op 22 november 2026. De ruststand was 1-1.',
  body:[
   'De Eredivisiewedstrijd tussen Sparta Rotterdam en AZ Alkmaar op 22 november 2026 eindigde in een 1-5 overwinning voor AZ Alkmaar. Bij rust stond het 1-1.',
   'Isaac Babadi opende de score voor Sparta Rotterdam in de 15e minuut, maar twee minuten later maakte Mateo Chávez gelijk voor AZ Alkmaar. Deze vroege doelpunten bepaalden de ruststand op 1-1.',
   'Na rust nam AZ Alkmaar het initiatief met doelpunten van Calvin Stengs in de 50e minuut en Dave Kwakman in de 54e minuut. Ro-Zangelo Daal maakte in de 75e minuut de 1-4 en Seiya Maikuma sloot de wedstrijd af met de 1-5 in de 88e minuut. Bruno Martins Indi van Sparta Rotterdam kreeg in de 78e minuut een tweede gele kaart en moest het veld verlaten.'
  ]
 };
 const unmodified=evidenceIssues(draft,azFacts,azRecord.match,'Sportmonks Football API');
 assert.ok(unmodified.some(x=>x.includes('De Eredivisiewedstrijd'))===false,
  'Grounded grammatical compound must not be considered a player');
 assert.ok(unmodified.some(x=>x.includes('Indi van Sparta')));
 const edited=repairUnverifiedMatchComeback(draft,azRecord);
 assert.notStrictEqual(edited,draft);
 assert.match(edited.body[1],/maar daarna maakte Mateo Chávez gelijk/iu);
 assert.doesNotMatch(edited.body.join(' '),/twee minuten later|Indi van Sparta/iu);
 assert.match(edited.body[2],/Bruno Martins Indi kreeg in de 78e minuut een tweede gele kaart/iu);
 assert.match(edited.body[2],/de 1-4/);
 assert.match(edited.body[2],/de 1-5/);
 assert.deepEqual(halfTimeNarrativeIssues(azRecord,edited),[]);
 assert.equal(evidenceIssues(edited,azFacts,azRecord.match,'Sportmonks Football API')
  .filter(x=>/Controleer namen|tijdsverschil/i.test(x)).length,0);
 assert.strictEqual(repairUnverifiedMatchComeback(edited,azRecord),edited);
});
test('112G: real 112F Utrecht revision 1 keeps verified goal narrative but removes unproved interval',()=>{
 const draft={
  headline:'SC Cambuur wint met 2-3 van FC Utrecht na late doelpunten',
  standfirst:'In de Eredivisie verloor FC Utrecht met 2-3 van SC Cambuur.',
  body:[
   'In de 25e minuut opende Nicolas Binder de score voor SC Cambuur, waarmee hij de ruststand op 0-1 bracht.',
   'Na rust verdubbelde Ilyes Hamache de voorsprong van SC Cambuur in de 55e minuut naar 0-2. FC Utrecht kwam terug met een doelpunt van Artem Stepanov in de 60e minuut, gevolgd door een treffer van Sem van Duijn in de 81e minuut die de stand op 2-2 bracht. Twee minuten later maakte Morgan Costarelli het winnende doelpunt voor SC Cambuur, waardoor de eindstand 2-3 werd.'
  ]
 };
 const fixed=repairUnverifiedMatchComeback(draft,utrecht);
 assert.ok(fixed.body[1].includes('Daarna maakte Morgan Costarelli'));
 assert.ok(fixed.body[1].includes('Sem van Duijn in de 81e minuut'));
 assert.ok(fixed.body[1].includes('Ilyes Hamache'));
 assert.deepEqual(halfTimeNarrativeIssues(utrecht,fixed),[]);
 assert.strictEqual(repairUnverifiedMatchComeback(fixed,utrecht),fixed);
});
test('112G: no grammatical exception without proof of the Eredivisie, no blanket waiver for invented people',()=>{
 const record={...azRecord.match};
 const e=evidenceIssues({headline:'De Eredivisiewedstrijd en Thomas Fictivus',standfirst:'Sparta Rotterdam en AZ Alkmaar spelen.',
  body:['De Eredivisiewedstrijd werd gespeeld op 22 november 2026.']},
  azFacts.filter(x=>!x.includes('Eredivisie')),record,'Sportmonks Football API');
 assert.ok(e.some(x=>x.includes('De Eredivisiewedstrijd')));
 assert.ok(e.some(x=>x.includes('Thomas Fictivus')));
 const e2=evidenceIssues({headline:'Thomas Fictivus maakt 1-5',standfirst:'Sparta Rotterdam – AZ Alkmaar.',
  body:['Thomas Fictivus tekende voor het resultaat.']},azFacts,record,'Sportmonks Football API');
 assert.ok(e2.some(x=>x.includes('Thomas Fictivus')));
});
test('112G: unsourced goals, repeated scorer, backward order and unrelated card club are never scrubbed',()=>{
 const bad={body:['Isaac Babadi scoorde in minuut 15, maar twee minuten later maakte Thomas Fictivus gelijk.']};
 assert.strictEqual(repairProofBoundMatchLanguage112F(bad,azRecord),bad);
 const twoSame={...azRecord,verifiedFacts:[...azFacts,goal(90,'Mateo Chávez',2,5,'AZ Alkmaar')]};
 const ambiguous={body:['Isaac Babadi opende de score, maar twee minuten later scoorde Mateo Chávez.']};
 assert.strictEqual(repairProofBoundMatchLanguage112F(ambiguous,twoSame),ambiguous);
 const backwards={body:['Seiya Maikuma scoorde, maar twee minuten later scoorde Isaac Babadi.']};
 assert.strictEqual(repairProofBoundMatchLanguage112F(backwards,azRecord),backwards);
 const notCard={body:['Bruno Martins Indi van Sparta Rotterdam bleef aan de bal.']};
 assert.strictEqual(repairProofBoundMatchLanguage112F(notCard,azRecord),notCard);
 const unsupportedCard={...azRecord,verifiedFacts:azFacts.filter(x=>!x.includes('tweede gele kaart'))};
 const cardText={body:['Bruno Martins Indi van Sparta Rotterdam kreeg in de 78e minuut een tweede gele kaart.']};
 assert.strictEqual(repairProofBoundMatchLanguage112F(cardText,unsupportedCard),cardText);
});
