'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const S=require('../android-ui/assets/quiz-seasons40'),raw=require('../quiz39/questions.json');
test('dated UEFA finals fix the affected 51 season labels without changing choices or score identities',()=>{
 const proof=require('../quiz/season-corrections40.json').corrections;assert.equal(proof.length,51);
 for(const row of proof){const q=raw.find(q=>q.id===row.id),fixed=S.repair(q),end=Number(row.finalDate.slice(0,4));assert.equal(fixed.question,row.after);assert.ok(fixed.question.includes(`${end-1}/${String(end%100).padStart(2,'0')}`));assert.equal(fixed.id,q.id);assert.deepEqual(fixed.answers,q.answers);assert.equal(fixed.correct,q.correct);assert.equal(q.question,row.before);}
 const b=S.repair(raw.find(q=>q.id==='history-uefachampionsleague-2020-winner'));assert.equal(b.question,'Welke club won de Champions League 2019/20?');assert.equal(b.correct,'Bayern München');
 const c=S.repair(raw.find(q=>q.id==='history-uefachampionsleague-2021-winner'));assert.equal(c.question,'Welke club won de Champions League 2020/21?');assert.equal(c.correct,'Chelsea');
});
test('frozen online option IDs and already repaired or unrelated text are retained',()=>{
 const legacy={id:'history-uefachampionsleague-2020-winner',text:'Welke club won de Champions League 2020/21?',options:[{id:'frozen-choice',text:'Bayern München'}]};const fixed=S.repair(legacy);assert.equal(fixed.text,'Welke club won de Champions League 2019/20?');assert.deepEqual(fixed.options,legacy.options);assert.deepEqual(S.repair(fixed),fixed);assert.equal(S.repair({...legacy,text:'New independently reviewed question'}).text,'New independently reviewed question');
});
test('the packaged runtime keeps all questions and updates only the 51 verified labels',()=>{const ctx={window:{}};vm.runInNewContext(fs.readFileSync('android-ui/assets/clubquiz-bank.js','utf8'),ctx);const before=JSON.parse(JSON.stringify(ctx.window.CLUBQUIZ_BANK));vm.runInNewContext(fs.readFileSync('android-ui/assets/quiz-seasons40.js','utf8'),ctx);const after=JSON.parse(JSON.stringify(ctx.window.CLUBQUIZ_BANK));assert.equal(after.length,before.length);assert.equal(after.filter((q,i)=>q.question!==before[i].question).length,51);for(let i=0;i<after.length;i++){assert.equal(after[i].id,before[i].id);assert.deepEqual(after[i].answers,before[i].answers);assert.equal(after[i].correct,before[i].correct);}});
