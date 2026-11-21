'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {oranjeDrawGroup}=require('../scripts/editorial-oranje-draw');
const {drawWritingBrief}=require('../scripts/editorial-draw-copy339');
const {validateEvidence}=require('../scripts/automatic-publication');

const now=Date.parse('2026-11-21T17:15:00Z');
const knvb={
 url:'https://www.onsoranje.nl/nieuws/nederlands-elftal-mannen/82847/oranje-tegen-portugal-kwartfinale-nations-league',
 title:'Oranje tegen Portugal in kwartfinale Nations League',
 publishedAt:'2026-11-20T11:45:00Z',
 text:[
  'Oranje speelt in de kwartfinale van de Nations League twee keer tegen Portugal.',
  'Dat werd vrijdag bepaald tijdens de loting in Nyon, Zwitserland.',
  'De wedstrijden vinden in maart plaats.',
  'De eerste wedstrijd is in Nederland, de return wordt gespeeld in Portugal.',
  'In een eventuele halve finale treft Oranje de winnaar van het duel tussen Spanje en Frankrijk.'
 ].join(' ')
};
const uefa={
 url:'https://www.uefa.com/uefanationsleague/news/02ab-221d9e23448d-d862e943f6f2-1000--uefa-nations-league-quarter-final-and-play-off-ties-spain-vs/',
 publishedAt:'2026-11-20T11:45:00Z',
 text:[
  "Spain will meet France while the Netherlands take on titleholders Portugal in March's UEFA Nations League quarter-finals.",
  'Knockout stage draw results Quarter-final ties Spain vs France Norway vs England Netherlands vs Portugal Belgium vs Germany The quarter-finals are two-legged ties and take place in March 2027.',
  'Winners advance to the Nations League finals.'
 ].join(' ')
};
const profile={
 url:'https://www.uefa.com/uefanationsleague/news/02ab-2219b45e1aa6-7834fde41ea1-1000--2026-27-nations-league-quarter-finals-get-to-know-the-eight-/',
 publishedAt:'2026-11-20T07:00:00Z',
 text:[
  'How they qualified: Group A2 runners-up', // orphan teaser before the genuine country section
  'Other tournament introductions and season context. '.repeat(18),
  'Netherlands Denzel Dumfries and Donyell Malen celebrate on Matchday 5 How they qualified: Group A2 runners-up Best Nations League performance: Runners-up (2018/19)',
  'Portugal All smiles for Portugal during their win in Wales How they qualified: Group A4 winners Best Nations League performance: Winners (2018/19, 2024/25)'
 ].join(' ')
};
test('105A: orphan opening qualification must not prevent later exact UEFA country evidence',()=>{
 const group=oranjeDrawGroup(knvb,[uefa,profile],now);
 assert.equal(group?.length,3,JSON.stringify(group?.profileDiagnostics));
 assert.equal(group.profileDiagnostics.attached,true);
 assert.equal(group.drawCandidate.facts.length,10);
 assert.deepEqual(validateEvidence(group.drawCandidate,group,now),[]);
 const brief=drawWritingBrief(group.drawCandidate.facts.map(f=>f.text));
 assert.ok(brief?.plan?.alinea3);
 assert.ok(brief.factCards.some(c=>c.role==='Nederlandse groepsfase'));
 assert.ok(brief.factCards.some(c=>c.role==='Portugese groepsfase'));
});
test('105A: wrong-country qualification or an isolated line must never be accepted',()=>{
 const bad={...profile,text:[
   'How they qualified: Group A2 runners-up',
   'Other tournament introductions and season context. '.repeat(18),
   'Netherlands Team in the league phase How they qualified: Group A3 winners',
   'Portugal Team in the league phase How they qualified: Group A4 winners'
 ].join(' ')};
 const group=oranjeDrawGroup(knvb,[uefa,bad],now);
 assert.equal(group?.length,2);
 assert.equal(group.drawCandidate.facts.length,8);
 assert.deepEqual(validateEvidence(group.drawCandidate,group,now),[]);
});
