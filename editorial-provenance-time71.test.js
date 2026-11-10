'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {audit,evidenceIssues,officialPublisherName}=require('./editorial-facts');
const url='https://www.fcgroningen.nl/nieuws/schikkingsvoorstel-voor-hateboer-geaccepteerd/';
const facts=[
 'Hans Hateboer heeft tegen AZ een rode kaart gekregen wegens hands.',
 'Het schikkingsvoorstel voor Hans Hateboer is geaccepteerd.',
 'Hateboer mist daardoor het duel met sc Heerenveen.'
];
const draft={
 headline:'Schikkingsvoorstel voor Hans Hateboer door club geaccepteerd',
 standfirst:'FC Groningen meldt dat het voorstel voor Hans Hateboer is geaccepteerd.',
 body:['FC Groningen meldt de beslissing in de officiële clubmededeling.']
};
test('uitsluitend de exacte officiële HTTPS-host is betrouwbare bronprovenance',()=>{
 assert.equal(officialPublisherName(url),'FC Groningen');
 for(const bad of ['http://fcgroningen.nl/nieuws/x','https://fcgroningen.nl.evil.test/nieuws/x',
  'https://fcgroningen.nl@evil.test/nieuws/x','https://not-fcgroningen.nl/nieuws/x']){
  assert.equal(officialPublisherName(bad),null);
 }
});
test('bronvermelding FC Groningen wordt gecontroleerd als uitgever, niet als nieuw feit',()=>{
 assert.equal(evidenceIssues(draft,facts,null,url).filter(x=>x.includes('Controleer namen')).length,0);
 assert.ok(evidenceIssues(draft,facts,null,'').some(x=>x.includes('FC Groningen')));
 assert.equal(audit({draft,articleKind:'announcement',primaryAuthority:'club_decision',
  verifiedFacts:facts,sources:[{url}]}).length,0);
});
test('publicatietijdstip mag niet tot tijdstip van disciplinair besluit worden verzonnen',()=>{
 const wrong={...draft,body:[
  'Op maandag 09 november 2026 om 14:40 accepteerden de club en de speler het schikkingsvoorstel voor Hans Hateboer.'
 ]};
 assert.ok(evidenceIssues(wrong,facts,null,url).some(x=>x.includes('publicatietijdstip')));
 const stated='Op maandag 09 november 2026 om 14:40 accepteerden de club en de speler het schikkingsvoorstel voor Hans Hateboer.';
 assert.ok(!evidenceIssues(wrong,[...facts,stated],null,url).some(x=>x.includes('publicatietijdstip')));
});
test('onbekende persoonsnamen blijven verboden bij erkende clubsite',()=>{
 const wrong={...draft,standfirst:'FC Groningen meldt dat Jan Verzin het voorstel heeft getekend.'};
 assert.ok(evidenceIssues(wrong,facts,null,url).some(x=>x.includes('Jan Verzin')));
});