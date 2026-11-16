'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const config=require('../automatic-editorial.json');
const {articleUrl}=require('../scripts/editorial-discovery53');
const {nationallyRelevant}=require('../scripts/automatic-publication');

test('League A matchday reporting is discovered from the existing official UEFA domain',()=>{
 const url='https://www.uefa.com/uefanationsleague/news/02ab-221287e5a66c-f9855de4b857-1000--uefa-nations-league-matchday-6-preview-germany-welcome-nethe/';
 assert.equal(articleUrl(url,config.newsIndexes),url);
 const doc={url,title:'UEFA Nations League Matchday 6 preview: Germany welcome Netherlands, Greece host Serbia',
  text:'The key players and storylines to follow as the league phase concludes. Denmark vs Norway and Wales vs Portugal decide quarter-final places.'};
 assert.equal(nationallyRelevant(doc),true);
});
test('Men-only filter excludes irrelevant headlines and avoids treating a fixture calendar as proof of an article',()=>{
 const base='https://www.uefa.com/uefanationsleague/news/';
 assert.equal(nationallyRelevant({url:base+'02ab-sample/',title:'UEFA Nations League women preview and lineup',text:'Preview of Women Nations League'}),false);
 assert.equal(nationallyRelevant({url:base+'02ab-sample/',title:'Merchandise and stadium tickets',text:'UEFA Nations League tickets on sale'}),false);
 assert.equal(articleUrl('https://www.uefa.com/uefanationsleague/matches/',config.newsIndexes),null);
});

test('official KNVB team availability can enter the newsroom without accepting VP headlines as evidence',()=>{
 const {primaryAuthority,nationallyRelevant}=require('../scripts/automatic-publication');
 const doc={url:'https://www.onsoranje.nl/nieuws/nederlands-elftal-mannen/82834/frenkie-de-jong-mist-duitsland-uit',
  title:'Frenkie de Jong mist Duitsland-uit',
  text:'Het Nederlands elftal moet het zonder Frenkie de Jong stellen in de selectie voor de wedstrijd tegen Duitsland.'};
 assert.equal(nationallyRelevant(doc),true);
 assert.equal(primaryAuthority(doc),'association_decision');
 const vp={...doc,url:'https://www.voetbalprimeur.nl/nieuws/anders'};
 assert.equal(primaryAuthority(vp),'');
 const unrelated={...doc,title:'Frenkie de Jong scoort in nieuwe Champions League-video',
  text:'Een fan deelt de nieuwste video op sociale media.'};
 assert.equal(primaryAuthority(unrelated),'');
});
test('UEFA matchday sources never borrow evidence from unrelated US Concacaf Nations League articles',()=>{
 const {partnerDocuments}=require('../scripts/automatic-publication');
 const uefa={url:'https://www.uefa.com/uefanationsleague/news/02ab-221287e5a66c-f9855de4b857-1000--uefa-nations-league-matchday-6-preview-germany-welcome-nethe/',
  title:'UEFA Nations League matchday preview: Germany Netherlands',text:'Germany face the Netherlands in the Nations League matchday. Preview of this fixture and the return to Germany.'};
 const us={url:'https://www.ussoccer.com/stories/2026/11/usmnt/matchday-stadium-guide-vs-haiti-nations-league-miami-florida',
  title:'Nations League matchday preview: Haiti USA',text:'Nations League matchday preview with players and stadium information. Germany Netherlands matchday overview for fans.'};
 assert.deepEqual(partnerDocuments(uefa,[us]),[]);
 assert.deepEqual(partnerDocuments(us,[uefa]),[]);
});
test('official Oranje announcements can use a preapproved generic international image, not an unverified fixture stadium',()=>{
 const {resolve}=require('../image-rotation65');
 const item={articleKind:'announcement',imageCategory:'international',category:'Internationaal voetbal',
 headline:'KNVB bevestigt wijziging in selectie voor Duitsland',standfirst:'De officiële selectie van Nederland wordt aangepast.'};
 const result=resolve(item);
 assert.equal(result.assignment.state,'approved');
 assert.equal(result.article.imageRights,'cleared');
 assert.equal(result.article.imageRotation.method,'approved-article-v69');
 assert.ok(result.article.imageUrl.startsWith('https://voetbalhub-redactie.onrender.com/'));
});
