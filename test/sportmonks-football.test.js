'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const SM=require('../sportmonks-football'),Football=require('../football-data47');
const now=Date.parse('2026-11-09T12:00:00Z');
function match(id,state=5){
 return {id,league_id:72,state_id:state,starting_at_timestamp:Math.floor(Date.parse('2026-11-01T12:00:00Z')/1000),
 participants:[{id:1,name:'Ajax',meta:{location:'home'}},{id:2,name:'FC Twente',meta:{location:'away'}}],
 scores:[{description:'CURRENT',score:{participant:'home',goals:2}},{description:'CURRENT',score:{participant:'away',goals:2}}],
 round:{name:'Speelronde 11'}};
}
test('Sportmonks parser verifies home/away and final scores; in-play never counts as final',()=>{
 const f=SM.parseFixture(match(1),'eredivisie',now);
 assert.equal(f.status,'FT');assert.deepEqual(f.goals,{home:2,away:2});
 assert.equal(SM.LEAGUES.eredivisie,72);assert.equal(SM.parseFixture({...match(5),round:{name:'12'}},'eredivisie',now).round,'Speelronde 12');
 assert.equal(SM.parseFixture(match(2,2),'eredivisie',now).status,'AWAITING');
 assert.equal(SM.parseFixture({...match(3),scores:[]},'eredivisie',now).status,'AWAITING');
 assert.throws(()=>SM.parseFixture({...match(4),league_id:271},'eredivisie',now));
});
test('Sportmonks takes priority and does not call public fallbacks when season response is complete',async()=>{
 let calls=0;const rows=Array.from({length:120},(_,i)=>match(i+1));
 const fetcher=async(url)=>{calls++;assert.match(url,/api.sportmonks.com/);return {ok:true,text:async()=>JSON.stringify({data:rows.slice(0,50),pagination:{has_more:false}})};};
 // A healthy full season mock uses 4 bounded date windows with 30 unique fixtures each.
 let calls2=0;
 const full=async url=>{
  calls2++;assert.match(url,/api.sportmonks.com/);
  const chunk=Number(url.match(/between\/(\d{4}-\d\d-\d\d)/)?.[1].slice(5,7)||'7');
  const base=calls2*30;
  return {ok:true,text:async()=>JSON.stringify({data:Array.from({length:30},(_,i)=>match(base+i)),pagination:{has_more:false}})};
 };
 const s=Football.create({clock:()=>now,sportmonksToken:'mock-token',fetcher:full});
 const snap=await s.get('eredivisie');
 assert.equal(snap.source,SM.CREDIT);assert.equal(snap.fixtures.length,120);assert.equal(calls2,4);
 assert.equal(calls,0);
});
test('Sportmonks errors fail over to existing Eredivisie source without exposing token in logs',async()=>{
 let calls=[];const s=Football.create({clock:()=>now,sportmonksToken:'mock-secret',fetcher:async url=>{calls.push(url);throw Error('offline');}});
 const snap=await s.get('eredivisie');
 assert.equal(snap.status,'source_unavailable');assert.equal(calls.length,2);
 assert.match(calls[0],/api.sportmonks.com/);assert.match(calls[1],/raw.githubusercontent.com/);
});

test('statistics probe distinguishes available data from an unavailable include without exposing tokens',async()=>{
 const fixtureId='sm-19714594';
 const check=fetcher=>SM.statisticsCoverage({fixtureId,token:'private',fetcher,sourceBody:async response=>JSON.stringify(response.payload)});
 const result=await check(async url=>{
  assert.equal(new URL(url).searchParams.get('include'),'statistics');
  return {ok:true,payload:{data:{id:19714594,league_id:72,statistics:[
   {fixture_id:19714594,type_id:42,participant_id:1,data:{value:0}},
   {fixture_id:19714594,type_id:42,participant_id:2,data:{value:4}},
   {fixture_id:1,type_id:42,participant_id:1,data:{value:5}}
  ]}}};
 });
 assert.deepEqual(result,{status:'available',fixtureId,records:2,types:1});
 assert.deepEqual(await check(async()=>({ok:false,status:403})),{status:'provider_error',httpStatus:403});
});

test('KKD uses Sportmonks league 74 and never mixes Eredivisie fixtures',async()=>{
 assert.equal(SM.LEAGUES.kkd,74);
 assert.throws(()=>SM.parseFixture(match(99),'kkd',now),/Ongeldig/);
 const kkdRow=id=>({...match(id),league_id:74});
 let calls=0;
 const service=Football.create({clock:()=>now,sportmonksToken:'mock-private-token',
  fetcher:async url=>{
   calls++;
   const request=new URL(url);
   assert.equal(request.hostname,'api.sportmonks.com');
   assert.equal(request.searchParams.get('filters'),'fixtureLeagues:74');
   return {ok:true,text:async()=>JSON.stringify({
    data:Array.from({length:30},(_,i)=>kkdRow(calls*100+i)),
    pagination:{has_more:false}
   })};
  }
 });
 const snapshot=await service.get('kkd');
 assert.equal(snapshot.source,SM.CREDIT);
 assert.equal(snapshot.fixtures.length,120);
 assert.ok(snapshot.fixtures.every(f=>f.competition==='kkd'));
 assert.equal(snapshot.status,'available');
 assert.equal(calls,4);
});

test('Premier League and KNVB Beker use their distinct selected Sportmonks IDs',async()=>{
 assert.equal(SM.LEAGUES.premierleague,8);
 assert.equal(SM.LEAGUES.knvbbeker,78);
 for(const [key,id] of [['premierleague',8],['knvbbeker',78]]){
  const row={...match(701),league_id:id};
  assert.equal(SM.parseFixture(row,key,now).competition,key);
  assert.throws(()=>SM.parseFixture(row,key==='premierleague'?'knvbbeker':'premierleague',now));
  let calls=0;
  const service=Football.create({clock:()=>now,sportmonksToken:'mock-secret',
   fetcher:async url=>{
    calls++;
    assert.equal(new URL(url).searchParams.get('filters'),'fixtureLeagues:'+id);
    return {ok:true,text:async()=>JSON.stringify({data:Array.from({length:30},(_,i)=>({...row,id:calls*100+i})),pagination:{has_more:false}})};
   }
  });
  const snap=await service.get(key);
  assert.equal(snap.source,SM.CREDIT);
  assert.equal(snap.fixtures.length,120);
  assert.ok(snap.fixtures.every(f=>f.competition===key));
  assert.equal(calls,4);
  if(key==='knvbbeker')assert.deepEqual(snap.standings,[]);
 }
});
test('Playoffs require one unambiguous Sportmonks league catalogue match',async()=>{
 const good={id:123456,name:'Eredivisie Play-offs',sub_type:'play-offs'};
 let catalogueCalls=0, fixtureCalls=0;
 const sourceBody=async response=>response.text();
 const fetcher=async url=>{
  const u=new URL(url);
  if(u.pathname.includes('/leagues/search/')){
   catalogueCalls++;
   return {ok:true,text:async()=>JSON.stringify({data:[good]})};
  }
  assert.equal(u.searchParams.get('filters'),'fixtureLeagues:'+good.id);
  fixtureCalls++;
  return {ok:true,text:async()=>JSON.stringify({data:[{...match(720+fixtureCalls*2),league_id:good.id},{...match(721+fixtureCalls*2),league_id:good.id}],pagination:{has_more:false}})};
 };
 const fixtures=await SM.load({fetcher,token:'mock-secret',now,sourceBody,competition:'eredivisieplayoffs'});
 assert.equal(catalogueCalls,1);
 assert.equal(fixtures.length,8);
 assert.equal(fixtures[0].competition,'eredivisieplayoffs');
 await assert.rejects(()=>SM.load({fetcher:async url=>({ok:true,text:async()=>JSON.stringify({data:[good,{...good,id:123457}]})}),token:'mock',now,sourceBody,competition:'eredivisieplayoffs'}),/niet eenduidig/);
});


test('98S recent-only Sportmonks feed accepts a verified small match window without claiming a complete season',async()=>{
 const now=Date.parse('2026-11-16T20:00:00Z');
 const recent={...match(98765),starting_at_timestamp:Math.floor((now-3*3600000)/1000)};
 const upcoming={...match(98766),state_id:1,starting_at_timestamp:Math.floor((now+3600000)/1000)};
 const old={...match(98767),starting_at_timestamp:Math.floor((now-6*86400000)/1000)};
 const invalidScore={...match(98768),starting_at_timestamp:Math.floor((now-2*3600000)/1000),scores:[]};
 let requested=0;
 const fixtures=await SM.loadRecent({token:'hidden-token',now,sourceBody:async response=>response.text(),fetcher:async(url)=>{
  requested++;
  const u=new URL(url);
  assert.equal(u.hostname,'api.sportmonks.com');
  assert.equal(u.searchParams.get('filters'),'fixtureLeagues:72');
  assert.equal(u.searchParams.get('include'),'participants;scores;round;events;statistics;venue');
  assert.equal(u.searchParams.get('page'),'1');
  return new Response(JSON.stringify({data:[recent,upcoming,old,invalidScore],pagination:{has_more:false}}));
 }});
 assert.equal(requested,1);
 assert.deepEqual(fixtures.map(f=>f.id),['sm-98765']);
 assert.equal(fixtures[0].status,'FT');
 assert.deepEqual(fixtures[0].goals,{home:2,away:2});
 assert.equal(fixtures[0].resultSource,SM.CREDIT);
});
test('98S recent-only window rejects foreign leagues and incomplete pagination',async()=>{
 const now=Date.parse('2026-11-16T20:00:00Z');
 const data={...match(98770),starting_at_timestamp:Math.floor((now-3600000)/1000)};
 await assert.rejects(SM.loadRecent({token:'hidden',now,sourceBody:async r=>r.text(),fetcher:async()=>new Response(JSON.stringify({
  data:[{...data,league_id:74}],pagination:{has_more:false}
 }))}),/verkeerde competitie/);
 let calls=0;
 await assert.rejects(SM.loadRecent({token:'hidden',now,sourceBody:async r=>r.text(),fetcher:async()=>{calls++;return new Response(JSON.stringify({
  data:[{...data,id:98770+calls}],pagination:{has_more:true}
 }));}}),/paginering onvolledig/);
 assert.equal(calls,3);
 await assert.rejects(SM.loadRecent({token:'',now,sourceBody:async r=>r.text()}),/niet geconfigureerd/);
});

test('109C stadium coordinates need matching venue_id and valid Sportmonks venue fields',()=>{
 const stadium={id:1001,name:'De Grolsch Veste',latitude:'52.237000',longitude:'6.837000'};
 const source={...match(1789),venue_id:1001,venue:stadium};
 const fixture=SM.parseFixture(source,'eredivisie',now);
 assert.deepEqual(fixture.venue,{id:1001,name:'De Grolsch Veste',latitude:52.237,longitude:6.837});
 assert.equal(fixture.venueName,'De Grolsch Veste');
 assert.equal(fixture.venueId,1001);
 for(const variant of [
  {...source,venue_id:1002},
  {...source,venue:{...stadium,latitude:'wrong'}},
  {...source,venue:{...stadium,latitude:'-91.0'}},
  {...source,venue:{...stadium,longitude:'181'}},
  {...source,venue:{...stadium,name:'x'}},
  {...source,venue:{...stadium,latitude:'0',longitude:'0'}},
  {...source,venue:null}
 ]){
  const invalid=SM.parseFixture(variant,'eredivisie',now);
  assert.equal(invalid.venue,undefined);
  assert.equal(invalid.venueId,undefined);
  assert.equal(invalid.venueName,undefined);
 }
});
