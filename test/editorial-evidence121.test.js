'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {repairUnsupportedGoalGap111}=require('../editorial-match-gap111');
const {halfTimeNarrativeIssues}=require('../editorial-chronology139');
const {discoverCorroboration,researchTerms}=require('../scripts/editorial-discovery53');
const record={articleKind:'match_report',match:{homeScore:1,awayScore:1},verifiedFacts:[
 'Ruststand 1-0.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 45+3 een doelpunt van Jan Jansen, waarna de stand 1-0 was.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 47 een doelpunt van Piet Pieters, waarna de stand 1-1 was.'
]};
test('121 unsupported interval at start of a sentence is repaired only with two verified distinct goals',()=>{
 const draft={body:['Jan Jansen maakte de 1-0. Vier minuten later maakte Piet Pieters de 1-1.']};
 const revised=repairUnsupportedGoalGap111(draft,record);
 assert.equal(revised.body[0],'Jan Jansen maakte de 1-0. Na rust maakte Piet Pieters de 1-1.');
 assert.deepEqual(halfTimeNarrativeIssues(record,revised),[]);
 assert.equal(repairUnsupportedGoalGap111({body:['Jan Jansen maakte de 1-0. Vier minuten later maakte Onbekende Speler de 1-1.']},record).body[0],'Jan Jansen maakte de 1-0. Vier minuten later maakte Onbekende Speler de 1-1.');
});
test('121 targeted search sends anchors only and accepts independent configured article URLs only',async()=>{
 const indexes=[{url:'https://www.psv.nl/media',articlePath:'^/media/artikel/[^/]+/?$'},{url:'https://www.uefa.com/uefachampionsleague/',articlePath:'^/uefachampionsleague/news/02[a-z0-9-]+/?$'}];
 const doc={url:'https://www.psv.nl/media/artikel/test',title:'PSV ontvangt Arsenal in de Champions League',text:'Do not transmit body'};
 const valid='https://www.uefa.com/uefachampionsleague/news/02ab-abc--psv-arsenal/';
 const result=await discoverCorroboration(doc,indexes,async url=>{
  const query=new URL(url).searchParams.get('query');
  assert.match(query,/psv/);assert.match(query,/arsenal/);
  assert.match(query,/domain:uefa.com/);assert.doesNotMatch(query,/domain:psv.nl|Do not transmit body/);
  return {ok:true,body:null};
 },async()=>JSON.stringify({articles:[{url:valid},{url:valid+'?x=1'},{url:doc.url},{url:'https://example.org/news/fake'},{url:'https://www.uefa.com/uefachampionsleague/clubs/'}]}));
 assert.deepEqual(result,[valid]);
 assert.deepEqual(researchTerms('Het nieuws van vandaag'),[]);
});
