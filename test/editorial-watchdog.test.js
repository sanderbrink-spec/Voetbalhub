'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('.github/workflows/editorial-watchdog.yml','utf8').split('script: |\n')[1].split('\n').map(line=>line.startsWith('            ')?line.slice(12):line).join('\n');
const execute=new (Object.getPrototypeOf(async function(){}).constructor)('github','context','core',source);
for(const state of ['stale','active','recent'])test('missing editorial schedule recovery: '+state,async()=>{
 const old={id:1,status:'completed',conclusion:'success',created_at:new Date(Date.now()-6*3600000).toISOString()};
 const latest=state==='active'?{...old,status:'in_progress'}:state==='recent'?{...old,created_at:new Date().toISOString()}:old;
 const calls=[];
 const github={rest:{actions:{listWorkflowRuns:async args=>({data:{workflow_runs:[args.event==='schedule'?old:latest]}}),createWorkflowDispatch:async args=>calls.push(args)},issues:{listForRepo:async()=>({data:[]}),create:async()=>{}}}};
 await execute(github,{repo:{owner:'owner',repo:'repo'}},{notice(){},setFailed(message){throw Error(message);}});
 assert.equal(calls.length,state==='stale'?1:0);
 if(calls.length)assert.equal(calls[0].ref,'main');
});
