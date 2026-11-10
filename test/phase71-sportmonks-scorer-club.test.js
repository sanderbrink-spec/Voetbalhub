'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseFixture,confirmedGoals}=require('../sportmonks-football');
const {candidate}=require('../editorial-match55');
const {paragraphPlan,paragraphChronologyIssues}=require('../editorial-match-guidance133');
const {reopenUtrechtNecScorerClubV71}=require('../editorial-recovery136');
const now=Date.parse('2026-11-10T18:55:00Z');
function fixture(){
 return {id:19714594,league_id:72,state_id:5,starting_at_timestamp:Math.floor(Date.parse('2026-11-08T19:00:00Z')/1000),
  round:{name:'12'},participants:[
   {id:100,name:'FC Utrecht',meta:{location:'home'}},{id:200,name:'NEC Nijmegen',meta:{location:'away'}}],
  scores:[{description:'CURRENT',score:{participant:'home',goals:2}},
    {description:'CURRENT',score:{participant:'away',goals:3}},
    {description:'1ST_HALF',score:{participant:'home',goals:0}},
    {description:'1ST_HALF',score:{participant:'away',goals:2}}],
  events:[
   {type_id:14,sort_order:1,minute:34,player_name:'Kevin Kers',participant_id:200,result:'0-1'},
   {type_id:14,sort_order:2,minute:38,player_name:'Dusan Tadic',participant_id:200,result:'0-2'},
   {type_id:14,sort_order:3,minute:56,player_name:'Yoann Cathline',participant_id:100,result:'1-2'},
   {type_id:14,sort_order:4,minute:58,player_name:'Dusan Tadic',participant_id:200,result:'1-3'},
   {type_id:14,sort_order:5,minute:64,player_name:'Dani de Wit',participant_id:100,result:'2-3'}]};
}
test('Fase 71: Sportmonks participant IDs verify scorer-club associations, not outdated model memory',()=>{
 const checked=parseFixture(fixture(),'eredivisie',now);
 assert.deepEqual(checked.goalTimeline.map(g=>g.scorerSide),['away','away','home','away','home']);
 const record=candidate(checked,now);
 assert.ok(record);
 assert.equal(record.articleKind,'match_report');
 const text=record.verifiedFacts.join(' ');
 assert.match(text,/Kevin Kers als doelpuntenmaker aan NEC Nijmegen/);
 assert.match(text,/Dusan Tadic als doelpuntenmaker aan NEC Nijmegen/);
 assert.match(text,/Yoann Cathline als doelpuntenmaker aan FC Utrecht/);
 assert.match(text,/Dani de Wit als doelpuntenmaker aan FC Utrecht/);
 const plan=paragraphPlan(record);
 assert.deepEqual(plan.body[1].factIds,['F4','F5']);
 assert.deepEqual(plan.body[2].factIds,['F6','F7','F8']);
 const draft={body:[
  'In speelronde 12 stond het bij rust 0-2.',
  'Kevin Kers scoorde in minuut 34 de 0-1. Dusan Tadic scoorde in minuut 38 de 0-2.',
  'Yoann Cathline scoorde in minuut 56 de 1-2. Dusan Tadic scoorde in minuut 58 de 1-3. Dani de Wit scoorde in minuut 64 de 2-3.'
 ]};
 assert.equal(paragraphChronologyIssues(record,draft).filter(x=>/verkeerde bodyalinea/.test(x)).length,0);
});
test('Fase 71: mismatched scorer participant never becomes a verified player-club claim',()=>{
 const row=fixture();
 row.events[0].participant_id=100;
 assert.deepEqual(confirmedGoals(row,{home:2,away:3}),[]);
 const parsed=parseFixture(row,'eredivisie',now);
 assert.deepEqual(parsed.goalTimeline,[]);
 const record=candidate(parsed,now);
 assert.ok(record);
 assert.doesNotMatch(record.verifiedFacts.join(' '),/doelpuntenmaker aan/);
});
test('Fase 71: own goal does not assign the scorer to the club that receives the goal',()=>{
 const row=fixture();row.events[0]={...row.events[0],type_id:15,participant_id:100};
 const timeline=confirmedGoals(row,{home:2,away:3});
 assert.equal(timeline.length,5);
 assert.equal(timeline[0].scorerSide,null);
 const record=candidate(parseFixture(row,'eredivisie',now),now);
 assert.doesNotMatch(record.verifiedFacts[3],/doelpuntenmaker aan/);
 assert.match(record.verifiedFacts[4],/Dusan Tadic als doelpuntenmaker aan NEC Nijmegen/);
});
test('Fase 71: exact rejected reviewer error gets only one full review with new verified club evidence',()=>{
 const record=candidate(parseFixture(fixture(),'eredivisie',now),now);
 const job={matchId:record.matchId,status:'review',failureStage:'quality',failureCategory:'journalistic_rejection',
  errorHash:'45005172fee74f9622f64cd26f286956971683b3ba944a2e408cd4da979c5f5c',
  checkpoint:'rejected-draft',attempts:2};
 assert.equal(reopenUtrechtNecScorerClubV71(job,record,now),true);
 assert.equal(job.status,'pending');assert.equal(job.checkpoint,undefined);
 assert.equal(reopenUtrechtNecScorerClubV71({...job,status:'review'},record,now),false);
 assert.equal(reopenUtrechtNecScorerClubV71({...job,status:'review',utrechtNecScorerClubRecoveryV71:false,errorHash:'wrong'},record,now),false);
 assert.equal(reopenUtrechtNecScorerClubV71({...job,status:'review',utrechtNecScorerClubRecoveryV71:false},record,now+96*3600000),false);
});
