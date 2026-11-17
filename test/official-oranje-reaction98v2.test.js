'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {confirmedFederationCoachReaction,primaryAuthority,validateEvidence,editorialMatchSnapshot}=require('../scripts/automatic-publication');
const URL='https://www.onsoranje.nl/nieuws/nederlands-elftal-mannen/82840/xavi-dit-was-g%C3%AAnant-en-kunnen-we-niet-accepteren';
const article={
 url:URL,title:"Xavi: 'Dit was gênant en kunnen we niet accepteren'",
 publishedAt:'2026-11-16T22:30:00.000Z',
 text:[
  'Bondscoach Xavi Hernández reageerde vol ongeloof op de 5-0 nederlaag van het Nederlands elftal tegen Duitsland.',
  '"Ik ben geschokt. Ik snap niet hoe dit kon gebeuren en ben zeer teleurgesteld."',
  "De Spanjaard sprak harde woorden en noemde de nederlaag in Berlijn 'beschamend'.",
  '"Ik heb tegen de spelers gezegd dat we de mentaliteit moeten veranderen. Vandaag konden we niet mee met Duitsland, aangezien we niet trouw waren aan onze waarden. Dit kunnen we niet accepteren."',
  'Xavi hekelde de instelling van zijn ploeg.',
  '"Vooral afgelopen vrijdag tegen Griekenland lieten we veel goeds zien. Vandaag het tegenovergestelde, terwijl we iets goeds aan het bouwen waren. We zullen hier veel van leren."',
  'Denzel Dumfries droeg de aanvoerdersband. "Het was gewoon een collectief falen en ik ben zeer boos."'
 ].join(' ')
};
test('98V-2: three first-hand coach quotations become literal attributed facts without a match score',()=>{
 const candidate=confirmedFederationCoachReaction(article);
 assert.ok(candidate);
 assert.equal(candidate.kind,'announcement');
 assert.equal(candidate.officialReaction,true);
 assert.equal(candidate.primaryAuthority,'association_decision');
 assert.equal(primaryAuthority(article),'association_decision');
 assert.equal(candidate.facts.length,3);
 assert.equal(require('../editorial-desk-model').briefEligible({articleKind:candidate.kind,primaryAuthority:candidate.primaryAuthority,sources:[{url:article.url}],verifiedFacts:candidate.facts.map(f=>f.text)}),true);
 assert.ok(candidate.facts.some(f=>f.text==='Bondscoach Xavi Hernández reageerde op de nederlaag van het Nederlands elftal.'));

 assert.equal(candidate.facts.some(f=>/5-0|Denzel|collectief falen/.test(f.text)),false);
 assert.ok(candidate.facts.every(f=>article.text.includes(f.evidence[0].quote)));
 assert.deepEqual(validateEvidence(candidate,[article],Date.parse('2026-11-17T14:00:00Z')),[]);
});
test('98V-2: headline alone, unknown reporter, women or someone else speaking never acquires official coach authority',()=>{
 assert.equal(confirmedFederationCoachReaction({...article,text:'Bondscoach Xavi Hernández reageerde na afloop. Hij had niets te melden.'}),null);
 assert.equal(confirmedFederationCoachReaction({...article,url:'https://www.voetbalprimeur.nl/nieuws/12345'}),null);
 assert.equal(confirmedFederationCoachReaction({...article,title:'Oranje Vrouwen: bondscoach reageerde'}),null);
 assert.equal(confirmedFederationCoachReaction({...article,title:'Denzel: reactie op de wedstrijd'}),null);
 const other={...article,text:'Bondscoach Xavi Hernández reageerde. "Ik ben geschokt en teleurgesteld over wat er is gebeurd." Denzel Dumfries droeg de band. "Het was een vernedering die we niet zomaar kunnen accepteren." Keeper Bart Verbruggen sprak. "Het was niet goed genoeg en ik ben woedend."'};
 assert.equal(confirmedFederationCoachReaction(other),null);
});
test('98V-2: distinct Sportmonks empty windows and outages are recorded before fallback',async()=>{
 const api=async endpoint=>endpoint.startsWith('/editorial-sportmonks-recent')
   ?{status:'empty_recent_window',fixtures:[],coverage:'verified_recent_finals_only'}
   :{status:'available',fixtures:[]};
 const signals=[];
 await editorialMatchSnapshot('eredivisie','/integrations/football?competition=eredivisie',api,Date.now(),signals);
 assert.equal(signals[0].outcome,'recent_sportmonks_empty_window');
 const signals2=[];
 await editorialMatchSnapshot('eredivisie','/integrations/football?competition=eredivisie',
  async endpoint=>endpoint.startsWith('/editorial-sportmonks-recent')?{status:'source_unavailable'}:{status:'available',fixtures:[]},Date.now(),signals2);
 assert.equal(signals2[0].outcome,'recent_sportmonks_source_unavailable');
});

test('98V-2: a KNVB quote article attributes both lead and details to its first-party publisher',()=>{
 const candidate=confirmedFederationCoachReaction(article);
 const {editorialAttributionIssues}=require('../editorial-ai');
 const draft={
  headline:'Xavi Hernández noemt de instelling van zijn ploeg onvoldoende',
  standfirst:'De KNVB meldt via OnsOranje dat Xavi Hernández zijn kritiek op de instelling van de spelers heeft toegelicht.',
  body:[
   'Volgens de KNVB was Xavi Hernández geschokt over de manier waarop zijn elftal speelde. De bondscoach was teleurgesteld over wat hij zag.',
   'Xavi Hernández wees op de mentaliteit van zijn spelers en zei dat die anders moest. Hij voelde dat de ploeg zijn waarden niet naleefde.',
   'De uitspraken laten vooral het verschil zien tussen zijn eerdere trots en zijn huidige teleurstelling. Hij wil begrijpen wat er is gebeurd.'
  ]
 };
 assert.deepEqual(editorialAttributionIssues(draft,{
  primaryAuthority:'association_decision',sourceUrls:[URL],
  facts:candidate.facts.map(f=>f.text)
 }),[]);
});

test('98V-2: only the exact fresh, first-party, previously fact-limited draft may retry once in compact form',()=>{
 const {reopenCompactOranjeReaction98V}=require('../scripts/automatic-publication');
 const now=Date.parse('2026-11-17T18:30:00Z');
 const candidate=confirmedFederationCoachReaction(article);
 const group=Object.assign([article],{officialReactionCandidate:candidate});
 const old={status:'review',failureStage:'generation',failureCategory:'journalistic_rejection',
  reason:'insufficient_verified_facts',attempts:1,urls:[URL],
  errorHash:'235b9a004c20c01180bc71375746bbe14f9b423fb3c43bbc3c9233e2eda27b13',
  checkpoint:{draft:{headline:'rejected, never reuse'}}};
 assert.equal(reopenCompactOranjeReaction98V(old,group,now),true);
 assert.equal(old.status,'pending');
 assert.equal(old.attempts,0);
 assert.equal(old.nextAttemptAt,now);
 assert.equal(old.checkpoint,undefined);
 assert.equal(reopenCompactOranjeReaction98V(old,group,now),false);
 const error={...old,status:'review',failureStage:'quality',failureCategory:'journalistic_rejection'};
 assert.equal(reopenCompactOranjeReaction98V(error,group,now),false);
 const wrong={...old,status:'review',failureStage:'generation',compactOranjeReaction98V:false,urls:['https://www.onsoranje.nl/nieuws/nederlands-elftal-mannen/123/other']};
 assert.equal(reopenCompactOranjeReaction98V(wrong,group,now),false);
 const stale={...old,status:'review',failureStage:'generation',compactOranjeReaction98V:false};
 assert.equal(reopenCompactOranjeReaction98V(stale,group,Date.parse('2026-12-01T00:00:00Z')),false);
});
