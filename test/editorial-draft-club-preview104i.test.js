'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {cleanPayload,fingerprint}=require('../editorial-drafts');
const {verifiedClubPreviewHistory}=require('../editorial-facts');
const {publicationIssues}=require('../editorial-desk-model');
const f={id:'sm-19714591',competition:'eredivisie',status:'NS',round:'Speelronde 13',
 date:'2026-11-21T20:00:00Z',home:{name:'FC Groningen'},away:{name:'sc Heerenveen'}};
const d={headline:'Groningen ontvangt Heerenveen met bijzondere voorgeschiedenis',
 standfirst:'In de eerdere onderlinge duels boekte FC Groningen drie zeges en Heerenveen treedt aan met vier overwinningen op rij.',
 body:[
  'Casper Goedkoop vervangt Dick Lukkien in deze derby. De club meldt dat de assistent-trainer de afsluitende trainingen leidt in aanloop naar het duel.',
  'Groningen won drie vorige onderlinge duels. Heerenveen komt met vier overwinningen achtereen naar Groningen, blijkt uit de competitievooruitblik van deze week.',
  'Thom van Bergen was trefzeker tijdens vier recente thuiswedstrijden. Voor Heerenveen was Ringo Meerveld in vier competitieduels over 154 speelminuten bij vijf treffers betrokken.'
 ]};
const facts=[
 'Zo leidt de assistent-trainer de afsluitende trainingen in aanloop naar het thuisduel met sc Heerenveen.',
 'Casper Goedkoop zal voor het eerst in zijn periode als trainer bij FC Groningen hoofdtrainer Dick Lukkien vervangen.',
 'Groningen won de laatste drie ontmoetingen met de Friezen en kan zijn langste winstreeks tegen Heerenveen evenaren.',
 'FC Groningen ontvangt sc Heerenveen, dat met vier opeenvolgende overwinningen naar Groningen afreist.',
 'Thom van Bergen scoorde in zijn laatste vier thuiswedstrijden voor FC Groningen.',
 'Bij Heerenveen was Ringo Meerveld in zijn laatste vier competitieduels in slechts 154 minuten betrokken bij vijf doelpunten.'
];
const payload={articleKind:'preview',category:'Eredivisie',fixture:f,feedLifecycle:{kind:'preview',expiresAt:f.date},
 draft:d,verifiedFacts:facts,sources:[
 {url:'https://www.fcgroningen.nl/nieuws/goedkoop-neemt-honneurs-waar-bij-derby-van-het-noorden/'},
 {url:'https://eredivisie.nl/nieuws/vooruitblik-speelronde-13/'}
 ],editorialChecks:{originalSourceReviewed:true,claimsIndependentlyChecked:true,
  duplicateChecked:true,languageChecked:true},imageRights:'original-ai'};
test('104I: schone conceptopslag bewaart het volledige bewezen Eredivisie-previewtype',()=>{
 const clean=cleanPayload(payload);
 assert.equal(clean.fixture.id,'sm-19714591');
 assert.equal(clean.fixture.competition,'eredivisie');
 assert.equal(clean.fixture.status,'NS');
 assert.deepEqual(clean.fixture.home,{name:'FC Groningen'});
 assert.deepEqual(clean.fixture.away,{name:'sc Heerenveen'});
 assert.equal(clean.feedLifecycle.kind,'preview');
 assert.equal(verifiedClubPreviewHistory(payload),true);
 assert.equal(verifiedClubPreviewHistory(clean),true);
 assert.ok(!publicationIssues(clean).some(x=>/Wedstrijdverslag:|Feitencontrole ontbreekt/.test(x)));
 assert.equal(fingerprint(payload),fingerprint(clean));
});
test('104I: een uitslag, ontbrekende ploeg of onbevoegd fixturetype mag de uitslagpoort niet ontwijken',()=>{
 for(const fixture of [{...f,status:'FT'},{...f,id:'custom-123'},{...f,home:null},
  {...f,date:'ongeldig'},{...f,competition:'kkd'}]){
  const clean=cleanPayload({...payload,fixture});
  assert.equal(clean.fixture,undefined);
  assert.ok(!verifiedClubPreviewHistory(clean));
 }
});
test('104I: bestaande officiële UEFA-preview velden blijven onveranderd',()=>{
 const clean=cleanPayload({articleKind:'preview',fixture:{id:'uefa-12',homeTeam:'Nederland',awayTeam:'Portugal',
  date:'2027-03-25',venueName:'Amsterdam'}});
 assert.deepEqual(clean.fixture,{id:'uefa-12',homeTeam:'Nederland',awayTeam:'Portugal',
  date:'2027-03-25',venueName:'Amsterdam'});
});
