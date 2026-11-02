'use strict';
// Synthetic UI data only. Never imported into production storage or rights registers.
const now=Date.parse('2026-10-30T12:00:00Z');
const teams=Array.from({length:18},(_,i)=>({id:String(i+1),name:i===0?'Ajax':i===1?'AZ':'Testclub '+(i+1)}));
const balance={played:9,win:3,draw:3,lose:3,goals:{for:12,against:12}};
const fixture={id:'synthetic-upcoming',date:'2026-10-31T20:00:00Z',round:'Test ronde',status:'NS',home:teams[0],away:teams[1]};
const past={...fixture,id:'synthetic-past',date:'2026-10-24T20:00:00Z',status:'FT',goals:{home:1,away:0}};
const player={name:'Testspeler',team:'Ajax',goals:3,assists:2,yellow:1,red:0,appearances:9,minutes:810};
const stats={schemaVersion:1,updatedAt:new Date(now).toISOString(),league:{id:88,season:2026},standings:teams.map((team,i)=>({team,rank:i+1,points:20-i,form:'WDLDW',all:balance,home:balance,away:balance})),fixtures:[past,fixture],players:{scorers:[player],assists:[player],yellow:[player],red:[player]},featured:{fixtureId:fixture.id,round:'Test ronde',preview:{fixture,standfirst:'Synthetische vooruitblik voor een geïsoleerde browsertest.',body:['Eerste fictieve testalinea over de thuisclub.','Tweede fictieve testalinea over de uitclub.','Derde fictieve testalinea over de voorbereiding.'],homeForm:[past],awayForm:[past],headToHead:[past],scorers:[player]}}};
const p=require('../../test/fixtures/editorial-chain.json');
const articles={articles:[{id:'synthetic-news',status:'published',author:'Veldio Redactie',publishedAt:new Date(now).toISOString(),category:p.category,...p.draft}]};
module.exports={stats,articles,now};
