'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {allowedUrl,plain,extractPage,discoverLinks,validateEvidence,duplicate,overlap,compactSource,pacedGroq,selectModel,run}=require('../scripts/automatic-publication');
const now=Date.parse('2026-10-30T12:00:00Z');
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
});
test('discovery cannot leave the exact configured official site or article path',()=>{
 const index={url:'https://www.ajax.nl/artikelen/',articlePath:'^/artikelen/[^/]+/?$'};
 assert.deepEqual(discoverLinks('<a href="/artikelen/nieuws">A</a><a href="https://evil.example/artikelen/x">B</a><a href="/fans/test">C</a><a href="/artikelen/nieuws#x">D</a>',index),['https://www.ajax.nl/artikelen/nieuws']);
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
