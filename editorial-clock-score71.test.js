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