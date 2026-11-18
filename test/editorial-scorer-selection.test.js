'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {run,nationallyRelevant}=require('../scripts/automatic-publication');
const config=require('../automatic-editorial.json');

const groningen='https://www.fcgroningen.nl/nieuws/';
const ajax='https://www.ajax.nl/';
const psv='https://www.psv.nl/media';
const publishedAt='2026-11-18T09:14:52+00:00';
const now=Date.parse('2026-11-18T12:00:00Z');
const official={url:groningen+'internationals-onderweg-naar-groningen-topscorers-ook-voor-hun-land-trefzeker/',
 title:'Internationals onderweg naar Groningen, topscorers ook voor hun land trefzeker',
 text:'De topschutters van de Trots van het Noorden – Brynjolfur Willumsson en Thom van Bergen – waren ook internationaal trefzeker.'};

async function round(pages,discoveryOnly=false,providerRouter){
 const fetcher=async(url,options={})=>{
  if(url.includes('/articles?'))return Response.json({articles:[]});
  if(url.includes('editorial-queue45.json'))return options.method==='PUT'?Response.json({content:{sha:'test'}}):new Response(null,{status:404});
  const index=config.newsIndexes.find(index=>index.url===url);
  if(index){
   const urls=pages.filter(doc=>new URL(doc.url).hostname===new URL(index.url).hostname);
   return new Response('<main>'+urls.map(doc=>'<a href="'+doc.url+'">Nieuws</a>').join('')+'</main>');
  }
  const page=pages.find(doc=>doc.url===url);
  if(page)return new Response('<article><h1>'+page.title+'</h1><time datetime="'+publishedAt+'"></time><p>'+page.text+'</p><p>'+'Verdere toelichting van de club. '.repeat(9)+'</p></article>');
  return new Response(null,{status:404});
 };
 return run({secret:'test',groqKey:'test',githubToken:'test',expectedRevision:null,now,fetcher,discoveryOnly,providerRouter});
}

test('internationals reach the production verification gate with names and provenance, ticket sales do not',async()=>{
 const ticket={...official,url:groningen+'kaartverkoopinformatie-telstar-uit/',title:'Kaartverkoopinformatie Telstar-uit'};
 const report=await round([official,ticket]);
 assert.equal(report.signals.find(s=>s.url===ticket.url).outcome,'no_national_relevance');
 const check=report.signals.find(s=>s.outcome==='international_scorer_evidence_check');
 assert.deepEqual(check.sources,[{url:official.url,publishedAt}]);
 assert.deepEqual(check.persons,['Brynjolfur Willumsson','Thom van Bergen']);
 assert.equal(check.event,'international_goals');
 assert.equal(check.stage,'verification');
 assert.equal(report.counts.uniqueGroups,1);
 assert.equal(report.counts.evidenceChecks,1);
 assert.match(report.skipped[0].reason,/onafhankelijke/);
 assert.equal(report.counts.aiRequests,0);
 assert.equal(report.counts.published,0);
});

test('different official reports on the same scorer and opponent form one topic; other opponents stay separate',async()=>{
 const base={url:ajax+'artikelen/interlands',title:'Interlands op een rij',text:'In de interland scoorde niemand voor rust. Jan Jansen scoorde tegen Finland.'};
 const partner={url:psv+'/artikel/de-internationals',title:'Internationals in actie',text:'Jan Jansen was trefzeker tegen Finland na een uur spelen.'};
 const different={...base,url:ajax+'artikelen/ander-duel',text:'In deze interland scoorde Jan Jansen na rust. Jan Jansen scoorde tegen Zweden.'};
 const report=await round([base,partner,different],true);
 const sources=report.availableTopics.map(g=>g.sources.map(s=>s.url).sort());
 assert.equal(report.counts.uniqueGroups,2);
 assert.ok(sources.some(urls=>JSON.stringify(urls)===JSON.stringify([base.url,partner.url].sort())));
 assert.ok(sources.some(urls=>urls.length===1&&urls[0]===different.url));
});

test('two independent sources reach extraction together and still need sufficient literal facts',async()=>{
 const seen=[];
 const router={trace:[],configured:()=>[{enabled:true}],complete:async messages=>{
  seen.push(JSON.parse(messages[1].content).sources);
  return {skip:true};
 }};
 const partner={...official,url:ajax+'artikelen/internationals-in-actie'};
 const report=await round([official,partner],false,router);
 assert.equal(report.counts.uniqueGroups,1);
 assert.equal(report.counts.evidenceChecks,1);
 assert.deepEqual(seen[0].map(source=>source.url).sort(),[official.url,partner.url].sort());
 assert.ok(seen[0].every(source=>source.fragments.some(f=>f.text.includes('Thom van Bergen'))));
 assert.equal(report.skipped[0].stage,'verification');
 assert.equal(report.counts.published,0);
});

test('two pages from one publisher never provide independent confirmation',async()=>{
 const report=await round([official,{...official,url:groningen+'tweede-bericht/'}]);
 assert.equal(report.counts.uniqueGroups,1);
 assert.equal(report.signals.find(s=>s.stage==='verification').sources.length,2);
 assert.match(report.skipped[0].reason,/onafhankelijke/);
 assert.equal(report.counts.selected,0);
});

test('a call-up or an explicitly denied goal alone is insufficient',()=>{
 for(const text of ['Jan Jansen is opgeroepen voor zijn land.','Jan Jansen scoorde niet tegen Finland.']){
  assert.equal(nationallyRelevant({...official,title:'Internationals op pad',text}),false);
 }
});

test('a scorer roundup can suggest a separate, organiser-confirmed promotion without player claims',()=>{
 const {promotionFromRoundup,validateEvidence}=require('../scripts/automatic-publication');
 const club={...official,publishedAt,text:official.text+' IJsland promoveerde in de Nations League.'};
 const table='Group C4 Iceland (14pts), Estonia (12), Bulgaria (4), Luxembourg (3)';
 const decision='Iceland are confirmed in first place and will be promoted to League B.';
 const uefa={url:'https://www.uefa.com/uefanationsleague/news/02ab-2209792f2fda-6a523d4500bb-1000--2026-27-nations-league-quarter-final-qualification-promotion/',publishedAt,
  title:'Nations League qualification, promotion and play-offs',text:[table,decision,
   'Estonia are confirmed in second place and will enter the League B/C play-offs.',
   'Bulgaria are confirmed in third place and will remain in League C.',
   'Luxembourg are confirmed in fourth place and will remain in League C.'].join(' ')};
 const result=promotionFromRoundup(club,uefa,now);
 assert.equal(result.topic,'IJsland promoveert in de Nations League');
 assert.deepEqual(validateEvidence(result,[uefa],now),[]);
 assert.equal(result.facts.length,5);
 assert.ok(result.facts.every(f=>uefa.text.includes(f.text)));
 assert.doesNotMatch(JSON.stringify(result),/Willumsson|Van Bergen|trefzeker/i);
 for(const other of [{...uefa,text:uefa.text.replace(decision,'Iceland could win promotion to League B.')},
  {...uefa,url:club.url},{...uefa,publishedAt:'2025-01-01'}])
  assert.equal(promotionFromRoundup(club,other,now),null);
});

test('only a fact-checked official final with a solely journalistic rejection goes to the copy editor',async()=>{
 const {reviseDraft}=require('../scripts/automatic-publication');
 const draft={headline:'Eerdere kop',standfirst:'Eerdere intro',body:['Eerdere alinea']};
 const match={homeTeam:'Duitsland',awayTeam:'Nederland',homeScore:5,awayScore:0};
 const candidate={kind:'announcement',verifiedOfficialFinal:true,match};
 const payload={draft,match,verifiedFacts:['De wedstrijd eindigde in 5-0.']};
 let input;
 const options={router:{complete:async messages=>{input=JSON.parse(messages[1].content);return {skip:true};}}};
 for(const [reliability,expected] of [[100,true],[60,false]]){
  await reviseDraft(payload,candidate,[],'Journalistieke kwaliteit lager dan 85.',options,[],
   {dimensions:{reliability,journalism:80}});
  assert.deepEqual(input.previousDraft,expected?draft:undefined);
  assert.deepEqual(input.verifiedFacts,payload.verifiedFacts);
 }
});
