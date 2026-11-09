'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const SM=require('../sportmonks-football');
const Matches=require('../editorial-match55');
const Desk=require('../editorial-desk-model');
const now=Date.parse('2026-11-09T12:00:00Z');
function result(){
 return {id:18801234,league_id:72,state_id:5,
  starting_at_timestamp:Math.floor(Date.parse('2026-11-08T13:30:00Z')/1000),
  round:{name:'12'},
  participants:[{id:629,name:'Ajax',meta:{location:'home'}},{id:593,name:'FC Twente',meta:{location:'away'}}],
  scores:[{description:'CURRENT',score:{participant:'home',goals:2}},{description:'CURRENT',score:{participant:'away',goals:2}},
   {description:'1ST_HALF',score:{participant:'home',goals:1}},{description:'1ST_HALF',score:{participant:'away',goals:1}}],
  events:[
   {type_id:14,sort_order:1,minute:12,extra_minute:null,player_name:'Jan Jansen',team_id:629,result:'1-0'},
   {type_id:14,sort_order:2,minute:30,extra_minute:null,player_name:'Piet Peters',team_id:593,result:'1-1'},
   {type_id:14,sort_order:3,minute:60,extra_minute:null,player_name:'Dirk Visser',team_id:629,result:'2-1'},
   {type_id:16,sort_order:4,minute:89,extra_minute:null,player_name:'Bart de Vries',team_id:593,result:'2-2'}
  ]};
}
test('Sportmonks Eredivisie, not Danish Superliga, provides stable final and verified goal progression',()=>{
 const r=result(),fixture=SM.parseFixture(r,'eredivisie',now);
 assert.equal(fixture.id,'sm-18801234');assert.equal(fixture.round,'Speelronde 12');
 assert.equal(fixture.status,'FT');assert.equal(fixture.goalTimeline.length,4);
 assert.equal(fixture.goalTimeline[3].kind,'penalty');
 const record=Matches.candidate(fixture,now);
 assert.ok(record);assert.equal(record.articleKind,'match_report');
 assert.equal(record.sources[0].url,Matches.SM);
 assert.equal(record.verifiedFacts.length,7);
 assert.equal(Matches.matchesRegistration(record,[fixture],now),true);
 assert.equal(Matches.matchesRegistration({...record,verifiedFacts:[...record.verifiedFacts,'Ajax wint 3-2.']},[fixture],now),false);
 assert.throws(()=>SM.parseFixture({...r,league_id:271},'eredivisie',now));
});
test('Incomplete, duplicated or impossible goal events cannot produce longform facts',()=>{
 const r=result();
 assert.equal(SM.confirmedGoals({...r,events:r.events.slice(0,3)},{home:2,away:2}).length,0);
 assert.equal(SM.confirmedGoals({...r,events:[r.events[0],r.events[0],...r.events.slice(2)]},{home:2,away:2}).length,0);
 assert.equal(SM.confirmedGoals({...r,events:r.events.map((e,i)=>i===2?{...e,team_id:593}:e)},{home:2,away:2}).length,0);
 assert.equal(SM.confirmedGoals({...r,events:[...r.events,{type_id:14,sort_order:5,minute:90,team_id:593,player_name:'Naam Naam',result:'2-3'}]},{home:2,away:2}).length,0);
 assert.equal(SM.parseFixture({...r,state_id:22},'eredivisie',now).status,'AWAITING');
});
test('Registered match source does not demand an unrelated third-party scoreboard; official evidence must be concrete',()=>{
 const fixture=SM.parseFixture(result(),'eredivisie',now);
 const record=Matches.candidate(fixture,now);
 const payload={...record,draft:{headline:'Ajax en FC Twente spelen gelijk',standfirst:'Ajax en FC Twente eindigden in een gelijkspel.',
  body:['De wedstrijden tussen Ajax en FC Twente leverden vier gecontroleerde treffers op.','Sportmonks vermeldt de doelpunten en het volledige scoreverloop.','De wedstrijd eindigde met een gelijke stand.']},
  editorialChecks:Object.fromEntries(Desk.checks.map(k=>[k,true]))};
 const issues=Desk.publicationIssues(payload);
 assert.ok(!issues.some(x=>/Flashscore|twee geldige HTTPS-bronnen/.test(x)),issues.join(' | '));
 const spoof={...payload,matchId:'sm-fake',sources:[{url:'https://example.org/no-verified-source'}]};
 assert.ok(Desk.publicationIssues(spoof).some(x=>/Flashscore|twee geldige HTTPS-bronnen/.test(x)));
});
