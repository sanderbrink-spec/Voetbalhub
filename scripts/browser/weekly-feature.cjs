'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict'),W=require('../weekly-feature');
(async()=>{
 const end=Date.parse('2026-11-01T16:00:00Z'),kickoff=Date.parse('2026-11-08T15:45:00Z'),boundary=kickoff-W.HOURS;
 const f={id:1,date:'2026-11-01T13:30:00Z',status:'FT',home:{id:1,name:'Ajax'},away:{id:2,name:'PSV'},goals:{home:2,away:1},venue:{name:'Teststadion'}};
 const upcoming={...f,id:2,date:new Date(kickoff).toISOString(),status:'NS',goals:{home:null,away:null}};
 const report={phase:'report',publicationId:'weekly-2026-1-report',fixtureId:1,round:'Test ronde',report:W.buildReport(f,end),imageUrl:'https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/editorial-media/weekly/test.webp',imageReview:{method:'own-weekly-score-v1',fixtureId:1,goals:f.goals},imageCredit:'Synthetisch testbeeld'};
 const preview={phase:'preview',publicationId:'weekly-2026-2-preview',fixtureId:2,round:'Volgende test ronde',publishAt:new Date(boundary).toISOString(),preview:{fixture:upcoming,standfirst:'Synthetische vooruitblik.',body:['Eerste gecontroleerde testalinea.','Tweede gecontroleerde testalinea.','Derde gecontroleerde testalinea.']}};
 const stats={schemaVersion:1,league:{id:88},updatedAt:new Date(end).toISOString(),source:'Synthetische browsertest',standings:[],featured:report,nextFeatured:preview};
 const server=http.createServer((req,res)=>{const name=req.url.split('?')[0].slice(1)||'home-features.html';if(!['home-features.html','home-model.js','match-preview.html'].includes(name)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':'text/html');res.end(fs.readFileSync('android-ui/assets/'+name));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:850}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"/>'}));
  await page.addInitScript(()=>{window.clicks=[];window.HomeHub={resize(){},openMatch(id){window.clicks.push(id);}};});
  await page.clock.install({time:boundary-60000});await page.goto(base+'/home-features.html');await page.clock.pauseAt(boundary-1);
  await page.evaluate(s=>window.setData(JSON.stringify({stats:s,articles:[],videos:{}})),stats);
  assert.match(await page.locator('#matchCard').innerText(),/2 – 1/);assert.match(await page.locator('#matchCard').innerText(),/Lees het wedstrijdverslag/);
  const before=await page.locator('#matchCard').boundingBox();await page.locator('#matchCard').click();assert.equal(await page.evaluate(()=>window.clicks.at(-1)),report.publicationId);
  await page.clock.runFor(1);assert.match(await page.locator('#matchCard').innerText(),/Bekijk de voorbeschouwing/);
  await page.locator('#matchCard').click();assert.equal(await page.evaluate(()=>window.clicks.at(-1)),preview.publicationId);
  const after=await page.locator('#matchCard').boundingBox();assert.equal(after.height,before.height);assert.equal(after.width,before.width);
  await page.evaluate(()=>window.setData(JSON.stringify({stats:{}})));assert.match(await page.locator('#matchCard').innerText(),/Bekijk de voorbeschouwing/);assert.equal(await page.locator('#matchCard').isDisabled(),false);
  await page.goto(base+'/match-preview.html');await page.evaluate(s=>window.setData(JSON.stringify(s)),stats);
  assert.match(await page.locator('h1').innerText(),/2–1/);assert.match(await page.locator('#article').innerText(),/Het wedstrijdverslag/);assert.equal(await page.locator('.cover').count(),1);
  assert.deepEqual(errors,[]);console.log('Weekly feature passed: report and whole-card link, exact 72-hour staged transition, next preview link, equal card dimensions, missing-data fallback and report reader. Synthetic fixtures only.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
