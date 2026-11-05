'use strict';
// Read-only central licensed data probe; unavailable data must not give a green workflow.
const fs=require('node:fs');
const {request,footballChecks}=require('./production-health48');
async function run(){
 const report={checkedAt:new Date().toISOString(),sources:[],checks:[]};
 for(const competition of ['bundesliga','laliga','premierleague','championsleague','europaleague','eredivisie']){
  try{const s=await request('https://voetbalhub-redactie.onrender.com/integrations/football?competition='+competition);report.sources.push({competition,status:s.status,fixtures:s.fixtures?.length||0,standings:s.standings?.length||0,source:s.source,license:s.sourceDetails?.license||null,updatedAt:s.updatedAt});report.checks.push(...footballChecks(competition,s));}
  catch(e){report.checks.push({id:'football.'+competition,status:'fail',detail:e.message});}
 }
 report.status=report.checks.some(c=>c.status==='fail')?'fail':'pass';
 fs.writeFileSync('football47-health.json',JSON.stringify(report,null,2)+'\n');console.log(report.status);return report;
}
if(require.main===module)run().then(r=>{process.exitCode=r.status==='fail'?1:0;}).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={run};
