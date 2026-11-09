'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Desk=require('../editorial-desk-model');
const longBody=[
 'Volgens de gecontroleerde wedstrijdgegevens vielen er vier doelpunten. Voor de rust veranderde de tussenstand tweemaal, zoals de registratie van Sportmonks aangeeft.',
 'Na de pauze kwamen er nog twee treffers bij. De vastgelegde volgorde toont wanneer de stand veranderde, maar geeft geen basis voor uitspraken over balbezit of kansen.',
 'De wedstrijd eindigde in een gelijkspel. Het verslag vermeldt de bewezen doelpunten en de controleerbare tussenstanden zonder onbevestigde uitspraken over de tactiek.'
];
const base={
 matchId:'sm-19714597',articleKind:'match_report',
 verifiedFacts:['Ajax tegen FC Twente eindigde in 2-2.','Eredivisie speelronde 12.','Ruststand 1-1.','Minuut 14 1-0.','Minuut 21 1-1.','Minuut 65 2-1.','Minuut 88 2-2.'],
 sources:[{url:'https://www.sportmonks.com/football-api/'}],
 editorialChecks:Object.fromEntries(Desk.checks.map(k=>[k,true])),
 draft:{headline:'Ajax en FC Twente delen punten na vier treffers',
  standfirst:'Ajax en FC Twente eindigden in een gelijkspel volgens de gecontroleerde wedstrijdgegevens.',
  body:longBody}
};
test('evidence-rich Sportmonks match must use three to five substantive paragraphs',()=>{
 const full=Desk.publicationIssues(base);
 assert.ok(!full.some(x=>/Tekst: 3 tot 5|Compacte tekst/.test(x)),full.join(' | '));
 const short=Desk.publicationIssues({...base,draft:{...base.draft,body:[longBody[0]]}});
 assert.ok(short.some(x=>/Tekst: 3 tot 5/.test(x)),short.join(' | '));
});
test('bare result retains compact structure instead of pretending to be a full report',()=>{
 const short={...base,articleKind:'score_update',verifiedFacts:base.verifiedFacts.slice(0,2),draft:{...base.draft,body:[longBody[0]]}};
 const issues=Desk.publicationIssues(short);
 assert.ok(!issues.some(x=>/Tekst: 3 tot 5|Compacte tekst/.test(x)),issues.join(' | '));
});
