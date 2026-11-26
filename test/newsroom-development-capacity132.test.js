'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const N=require('../scripts/ten-agent-newsroom101');
const now=Date.parse('2026-11-26T18:00:00Z');
function fake({fail=false}={}){
 let calls=0;
 const xml='<rss version="2.0"><channel>'+['Ajax','PSV','Feyenoord','FC Groningen'].map((club,i)=>'<item><title>'+club+' presenteert nieuw clubbesluit</title><link>https://www.vi.nl/nieuws/capacity-'+i+'</link><pubDate>'+new Date(now-60000).toUTCString()+'</pubDate><description>'+('Een relevante inhoudelijke passage over een gemelde wijziging waarvoor onafhankelijke bevestiging nodig is. ').repeat(2)+'</description></item>').join('')+'</channel></rss>';
 return {calls:()=>calls,fetcher:async url=>{
  if(url.includes('api.groq.com')){calls++;if(fail)return new Response(null,{status:429});return Response.json({choices:[{message:{content:JSON.stringify({angle:'Onderzoek de clubmelding',questions:['Welke onafhankelijke bron kan de melding bevestigen?'],caution:'Nog niet onafhankelijk bevestigd.'})}}]});}
  return new Response(url.includes('vi.nl')?xml:'<rss version="2.0"><channel></channel></rss>');
 }};
}
test('132 development defaults uncapped; launch caps configurable; invalid values fail closed',()=>{
 assert.deepEqual(N.productionBudget({}),{daily:Infinity,perScan:Infinity});
 assert.deepEqual(N.productionBudget({VELDIO_SCOUT_DAILY_LIMIT:'80',VELDIO_SCOUT_SCAN_LIMIT:'12'}),{daily:80,perScan:12});
 assert.deepEqual(N.productionBudget({VELDIO_SCOUT_DAILY_LIMIT:'oops',VELDIO_SCOUT_SCAN_LIMIT:'-1'}),{daily:10,perScan:2});
});
test('132 development processes more than two dossiers even after ten daily requests',async()=>{
 const f=fake();
 const r=await N.scan({fetcher:f.fetcher,now,apiKey:'test',state:{day:'2026-11-26',aiCallsToday:10},budget:N.productionBudget({})});
 assert.ok(f.calls()>2);
 assert.equal(r.report.aiCallsToday,10+f.calls());
 assert.equal(r.report.aiDailyLimit,null);
 assert.equal(r.report.aiScanLimit,null);
 assert.equal(r.report.published,0);
 assert.equal(r.state.researchHistory.length,f.calls());
 const second=await N.scan({fetcher:f.fetcher,now:now+60000,apiKey:'test',state:{...r.state,researchNotes:[]},budget:N.productionBudget({})});
 assert.equal(second.report.aiCalls,0);
});
test('132 configured launch limits and execution deadline remain effective',async()=>{
 const f=fake();
 const capped=await N.scan({fetcher:f.fetcher,now,apiKey:'test',budget:N.productionBudget({VELDIO_SCOUT_DAILY_LIMIT:'1'})});
 assert.equal(capped.report.aiCalls,1);
 const stopped=await N.scan({fetcher:f.fetcher,now,apiKey:'test',budget:N.productionBudget({}),deadline:1000,clock:()=>999});
 assert.equal(stopped.report.aiCalls,0);
 assert.equal(stopped.report.executionDeadlineReached,true);
});
test('132 development still stops at real provider rate limits',async()=>{
 const f=fake({fail:true});
 const r=await N.scan({fetcher:f.fetcher,now,apiKey:'test',budget:N.productionBudget({})});
 assert.equal(f.calls(),1);
 assert.equal(r.report.autonomousRecovery.providerPaused,true);
});
