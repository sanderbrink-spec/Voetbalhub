'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('../android-ui/assets/clubquiz-engine');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('android-ui/assets/clubquiz-bank.js','utf8'),ctx);const bank=JSON.parse(JSON.stringify(ctx.window.CLUBQUIZ_BANK));
test('every mode and level completes with exact requested count and immutable scoring after duplicate taps',()=>{
 for(const mode of Object.keys(E.MODES))for(const level of ['easy','normal','hard']){
  const r=E.createRound(bank,{mode,level,club:E.clubs(bank)[0]?.name,now:Date.parse('2026-11-02')});assert.equal(r.questions.length,E.MODES[mode]);assert.equal(new Set(r.questions.map(q=>q.id)).size,r.questions.length);
  for(const q of r.questions){assert.equal(r.next(),false);assert.equal(r.answer(q.correct).correct,true);assert.equal(r.answer(q.correct),null);assert.equal(r.next(),true);}assert.equal(r.done,true);assert.equal(r.score,E.MODES[mode]);assert.equal(r.answer(r.questions[0].correct),null);
 }
});
test('daily sequence and answer positions ignore recent history, level and caller random source',()=>{
 const now=Date.parse('2026-11-02T12:00:00Z'),a=E.createRound(bank,{mode:'daily',now});const b=E.createRound(bank,{mode:'daily',now,recent:bank.map(q=>q.id),level:'hard',rng:()=>0});assert.deepEqual(a.questions,b.questions);assert.notDeepEqual(a.questions,E.createRound(bank,{mode:'daily',now:now+86400000}).questions);
 assert.equal(E.dayKey(Date.parse('2026-11-02T23:00:00Z')),'2026-11-03');assert.equal(E.dayKey(Date.parse('2026-06-01T22:00:00Z')),'2026-06-02');assert.equal(E.dayKey(Date.parse('2026-03-28T23:30:00Z')),'2026-03-29');
});
test('records and first daily score survive 100 ordinary rounds and storage reload',()=>{
 const daily={mode:'daily',level:'mixed',day:'2026-11-02',score:4,total:10};let data=E.record(null,daily);data=E.record(data,{mode:'expert',level:'hard',day:'2026-11-02',score:25,total:25});
 for(let i=0;i<100;i++)data=E.record(data,{mode:'quick',level:'easy',day:'2026-11-02',score:1,total:10});data=E.state(JSON.parse(JSON.stringify(data)));assert.equal(data.history.length,50);assert.equal(data.records['expert:hard'],25);assert.equal(data.daily[daily.day].score,4);assert.equal(E.record(data,{...daily,score:10}).daily[daily.day].score,4);
 assert.equal(E.state({records:{'expert:hard':999},daily:{a:{}}}).records['expert:hard'],undefined);assert.throws(()=>E.record(data,{...daily,score:999}));
});
test('missing or expired pools cannot silently shorten a mode; historical bank remains available after season ends',()=>{
 assert.throws(()=>E.createRound(bank.slice(0,5),{mode:'expert'}),/onvoldoende/);for(const mode of Object.keys(E.MODES).filter(m=>m!=='stadium'))for(const level of ['easy','normal','hard'])assert.equal(E.createRound(bank,{mode,level,club:E.clubs(bank)[0]?.name,now:Date.parse('2028-01-01')}).questions.length,E.MODES[mode]);assert.throws(()=>E.createRound(bank,{mode:'stadium',now:Date.parse('2028-01-01')}),/onvoldoende/);assert.throws(()=>E.createRound(bank,{mode:'invalid'}));
});
test('historical questions bind to individually fetched primary-source receipts without empty winner or source',()=>{
 const receipts=require('../quiz/research37.json').receipts;for(const q of bank.filter(q=>q.id.startsWith('history-'))){assert.ok(receipts.some(r=>r.source===q.source&&r.winner&&r.matchSlug&&r.sha256.length===64),q.id);assert.ok(q.question.includes('finale')||q.question.includes('won'));}
 assert.equal(new Set(bank.map(q=>q.question.toLocaleLowerCase('nl'))).size,bank.length);assert.ok(bank.length>=300);
});

test('answer choices never present Germany and West Germany as two independent options',()=>{for(const q of bank)assert.equal(q.answers.includes('Duitsland')&&q.answers.includes('West-Duitsland'),false,q.id);});
