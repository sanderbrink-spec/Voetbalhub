'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const config=require('../automatic-editorial.json');
const {articleUrl,scanOfficialIndexes}=require('../scripts/editorial-discovery53');
const cases=[
 ['https://www.willem-ii.nl/nieuws','https://www.willem-ii.nl/artikel/willem-ii-contracteert-vito-van-crooij'],
 ['https://fortunasittard.nl/nieuws','https://fortunasittard.nl/nieuws/fortuna-bedankt-hurkmans-voor-hoofdsponsorschap']
];
test('136 already approved club domains are reachable via direct index discovery',async()=>{
 const entries=cases.map(([url])=>config.newsIndexes.find(x=>x.url===url));
 assert.ok(entries.every(Boolean));
 const results=await scanOfficialIndexes(entries,async entry=>[articleUrl(cases.find(([url])=>url===entry.url)[1],config.newsIndexes)]);
 assert.deepEqual(results.map(x=>x.value[0]),cases.map(x=>x[1]));
 for(const [index,url] of cases){
  assert.ok(config.officialDomains.includes(new URL(url).hostname.replace(/^www\./,'')));
  assert.equal(articleUrl(index,config.newsIndexes),null);
  assert.equal(articleUrl(url+'?tracking=1#fragment',config.newsIndexes),url);
  assert.equal(articleUrl(url.replace('https:','http:'),config.newsIndexes),null);
 }
});
test('136 failure of one index cannot suppress the other',async()=>{
 const entries=cases.map(([url])=>config.newsIndexes.find(x=>x.url===url));
 const results=await scanOfficialIndexes(entries,async entry=>{
  if(entry.url===cases[0][0])throw Error('HTTP 429');
  return [cases[1][1]];
 });
 assert.equal(results[0].status,'rejected');
 assert.equal(results[1].status,'fulfilled');
 assert.deepEqual(results[1].value,[cases[1][1]]);
});
