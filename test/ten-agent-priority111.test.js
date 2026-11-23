'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const newsroom=require('../scripts/ten-agent-newsroom101');
const now=Date.parse('2026-11-19T18:30:00Z');
test('111C: ordinary multi-outlet news is researched before speculation; conflicting reports remain worthwhile',()=>{
 const groups=[
  {id:'rumour',rumour:true,contradictory:false,outlets:['vi','vp'],sources:[{publishedAt:'2026-11-19T18:20:00Z'}]},
  {id:'news',rumour:false,contradictory:false,outlets:['vi','vp'],sources:[{publishedAt:'2026-11-19T18:00:00Z'}]},
  {id:'denial',rumour:true,contradictory:true,outlets:['vi','vp'],sources:[{publishedAt:'2026-11-19T17:00:00Z'}]},
  {id:'single',rumour:false,contradictory:false,outlets:['vi'],sources:[]}
 ];
 const ranked=newsroom.prioritizeResearchGroups(groups);
 assert.deepEqual(ranked.map(g=>g.id),['news','denial','rumour','single']);
 assert.equal(newsroom.researchPriority(groups[0]),2);
 assert.equal(newsroom.researchPriority(groups[1]),4);
 assert.equal(newsroom.researchPriority(groups[2]),3);
 assert.deepEqual(groups.map(g=>g.id),['rumour','news','denial','single']);
});
test('111C: one free-budget AI slot researches substantive football news first, not a rumor',async()=>{
 const date='Thu, 19 Nov 2026 18:00:00 GMT';
 const items=source=>[
  {title:'Ajax meldt nieuwe trainer voor jeugdteam',url:source==='vi'?
   'https://www.vi.nl/nieuws/nieuws-ajax-trainer':
   'https://www.voetbalprimeur.nl/nieuws/nieuws-ajax-trainer'},
  {title:'PSV onderzoekt transfer van Kevin De Bruyne',url:source==='vi'?
   'https://www.vi.nl/nieuws/transfer-de-bruyne':
   'https://www.voetbalprimeur.nl/nieuws/transfer-de-bruyne'}
 ];
 const xml=source=>'<rss version="2.0"><channel>'+items(source).map(x=>
  '<item><title>'+x.title+'</title><link>'+x.url+'</link><pubDate>'+date+'</pubDate></item>').join('')+'</channel></rss>';
 const investigated=[];
 const fetcher=async (url,options={})=>{
  if(url.includes('api.groq.com')){
   const messages=JSON.parse(options.body).messages;
   const brief=JSON.parse(messages[1].content);
   investigated.push(brief.articles.map(x=>x.title));
   return Response.json({choices:[{message:{content:JSON.stringify({angle:'Onderzoeksvraag',questions:[],caution:'Niet bevestigd'})}}]});
  }
  return new Response(url.includes('vi.nl')?xml('vi'):url.includes('voetbalprimeur.nl')?xml('vp'):
   '<rss version="2.0"><channel></channel></rss>');
 };
 const result=await newsroom.scan({fetcher,now,apiKey:'test',runAI:true,
  state:{day:'2026-11-19',aiCallsToday:9}});
 assert.equal(result.report.aiCalls,1);
 assert.equal(result.report.aiCallsToday,10);
 assert.equal(investigated.length,1);
 assert.ok(investigated[0][0].includes('Ajax'));
 assert.equal(result.report.researchPriorityOrder[0].priority,4);
 assert.equal(result.report.researchPriorityOrder[0].independenceVerified,false);
 assert.equal(result.report.publicationAttempts,0);
 assert.equal(result.report.published,0);
 assert.ok(result.state.researchNotes.every(x=>x.publicationAllowed===false));
});
