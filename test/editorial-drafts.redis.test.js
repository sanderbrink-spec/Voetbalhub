const test=require('node:test');
const assert=require('node:assert/strict');
const store=require('../editorial-drafts');
test('real Redis atomically preserves draft revisions and approval state',{skip:!process.env.REDIS_TEST_URL},async()=>{
 const {createClient}=require('redis');
 const client=createClient({url:process.env.REDIS_TEST_URL});await client.connect();let record;
 const payload={category:'Voetbal',draft:{headline:'Club bespreekt concrete plannen voor het komende seizoen',standfirst:'De directie bespreekt verschillende voorstellen met medewerkers en supporters om de ontvangst van bezoekers tijdens toekomstige evenementen te verbeteren.',body:[
 'Tijdens de bijeenkomst kregen vertegenwoordigers van supporters gelegenheid om hun ervaringen met de toegang tot het terrein te delen met medewerkers van de betrokken afdelingen.',
 'Vervolgens onderzoekt een werkgroep welke praktische voorstellen uitvoerbaar zijn en welke partijen daarbij betrokken moeten worden om verdere afspraken over voorbereiding en planning te maken.',
 'De organisatie verzamelt de reacties uit het overleg voordat zij een vervolgafspraak vastlegt waarop de verantwoordelijke medewerkers de besproken mogelijkheden verder kunnen toelichten.'
 ]},verifiedFacts:['Een door de redactie gecontroleerd feit.','Een tweede onafhankelijk gecontroleerd feit.'],sources:[{url:'https://fcgroningen.nl/nieuws/test'},{url:'https://uefa.com/test'}],editorialChecks:{originalSourceReviewed:true,claimsIndependentlyChecked:true,duplicateChecked:true,languageChecked:true},imageRights:'not_needed'};
 try{
  record=await store.saveDraft(client,{payload});assert.equal(record.revision,1);
  const outcomes=await Promise.allSettled([store.saveDraft(client,{id:record.id,expectedRevision:1,payload}),store.saveDraft(client,{id:record.id,expectedRevision:1,payload})]);
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(outcomes.find(x=>x.status==='rejected').reason.status,409);
  record=await store.getDraft(client,record.id);assert.equal(record.revision,2);
  record=await store.saveDraft(client,{id:record.id,expectedRevision:2,payload,approve:true});assert.equal(record.status,'approved');
  await assert.rejects(store.saveDraft(client,{id:record.id,expectedRevision:2,payload}),e=>e.status===409);
  assert.ok((await store.listDrafts(client)).some(x=>x.id===record.id&&x.payload.draft.body.length===3));
  await store.markPublished(client,record,record.id.slice(14));assert.equal((await store.getDraft(client,record.id)).status,'published');
 }finally{if(record)await client.del('editorial-draft:'+record.id);await client.quit();}
});
