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
 const report={counts:{uniqueGroups:11,queued:0,attempted:0,published:0},queue,skipped:[{stage:'artwork',reason:'Geen passend goedgekeurd artikelbeeld beschikbaar.'}],processingErrors:[],published:[]};
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

test('105A matching image gate defers only unillustrated fixtures, never ordinary club news',()=>{
 const {matchArtworkPreflight105A}=require('../scripts/automatic-publication');
 const group=[{title:'Helmond Sport tegen FC Dordrecht'}];
 group.matchRecord={matchId:'sm-19715873',articleKind:'match_report',category:'kkd'};
 const missing=matchArtworkPreflight105A(group,(received,candidate,topic)=>{
  assert.equal(received,group);
  assert.equal(candidate.kind,'match_report');
  assert.equal(candidate.category,'kkd');
  assert.equal(topic,group[0].title);
  return {checked:true,approved:false,reason:'No club-specific approved stadium photo'};
 });
 assert.deepEqual(missing,{blocked:true,reason:'No club-specific approved stadium photo',matchId:'sm-19715873'});
 assert.equal(matchArtworkPreflight105A(group,()=>({checked:true,approved:true})).blocked,false);
 assert.equal(matchArtworkPreflight105A([{title:'Official club decision'}],()=>{throw Error('No fixture image needed')}).blocked,false);
});

test('105A real scenario: 10 initially queued match stories can all block on images without false success',()=>{
 const report={
  counts:{uniqueGroups:12,queued:10,attempted:0,generated:0,published:0},
  queue:{review:25,retry:10,technicalReview:1,awaitingApprovedArtwork:10},
  skipped:Array.from({length:10},(_,i)=>({topic:'fixture-'+i,stage:'artwork',reason:'Geen passend goedgekeurd artikelbeeld beschikbaar.'})),
  processingErrors:[],published:[]
 };
 const blocker=publicationBlocker(report);
 assert.equal(blocker,'editorial_waiting_for_artwork');
 assert.equal(classifyFinalStatus105A(report,{editorialBlocker:blocker}),'editorial_waiting_for_artwork');
 const {runExitCode}=require('../scripts/automatic-publication');
 assert.equal(runExitCode({...report,status:blocker,outcome:'editorial_blocked',validationOnly:false},{}),1);
 const noCurrentHold={...report,skipped:[]};
 assert.notEqual(publicationBlocker(noCurrentHold),'editorial_waiting_for_artwork');
});
