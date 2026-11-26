'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const N=require('../scripts/ten-agent-newsroom101');
const now=Date.parse('2026-11-26T18:00:00Z');
const group={id:'dossier',agents:['ajax'],outlets:['vi'],sources:[{url:'https://www.vi.nl/nieuws/test',title:'Ajax nieuws',publishedAt:new Date(now-2*3600000).toISOString()}]};
const attempt=(status,minutes)=>({groupKey:group.id,status,at:new Date(now-minutes*60000).toISOString()});
test('130 new research due, successfully analyzed dossier never retried',()=>{
 assert.equal(N.researchDecision130(group,[],now).reason,'new_dossier');
 assert.equal(N.researchDecision130(group,[attempt('analysis_only_unverified',90)],now).due,false);
 assert.equal(N.researchDecision130(group,[attempt('provider_http_401',90)],now).due,false);
 assert.equal(N.researchDecision130(group,[attempt('legacy_unknown',90)],now).due,false);
});
test('130 recover rate limiting and transient failures with increasing backoff and hard limit',()=>{
 assert.equal(N.researchDecision130(group,[attempt('provider_http_429',29)],now).due,false);
 assert.equal(N.researchDecision130(group,[attempt('provider_http_429',30)],now).reason,'bounded_recovery');
 assert.equal(N.researchDecision130(group,[attempt('provider_unavailable',100),attempt('provider_http_503',59)],now).due,false);
 assert.equal(N.researchDecision130(group,[attempt('provider_unavailable',100),attempt('provider_http_503',60)],now).due,true);
 assert.equal(N.researchDecision130(group,[attempt('invalid_ai_json',180),attempt('provider_http_500',120),attempt('provider_unavailable',60)],now).reason,'retry_limit');
});
test('130 invalid timestamps fail closed and other dossier failures are not inherited',()=>{
 assert.equal(N.researchDecision130(group,[attempt('provider_http_429',-1)],now).reason,'invalid_retry_history');
 assert.equal(N.researchDecision130(group,[{groupKey:'another',status:'provider_unavailable'}],now).due,true);
});
test('130 eligible failed dossier reenters candidate list without fresh duplicate signal',()=>{
 assert.deepEqual(N.researchCandidates([group],[],[attempt('provider_http_503',31)],now),[group]);
 const old={...group,sources:[{...group.sources[0],publishedAt:new Date(now-13*3600000).toISOString()}]};
 assert.deepEqual(N.researchCandidates([old],[],[attempt('provider_http_503',31)],now),[]);
});
test('130 rate limited scout stops remaining requests in same round and stays within daily budget',async()=>{
 let calls=0;
 const xml='<rss version="2.0"><channel>'+['Ajax','PSV'].map((club,i)=>'<item><title>'+club+' kondigt wijziging selectie aan</title><link>https://www.vi.nl/nieuws/test-'+i+'</link><pubDate>'+new Date(now-60000).toUTCString()+'</pubDate><description>'+('Een relevante inhoudelijke passage over een gemelde wijziging waarvoor onafhankelijke bevestiging nodig is. ').repeat(2)+'</description></item>').join('')+'</channel></rss>';
 const result=await N.scan({now,apiKey:'test',fetcher:async url=>{
  if(url.includes('api.groq.com')){calls++;return new Response(null,{status:429});}
  return new Response(url.includes('vi.nl')?xml:'<rss version="2.0"><channel></channel></rss>');
 }});
 assert.equal(calls,1);
 assert.equal(result.report.aiCalls,1);
 assert.equal(result.report.autonomousRecovery.providerPaused,true);
 assert.equal(result.report.autonomousRecovery.additionalDailyAllowance,0);
 assert.equal(result.report.published,0);
});
