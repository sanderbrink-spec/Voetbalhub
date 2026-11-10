'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createEditorialDraft}=require('./editorial-ai');
const facts=[
 'FC Groningen bevestigt dat het schikkingsvoorstel voor Hateboer is geaccepteerd.',
 'FC Groningen meldt dat Hateboer tegen AZ een rode kaart wegens hands kreeg.',
 'Hateboer mist op 21 november het duel tegen sc Heerenveen.'
];
const input={
 topic:'Schikkingsvoorstel voor Hateboer geaccepteerd',
 category:'clubnieuws',facts,primaryAuthority:'club_decision',
 sourceUrls:['https://www.fcgroningen.nl/nieuws/schikkingsvoorstel-voor-hateboer-geaccepteerd/'],
 compact:true,automaticPublication:true
};
const valid={
 headline:'FC Groningen bevestigt aanvaarding schikkingsvoorstel na rood Hateboer',
 standfirst:'FC Groningen meldt dat het schikkingsvoorstel voor Hateboer is geaccepteerd nadat hij tegen AZ een rode kaart kreeg.',
 body:[
  'FC Groningen schrijft dat Hateboer tegen AZ een rode kaart kreeg wegens hands.',
  'Volgens de club mist Hateboer daardoor op 21 november het duel tegen sc Heerenveen.'
 ]
};
test('korte officiële bekendmaking krijgt een eigen compacte schrijftaak',async()=>{
 let first;
 const out=await createEditorialDraft(input,{model:'openai/gpt-oss-120b',router:{complete:async(messages,options)=>{
  first={messages,options};
  return valid;
 }}});
 assert.match(first.messages[0].content,/één of twee alinea’s/);
 assert.match(first.messages[0].content,/letterlijk gecontroleerde facts/);
 assert.ok(first.messages[0].content.includes('FC Groningen'));
 assert.deepEqual(JSON.parse(first.messages[1].content).facts,facts);
 assert.equal(out.qualityReview.autoPublish,false);
 assert.equal(out.body.length,2);
});
test('eerste foutieve skip krijgt maximaal één nieuwe schrijfpoging met identieke bronfeiten',async()=>{
 const calls=[];
 const out=await createEditorialDraft(input,{model:'openai/gpt-oss-120b',router:{complete:async(messages,options)=>{
  calls.push({messages:structuredClone(messages),options});
  return calls.length===1?{skip:true}:valid;
 }}});
 assert.equal(calls.length,2);
 assert.equal(calls[0].options.task,'writing');
 assert.equal(calls[1].options.task,'revision');
 assert.match(calls[1].messages.at(-1).content,/Controleer of skip werkelijk noodzakelijk/);
 assert.deepEqual(JSON.parse(calls[1].messages[1].content).facts,facts);
 assert.equal(out.qualityReview.factVerificationRequired,true);
 assert.equal(out.qualityReview.autoPublish,false);
});
test('tweede skip blijft een redactionele afwijzing; geen automatische goedkeuring',async()=>{
 let attempts=0;
 await assert.rejects(createEditorialDraft(input,{model:'openai/gpt-oss-120b',router:{complete:async()=>{
  attempts++;return {skip:true};
 }}}),e=>e.status===422);
 assert.equal(attempts,2);
});
test('niet-officiële bron en lege feiten verdienen geen extra skip-proef',async()=>{
 let attempts=0;
 await assert.rejects(createEditorialDraft({...input,primaryAuthority:null},{model:'openai/gpt-oss-120b',router:{complete:async()=>{
  attempts++;return {skip:true};
 }}}),e=>e.status===422);
 assert.equal(attempts,1);
});