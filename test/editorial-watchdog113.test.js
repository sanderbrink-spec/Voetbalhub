'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {isSafeValidationOnly,recoveryWindow}=require('../scripts/editorial-watchdog113');
const now=Date.parse('2026-11-23T20:00:00Z');
const run=(id,event,status,conclusion,minutesAgo,head='')=>({
 id,event,status,conclusion,created_at:new Date(now-minutesAgo*60000).toISOString(),
 head_commit:{message:head}
});
test('113A: safe validation does not suppress a missing real editorial run',()=>{
 const safe=run(5,'push','completed','failure',20,'fix [validate-editorial-generation]');
 assert.equal(isSafeValidationOnly(safe),true);
 assert.deepEqual(recoveryWindow([safe],now),{allowed:true,active:false,recentReal:false});
 const skipped=run(6,'push','completed','skipped',10,'ordinary merge');
 assert.equal(recoveryWindow([safe,skipped],now).allowed,true);
});
test('113A: never double-dispatch while any run is active or recently published',()=>{
 const validationRunning=run(7,'push','in_progress',null,1,'fix [validate-editorial-generation]');
 assert.equal(recoveryWindow([validationRunning],now).allowed,false);
 const active=run(8,'workflow_dispatch','queued',null,1);
 assert.equal(recoveryWindow([active],now).allowed,false);
 const manual=run(9,'workflow_dispatch','completed','failure',75);
 assert.equal(recoveryWindow([manual],now).allowed,false);
 const planned=run(10,'schedule','completed','success',80);
 assert.equal(recoveryWindow([planned],now).allowed,false);
 assert.equal(recoveryWindow([run(11,'schedule','completed','failure',91)],now).allowed,true);
});
test('113A: unknown push content is not mistakenly classified as a harmless validation',()=>{
 const unknown=run(12,'push','completed','failure',20);
 const real=run(13,'push','completed','failure',20,'[publish-verified-news]');
 assert.equal(isSafeValidationOnly(unknown),false);
 assert.equal(recoveryWindow([unknown],now).allowed,false);
 assert.equal(recoveryWindow([real],now).allowed,false);
});
test('113A: existing watchdog listens only to successful scheduled main scouts and keeps one dispatch gate',()=>{
 const yaml=fs.readFileSync('.github/workflows/editorial-watchdog.yml','utf8');
 assert.match(yaml,/push:\s*\n\s+branches: \[main\]\s*\n\s+paths: \['\.github\/workflows\/editorial-watchdog\.yml'\]/);
 assert.match(yaml,/workflow_run:\s*\n\s+workflows:\s*\['Veldio 10 AI news scouts'\]/);
 assert.match(yaml,/github\.event\.workflow_run\.event == 'schedule'/);
 assert.match(yaml,/github\.event\.workflow_run\.conclusion == 'success'/);
 assert.match(yaml,/github\.event\.workflow_run\.head_branch == 'main'/);
 assert.match(yaml,/group: veldio-editorial-watchdog/);
 // github-script loads a local module. The live 113A run failed because
 // the workflow omitted checkout; ensure checkout precedes github-script.
 const checkout=yaml.indexOf('uses: actions/checkout@v4');
 const script=yaml.indexOf('uses: actions/github-script@v7');
 assert.ok(checkout>0&&script>checkout,'local module must exist before github-script executes');
 assert.ok(fs.existsSync('scripts/editorial-watchdog113.js'));
 assert.match(yaml,/recoveryWindow\(all\.workflow_runs\)/);
 assert.match(yaml,/sportmonks_only:'false'/);
 assert.match(yaml,/validation_only:'false'/);
});
