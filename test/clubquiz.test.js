'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../android-ui/assets/clubquiz-engine');const context={window:{}};vm.runInNewContext(fs.readFileSync('android-ui/assets/clubquiz-bank.js','utf8'),context);const bank=JSON.parse(JSON.stringify(context.window.CLUBQUIZ_BANK));
test('quiz bank: unique reviewed questions, four unique answers, local approved photos with matching provenance',()=>{
 assert.equal(bank.length,307);assert.equal(new Set(bank.map(q=>q.id)).size,bank.length);
 const catalog=require('../news-photo-catalog.json').photos;
 for(const q of bank){assert.ok(E.valid(q),q.id);const photo=catalog.find(p=>p.file===q.image.file);assert.ok(photo?.approved);assert.equal(photo.credit,q.image.credit);assert.equal(photo.sourcePage,q.image.sourcePage);assert.ok(fs.existsSync('public/news-photos/'+q.image.file));}
});
test('questions avoid recent history, randomise answer order, and never repeat within a round',()=>{
 for(const level of ['easy','normal','hard']){const a=E.select(bank,{level,count:5});const b=E.select(bank,{level,count:5,recent:a.map(q=>q.id)});assert.equal(b.some(q=>a.some(x=>x.id===q.id)),false);assert.equal(new Set(a.map(q=>q.id)).size,a.length);}
 const a=E.select(bank,{rng:()=>0}),b=E.select(bank,{rng:()=>.999});assert.notDeepEqual(a.map(q=>q.id),b.map(q=>q.id));assert.notDeepEqual(a[0].answers,bank.find(q=>q.id===a[0].id).answers);
});
test('exhausted pool uses least recent first and expired season is not silently served',()=>{
 const pool=bank.filter(q=>q.level==='hard'),history=pool.map(q=>q.id);assert.deepEqual(E.select(bank,{level:'hard',recent:history,count:3}).map(q=>q.id),history.slice(0,3));
 assert.equal(E.select(bank.filter(q=>q.validUntil),{level:'easy',now:Date.parse('2027-08-01')}).length,0);
 assert.throws(()=>new E.Round([]),/Geen/);
});
test('score cannot be farmed by double taps, invalid answers or skipping questions',()=>{
 const round=new E.Round(E.select(bank,{count:3}));assert.equal(round.next(),false);assert.equal(round.answer('invalid'),null);
 for(let i=0;i<3;i++){assert.equal(round.answer(round.questions[i].correct).correct,true);assert.equal(round.answer(round.questions[i].correct),null);assert.equal(round.next(),true);}
 assert.equal(round.score,3);assert.equal(round.done,true);assert.equal(round.next(),false);assert.equal(round.answer('x'),null);
});
