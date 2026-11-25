'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {candidate,matchesRegistration}=require('../editorial-match55');
const {attach,evidence}=require('../editorial-match-evidence122');
const {CREDIT}=require('../football-results52');
const now=Date.parse('2026-11-25T12:00:00Z');
const fixture={id:'fd-cl-42',competition:'championsleague',status:'FT',date:'2026-11-24T20:00:00Z',round:'Competitiefase',home:{name:'Arsenal FC'},away:{name:'Borussia Dortmund'},goals:{home:1,away:1},halfTime:{home:1,away:0},resultSource:CREDIT,resultExpiresAt:now+3600000};
const record=candidate(fixture,now);
const official={url:'https://www.uefa.com/uefachampionsleague/news/02ab-1234-5678-1000--arsenal-dortmund-match-report/',title:'Arsenal and Borussia Dortmund share points',publishedAt:'2026-11-24T22:30:00Z',text:'The following is a synthetic match receipt for testing the score and complete timeline verification. Arsenal FC - Borussia Dortmund 1-1 (1-0) 25. Player One 1-0 70. Player Two 1-1.'};
test('124B exact European match receipt provides two checked goals and revalidates at registration',()=>{
 const rich=attach(record,official,now);
 assert.ok(rich);
 assert.equal(rich.articleKind,'match_report');
 assert.equal(rich.verifiedFacts.length,5);
 assert.equal(rich.sources[1].url,official.url);
 assert.equal(matchesRegistration(rich,[fixture],now),true);
 assert.equal(matchesRegistration({...rich,verifiedFacts:[...rich.verifiedFacts,'Unverified statistic.']},[fixture],now),false);
});
test('124B rejects unrelated or unsafe sources, competition mismatch and invalid scores',()=>{
 for(const doc of [
  {...official,url:official.url.replace('uefachampionsleague','uefaeuropaleague')},
  {...official,url:official.url.replace('www.uefa.com','uefa.com.example.org')},
  {...official,title:'Champions League round-up: Arsenal and Borussia Dortmund'},
  {...official,title:'Arsenal and Borussia Dortmund Women'},
  {...official,title:'Arsenal and Liverpool'},
  {...official,text:official.text.replace('25. Player One','65. Player One')},
  {...official,text:official.text.replace('70. Player Two 1-1','70. Player Two 2-0')},
  {...official,publishedAt:'2026-10-24T22:30:00Z'},
 ])assert.equal(evidence(record,doc,now),null);
});
