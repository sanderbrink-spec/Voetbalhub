'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {polishParagraph,candidate,apply}=require('../editorial-match-copyedit96');
const {matchSourceStyleIssues}=require('../editorial-desk-model');
const facts=[
 'FC Utrecht – NEC Nijmegen eindigde in 2-3.',
 'Eredivisie speelronde 12, gespeeld op 2026-11-08.',
 'Ruststand 0-2.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 34 een doelpunt van Kevin Kers, waarna de stand 0-1 was.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 38 een doelpunt van Dusan Tadic, waarna de stand 0-2 was.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 56 een doelpunt van Yoann Cathline, waarna de stand 1-2 was.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 58 een doelpunt van Dusan Tadic, waarna de stand 1-3 was.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 64 een doelpunt van Dani de Wit, waarna de stand 2-3 was.'
];
function article(){
 return {id:'example-article-01',status:'published',matchId:'sm-12345',articleKind:'match_report',category:'Eredivisie',
  headline:'NEC Nijmegen wint uitwedstrijd van FC Utrecht',
  standfirst:'NEC Nijmegen won het duel bij FC Utrecht met 2-3 na een ruststand van 0-2.',
  body:[
   'De bezoekers bouwden vóór rust een voorsprong van 0-2 op, zonder dat FC Utrecht tot scoren was gekomen. Dit blijkt uit de officiële wedstrijdregistratie van Sportmonks.',
   'In de eerste helft opende Kevin Kers de score voor NEC Nijmegen in de 34e minuut, gevolgd door een doelpunt van Dusan Tadic in de 38e minuut, waarmee NEC Nijmegen de ruststand op 0-2 bracht. Beide doelpunten werden bevestigd door de Sportmonks-wedstrijdregistratie en gekoppeld aan de genoemde spelers.',
   'Na rust wist FC Utrecht via Yoann Cathline in de 56e minuut de 1-2 te maken. In de 58e minuut vergrootte Dusan Tadic de voorsprong van NEC Nijmegen opnieuw tot 1-3. FC Utrecht kwam nog terug tot 2-3 door een doelpunt van Dani de Wit in de 64e minuut. Deze doelpunten zijn geregistreerd volgens de Sportmonks-wedstrijdregistratie.'
  ],
  match:{homeTeam:'FC Utrecht',awayTeam:'NEC Nijmegen',homeScore:2,awayScore:3,playedAt:'2026-11-08'},
  verifiedFacts:facts,sources:[{url:'https://www.sportmonks.com/football-api/'}]};
}
test('screenshot-style self-referential sentences are removed without dropping scores or players',()=>{
 const input=article(),updated=candidate(input);
 if(!updated){
  const edited={headline:input.headline,standfirst:input.standfirst,body:input.body.map(polishParagraph)};
  const payload={...input,draft:edited,factChecks:{resultVerified:true,namesVerified:true,dateVerified:true,timelineVerified:true}};
  assert.fail(JSON.stringify({edited,structure:require('../editorial-desk-model').draftIssues(edited,false),
   style:matchSourceStyleIssues({articleKind:'match_report',draft:edited}),
   facts:require('../editorial-facts').audit(payload),
   chronology:require('../editorial-chronology139').halfTimeNarrativeIssues(payload,edited)}));
 }
 assert.equal(updated.body.length,3);
 assert.deepEqual(matchSourceStyleIssues({articleKind:'match_report',draft:updated}),[]);
 assert.equal(updated.body[0],'De bezoekers bouwden vóór rust een voorsprong van 0-2 op, zonder dat FC Utrecht tot scoren was gekomen.');
 assert.match(updated.body[1],/Kevin Kers.+34e.+Dusan Tadic.+38e/);
 assert.match(updated.body[2],/Cathline.+56e/);
 assert.match(updated.body[2],/58e minuut vergrootte Dusan Tadic/);
 assert.match(updated.body[2],/Dani de Wit.+64e/);
 assert.deepEqual(input.body,article().body,'old copy untouched');
});
test('cited goal event retains minute and scorer when the introductory attribution is removed',()=>{
 const p='Volgens de Sportmonks-wedstrijdregistratie viel in minuut 34 een doelpunt van Kevin Kers, waarna de stand 0-1 was.';
 assert.equal(polishParagraph(p),'In minuut 34 viel een doelpunt van Kevin Kers, waarna de stand 0-1 was.');
});
test('unknown or factual supplier claims are never stripped or republished',()=>{
 const a=article();a.body[1]+=' Volgens Sportmonks viel nog een doelpunt van een andere speler.';
 assert.equal(candidate(a),null);
 a.body=article().body;a.verifiedFacts=[];
 assert.equal(candidate(a),null);
 assert.equal(candidate({...article(),articleKind:'announcement'}),null);
});
test('each changed article gets an atomic original archive, no blanket update and no repetition',async()=>{
 const a=article();const key='article:'+a.id;let current=JSON.stringify(a),archived=null,writes=0;
 const client={keys:async()=>[key],mGet:async()=>[current],
  eval:async(_lua,{keys,arguments:args})=>{
   assert.deepEqual(keys,[key,'article-copyedit:96:'+a.id]);
   if(current!==args[0]||archived)return 0;
   archived=current;current=args[1];writes++;return 1;
  }};
 const log={info:()=>{}};
 const first=await apply(client,log);assert.deepEqual(first,{examined:1,detected:1,updated:1,reviewRequired:0});
 assert.equal(writes,1);assert.ok(archived.includes('Sportmonks'));
 const second=await apply(client,log);assert.deepEqual(second,{examined:1,detected:0,updated:0,reviewRequired:0});
});
