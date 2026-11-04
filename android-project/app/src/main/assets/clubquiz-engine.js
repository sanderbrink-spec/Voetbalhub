(function(root){
'use strict';
const MODES=Object.freeze({quick:10,club:20,expert:25,daily:10,stadium:10,player:10,grand:25}),VERSION='40.0';
function shuffle(values,rng=Math.random){const a=values.slice();for(let i=a.length-1;i>0;i--){const j=Math.min(i,Math.floor(rng()*(i+1)));[a[i],a[j]]=[a[j],a[i]];}return a;}
function valid(q){return q&&typeof q.id==='string'&&['easy','normal','hard'].includes(q.level)&&typeof q.question==='string'&&Array.isArray(q.answers)&&q.answers.length===4&&new Set(q.answers).size===4&&q.answers.every(a=>typeof a==='string'&&a.length>0)&&q.answers.includes(q.correct)&&/^https:\/\//.test(q.source)&&/^\d{4}-\d{2}-\d{2}$/.test(q.reviewedAt||'');}
function dayKey(now=Date.now()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
function seeded(seed){let h=2166136261;for(const c of seed){h=Math.imul(h^c.charCodeAt(0),16777619);}return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function select(bank,{level='easy',count=10,recent=[],rng=Math.random,now=Date.now()}={}){
 if(!['easy','normal','hard','mixed'].includes(level))throw Error('Onbekend niveau');
 const pool=bank.filter(q=>valid(q)&&(level==='mixed'||q.level===level)&&(!q.validUntil||Date.parse(q.validUntil)>now));
 const history=Array.isArray(recent)?recent.filter(x=>typeof x==='string'):[];
 const fresh=shuffle(pool.filter(q=>!history.includes(q.id)),rng);
 const seen=pool.filter(q=>history.includes(q.id)).sort((a,b)=>history.lastIndexOf(a.id)-history.lastIndexOf(b.id));
 return [...fresh,...seen].slice(0,Math.max(1,Math.min(25,Math.floor(count)||10))).map(q=>({...q,answers:shuffle(q.answers,rng)}));
}
function clubs(bank){const counts=new Map();for(const q of bank.filter(valid))for(const club of new Set(q.clubs||[]))counts.set(club,(counts.get(club)||0)+1);return [...counts].filter(([,n])=>n>=MODES.club).map(([name,count])=>({name,count})).sort((a,b)=>a.name.localeCompare(b.name,'nl'));}
function createRound(bank,{mode='quick',level='easy',club='',recent=[],now=Date.now(),rng=Math.random}={}){
 if(!Object.hasOwn(MODES,mode))throw Error('Onbekende spelvorm');
 const day=dayKey(now),daily=mode==='daily';
 if(mode==='club'&&!clubs(bank).some(c=>c.name===club))throw Error('Kies een club met ten minste 20 gecontroleerde vragen.');
 const pool=mode==='club'?bank.filter(q=>q.clubs?.includes(club)):mode==='stadium'?bank.filter(q=>q.topic==='stadium'):mode==='player'?bank.filter(q=>q.topic==='player'):bank;
 const roundLevel=daily||['club','stadium','player'].includes(mode)?'mixed':mode==='expert'?'hard':level;
 let questions=select(pool,{level:roundLevel,count:MODES[mode],recent:daily?[]:recent,now:daily?Date.parse(day+'T00:00:00Z'):now,rng:daily?seeded(VERSION+':'+day):rng});
 if(mode==='grand')questions=[...select(bank,{level:'easy',count:8,recent,rng,now}),...select(bank,{level:'normal',count:8,recent,rng,now}),...select(bank,{level:'hard',count:9,recent,rng,now})];
 if(questions.length!==MODES[mode])throw Error('Voor dit niveau zijn onvoldoende actuele vragen beschikbaar. Kies een ander niveau.');
 return new Round(questions,{mode,level:mode==='grand'?'mixed':roundLevel,day,...(mode==='club'?{club}: {})});
}
class Round{
 constructor(questions,meta={}){if(!questions.length)throw Error('Geen gecontroleerde vragen beschikbaar');this.questions=questions;this.index=0;this.score=0;this.points=0;this.correctMs=0;this.answered=false;this.done=false;this.meta=meta;}
 answer(value,elapsedMs=0){if(this.done||this.answered||!this.questions[this.index].answers.includes(value))return null;this.answered=true;const q=this.questions[this.index],correct=value===q.correct&&elapsedMs<15000;const points=correct?Math.round(100+150*(15000-Math.max(0,elapsedMs))/15000):0;if(correct){this.score++;this.correctMs+=Math.max(0,elapsedMs);}this.points+=points;return {correct,points,answer:q.correct};}
 timeout(){if(this.done||this.answered)return null;this.answered=true;return {correct:false,points:0,answer:this.questions[this.index].correct};}
 next(){if(this.done||!this.answered)return false;if(this.index+1===this.questions.length)this.done=true;else{this.index++;this.answered=false;}return true;}
}
function validResult(r){return r&&Object.hasOwn(MODES,r.mode)&&['easy','normal','hard','mixed'].includes(r.level)&&r.total===MODES[r.mode]&&Number.isInteger(r.score)&&r.score>=0&&r.score<=r.total&&/^\d{4}-\d{2}-\d{2}$/.test(r.day||'');}
function history(value){return Array.isArray(value)?value.filter(validResult).slice(-50):[];}
function saveResult(previous,result){const rows=history(previous);if(!validResult(result))throw Error('Ongeldige score');if(result.mode==='daily'&&rows.some(r=>r.mode==='daily'&&r.day===result.day))return rows;return [...rows,result].slice(-50);}
function best(rows,mode,level){const scores=history(rows).filter(r=>r.mode===mode&&(mode==='daily'||r.level===level));return scores.length?Math.max(...scores.map(r=>r.score)):null;}
function state(value){
 const result={history:history(Array.isArray(value)?value:value?.history),records:{},daily:{}};
 if(value?.records&&typeof value.records==='object')for(const [key,score] of Object.entries(value.records)){const [mode,level]=key.split(':');if(Object.hasOwn(MODES,mode)&&['easy','normal','hard','mixed'].includes(level)&&Number.isInteger(score)&&score>=0&&score<=MODES[mode])result.records[key]=score;}
 if(value?.daily&&typeof value.daily==='object')for(const [day,r] of Object.entries(value.daily).sort().slice(-62)){if(validResult(r)&&r.mode==='daily'&&r.day===day)result.daily[day]=r;}
 for(const r of result.history){const key=r.mode+':'+r.level;result.records[key]=Math.max(result.records[key]||0,r.score);if(r.mode==='daily'&&!result.daily[r.day])result.daily[r.day]=r;}return result;
}
function record(previous,r){const data=state(previous);if(!validResult(r))throw Error('Ongeldige score');if(r.mode==='daily'&&data.daily[r.day])return data;data.history=saveResult(data.history,r);const key=r.mode+':'+r.level;data.records[key]=Math.max(data.records[key]||0,r.score);if(r.mode==='daily')data.daily[r.day]=r;return state(data);}
const api={MODES,VERSION,shuffle,valid,select,Round,dayKey,seeded,clubs,createRound,validResult,history,saveResult,best,state,record};if(typeof module==='object'&&module.exports)module.exports=api;else root.ClubQuiz=api;
})(typeof window==='object'?window:globalThis);
