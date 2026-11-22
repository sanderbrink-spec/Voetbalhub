'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const N=require('../scripts/ten-agent-newsroom101');
const now=Date.parse('2026-11-19T18:30:00Z');
const rss=(title,url,date='Thu, 19 Nov 2026 18:00:00 GMT')=>
 '<rss version="2.0"><channel><item><title><![CDATA['+title+']]></title>'+
 '<link>'+url+'</link><pubDate>'+date+'</pubDate><description>Only a lead, not evidence.</description></item></channel></rss>';

test('107A-2 every football RSS headline is assigned without creating an eleventh agent',()=>{
 const unseen='Reis doet oude club HSV met assist pijn in beladen Nordderby';
 const assigned=N.assignAgents(unseen);
 assert.deepEqual(assigned.agentIds,['achtergrond']);
 assert.equal(assigned.fallbackAssigned,true);
 const known=N.assignAgents('FC Groningen en PSV bereiden oefenduel voor');
 assert.ok(known.agentIds.includes('groningen'));
 assert.ok(known.agentIds.includes('psv'));
 assert.equal(known.fallbackAssigned,false);
 const groups=N.classifyLeads([
  {id:'fresh',url:'https://www.vi.nl/nieuws/hsv-reis',title:unseen,publisher:'vi'},
  {id:'known',url:'https://www.vi.nl/nieuws/psv-groningen',title:'PSV speelt tegen FC Groningen',publisher:'vi'}
 ]);
 assert.equal(groups.leads.length,2);
 assert.ok(groups.leads.every(x=>x.agentIds.length));
 assert.equal(groups.leads[0].publicationAllowed,false);
 assert.equal(groups.leads[0].verified,false);
 assert.equal(groups.leads[0].fallbackAssigned,true);
 assert.equal(groups.groups.length,2);
 assert.equal(N.AGENTS.length,10);
});
test('107A-2 residual leads are counted without bypassing the daily AI budget',async()=>{
 const single='<rss version="2.0"><channel><item><title>Reis doet oude club HSV met assist pijn in beladen Nordderby</title>'+
  '<link>https://www.vi.nl/nieuws/hsv-reis</link><pubDate>Thu, 19 Nov 2026 18:00:00 GMT</pubDate></item></channel></rss>';
 const result=await N.scan({fetcher:async url=>new Response(url.includes('vi.nl')?single:'<rss version="2.0"><channel></channel></rss>'),
  now,state:{day:'2026-11-19',aiCallsToday:10},apiKey:'test',runAI:true});
 assert.equal(result.report.generalFallbackSignals,1);
 assert.equal(result.report.newFallbackSignals,1);
 assert.equal(result.report.unassignedSignals,0);
 assert.equal(result.report.aiCalls,0);
 assert.equal(result.report.aiCallsToday,10);
 assert.equal(result.report.publicationAttempts,0);
 assert.equal(result.report.published,0);
});
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
test('102D NOS /l/-shortlinks zijn geldige signalen maar geen willekeurige redirects',()=>{
 const nos=N.FEEDS.find(f=>f.id==='nos');
 assert.equal(N.articleUrl('https://nos.nl/l/2601234?utm_source=rss',nos),'https://nos.nl/l/2601234');
 assert.equal(N.parseFeed(rss('Ajax komt met selectie-update','https://nos.nl/l/2601234'),nos,now).length,1);
 assert.equal(N.articleUrl('https://nos.nl/l/2601234/evil',nos),null);
 assert.equal(N.articleUrl('https://nos.nl/l/2601234@evil.example',nos),null);
 assert.equal(N.articleUrl('https://wrong.example/l/2601234',nos),null);
});
test('102D twee bekende clubnamen zonder gedeeld concreet verhaal worden niet samengevoegd',()=>{
 const a={id:'a',title:'Ajax en Feyenoord betrokken bij rechtszaak over oud contract',publisher:'vi',url:'https://www.vi.nl/nieuws/a'};
 const b={id:'b',title:'Feyenoord en Ajax publiceren opstellingen voor bekerduel',publisher:'vp',url:'https://www.voetbalprimeur.nl/nieuws/b'};
 assert.equal(N.sharedStory(a,b),false);
 assert.equal(N.classifyLeads([a,b]).groups.length,2);
 const c={id:'c',title:'Ajax en Feyenoord treffen elkaar in halve finale KNVB beker',publisher:'vi',url:'https://www.vi.nl/nieuws/c'};
 const d={id:'d',title:'Feyenoord en Ajax bevestigen halve finale KNVB beker',publisher:'vp',url:'https://www.voetbalprimeur.nl/nieuws/d'};
 assert.equal(N.sharedStory(c,d),true);
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
 assert.equal(one.report.duplicateSignals,0);
 assert.equal(one.report.feedStats.length,3);
 assert.equal(one.report.feedStats.find(f=>f.source==='vi').accepted,1);
 assert.equal(one.report.feedStats.find(f=>f.source==='vp').new,1);
 assert.ok(one.report.feedStats.find(f=>f.source==='nos').error);
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
test('107A schedule uses quarter-hour RSS discovery without reducing editorial gates',()=>{
 const fs=require('node:fs');
 const workflow=fs.readFileSync(require('node:path').join(__dirname,'../.github/workflows/ten-agent-newsroom101.yml'),'utf8');
 assert.match(workflow,/cron:\s*'7,22,37,52 \* \* \* \*'/);
 assert.match(workflow,/cancel-in-progress: false/);
 assert.match(workflow,/node scripts\/ten-agent-newsroom101\.js/);
 assert.equal(N.MAX_AI_DAILY,10);
});
test('107A latency is measured from RSS dates to first observation, not a publication guarantee',()=>{
 const at=(minutes)=>new Date(now-minutes*60000).toISOString();
 const leads=[{publishedAt:at(30)},{publishedAt:at(1)},{publishedAt:at(20)},
  {publishedAt:new Date(now+60000).toISOString()}];
 const lag=N.detectionLatency(leads,now);
 assert.equal(lag.kind,'rss_publication_to_first_observation');
 assert.equal(lag.count,3);
 assert.equal(lag.medianMinutes,20);
 assert.equal(lag.p95Minutes,30);
 assert.equal(lag.within15Minutes,1);
 assert.equal(N.detectionLatency([],now).medianMinutes,null);
});
test('107A repeated news scan only reports latency for genuinely new deduplicated leads',async()=>{
 const feed=(source)=>source.includes('vi.nl')
  ?rss('PSV denkt aan Kevin De Bruyne transfer','https://www.vi.nl/nieuws/psv-bruyne')
  :source.includes('voetbalprimeur.nl')
  ?rss('PSV praat mogelijk over Kevin De Bruyne','https://www.voetbalprimeur.nl/nieuws/psv-bruyne')
  :rss('KNVB selecteert Oranje-aanvoerder voor interland','https://nos.nl/artikel/12345');
 const fetcher=async url=>new Response(feed(url),{status:200});
 const first=await N.scan({fetcher,now,state:{},apiKey:'',runAI:false});
 assert.equal(first.report.expectedScanMinutes,15);
 assert.equal(first.report.newSignals,3);
 assert.equal(first.report.detectionLatency.count,3);
 assert.equal(first.report.aiCalls,0);
 const second=await N.scan({fetcher,now:now+15*60000,state:first.state,apiKey:'',runAI:false});
 assert.equal(second.report.newSignals,0);
 assert.equal(second.report.detectionLatency.count,0);
 assert.equal(second.report.detectionLatency.p95Minutes,null);
 assert.equal(second.report.publicationAttempts,0);
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


test('101 optional media-attributed rumour draft remains unpublished and unverified',async()=>{
 const group={outlets:['vi','vp'],sources:[
  {title:'PSV toont interesse in Kevin De Bruyne',url:'https://www.vi.nl/nieuws/a',publisher:'vi'},
  {title:'De Bruyne in beeld bij PSV',url:'https://www.voetbalprimeur.nl/nieuws/b',publisher:'vp'}
 ],contradictory:false};
 const ai={angle:'Mogelijke belangstelling',questions:[],caution:'Bronnen mogen dezelfde anonieme bron gebruiken.',
  draft:{headline:'Gerucht: PSV in beeld bij De Bruyne',
   standfirst:'Volgens Voetbal International en VoetbalPrimeur is er belangstelling, maar die is onbevestigd.',
   body:['De media berichten over mogelijke contacten. Een overstap is niet officieel bevestigd.']}};
 const agent=N.AGENTS.find(a=>a.id==='geruchten');
 const note=await N.analyzeWithAI({group,agent,apiKey:'test',fetcher:async()=>Response.json({
  choices:[{message:{content:JSON.stringify(ai)}}]})});
 assert.equal(note.status,'analysis_only_unverified');
 assert.ok(note.draft);
 assert.equal(note.draft.type,'unverified_rumour_working_copy');
 assert.equal(note.draft.publicationAllowed,false);
 assert.equal(note.draft.approved,false);
 assert.equal(note.verified,false);
 const fake={...ai,draft:{headline:'PSV heeft definitief De Bruyne vastgelegd',
  standfirst:'De transfer is afgerond.',body:['Hij heeft getekend.']}};
 const rejected=await N.analyzeWithAI({group,agent,apiKey:'test',fetcher:async()=>Response.json({
  choices:[{message:{content:JSON.stringify(fake)}}]})});
 assert.equal(rejected.draft,null);
});
