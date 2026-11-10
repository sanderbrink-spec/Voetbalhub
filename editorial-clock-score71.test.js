'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {requiresFlashscore}=require('./editorial-desk-model');
const {evidenceIssues}=require('./editorial-facts');
const url='https://www.fcgroningen.nl/nieuws/schikkingsvoorstel-voor-hateboer-geaccepteerd/';
const facts=[
 'Het schikkingsvoorstel van de aanklager betaald voetbal is geaccepteerd.',
 'Hans Hateboer kreeg bij de wedstrijd tegen AZ een rode kaart.',
 'De verdediger mist het competitieduel tegen sc Heerenveen.'
];
test('14:40 en 08:45 zijn tijden en niet automatisch uitslagen',()=>{
 for(const value of ['Het persbericht verschijnt om 14:40.', 'De club begint om 08:45 met een bijeenkomst.']){
  assert.equal(requiresFlashscore({headline:'Clubnieuws',standfirst:value,body:[]}),false);
 }
});
test('werkelijke uitslag of statistiek blijft een gecontroleerde bron vereisen',()=>{
 for(const value of ['FC Groningen wint met 2:1.', 'De eindstand is 2-2.', 'Het team heeft 60 procent balbezit.', 'De ploeg krijgt twee rode kaarten.']){
  assert.equal(requiresFlashscore({headline:'Wedstrijd',standfirst:value,body:[]}),true);
 }
});
test('gepubliceerd tijdstip mag ook in langere zinsvolgorde geen beslismoment worden',()=>{
 const draft={headline:'FC Groningen informeert over Hans Hateboer',
  standfirst:'FC Groningen meldt dat een schikkingsvoorstel is geaccepteerd.',
  body:['Maandag 09 november 2026 om 14:40 heeft de club samen met Hans Hateboer het schikkingsvoorstel van de aanklager betaald voetbal aanvaard.']};
 assert.ok(evidenceIssues(draft,facts,null,url).some(x=>x.includes('publicatietijdstip')));
 const revised={...draft,body:['Volgens FC Groningen is het schikkingsvoorstel voor Hans Hateboer aanvaard.']};
 assert.ok(!evidenceIssues(revised,facts,null,url).some(x=>x.includes('publicatietijdstip')));
});

test('onbewezen publicatietijd wordt alleen uit herkenbaar officieel besluit geschrapt',()=>{
 const {repairUnsupportedDecisionTimestamp}=require('./scripts/automatic-publication');
 const draft={headline:'FC Groningen bevestigt besluit rond Hateboer',
  standfirst:'FC Groningen meldt de aanvaarding van het schikkingsvoorstel.',
  body:[
   'Op maandag 09 november 2026 om 14:40 hebben zowel de club als de speler het schikkingsvoorstel van de aanklager betaald voetbal voor de rode kaart van Hans Hateboer aanvaard.',
   'De verdediger mist de wedstrijd tegen sc Heerenveen.'
  ]};
 const safe=repairUnsupportedDecisionTimestamp(draft,facts,url,'club_decision');
 assert.notEqual(safe,draft);
 assert.equal(safe.body[0],'Zowel de club als de speler hebben het schikkingsvoorstel van de aanklager betaald voetbal voor de rode kaart van Hans Hateboer aanvaard.');
 assert.ok(!safe.body.join(' ').includes('14:40'));
 assert.ok(!evidenceIssues(safe,facts,null,url).some(x=>x.includes('publicatietijdstip')));
 assert.ok(evidenceIssues(draft,facts,null,url).some(x=>x.includes('publicatietijdstip')));
});

test('onzekere bron, ander genre of onbekende zinsbouw blijven afgewezen',()=>{
 const {repairUnsupportedDecisionTimestamp}=require('./scripts/automatic-publication');
 const draft={headline:'Clubnieuws van FC Groningen',standfirst:'Het voorstel is geaccepteerd.',
  body:['Op maandag 09 november 2026 om 14:40 hebben de club en de speler het voorstel aanvaard.']};
 for(const [src,authority] of [['https://fake.example/news','club_decision'],[url,'transfer'],[url,'club_decision']]){
  const unchanged=repairUnsupportedDecisionTimestamp(draft,facts,src,authority);
  assert.equal(unchanged,draft);
  assert.ok(evidenceIssues(unchanged,facts,null,url).some(x=>x.includes('publicatietijdstip')));
 }
});

test('bewezen besluitmoment wordt niet herschreven',()=>{
 const {repairUnsupportedDecisionTimestamp}=require('./scripts/automatic-publication');
 const exact='Op maandag 09 november 2026 om 14:40 hebben zowel de club als de speler het schikkingsvoorstel aanvaard.';
 const draft={headline:'FC Groningen bevestigt een besluit',standfirst:'Het schikkingsvoorstel is geaccepteerd.',body:[exact]};
 assert.equal(repairUnsupportedDecisionTimestamp(draft,[...facts,exact],url,'club_decision'),draft);
});


test('losse club is enkelvoud en samengesteld onderwerp blijft onaangeraakt',()=>{
 const {repairUnsupportedDecisionTimestamp}=require('./editorial-ai');
 const core={headline:'FC Groningen maakt besluit bekend',standfirst:'De club aanvaardt het schikkingsvoorstel.'};
 const single={...core,body:['Op maandag 09 november 2026 om 14:40 heeft de club het schikkingsvoorstel aanvaard.']};
 assert.equal(repairUnsupportedDecisionTimestamp(single,facts,url,'club_decision').body[0],'De club heeft het schikkingsvoorstel aanvaard.');
 const split={...core,body:['Op maandag 09 november 2026 om 14:40 hebben de club en de speler het schikkingsvoorstel aanvaard.']};
 assert.equal(repairUnsupportedDecisionTimestamp(split,facts,url,'club_decision'),split);
});
