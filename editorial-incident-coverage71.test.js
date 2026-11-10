'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const guidance=require('./editorial-match-guidance133');
const record={
 articleKind:'match_report',
 match:{homeTeam:'AZ',awayTeam:'FC Groningen',homeScore:4,awayScore:3},
 verifiedFacts:[
  'AZ – FC Groningen eindigde in 4-3.',
  'Eredivisie, speelronde 12, gespeeld op 2026-11-08.',
  'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 6 een doelpunt van Speler A, waarna de stand 1-0 was.',
  'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 9 een doelpunt van Speler B, waarna de stand 1-1 was.',
  'Volgens de officiële wedstrijdregistratie kreeg Hans Hateboer een rode kaart.',
  'Volgens de officiële wedstrijdregistratie kreeg Etienne Vaessen zijn tweede gele kaart.',
  'Volgens een geverifieerde bron volgde een VAR-beoordeling na een strafschopmoment.'
 ]
};
const draft={headline:'AZ wint van Groningen',standfirst:'AZ won met 4-3.',body:['Gedetailleerde wedstrijdcontext zonder beslissingen.','De twee doelpunten uit de openingsfase.','De wedstrijd eindigde in winst voor AZ.']};
test('blokkeert verslag dat rode kaarten VAR en strafschop uit gecontroleerde feiten verzwijgt',()=>{
 const issues=guidance.verifiedIncidentCoverageIssues(record,draft);
 assert.equal(issues.length,5);
 assert.ok(issues.some(x=>x.includes('red_card')));
 assert.ok(issues.some(x=>x.includes('var')));
 assert.ok(issues.some(x=>x.includes('penalty')));
});
test('volledige incidentendekking heft de blokkade op zonder normverlaging',()=>{
 const revised={...draft,body:[...draft.body,'Hans Hateboer kreeg een rode kaart en Etienne Vaessen zijn tweede gele kaart. De VAR beoordeelde het strafschopmoment.']};
 assert.deepEqual(guidance.verifiedIncidentCoverageIssues(record,revised),[]);
});
test('zonder geverifieerde incidentfeiten geen incidenten verzinnen',()=>{
 const ordinary={...record,verifiedFacts:record.verifiedFacts.slice(0,4)};
 assert.deepEqual(guidance.verifiedIncidentCoverageIssues(ordinary,draft),[]);
});
test('ook bij fout aantal alinea’s wordt ontbrekend incident gemeld',()=>{
 const short={...draft,body:[draft.body[0]]};
 assert.ok(guidance.paragraphChronologyIssues(record,short).some(x=>x.includes('red_card')));
});
test('schrijfopdracht eist incidenten en verbiedt fictieve scoringskansen',()=>{
 const prompt=guidance.writingPrompt(record);
 assert.match(prompt,/geverifieerde rode kaart/);
 assert.match(prompt,/zeker een doelpunt/);
});

test('twee rode kaarten: ieder bij naam noemen',()=>{
 const draftOne={...draft,body:[...draft.body,'Hans Hateboer kreeg een rode kaart. De VAR beoordeelde de strafschop.']};
 const issues=guidance.verifiedIncidentCoverageIssues(record,draftOne);
 assert.ok(issues.some(x=>x.includes('Etienne Vaessen')));
 const draftBoth={...draftOne,body:[...draftOne.body,'Etienne Vaessen kreeg zijn tweede gele kaart.']};
 assert.deepEqual(guidance.verifiedIncidentCoverageIssues(record,draftBoth),[]);
});
test('expliciete kaarten uit officiële matchbron extraheerbaar, niet uit voorbeschouwing',()=>{
 const extract=require('./editorial-match-evidence122').verifiedDisciplinaryFacts;
 const match={match:{homeTeam:'AZ',awayTeam:'FC Groningen'}};
 const doc={url:'https://www.fcgroningen.nl/nieuws/verslag-az-groningen/',title:'Verslag AZ FC Groningen',
  text:'AZ en Groningen speelden een wedstrijd. Hans Hateboer kreeg een rode kaart in de tweede helft. Etienne Vaessen kreeg zijn tweede gele kaart wegens protest. '+('Het duel was gespeeld. ').repeat(5)};
 const facts=extract(doc,match);
 assert.equal(facts.length,2);
 assert.ok(facts.some(x=>x.includes('Hans Hateboer')));
 assert.ok(facts.some(x=>x.includes('Etienne Vaessen')));
 assert.deepEqual(extract({...doc,title:'Voorbeschouwing AZ Groningen'},match),[]);
});

test('vermelding als doelman vervangt zijn eigen tweede gele kaart niet',()=>{
 const fake={...draft,body:['Etienne Vaessen stond op doel. Hans Hateboer kreeg een rode kaart. De VAR beoordeelde de strafschop.']};
 assert.ok(guidance.verifiedIncidentCoverageIssues(record,fake).some(x=>x.includes('Etienne Vaessen')));
});
