'use strict';
// Offline proposal validation only. Never publishes model output or changes the live bank.
const fs=require('node:fs'),M=require('../quiz39/import');
if(require.main===module){const file=process.argv[2];if(!file)throw Error('Geef een JSON-bestand met vraagvoorstellen op.');const proposals=JSON.parse(fs.readFileSync(file,'utf8'));const report={checkedAt:new Date().toISOString(),published:0,candidates:M.prepare(proposals)};fs.mkdirSync('.phase39',{recursive:true});fs.writeFileSync('.phase39/question-review.json',JSON.stringify(report,null,2));console.log(JSON.stringify({published:0,checked:report.candidates.filter(x=>x.status==='checked_candidate').length,needs_review:report.candidates.filter(x=>x.status==='needs_review').length}));}
