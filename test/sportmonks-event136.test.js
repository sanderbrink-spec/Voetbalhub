'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Sportmonks=require('../sportmonks-football');
const Matches=require('../editorial-match55');
const now=Date.parse('2026-11-09T12:00:00Z');
const base={
 id:19714597,league_id:72,state_id:5,
 starting_at_timestamp:Math.floor(Date.parse('2026-11-08T16:00:00Z')/1000),
 participants:[
  {id:101,name:'FC Twente',meta:{location:'home'}},
  {id:102,name:'Ajax',meta:{location:'away'}}
 ],scores:[
  {description:'CURRENT',score:{participant:'home',goals:2}},
  {description:'CURRENT',score:{participant:'away',goals:2}}
 ],round:{name:'12'}
};
const events=[
 {type_id:14,sort_order:1,minute:13,extra_minute:null,participant_id:101,player_name:'Speler Alpha',result:'1-0'},
 {type_id:14,sort_order:2,minute:35,extra_minute:null,participant_id:102,player_name:'Speler Bravo',result:'1-1'},
 {type_id:14,sort_order:3,minute:60,extra_minute:null,participant_id:102,player_name:'Speler Charlie',result:'1-2'},
 {type_id:14,sort_order:4,minute:88,extra_minute:null,participant_id:101,player_name:'Speler Delta',result:'2-2'}
];
test('real Sportmonks v3 participant_id yields verified goal timeline and rich report facts',()=>{
 const fixture=Sportmonks.parseFixture({...base,events},'eredivisie',now);
 assert.equal(fixture.status,'FT');
 assert.equal(fixture.goalTimeline.length,4);
 const article=Matches.candidate(fixture,now);
 assert.equal(article.articleKind,'match_report');
 assert.equal(article.verifiedFacts.length,6);
 assert.match(article.verifiedFacts.join(' '),/Speler Charlie/);
 assert.match(article.verifiedFacts.join(' '),/1-2/);
});
test('never infer a goal chronology if the scorers team, score or cardinality disagrees',()=>{
 const badTeam=events.map(e=>({...e}));
 badTeam[2].participant_id=101;
 assert.deepEqual(Sportmonks.parseFixture({...base,events:badTeam},'eredivisie',now).goalTimeline,[]);
 const badScore=events.map(e=>({...e}));
 badScore[1].result='2-1';
 assert.deepEqual(Sportmonks.parseFixture({...base,events:badScore},'eredivisie',now).goalTimeline,[]);
 assert.deepEqual(Sportmonks.parseFixture({...base,events:events.slice(0,3)},'eredivisie',now).goalTimeline,[]);
 const conflicting=events.map(e=>({...e}));conflicting[1].team_id=101;
 assert.deepEqual(Sportmonks.parseFixture({...base,events:conflicting},'eredivisie',now).goalTimeline,[]);
});
test('own goal requires opponent participant and keeps verified event type',()=>{
 const rows=events.map(e=>({...e}));rows[0].type_id=15;rows[0].participant_id=102;
 const fixture=Sportmonks.parseFixture({...base,events:rows},'eredivisie',now);
 assert.equal(fixture.goalTimeline[0].kind,'own_goal');
 const falseOwn=rows.map(e=>({...e}));falseOwn[0].participant_id=101;
 assert.deepEqual(Sportmonks.parseFixture({...base,events:falseOwn},'eredivisie',now).goalTimeline,[]);
});
test('legacy team_id remains usable only when verified and does not override v3 data',()=>{
 const legacy=events.map(({participant_id,...e})=>({...e,team_id:participant_id}));
 const fixture=Sportmonks.parseFixture({...base,events:legacy},'eredivisie',now);
 assert.equal(fixture.goalTimeline.length,4);
});
