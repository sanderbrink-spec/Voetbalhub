'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {describe,plan,nextActions}=require('../editorial-autonomous120');
const now=Date.parse('2026-11-25T20:00:00Z');
const news=(title,age=1)=>[{title,url:'https://www.uefa.com/news/test',publishedAt:new Date(now-age*3600000).toISOString()}];
const match=(title,category,age=1,facts=5)=>Object.assign(news(title,age),{matchRecord:{topic:title,category,publishedAt:new Date(now-age*3600000).toISOString(),verifiedFacts:Array(facts).fill('fact')}});
const job=group=>({group,job:{status:'pending'}});
test('120I fresh European coverage outranks old domestic checkpoints',()=>{
 const a=job(match('Brentford – Everton','Premier League',40,8)),b=job(match('PSV – Arsenal','Champions League',1,5));
 assert.equal(plan([a,b],now,j=>j===a.job?2:0).runnable[0],b);
});
test('120I imminent verified preview is urgent, expired preview is not',()=>{
 const a=Object.assign(news('PSV – Arsenal',3),{clubPreview:{kickoff:now+3600000}});
 const b=Object.assign(news('PSV – Arsenal',3),{clubPreview:{kickoff:now-3600000}});
 assert.equal(describe(a,now).reason,'imminent_verified_preview');
 assert.notEqual(describe(b,now).reason,'imminent_verified_preview');
});
test('120I high-impact news receives a slot without creating any jobs',()=>{
 const items=Array.from({length:8},(_,i)=>job(match('PSV – club '+i,'Champions League',1)));
 const n=job(news('Ajax benoemd nieuwe trainer',1));
 const p=plan([...items,n],now);
 assert.equal(p.runnable[5],n);
 assert.equal(new Set(p.runnable).size,9);
 assert.equal(p.runnable.length,9);
});
test('120I source and quality actions remain diagnostic, not approvals',()=>{
 const a=nextActions({sources:{europaleague:{status:'unavailable'}},counts:{queued:2,generated:2,approved:1,stored:0,published:0},queue:{awaitingApprovedArtwork:1}});
 assert.deepEqual(a.map(x=>x.kind),['source_recovery','rights_cleared_artwork','editorial_quality_review','storage_or_artwork_check']);
 assert.equal(a.some(x=>x.approved||x.publicationAllowed),false);
});
test('120I no runnable dossiers triggers new evidence research',()=>{
 assert.equal(nextActions({counts:{queued:0}}).at(-1).kind,'fresh_evidence_search');
});
