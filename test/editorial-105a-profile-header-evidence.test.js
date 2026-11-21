'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {extractPage,validateEvidence}=require('../scripts/automatic-publication');
const {oranjeDrawGroup}=require('../scripts/editorial-oranje-draw');
const {drawWritingBrief}=require('../scripts/editorial-draw-copy339');
const profileUrl='https://www.uefa.com/uefanationsleague/news/02ab-2219b45e1aa6-7834fde41ea1-1000--2026-27-nations-league-quarter-finals-get-to-know-the-eight-/';
const now=Date.parse('2026-11-21T17:15:00Z');
const knvb={
 url:'https://www.onsoranje.nl/nieuws/nederlands-elftal-mannen/82847/oranje-tegen-portugal-kwartfinale-nations-league',
 title:'Oranje tegen Portugal in kwartfinale Nations League',
 publishedAt:'2026-11-20T11:45:00Z',
 text:['Oranje speelt in de kwartfinale van de Nations League twee keer tegen Portugal.',
 'Dat werd vrijdag bepaald tijdens de loting in Nyon, Zwitserland.',
 'De wedstrijden vinden in maart plaats.',
 'De eerste wedstrijd is in Nederland, de return wordt gespeeld in Portugal.',
 'In een eventuele halve finale treft Oranje de winnaar van het duel tussen Spanje en Frankrijk.'].join(' ')
};
const uefa={
 url:'https://www.uefa.com/uefanationsleague/news/02ab-221d9e23448d-d862e943f6f2-1000--uefa-nations-league-quarter-final-and-play-off-ties-spain-vs/',
 publishedAt:'2026-11-20T11:45:00Z',
 text:["Spain will meet France while the Netherlands take on titleholders Portugal in March's UEFA Nations League quarter-finals.",
 'Knockout stage draw results Quarter-final ties Spain vs France Norway vs England Netherlands vs Portugal Belgium vs Germany The quarter-finals are two-legged ties and take place in March 2027.',
 'Winners advance to the Nations League finals.'].join(' ')
};
const header=team=>'<header class="profile-team"><h3><span>'+team+'</span></h3></header>';
const html='<meta property="article:published_time" content="2026-11-20T07:00:00Z"><article>'+
 '<h1>2026/27 Nations League quarter-finals: Get to know the eight contenders</h1>'+
 '<p>Get to know the eight contenders and their qualifications.</p>'+
 header('Netherlands')+
 '<p>Denzel Dumfries and Donyell Malen celebrate on Matchday 5. How they qualified: Group A2 runners-up.</p>'+
 '<p>Best Nations League performance: Runners-up (2018/19)</p>'+
 header('Portugal')+
 '<p>All smiles for Portugal during their win in Wales. How they qualified: Group A4 winners Best Nations League performance: Winners (2018/19, 2024/25)</p>'+
 '</article>';
test('105A: UEFA team headings inside header blocks preserve exact country attribution',()=>{
 const p=extractPage(html,profileUrl,'2026-11-20T07:00:00Z');
 assert.match(p.text,/Netherlands Denzel Dumfries/);
 assert.match(p.text,/Portugal All smiles/);
 const group=oranjeDrawGroup(knvb,[uefa,p],now);
 assert.equal(group?.length,3,JSON.stringify(group?.profileDiagnostics));
 assert.equal(group.profileDiagnostics.attached,true);
 assert.equal(group.profileDiagnostics.netherlandsSectionExtracted,true);
 assert.equal(group.profileDiagnostics.portugalSectionExtracted,true);
 assert.equal(group.drawCandidate.facts.length,10);
 assert.deepEqual(validateEvidence(group.drawCandidate,group,now),[]);
 assert.ok(drawWritingBrief(group.drawCandidate.facts.map(f=>f.text))?.plan?.alinea3);
});
test('105A: global header navigation and other sites remain excluded from articles',()=>{
 const ordinaryUrl=uefa.url;
 const other=extractPage('<article><header><h3>Portugal</h3></header><h1>Other news</h1><p>This is a sufficiently long unrelated UEFA announcement about football and the annual calendar.</p></article>',ordinaryUrl,'2026-11-20T12:00:00Z');
 assert.doesNotMatch(other.text,/Portugal/);
 const wrong=extractPage(html.replaceAll(header('Netherlands'),header('Italy')),profileUrl,'2026-11-20T07:00:00Z');
 assert.doesNotMatch(wrong.text,/Italy/);
 const group=oranjeDrawGroup(knvb,[uefa,wrong],now);
 assert.equal(group?.length,2);
 assert.equal(group?.profileDiagnostics?.netherlandsSectionExtracted,false);
 assert.equal(group?.profileDiagnostics?.portugalSectionExtracted,true);
});
