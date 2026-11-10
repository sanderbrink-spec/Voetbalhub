'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('./editorial-desk-model');
const base={
 articleKind:'announcement',primaryAuthority:'club_decision',
 sources:[{url:'https://www.fcgroningen.nl/nieuws/schikkingsvoorstel-voor-hateboer-geaccepteerd/'}],
 verifiedFacts:[
  'FC Groningen en Hans Hateboer hebben het schikkingsvoorstel van de aanklager betaald voetbal geaccepteerd.',
  'De verdediger kreeg zondag in de slotseconden tegen AZ een rode kaart wegens opzettelijk hands waardoor hij een duidelijke scoringskans voorkwam.',
  'Daardoor mist hij op zaterdag 21 november de Derby van het Noorden tegen sc Heerenveen.'
 ],
 draft:{
  headline:'FC Groningen bevestigt schikkingsvoorstel na rode kaart',
  standfirst:'FC Groningen meldt dat Hans Hateboer het schikkingsvoorstel heeft geaccepteerd.',
  body:['De club noemt de rode kaart wegens hands als aanleiding voor het voorstel.']
 }
};
test('geverifieerd officieel tuchtbericht heeft geen externe scorebron nodig',()=>{
 assert.equal(M.requiresFlashscore(base.draft),false);
 assert.equal(M.officialDisciplinaryCardNotice(base),true);
 assert.ok(!M.publicationIssues({...base,editorialChecks:Object.fromEntries(M.checks.map(k=>[k,true]))})
  .some(x=>/Flashscore|Niet-geverifieerde wedstrijdclaim/.test(x)));
});
test('uitslag of andere wedstrijdstatistiek behoudt de externe verificatie-eis',()=>{
 for(const text of ['De eindstand was 2-1.','Er waren tien schoten op doel.','De ranglijst verandert.']){
  const item={...base,draft:{...base.draft,body:[...base.draft.body,text]}};
  assert.equal(M.officialDisciplinaryCardNotice(item),false);
  assert.ok(M.publicationIssues({...item,editorialChecks:Object.fromEntries(M.checks.map(k=>[k,true]))})
   .some(x=>/Flashscore/.test(x)));
 }
});
test('zonder officieel bevestigd schikkingsvoorstel geen uitzondering',()=>{
 assert.equal(M.officialDisciplinaryCardNotice({...base,verifiedFacts:['Een rode kaart was te zien.']}),false);
 assert.equal(M.officialDisciplinaryCardNotice({...base,primaryAuthority:null}),false);
});
test('kloktijd uit onbewezen clubbesluit is geen uitslag maar blijft onbewezen cijfer',()=>{
 const item={...base,draft:{...base.draft,body:['De club aanvaardde het voorstel om 14:40.']}};
 assert.equal(M.requiresFlashscore(item.draft),false);
 assert.equal(M.officialDisciplinaryCardNotice(item),true);
 const issues=M.publicationIssues({...item,editorialChecks:Object.fromEntries(M.checks.map(k=>[k,true]))});
 assert.ok(!issues.some(x=>/Flashscore/.test(x)));
 assert.ok(issues.some(x=>/Cijfers ontbreken/.test(x)));
});
