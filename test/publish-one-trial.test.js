'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {run}=require('../scripts/publish-one-trial');const {fingerprint}=require('../editorial-drafts');
const packet=require('../redactie/trial/article.json');
const texts=[
 'Onze thuiswedstrijd tegen FC Den Bosch is verplaatst van vrijdag 30 oktober naar zondag 1 november om 14.30 uur. De wijziging is een gevolg van het programma van de eerste ronde van de KNVB Beker.',
 'Als gevolg van het bekerprogramma wordt de wedstrijd FC Emmen – FC Den Bosch in de Keuken Kampioen Divisie verplaatst van vrijdag 30 oktober 20:00 uur naar zondag 1 november 14:30 uur.',
 'Wedstrijden Eerste Divisie 01-11-2026 14:30:00 FC Emmen 0 Dagen 0 Uren 0 Minuten FC Den Bosch. Dit is het actuele wedstrijdprogramma van de club voor het nieuwe seizoen.'
];
function harness({changed=false,duplicate=false}={}){
 const writes=[];let source=0;let published;let reads=0;
 const fetcher=async(url,opts={})=>{
  if(!url.includes('onrender.com'))return {ok:true,url,text:async()=>changed&&source===2?texts[source++].replace('14:30:00','20:00:00'):texts[source++]};
  if(!opts.method){reads++;return {ok:true,json:async()=>({articles:published?[published]:duplicate?[{headline:packet.payload.draft.headline}]:[]})};}
  const b=JSON.parse(opts.body);writes.push({url,body:b});
  if(url.endsWith('/editorial-drafts'))return {ok:true,json:async()=>({record:{id:'1793356143677-92c3f8b4-8a1e-4afc-9353-c136eb19a896',revision:1,status:'approved',contentHash:fingerprint(b.payload)}})};
  published={...b.draft,id:'test-id'};return {ok:true,json:async()=>({status:'published',article:published})};
 };
 return {fetcher,writes};
}
const options={packet,secret:'test-secret',now:Date.parse('2026-10-30T12:00:00Z')};
test('single trial publishes only after live evidence and verifies the public feed',async()=>{const h=harness();const r=await run({...options,fetcher:h.fetcher});assert.equal(r.status,'published');assert.equal(r.humanApproval,false);assert.equal(h.writes.length,2);assert.match(h.writes[0].body.payload.reviewNotes,/Geen handmatige goedkeuring/);assert.equal(h.writes[1].body.expectedRevision,1);});
test('changed kickoff blocks all approval and publication writes',async()=>{const h=harness({changed:true});await assert.rejects(run({...options,fetcher:h.fetcher}),/Actuele kalender/);assert.equal(h.writes.length,0);});
test('expired trial cannot fetch or publish',async()=>{await assert.rejects(run({...options,now:Date.parse(packet.expiresAt),fetcher:()=>{throw Error('unexpected fetch');}}),/verlopen/);});
test('repeated workflow cannot create another copy',async()=>{const h=harness({duplicate:true});assert.equal((await run({...options,fetcher:h.fetcher})).status,'already_published');assert.equal(h.writes.length,0);});
test('unsupported number in the draft blocks all writes',async()=>{const h=harness();const p=structuredClone(packet);p.payload.draft.body[0]+=' Er worden 99 supporters verwacht.';await assert.rejects(run({...options,packet:p,fetcher:h.fetcher}),/Cijfers ontbreken/);assert.equal(h.writes.length,0);});
