'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const registry=require('../scout-registry125.json');
const {validateRegistry,queryFor,normalizeCandidate,parseSignals,scan}=require('../scripts/scout-discovery125');

test('125A candidate registry spans ten roles and over 100 domains without granting evidence authority',()=>{
  assert.equal(registry.scouts.length,10);
  assert.ok(validateRegistry(registry).size>=100);
  assert.throws(()=>validateRegistry({...registry,sources:[...registry.sources,{...registry.sources[0],domain:'example.org',authority:'club_decision'}]}),/invalid/);
  assert.throws(()=>validateRegistry({...registry,sources:[...registry.sources,registry.sources[0]]}),/invalid/);
});
test('125A all roles use bounded thematic searches, including multilingual rotation, outside the old official allowlist',()=>{
  for(const role of registry.scouts){
    const u=new URL(queryFor(role.id));
    assert.equal(u.origin,'https://api.gdeltproject.org');
    assert.equal(u.searchParams.get('maxrecords'),'75');
    assert.equal(u.searchParams.get('timespan'),'24h');
    assert.doesNotMatch(u.searchParams.get('query'),/domain:/);
  }
  assert.match(new URL(queryFor('frankrijk-belgie-portugal',2)).searchParams.get('query'),/Portuguese/);
  assert.throws(()=>queryFor('unknown'));
  assert.throws(()=>queryFor('engeland',-1));
});
test('125A strict candidate domains and canonical tracking cleanup; no publisher request',()=>{
  assert.equal(normalizeCandidate('https://www.vi.nl/nieuws/example?utm_source=x#part'),'https://www.vi.nl/nieuws/example');
  for(const raw of ['http://www.vi.nl/nieuws/x','https://vi.nl.evil.test/x','https://evil.test/vi.nl','https://vi.nl@evil.test/x','https://user@vi.nl/x','https://vi.nl:444/x','https://127.0.0.1/x','https://vi.nl/','file:///etc/passwd']){
    assert.equal(normalizeCandidate(raw),null,raw);
  }
});
test('125A deduplication and provenance: no headline, proof, image or publication eligibility imported',()=>{
  const signals=parseSignals({articles:[
    {url:'https://www.vi.nl/nieuws/x?utm_source=abc',title:'untrusted',authority:'club_decision',socialimage:'https://example.org/img'},
    {url:'https://www.vi.nl/nieuws/x'},
    {url:'https://www.kicker.de/news/x'},
    {url:'https://unknown.test/x'}
  ]},'eredivisie');
  assert.equal(signals.length,2);
  assert.deepEqual(signals[0],{url:'https://www.vi.nl/nieuws/x',domain:'vi.nl',scout:'eredivisie',authority:'none',status:'unverified_discovery'});
});
test('125A one request only, no redirects or retry on 429; no publisher request',async()=>{
  let calls=0;
  const result=await scan({scout:'engeland',fetcher:async(url,opts)=>{
    calls++;
    assert.equal(new URL(url).hostname,'api.gdeltproject.org');
    assert.equal(opts.redirect,'error');
    return new Response('slow down',{status:429,headers:{'retry-after':'120'}});
  }});
  assert.equal(calls,1);
  assert.equal(result.status,'unavailable');
  assert.equal(result.retryAfter,'120');
  assert.deepEqual(result.signals,[]);
});
test('125A bounded response and truthful result',async()=>{
  const fetcher=async()=>new Response(JSON.stringify({articles:[{url:'https://www.bbc.com/sport/football/articles/example'}]}));
  const r=await scan({scout:'engeland',fetcher});
  assert.equal(r.uniqueDomains,1);
  assert.equal(r.signals[0].status,'unverified_discovery');
  await assert.rejects(scan({scout:'engeland',fetcher:async()=>new Response('x'.repeat(600*1024))}),/too large/);
  await assert.rejects(scan({scout:'engeland',fetcher:async()=>new Response('{}')}),/invalid GDELT/);
});
