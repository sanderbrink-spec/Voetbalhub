'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {drawWritingBrief}=require('../scripts/editorial-draw-copy339');
const {reviseDraft,overlapPhrases}=require('../scripts/automatic-publication');
const {createEditorialDraft}=require('../editorial-ai');
const M=require('../editorial-desk-model');

const knvb='https://www.onsoranje.nl/nieuws/nederlands-elftal-mannen/82847/loting';
const uefa='https://www.uefa.com/uefanationsleague/news/02ab-example--knockout-ties/';
const facts=[
 'Oranje speelt in de kwartfinale van de Nations League twee keer tegen Portugal.',
 'Dat werd vrijdag bepaald tijdens de loting in Nyon.',
 'De wedstrijden worden in maart gespeeld.',
 'De eerste wedstrijd is in Nederland, de return wordt gespeeld in Portugal.',
 'In een eventuele halve finale treft Oranje de winnaar van het duel tussen Spanje en Frankrijk.'
];
const sourceDraft={
 headline:'Oranje speelt in de kwartfinale tegen Portugal na de loting',
 standfirst:'Oranje speelt in de kwartfinale van de Nations League twee keer tegen Portugal.',
 body:[facts[0],facts[1],facts[2],facts[3]]
};
const sources=[{url:knvb},{url:uefa}];
const candidate={kind:'announcement',category:'Nations League',topic:'Oranje tegen Portugal in kwartfinale Nations League'};
const docs=[{url:knvb,text:facts.join(' ')},{url:uefa,text:'Knockout stage draw results Quarter-final ties Netherlands vs Portugal The quarter-finals are two-legged ties in March.'}];

test('339: vijf gecontroleerde feiten zijn beschikbaar als zelfstandige kaarten, voorwaardelijke halve finale blijft voorwaardelijk',()=>{
 const brief=drawWritingBrief(facts);
 assert.equal(brief.factCards.length,5);
 assert.equal(brief.factCards[0].tegenstander,'Portugal');
 assert.equal(brief.factCards[1].eersteDuel,'Nederland thuis');
 assert.match(brief.factCards[4].voorwaarde,/alleen bij bereiken halve finale/);
 for(const phrase of facts)assert.ok(!JSON.stringify(brief).includes(phrase));
 assert.equal(overlapPhrases(docs[0].text,sourceDraft).length>0,true);
});
test('339: afwijkende tegenstander, niet bewezen details en niet herleidbaar vervolg krijgen geen feitenplan',()=>{
 assert.equal(drawWritingBrief(facts.map(f=>f.replace('return wordt gespeeld in Portugal','return wordt gespeeld in Spanje'))),null);
 assert.equal(drawWritingBrief(facts.slice(0,3)),null);
 assert.equal(drawWritingBrief([...facts.slice(0,4),'In een eventuele halve finale speelt Oranje zeker op 12 juni.']),null);
});
test('339: de desk accepteert alleen het expliciet gemarkeerde, tweebronnen-lotingsformaat',()=>{
 const base={articleKind:'announcement',verifiedFacts:facts,sources};
 assert.equal(M.briefEligible({...base,verifiedDrawBrief:true}),true);
 assert.equal(M.briefEligible(base),false);
 assert.equal(M.briefEligible({...base,verifiedDrawBrief:true,sources:[sources[0]]}),false);
 assert.equal(M.briefEligible({...base,verifiedDrawBrief:true,sources:[sources[1],sources[0]]}),false);
});
test('339: eerste schrijver ziet geen letterlijke bronzinnen en krijgt een compact plan',async()=>{
 const received=[];
 await assert.rejects(createEditorialDraft({
  topic:candidate.topic,category:'Nations League',facts,sourceUrls:[knvb,uefa],
  articleKind:'announcement',automaticPublication:true,compact:true,drawBrief:drawWritingBrief(facts)
 },{model:'openai/gpt-oss-120b',router:{complete:async messages=>{received.push(messages);return {skip:true};}}}),/Onvoldoende gecontroleerde feiten/);
 assert.equal(received.length,1);
 const [system,user]=received[0];
 assert.match(system.content,/één of twee alinea/);
 assert.doesNotMatch(system.content,/PRECIES drie/);
 const text=JSON.stringify(JSON.parse(user.content));
 assert.equal(JSON.parse(user.content).drawBrief.factCards.length,5);
 for(const line of facts)assert.ok(!text.includes(line));
 assert.ok(!Object.hasOwn(JSON.parse(user.content),'facts'));
});
test('339: herstelschrijver ontvangt geen oude bronkopie, geen bronpassages en behoudt 1-2 alinea-structuur',async()=>{
 const payload={draft:sourceDraft,articleKind:'announcement',category:'Nations League',verifiedFacts:facts,
  sources,verifiedDrawBrief:true};
 let system='',user;
 const revised=await reviseDraft(payload,candidate,docs,'Woordelijke bronoverlap. '+JSON.stringify(facts),
  {router:{complete:async messages=>{system=messages[0].content;user=JSON.parse(messages[1].content);return {skip:true};}}});
 assert.equal(revised,null);
 assert.match(system,/body \(1-2 inhoudelijk verschillende alinea/);
 assert.ok(!Object.hasOwn(user,'previousDraft'));
 assert.ok(!Object.hasOwn(user,'verifiedFacts'));
 assert.equal(user.drawBrief.factCards.length,5);
 const content=JSON.stringify(user);
 for(const line of facts)assert.ok(!content.includes(line));
});
