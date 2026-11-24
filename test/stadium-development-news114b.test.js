'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {nationallyRelevant}=require('../scripts/automatic-publication');
const azSource='https://www.az.nl/inside-az/nieuws/2026/november/az-zet-volgende-stap-voor-groter-stadion-en-nieuw-te-ontwikkelen-gebied-rond-afas-stadion';
const actual={url:azSource,
 title:'AZ zet volgende stap voor groter stadion en nieuw te ontwikkelen gebied rond AFAS Stadion',
 text:'AZ wil het stadion ontwikkelen. De plannen voorzien in uitbreiding van de huidige capaciteit van ongeveer 19.500 plaatsen met 3.000 tot 4.000 plaatsen. Onder voorbehoud van procedures en vergunningen kan in 2027 met de eerste werkzaamheden worden begonnen.',
 publishedAt:'2026-11-23'};
test('114B: first-party AZ stadium capacity expansion is a potentially relevant editorial lead',()=>{
 assert.equal(nationallyRelevant(actual),true);
});
test('114B: outside or unapproved sources do not gain authority from stadium headline',()=>{
 for(const url of ['https://random-football-blog.example/az-plan','http://www.az.nl/nieuws/stadion','https://www.az.nl.evil.example/news'])
  assert.equal(nationallyRelevant({...actual,url}),false,url);
});
test('114B: repairs and routine football stadium notices stay filtered',()=>{
 for(const [title,text] of [
  ['Komende periode veldrenovatie AFAS Stadion','De grasmat krijgt onderhoud en wordt opgeknapt.'],
  ['Alle informatie over stadiontickets','De capaciteit van het stadion is 19.500 plaatsen. De kaartverkoop start.'],
  ['AZ opent nieuw supporterscafé','De horeca heeft plannen en extra plaatsen rondom het stadion.']
 ])assert.equal(nationallyRelevant({...actual,title,text}),false,title);
});
test('114B: a vague stadium idea without capacity proof is insufficient',()=>{
 assert.equal(nationallyRelevant({...actual,text:'AZ bespreekt plannen voor een mooier stadion en een levendige omgeving.'}),false);
});
