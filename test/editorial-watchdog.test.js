'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('.github/workflows/editorial-watchdog.yml','utf8').split('script: |\n')[1].split('\n').map(line=>line.startsWith('            ')?line.slice(12):line).join('\n');
const execute=new (Object.getPrototypeOf(async function(){}).constructor)('github','context','core','require',source);
// github-script resolves local modules from the checked-out workspace.
const workflowRequire=require('node:module').createRequire(process.cwd()+'/package.json');
for(const state of ['stale','active','recent','fresh-lead','no-fresh-lead'])test('missing editorial schedule recovery: '+state,async()=>{
 const old={id:1,status:'completed',conclusion:'success',created_at:new Date(Date.now()-6*3600000).toISOString()};
 const latest=state==='active'?{...old,status:'in_progress'}:state==='recent'?{...old,created_at:new Date().toISOString()}:['fresh-lead','no-fresh-lead'].includes(state)?{...old,created_at:new Date(Date.now()-35*60000).toISOString()}:old;
 const scoutState={lastScanAt:new Date(Date.now()-60000).toISOString(),leads:state==='fresh-lead'?[{seenAt:new Date(Date.now()-5*60000).toISOString(),publishedAt:new Date(Date.now()-10*60000).toISOString()}]:[]};
 const calls=[];
 const github={rest:{repos:{getContent:async()=>({data:JSON.stringify(scoutState)})},actions:{listWorkflowRuns:async args=>({data:{workflow_runs:[args.event==='schedule'?old:latest]}}),createWorkflowDispatch:async args=>calls.push(args)},issues:{listForRepo:async()=>({data:[]}),create:async()=>{}}}};
 await execute(github,{repo:{owner:'owner',repo:'repo'}},{notice(){},info(){},warning(){},setFailed(message){throw Error(message);}},workflowRequire);
 assert.equal(calls.length,['stale','fresh-lead'].includes(state)?1:0);
 if(calls.length)assert.equal(calls[0].ref,'main');
});
