'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Sportmonks=require('../sportmonks-football');
const now=Date.parse('2026-11-12T14:00:00Z');
const base=(status=5)=>({
 id:19714597,league_id:72,state_id:status,starting_at_timestamp:Math.floor(Date.parse('2026-11-11T16:00:00Z')/1000),
 participants:[{id:101,name:'FC Groningen',meta:{location:'home'}},{id:102,name:'FC Twente',meta:{location:'away'}}],
 scores:[{description:'CURRENT',score:{participant:'home',goals:1}},{description:'CURRENT',score:{participant:'away',goals:0}}],
 round:{name:'12'}
});
const goal={id:1,type_id:14,sort_order:1,minute:12,participant_id:101,player_name:'Speler Een',result:'1-0'};
const yellow={id:2,type_id:19,sort_order:2,minute:64,participant_id:102,player_name:'Speler Twee'};
const sub={id:3,type_id:18,sort_order:3,minute:70,participant_id:101,player_name:'Speler Drie',related_player_name:'Speler Vier'};
const red={id:4,type_id:20,sort_order:4,minute:90,extra_minute:3,participant_id:102,player_name:'Speler Vijf'};
test('one-goal final matches show verified scorer, minute, yellow, red and replacement players',()=>{
 const f=Sportmonks.parseFixture({...base(),events:[red,sub,yellow,goal]},'eredivisie',now);
 assert.equal(f.goalTimeline.length,1);
 assert.equal(f.eventCoverage,'sportmonks');
 assert.deepEqual(f.matchEvents.map(e=>e.kind),['goal','yellow_card','substitution','red_card']);
 assert.equal(f.matchEvents[0].player,'Speler Een');
 assert.equal(f.matchEvents[0].score,'1 – 0');
 assert.equal(f.matchEvents[0].side,'home');
 assert.equal(f.matchEvents[1].side,'away');
 assert.equal(f.matchEvents[2].relatedPlayer,'Speler Vier');
 assert.equal(f.matchEvents[3].extra,3);
 assert.equal(f.matchEvents[3].side,'away');
});
test('unsafe, duplicate and contradicted events cannot appear in the match menu',()=>{
 const f=Sportmonks.parseFixture({...base(),events:[
  goal,yellow,yellow,
  {...red,id:10,team_id:101},
  {...sub,id:11,related_player_name:'<iframe>'},
  {...yellow,id:12,rescinded:true},
  {id:13,type_id:99,sort_order:5,minute:82,participant_id:101,player_name:'Speler Zes'}
 ]},'eredivisie',now);
 assert.deepEqual(f.matchEvents.map(e=>e.kind),['goal','yellow_card']);
});
test('unverified goal ownership is never represented as a confirmed scorer',()=>{
 const altered={...goal,participant_id:102};
 const f=Sportmonks.parseFixture({...base(),events:[altered,yellow,sub]},'eredivisie',now);
 assert.deepEqual(f.goalTimeline,[]);
 assert.deepEqual(f.matchEvents.map(x=>x.kind),['yellow_card','substitution']);
});
test('unavailable events and pre-match incidents never create invented details',()=>{
 const without=Sportmonks.parseFixture(base(),'eredivisie',now);
 assert.equal(without.eventCoverage,'unavailable');
 assert.deepEqual(without.matchEvents,[]);
 const future={...base(1),starting_at_timestamp:Math.floor(Date.parse('2026-11-14T15:00:00Z')/1000),events:[goal,yellow]};
 const f=Sportmonks.parseFixture(future,'eredivisie',now);
 assert.equal(f.status,'NS');
 assert.equal(f.matchEvents,undefined);
});
test('own goals retain scoring direction and the responsible players team',()=>{
 const own={...goal,type_id:15,participant_id:102,player_name:'Speler Twee'};
 const f=Sportmonks.parseFixture({...base(),events:[own]},'eredivisie',now);
 assert.equal(f.matchEvents[0].kind,'own_goal');
 assert.equal(f.matchEvents[0].side,'away');
 assert.equal(f.matchEvents[0].score,'1 – 0');
});
