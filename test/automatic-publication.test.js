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
 assert.equal(selectModel({data:[{id:'openai/gpt-oss-20b'}]}),'openai/gpt-oss-20b');
 assert.throws(()=>selectModel({data:[{id:'llama-3.3-70b-versatile'}]}),/Geen beschikbaar/);
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
 const facts=['Inter benoemt Simone Lo Schiavo.','Hij wordt directeur voetbalontwikkeling.',
  'Hij trad op vijf november in dienst.','De nieuwe directeur rapporteert aan Dario Baccin.']
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
