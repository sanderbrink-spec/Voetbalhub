'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {reconcileDeferredPublications,runExitCode}=require('../scripts/automatic-publication');

test('one confirmed public article survives later provider exhaustion without hiding deferred work',()=>{
 const report={status:'providers_unavailable',counts:{published:1,approved:1,stored:1},
  queue:{retry:1,review:62},published:[{id:'verified-public-id'}],signals:[],
  processingErrors:[{stage:'quality',reason:'De AI-capaciteit is tijdelijk op.'}]};
 assert.equal(reconcileDeferredPublications(report),report);
 assert.equal(report.status,'completed_with_deferred_work');
 assert.deepEqual(report.published,[{id:'verified-public-id'}]);
 assert.deepEqual(report.queue,{retry:1,review:62});
 assert.equal(report.signals[0].outcome,'deferred_provider_capacity');
 assert.equal(report.signals[0].pending,1);
 assert.equal(runExitCode(report),0);
});

test('zero published articles remains an actual failure when providers are exhausted',()=>{
 const report={status:'providers_unavailable',counts:{published:0},queue:{retry:1},signals:[]};
 reconcileDeferredPublications(report);
 assert.equal(report.status,'providers_unavailable');
 assert.equal(report.signals.length,0);
 assert.equal(runExitCode(report),1);
});

test('journalistic rejection and storage errors cannot become a success merely because a draft exists',()=>{
 for(const status of ['editorial_rejected','processing_errors','failed']){
  const report={status,counts:{published:0,generated:2,approved:0},queue:{retry:0},signals:[]};
  reconcileDeferredPublications(report);
  assert.equal(report.status,status);
  assert.equal(runExitCode(report),1);
 }
});

test('focused production without a publication still fails even if empty rounds are normally healthy',()=>{
 assert.equal(runExitCode({status:'no_new_verified_articles',counts:{published:0}}),0);
 assert.equal(runExitCode({status:'no_new_verified_articles',focusSourceUrl:'https://ajax.nl/artikelen/test',counts:{published:0}}),1);
});
