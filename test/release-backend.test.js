'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{checkBackend}=require('../scripts/release-backend-check');
const now=Date.now();
function fixture(){return {'/health':{ok:true,storage:'connected',launchPolicyVersion:28,contact:{configured:true}},'/ready':{ready:true,launchPolicyVersion:28},'/articles':{rightsPolicyVersion:26,rightsExpiresAt:now+60000,articles:[{status:'published',headline:'Isolated synthetic test',body:['Synthetic body, never uploaded.']}]}};}
const options=d=>({now,fetcher:async url=>Response.json(d[new URL(url).pathname])});
test('release backend precheck accepts a complete technical fixture without declaring launch GO',async()=>{const result=await checkBackend('https://backend.example/articles',options(fixture()));assert.equal(result.technicalPrecheck,true);assert.equal(result.launchDecision,'separate evidence required');});
test('release backend precheck refuses old backend, no readiness, incomplete mail, expired rights, empty and malformed feeds',async()=>{
 for(const change of [d=>delete d['/health'].launchPolicyVersion,d=>d['/ready'].ready=false,d=>delete d['/ready'].launchPolicyVersion,d=>d['/health'].contact.configured=false,d=>d['/articles'].rightsExpiresAt=now-1,d=>d['/articles'].articles=[],d=>d['/articles'].articles[0].body=[]]){const d=fixture();change(d);await assert.rejects(checkBackend('https://backend.example/articles',options(d)));}
});
test('release backend precheck stops before HTTP on unsafe endpoints and propagates network failure',async()=>{
 let calls=0;for(const url of ['http://backend.example/articles','https://user:secret@backend.example/articles','https://backend.example/articles?token=x'])await assert.rejects(checkBackend(url,{fetcher:()=>{calls++;}}));assert.equal(calls,0);
 await assert.rejects(checkBackend('https://backend.example/articles',{fetcher:async()=>{throw Error('offline');}}),/offline/);
});
