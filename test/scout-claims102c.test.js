'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../scripts/scout-claims102c');
const {assess}=require('../editorial-production45');
const {audit,evidenceIssues}=require('../editorial-facts');
const {parseFeed,FEEDS}=require('../scripts/ten-agent-newsroom101');
const player='Kevin De Bruyne',selection={player,destination:'PSV'};
const reg={kind:'register',publisher:'UEFA',url:'https://www.uefa.com/uefachampionsleague/clubs/players/250008901--kevin-de-bruyne/',text:'Matches played: 4. Minutes played: 360. Assists: 1.'};
const vi={kind:'media',publisher:'Voetbal International',url:'https://www.vi.nl/nieuws/a',text:'Mounir Boualin meldt belangstelling van PSV voor Kevin De Bruyne.'};
const vp={kind:'media',publisher:'VoetbalPrimeur',url:'https://www.voetbalprimeur.nl/nieuws/b',text:'Volgens het Eindhovens Dagblad ontkent de club een gesprek met Kevin De Bruyne.'};
const docs=[reg,vi,vp];
const review=(line,type,citations,origin='onbekend')=>C.checkReview([{id:'S1',text:line}],
 {claims:[{id:'S1',type,supported:true,origin,citations:citations.map(i=>({source:i,quote:docs[i].text}))}]},docs,selection);
test('102C gedateerde RSS-omschrijving met byline, geen kopbewijs of future-datering',()=>{
 const now=Date.parse('2026-11-19T17:00:00Z');
 const rss='<rss><item><link>'+vi.url+'</link><title>Transfergerucht rondom PSV</title><pubDate>'+new Date(now).toUTCString()+'</pubDate><description>'+vi.text+'</description><dc:creator>Mounir Boualin</dc:creator></item></rss>';
 assert.equal(parseFeed(rss,FEEDS[0],now,{research:true})[0].byline,'Mounir Boualin');
 assert.equal(parseFeed(rss,FEEDS[0],now,{research:true})[0].passage,vi.text);
 assert.equal(parseFeed(rss,FEEDS[0],now-1000,{research:true})[0].passage,undefined);
 assert.equal(parseFeed(rss.replace(vi.text,''),FEEDS[0],now,{research:true})[0].passage,undefined);
});
test('102C juiste attributie en bronketen, geen overname of tweede bevestiging',()=>{
 const line='Volgens VI meldt Mounir Boualin belangstelling van PSV voor Kevin De Bruyne.';
 assert.deepEqual(review(line,C.types.media,[1],'Mounir Boualin').issues,[]);
 assert.ok(review(line,C.types.official,[1]).issues.length);
 assert.ok(review(line.replace('Mounir Boualin','de journalist'),C.types.media,[1],'Mounir Boualin').issues.length);
 assert.ok(review(line.replace('Volgens VI','Volgens VoetbalPrimeur'),C.types.media,[1]).issues.length);
 assert.ok(C.hardIssue('VI en VoetbalPrimeur melden onafhankelijk van elkaar interesse van PSV.',[vi,{...vi,publisher:'VoetbalPrimeur'}],selection));
});
test('102C tegenstrijdige VI/VP/ED-berichten vereisen beide bewijsplaatsen',()=>{
 const text='VI meldt belangstelling van PSV, terwijl VoetbalPrimeur het Eindhovens Dagblad citeert over het ontkende gesprek.';
 assert.deepEqual(review(text,C.types.conflict,[1,2],'Eindhovens Dagblad').issues,[]);
 assert.ok(review(text,C.types.conflict,[2],'Eindhovens Dagblad').issues.length);
});
test('102C gerucht blijft toegeschreven, verzonnen bedragen en bevestigingen vallen af',()=>{
 assert.ok(C.hardIssue('De transfer is rond.',docs,selection));
 assert.ok(C.hardIssue('Volgens VI heeft PSV twaalf miljoen euro geboden.',docs,selection));
 assert.ok(C.hardIssue('Tot op heden is er geen officiële bevestiging van de transfer.',docs,selection));
 assert.ok(C.hardIssue('Er zijn geruchten over een mogelijke overstap naar PSV.',[reg],selection));
 assert.deepEqual(review('Volgens VI meldt Mounir Boualin mogelijke interesse van PSV.',C.types.rumour,[1],'Mounir Boualin').issues,[]);
});
test('102C gemengd concept houdt drie registerstatistieken na zinsrevisie',()=>{
 const draft={headline:'De Bruyne in Europa',standfirst:'De UEFA-registraties geven zijn Europese inzet weer.',body:['Hij speelde vier duels, maakte 360 minuten en gaf één assist. Tot op heden is er geen officiële bevestiging van een transfer.']};
 const rows=C.sentences(draft),removed=new Set(rows.filter(r=>C.hardIssue(r.text,[reg],selection)).map(r=>r.id));
 assert.deepEqual(C.prune(draft,rows,removed).body,['Hij speelde vier duels, maakte 360 minuten en gaf één assist.']);
});
test('102C register kent geen eigen nieuwsdatum, alleen een gedateerde aanleiding draagt actualiteit',()=>{
 const now=Date.parse('2026-11-20T03:00Z'),scores={actuality:79,journalism:95,nationalValue:95,reliability:95,diversity:95,originality:95};
 const score=docs=>assess({review:{approved:true,issues:[],scores},docs,registerContext:true,now});
 assert.equal(score([reg]).scores.actuality,79);
 assert.equal(score([reg]).approved,false);
 assert.equal(score([{...vi,publishedAt:new Date(now-7200000).toISOString()}]).approved,true);
 assert.equal(score([{...vi,publishedAt:new Date(now-90*3600000).toISOString()}]).approved,false);
});
test('102C naamopening geldt voor UEFA-register, onbekende persoon blijft geblokkeerd',()=>{
 const draft={headline:'De UEFA-registraties tonen de Europese inzet.'},facts=['UEFA registreert Kevin De Bruyne bij Napoli.'];
 assert.deepEqual(evidenceIssues(draft,facts,null,reg.url),[]);
 assert.deepEqual(audit({draft,verifiedFacts:facts,sources:[reg],articleKind:'background'}),[]);
 assert.ok(evidenceIssues(draft,facts,null,vi.url).length);
 assert.ok(evidenceIssues({headline:'De UEFA-registraties noemen Peter Fantoom.'},facts,null,reg.url).length);
});
test('102C ontbrekend of vervalst zinsbewijs en onbekende bronindex blokkeren',()=>{
 const rows=[{id:'S1',text:'Hij speelde vier duels.'}];
 for(const claims of [[],[{id:'S1',type:C.types.official,supported:true,citations:[{source:0,quote:'Invented quote'}]}],
  [{id:'S1',type:C.types.official,supported:true,citations:[{source:55,quote:reg.text}]}]]){
  assert.ok(C.checkReview(rows,{claims},docs,selection).issues.length);
 }
});
test('102C productiereplay behoudt ED-ontkenning en verwijdert onbewezen handtekening en registerdatum',()=>{
 const line='Het Eindhovens Dagblad ontkent dat er een gesprek met de PSV-leiding was (VoetbalPrimeur, 17 november 2026).';
 const copy={headline:'Geen officiële bevestiging van de transfer',standfirst:'Een toekomstige overstap naar PSV is rond.',body:[
 'De Bruyne speelde vier wedstrijden en 360 minuten (UEFA, 20 nov 2026) en gaf één assist (UEFA, 20 nov 2026).',
 line,'La Gazzetta meldt dat er nog geen ondertekende overeenkomst is (VoetbalPrimeur).']};
 const {beforeReview}=C.prepareRevision(copy,docs,selection);
 assert.deepEqual(beforeReview.body,['De Bruyne speelde vier wedstrijden en 360 minuten en gaf één assist.',line]);
 assert.deepEqual(review(line,C.types.media,[2],'Eindhovens Dagblad via VoetbalPrimeur').issues,[]);
 assert.ok(review(line,C.types.media,[2],'Eindhovens Dagblad via Andere Krant').issues.length);
});
test('102C extra revisie kan nooit naar betaalde OpenAI of onbevestigde providers uitwijken',async()=>{
 const {EditorialProviderRouter}=require('../editorial-provider-router');
 let calls=0;
 const router=new EditorialProviderRouter({openaiKey:'configured',groqKey:'configured',geminiKey:'unconfirmed',
  fetcher:async()=>{calls++;throw Error('Onverwacht netwerkverzoek.');}});
 await assert.rejects(router.complete([],{task:'revision',freeOnly:true}),{code:'EDITORIAL_AI_UNAVAILABLE'});
 assert.equal(calls,0);
});
