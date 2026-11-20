'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {extractPage,validateEvidence}=require('../scripts/automatic-publication');
const {oranjeDrawGroup}=require('../scripts/editorial-oranje-draw');
const {drawWritingBrief}=require('../scripts/editorial-draw-copy339');

const now=Date.parse('2026-11-20T19:00:00Z');
const profileUrl='https://www.uefa.com/uefanationsleague/news/02ab-2219b45e1aa6-7834fde41ea1-1000--2026-27-nations-league-quarter-finals-get-to-know-the-eight-/';
const knvb={url:'https://www.onsoranje.nl/nieuws/nederlands-elftal-mannen/82847/oranje-tegen-portugal-kwartfinale-nations-league',
 title:'Oranje tegen Portugal in kwartfinale Nations League',publishedAt:'2026-11-20T11:45:00Z',
 text:['Oranje speelt in de kwartfinale van de Nations League twee keer tegen Portugal.',
  'Dat werd vrijdag bepaald tijdens de loting in Nyon, Zwitserland.',
  'De wedstrijden vinden in maart plaats.',
  'De eerste wedstrijd is in Nederland, de return wordt gespeeld in Portugal.',
  'In een eventuele halve finale treft Oranje de winnaar van het duel tussen Spanje en Frankrijk.'].join(' ')};
const uefa={url:'https://www.uefa.com/uefanationsleague/news/02ab-221d9e23448d-d862e943f6f2-1000--uefa-nations-league-quarter-final-and-play-off-ties-spain-vs/',
 title:'UEFA Nations League knockout draw',publishedAt:'2026-11-20T11:45:00Z',
 text:["Spain will meet France while the Netherlands take on titleholders Portugal in March's UEFA Nations League quarter-finals.",
  'Knockout stage draw results Quarter-final ties Spain vs France Norway vs England Netherlands vs Portugal Belgium vs Germany The quarter-finals are two-legged ties and take place in March 2027.',
  'Winners advance to the Nations League finals.'].join(' ')};
const filler='Previous contenders, league-phase analysis and tournament context. '.repeat(255);
const profiles=[
 'Netherlands The Netherlands team celebrates during a home match. How they qualified: Group A2 runners-up Best Nations League performance: Runners-up (2018/19).',
 'Portugal Team photograph of Portugal during the league phase. How they qualified: Group A4 winners Best Nations League performance: Winners (2018/19, 2024/25) Coach: Jorge Jesus.'
].join(' ');

test('347: UEFA profile keeps Netherlands and Portugal sections beyond previous 14k cutoff',()=>{
 assert.ok(filler.length>14000);
 const html='<meta property="article:published_time" content="2026-11-20T07:00:00Z">'+
   '<article><h1>UEFA contenders</h1><p>'+filler+'</p><p>'+profiles+'</p></article>';
 const document=extractPage(html,profileUrl,'2026-11-20T07:00:00Z');
 assert.ok(document.text.length>14000);
 assert.ok(document.text.includes('How they qualified: Group A4 winners'));
 const group=oranjeDrawGroup(knvb,[uefa,document],now);
 assert.equal(group.length,3,JSON.stringify(group.profileDiagnostics));
 assert.equal(group.profileDiagnostics.attached,true);
 assert.equal(group.drawCandidate.facts.length,10);
 assert.deepEqual(validateEvidence(group.drawCandidate,group,now),[]);
 const brief=drawWritingBrief(group.drawCandidate.facts.map(x=>x.text));
 assert.ok(brief?.plan?.alinea3,'third page gives an evidence-backed story plan');
});
test('347: ordinary sources remain capped and unverified profiles are not used',()=>{
 const html='<meta property="article:published_time" content="2026-11-20T07:00:00Z">'+
  '<article><h1>Other</h1><p>'+filler+profiles+'</p></article>';
 const ordinary=extractPage(html,uefa.url,'2026-11-20T07:00:00Z');
 assert.equal(ordinary.text.length,14000);
 const untrusted=extractPage(html,profileUrl.replace('www.uefa.com','bad.example.org'),'2026-11-20T07:00:00Z');
 assert.equal(untrusted.text.length,14000);
 const wrong={...extractPage(html,profileUrl,'2026-11-20T07:00:00Z'),text:filler+'Portugal How they qualified: Group A4 runners-up'};
 const group=oranjeDrawGroup(knvb,[uefa,wrong],now);
 assert.equal(group.length,2);
 assert.equal(group.drawCandidate.facts.length,8);
});
