'use strict';

// A result is not a news article. Both official authorities must independently
// identify the same completed men's fixture and score before it is eligible for
// any editorial evidence plan.
const norm=s=>String(s||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
const canonical=s=>({'netherlands':'nederland','germany':'duitsland','greece':'griekenland','serbia':'servie'}[norm(s)]||norm(s));
const score=s=>/^\d{1,2}-\d{1,2}$/.test(String(s||''))?s:null;
const official=(record,authority)=>record&&record.authority===authority&&
 /^https:\/\/www\.(?:onsoranje\.nl|uefa\.com)\//.test(record.url||'')&&
 (authority==='knvb'?new URL(record.url).hostname==='www.onsoranje.nl':
  new URL(record.url).hostname==='www.uefa.com');
function valid(record,authority,now,maxAgeHours){
 if(!official(record,authority)||record.gender!=='men'||record.ageGroup!=='senior'||
    record.competition!=='UEFA Nations League'||record.status!=='FT'||
    !record.homeTeam||!record.awayTeam||!score(record.score)||!record.kickoff||
    !/^\d{4}-\d\d-\d\dT/.test(record.kickoff))return false;
 const kickoff=Date.parse(record.kickoff);
 return Number.isFinite(kickoff)&&kickoff<=now&&now-kickoff<=maxAgeHours*3600000&&
  canonical(record.homeTeam)!==canonical(record.awayTeam);
}
function verifiedResult(knvb,uefa,{now=Date.now(),maxAgeHours=72}={}){
 if(!valid(knvb,'knvb',now,maxAgeHours)||!valid(uefa,'uefa',now,maxAgeHours))
  return {status:'unverified_official_result'};
 if(canonical(knvb.homeTeam)!==canonical(uefa.homeTeam)||
    canonical(knvb.awayTeam)!==canonical(uefa.awayTeam)||
    knvb.score!==uefa.score||
    Date.parse(knvb.kickoff)!==Date.parse(uefa.kickoff)||
    (knvb.uefaMatchId&&uefa.uefaMatchId&&knvb.uefaMatchId!==uefa.uefaMatchId))
  return {status:'conflicting_official_result'};
 const eventId=uefa.uefaMatchId;
 if(!/^\d{6,12}$/.test(String(eventId||'')))
  return {status:'missing_stable_uefa_match_id'};
 const facts=[],seen=new Set();
 // A claim is admitted only if it is present verbatim in the corresponding
 // official record. Never generate a fact by guessing match events or standings.
 for(const record of [knvb,uefa]){
  for(const fact of record.facts||[]){
   if(typeof fact?.text!=='string'||typeof fact?.quote!=='string'||
      fact.text.length<25||fact.quote.length<25||
      !norm(record.sourceText).includes(norm(fact.quote))||
      !norm(fact.quote).includes(norm(fact.text)))continue;
   const key=norm(fact.text);
   if(seen.has(key))continue;
   seen.add(key);
   facts.push({text:fact.text,evidence:[{source:record===knvb?0:1,quote:fact.quote}]});
  }
 }
 if(facts.length<4)return {status:'insufficient_distinct_verified_match_facts',count:facts.length};
 return {status:'verified',matchId:'uefa-'+eventId,homeTeam:knvb.homeTeam,
  awayTeam:knvb.awayTeam,score:knvb.score,kickoff:knvb.kickoff,
  sources:[{url:knvb.url,authority:'knvb'},{url:uefa.url,authority:'uefa'}],
  facts:facts.slice(0,10)};
}
module.exports={verifiedResult};
