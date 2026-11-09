'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const chronology=require('../editorial-chronology139');
const guidance=require('../editorial-match-guidance133');
const facts=[
 'SC Heerenveen – Feyenoord eindigde in 5-3.',
 'Eredivisie, speelronde 12, gespeeld op 2026-11-08.',
 'Ruststand 1-2.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 25 een doelpunt van Anis Hadj Moussa, waarna de stand 0-1 was.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 31 een benutte strafschop van Nacho Ferri, waarna de stand 0-2 was.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 45+3 een doelpunt van Maas Willemsen, waarna de stand 1-2 was.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 47 een doelpunt van Levi Smans, waarna de stand 2-2 was.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 61 een doelpunt van Ringo Meerveld, waarna de stand 3-2 was.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 69 een doelpunt van Sem Steijn, waarna de stand 3-3 was.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 84 een doelpunt van Ringo Meerveld, waarna de stand 4-3 was.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 90+3 een doelpunt van Ringo Meerveld, waarna de stand 5-3 was.'
];
const oldSentence='In blessuretijd van de eerste helft bracht Maas Willemsen Heerenveen op 1-2, en twee minuten later maakte Levi Smans gelijk op 2-2.';
const newSentence='In blessuretijd van de eerste helft bracht Maas Willemsen Heerenveen op 1-2. Na rust, in de 47e minuut, maakte Levi Smans gelijk op 2-2.';
const record={status:'published',id:'d97a6bc2-504a-51a1-a5f8-43179f74cfe6',articleKind:'match_report',verifiedFacts:facts,match:{homeTeam:'SC Heerenveen',awayTeam:'Feyenoord',homeScore:5,awayScore:3,playedAt:'2026-11-08'},body:['Op 8 november werd de wedstrijd gespeeld. Ruststand 1-2.',oldSentence,'Ringo Meerveld scoorde drie keer.']};

test('rejects a computed two-minute interval spanning first-half stoppage time and second half',()=>{
 const draft={standfirst:'Heerenveen wint',body:[record.body[0],record.body[1],record.body[2]]};
 const issues=chronology.halfTimeNarrativeIssues(record,draft);
 assert.ok(issues.some(x=>x.includes('tijdsverschil')),issues);
 assert.ok(issues.some(x=>x.includes('rustovergang')),issues);
 assert.ok(guidance.paragraphChronologyIssues(record,draft).some(x=>/rust|tijdsverschil/i.test(x)));
});
test('accepts correctly distinguished stoppage time and restart without inventing an interval',()=>{
 const draft={standfirst:'Heerenveen wint',body:[record.body[0],newSentence,record.body[2]]};
 assert.deepEqual(chronology.halfTimeNarrativeIssues(record,draft),[]);
});
test('rejects an unsupported interval even without goal evidence',()=>{
 assert.match(chronology.halfTimeNarrativeIssues({...record,verifiedFacts:facts.slice(0,3)},{body:[oldSentence]}).join(' '),/tijdsverschil/);
});
test('rejects a timeline with a false half-time score and out-of-order goals',()=>{
 const reversed=[...facts];
 [reversed[5],reversed[6]]=[reversed[6],reversed[5]];
 reversed[2]='Ruststand 0-2.';
 assert.match(chronology.halfTimeNarrativeIssues({...record,verifiedFacts:reversed},{body:[newSentence]}).join(' '),/chronologie.*ruststand/);
});

test('recognizes ordinal minutes and rejects reversed goal paragraphs in the draft',()=>{
 const draft={body:[
  'Na rust maakte Levi Smans in de 47e minuut gelijk op 2-2.',
  'Maas Willemsen bracht Heerenveen in minuut 45+3 op 1‑2.'
 ]};
 assert.match(chronology.halfTimeNarrativeIssues(record,draft).join(' '),/buiten wedstrijdvolgorde/);
});
