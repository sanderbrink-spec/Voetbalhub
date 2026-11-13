'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EditorialProviderRouter}=require('../editorial-provider-router');
const {scheduleEditorialGroups}=require('../scripts/automatic-publication');
const config=require('../automatic-editorial.json');
const scores={actuality:94,reliability:100,nationalValue:90,originality:91,journalism:91,diversity:90};
const response=value=>Response.json({choices:[{message:{content:JSON.stringify(value)}}],usage:{total_tokens:1200}});
test('Sportmonks-led production uses bounded five-to-ten article batches, never above editorial gates',()=>{
 assert.ok(Number.isInteger(config.maxPerRun)&&config.maxPerRun>=5&&config.maxPerRun<=10);
 assert.ok(config.maxImageRequestsPerRun>=config.maxPerRun);
 assert.ok(config.qualityThreshold>=85);
});
test('exhausted bounded writer allowance leaves independent review reserve intact',async()=>{
 let calls=0;
 const router=new EditorialProviderRouter({
  openaiKey:'existing-credential',
  intervalMs:0,
  state:{openai:{day:'2026-11-09',requests:99,tokens:135878,blockedUntil:0,nextAt:0}},
  now:()=>Date.parse('2026-11-09T16:00:00Z'),
  fetcher:async()=>{calls++;return response({approved:true,issues:[],scores});}
 });
 assert.equal(router.hasReviewCapacity(),true);
 await assert.rejects(router.complete([{role:'user',content:'sample'}],{task:'writing'}),{code:'EDITORIAL_AI_UNAVAILABLE'});
 assert.equal(calls,0);
 const result=await router.complete([{role:'user',content:'Evaluate only verified evidence'}],{task:'review'});
 assert.deepEqual(result.scores,scores);assert.equal(calls,1);
 assert.equal(router.trace.at(-1).task,'review');
});
test('review reserve has a hard cap and cannot be spent on new extraction',async()=>{
 let called=0;
 const r=new EditorialProviderRouter({
  openaiKey:'existing-credential',
  intervalMs:0,
  state:{openai:{day:'2026-11-09',requests:116,tokens:140000,blockedUntil:0,nextAt:0}},
  now:()=>Date.parse('2026-11-09T16:00:00Z'),
  fetcher:async()=>{called++;return response({approved:true,issues:[],scores});}
 });
 assert.equal(r.hasReviewCapacity(),false);
 await assert.rejects(r.complete([{role:'user',content:'proof'}],{task:'review'}),{code:'EDITORIAL_AI_UNAVAILABLE'});
 await assert.rejects(r.complete([{role:'user',content:'proof'}],{task:'extraction'}),{code:'EDITORIAL_AI_UNAVAILABLE'});
 assert.equal(called,0);
});

test('Sportmonks-only production selects only distinct registered Sportmonks match candidates',()=>{
 const mk=(id,url='https://www.sportmonks.com/football-api/')=>Object.assign([{url,title:id}],{matchRecord:{matchId:id,sources:[{url}]}});
 const sm1=mk('sm-101'),sm2=mk('sm-102'),cl=mk('fd-cl-10'),unverified=mk('sm-103','https://not-sportmonks.example/');
 const news=[[{url:'https://fcgroningen.nl/nieuws',title:'Unrelated news'}]];
 assert.deepEqual(scheduleEditorialGroups(news,[sm1,cl,sm2,unverified],{sportmonksOnly:true}),[sm1,sm2]);
 assert.deepEqual(scheduleEditorialGroups(news,[],{sportmonksOnly:true}),[]);
 assert.deepEqual(scheduleEditorialGroups(news,[sm1,cl,sm2]),[news[0],sm1,cl,sm2]);
});
