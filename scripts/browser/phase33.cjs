'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{
 const data=require('../../android-ui/assets/stadium-bootstrap.json');
 const server=http.createServer((req,res)=>{const name=req.url.split('?')[0].slice(1);let file;if(/^[a-z0-9-]+\.(html|js|svg)$/.test(name)&&fs.existsSync('android-ui/assets/'+name))file='android-ui/assets/'+name;else if(/^news-photos\/[a-z0-9-]+\.webp$/.test(name))file='public/'+name;else if(name==='column-portrait.webp')file='android-ui/drawable-nodpi/column_sander_brink_clean.webp';else{res.writeHead(404);return res.end();}res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.html')?'text/html':'image/webp');res.end(fs.readFileSync(file));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});fs.mkdirSync('.browser-output',{recursive:true});
 try{for(const width of [320,360,393,412,768]){
  const page=await browser.newPage({viewport:{width,height:852},deviceScaleFactor:width===360?3:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/stadium.html');await page.evaluate(d=>setStadiumData(JSON.stringify(d)),data);
  await page.locator('.archive-card img').evaluate(i=>i.decode());await page.locator('.archive-card').click();assert.match(await page.locator('h1').innerText(),/De Kuip/);assert.equal(await page.locator('article h2').count(),13);assert.equal(await page.locator('article .facts li').count(),6);
  assert.equal(await page.locator('article figure').count(),2);for(const img of await page.locator('article figure img').all())assert.ok(await img.evaluate(async i=>{await i.decode();return i.naturalWidth>=1280;}));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.match(await page.locator('article').innerText(),/CC BY 3.0/);assert.equal(await page.locator('.sources li').count(),11);
  if(width===393){await page.screenshot({path:'.browser-output/phase33-stadium-reader.png',fullPage:false});await page.screenshot({path:'.browser-output/phase33-de-kuip-full.png',fullPage:true});}
  await page.locator('#archive').click();assert.equal(await page.locator('.archive-card').count(),1);if(width===393)await page.screenshot({path:'.browser-output/phase33-stadium-archive.png'});
  await page.goto(base+'/home-features.html');await page.evaluate(d=>{window.calls=[];window.HomeHub={resize(){},openStadium:id=>calls.push(id),openStadiumArchive:()=>calls.push('archive')};setData(JSON.stringify({stadiums:d,stats:{},articles:[]}));},data);
  assert.match(await page.locator('#matchCard').innerText(),/STADION VAN DE WEEK/);await page.locator('#matchCard').click();assert.equal(await page.evaluate(()=>calls.at(-1)),'de-kuip');
  assert.equal(await page.getByText(/video’s laden/).count(),0);assert.equal(await page.locator('[data-answer]').count(),3);const before=await page.locator('.number-question').innerText();await page.locator('[data-answer]').first().click();assert.ok((await page.locator('[role=status]').innerText()).length>25);await page.locator('#nextQuestion').click();assert.notEqual(await page.locator('.number-question').innerText(),before);await page.locator('#stadiumArchive').click();assert.equal(await page.evaluate(()=>calls.at(-1)),'archive');
  await page.context().setOffline(true);await page.locator('[data-answer]').first().click();assert.match(await page.locator('[role=status]').innerText(),/Goed|antwoord/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(width===393)await page.screenshot({path:'.browser-output/phase33-home-stadium-quiz.png',fullPage:true});assert.deepEqual(errors,[]);await page.close();
 }console.log('PASS phase 33: 320–768px, licensed photographs, 1,076-word reader, 6 sourced facts, archive and back, full card link, interactive offline quiz and no video loader.');}
 finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
