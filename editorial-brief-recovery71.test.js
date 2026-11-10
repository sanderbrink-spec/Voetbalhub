'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {reopenVerifiedOfficialBrief,reopenVerifiedOfficialPublisher}=require('./editorial-brief-recovery71');
const doc={url:'https://www.fcgroningen.nl/nieuws/voorbeeld/',publishedAt:'2026-11-09T13:40:58Z',
 text:'FC Groningen heeft een officieel besluit bevestigd. Hateboer kreeg tegen AZ een rode kaart wegens hands. De speler mist de thuiswedstrijd tegen sc Heerenveen.'};
const sentences=doc.text.split('. ').map(x=>x.endsWith('.')?x:x+'.');
const candidate={kind:'announcement',primaryAuthority:'club_decision',
 facts:sentences.map(text=>({text,evidence:[{source:0,quote:text}]}))};
const now=Date.parse('2026-11-10T15:00:00Z');
const job=()=>({urls:[doc.url],status:'review',failureStage:'generation',
 failureCategory:'journalistic_rejection',reason:'insufficient_verified_facts',
 checkpoint:{old:'rejected'},attempts:1,nextAttemptAt:Infinity});
test('één hervatting voor actuele bron en exact drie letterlijk gecontroleerde feiten',()=>{
 const j=job();
 assert.equal(reopenVerifiedOfficialBrief(j,candidate,doc,now,72),true);
 assert.equal(j.status,'pending');
 assert.equal(j.attempts,0);
 assert.equal(j.nextAttemptAt,now);
 assert.equal(j.checkpoint,undefined);
 assert.equal(reopenVerifiedOfficialBrief(j,candidate,doc,now,72),false);
});
test('geen oude, veranderde, onbewezen of eerder herhaalde nieuwsbron hervatten',()=>{
 for(const [c,d,j] of [
  [candidate,{...doc,publishedAt:'2026-11-01'},job()],
  [candidate,{...doc,text:'geen controleerbare feiten'},job()],
  [candidate,{...doc,url:'https://www.psv.nl/media/ander-artikel'},job()],
  [{...candidate,kind:'preview'},doc,job()],
  [{...candidate,facts:[]},doc,job()],
  [candidate,doc,{...job(),shortOfficialWriterRecoveryV71:true}],
  [candidate,doc,{...job(),status:'published'}],
  [candidate,doc,{...job(),failureStage:'quality'}]
 ])assert.equal(reopenVerifiedOfficialBrief(j,c,d,now,72),false);
});
test('oude exacte bronvermeldingsfout verdient één nieuwe volledige kwaliteitscontrole',()=>{
 const j={...job(),failureCategory:'generator_failure',reason:'generation_error',
  errorHash:'126283cc132043cfe72f5692e72b6d4d26a0a63433a19f6eb76372e818f72202'};
 assert.equal(reopenVerifiedOfficialPublisher(j,candidate,doc,now),true);
 assert.equal(j.status,'pending');
 assert.equal(j.checkpoint,undefined);
 assert.equal(j.verifiedPublisherRecoveryV71,true);
 assert.equal(reopenVerifiedOfficialPublisher(j,candidate,doc,now),false);
});
test('afwijkende fout, oude bron en ongecontroleerde feiten mogen niet opnieuw',()=>{
 const known={...job(),failureCategory:'generator_failure',reason:'generation_error',
  errorHash:'126283cc132043cfe72f5692e72b6d4d26a0a63433a19f6eb76372e818f72202'};
 assert.equal(reopenVerifiedOfficialPublisher({...known,errorHash:'different'},candidate,doc,now),false);
 assert.equal(reopenVerifiedOfficialPublisher({...known},candidate,{...doc,publishedAt:'2026-11-01'},now),false);
 assert.equal(reopenVerifiedOfficialPublisher({...known},{...candidate,facts:[]},doc,now),false);
 assert.equal(reopenVerifiedOfficialPublisher({...known,verifiedPublisherRecoveryV71:true},candidate,doc,now),false);
});
