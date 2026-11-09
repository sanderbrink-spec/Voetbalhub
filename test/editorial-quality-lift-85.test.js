'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {independentReviewRejection,reusableCheckpointPriority}=require('../scripts/automatic-publication');
const guidance=require('../editorial-match-guidance133');
const {EditorialProviderRouter,sealCheckpoint}=require('../editorial-provider-router');
const {assess}=require('../editorial-production45');

const facts=[
 'FC Twente – Ajax eindigde in 2-2.',
 'De wedstrijd werd op 8 november 2026 in de Eredivisie gespeeld.',
 'De ruststand was 1-1.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 14 een doelpunt en werd de stand 1-0.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 21 een doelpunt en werd de stand 1-1.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 70 een doelpunt en werd de stand 2-1.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 88 een doelpunt en werd de stand 2-2.'
];
const match={articleKind:'match_report',verifiedFacts:facts};
test('chronological editorial audit rejects verified goal minutes allocated to the wrong section',()=>{
 const correct={body:['De geregistreerde ruststand was 1-1.','In minuut 14 viel een doelpunt. Later werd in minuut 21 gescoord.','In minuut 70 viel een doelpunt. De registratie noemt minuut 88 voor het slotdoelpunt.']};
 assert.deepEqual(guidance.paragraphChronologyIssues(match,correct),[]);
 const bad={body:[correct.body[0], 'De voorsprong volgde in minuut 70.', 'In minuut 14 maakte de eerste ploeg zijn doelpunt.']};
 assert.equal(guidance.paragraphChronologyIssues(match,bad).length,2);
 assert.deepEqual(guidance.paragraphChronologyIssues({articleKind:'score_update',verifiedFacts:facts.slice(0,2)},bad),[]);
});
test('independent rejection issues and original scores reach the rewrite without turning into approval',()=>{
 const review={approved:false,issues:['Minuut 88 is onjuist aan de thuisclub toegeschreven.'],
  scores:{actuality:95,reliability:75,nationalValue:90,originality:80,journalism:72,diversity:95}};
 const verdict=assess({review,docs:[{publishedAt:new Date().toISOString()}]});
 assert.equal(verdict.approved,false);
 const rejection=independentReviewRejection(verdict,review);
 assert.match(rejection,/Tweede feitencontrole: Minuut 88/);
 assert.match(rejection,/Betrouwbaarheid lager dan 90/);
});
test('invalid reviewer verdict with high scores still fails closed',()=>{
 const review={approved:false,issues:[],scores:{actuality:100,reliability:100,nationalValue:100,originality:100,journalism:100,diversity:100}};
 const verdict=assess({review,docs:[{publishedAt:new Date().toISOString()}]});
 assert.equal(verdict.approved,false);
 assert.match(independentReviewRejection(verdict,review),/geen volledige goedkeuring/);
});
test('revision feedback strips control characters and bounds individual model findings',()=>{
 const report={reasons:['Redactiescore lager dan 85.']};
 const result=independentReviewRejection(report,{issues:['Te veel herhaling.\n'+'X'.repeat(500)]});
 assert.equal(result.includes('\n'),false);
 assert.ok(result.length<250);
});
test('reviewer preflight respects both provider cooldowns and local quotas without a network call',()=>{
 let now=0,fetches=0;
 const day='1970-01-01';
 const state={groq:{day,requests:1,tokens:5000,blockedUntil:10000},
  openai:{day,requests:1,tokens:5000,blockedUntil:0}};
 const router=new EditorialProviderRouter({groqKey:'g',openaiKey:'o',state,
  now:()=>now,limits:{groq:{requests:2,tokens:20000},openai:{requests:2,tokens:20000}},
  fetcher:async()=>{fetches++;throw Error('No fetch expected');}});
 assert.equal(router.hasReviewCapacity(8000),true);
 state.openai.blockedUntil=10000;
 assert.equal(router.hasReviewCapacity(8000),false);
 now=10001;
 assert.equal(router.hasReviewCapacity(8000),true);
 state.groq.tokens=20000;state.openai.tokens=20000;
 assert.equal(router.hasReviewCapacity(8000),false);
 assert.equal(fetches,0);
});
test('only nonexpired, fact-identical encrypted written articles get priority for resumption',()=>{
 const secret='private-test',now=1_000_000;
 const docs=[{url:'https://ajax.nl/artikelen/official',text:'Verified exact excerpt',publishedAt:'2026-11-09'}];
 const hash=crypto.createHash('sha256').update(JSON.stringify(docs.map(d=>({url:d.url,text:d.text,publishedAt:d.publishedAt})))).digest('hex');
 const job={id:'jobA',checkpoint:sealCheckpoint({evidenceHash:hash,expiresAt:now+10000,draft:{body:['text']}},secret,'jobA')};
 assert.equal(reusableCheckpointPriority(job,docs,secret,now),2);
 assert.equal(reusableCheckpointPriority({...job,checkpoint:sealCheckpoint({evidenceHash:hash,expiresAt:now+10000,candidate:{topic:'T'}},secret,'jobA')},docs,secret,now),1);
 assert.equal(reusableCheckpointPriority(job,[{...docs[0],text:'Changed source'}],secret,now),0);
 assert.equal(reusableCheckpointPriority(job,docs,secret,now+10001),0);
 assert.equal(reusableCheckpointPriority({...job,id:'other'},docs,secret,now),0);
});