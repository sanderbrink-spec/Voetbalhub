'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const demo=require('./editorial-demo-loadtest');
test('36 demo articles are isolated and explicitly synthetic',()=>{
 const items=demo.records();assert.equal(items.length,36);
 assert.equal(new Set(items.map(x=>x.id)).size,36);
 for(const x of items){assert.equal(x.status,'demo');assert.equal(x.isSynthetic,true);
  assert.match(x.headline,/^\[DEMO\]/);assert.match(x.standfirst,/FICTIEF TESTARTIKEL/);
  assert.equal(x.sourceProvider,'SYNTHETIC_TEST_ONLY');assert.notEqual(x.status,'published');}
});
test('demo webpage warns the user and escapes text',()=>{
 const page=demo.html();assert.match(page,/GEEN ACTUEEL NIEUWS/);assert.match(page,/ALLE ARTIKELEN ZIJN FICTIEF/);
 assert.match(page,/36 testartikelen/);assert.doesNotMatch(page,/<script/i);
});
