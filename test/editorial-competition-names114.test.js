'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {evidenceIssues}=require('../editorial-facts');
const check=(line,facts)=>evidenceIssues({
 headline:'Gecontroleerde context voor het voetbal',
 standfirst:line,
 body:['De informatie betreft uitsluitend de genoemde competitie.']
},facts);
const missing=issues=>issues.filter(s=>s.startsWith('Controleer namen die niet'));
test('114A: verified complete Premier League title is not an invented footballer',()=>{
 const result=check('In de Premier League begint een nieuwe speelronde.',
  ['De Premier League houdt een nieuwe speelronde.']);
 assert.deepEqual(missing(result),[],result.join(' | '));
});
test('114A: verified complete Keuken Kampioen Divisie title is not an invented footballer',()=>{
 const result=check('In de Keuken Kampioen Divisie zijn deze clubs actief.',
  ['Deze clubs spelen in de Keuken Kampioen Divisie.']);
 assert.deepEqual(missing(result),[],result.join(' | '));
});
test('114A: unsupported league title remains blocked',()=>{
 for(const [text,facts] of [
  ['In de Premier League begint een nieuwe speelronde.',['De Eredivisie houdt een nieuwe speelronde.']],
  ['In de Keuken Kampioen Divisie begint een nieuwe speelronde.',['De Premier League houdt een nieuwe speelronde.']]
 ])assert.ok(missing(check(text,facts)).length>0,text);
});
test('114A: another supported league mention does not excuse an unsupported capitalised opening',()=>{
 const draft={headline:'De Premier League kent duidelijke kaders',
  standfirst:'In de Premier Park werd een trainer benoemd.',
  body:['In de Premier League volgt het wedstrijdprogramma.']};
 const result=evidenceIssues(draft,['Het programma voor de Premier League is aangekondigd.']);
 assert.ok(missing(result).some(x=>x.includes('In de Premier')),result.join(' | '));
});
test('114A: fabricated player stays blocked even with a verified league title',()=>{
 const result=check('In de Premier League maakte Fictus Verzon een doelpunt.',
  ['Premier League: doelpunt in deze competitie.']);
 assert.ok(missing(result).some(x=>x.includes('Fictus Verzon')),result.join(' | '));
});
