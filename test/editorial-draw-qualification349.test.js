'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {oranjeDrawGroup}=require('../scripts/editorial-oranje-draw');
const {drawWritingBrief}=require('../scripts/editorial-draw-copy339');
const {validateEvidence}=require('../scripts/automatic-publication');

const now=Date.parse('2026-11-20T19:05:00Z');
const national={
 url:'https://www.onsoranje.nl/nieuws/nederlands-elftal-mannen/82847/oranje-tegen-portugal-kwartfinale-nations-league',
 title:'Oranje tegen Portugal in kwartfinale Nations League',publishedAt:'2026-11-20T11:45:00Z',
 text:[
  'Oranje speelt in de kwartfinale van de Nations League twee keer tegen Portugal.',
  'Dat werd vrijdag bepaald tijdens de loting in Nyon, Zwitserland.',
  'De wedstrijden vinden in maart plaats.',
  'De eerste wedstrijd is in Nederland, de return wordt gespeeld in Portugal.',
  'In een eventuele halve finale treft Oranje de winnaar van het duel tussen Spanje en Frankrijk.'
 ].join(' ')
};
const draw={
 url:'https://www.uefa.com/uefanationsleague/news/02ab-221d9e23448d-d862e943f6f2-1000--uefa-nations-league-quarter-final-and-play-off-ties-spain-vs/',
 publishedAt:'2026-11-20T11:45:00Z',title:'UEFA Nations League draw',
 text:[
  'Spain meet France and the Netherlands take on titleholders Portugal.',
  'Knockout stage draw results Quarter-final ties Spain vs France Netherlands vs Portugal The quarter-finals are two-legged ties and take place in March 2027.',
  'Winners advance to the Nations League finals.'
 ].join(' ')
};
const profile={
 url:'https://www.uefa.com/uefanationsleague/news/02ab-2219b45e1aa6-7834fde41ea1-1000--2026-27-nations-league-quarter-finals-get-to-know-the-eight-/',
 publishedAt:'2026-11-20T07:00:00Z',title:'Get to know eight contenders',
 text:[
  'Netherlands Players and technical staff feature in this profile of the Netherlands national football team. How they qualified : Group A2 runners-up Best Nations League performance: Runners-up (2018/19).',
  'Portugal The current Portugal squad has qualified for the final stages of the European competition. How they qualified : Group A4 winners Best Nations League performance: Winners (2018/19, 2024/25) Coach: Jorge Jesus.'
 ].join(' ')
};
test('349: both official group results become independently auditable cards despite rendered label spacing',()=>{
 const group=oranjeDrawGroup(national,[draw,profile],now);
 assert.ok(group?.drawCandidate);
 assert.equal(group.length,3,JSON.stringify(group.profileDiagnostics));
 assert.equal(group.profileDiagnostics.dutchFactFound,true);
 assert.equal(group.profileDiagnostics.portugalFactFound,true);
 assert.equal(group.drawCandidate.facts.length,10);
 assert.deepEqual(validateEvidence(group.drawCandidate,group,now),[]);
 const facts=group.drawCandidate.facts.map(f=>f.text);
 const brief=drawWritingBrief(facts);
 assert.ok(brief?.plan?.alinea3);
 assert.equal(brief.factCards.filter(x=>x.role.includes('groepsfase')).length,2);
 for(const fact of facts)assert.ok(!JSON.stringify(brief).includes(fact),'writer must not see source text');
});
test('349: no invented group placement when label absent, opponent inconsistent or source untrusted',()=>{
 const noLabel={...profile,text:profile.text.replaceAll('How they qualified : ','')};
 const absent=oranjeDrawGroup(national,[draw,noLabel],now);
 assert.equal(absent.length,2);
 assert.equal(absent.drawCandidate.facts.length,8);
 const wrong={...profile,text:profile.text.replace('Group A4 winners','Group A4 runners-up')};
 assert.equal(oranjeDrawGroup(national,[draw,wrong],now).length,2);
 const unauthorized={...profile,url:'https://fake.example.net/uefanationsleague/news/profile/'};
 assert.equal(oranjeDrawGroup(national,[draw,unauthorized],now).length,2);
});
