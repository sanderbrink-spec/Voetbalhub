'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {confirmedClubSquad}=require('../scripts/editorial-discovery53');
const {primaryAuthority}=require('../scripts/automatic-publication');
const facts=require('../editorial-facts');
const M=require('../editorial-desk-model');
const {reopenEuropeanCompetitionName123}=require('../editorial-recovery136');
const {CREDIT}=require('../football-results52');
const now=Date.parse('2026-11-25T17:00:00Z');
test('123 official club squad is first-party only if the body confirms own selection',()=>{
 const doc={url:'https://fctwente.nl/nieuws/selectie-voor-europees-duel-met-sc-freiburg',title:'Selectie voor Europees duel met SC Freiburg',text:'FC Twente is met de volgende selectie afgereisd: Speler Een, Speler Twee.'};
 assert.equal(confirmedClubSquad(doc),true);
 assert.equal(primaryAuthority(doc),'club_decision');
 for(const bad of [{...doc,title:'Verwachte selectie voor Europees duel'},{...doc,title:'Selectie vrouwen'},{...doc,text:'SC Freiburg is met de volgende selectie afgereisd: Speler Een.'},{...doc,url:'https://example.com/nieuws/selectie'}])assert.equal(confirmedClubSquad(bad),false);
});
test('123 verified competition opening is grammar, unknown identities stay rejected',()=>{
 const draft={headline:'Arsenal speelt gelijk tegen Borussia Dortmund',standfirst:'Arsenal speelde tegen Borussia Dortmund in een duel dat eindigde in 1-1.',body:['In de Champions League stond het bij rust 1-0.']};
 const evidence=['Arsenal – Borussia Dortmund eindigde in 1-1.','Champions League, competitiefase, gespeeld op 2026-11-24.','Ruststand 1-0.'];
 assert.equal(facts.evidenceIssues(draft,evidence,null,'football-data.org').some(x=>x.includes('In de Champions')),false);
 assert.equal(facts.evidenceIssues(draft,evidence.filter(x=>!x.includes('Champions')),null,'football-data.org').some(x=>x.includes('In de Champions')),true);
});
test('123 required exact credit footer never changes the assessed editorial content',()=>{
 const payload={matchId:'fd-cl-42',articleKind:'score_update',category:'Champions League',sources:[{url:'https://www.football-data.org/'}],verifiedFacts:['Arsenal – Borussia Dortmund eindigde in 1-1.','Champions League, competitiefase, gespeeld op 2026-11-24.','Ruststand 1-0.'],match:{homeTeam:'Arsenal',awayTeam:'Borussia Dortmund',homeScore:1,awayScore:1,playedAt:'2026-11-24'},draft:{headline:'Arsenal speelt gelijk tegen Borussia Dortmund',standfirst:'Arsenal speelde in de Champions League met 1-1 gelijk tegen Borussia Dortmund.',body:['In de competitiefase stond het bij rust nog 1-0 op het scorebord.']},editorialChecks:Object.fromEntries(M.checks.map(k=>[k,true])),factChecks:{resultVerified:true,namesVerified:true,dateVerified:true,timelineVerified:true}};
 assert.deepEqual(M.publicationIssues({...payload,draft:{...payload.draft,body:[...payload.draft.body,CREDIT]}}),M.publicationIssues(payload));
 const forged={...payload,draft:{...payload.draft,body:[...payload.draft.body,CREDIT+' en Ajax wint met 8-0.']}};
 assert.ok(M.publicationIssues(forged).length>0);
});
test('123 only the documented fresh false-positive failure gets one retry',()=>{
 const job={matchId:'fd-cl-42',status:'review',failureStage:'quality',failureCategory:'journalistic_rejection',errorHash:'b61cdb9bed18626ae3b76de631a3fafe8ff1ba01a1c47cea64394f4a5172d172',checkpoint:'old'};
 const record={matchId:'fd-cl-42',category:'Champions League',publishedAt:'2026-11-24T20:00:00Z',verifiedFacts:['Champions League, competitiefase.']};
 assert.equal(reopenEuropeanCompetitionName123({...job,errorHash:'other'},record,now),false);
 assert.equal(reopenEuropeanCompetitionName123({...job},record,now+3*86400000),false);
 assert.equal(reopenEuropeanCompetitionName123(job,record,now),true);
 assert.equal(job.checkpoint,undefined);
 assert.equal(reopenEuropeanCompetitionName123({...job,status:'review'},record,now),false);
});
