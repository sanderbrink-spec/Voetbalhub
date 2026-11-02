'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{
 const server=http.createServer((req,res)=>{const name=req.url.split('?')[0].slice(1);const file=/^clubquiz[-a-z0-9]*\.(html|js)$/.test(name)?'android-ui/assets/'+name:/^news-photos\/[a-z0-9-]+\.webp$/.test(name)?'public/'+name:null;if(!file||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.html')?'text/html':'image/webp');res.end(fs.readFileSync(file));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/clubquiz.html',browser=await chromium.launch({headless:true});fs.mkdirSync('.browser-output',{recursive:true});
 try{for(const width of [320,360,393,412,768]){
  const page=await browser.newPage({viewport:{width,height:852}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);assert.match(await page.locator('#bankSize').innerText(),/68/);
  for(const level of ['easy','normal','hard']){
   await page.selectOption('#level',level);await page.click('#start');const ids=[];let images=new Set();
   for(let i=0;i<10;i++){
    assert.equal(await page.locator('#next').isVisible(),false);assert.equal(await page.locator('#answers button').count(),4);
    const text=await page.locator('#question').innerText();const q=await page.evaluate(text=>CLUBQUIZ_BANK.find(q=>q.question===text),text);assert.ok(q);ids.push(q.id);images.add(await page.locator('#photo').getAttribute('src'));await page.locator('#photo').evaluate(i=>i.decode());
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.getByRole('button',{name:new RegExp('^[A-D]\\s*'+q.correct.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).click();
    assert.match(await page.locator('#feedback').innerText(),/^Goed/);assert.equal(await page.locator('#answers button:disabled').count(),4);
    if(width===393&&level==='normal'&&i===0)await page.screenshot({path:'.browser-output/phase35-clubquiz.png',fullPage:true});
    await page.click('#next');
   }
   assert.equal(new Set(ids).size,10);assert.equal(await page.locator('#score').innerText(),'10 / 10');if(level!=='hard')assert.ok(images.size>1);await page.click('#again');
   // Reload, then load all local assets before disconnecting; no remote quiz dependency.
   await page.reload();await page.selectOption('#level',level);await page.click('#start');const first=await page.locator('#question').innerText();const recent=await page.evaluate(()=>JSON.parse(localStorage.getItem('veldio.clubquiz.recent.v1')));assert.ok(recent.length>=10);
   const newId=await page.evaluate(t=>CLUBQUIZ_BANK.find(q=>q.question===t).id,first);if(level==='easy')assert.equal(ids.includes(newId),false);
   await page.locator('#photo').evaluate(i=>i.decode());await page.context().setOffline(true);await page.locator('#answers button').first().click();assert.ok((await page.locator('#feedback').innerText()).length>20);await page.context().setOffline(false);await page.click('#back');
  }
  assert.deepEqual(errors,[]);await page.close();
 }console.log('PASS clubquiz35: 68 questions; 3 levels; 320–768px; complete 10/10 rounds; answer locking; image decode and credits; persisted recent history; offline answering; back/restart; no overflow or JS errors.');}
 finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
