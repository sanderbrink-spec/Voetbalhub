'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {officialPage,sourceText,runExitCode}=require('../scripts/automatic-publication');

test('source reading stops on decoded byte limit and cancels the upstream stream',async()=>{
 let pulls=0,cancelled=false;
 const response=new Response(new ReadableStream({
  pull(controller){pulls++;controller.enqueue(new Uint8Array(1_000_000));},
  cancel(){cancelled=true;}
 }));
 await assert.rejects(sourceText(response),/Bronpagina te groot/);
 assert.equal(cancelled,true);assert.ok(pulls<=5);
 // Count bytes, not characters, and do not trust an understated Content-Length.
 await assert.rejects(sourceText(new Response('€'.repeat(1_000_001),{headers:{'content-length':'1'}})),/Bronpagina te groot/);
});
test('a declared oversized source is rejected without reading its body',async()=>{
 let cancelled=false;
 const response=new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-length':'3000001'}});
 await assert.rejects(sourceText(response),/Bronpagina te groot/);assert.equal(cancelled,true);
});
test('redirect and final page share a deadline and retain the final evidence URL',async()=>{
 const signals=[];let cancelled=false;
 const result=await officialPage('https://ajax.nl/old',async(url,options)=>{
  signals.push(options.signal);assert.equal(options.redirect,'manual');
  if(url.endsWith('/old'))return new Response(new ReadableStream({cancel(){cancelled=true;}}),{status:302,headers:{location:'/artikelen/new'}});
  return new Response('<main><h1>Nieuws</h1><p>Clubinformatie.</p></main>');
 });
 assert.equal(signals.length,2);assert.equal(signals[0],signals[1]);assert.equal(cancelled,true);
 assert.equal(result.url,'https://ajax.nl/artikelen/new');assert.match(result.text,/Clubinformatie/);
});
test('redirect loops, missing locations and redirects outside the source never read another site',async()=>{
 for(const location of [null,'https://evil.example/nieuws','https://psv.nl/nieuws','/loop']){
  let calls=0;
  await assert.rejects(officialPage('https://ajax.nl/old',async()=>{calls++;return new Response('',{status:302,headers:location?{location}:{}});}),/bronomleiding/);
  assert.equal(calls,location==='/loop'?2:1);
 }
});
test('publication workflow distinguishes policy/provider failures from a quiet editorial run',()=>{
 const base={published:[],sourceErrors:[]};
 for(const status of ['rights_blocked','disabled','provider_daily_limit','no_verified_sources','sources_unavailable','failed'])assert.equal(runExitCode({...base,status}),1);
 for(const status of ['no_new_verified_articles','daily_limit','completed'])assert.equal(runExitCode({...base,status}),0);
 assert.equal(runExitCode({...base,status:'no_new_verified_articles',sourceErrors:[{error:'offline'}]}),0);
 assert.equal(runExitCode({...base,status:'provider_daily_limit',published:[{id:'one'}]}),1);
});
test('unconfigured real CLI exits unsuccessfully and leaves a complete machine-readable report',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'veldio-policy-'));
 try{
  const result=spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/automatic-publication.js')],{cwd:directory,env:{...process.env,HUB_API_SECRET:'',GROQ_API_KEY:'',GITHUB_TOKEN:''},encoding:'utf8'});
  assert.equal(result.status,1);
  const report=JSON.parse(fs.readFileSync(path.join(directory,'.automatic-output/report.json'),'utf8'));
  assert.equal(report.status,'failed');assert.deepEqual(report.published,[]);
  assert.ok(Number.isFinite(Date.parse(report.finishedAt)));assert.match(result.stderr,/zijn vereist/);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
