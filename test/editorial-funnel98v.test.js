'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {summarizeEditorialFunnel98V}=require('../scripts/automatic-publication');

test('98V: link discovery and editorial approvals are separate denominators',()=>{
 const report={
  counts:{found:74,readable:67,uniqueGroups:2,attempted:1,generated:1,approved:1,published:1,aiRequests:6},
  signals:[
   {url:'https://example.org/one',outcome:'no_national_relevance'},
   {url:'https://example.org/two',outcome:'stale_date'},
   {url:'https://example.org/three',outcome:'primary_authority'},
   // Later tracking of a URL must not count its discovery twice.
   {url:'https://example.org/three',outcome:'queue_review'},
   {url:'https://example.org/one',outcome:'no_national_relevance'},
   {route:'match',outcome:'recent_sportmonks_unavailable_or_empty'}
  ],
  skipped:[{topic:'onvoldoende',stage:'quality'},{topic:'zonder beeld',stage:'artwork'}],
  processingErrors:[{topic:'storing',stage:'generation'}],
  sourceErrors:[{url:'https://example.org/four',error:'timeout'}]
 };
 const funnel=summarizeEditorialFunnel98V(report);
 assert.equal(funnel.discoveredLinks,74);
 assert.equal(funnel.distinctArticleCandidates,2);
 assert.equal(funnel.published,1);
 assert.deepEqual(funnel.discoveryReasons,{no_national_relevance:1,stale_date:1,primary_authority:1});
 assert.deepEqual(funnel.articleExitReasons,{quality:1,artwork:1,technical_generation:1});
 assert.equal(funnel.aiRequests,6);
 assert.equal(funnel.sourceErrors,1);
});

test('98V: no links or rejected drafts are invented when discovery is empty',()=>{
 const funnel=summarizeEditorialFunnel98V({
  counts:{found:0,readable:0},
  signals:[{outcome:'recent_sportmonks_unavailable_or_empty'}],
  skipped:[],processingErrors:[],sourceErrors:[]
 });
 assert.equal(funnel.discoveredLinks,0);
 assert.deepEqual(funnel.discoveryReasons,{});
 assert.equal(funnel.generated,0);
 assert.equal(funnel.published,0);
});
