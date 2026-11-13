'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const desk=require('../editorial-desk-model');
const guidance=require('../editorial-match-guidance133');
const match=(body)=>({articleKind:'match_report',matchId:'sm-123',
 draft:{headline:'NEC wint bij FC Utrecht na meerdere doelpunten',standfirst:'NEC won de uitwedstrijd tegen FC Utrecht met 2-3 na vijf treffers.',body}});
test('supplier and registry attribution are rejected in a match story before publication',()=>{
 const quoted=match([
  'Dit blijkt uit de officiële wedstrijdregistratie van Sportmonks.',
  'Beide doelpunten werden bevestigd door de Sportmonks-wedstrijdregistratie.',
  'Na rust bracht Cathline zijn ploeg op 1-2.'
 ]);
 assert.ok(desk.matchSourceStyleIssues(quoted).length);
 assert.ok(desk.publicationIssues(quoted).some(x=>x.includes('leveranciersverantwoording')));
 for(const wording of [
  'Volgens de Sportmonks-wedstrijdregistratie scoorde de spits.',
  'Het doelpunt is geregistreerd volgens de wedstrijdregistratie.',
  'De registratie bevestigt het doelpunt volgens de bron.',
  'Volgens de wedstrijdregistratie was de ruststand 0-2.',
  'De SportMonks Football API bevestigt de 2-3.'
 ])assert.ok(desk.matchSourceStyleIssues(match([wording])).length,wording);
});
test('ordinary event reporting stays permitted and non-match attribution stays untouched',()=>{
 const normal=match([
  'In de eerste helft scoorde de spits in minuut 34.',
  'Na rust bracht een aansluitingstreffer de score op 1-2.',
  'De laatste goal volgde in de slotfase.'
 ]);
 assert.deepEqual(desk.matchSourceStyleIssues(normal),[]);
 assert.deepEqual(desk.matchSourceStyleIssues({...normal,articleKind:'announcement',
  draft:{...normal.draft,body:['De club meldt volgens de officiële bekendmaking dat de trainer vertrekt.']}}),[]);
});
test('first and revision prompts forbid provider narration but preserve source-based auditing',()=>{
 const record={articleKind:'match_report',verifiedFacts:[
  'FC Utrecht – NEC eindigde in 2-3.',
  'Eredivisie speelronde 12.',
  'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 34 een doelpunt, waarna de stand 0-1 was.',
  'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 38 een doelpunt, waarna de stand 0-2 was.',
  'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 56 een doelpunt, waarna de stand 1-2 was.'
 ]};
 for(const prompt of [guidance.writingPrompt(record),guidance.revisionPrompt(record)]){
  assert.match(prompt,/Vermeld Sportmonks, SportsMonks.*niet in kop, intro of lopende artikeltekst/);
  assert.doesNotMatch(prompt,/Schrijf in ten minste één bodyalinea ondubbelzinnig/);
  assert.match(prompt,/Gebruik alleen verifiedFacts als bewijs/);
 }
});
