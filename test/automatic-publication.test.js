'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {allowedUrl,plain,extractPage,discoverLinks,validateEvidence,duplicate,overlap,compactSource,pacedGroq,selectModel,evidenceFragments,hydrateEvidence,run:runProduction}=require('../scripts/automatic-publication');
const run=options=>runProduction({...options,expectedRevision:null});
const now=Date.parse('2026-10-30T12:00:00Z');
test('generic football wording does not send unrelated official pages to the paid extractor',()=>{
 const {partnerDocuments}=require('../scripts/automatic-publication');
 const doc={url:'https://ajax.nl/artikelen/a',title:'Ajax opent nieuw trainingscentrum in Amsterdam',text:'Ajax opent maandag een trainingscentrum in Amsterdam. De faciliteit krijgt extra kleedkamers, herstelruimtes en trainingsvelden voor de jeugdopleiding.'};
 const related={...doc,url:'https://knvb.nl/nieuws/a',title:'KNVB bezoekt Ajax trainingscentrum',text:doc.text};
 const unrelated={url:'https://psv.nl/media/artikel/b',title:'PSV ontvangt Willem II',text:'De club speelt deze wedstrijd in het nieuwe seizoen. Het team heeft meer nieuws voor clubs over de laatste wedstrijden.'};
 const coincidental={url:'https://peczwolle.nl/nieuws/b',title:'Ajax speelt tegen PEC Zwolle',text:'Ajax speelt een wedstrijd in Amsterdam. Het team uit Amsterdam komt tijdens het seizoen naar Zwolle.'};
 assert.deepEqual(partnerDocuments(doc,[unrelated,coincidental,related]),[related]);
});
function fixture(){
 const texts=['Ajax ontvangt AZ op zaterdag 31 oktober 2026 om 21:00 uur in Amsterdam. De club biedt bezoekers informatie over de toegangskaarten en de ontvangst rond het stadion.',
 'AZ speelt op zaterdag 31 oktober 2026 een uitwedstrijd tegen Ajax. Het duel begint om 21:00 uur en wordt gespeeld in Amsterdam. De club meldt dat bezoekers hun toegangskaart digitaal kunnen gebruiken.'];
 const docs=texts.map((text,i)=>({url:i?'https://www.az.nl/inside-az/nieuws/test':'https://www.ajax.nl/artikelen/test',text,publishedAt:'2026-10-30T08:00:00Z'}));
 const facts=[texts[0].split('. ')[0]+'.',texts[0].split('. ')[1],texts[1].split('. ')[1]+'.',texts[1].split('. ')[2]].map((text,i)=>({text,evidence:[{source:i<2?0:1,quote:text}]}));
 return {docs,candidate:{kind:'preview',eventDate:'2026-10-31',facts,sharedEventEvidence:[{source:0,quote:texts[0].split('. ')[0]+'.'},{source:1,quote:texts[1].split('. ')[0]+'.'}]}};
}
test('only exact official HTTPS domains are accepted',()=>{
 assert.equal(allowedUrl('https://www.ajax.nl/artikelen/test'),true);
 for(const url of ['http://ajax.nl/test','https://ajax.nl.evil.example/test','https://evilajax.nl/test','https://user:password@ajax.nl/test','https://www.voetbalprimeur.nl/nieuws/test'])assert.equal(allowedUrl(url),false);
});
test('source extraction uses article content and removes menus and scripts',()=>{
 const d=extractPage('<title>Titel</title><nav>Menu</nav><main><h1>Clubnieuws</h1><p>Actuele clubinformatie voor bezoekers.</p><script>untrusted()</script></main>','https://ajax.nl/artikelen/test');
 assert.equal(d.title,'Clubnieuws');assert.equal(d.text,'Clubnieuws Actuele clubinformatie voor bezoekers.');
 assert.equal(extractPage('<div>Alleen menu en cookies</div>','https://ajax.nl').text,'');
 assert.equal(plain('<p>A &amp; B&nbsp;– test</p>'),'A & B – test');
 assert.equal(extractPage('<main><h1>Clubnieuws</h1>AZ 1 ⎯ 30.10.2026<p>Feitelijke informatie.</p></main>','https://az.nl/inside-az/nieuws/a').publishedAt,'2026-10-30');
});
test('discovery cannot leave the exact configured official site or article path',()=>{
 const index={url:'https://www.ajax.nl/artikelen/',articlePath:'^/artikelen/[^/]+/?$'};
 assert.deepEqual(discoverLinks('<a href="/artikelen/nieuws">A</a><a href="https://evil.example/artikelen/x">B</a><a href="/fans/test">C</a><a href="/artikelen/nieuws#x">D</a>',index),['https://www.ajax.nl/artikelen/nieuws']);
});
test('primary publication dates parse Dutch and PSV headers without using a future fixture date as publication time',()=>{
 assert.equal(extractPage('<main><h1>Clubnieuws</h1>03-11-2026<p>Actuele mededeling.</p></main>','https://psv.nl/media/artikel/test').publishedAt,'2026-11-03');
 assert.equal(extractPage('<main><h1>Clubnieuws</h1>Zondag 01 november 2026 om 19:10<p>Clubmededeling.</p></main>','https://fcgroningen.nl/nieuws/test/').publishedAt,'2026-11-01');
 assert.equal(extractPage('<meta property="og:datePublished" content="2026-11-05T02:41:44+01:00"><main><h1>Clubnieuws</h1></main>','https://fctwente.nl/nieuws/test').publishedAt,'2026-11-05T02:41:44+01:00');
 assert.equal(extractPage('<main><h1>Ajax speelt donderdag 5 november 2026</h1><p>Het duel staat gepland.</p></main>','https://ajax.nl/artikelen/test').publishedAt,'');
});
test('literal evidence from two official domains passes while invented quotes and single-domain confirmation fail',()=>{
 const {docs,candidate}=fixture();assert.deepEqual(validateEvidence(candidate,docs,now),[]);
 const invented=structuredClone(candidate);invented.facts[0].evidence[0].quote='Deze zin met een verzonnen uitslag staat nergens in de officiële bron.';
 assert.ok(validateEvidence(invented,docs,now).some(x=>x.includes('letterlijk')));
 const same=structuredClone(docs);same[1].url='https://ajax.nl/artikelen/ander';assert.ok(validateEvidence(candidate,same,now).some(x=>x.includes('twee onafhankelijke')));
});
test('past previews, far-future fixtures, undated announcements and unsupported report types stay blocked',()=>{
 for(const mutation of [c=>c.eventDate='2026-10-29',c=>c.eventDate='2026-10-30',c=>c.eventDate='2027-01-01',c=>c.kind='match-report']){
  const {docs,candidate}=fixture();mutation(candidate);assert.ok(validateEvidence(candidate,docs,now).length);
 }
 const {docs,candidate}=fixture();candidate.kind='announcement';for(const doc of docs)doc.publishedAt='';assert.ok(validateEvidence(candidate,docs,now).some(x=>x.includes('brondatum')));
});
test('duplicate checks retain topic identity and reused primary news URLs',()=>{
 const p={draft:{headline:'Ajax ontvangt AZ zaterdagavond in eigen stadion'},sources:[{url:'https://ajax.nl/artikelen/a'},{url:'https://az.nl/nieuws/a'}],topicTeams:['Ajax','AZ'],topicDate:'2026-10-31'};
 assert.equal(duplicate(p,[{headline:'Ajax tegen AZ op zaterdag 31 oktober',standfirst:'De ploegen ontmoeten elkaar in Amsterdam.',body:[],sources:[]}]),true);
 assert.equal(duplicate(p,[{headline:'Volledig andere bewoording van hetzelfde onderwerp',body:[],sources:[{url:p.sources[0].url}]}]),true);
 assert.equal(duplicate(p,[{headline:'PSV ontvangt Willem II in Eindhoven',body:[],sources:[]}]),false);
});
test('long word-for-word copying is blocked and missing keys prevent all network and publication writes',async()=>{
 assert.equal(overlap('Dit is een volledige en veel te lange letterlijk gekopieerde zin uit een bron.',{headline:'Dit is een volledige en veel te lange letterlijk gekopieerde zin uit een bron.',standfirst:'',body:[]}),true);
 await assert.rejects(run({fetcher:()=>{throw Error('Unexpected network call');}}),/HUB_API_SECRET/);
});
test('request compaction keeps the decisive match information and rate limits are retried',async()=>{
 const text='Historische informatie '.repeat(500)+'Wedstrijdinformatie Ajax - AZ zaterdag 31 oktober om 21.00 uur.';
 const compact=compactSource({text});assert.ok(compact.length<4300);assert.ok(compact.includes('Wedstrijdinformatie'));
 let calls=0;const fetcher=pacedGroq(async()=>++calls===1?{status:429,headers:new Headers({'retry-after':'0'}),arrayBuffer:async()=>new ArrayBuffer(0)}:{status:200},0);
 assert.equal((await fetcher('https://api.groq.com/openai/v1/chat/completions',{})).status,200);assert.equal(calls,2);
});
test('model discovery selects an available supported model and rejects unavailable catalogs',()=>{
 assert.equal(selectModel({data:[{id:'openai/gpt-oss-120b'}]}),'openai/gpt-oss-120b');
 assert.throws(()=>selectModel({data:[{id:'openai/gpt-oss-20b'}]}),/niet beschikbaar/);
 assert.throws(()=>selectModel({data:[{id:'llama-3.3-70b-versatile'}]}),/niet beschikbaar/);
});
test('all launch articles pass the same original-copy and factual preflight',()=>{
 const {generationIssues}=require('../editorial-ai');
 for(const p of require('../automatic-bootstrap.json'))assert.deepEqual(generationIssues(p.draft,p.candidate.facts.map(f=>f.text)),[],p.key);
});
test('selected evidence always resolves to exact source bytes and invented passage IDs fail closed',()=>{
 const docs=fixture().docs,fragments=docs.map(evidenceFragments);
 const c=hydrateEvidence({facts:[{text:'Feit',evidence:[{source:0,fragment:0}]}],sharedEventEvidence:[{source:0,fragment:0},{source:1,fragment:0}]},fragments);
 assert.ok(docs[0].text.includes(c.facts[0].evidence[0].quote));
 assert.throws(()=>hydrateEvidence({facts:[{evidence:[{source:0,fragment:500}]}],sharedEventEvidence:[]},fragments),/Ongeldige verwijzing/);
});

test('national editorial gate rejects ticket pages and prioritizes major clubs without losing material smaller-club news',()=>{
 const {nationallyRelevant,editorialPriority}=require('../scripts/automatic-publication');
 const text='De club heeft na overleg een officieel besluit genomen over de selectie voor het komende seizoen. De technische staf bevestigt de verandering in een uitgebreide verklaring en geeft aan welke gevolgen dit heeft voor de eerste selectie en de voorbereiding op de komende competitiewedstrijden. De club zal de nieuwe situatie nader toelichten.';
 const major={title:'Ajax bevestigt transfer na akkoord over contract',text};
 const other={title:'FC Groningen bevestigt transfer na akkoord over contract',text};
 const ticket={title:'Ajax start kaartverkoop voor nieuwe wedstrijd',text};
 const routine={title:'PSV speelt volgende week thuis tegen AZ',text};
 assert.equal(nationallyRelevant(major),true);
 assert.equal(nationallyRelevant(other),true);
 assert.equal(nationallyRelevant(ticket),false);
 assert.equal(nationallyRelevant(routine),false);
 assert.ok(editorialPriority(major)>editorialPriority(other));
});

test('GDELT supplies bounded discovery links but never content or evidence', async()=>{
 const {discoverGdelt}=require('../scripts/editorial-discovery53');
 const {sourceText}=require('../scripts/automatic-publication');
 const index={url:'https://www.ajax.nl/',articlePath:'^/artikelen/[^/]+/?$'};
 const result=await discoverGdelt([index],async(url,options)=>{
  assert.equal(new URL(url).hostname,'api.gdeltproject.org');
  assert.equal(options.redirect,'error');
  return Response.json({articles:[
   {url:'https://ajax.nl/artikelen/nieuws?utm=1',title:'Onbevestigde tekst'},
   {url:'https://www.ajax.nl/artikelen/nieuws#ander'},
   {url:'https://ajax.nl/fans/a'},
   {url:'https://ajax.nl.example.org/artikelen/a'}
  ]});
 },sourceText);
 assert.deepEqual(result,['https://www.ajax.nl/artikelen/nieuws']);
 await assert.rejects(discoverGdelt([index],async()=>new Response(null,{status:429}),sourceText),/HTTP 429/);
});

test('partial outages keep discovery running without AI calls or article writes on an empty round',async()=>{
 const config=require('../automatic-editorial.json');
 const calls=[];
 const report=await run({secret:'test',groqKey:'test',githubToken:'test',now,fetcher:async(url,options={})=>{
  calls.push([url,options.method||'GET']);
  if(url.includes('/articles?'))return Response.json({articles:[]});
  if(url.includes('editorial-queue45.json'))return options.method==='PUT'?Response.json({content:{sha:'test'}}):new Response(null,{status:404});
  if(url.includes('gdeltproject.org')||url===config.newsIndexes[0].url)return new Response(null,{status:429});
  return new Response('<main><h1>Geen nieuwe nieuwslinks</h1></main>');
 }});
 assert.equal(report.status,'no_new_verified_articles');
 assert.equal(report.sources.gdelt.status,'unavailable');
 assert.equal(report.sources.officialIndexes[0].status,'unavailable');
 assert.ok(report.sources.officialIndexes.some(source=>source.status==='ok'));
 assert.equal(report.counts.aiRequests,0);
 assert.equal(calls.some(([url,method])=>method==='POST'||url.includes('api.groq.com')),false);
});

test('archived official cup evidence reaches the non-bootstrap writer and the public feed',async()=>{
 const {fingerprint}=require('../editorial-drafts');
 const {candidate,draft,sourceUrls}=require('../automatic-bootstrap.json').find(entry=>entry.key==='hoek-az-bekerprogramma-2026-11-06');
 const config=require('../automatic-editorial.json');
 const urls=[sourceUrls[0].replace(/\/[^/]+$/,'/bekerprogramma-hsv-hoek-az'),sourceUrls[1].replace(/\/[^/]+$/,'/bekerprogramma-hsv-hoek-az')];
 const title='KNVB Bekerprogramma HSV Hoek en AZ';
 const evidence=candidate.facts.flatMap(fact=>fact.evidence);
 const pages=urls.map((url,index)=>{
  const quotes=[...new Set(evidence.filter(e=>e.source===index).map(e=>e.quote))];
  const text=title+' '+quotes.join(' ');
  return {url,text,title,publishedAt:'2026-11-06T08:00:00Z'};
 });
 const fragments=pages.map(evidenceFragments);
 const references=candidate.facts.map(fact=>({
  text:fact.text,
  evidence:fact.evidence.map(({source,quote})=>{
   const fragment=fragments[source].findIndex(text=>text.includes(quote.slice(0,35)));
   assert.notEqual(fragment,-1);
   return {source,fragment};
  })
 }));
 const extraction={...candidate,facts:references,sharedEventEvidence:[{source:0,fragment:0},{source:1,fragment:0}]};
 const modelResponses=[extraction,draft,{approved:true,issues:[],scores:Object.fromEntries(['actuality','reliability','nationalValue','originality','journalism','diversity'].map(key=>[key,95]))}];
 let saved,article;
 const report=await run({secret:'test',groqKey:'test',githubToken:'test',groqIntervalMs:0,now:Date.parse('2026-11-06T10:00:00Z'),fetcher:async(url,options={})=>{
  if(url.endsWith('/articles?view=all')||url.endsWith('/articles'))return Response.json({articles:article?[article]:[]});
  if(url.includes('editorial-queue45.json'))return options.method==='PUT'?Response.json({content:{sha:'test'}}):new Response(null,{status:404});
  if(url.includes('gdeltproject.org'))return new Response(null,{status:429});
  if(url.endsWith('/models'))return Response.json({data:[{id:config.model}]});
  if(url.endsWith('/chat/completions')){
   assert.ok(modelResponses.length);
   return Response.json({choices:[{message:{content:JSON.stringify(modelResponses.shift())}}]});
  }
  if(url.endsWith('/editorial-drafts')){
   saved=JSON.parse(options.body).payload;
   return Response.json({record:{id:'test-draft',revision:1,status:'approved',contentHash:fingerprint(saved)}});
  }
  if(url.endsWith('/publish')){
   assert.equal(JSON.parse(options.body).editorialDraftId,'test-draft');
   article={id:'test-article',imageUrl:saved.imageUrl,...saved.draft};
   return Response.json({status:'published',article});
  }
  const page=pages.find(entry=>entry.url===url);
  if(page)return new Response('<meta content="'+page.publishedAt+'" property="article:published_time"><main><nav>Menu</nav><article><h1>'+page.title+'</h1><p>'+page.text.slice(page.title.length)+'</p></article></main>');
  const index=config.newsIndexes.find(entry=>entry.url===url);
  if(index)return new Response(pages.filter(page=>new URL(page.url).hostname===new URL(url).hostname).map(page=>'<a href="'+page.url+'">Bekerprogramma</a>').join(''));
  return new Response(null,{status:404});
 }});
 assert.equal(report.status,'completed',JSON.stringify(report));
 assert.deepEqual([report.counts.selected,report.counts.generated,report.counts.stored,report.counts.published],[1,1,1,1]);
 assert.equal(report.sources.gdelt.status,'unavailable');
 assert.equal(report.assessments[0].threshold,85);
 assert.equal(modelResponses.length,0);
});

for(const hasHalf of [true,false])test('registered match uses compact format with halftime='+hasHalf+' during source outage and recovers legacy queue once',async()=>{
 const {fingerprint}=require('../editorial-drafts');
 const config=require('../automatic-editorial.json');
 const match={
  id:'of-nl-2026-fc-twente-psv',competition:'eredivisie',date:new Date(Date.now()-3*3600000).toISOString(),
  status:'FT',round:'Speelronde 7',home:{name:'FC Twente'},away:{name:'PSV'},
  goals:{home:3,away:0},...(hasHalf?{halfTime:{home:1,away:0}}:{})
 };
 const scores=Object.fromEntries(['actuality','reliability','nationalValue','originality','journalism','diversity'].map(key=>[key,95]));
 const clock=Date.now();
 const record=require('../editorial-match55').candidate(match,clock);
 const queue=new (require('../editorial-production45').EditorialQueue)();
 const job=queue.enqueue([{url:record.sources[0].url,title:record.topic,text:record.verifiedFacts.join(' '),publishedAt:record.publishedAt}],clock);
 Object.assign(job,{status:'review',reason:'editorial_review_required',matchOutputV5:true,matchId:record.matchId});
 let saved, article, calls=0,checkpoint;
 const report=await run({
  secret:'isolated',groqKey:'isolated',githubToken:'isolated',now:clock,groqIntervalMs:0,
  fetcher:async(url,options={})=>{
   if(url.includes('/integrations/football'))return Response.json({status:'available',fixtures:[match]});
   if(url.includes('/articles'))return Response.json({articles:article?[article]:[],rightsPolicyVersion:26,rightsExpiresAt:Date.now()+3600000});
   if(url.includes('editorial-queue45.json')){if(options.method==='PUT'){checkpoint=JSON.parse(Buffer.from(JSON.parse(options.body).content,'base64'));return Response.json({content:{sha:'test'}});}return Response.json({sha:'old',content:Buffer.from(JSON.stringify({records:queue.records})).toString('base64')});}
   if(url.endsWith('/models'))return Response.json({data:[{id:config.model}]});
   if(url.endsWith('/chat/completions')){
    calls++;
    const response={approved:true,issues:[],scores};
    return Response.json({choices:[{message:{content:JSON.stringify(response)}}]});
   }
   if(url.endsWith('/editorial-drafts')){
    saved=JSON.parse(options.body).payload;
    assert.equal(saved.articleKind,hasHalf?'match_report':'score_update');
    assert.equal(saved.draft.body.length,hasHalf?2:1);
    if(hasHalf)assert.match(saved.draft.body[1],/ruststand was 1-0/);
    else assert.ok(!saved.draft.body.join(' ').includes('ruststand'));
    assert.ok(saved.draft.body[0].endsWith('OpenFootball.'));
    assert.deepEqual(require('../editorial-desk-model').publicationIssues(saved),[]);
    assert.equal(require('../editorial-match55').matchesRegistration(saved,[match],clock),true);
    return Response.json({record:{id:'isolated',revision:1,status:'approved',contentHash:fingerprint(saved)}});
   }
   if(url.endsWith('/publish')){
    article={id:'isolated',imageUrl:saved.imageUrl,body:saved.draft.body};
    return Response.json({status:'published',article});
   }
   return new Response(null,{status:503});
  }
 });
 assert.equal(report.status,'completed',JSON.stringify(report));
 assert.deepEqual(report.routes.match,{found:1,selected:1,generated:1,rejected:0,published:1});
 assert.equal(report.assessments[0].threshold,85);
 assert.equal(calls,1);
 assert.equal(checkpoint.records[0].status,'published');
 assert.equal(checkpoint.records[0].matchRecoveryV60,true);
});

test('one official source can verify its own appointment, but cannot verify a disputed transfer',()=>{
 const url='https://www.inter.it/en/news/simone-lo-schiavo-is-the-new-director-of-football-development-inter';
 const title='Simone Lo Schiavo is the new Director of Football Development';
 const text='Simone Lo Schiavo joined the club as Director of Football Development on 5 November 2026.';
 const doc={url,title,text,publishedAt:new Date(now-3600000).toISOString()};
 const candidate={kind:'announcement',primaryAuthority:'club_decision',sharedEventEvidence:[],facts:[
  'Inter benoemt Simone Lo Schiavo.',
  'Simone Lo Schiavo trad in dienst bij Inter.',
  'De functie betreft voetbalontwikkeling.',
  'De aanstelling ging in op vijf november.'
 ].map(textFact=>({text:textFact,evidence:[{source:0,quote:text}]}))};
 assert.deepEqual(validateEvidence(candidate,[doc],now),[]);
 assert.ok(validateEvidence({...candidate,transferStatus:'confirmed'},[doc],now).some(issue=>issue.includes('onafhankelijke')));
 assert.ok(validateEvidence(candidate,[{...doc,url:'https://www.inter.it/en/'}],now).length);
});

test('software retains primary authority when the extraction model omits editorial metadata',async()=>{
 const {extractCandidate}=require('../scripts/automatic-publication');
 const doc={url:'https://www.inter.it/en/news/simone-lo-schiavo-is-the-new-director-of-football-development-inter',
  title:'Simone Lo Schiavo is the new Director of Football Development',publishedAt:new Date(now-3600000).toISOString(),
  text:'Simone Lo Schiavo joined Inter as Director of Football Development on 5 November 2026, reporting to Dario Baccin.'};
 const facts=[doc.text]
  .map(text=>({text,evidence:[{source:0,fragment:0}]}));
 const candidate=await extractCandidate([doc],{key:'isolated',fetcher:async()=>Response.json({choices:[{message:{
  content:JSON.stringify({kind:'announcement',transferStatus:'unconfirmed',facts})
 }}]})},now);
 assert.equal(candidate.primaryAuthority,'club_decision');
 assert.deepEqual(validateEvidence(candidate,[doc],now),[]);
});

test('revision editor may decline insufficient evidence rather than fabricate content',async()=>{
 const {reviseDraft}=require('../scripts/automatic-publication');
 const result=await reviseDraft({draft:{headline:'Voorlopige kop',standfirst:'Voorlopige intro',body:['Concept']},verifiedFacts:['Feit A']},
  {kind:'announcement'},[{url:'https://www.ajax.nl/artikelen/test',title:'Test',text:'Beperkte feiten',publishedAt:'2026-11-06'}],
  'Onvoldoende journalistieke diepgang',{key:'test',fetcher:async()=>Response.json({choices:[{message:{content:JSON.stringify({skip:true})}}]})});
 assert.equal(result,null);
});

test('one verified official decision can use the brief format without relaxing other publication checks',()=>{
 const M=require('../editorial-desk-model');
 const {generationIssues}=require('../editorial-ai');
 const fact='Ajax bevestigt de aanstelling van de hoofdtrainer per 1 november.';
 const doc={url:'https://www.ajax.nl/artikelen/aanstelling',title:'Ajax stelt hoofdtrainer aan',text:fact,publishedAt:'2026-10-30T08:00:00Z'};
 const candidate={kind:'announcement',primaryAuthority:'club_decision',facts:[{text:fact,evidence:[{source:0,quote:fact}]}]};
 const payload={
  articleKind:candidate.kind,primaryAuthority:candidate.primaryAuthority,verifiedFacts:[fact],sources:[{url:doc.url}],
  editorialChecks:Object.fromEntries(M.checks.map(check=>[check,true])),
  draft:{headline:'Ajax maakt aanstelling van hoofdtrainer bekend',standfirst:'Ajax heeft de aanstelling van de hoofdtrainer officieel bekendgemaakt.',body:['Uit de bekendmaking blijkt dat het besluit per 1 november ingaat.']}
 };
 assert.deepEqual(validateEvidence(candidate,[doc],now),[]);
 assert.deepEqual(generationIssues(payload.draft,[fact],null,true),[]);
 assert.deepEqual(M.publicationIssues(payload),[]);
 assert.ok(M.publicationIssues({...payload,primaryAuthority:undefined}).length);
 assert.ok(M.publicationIssues({...payload,editorialChecks:{}}).length);
 assert.ok(M.publicationIssues({...payload,draft:{...payload.draft,body:[payload.draft.standfirst]}}).length);
 assert.ok(validateEvidence({...candidate,transferStatus:'confirmed'},[doc],now).length);
 assert.ok(validateEvidence(candidate,[{...doc,text:'Geen bevestiging in de bron.'}],now).length);
});

test('production revision mismatch stops discovery and publication before any writes',async()=>{
 const calls=[];
 await assert.rejects(runProduction({secret:'test',groqKey:'test',githubToken:'test',expectedRevision:'tested-commit',
 fetcher:async(url,options={})=>{calls.push([url,options.method]);return Response.json({ready:true,revision:'old-commit'});}}),/Backendversie/);
 assert.equal(calls.length,1);assert.ok(calls[0][0].endsWith('/ready'));assert.equal(calls[0][1],undefined);
});


test('writer recovery retries a generator failure once and never reopens a factual or quality rejection',()=>{
 const {recoverGeneration}=require('../scripts/automatic-publication');
 const original={status:'review',failureStage:'generation',failureCategory:'generator_failure',attempts:1};
 const job={...original};
 assert.equal(recoverGeneration(job,now),true);
 assert.equal(job.status,'pending');assert.equal(job.attempts,0);assert.equal(job.nextAttemptAt,now);
 job.status='review';
 assert.equal(recoverGeneration(job,now),false);
 for(const changes of [
  {failureStage:'verification',failureCategory:'journalistic_rejection'},
  {failureStage:'quality',failureCategory:'journalistic_rejection'},
  {status:'published'}, {failureCategory:undefined}, {status:'retry'}
 ]){
  const rejected={...original,...changes},before={...rejected};
  assert.equal(recoverGeneration(rejected,now),false);assert.deepEqual(rejected,before);
 }
});

test('focused production refuses an unconfigured source before any network call',async()=>{
 let calls=0;
 await assert.rejects(runProduction({focusSourceUrl:'https://example.com/article',fetcher:async()=>{calls++;}}),/Ongeldige gerichte/);
 assert.equal(calls,0);
});


test('a focused push uses only an explicit commit trailer and preserves dispatch input',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const {publicationFocus}=require('../scripts/automatic-publication');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veldio-focus-'));
 const event=path.join(dir,'event.json'),source='https://peczwolle.nl/nieuws/aanstelling';
 try{
  fs.writeFileSync(event,JSON.stringify({head_commit:{message:'Repair writer\n\nEditorial-Source: '+source}}));
  assert.equal(publicationFocus({GITHUB_EVENT_NAME:'push',GITHUB_EVENT_PATH:event}),source);
  assert.equal(publicationFocus({GITHUB_EVENT_NAME:'schedule',GITHUB_EVENT_PATH:event}),undefined);
  assert.equal(publicationFocus({FOCUS_SOURCE_URL:'dispatch'}),'dispatch');
  fs.writeFileSync(event,JSON.stringify({head_commit:{message:'Ordinary push'}}));
  assert.equal(publicationFocus({GITHUB_EVENT_NAME:'push',GITHUB_EVENT_PATH:event}),undefined);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});


test('primary extraction repairs an invented date before the writer can receive it',async()=>{
 const {extractCandidate}=require('../scripts/automatic-publication');
 const doc={url:'https://peczwolle.nl/nieuws/alex-pastoor-nieuwe-hoofdtrainer-pec-zwolle',
  title:'Alex Pastoor nieuwe hoofdtrainer PEC Zwolle',publishedAt:'2026-11-07T10:14:00+01:00',
  text:'PEC Zwolle heeft Alex Pastoor als nieuwe hoofdtrainer aangesteld. De ervaren oefenmeester staat vanaf maandag voor de groep.'};
 let calls=0;
 const extracted=await extractCandidate([doc],{key:'test',fetcher:async(_,options)=>{
  calls++;
  if(calls===2)assert.match(JSON.parse(options.body).messages.at(-1).content,/niet-brongetrouwe/);
  return Response.json({choices:[{message:{content:JSON.stringify({kind:'announcement',facts:[{
   text:calls===1?'Pastoor begint op 13 november 2026 als hoofdtrainer.':doc.text,
   evidence:[{source:0,fragment:0}]
  }]})}}]});
 }},now);
 assert.equal(calls,2);assert.equal(extracted.facts[0].text,doc.text);
 assert.equal(extracted.facts[0].text.includes('13 november'),false);
 assert.deepEqual(validateEvidence(extracted,[doc],Date.parse('2026-11-07T18:00:00Z')),[]);
});

test('persistently invented primary facts stay blocked after one repair',async()=>{
 const {extractCandidate}=require('../scripts/automatic-publication');
 const doc={url:'https://peczwolle.nl/nieuws/aanstelling',title:'PEC Zwolle benoemt hoofdtrainer',
  text:'PEC Zwolle heeft een nieuwe hoofdtrainer benoemd die vanaf maandag aan de slag gaat.'};
 let calls=0;
 await assert.rejects(extractCandidate([doc],{key:'test',fetcher:async()=>{
  calls++;return Response.json({choices:[{message:{content:JSON.stringify({kind:'announcement',facts:[{
   text:'De nieuwe hoofdtrainer begint op 13 november.',evidence:[{source:0,fragment:0}]
  }]})}}]});
 }},now),/niet letterlijk/);
 assert.equal(calls,2);
});


test('overlap feedback identifies exact copied words while preserving the ten-word rejection',()=>{
 const {overlapPhrases}=require('../scripts/automatic-publication');
 const source='Dennis van der Ree en Maikel van der Werff keren terug als assistent-trainer.';
 const copied={headline:'De technische staf krijgt een nieuwe taak',standfirst:'PEC Zwolle heeft de samenstelling van de technische staf bekendgemaakt.',body:[source]};
 assert.ok(overlap(source,copied));
 assert.ok(overlapPhrases(source,copied).includes('dennis van der ree en maikel van der werff keren'));
 const rewritten={...copied,body:['Maikel van der Werff wordt weer assistent, net als Dennis van der Ree.']};
 assert.equal(overlap(source,rewritten),false);
 assert.deepEqual(overlapPhrases(source,rewritten),[]);
});


test('primary news is concise for at most three facts and full depth for four or more',()=>{
 const M=require('../editorial-desk-model');
 const docs=[{url:'https://peczwolle.nl/nieuws/aanstelling'}];
 for(const n of [1,2,3,4,5]){
  const facts=Array.from({length:n},(_,i)=>'Concreet vastgelegd feit '+i);
  const payload={articleKind:'announcement',primaryAuthority:'club_decision',sources:docs,verifiedFacts:facts};
  assert.equal(M.briefEligible(payload),n<=3);
 }
 assert.equal(M.briefEligible({articleKind:'announcement',primaryAuthority:'club_decision',sources:docs,verifiedFacts:Array(6).fill('feit')}),false);
 assert.equal(M.briefEligible({articleKind:'announcement',primaryAuthority:'club_decision',sources:docs,verifiedFacts:['feit'],transferStatus:'confirmed'}),false);
 assert.ok(M.publicationIssues({articleKind:'announcement',primaryAuthority:'club_decision',sources:docs,verifiedFacts:['feit'],draft:{headline:'Onvolledige kop'}}).length>0);
});

test('repair requests explicitly whitelist numbers instead of inventing dates or staff',async()=>{
 const {reviseDraft}=require('../scripts/automatic-publication');
 const facts=['PEC Zwolle benoemt Alex Pastoor tot hoofdtrainer.'];
 let input;
 const fetcher=async(_,options)=>{
  input=JSON.parse(options.body);
  return Response.json({choices:[{message:{content:JSON.stringify({
   headline:'PEC Zwolle maakt nieuwe hoofdtrainer officieel bekend',
   standfirst:'De club meldt de benoeming van Alex Pastoor als hoofdtrainer.',
   body:['PEC Zwolle bevestigt de aanstelling van Pastoor.']
  })}}]});
 };
 const revised=await reviseDraft({draft:{headline:'Afgekeurd',body:[]},verifiedFacts:facts,articleKind:'announcement',primaryAuthority:'club_decision',sources:[{url:'https://peczwolle.nl/nieuws/aanstelling'}]}, {topic:'Alex Pastoor'},[], 'Cijfers ontbreken in de gecontroleerde feiten: 2026', {key:'test',model:'test',fetcher});
 assert.ok(Array.isArray(revised.body));
 const instructions=input.messages[0].content;
 assert.match(instructions,/jaartallen/);
 assert.match(instructions,/persoonsnamen en cijfers/);
 assert.deepEqual(JSON.parse(input.messages[1].content).allowedNumbers,[]);
});

test('V63 full quality retry of official decisions is bounded and excludes other failures',()=>{
 const {recoverEditorialBrief}=require('../scripts/automatic-publication');
 const rejected={status:'review',failureStage:'quality',failureCategory:'journalistic_rejection',attempts:2};
 const job={...rejected};
 assert.equal(recoverEditorialBrief(job,now),true);
 assert.equal(job.status,'pending');
 assert.equal(job.attempts,0);
 job.status='review';
 assert.equal(recoverEditorialBrief(job,now),false);
 for(const changes of [
  {failureStage:'verification'}, {failureStage:'generation'},
  {failureCategory:'temporary_source_failure'}, {status:'published'}
 ])assert.equal(recoverEditorialBrief({...rejected,...changes},now),false);
});

test('unrelated football matches are not used as independent confirmation',()=>{
 const {partnerDocuments}=require('../scripts/automatic-publication');
 const base={url:'https://www.az.nl/inside-az/nieuws/2026/november/liveblog-jong-az-almere-city',title:'Jong AZ houdt geen punten over aan duel met Almere City FC',
  text:'Jong AZ houdt geen punten over aan duel met Almere City FC. De club speelt deze wedstrijd zonder punten tegen Almere.'};
 const unrelated={url:'https://peczwolle.nl/nieuws/pec-zwolle-komt-met-reactie-tegen-ado-den-haag-en-wint',title:'PEC Zwolle komt met reactie tegen ADO Den Haag en wint',
  text:'PEC Zwolle wint een wedstrijd na een reactie tegen ADO Den Haag. De club speelt opnieuw in de competitie met de selectie.'};
 const related={url:'https://www.psv.nl/media/artikel/andere-wedstrijd',title:'PSV ontvangt Ajax in duel',
  text:'PSV speelt de komende wedstrijd tegen Ajax. De ploeg is klaar voor het duel.'};
 assert.deepEqual(partnerDocuments(base,[unrelated,related]),[]);
 const a={url:'https://www.fcgroningen.nl/nieuws/naar-az',title:'FC Groningen naar AZ in Alkmaar',
  text:'FC Groningen speelt zaterdag een wedstrijd tegen AZ in Alkmaar.'};
 const anniversary={url:'https://www.az.nl/inside-az/nieuws/2026/november/20-jaar-afas-stadion-az-fc-groningen',title:'20 jaar AFAS Stadion: AZ – FC Groningen',
  text:'AZ en FC Groningen zijn verbonden aan het stadion en de komende wedstrijd. De club viert 20 jaar.'};
 assert.deepEqual(partnerDocuments(a,[anniversary]),[]);
});
test('past misclassified source-overlap errors are reopened only once',()=>{
 const {recoverMisclassifiedOverlap}=require('../scripts/automatic-publication');
 const original={status:'retry',failureStage:'quality',failureCategory:'temporary_source_failure',attempts:1};
 const job={...original};
 assert.equal(recoverMisclassifiedOverlap(job,now),true);
 assert.equal(job.status,'pending');
 assert.equal(job.attempts,0);
 job.status='review';
 assert.equal(recoverMisclassifiedOverlap(job,now),false);
 assert.equal(recoverMisclassifiedOverlap({...original,failureStage:'generation'},now),false);
});


test('source-copied verified assistant pair can be reframed without adding facts',()=>{
 const {reframeVerifiedStaffPair,overlapPhrases}=require('../scripts/automatic-publication');
 const quoted='Dennis van der Ree en Maikel van der Werff, die de afgelopen vijf wedstrijden tijdelijk de leiding hadden overgenomen, keren terug in hun functie van assistent-trainer.';
 const doc={text:quoted};
 const draft={headline:'PEC Zwolle maakt trainersaanstelling bekend',standfirst:'De club heeft een nieuwe hoofdtrainer aangewezen.',
  body:['Dennis van der Ree en Maikel van der Werff, die de afgelopen vijf wedstrijden tijdelijk de leiding hadden, keren terug als assistent-trainers.']};
 assert.ok(overlapPhrases(doc.text,draft).length);
 const result=reframeVerifiedStaffPair(draft,[quoted],[doc]);
 assert.deepEqual(result.body,['Maikel van der Werff en Dennis van der Ree, die de afgelopen vijf wedstrijden tijdelijk de leiding hadden, keren terug als assistent-trainers.']);
 assert.deepEqual(overlapPhrases(doc.text,result),[]);
 assert.deepEqual(reframeVerifiedStaffPair(draft,[quoted.replace('keren terug','blijven')],[doc]),draft);
 assert.deepEqual(reframeVerifiedStaffPair(draft,[],[doc]),draft);
 assert.deepEqual(reframeVerifiedStaffPair(draft,[quoted],[{text:'Een andere tekst zonder letterlijke bronoverlap.'}]),draft);
});

test('new verified-name rewrite retries one rejected official article exactly once',()=>{
 const {recoverVerifiedNameRewrite}=require('../scripts/automatic-publication');
 const job={status:'review',failureStage:'quality',failureCategory:'journalistic_rejection',attempts:3};
 assert.equal(recoverVerifiedNameRewrite(job,now),true);
 assert.equal(job.status,'pending');assert.equal(job.attempts,0);
 job.status='review';
 assert.equal(recoverVerifiedNameRewrite(job,now),false);
 assert.equal(recoverVerifiedNameRewrite({...job,verifiedNameRewriteV65:false,failureStage:'verification'},now),false);
 assert.equal(recoverVerifiedNameRewrite({...job,verifiedNameRewriteV65:false,failureCategory:'temporary_source_failure'},now),false);
});

test('V66 factual richness retries one rejected official packet and never bypasses controls',()=>{
 const {recoverRichVerifiedContext}=require('../scripts/automatic-publication');
 const job={status:'review',failureStage:'quality',failureCategory:'journalistic_rejection',attempts:2};
 assert.equal(recoverRichVerifiedContext(job,now),true);
 assert.equal(job.status,'pending');assert.equal(job.attempts,0);
 job.status='review';assert.equal(recoverRichVerifiedContext(job,now),false);
 assert.equal(recoverRichVerifiedContext({...job,richContextRecoveryV66:false,failureStage:'verification'},now),false);
 assert.equal(recoverRichVerifiedContext({...job,richContextRecoveryV66:false,failureCategory:'temporary_source_failure'},now),false);
 const M=require('../editorial-desk-model');
 assert.ok(M.publicationIssues({articleKind:'announcement',primaryAuthority:'club_decision',
 sources:[{url:'https://peczwolle.nl/nieuws/aanstelling'}],verifiedFacts:['een','twee','drie','vier'],
 draft:{headline:'Te korte kop',standfirst:'Ook te kort',body:['een']}}).length>0);
});


test('primary source extraction aligns paraphrases to exact cited sentences without inventing facts',()=>{
 const {alignPrimaryLiteralFacts,validateEvidence}=require('../scripts/automatic-publication');
 const source='PEC Zwolle heeft Alex Pastoor aangesteld als nieuwe hoofdtrainer. Hij staat vanaf maandag voor de groep en heeft een contract tot de zomer van 2027. Dennis van der Ree en Maikel van der Werff keren terug als assistent-trainers.';
 const doc={url:'https://peczwolle.nl/nieuws/alex-pastoor-nieuwe-hoofdtrainer-pec-zwolle',
 title:'Alex Pastoor nieuwe hoofdtrainer PEC Zwolle',text:source,publishedAt:'2026-11-07T10:14:00+01:00'};
 const input={kind:'announcement',primaryAuthority:'club_decision',sharedEventEvidence:[],facts:[
 {text:'PEC Zwolle heeft Alex Pastoor als hoofdtrainer benoemd.',evidence:[{source:0,quote:source}]},
 {text:'De overeenkomst loopt bij Zwolle tot de zomer van 2027.',evidence:[{source:0,quote:source}]}
 ]};
 const result=alignPrimaryLiteralFacts(input);
 assert.equal(result.facts.length,2);
 for(const f of result.facts)assert.ok(source.includes(f.text));
 assert.deepEqual(validateEvidence(result,[doc],Date.parse('2026-11-08T10:00:00Z')),[]);
});
test('primary literal alignment never accepts numbers or passages outside cited official evidence',()=>{
 const {alignPrimaryLiteralFacts}=require('../scripts/automatic-publication');
 const source='PEC Zwolle heeft Alex Pastoor als hoofdtrainer aangesteld en meldt een contract tot 2027.';
 const bad={facts:[{text:'PEC Zwolle verlengt het contract met Alex Pastoor tot 2030.',evidence:[{source:0,quote:source}]}]};
 const aligned=alignPrimaryLiteralFacts(bad);
 assert.equal(aligned.facts[0].text,bad.facts[0].text);
 assert.ok(!source.includes(aligned.facts[0].text));
});

test('official extraction emits only literal evidence when the model paraphrases',async()=>{
 const {extractCandidate}=require('../scripts/automatic-publication');
 const doc={url:'https://peczwolle.nl/nieuws/alex-pastoor-nieuwe-hoofdtrainer-pec-zwolle',
  title:'Alex Pastoor nieuwe hoofdtrainer PEC Zwolle',publishedAt:'2026-11-07T10:14:00+01:00',
  text:'PEC Zwolle heeft Alex Pastoor als nieuwe hoofdtrainer aangesteld. De ervaren coach begint op maandag bij de club.'};
 let calls=0;
 const candidate=await extractCandidate([doc],{key:'test',model:'test',fetcher:async()=>{
  calls++;return Response.json({choices:[{message:{content:JSON.stringify({
   kind:'announcement',topic:'Veldio: clubbesluit',
   facts:[{text:'PEC Zwolle benoemt Alex Pastoor tot nieuwe hoofdtrainer.',
     evidence:[{source:0,fragment:0}]}]
  })}}]});
 }},Date.parse('2026-11-08T10:00:00Z'));
 assert.equal(calls,1);
 assert.equal(candidate.topic,doc.title);
 assert.ok(doc.text.includes(candidate.facts[0].text));
});

test('only the exact previously failed literal primary evidence job retries once after V67',()=>{
 const {recoverLiteralEvidenceRejection}=require('../scripts/automatic-publication');
 const hash=require('node:crypto').createHash('sha256').update('Primaire feittekst staat niet letterlijk in de aangewezen bronpassage.').digest('hex');
 const job={status:'review',failureStage:'verification',failureCategory:'journalistic_rejection',errorHash:hash,attempts:2};
 assert.equal(recoverLiteralEvidenceRejection(job,now),true);
 assert.equal(job.status,'pending');assert.equal(job.attempts,0);
 job.status='review';assert.equal(recoverLiteralEvidenceRejection(job,now),false);
 assert.equal(recoverLiteralEvidenceRejection({...job,literalEvidenceRecoveryV67:false,errorHash:'wrong'},now),false);
 assert.equal(recoverLiteralEvidenceRejection({...job,literalEvidenceRecoveryV67:false,failureStage:'quality'},now),false);
});

test('official coach announcement is grounded directly in literal club sentences rather than an AI skip',()=>{
 const {verifiedOfficialCoachDecision,validateEvidence}=require('../scripts/automatic-publication');
 const doc={url:'https://peczwolle.nl/nieuws/alex-pastoor-nieuwe-hoofdtrainer-pec-zwolle',
 title:'Alex Pastoor nieuwe hoofdtrainer PEC Zwolle',publishedAt:'2026-11-07T10:14:00+01:00',
 text:'PEC Zwolle heeft Alex Pastoor als nieuwe hoofdtrainer aangesteld. De ervaren oefenmeester staat vanaf maandag voor de groep en tekent een contract tot de zomer van 2027 in Zwolle. In 2024 besloot Pastoor voorlopig te stoppen als hoofdtrainer. In 2025 was hij assistent-bondscoach van Indonesië. Dennis van der Ree en Maikel van der Werff keren terug als assistent-trainers. Samen met keeperstrainer Diederik Boer assisteren zij Pastoor.'};
 const candidate=verifiedOfficialCoachDecision(doc);
 assert.equal(candidate.kind,'announcement');
 assert.equal(candidate.primaryAuthority,'club_decision');
 assert.ok(candidate.facts.length>=4);
 assert.equal(candidate.topic,doc.title);
 for(const fact of candidate.facts){assert.ok(doc.text.includes(fact.text));assert.equal(fact.evidence[0].quote,fact.text);}
 assert.deepEqual(validateEvidence(candidate,[doc],Date.parse('2026-11-08T10:00:00Z')),[]);
});
test('deterministic official-decision route excludes rumours, previews and transfers',()=>{
 const {verifiedOfficialCoachDecision}=require('../scripts/automatic-publication');
 const text='De club heeft een nieuwe hoofdtrainer aangesteld en bevestigt het besluit per direct. De assistent neemt de leiding over.';
 for(const title of ['Gerucht nieuwe hoofdtrainer PEC Zwolle','Vooruitblik nieuwe trainer PEC Zwolle','Transfer van nieuwe trainer PEC Zwolle','Nieuwsbrief over voetbal']){
  assert.equal(verifiedOfficialCoachDecision({url:'https://peczwolle.nl/nieuws/test',title,text}),null);
 }
});
test('previously skipped verified coaching decision gets exactly one strict new assessment',()=>{
 const {recoverOfficialCoachDecision}=require('../scripts/automatic-publication');
 const job={status:'review',failureStage:'verification',failureCategory:'journalistic_rejection',reason:'insufficient_verified_facts',attempts:1};
 assert.equal(recoverOfficialCoachDecision(job,now),true);
 assert.equal(job.status,'pending');
 job.status='review';
 assert.equal(recoverOfficialCoachDecision(job,now),false);
 assert.equal(recoverOfficialCoachDecision({...job,officialCoachRecoveryV69:false,failureStage:'quality'},now),false);
});


test('verified coaching article writer receives a distinct source-grounded storyline',async()=>{
 const {createEditorialDraft}=require('../editorial-ai');
 let request;
 await assert.rejects(createEditorialDraft({
  topic:'Alex Pastoor nieuwe hoofdtrainer PEC Zwolle',category:'clubnieuws',primaryAuthority:'club_decision',
  facts:['PEC Zwolle stelt Alex Pastoor als nieuwe hoofdtrainer aan.','De overeenkomst duurt tot de zomer van 2027.',
  'Dennis van der Ree en Maikel van der Werff hadden vijf wedstrijden tijdelijk de leiding.',
  'De club meldt dat het duo als assistent terugkeert.'],sourceUrls:['https://peczwolle.nl/nieuws/nieuw']
 },{apiKey:'test',model:'test',fetcher:async(_,opts)=>{request=JSON.parse(opts.body);return Response.json({choices:[{message:{content:'{"skip":true}'}}]});}}),/Onvoldoende gecontroleerde feiten/);
 assert.match(request.messages[0].content,/interim-leiding/);
 assert.match(request.messages[0].content,/tijdelijk assistent/);
});
test('new coaching-storyline review is bounded and never overrides verification errors',()=>{
 const {recoverCoachStoryline}=require('../scripts/automatic-publication');
 const job={status:'review',failureStage:'quality',failureCategory:'journalistic_rejection',attempts:1};
 assert.equal(recoverCoachStoryline(job,now),true);
 job.status='review';
 assert.equal(recoverCoachStoryline(job,now),false);
 assert.equal(recoverCoachStoryline({...job,coachStoryRecoveryV70:false,failureStage:'verification'},now),false);
});

test('verified assistant-pair overlap repair also works on full three-paragraph articles',()=>{
 const {reframeVerifiedStaffPair,overlapPhrases}=require('../scripts/automatic-publication');
 const copied='Dennis van der Ree en Maikel van der Werff, die de afgelopen vijf wedstrijden tijdelijk de leiding hadden overgenomen, keren weer terug in hun functie van assistent-trainer.';
 const doc={text:'PEC Zwolle bevestigt Alex Pastoor als nieuwe hoofdtrainer. '+copied};
 const draft={headline:'PEC Zwolle benoemt nieuwe hoofdtrainer voor het komende seizoen',
 standfirst:'De club bevestigt de trainersbenoeming en de gewijzigde staf.',
 body:['De nieuwe trainer begint maandag en tekent tot de zomer van 2027.',
 'Pastoor werkte na een tijdelijke onderbreking in 2025 als assistent-bondscoach in Indonesië.',
 'Dennis van der Ree en Maikel van der Werff, die de afgelopen vijf wedstrijden tijdelijk de leiding hadden, keren terug naar hun functie als assistent-trainer.']};
 assert.ok(overlapPhrases(doc.text,draft).length);
 const result=reframeVerifiedStaffPair(draft,[copied],[doc]);
 assert.equal(result.body.length,3);
 assert.equal(result.body[0],draft.body[0]);
 assert.equal(result.body[1],draft.body[1]);
 assert.match(result.body[2],/^Maikel van der Werff en Dennis van der Ree, die de afgelopen vijf wedstrijden tijdelijk de leiding hadden/);
 assert.deepEqual(overlapPhrases(doc.text,result),[]);
});
test('full-story anti-copy retry is bounded and excludes other failures',()=>{
 const {recoverFullStoryOverlap}=require('../scripts/automatic-publication');
 const job={status:'review',failureStage:'quality',failureCategory:'journalistic_rejection',attempts:1};
 assert.equal(recoverFullStoryOverlap(job,now),true);
 job.status='review';assert.equal(recoverFullStoryOverlap(job,now),false);
 assert.equal(recoverFullStoryOverlap({...job,fullStoryOverlapV71:false,failureStage:'verification'},now),false);
});

test('full-length verified staff paraphrase keeps its news context and passes source-overlap gate',()=>{
 const {reframeVerifiedStaffPair,overlapPhrases}=require('../scripts/automatic-publication');
 const evidence='Dennis van der Ree en Maikel van der Werff, die de afgelopen vijf wedstrijden tijdelijk de leiding hadden overgenomen, keren weer terug in hun functie van assistent-trainer.';
 const paragraph='Dennis van der Ree en Maikel van der Werff, die de afgelopen vijf wedstrijden tijdelijk de leiding hadden, keren terug naar hun functie als assistent-trainers. Samen met keeperstrainer Diederik Boer vormen zij de nieuwe staf rondom Pastoor.';
 const original={headline:'PEC Zwolle heeft een nieuwe technische staf aangesteld',standfirst:'De club wijzigt de taakverdeling van haar technische staf.',body:[paragraph]};
 const rewritten=reframeVerifiedStaffPair(original,[evidence],[{text:evidence}]);
 assert.ok(rewritten.body[0].startsWith('Maikel van der Werff en Dennis van der Ree,'));
 assert.ok(rewritten.body[0].includes('Samen met keeperstrainer Diederik Boer'));
 assert.ok(rewritten.body[0].split(' ').length>=18);
 assert.deepEqual(overlapPhrases(evidence,rewritten),[]);
});

test('V73 editorial rewrite cannot copy original publisher prose from its input',async()=>{
 const {reviseDraft}=require('../scripts/automatic-publication');
 let req;
 const verified='PEC Zwolle heeft Alex Pastoor als nieuwe hoofdtrainer aangesteld.';
 const result=await reviseDraft({draft:{headline:'Oud nieuwsbericht',standfirst:'Oude zin',body:['Oude alinea.']},verifiedFacts:[verified],articleKind:'announcement',
 primaryAuthority:'club_decision',sources:[{url:'https://peczwolle.nl/nieuws/aanstelling'}]},
 {kind:'announcement',topic:'Trainer bevestigd',primaryAuthority:'club_decision',facts:[{text:verified}]},
 [{url:'https://peczwolle.nl/nieuws/aanstelling',title:'Officiële benoeming',publishedAt:'2026-11-07',text:'NIET-OVERNEMEN-OFFICIELE-ARTIKELTEKST'}],
 'Woordelijke bronoverlap', {key:'test',model:'test',fetcher:async(_,options)=>{
  req=JSON.parse(options.body).messages;return Response.json({choices:[{message:{content:'{"skip":true}'}}]});
 }});
 assert.equal(result,null);
 assert.ok(req[0].content.includes('nieuw, origineel Nederlands voetbalartikel'));
 const input=JSON.parse(req[1].content);
 assert.deepEqual(input.verifiedFacts,[verified]);
 assert.equal(JSON.stringify(input).includes('NIET-OVERNEMEN-OFFICIELE-ARTIKELTEKST'),false);
 assert.equal(input.candidate.facts,undefined);
 assert.equal(input.sources[0].text,undefined);
});

test('V73 source-independent originality retry only reopens the specific quality rejection once',()=>{
 const {recoverIndependentOriginalityV73}=require('../scripts/automatic-publication');
 const rejected={status:'review',failureStage:'quality',failureCategory:'journalistic_rejection',
 errorHash:'f66458e0fb2a084b84873fb367bd0bb682661f6224030ced0c7a4496dd110b4f',attempts:2};
 const job={...rejected};
 assert.equal(recoverIndependentOriginalityV73(job,now),true);
 assert.equal(job.status,'pending');assert.equal(job.attempts,0);
 job.status='review';
 assert.equal(recoverIndependentOriginalityV73(job,now),false);
 assert.equal(recoverIndependentOriginalityV73({...rejected,errorHash:'other'},now),false);
 assert.equal(recoverIndependentOriginalityV73({...rejected,failureStage:'verification'},now),false);
});


test('V74 fact-verified official decision and assistants are phrased without literal source overlap',()=>{
 const {reframeVerifiedClubDecision,overlapPhrases}=require('../scripts/automatic-publication');
 const lead='PEC Zwolle heeft Alex Pastoor als nieuwe hoofdtrainer aangesteld.';
 const duo='Dennis van der Ree en Maikel van der Werff, die de afgelopen vijf wedstrijden tijdelijk de leiding hadden overgenomen, keren weer terug in hun functie van assistent-trainer.';
 const doc={text:lead+' De 60-jarige ervaren oefenmeester staat vanaf maandag voor de groep en tekent een contract tot de zomer van 2027 in Zwolle. '+duo};
 const draft={headline:'PEC Zwolle krijgt in Alex Pastoor een nieuwe hoofdtrainer',
 standfirst:'De club laat weten dat de trainer maandag begint met zijn nieuwe werkzaamheden.',
 body:[lead+' De 60-jarige trainer begint maandag bij de club en zijn contract loopt tot de zomer van 2027.',
  'De trainerswissel volgt op een periode van tijdelijke leiding in Zwolle. '+duo+' Zij werken straks samen met keeperstrainer Diederik Boer.']};
 const fixed=reframeVerifiedClubDecision(draft,[lead,duo],[doc],overlapPhrases);
 assert.notDeepEqual(fixed,draft);
 assert.ok(fixed.body[0].includes('Alex Pastoor is benoemd tot hoofdtrainer van PEC Zwolle.'));
 assert.ok(fixed.body[1].includes('Maikel van der Werff en Dennis van der Ree'));
 assert.ok(fixed.body[1].includes('Diederik Boer'));
 assert.equal(overlapPhrases(doc.text,fixed).length,0);
});
test('V74 refuses unsourced semantic edits and does not weaken rejection',()=>{
 const {reframeVerifiedClubDecision,overlapPhrases}=require('../scripts/automatic-publication');
 const doc={text:'PEC Zwolle heeft Alex Pastoor als nieuwe hoofdtrainer aangesteld. De assistenten ondersteunen de nieuwe coach.'};
 const draft={headline:'PEC Zwolle benoemt een nieuwe hoofdtrainer bij de club',
 standfirst:'De trainer wordt binnenkort aangesteld als hoofdcoach van de vereniging.',
 body:['PEC Zwolle heeft Alex Pastoor als nieuwe hoofdtrainer aangesteld. De assistenten ondersteunen de nieuwe coach. De nieuwe trainer neemt zijn taken bij de club op zich.']};
 const unchanged=reframeVerifiedClubDecision(draft,[],[doc],overlapPhrases);
 assert.deepEqual(unchanged,draft);
 const fact='PEC Zwolle heeft Alex Pastoor als nieuwe hoofdtrainer aangesteld.';
 const fixed=reframeVerifiedClubDecision(draft,[fact],[doc],overlapPhrases);
 assert.notDeepEqual(fixed,draft);
 assert.equal(fixed.body[0].includes('is benoemd tot hoofdtrainer'),true);
});

test('V74 bounds fresh full review for verified phrase rewrite to one try',()=>{
 const {recoverVerifiedPhraseRewriteV74}=require('../scripts/automatic-publication');
 const job={status:'review',failureStage:'quality',failureCategory:'journalistic_rejection',attempts:2};
 assert.equal(recoverVerifiedPhraseRewriteV74(job,now),true);
 assert.equal(job.status,'pending');assert.equal(job.attempts,0);
 job.status='review';assert.equal(recoverVerifiedPhraseRewriteV74(job,now),false);
 assert.equal(recoverVerifiedPhraseRewriteV74({...job,verifiedPhraseRewriteV74:false,failureStage:'verification'},now),false);
});

test('V88 literal primary quotes supply two attributed views without becoming objective facts',()=>{
 const {verifiedOfficialCoachDecision,validateEvidence}=require('../scripts/automatic-publication');
 const text=[
  'PEC Zwolle heeft Alex Pastoor als nieuwe hoofdtrainer aangesteld.',
  'De trainer begint maandag en heeft een contract tot 2027.',
  'Pastoor werkte in 2025 buiten Nederland als trainer.',
  'Alex Pastoor: ,,De gesprekken waren prettig en ik wil graag samen met de ploeg werken aan goede resultaten.”',
  'Technisch directeur Gerry Hamstra licht de komst toe: ,,We hebben meerdere opties bekeken en zijn enthousiast over deze trainer.”',
  'Dennis van der Ree keert terug als assistent-trainer.'
 ].join(' ');
 const doc={title:'Alex Pastoor nieuwe hoofdtrainer PEC Zwolle',url:'https://peczwolle.nl/nieuws/alex-pastoor-nieuwe-hoofdtrainer-pec-zwolle',text,publishedAt:'2026-11-08T08:00:00Z'};
 const candidate=verifiedOfficialCoachDecision(doc);
 assert.ok(candidate);
 const facts=candidate.facts.map(f=>f.text);
 assert.ok(facts.some(f=>f.includes('Alex Pastoor: ,,')&&f.includes('gesprekken waren prettig')));
 assert.ok(facts.some(f=>f.includes('Gerry Hamstra')&&f.includes('meerdere opties bekeken')));
 assert.ok(facts.every(f=>text.includes(f)&&f.length<=800));
 assert.deepEqual(validateEvidence(candidate,[doc],Date.parse('2026-11-08T12:00:00Z')),[]);
 assert.equal(verifiedOfficialCoachDecision({...doc,title:'Gerucht over mogelijke trainer'}),null);
});
test('V88 official quote review never reopens prior quality failures more than once',()=>{
 const {recoverOfficialStatementsV88}=require('../scripts/automatic-publication');
 const sample={status:'review',failureStage:'quality',failureCategory:'journalistic_rejection',attempts:2};
 const job={...sample};
 assert.equal(recoverOfficialStatementsV88(job,Date.now()),true);
 assert.equal(job.status,'pending');assert.equal(job.attempts,0);
 job.status='review';
 assert.equal(recoverOfficialStatementsV88(job,Date.now()),false);
 for(const overrides of [{failureStage:'verification'},{failureStage:'generation'},{failureCategory:'generator_failure'},{status:'published'}])
  assert.equal(recoverOfficialStatementsV88({...sample,...overrides},Date.now()),false);
});

test('V89 official coach evidence selection preserves staff, keeper and both career dates before quotes',()=>{
 const {verifiedOfficialCoachDecision}=require('../scripts/automatic-publication');
 const text=[
  'PEC Zwolle heeft Alex Pastoor als nieuwe hoofdtrainer aangesteld.',
  'Hij tekent een contract tot de zomer van 2027.',
  'In 2024 besloot Pastoor te stoppen met werken als hoofdtrainer.',
  'In 2025 was hij assistent-bondscoach van Indonesië.',
  'Nu keert Pastoor terug naar het hoogste niveau in Nederland.',
  'Een nieuwe rol wacht op de trainer bij zijn oude competitie.',
  'Alex Pastoor: ,,Ik heb meerdere mogelijkheden besproken en wil nu graag aan de slag in Zwolle.”',
  'Technisch directeur Gerry Hamstra: ,,De trainer heeft veel ervaring en wij hebben samen voor de samenwerking gekozen.”',
  'Pastoor staat vanaf maandag voor de groep in Zwolle.',
  'Dennis van der Ree en Maikel van der Werff, die tijdelijk de leiding hadden, keren weer terug als assistent-trainers.',
  'Samen met keeperstrainer Diederik Boer gaan zij Pastoor ondersteunen.'
 ].join(' ');
 const doc={url:'https://peczwolle.nl/nieuws/alex-pastoor-nieuwe-hoofdtrainer-pec-zwolle',title:'Alex Pastoor nieuwe hoofdtrainer PEC Zwolle',text};
 const candidate=verifiedOfficialCoachDecision(doc);
 assert.ok(candidate);
 const facts=candidate.facts.map(x=>x.text);
 assert.equal(facts.length,8);
 assert.ok(facts.some(x=>x.includes('Dennis van der Ree')&&x.includes('Maikel van der Werff')));
 assert.ok(facts.some(x=>x.includes('Diederik Boer')));
 assert.ok(facts.some(x=>x.includes('2024')));
 assert.ok(facts.some(x=>x.includes('2025')));
 assert.ok(facts.some(x=>x.includes('Alex Pastoor: ,,')&&x.includes('mogelijkheden')));
 assert.ok(facts.some(x=>x.includes('Gerry Hamstra: ,,')&&x.includes('ervaring')));
 assert.ok(facts.every(x=>doc.text.includes(x)));
});
test('V89 source coverage retry is bounded to verified quality rejection',()=>{
 const {recoverCoachCoverageV89}=require('../scripts/automatic-publication');
 const sample={status:'review',failureStage:'quality',failureCategory:'journalistic_rejection'};
 const job={...sample};
 assert.equal(recoverCoachCoverageV89(job,Date.now()),true);
 assert.equal(job.status,'pending');
 job.status='review';assert.equal(recoverCoachCoverageV89(job,Date.now()),false);
 assert.equal(recoverCoachCoverageV89({...sample,failureStage:'verification'},Date.now()),false);
 assert.equal(recoverCoachCoverageV89({...sample,failureCategory:'generator_failure'},Date.now()),false);
});

test('V90 targeted official article is read after falling out of club index and never processes other links',()=>{
 const {editorialSourceLinks,allowedUrl}=require('../scripts/automatic-publication');
 const focus='https://peczwolle.nl/nieuws/alex-pastoor-nieuwe-hoofdtrainer-pec-zwolle';
 const other='https://www.ajax.nl/artikelen/ander-artikel';
 const discovered=new Set([other]);
 assert.equal(allowedUrl(focus),true);
 assert.deepEqual(editorialSourceLinks(discovered,focus),[focus]);
 assert.deepEqual(editorialSourceLinks(discovered),[other]);
 assert.deepEqual(editorialSourceLinks(new Set(),focus),[focus]);
 assert.deepEqual(editorialSourceLinks(new Set()),[]);
});

test('V91 generator correction may retry only once and never reopen a journalistic quality rejection',()=>{
 const {recoverCompleteBodyV91}=require('../scripts/automatic-publication');
 const rejected={status:'review',failureStage:'generation',failureCategory:'generator_failure',attempts:2};
 const job={...rejected};
 assert.equal(recoverCompleteBodyV91(job,now),true);
 assert.equal(job.status,'pending');assert.equal(job.attempts,0);
 job.status='review';assert.equal(recoverCompleteBodyV91(job,now),false);
 assert.equal(recoverCompleteBodyV91({...rejected,failureStage:'quality'},now),false);
 assert.equal(recoverCompleteBodyV91({...rejected,failureCategory:'journalistic_rejection'},now),false);
});

test('V94 Groq reviewer and rewriter get high effort and remain separate from low-effort extraction',async()=>{
 const {verifyDraft,reviseDraft}=require('../scripts/automatic-publication');
 const requests=[];
 const fetcher=async(_,options)=>{
  const request=JSON.parse(options.body);requests.push(request);
  const answer=requests.length===1?
   {approved:true,issues:[],scores:{actuality:90,reliability:95,nationalValue:90,originality:90,journalism:90,diversity:90}}:
   {headline:'Officiële benoeming van een nieuwe PEC Zwolle trainer',
    standfirst:'De club bevestigt de aanstelling van een nieuwe hoofdtrainer.',
    body:['De club stelt de nieuwe hoofdtrainer aan en legt de contractafspraken vast.']};
  return Response.json({choices:[{message:{content:JSON.stringify(answer)}}]});
 };
 const doc={url:'https://peczwolle.nl/nieuws/aanstelling',title:'Nieuwe trainer',text:'PEC Zwolle benoemt een hoofdtrainer en meldt zijn contractdetails.',publishedAt:'2026-11-08T09:00:00Z'};
 const payload={draft:{headline:'PEC Zwolle benoemt een trainer',standfirst:'Een officiële aanstelling',body:['De club heeft nieuws.']},articleKind:'announcement',primaryAuthority:'club_decision',verifiedFacts:[doc.text],sources:[{url:doc.url}]};
 const options={key:'fake',model:'openai/gpt-oss-120b',fetcher};
 const review=await verifyDraft(payload,{kind:'announcement'},[doc],options,[]);
 assert.equal(review.approved,true);
 const fixed=await reviseDraft(payload,{kind:'announcement'},[doc],'Woordelijke overlap',options,[]);
 assert.ok(Array.isArray(fixed.body));
 assert.deepEqual(requests.map(x=>x.reasoning_effort),['high','high']);
 assert.deepEqual(requests.map(x=>x.max_completion_tokens),[4200,4200]);
});

test('V95 quality review scores become specific bounded revision instructions, never permission to lower the bar',()=>{
 const {editorialRewriteFeedback}=require('../scripts/automatic-publication');
 const feedback=editorialRewriteFeedback({approved:false,score:75,scores:{actuality:90,reliability:95,nationalValue:80,originality:30,journalism:70,diversity:40}});
 assert.equal(feedback.previousScore,75);
 assert.equal(feedback.dimensions.originality,30);
 assert.ok(feedback.priorities.some(p=>p.startsWith('Originaliteit:')));
 assert.ok(feedback.priorities.some(p=>p.startsWith('Variatie:')));
 assert.equal(feedback.priorities.some(p=>p.includes('verlaag')),false);
 assert.equal(editorialRewriteFeedback({approved:true,scores:{originality:100}}),null);
});
test('V95 rewrite sees quality weaknesses and verified fact plan but never raw source body',async()=>{
 const {reviseDraft,editorialRewriteFeedback}=require('../scripts/automatic-publication');
 let messages;
 const facts=['PEC Zwolle benoemt Alex Pastoor als hoofdtrainer.','Maikel van der Werff wordt assistent-trainer.','In 2025 werkte Pastoor in Indonesië.','Technisch directeur Hamstra legt de keuze uit.'];
 const feedback=editorialRewriteFeedback({approved:false,score:75,scores:{actuality:90,reliability:95,nationalValue:80,originality:30,journalism:70,diversity:40}});
 const result=await reviseDraft({draft:{headline:'Verkeerde kop',standfirst:'Een fout concept',body:['Te letterlijk.']},verifiedFacts:facts,articleKind:'announcement',primaryAuthority:'club_decision',sources:[{url:'https://peczwolle.nl/nieuws/benoeming'}]},
 {kind:'announcement',primaryAuthority:'club_decision'},[{url:'https://peczwolle.nl/nieuws/benoeming',title:'Titel',publishedAt:'2026-11-08',text:'NIET-DELEN-MET-SCHRIJVER'}],
 'Originaliteit lager dan 70.',{key:'test',model:'test-model',fetcher:async(_,options)=>{messages=JSON.parse(options.body).messages;return Response.json({choices:[{message:{content:'{"skip":true}'}}]});}},[],feedback);
 assert.equal(result,null);
 const user=JSON.parse(messages[1].content);
 assert.deepEqual(user.verifiedFacts,facts);
 assert.equal(user.reviewFeedback.dimensions.originality,30);
 assert.deepEqual(user.editorialAssignment.leadFactIds,['F1']);
 assert.equal(JSON.stringify(user).includes('NIET-DELEN-MET-SCHRIJVER'),false);
});

test('V92 fixes only uniquely verified single-character surname typos, not invented identities',()=>{
 const {repairUniqueVerifiedNameTypo}=require('../scripts/automatic-publication');
 const facts=['PEC Zwolle stelt Alex Pastoor aan als hoofdtrainer.','Dennis van der Ree en Maikel van der Werff keren terug.'];
 const draft={headline:'Alex Pastor wordt trainer bij PEC Zwolle',standfirst:'Alex Pastor gaat aan de slag.',body:['Alex Pastor krijgt de leiding.','Een onbekende Alex Pstrrr wordt niet toegevoegd.']};
 const fixed=repairUniqueVerifiedNameTypo(draft,facts);
 assert.match(fixed.headline,/Alex Pastoor/);
 assert.match(fixed.standfirst,/Alex Pastoor/);
 assert.match(fixed.body[0],/Alex Pastoor/);
 assert.match(fixed.body[1],/Alex Pstrrr/);
 assert.equal(repairUniqueVerifiedNameTypo(draft,['Alex Pastoor','Alex Pastar']).headline,draft.headline);
});

test('V96 end editor explicitly acts on factual section plan and rejected score dimensions without changing gates',async()=>{
 const {reviseDraft,editorialRewriteFeedback}=require('../scripts/automatic-publication');
 let system='',user;
 const facts=[
  'PEC Zwolle heeft Alex Pastoor als hoofdtrainer aangesteld.',
  'Dennis van der Ree en Maikel van der Werff keren als assistenten terug.',
  'In 2025 was Alex Pastoor assistent-bondscoach bij Indonesië.',
  'Gerry Hamstra licht de keuze van PEC Zwolle toe.'
 ];
 const score={approved:false,score:75,scores:{actuality:90,reliability:95,nationalValue:80,originality:30,journalism:70,diversity:40}};
 const payload={draft:{headline:'Oude kop',standfirst:'Oude standfirst',body:['Oude alinea']},verifiedFacts:facts,
  articleKind:'announcement',primaryAuthority:'club_decision',sources:[{url:'https://peczwolle.nl/nieuws/aanstelling'}]};
 await reviseDraft(payload,{kind:'announcement',primaryAuthority:'club_decision'},[{url:'https://peczwolle.nl/nieuws/aanstelling',title:'Aanstelling',publishedAt:'2026-11-08'}],
 'Redactiescore lager dan 85.',{key:'fake',model:'test-model',fetcher:async(_,options)=>{
  const messages=JSON.parse(options.body).messages;system=messages[0].content;user=JSON.parse(messages[1].content);
  return Response.json({choices:[{message:{content:'{"skip":true}'}}]});
 }},[],editorialRewriteFeedback(score));
 assert.ok(system.includes('reviewFeedback.priorities'));
 assert.ok(system.includes('editorialAssignment'));
 assert.equal(user.reviewFeedback.dimensions.originality,30);
 assert.deepEqual(user.verifiedFacts,facts);
 assert.equal(user.editorialAssignment.leadFactIds.length,1);
});

test('V98 strict 120B revision enforces schema while permitting evidence-based skip',async()=>{
 const {complete}=require('../scripts/automatic-publication');
 let request;
 const draft={skip:false,headline:'PEC Zwolle heeft nieuwe hoofdtrainer aangesteld',standfirst:'De club meldt dat een nieuwe hoofdtrainer aantreedt en de staf ondersteunt.',body:['De afspraken zijn bevestigd door PEC Zwolle en worden gecontroleerd.']};
 const received=await complete([{role:'system',content:'Geef JSON artikel.'},{role:'user',content:'Controleer de aangeleverde feiten.'}],
 {key:'TEST_KEY_DO_NOT_LEAK',model:'openai/gpt-oss-120b',fetcher:async(_,options)=>{request=JSON.parse(options.body);return Response.json({choices:[{message:{content:JSON.stringify(draft)}}]});}},'revision');
 assert.deepEqual(received,draft);
 assert.equal(request.reasoning_effort,'high');
 assert.equal(request.response_format.type,'json_schema');
 assert.equal(request.response_format.json_schema.strict,true);
 assert.ok(request.response_format.json_schema.schema.required.includes('skip'));
 assert.match(request.messages[0].content,/Bij onvoldoende bewijs/);
});
test('V98 provider 400 errors are classified without leaking the provider prompt or credentials',async()=>{
 const {complete}=require('../scripts/automatic-publication');
 const secret='TEST_KEY_DO_NOT_LEAK', source='PRIVATE_SOURCE_NOT_FOR_LOGS';
 const mock=async()=>Response.json({error:{type:'invalid_request_error',code:'json_validate_failed',param:'response_format',message:'Failed to generate JSON: '+source+' '+secret}}, {status:400});
 await assert.rejects(complete([{role:'user',content:source}],{key:secret,model:'openai/gpt-oss-120b',fetcher:mock},'revision'),e=>{
  assert.equal(e.code,'GROQ_BAD_REQUEST');
  assert.match(e.message,/oorzaak=json_generation/);
  assert.doesNotMatch(e.message,/PRIVATE_SOURCE|TEST_KEY/);
  return true;
 });
});

test('V99 GPT-OSS high JSON failure gets exactly one medium retry with the same facts and strict safety schema',async()=>{
 const {complete}=require('../scripts/automatic-publication');
 const requests=[],facts='PEC Zwolle bevestigt een hoofdtrainer en de naam Alex Pastoor.';
 const fetcher=async(_,options)=>{
  requests.push(JSON.parse(options.body));
  if(requests.length===1)return Response.json({error:{type:'invalid_request_error',code:'json_validate_failed',message:'JSON generation failed'}},{status:400});
  return Response.json({choices:[{message:{content:JSON.stringify({skip:false,headline:'PEC Zwolle stelt nieuwe hoofdtrainer aan',standfirst:'De club bevestigt de naam van de nieuwe coach.',body:['PEC Zwolle noemt Alex Pastoor als de nieuwe hoofdtrainer van de club.']})}}]});
 };
 const answer=await complete([{role:'system',content:'Geef JSON'},{role:'user',content:facts}],{key:'fake',model:'openai/gpt-oss-120b',fetcher},'revision');
 assert.equal(answer.skip,false);
 assert.deepEqual(requests.map(r=>r.reasoning_effort),['high','medium']);
 assert.ok(requests.every(r=>r.response_format?.json_schema?.strict===true));
 assert.deepEqual(requests.map(r=>r.messages[1].content),[facts,facts]);
});
test('V99 never retries unsupported provider 400 and caps repeated JSON failures at two attempts',async()=>{
 const {complete}=require('../scripts/automatic-publication');
 let calls=0;
 const bad=async()=>{calls++;return Response.json({error:{code:'bad_parameter',type:'invalid_request_error',message:'parameter not supported'}},{status:400});};
 await assert.rejects(complete([{role:'user',content:'JSON'}],{key:'fake',model:'openai/gpt-oss-120b',fetcher:bad},'review'),/code=bad_parameter/);
 assert.equal(calls,1);
 calls=0;
 const invalid=async()=>{calls++;return Response.json({error:{code:'json_validate_failed',type:'invalid_request_error',message:'JSON failure'}},{status:400});};
 await assert.rejects(complete([{role:'user',content:'JSON'}],{key:'fake',model:'openai/gpt-oss-120b',fetcher:invalid},'review'),e=>e.code==='GROQ_BAD_REQUEST'&&/oorzaak=json_generation/.test(e.message));
 assert.equal(calls,2);
});

test('V100 reopens only the recorded Groq JSON provider failure once for the focused official story',()=>{
 const {reopenVerifiedJsonFailureV100}=require('../scripts/automatic-publication');
 const url='https://peczwolle.nl/nieuws/alex-pastoor-nieuwe-hoofdtrainer-pec-zwolle';
 const hash='2c2fdf91ef88a0b461b05ad54077f20cc3305a85e54ee601e93ba9c2b463d173';
 const original={urls:[url],status:'review',attempts:1,nextAttemptAt:99999999,failureStage:'quality',
  failureCategory:'journalistic_rejection',errorHash:hash};
 const now=Date.now();
 const job={...original};
 assert.equal(reopenVerifiedJsonFailureV100(job,now,url),true);
 assert.equal(job.status,'pending');
 assert.equal(job.attempts,0);
 assert.equal(job.nextAttemptAt,now);
 assert.equal(job.jsonFailureRecoveryV100,true);
 job.status='review';
 assert.equal(reopenVerifiedJsonFailureV100(job,now,url),false);
 for(const diff of [
  {errorHash:'other'},{failureCategory:'generator_failure'},{failureStage:'verification'},
  {urls:['https://ajax.nl/artikelen/anders']},{status:'published'},
  {jsonFailureRecoveryV100:true}])assert.equal(reopenVerifiedJsonFailureV100({...original,...diff},now,url),false);
 assert.equal(reopenVerifiedJsonFailureV100({...original},now,'https://ajax.nl/artikelen/andere'),false);
});

test('V102 rewriting editor gets verified source label and no raw publisher article',async()=>{
 const {reviseDraft}=require('../scripts/automatic-publication');
 const facts=['PEC Zwolle benoemt Alex Pastoor als hoofdtrainer.','De assistenten keren terug bij de club.','In 2025 werkte hij bij Indonesië.','De club bevestigt een contract tot 2027.'];
 let messages;
 await reviseDraft({draft:{headline:'Oude kop',standfirst:'Oude intro',body:['Oude alinea.']},articleKind:'announcement',primaryAuthority:'club_decision',verifiedFacts:facts,sources:[{url:'https://peczwolle.nl/nieuws/feit'}]},
  {kind:'announcement',primaryAuthority:'club_decision'},[{url:'https://peczwolle.nl/nieuws/feit',title:'Officiële bekendmaking',publishedAt:'2026-11-08',text:'COPYRIGHTED-NOT-PASSED-TO-WRITER'}],
  'Bronvermelding en originaliteit onvoldoende',{key:'fake',model:'test-model',fetcher:async(_,options)=>{messages=JSON.parse(options.body).messages;return Response.json({choices:[{message:{content:'{"skip":true}'}}]});}});
 const input=JSON.parse(messages[1].content);
 assert.equal(input.officialPublisher,'PEC Zwolle');
 assert.deepEqual(input.verifiedFacts,facts);
 assert.match(messages[0].content,/Bij officialPublisher moet de intro duidelijk de officiële bron noemen/);
 assert.equal(JSON.stringify(input).includes('COPYRIGHTED-NOT-PASSED-TO-WRITER'),false);
});

test('V103 independent revision never sees rejected hallucinated draft or whole source page',async()=>{
 const {reviseDraft}=require('../scripts/automatic-publication');
 let messages;
 const facts=['PEC Zwolle heeft een hoofdtrainer benoemd.','De assistenten keren terug.','In 2025 had hij een buitenlandse functie.','Alex Pastoor: ,,Ik zie mijn rol bij PEC Zwolle als een mooie uitdaging.”'];
 const draft={headline:'AFGEKEURDE-VERZONNEN-KOP',standfirst:'Het contract garandeert stabiliteit.',body:['AFGEKEURD-VERZONNEN-DETAIL-VISIE']};
 const result=await reviseDraft({draft,articleKind:'announcement',primaryAuthority:'club_decision',verifiedFacts:facts,sources:[{url:'https://peczwolle.nl/nieuws/besluit'}]},
 {kind:'announcement',topic:'PEC Zwolle benoemt hoofdtrainer',primaryAuthority:'club_decision'},
 [{url:'https://peczwolle.nl/nieuws/besluit',title:'Officiële mededeling',publishedAt:'2026-11-08',text:'ORIGINELE-BRONPAGINA-NIET-GEBRUIKEN'}],
 'Oorspronkelijke tekst onvoldoende origineel. "Dit is een letterlijk gekopieerde passage uit de originele bron".',
 {key:'test',model:'test-model',fetcher:async(_,options)=>{messages=JSON.parse(options.body).messages;return Response.json({choices:[{message:{content:'{"skip":true}'}}]});}});
 assert.equal(result,null);
 const user=JSON.parse(messages[1].content);
 assert.equal(user.draft,undefined);
 assert.equal(user.coachPlan,true);
 assert.deepEqual(user.verifiedFacts,facts);
 assert.equal(user.factRoles[3].kind,'toegeschreven_uitspraak');
 assert.equal(user.factRoles[0].kind,'gecontroleerd_bronfeit');
 assert.equal(user.rejection.includes('letterlijk gekopieerde passage'),false);
 assert.equal(JSON.stringify(user).includes('AFGEKEURD-VERZONNEN'),false);
 assert.equal(JSON.stringify(user).includes('ORIGINELE-BRONPAGINA'),false);
 assert.match(messages[0].content,/Body 1: de concrete staf-/);
});

test('V105 independent coach revision uses compact three-part facts-only briefing',async()=>{
 const {reviseDraft}=require('../scripts/automatic-publication');
 let sent;
 const facts=['PEC Zwolle meldt de aanstelling van Alex Pastoor.','De club zegt dat de staf verandert.','Pastoor werkte eerder in Indonesië.','Gerry Hamstra geeft een toegeschreven mening over de coach.'];
 await reviseDraft({draft:{headline:'OUDE-FOUT',standfirst:'Oude fout',body:['Verzonnen conclusie.']},verifiedFacts:facts,articleKind:'announcement',primaryAuthority:'club_decision',sources:[{url:'https://peczwolle.nl/nieuws/benoeming'}]},
 {kind:'announcement',topic:'Alex Pastoor nieuwe hoofdtrainer PEC Zwolle',primaryAuthority:'club_decision'},
 [{url:'https://peczwolle.nl/nieuws/benoeming',title:'Officiële bekendmaking',publishedAt:'2026-11-08'}],
 'Originaliteit te laag.',{key:'fake',model:'test-model',fetcher:async(_,options)=>{
  sent=JSON.parse(options.body).messages;return Response.json({choices:[{message:{content:'{"skip":true}'}}]});
 }});
 assert.ok(sent[0].content.length<2600);
 assert.match(sent[0].content,/Het vorige concept is bewust weggelaten/);
 assert.match(sent[0].content,/Body 1: de concrete staf-/);
 assert.equal(JSON.parse(sent[1].content).draft,undefined);
});
