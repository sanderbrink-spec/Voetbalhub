'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const text=fs.readFileSync('.github/workflows/automatic-publication.yml','utf8').split('script: |\n')[1].split('\n').map(line=>line.startsWith('            ')?line.slice(12):line).join('\n');
const execute=new (Object.getPrototypeOf(async function(){}).constructor)('require','github','context','core',text);
for(const scenario of ['quiet','rejected','technical','published'])test('publication monitoring distinguishes '+scenario,async()=>{
 const report={outcome:scenario==='technical'?'error':scenario==='published'?'success':'no_suitable_news',counts:{selected:scenario==='rejected'?2:0,generated:scenario==='rejected'?2:0,published:scenario==='published'?1:0},skipped:scenario==='rejected'?[{topic:'Test',reason:'Score 73 is lager dan 85'}]:[],signals:[],processingErrors:scenario==='technical'?[{reason:'Opslagfout'}]:[]};
 const mutations=[],failures=[],warnings=[];
 const existing=scenario==='published'?[{number:7,title:'[Veldio] Redactie: geen publiceerbare artikelen'}]:[];
 const github={rest:{issues:{listForRepo:async()=>({data:existing}),create:async args=>mutations.push(args),update:async args=>mutations.push(args)}}};
 await execute(()=>({existsSync:()=>true,readFileSync:()=>JSON.stringify(report)}),github,{repo:{owner:'owner',repo:'repo'},serverUrl:'https://github.com',runId:1},{setFailed:x=>failures.push(x),warning:x=>warnings.push(x)});
 assert.equal(failures.length,scenario==='technical'?1:0);
 assert.equal(warnings.length,scenario==='rejected'?1:0);
 assert.equal(mutations.length,scenario==='quiet'?0:1);
 if(scenario==='rejected')assert.match(mutations[0].body,/Score 73/);
 if(scenario==='published')assert.equal(mutations[0].state,'closed');
});
