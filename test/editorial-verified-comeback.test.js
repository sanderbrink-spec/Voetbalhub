'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {candidate,verifiedComebackFact}=require('../editorial-match55');
const guide=require('../editorial-match-guidance133');
const now=Date.parse('2026-11-09T15:00:00Z');
const timeline=[
 {minute:2,extra:0,home:0,away:1,player:'Jacob Ondrejka',kind:'goal'},
 {minute:9,extra:0,home:1,away:1,player:'Mexx Meerdink',kind:'goal'},
 {minute:47,extra:0,home:1,away:2,player:'Brynjólfur Willumsson',kind:'goal'},
 {minute:54,extra:0,home:1,away:3,player:'Thom van Bergen',kind:'goal'},
 {minute:61,extra:0,home:2,away:3,player:'Ayoub Oufkir',kind:'goal'},
 {minute:76,extra:0,home:3,away:3,player:'Mateo Chávez',kind:'goal'},
 {minute:90,extra:1,home:4,away:3,player:'Mexx Meerdink',kind:'penalty'}
];
function fixture(goalTimeline=timeline){return {
 id:'sm-19714593',competition:'eredivisie',resultSource:'Sportmonks Football API',
 resultExpiresAt:now+3600000,status:'FT',date:'2026-11-08T15:45:00Z',
 home:{name:'AZ Alkmaar'},away:{name:'FC Groningen'},goals:{home:4,away:3},
 halfTime:{home:1,away:1},round:'Speelronde 12',goalTimeline
};}
test('exact complete 4-3 timeline proves the two-goal comeback as derived, transparently attributed evidence',()=>{
 const record=candidate(fixture(),now);
 assert.equal(record.articleKind,'match_report');
 const fact=record.verifiedFacts.find(x=>/achterstand/.test(x));
 assert.ok(fact);
 assert.match(fact,/1-3-achterstand in minuut 54/);
 assert.match(fact,/AZ Alkmaar omgebogen naar een 4-3-zege/);
 const plan=guide.paragraphPlan(record);
 assert.equal(plan.format,'rich');
 assert.ok(plan.body[0].factIds.some(id=>record.verifiedFacts[Number(id.slice(1))-1]===fact));
 assert.equal(plan.events,7);
 assert.match(guide.writingPrompt(record),/Gebruik NOOIT een berekend tijdsverschil/);
 assert.match(guide.revisionPrompt(record),/Sportmonks-wedstrijdregistratie/);
});
test('no comeback context when chronology is tampered, incomplete, or victory did not follow a two-goal deficit',()=>{
 const match={homeTeam:'AZ Alkmaar',awayTeam:'FC Groningen'};
 assert.equal(verifiedComebackFact(timeline.slice(0,6),match,4,3),null);
 assert.equal(verifiedComebackFact(timeline.map((e,i)=>i===4?{...e,home:3}:e),match,4,3),null);
 assert.equal(verifiedComebackFact([...timeline].reverse(),match,4,3),null);
 const noTwoGoalDeficit=[
  {minute:1,home:0,away:1},{minute:10,home:1,away:1},
  {minute:20,home:2,away:1},{minute:30,home:2,away:2},
  {minute:40,home:3,away:2}
 ];
 assert.equal(verifiedComebackFact(noTwoGoalDeficit,match,3,2),null);
});
test('late penalty keeps source minute rather than fabricating interval between goals',()=>{
 const fact=verifiedComebackFact(timeline,{homeTeam:'AZ Alkmaar',awayTeam:'FC Groningen'},4,3);
 assert.match(fact,/minuut 54/);
 assert.doesNotMatch(fact,/minuten later|daarna/i);
});
