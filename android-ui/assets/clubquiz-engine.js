(function(root){
'use strict';
function shuffle(values,rng=Math.random){const a=values.slice();for(let i=a.length-1;i>0;i--){const j=Math.min(i,Math.floor(rng()*(i+1)));[a[i],a[j]]=[a[j],a[i]];}return a;}
function valid(q){return q&&typeof q.id==='string'&&['easy','normal','hard'].includes(q.level)&&typeof q.question==='string'&&Array.isArray(q.answers)&&q.answers.length===4&&new Set(q.answers).size===4&&q.answers.includes(q.correct)&&/^https:\/\//.test(q.source)&&q.reviewedAt==='2026-11-02';}
function select(bank,{level='easy',count=10,recent=[],rng=Math.random,now=Date.now()}={}){
 if(!['easy','normal','hard'].includes(level))throw Error('Onbekend niveau');
 const pool=bank.filter(q=>valid(q)&&q.level===level&&(!q.validUntil||Date.parse(q.validUntil)>now));
 const history=Array.isArray(recent)?recent.filter(x=>typeof x==='string'):[];
 // Unseen first. If the level is exhausted, prefer the least recently seen.
 const fresh=shuffle(pool.filter(q=>!history.includes(q.id)),rng);
 const seen=pool.filter(q=>history.includes(q.id)).sort((a,b)=>history.lastIndexOf(a.id)-history.lastIndexOf(b.id));
 return [...fresh,...seen].slice(0,Math.max(1,Math.min(20,Math.floor(count)||10))).map(q=>({...q,answers:shuffle(q.answers,rng)}));
}
class Round{
 constructor(questions){if(!questions.length)throw Error('Geen gecontroleerde vragen beschikbaar');this.questions=questions;this.index=0;this.score=0;this.answered=false;this.done=false;}
 answer(value){if(this.done||this.answered||!this.questions[this.index].answers.includes(value))return null;this.answered=true;const correct=value===this.questions[this.index].correct;if(correct)this.score++;return {correct,answer:this.questions[this.index].correct};}
 next(){if(this.done||!this.answered)return false;if(this.index+1===this.questions.length)this.done=true;else{this.index++;this.answered=false;}return true;}
}
const api={shuffle,valid,select,Round};if(typeof module==='object'&&module.exports)module.exports=api;else root.ClubQuiz=api;
})(typeof window==='object'?window:globalThis);
