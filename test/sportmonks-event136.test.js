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

test('a stale cache from the old Sportmonks goal parser cannot hide the corrected match evidence',async()=>{
 const Football=require('../football-data47');
 const oldSnapshot={rightsExpiresAt:now+5*3600000,sourceDetails:{name:'Sportmonks Football API'},
  source:'Sportmonks Football API',fixtures:[],status:'available'};
 let calls=0;
 const api=Football.create({
  clock:()=>now,sportmonksToken:'test-token',
  redis:{isReady:true,get:async()=>JSON.stringify(oldSnapshot)},
  fetcher:async url=>{
   calls++;
   assert.match(url,/api.sportmonks.com/);
   const rows=Array.from({length:30},(_,i)=>({...base,id:calls*100+i,events}));
   return {ok:true,text:async()=>JSON.stringify({data:rows,pagination:{has_more:false}})};
  }
 });
 const value=await api.get('eredivisie');
 assert.equal(value.sourceDetails.eventParserRevision,Sportmonks.EVENT_PARSER_REVISION);
 assert.equal(value.fixtures.length,120);
 assert.equal(value.fixtures[0].goalTimeline.length,4);
 assert.equal(calls,4);
});

test('registered dismissals and missed penalties are distinct and retain stoppage time',()=>{
 const direct={type_id:20,minute:90,extra_minute:9,participant_id:102,player_name:'Hans Hateboer'};
 const second={type_id:21,minute:88,participant_id:102,player_name:'Etienne Vaessen'};
 const penalty={type_id:17,minute:59,participant_id:101,player_name:'Mexx Meerdink'};
 const conflicting={...second,player_name:'Onbevestigde Speler',team_id:101};
 const fixture=Sportmonks.parseFixture({...base,events:[...events,direct,second,penalty,direct,conflicting]},'eredivisie',now);
 assert.deepEqual(fixture.incidents.map(x=>x.kind),['missed_penalty','second_yellow','red_card']);
 const record=Matches.candidate(fixture,now);
 assert.match(record.verifiedFacts.join(' '),/Hans Hateboer een directe rode kaart in minuut 90\+9/);
 assert.match(record.verifiedFacts.join(' '),/Etienne Vaessen een tweede gele kaart in minuut 88/);
 assert.match(record.verifiedFacts.join(' '),/miste Mexx Meerdink een strafschop/);
 assert.doesNotMatch(record.verifiedFacts.join(' '),/Onbevestigde Speler/);
});
