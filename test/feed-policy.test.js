'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {selectFeed,publicationLifecycle}=require('../feed-policy');
test('current and archive partition the feed without mutating stored articles',()=>{
  const articles=[{id:'92c3f8b4-8a1e-4afc-9353-c136eb19a896',status:'published',body:['origineel'],publishedAt:'2026-10-30T10:31:25Z'},
    {id:'new',status:'published',body:['nieuw'],publishedAt:'2026-11-01T14:00:00Z'}];
  const before=JSON.stringify(articles);
  assert.deepEqual(selectFeed(articles).map(a=>a.id),['new']);
  assert.deepEqual(selectFeed(articles,{view:'archive'}).map(a=>a.id),[articles[0].id]);
  assert.equal(selectFeed(articles,{view:'all'}).length,2);
  assert.equal(JSON.stringify(articles),before);
});
test('preview expires exactly at the supplied timezone-aware deadline, reports remain',()=>{
  const deadline='2026-11-01T16:45:00+01:00';
  const preview={id:'preview',feedLifecycle:publicationLifecycle({kind:'preview',expiresAt:deadline})};
  const report={id:'report',publishedAt:'2020-01-01'};
  assert.equal(selectFeed([preview,report],{now:Date.parse(deadline)-1}).length,2);
  assert.deepEqual(selectFeed([preview,report],{now:Date.parse(deadline)}).map(a=>a.id),['report']);
  assert.equal(selectFeed([{id:'unknown',body:['zaterdag om 16.45']}],{now:Date.parse(deadline)}).length,1);
  for(const value of [{kind:'preview',expiresAt:'morgen'},{kind:'preview',expiresAt:'2026-11-01'},{kind:'report',expiresAt:deadline}])assert.throws(()=>publicationLifecycle(value));
});
test('sorting uses publication date and a stable tie-breaker',()=>{
  const list=[{id:'z',publishedAt:'2026-11-01'},{id:'old',publishedAt:'2026-10-30'},{id:'a',publishedAt:'2026-11-01'}];
  assert.deepEqual(selectFeed(list).map(a=>a.id),['a','z','old']);
});
