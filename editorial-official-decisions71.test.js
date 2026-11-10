'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {verifiedOfficialDisciplinaryDecision}=require('./editorial-official-decisions71');
const {validateEvidence}=require('./scripts/automatic-publication');
const M=require('./editorial-desk-model');
const doc={
 url:'https://www.fcgroningen.nl/nieuws/schikkingsvoorstel-voor-hateboer-geaccepteerd/',
 title:'Schikkingsvoorstel voor Hateboer geaccepteerd',
 publishedAt:'2026-11-09T13:40:58Z',
 text:'FC Groningen en Hans Hateboer hebben het schikkingsvoorstel van de aanklager betaald voetbal geaccepteerd. De verdediger kreeg zondag in de slotseconden tegen AZ een rode kaart wegens opzettelijk hands waardoor hij een duidelijke scoringskans voorkwam. Daardoor mist hij op zaterdag 21 november de Derby van het Noorden tegen sc Heerenveen. Ook doelman Etienne Vaessen ontbreekt in dat thuisduel met sc Heerenveen. Hij ontving tegen AZ twee gele kaarten en is daardoor automatisch voor één wedstrijd geschorst.'
};
test('officieel tuchtbesluit levert meerdere letterlijk bewezen verschillende feiten',()=>{
 const candidate=verifiedOfficialDisciplinaryDecision(doc);
 assert.ok(candidate);
 assert.equal(candidate.primaryAuthority,'club_decision');
 assert.equal(candidate.facts.length,3);
 for (const fact of candidate.facts) {
  assert.ok(doc.text.includes(fact.text));
  assert.equal(fact.evidence[0].quote,fact.text);
 }
 assert.deepEqual(validateEvidence(candidate,[doc],Date.parse('2026-11-10T13:00:00Z')),[]);
 assert.equal(M.briefEligible({articleKind:candidate.kind,primaryAuthority:candidate.primaryAuthority,sources:[{url:doc.url}],verifiedFacts:candidate.facts.map(x=>x.text)}),true);
});
test('gerucht, niet-geaccepteerd voorstel en inhoudsarme bron blijven uitgesloten',()=>{
 assert.equal(verifiedOfficialDisciplinaryDecision({...doc,title:'Mogelijk schikkingsvoorstel voor Hateboer'}),null);
 assert.equal(verifiedOfficialDisciplinaryDecision({...doc,text:'Kort nieuws.'}),null);
 assert.equal(verifiedOfficialDisciplinaryDecision({...doc,text:doc.text.split('. ').slice(0,2).join('. ')}),null);
});
