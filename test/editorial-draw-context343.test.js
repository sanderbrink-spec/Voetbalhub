'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {oranjeDrawGroup}=require('../scripts/editorial-oranje-draw');
const {drawWritingBrief}=require('../scripts/editorial-draw-copy339');
const {validateEvidence,reopenVerifiedDrawContext343,overlapPhrases}=require('../scripts/automatic-publication');
const M=require('../editorial-desk-model');

const now=Date.parse('2026-11-20T18:20:00Z');
const knvb={
 url:'https://www.onsoranje.nl/nieuws/nederlands-elftal-mannen/82847/oranje-tegen-portugal-kwartfinale-nations-league',
 title:'Oranje tegen Portugal in kwartfinale Nations League',
 publishedAt:'2026-11-20T11:45:00Z',
 text:[
  'Oranje speelt in de kwartfinale van de Nations League twee keer tegen Portugal.',
  'Dat werd vrijdag bepaald tijdens de loting in Nyon, Zwitserland.',
  'De wedstrijden vinden in maart plaats.',
  'De eerste wedstrijd is in Nederland, de return wordt gespeeld in Portugal.',
  'In een eventuele halve finale treft Oranje de winnaar van het duel tussen Spanje en Frankrijk.'
 ].join(' ')
};
const uefa={
 url:'https://www.uefa.com/uefanationsleague/news/02ab-221d9e23448d-d862e943f6f2-1000--uefa-nations-league-quarter-final-and-play-off-ties-spain-vs/',
 title:'UEFA Nations League knockout draw',
 publishedAt:'2026-11-20T11:45:00Z',
 text:[
  "Spain will meet France while the Netherlands take on titleholders Portugal in March's UEFA Nations League quarter-finals.",
  'Knockout stage draw results Quarter-final ties Spain vs France Norway vs England Netherlands vs Portugal Belgium vs Germany The quarter-finals are two-legged ties and take place in March 2027.',
  'Teams listed second were seeded and will play the second legs at home.',
  'Winners advance to the Nations League finals.',
  'Semi-final ties Netherlands/Portugal vs Spain/France.'
 ].join(' ')
};
const sources=[{url:knvb.url},{url:uefa.url}];

test('343: verified UEFA context contributes original title-holder and competition stakes',()=>{
 const group=oranjeDrawGroup(knvb,[uefa],now);
 assert.ok(group?.drawCandidate);
 const facts=group.drawCandidate.facts;
 assert.equal(facts.length,8);
 assert.deepEqual(validateEvidence(group.drawCandidate,group,now),[]);
 assert.equal(facts.filter(f=>f.evidence[0].source===1).length,3);
 for(const fact of facts.filter(f=>f.evidence[0].source===1))
  assert.equal(fact.text,fact.evidence[0].quote);
 const brief=drawWritingBrief(facts.map(f=>f.text));
 assert.equal(brief.factCards.length,8);
 assert.equal(brief.factCards.find(x=>x.role==='sportieve inzet').gegeven,'Portugal is de regerend winnaar van de Nations League');
 assert.equal(brief.factCards.find(x=>x.role==='officiële UEFA-speelperiode').jaar,2027);
 assert.match(brief.factCards.find(x=>x.role==='sportief toernooigevolg').gegeven,/finaleronde/);
 assert.equal(brief.factCards.find(x=>x.role==='uitsluitend voorwaardelijk vervolg').voorwaarde,'alleen bij bereiken halve finale');
 assert.deepEqual(brief.plan.alinea1,['F4','F3','F7']);
 assert.deepEqual(brief.plan.alinea2,['F2','F5','F8']);
 const input=JSON.stringify(brief);
 for(const fact of facts)assert.ok(!input.includes(fact.text),'no source quote sent to writer');
 assert.equal(M.briefEligible({articleKind:'announcement',verifiedFacts:facts.map(f=>f.text),
  verifiedDrawBrief:true,sources}),true);
});

test('343: context is optional and cannot be borrowed from a different opponent',()=>{
 const noContext={...uefa,text:'Knockout stage draw results Quarter-final ties Spain vs France Netherlands vs Portugal The quarter-finals are two-legged ties in March.'};
 const plain=oranjeDrawGroup(knvb,[noContext],now);
 assert.equal(plain.drawCandidate.facts.length,5);
 assert.equal(drawWritingBrief(plain.drawCandidate.facts.map(f=>f.text)).factCards.length,5);
 const changed={...uefa,text:uefa.text.replace('titleholders Portugal','titleholders Spain')};
 const group=oranjeDrawGroup(knvb,[changed],now);
 assert.ok(group);
 assert.equal(group.drawCandidate.facts.some(f=>f.text.includes('titleholders Spain')),false);
 assert.equal(drawWritingBrief(group.drawCandidate.facts.map(f=>f.text)).factCards.some(x=>x.role==='sportieve inzet'),false);
 // A forged extra fact with a different country is never accepted as a card.
 const broken=group.drawCandidate.facts.map(f=>f.text).concat('Netherlands take on titleholders Spain');
 assert.equal(drawWritingBrief(broken),null);
});

test('343: exact 75-point quality error can re-open only once with all official context',()=>{
 const group=oranjeDrawGroup(knvb,[uefa],now);
 const error='Kwaliteitscontrole na 3 herschrijvingen: Journalistieke kwaliteit lager dan 85.';
 const hash=crypto.createHash('sha256').update(error).digest('hex');
 const job=()=>({status:'review',failureStage:'quality',failureCategory:'journalistic_rejection',
  errorHash:hash,urls:[knvb.url,uefa.url],checkpoint:{oldCopy:true}});
 const j=job();
 assert.equal(reopenVerifiedDrawContext343(j,group,now),true);
 assert.equal(j.status,'pending');
 assert.equal(j.drawContextRecovery343,true);
 assert.equal(j.checkpoint,undefined);
 assert.equal(reopenVerifiedDrawContext343(j,group,now),false);
 assert.equal(reopenVerifiedDrawContext343({...job(),errorHash:'0'.repeat(64)},group,now),false);
 assert.equal(reopenVerifiedDrawContext343({...job(),status:'published'},group,now),false);
 assert.equal(reopenVerifiedDrawContext343(job(),group,now+72*3600000),false);
 const weak=oranjeDrawGroup(knvb,[{...uefa,text:uefa.text.replace('Winners advance to the Nations League finals.','')}],now);
 assert.equal(reopenVerifiedDrawContext343(job(),weak,now),false);
 const forged=[group[0],{...group[1],text:'Geen actuele bevestiging'}];
 forged.drawCandidate=group.drawCandidate;
 assert.equal(reopenVerifiedDrawContext343(job(),forged,now),false);
});
