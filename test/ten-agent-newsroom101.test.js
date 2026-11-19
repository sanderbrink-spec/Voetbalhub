'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const N=require('../scripts/ten-agent-newsroom101');
const now=Date.parse('2026-11-19T18:30:00Z');
const rss=(title,url,date='Thu, 19 Nov 2026 18:00:00 GMT')=>
 '<rss version="2.0"><channel><item><title><![CDATA['+title+']]></title>'+
 '<link>'+url+'</link><pubDate>'+date+'</pubDate><description>Only a lead, not evidence.</description></item></channel></rss>';

test('101 exactly ten specialized agents cover every scan and include rumor verification',()=>{
 assert.equal(N.AGENTS.length,10);
 assert.equal(new Set(N.AGENTS.map(a=>a.id)).size,10);
 assert.ok(N.AGENTS.some(a=>a.id==='geruchten'));
 assert.ok(N.AGENTS.some(a=>a.id==='transfers'));
 assert.ok(N.AGENTS.some(a=>a.id==='groningen'));
});
test('101 RSS intake takes headline, publisher and URL only, never copied article text',()=>{
 const feed=N.FEEDS.find(x=>x.id==='vi');
 const input=rss('PSV onderzoekt mogelijke transfer van De Bruyne',
  'https://www.vi.nl/nieuws/psv-de-bruyne?tracking=abc');
 const leads=N.parseFeed(input,feed,now);
 assert.equal(leads.length,1);
 assert.equal(leads[0].url,'https://www.vi.nl/nieuws/psv-de-bruyne');
 assert.ok(!JSON.stringify(leads).includes('Only a lead'));
 assert.ok(!leads[0].verified);
 assert.equal(N.parseFeed(rss('PSV gelooft in een versterking','https://attacker.example/nieuws/psv'),feed,now).length,0);
 assert.equal(N.parseFeed(rss('PSV bevestigt volgend seizoen','https://www.vi.nl/nieuws/old','Sun, 15 Nov 2026 11:00:00 GMT'),feed,now).length,0);
});
test('101 multiple outlets about De Bruyne / PSV signal a rumor, never confirmed transfer',()=>{
 const leads=[
  {id:'a',url:'https://www.vi.nl/nieuws/a',title:'PSV onderzoekt transfer van Kevin De Bruyne',publisher:'vi',publishedAt:new Date(now).toISOString()},
  {id:'b',url:'https://www.voetbalprimeur.nl/nieuws/b',title:'De Bruyne mogelijk in gesprek met PSV',publisher:'vp',publishedAt:new Date(now).toISOString()},
  {id:'c',url:'https://nos.nl/artikel/123',title:'PSV ontkent bericht over De Bruyne',publisher:'nos',publishedAt:new Date(now).toISOString()}
 ];
 const output=N.classifyLeads(leads);
 const group=output.groups.find(x=>x.outlets.length>=2);
 assert.ok(group);
 assert.equal(group.rumour,true);
 assert.equal(group.contradictory,true);
 assert.equal(group.transferConfirmed,false);
 assert.equal(group.originalReporterIndependenceVerified,false);
 assert.equal(group.publicationAllowed,false);
 assert.equal(group.status,'gerucht_niet_bevestigd');
 assert.ok(group.agents.includes('geruchten'));
});
test('101 negative reports do not constitute proof of a transfer or two independent reporters',()=>{
 const x=N.classifyLeads([
  {id:'one',title:'PSV informeert naar Kevin De Bruyne',publisher:'vi',url:'https://www.vi.nl/nieuws/1'},
  {id:'two',title:'PSV informeert naar Kevin De Bruyne',publisher:'vp',url:'https://www.voetbalprimeur.nl/nieuws/2'}
 ]);
 const group=x.groups.find(g=>g.outlets.length===2);
 assert.ok(group);
 assert.equal(group.publicationAllowed,false);
 assert.equal(group.originalReporterIndependenceVerified,false);
});
test('101 scanner continues on feed outage, persists dedup and scans all ten beats',async()=>{
 const f=async url=>{
  if(url.includes('vi.nl'))return new Response(rss('PSV onderzoekt transfer van Kevin De Bruyne','https://www.vi.nl/nieuws/de-bruyne'),{status:200});
  if(url.includes('voetbalprimeur.nl'))return new Response(rss('De Bruyne mogelijk in gesprek met PSV','https://www.voetbalprimeur.nl/nieuws/de-bruyne'),{status:200});
  return new Response('unavailable',{status:429});
 };
 const one=await N.scan({fetcher:f,now,runAI:false});
 assert.equal(one.report.feedsOk,2);
 assert.equal(one.report.feedErrors.length,1);
 assert.equal(one.report.newSignals,2);
 assert.equal(one.report.rumourGroups,1);
 assert.equal(one.report.aiCalls,0);
 assert.equal(one.report.agents.length,10);
 const two=await N.scan({fetcher:f,now:now+1800000,state:one.state,runAI:false});
 assert.equal(two.report.newSignals,0);
 assert.equal(two.report.groups,1);
 assert.equal(two.report.publicationAttempts,0);
 assert.equal(two.report.published,0);
});
test('101 every scout respects daily AI cap and no model key means zero paid requests',async()=>{
 assert.equal(N.dailyBudget({day:'2026-11-19',aiCallsToday:10},now),0);
 assert.equal(N.dailyBudget({day:'2026-11-18',aiCallsToday:100},now),10);
 let requests=0;
 const f=async url=>{
  requests++;
  return new Response(rss('PSV onderzoekt transfer van Kevin De Bruyne',
   url.includes('vi.nl')?'https://www.vi.nl/nieuws/a':
   url.includes('voetbalprimeur.nl')?'https://www.voetbalprimeur.nl/nieuws/b':'https://nos.nl/artikel/123'),
   {status:200});
 };
 const done=await N.scan({fetcher:f,now,apiKey:'',state:{day:'2026-11-19',aiCallsToday:10}});
 assert.equal(done.report.aiCalls,0);
 assert.equal(requests,3);
 assert.equal(done.report.aiCallsToday,10);
});
test('101 AI notes remain unpublished internal research, not verified claims',async()=>{
 const group={outlets:['vi','vp'],sources:[
  {title:'PSV informeert naar Kevin De Bruyne',url:'https://www.vi.nl/nieuws/a',publisher:'vi'},
  {title:'De Bruyne in beeld bij PSV',url:'https://www.voetbalprimeur.nl/nieuws/b',publisher:'vp'}
 ],contradictory:false};
 const agent=N.AGENTS.find(a=>a.id==='geruchten');
 const response=await N.analyzeWithAI({group,agent,apiKey:'test',fetcher:async(_url,opts)=>{
  const messages=JSON.parse(opts.body).messages;
  assert.ok(messages[0].content.includes('INTERNE onderzoeksnotitie'));
  assert.ok(messages[0].content.includes('ONBEVESTIGD'));
  return Response.json({choices:[{message:{content:JSON.stringify({
   angle:'PSV legt definitief De Bruyne vast',questions:['Is een akkoord officieel bevestigd?'],
   caution:'Niet bevestigd'
  })}}]});
 }});
 assert.equal(response.verified,false);
 assert.equal(response.publicationAllowed,false);
 assert.equal(response.status,'analysis_only_unverified');
});
