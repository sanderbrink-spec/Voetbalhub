'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {summarizeQueue105A,classifyFinalStatus105A,publicationBlocker}=require('../editorial-recovery136');
const now=Date.parse('2026-11-21T15:45:00Z');
test('105A reports image-deferred matches and their next retry without changing approvals',()=>{
 const records=[
  {status:'retry',matchId:'sm-19715873',failureCategory:'missing_approved_artwork',reason:'awaiting_approved_artwork',nextAttemptAt:now-60000},
  {status:'review',failureCategory:'generator_failure',urls:['https://www.onsoranje.nl/archive'],updatedAt:now-3*86400000},
  {status:'review',failureCategory:'journalistic_rejection',urls:['https://www.psv.nl/news']}
 ];
 const queue=summarizeQueue105A(records,now);
 assert.equal(queue.awaitingApprovedArtwork,1);
 assert.deepEqual(queue.artworkDossiers,[{matchId:'sm-19715873',clubPreviewId:null,nextAttemptAt:new Date(now-60000).toISOString(),due:true}]);
 assert.equal(queue.technicalReview,1);
 const report={counts:{uniqueGroups:11,queued:0,attempted:0,published:0},queue,processingErrors:[],published:[]};
 const blocker=publicationBlocker(report);
 assert.equal(blocker,'editorial_waiting_for_artwork');
 assert.equal(classifyFinalStatus105A(report,{editorialBlocker:blocker}),'editorial_waiting_for_artwork');
});
test('105A never hides fresh technical failures, approvals or absent evidence',()=>{
 const historical={counts:{uniqueGroups:1,queued:0,attempted:0,published:0},queue:{technicalReview:1,review:1,awaitingApprovedArtwork:0},processingErrors:[],published:[]};
 assert.equal(classifyFinalStatus105A(historical,{editorialBlocker:publicationBlocker(historical)}),'editorial_stalled');
 assert.equal(classifyFinalStatus105A({...historical,processingErrors:[{stage:'generation',reason:'HTTP 500'}]},{editorialBlocker:'editorial_stalled'}),'processing_errors');
 assert.equal(classifyFinalStatus105A({...historical,published:[{id:'confirmed'}]},{editorialBlocker:'editorial_stalled'}),'completed');
 assert.equal(classifyFinalStatus105A({processingErrors:[],published:[]},{sourcesUnavailable:true}),'sources_unavailable');
});
