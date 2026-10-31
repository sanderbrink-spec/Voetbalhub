'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {permitted,safePublicArticle}=require('../rights-policy');
const {tokenMatches,allowedOrigin}=require('../request-security');
test('rights defaults block external collectors, automated publication and visual reuse',()=>{
  for(const feature of ['externalCollection','competitionData','thirdPartyVisuals','youtubeSelection','automaticPublication']) assert.equal(permitted(feature),false);
});
test('unlicensed fixture artwork and private evidence never reach the public article',()=>{
  const source={id:'a',body:['Eigen tekst'],imageUrl:'https://media.api-sports.io/a.png',imageRights:'cleared',imageReview:{method:'fixture-specific-stadium-and-logos-v4'},sourceEvidence:{content:'Private source copy'},verifiedFacts:['Private fact'],editorialChecks:{approved:true}};
  const clean=safePublicArticle(source);
  assert.equal(clean.imageUrl,undefined);assert.equal(clean.sourceEvidence,undefined);assert.equal(clean.verifiedFacts,undefined);
  assert.equal(clean.body[0],'Eigen tekst');assert.ok(source.imageUrl);
});
test('own reviewed illustrations remain available',()=>{
  const article={imageUrl:'https://voetbalhub-redactie.onrender.com/article-covers/test.webp',imageReview:{method:'reviewed-match-cover'}};
  assert.equal(safePublicArticle(article).imageUrl,article.imageUrl);
});
test('disabled collectors and automatic publisher perform no network or paid calls',async()=>{
  let calls=0;const fetcher=async()=>{calls++;throw Error('Unexpected network');};
  await assert.rejects(require('../scripts/eredivisie-official').collectOfficial({fetcher}),/Rechtencontrole/);
  await assert.rejects(require('../scripts/youtube-videos').collect({fetcher}),/Rechtencontrole/);
  await assert.rejects(require('../scripts/match-cover').asset('https://media.api-sports.io/a.png',fetcher),/Rechtencontrole/);
  assert.equal((await require('../scripts/automatic-publication').run({secret:'test',groqKey:'test',githubToken:'test',fetcher})).status,'rights_review_required');
  assert.equal(calls,0);
});
test('constant-time token checks reject missing, invalid and oversized credentials',()=>{
  assert.equal(tokenMatches('Bearer correct','correct'),true);
  for(const value of [undefined,'Bearer wrong','correct','Bearer correct ','a'.repeat(5000)]) assert.equal(tokenMatches(value,'correct'),false);
  assert.equal(tokenMatches('Bearer ',''),false);
});
test('CORS accepts one exact configured origin and never returns null, wildcard or a list',()=>{
  const config='https://desk.example, https://admin.example';
  assert.equal(allowedOrigin('https://desk.example',config),'https://desk.example');
  for(const value of [undefined,'null','https://desk.example.evil','https://evil.example'])assert.equal(allowedOrigin(value,config),null);
});
