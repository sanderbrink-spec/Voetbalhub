'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {candidate,matchesRegistration}=require('../editorial-match55');
const {attach,evidence}=require('../editorial-match-evidence122');
const now=Date.parse('2026-11-08T18:00:00Z');
const fixture={id:'of-nl-2026-fc-twente-ajax',competition:'eredivisie',status:'FT',
 date:'2026-11-08T13:30:00Z',round:'Speelronde 12',home:{name:'FC Twente'},away:{name:'Ajax'},
 goals:{home:2,away:2},halfTime:{home:0,away:1}};
const record=candidate(fixture,now);
const official={
 url:'https://english.ajax.nl/articles/late-equaliser-denies-ajax-victory-in-enschede/',
 title:'Late equaliser denies Ajax victory in Enschede',
 publishedAt:'2026-11-08T16:00:00Z',
 text:'Ajax were ahead for most of the match, but could not maintain the lead. '+
 'The match saw several changes in the score as confirmed by the official report. '+
 'FC Twente - Ajax 2-2 (0-1) 03. Tolu 0-1 66. Bounida 0-2 '+
 '68. Janse (o.g.) 1-2 90+5. Weghorst (pen.) 2-2. '
};
test('official scoreboard creates multiple verified scoring facts and a longform match candidate',()=>{
 const enriched=attach(record,official,now);
 assert.ok(enriched);
 assert.equal(enriched.articleKind,'match_report');
 assert.equal(enriched.verifiedFacts.length,record.verifiedFacts.length+4);
 assert.equal(enriched.sources[1].url,official.url);
 assert.equal(matchesRegistration({...enriched},[fixture],now),true);
});
test('wrong score, invalid sequence, rival source and stale story cannot enrich results',()=>{
 assert.equal(evidence(record,{...official,text:official.text.replace('2-2 (0-1)','3-2 (0-1)')},now),null);
 assert.equal(evidence(record,{...official,text:official.text.replace('66. Bounida 0-2','66. Bounida 2-0')},now),null);
 assert.equal(evidence(record,{...official,url:'https://random.example/articles/test'},now),null);
 assert.equal(evidence(record,{...official,publishedAt:'2026-10-08T16:00:00Z'},now),null);
 assert.equal(evidence(record,{...official,title:'Ajax Women - FC Twente'},now),null);
});
test('back-end registration rejects modified claims and receipts',()=>{
 const enriched=attach(record,official,now);
 assert.ok(enriched);
 const tampered={...enriched,verifiedFacts:[...enriched.verifiedFacts.slice(0,-1),'Weghorst scored twice.']};
 assert.equal(matchesRegistration(tampered,[fixture],now),false);
 assert.equal(matchesRegistration({...enriched,matchEvidence:{...enriched.matchEvidence,text:'unverified'}},[fixture],now),false);
});


test('first-party match-day date-only source can enrich a fixture without inventing a publication time',()=>{
 const enriched=attach(record,{...official,publishedAt:'2026-11-08'},now);
 assert.ok(enriched);
 assert.equal(enriched.matchEvidence.publishedAt,'2026-11-08');
 assert.equal(matchesRegistration(enriched,[fixture],now),true);
 assert.equal(attach(record,{...official,publishedAt:'2026-11-07'},now),null);
});
test('explicit English Ajax publication date is extracted from first-party article text',()=>{
 const {extractPage}=require('../scripts/automatic-publication');
 const html='<html><main class="full-article"><h1>Late equaliser denies Ajax victory in Enschede</h1>'+
 '<p>Date: 08.11.2026</p><p>Ajax and FC Twente ended with a draw. '+official.text+'</p>'+
 '<section class="full-article__related-articles"><article>Unrelated story</article></section></main></html>';
 const page=extractPage(html,official.url);
 assert.equal(page.publishedAt,'2026-11-08');
 assert.match(page.text,/Bounida/);
 assert.doesNotMatch(page.text,/Unrelated story/);
});


test('undated and invalid-date official documents are skipped instead of aborting autonomous discovery',()=>{
 for(const publishedAt of ['',null,'unparseable','2026-14-42']){
  assert.doesNotThrow(()=>evidence(record,{...official,publishedAt},now));
  assert.equal(evidence(record,{...official,publishedAt},now),null);
 }
 assert.equal(evidence(record,{...official,publishedAt:'2026-11-08'},now)?.events.length,4);
});

test('a verified interrupted attack survives receipt validation and is distinct from an awarded penalty',()=>{
 const {verifiedIncidentCoverageIssues}=require('../editorial-match-guidance133');
 const body='Following a poor pass the hosts looked set to have a big chance, but the referee blew his whistle. He was called to the monitor for a handball. The referee did not agree with the VAR and felt Ajax had committed a foul. ';
 const doc={...official,text:body+'Extra wedstrijdcontext. '.repeat(25)+official.text};
 const article=attach(record,doc,now);
 assert.ok(matchesRegistration(article,[fixture],now));
 assert.ok(article.verifiedFacts.some(f=>f.includes('kansrijke aanval')));
 const generic={body:['De VAR beoordeelde de latere strafschop.']};
 assert.ok(verifiedIncidentCoverageIssues(article,generic).some(issue=>issue.includes('interrupted_attack')));
 const inaccurate={...doc,text:doc.text.replace('had committed a foul','was playing well')};
 assert.ok(!attach(record,inaccurate,now).verifiedFacts.some(f=>f.includes('kansrijke aanval')));
});
