'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const E=require('./selection');
const bank=require('./questions.json');
const LIMIT=15000,FACTORS={easy:1,normal:1.5,hard:2};
function points(correct,elapsed,level){if(!correct||!Number.isFinite(elapsed)||elapsed<0||elapsed>=LIMIT)return 0;return Math.round((100+100*(LIMIT-elapsed)/LIMIT)*FACTORS[level]);}
function week(day){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
function compare(a,b){return b.points-a.points||b.correct-a.correct||a.correctMs-b.correctMs;}
function rank(rows){const sorted=rows.slice().sort((a,b)=>compare(a,b)||a.playerId.localeCompare(b.playerId));return sorted.map((r,i)=>({...r,position:i&&compare(r,sorted[i-1])===0?sorted.findIndex(x=>compare(r,x)===0)+1:i+1}));}
function selection({mode='quick',level='easy',club='',day=E.dayKey()}={}){
 if(!Object.hasOwn(E.MODES,mode)||!['easy','normal','hard'].includes(level)||typeof club!=='string'||club.length>80)throw Error('Ongeldige spelvorm.');
 const seed=mode==='daily'?day:week(day),rng=E.seeded('39-ranked:'+mode+':'+level+':'+club+':'+seed);
 const round=E.createRound(bank,{mode,level,club,now:Date.parse(day+'T12:00:00Z'),rng});
 const ids=round.questions.map(q=>q.id);const setId=crypto.createHash('sha256').update(JSON.stringify({version:39,mode,ids,levels:round.questions.map(q=>q.level)})).digest('hex').slice(0,24);
 return {mode,level:round.meta.level,club,day,week:week(day),setId,questions:round.questions};
}
module.exports={bank,E,LIMIT,FACTORS,points,week,compare,rank,selection};
