const test=require('node:test'),assert=require('node:assert/strict');
const {importPackets}=require('../scripts/import-curated-drafts');
function packet(){const body=[
 'Tijdens een bijeenkomst verzamelden medewerkers van de organisatie verschillende voorstellen om de ontvangst van bezoekers op het terrein verder te verbeteren.',
 'Een werkgroep onderzoekt welke praktische afspraken daarvoor nodig zijn en bespreekt met de betrokken afdelingen welke voorzieningen voor gezinnen beschikbaar kunnen komen.',
 'Na de inventarisatie volgt een nieuw overleg waarin de verantwoordelijke medewerkers hun bevindingen toelichten en voorstellen doen voor de verdere voorbereiding.'
 ];return {key:'test-own-article',payload:{category:'Voetbal',draft:{headline:'Organisatie onderzoekt betere ontvangst voor bezoekers op het terrein',standfirst:'Medewerkers verzamelen voorstellen om bezoekers beter te ontvangen en bespreken met verschillende afdelingen welke praktische verbeteringen mogelijk zijn.',body},verifiedFacts:body,sources:[{url:'https://fcgroningen.nl/nieuws/test'},{url:'https://uefa.com/test'}],reviewNotes:'Eindcontrole staat nog open.',editorialChecks:{claimsIndependentlyChecked:true},factChecks:{resultVerified:true}}};}
test('import stores complete text and pending review notes, never an approval or publication',async()=>{
 const calls=[];const p=packet();
 const result=await importPackets({packets:[p],apiUrl:'https://example.org',secret:'test-not-real',fetcher:async(url,opts)=>{
  calls.push({url,opts});if(!opts.method)return new Response(JSON.stringify({items:[]}));
  const b=JSON.parse(opts.body);assert.equal(b.approve,false);assert.deepEqual(b.payload.editorialChecks,{});assert.deepEqual(b.payload.factChecks,{});assert.equal(b.payload.draft.body.length,3);assert.match(b.payload.reviewNotes,/open/);
  return new Response(JSON.stringify({record:{id:'private-test-id',status:'draft'},published:false}));
 }});assert.equal(result.saved,1);assert.equal(calls.length,2);assert.ok(calls.every(c=>!c.url.includes('/publish')));
});
test('already imported articles do not create duplicate drafts',async()=>{
 const p=packet();const r=await importPackets({packets:[p],apiUrl:'https://example.org',secret:'test',fetcher:async(_,o)=>{assert.equal(o.method,undefined);return new Response(JSON.stringify({items:[{payload:p.payload}]}));}});
 assert.equal(r.saved,0);assert.equal(r.skipped,1);
});
test('source-only records cannot be imported as complete own articles',async()=>{
 const p=packet();p.payload.draft.body=[];let calls=0;
 await assert.rejects(importPackets({packets:[p],apiUrl:'https://example.org',secret:'test',fetcher:async()=>{calls++;return new Response(JSON.stringify({items:[]}));}}),/niet geschikt/);assert.equal(calls,1);
});
