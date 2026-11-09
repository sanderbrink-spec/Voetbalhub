'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {deploysFromApi,deploymentDecision,reconcile}=require('../scripts/render-sync-guard');
const A='a'.repeat(40),B='b'.repeat(40);
const row=(status,sha)=>({status,commit:{id:sha}});

test('Render API deploy wrappers decode correctly',()=>{
 assert.deepEqual(deploysFromApi([{deploy:row('live',A)}]),[row('live',A)]);
 assert.deepEqual(deploysFromApi([row('live',A)]),[row('live',A)]);
 assert.throws(()=>deploysFromApi({status:'live'}),/Ongeldig/);
});
test('the correct healthy revision is accepted immediately',()=>{
 assert.equal(deploymentDecision({deploys:[],sha:B,ready:{ready:true,revision:B},graceExpired:true}),'synced');
});
test('never duplicate an ongoing native or recovery deployment',()=>{
 for (const status of ['created','queued','build_in_progress','pre_deploy_in_progress','update_in_progress'])
  assert.equal(deploymentDecision({deploys:[row(status,B),row('live',A)],sha:B,ready:{ready:false},graceExpired:true}),'wait_deploy');
 assert.equal(deploymentDecision({deploys:[row('build_in_progress',A)],sha:B,ready:{ready:false},graceExpired:true}),'wait_deploy');
});
test('do not rebuild an already-live commit just because Redis is unavailable',()=>{
 assert.equal(deploymentDecision({deploys:[row('live',B)],sha:B,ready:{ready:false},graceExpired:true}),'wait_readiness');
});
test('recover a genuinely stale revision only once after a grace period',()=>{
 const args={deploys:[row('live',A)],sha:B,ready:{ready:false},graceExpired:true};
 assert.equal(deploymentDecision({...args,graceExpired:false}),'wait_autodeploy');
 assert.equal(deploymentDecision(args),'recover');
 assert.equal(deploymentDecision({...args,requestedFor:B}),'wait_recovery');
});
test('the guard pins precisely current main and makes at most one recovery request',async()=>{
 let tick=0,postCount=0,pinned='',healthy=false;
 const fetcher=async(url,options={})=>{
  const json=async()=>{
   if(url.includes('/git/ref/heads/main'))return {object:{sha:B}};
   if(url.endsWith('/ready'))return {ready:healthy,revision:healthy?B:A};
   if(url.includes('/deploys?'))return [{deploy:row('live',pinned||A)}];
   if(url.endsWith('/deploys')&&options.method==='POST'){
    postCount++; pinned=JSON.parse(options.body).commitId;
    return {id:'dep-test'};
   }
   throw Error('Unexpected URL '+url);
  };
  return {ok:true,json};
 };
 const r=await reconcile({mode:'guard',env:{GITHUB_REPOSITORY:'sanderbrink-spec/Voetbalhub',RENDER_API_KEY:'test',GITHUB_TOKEN:'test'},fetcher,clock:()=>tick,pause:async ms=>{tick+=ms;if(postCount)healthy=true;},log:()=>{},maxMs:120000});
 assert.equal(r.synced,true);
 assert.equal(r.recovered,true);
 assert.equal(pinned,B);
 assert.equal(postCount,1);
});
test('APK verification rejects a stale workflow commit even if Render is healthy',async()=>{
 const fetcher=async(url)=>({ok:true,json:async()=>({object:{sha:B}})});
 await assert.rejects(reconcile({mode:'verify',env:{GITHUB_REPOSITORY:'sanderbrink-spec/Voetbalhub',GITHUB_SHA:A},fetcher}),/verouderde APK/);
});
