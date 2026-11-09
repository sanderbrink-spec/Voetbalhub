'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EditorialProviderRouter}=require('../editorial-provider-router');
const draft={headline:'Een actueel geverifieerd wedstrijdverslag',standfirst:'De onafhankelijke redactie beschrijft uitsluitend gecontroleerde uitslagen.',body:['De wedstrijdgegevens komen rechtstreeks uit de gecontroleerde registratie.']};
const review={approved:true,issues:[],scores:{actuality:95,reliability:98,nationalValue:95,originality:90,journalism:90,diversity:90}};
test('existing OpenAI has bounded writing room after original 80-request quota, without touching Groq',async()=>{
 const calls=[],router=new EditorialProviderRouter({openaiKey:'existing',intervalMs:0,
  state:{openai:{day:'2026-11-09',requests:80,tokens:135878,blockedUntil:0,nextAt:0}},
  now:()=>Date.parse('2026-11-09T17:00:00Z'),fetcher:async(url,opt)=>{
   calls.push(JSON.parse(opt.body).model);
   return Response.json({choices:[{message:{content:JSON.stringify(calls.length===1?draft:review)}}],usage:{total_tokens:1250}});
  }});
 assert.equal(router.limits.openai.requests,100);
 assert.equal(router.limits.openai.tokens,260000);
 assert.equal(router.limits.groq.requests,80);
 await router.complete([{role:'user',content:'verified match facts'}],{task:'writing'});
 await router.complete([{role:'user',content:'independently check the draft facts'}],{task:'review'});
 assert.equal(calls.length,2);
 assert.equal(router.trace[0].task,'writing');
 assert.equal(router.trace[1].task,'review');
});
test('hard bound still refuses generation after writer call limit, even with review-only reserve available',async()=>{
 let calls=0;const router=new EditorialProviderRouter({openaiKey:'existing',intervalMs:0,
  state:{openai:{day:'2026-11-09',requests:99,tokens:200000,blockedUntil:0,nextAt:0}},
  now:()=>Date.parse('2026-11-09T17:00:00Z'),fetcher:async()=>{
   calls++;
   return Response.json({choices:[{message:{content:JSON.stringify(review)}}],usage:{total_tokens:100}});
  }});
 await assert.rejects(router.complete([{role:'user',content:'no more writing'}],{task:'writing'}),{code:'EDITORIAL_AI_UNAVAILABLE'});
 assert.equal(calls,0);
 assert.equal(router.hasReviewCapacity(),true);
 assert.deepEqual(await router.complete([{role:'user',content:'review existing draft'}],{task:'review'}),review);
 assert.equal(calls,1);
});
