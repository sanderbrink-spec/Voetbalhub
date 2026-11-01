'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
 const photos=require('../../news-photo-catalog.json').photos,manifest=require('../../android-ui/assets/presentation-covers.json');
 const livePath=process.env.VELDIO_VISUAL_FEED||'.phase32-live-feed.json';
 // Live-read-only snapshot when supplied; CI otherwise uses isolated presentation fixtures.
 const live=fs.existsSync(livePath)?JSON.parse(fs.readFileSync(livePath)).articles:require('./fixtures.cjs').articles.articles;
 const now=Date.now(),fallback=['FC Groningen koppelt duel met Sparta aan maatschappelijk programma','Heerenveen beslist duel met NEC dankzij kopbal van Vente','Feyenoord verliest voorsprong tegen Fortuna door treffer van eigen huurling'];
 let articles=live.filter(a=>!require('../../android-ui/assets/home-model').isColumn(a)).slice(0,5).map(a=>structuredClone(a));
 if(articles.length<3)articles=fallback.map((headline,i)=>({...structuredClone(live[0]),id:'visual32-'+i,status:'published',headline,publishedAt:new Date(now-i*60000).toISOString(),imageRights:'licensed',imageUrl:'news-photos/'+photos[i].file}));
 for(const a of articles){const row=manifest.find(m=>m.id===a.id),hash=crypto.createHash('sha256').update([a.headline,a.standfirst,...(a.body||[])].join('\n')).digest('hex');if(row&&row.contentHash===hash&&row.previousUrls.includes(a.imageUrl))Object.assign(a,{...row,imageUrl:row.imageAsset});}
 const clubs=['Ajax','Feyenoord','PSV'].map(name=>{const p=photos.find(p=>p.club===name);return {...p,name,cover:'news-photos/'+p.file};});
 const server=http.createServer((req,res)=>{let filename=decodeURIComponent(req.url.split('?')[0]).slice(1);let file;if(filename==='home-features.html'||filename==='home-model.js'||filename==='editorial-fallback.svg')file='android-ui/assets/'+filename;else if(filename==='column-portrait.webp')file='android-ui/drawable-nodpi/column_sander_brink_clean.webp';else if(/^news-photos\/[a-z0-9-]+\.webp$/.test(filename))file='public/'+filename;else{res.writeHead(404);return res.end();}res.setHeader('Content-Type',filename.endsWith('.html')?'text/html':filename.endsWith('.js')?'application/javascript':filename.endsWith('.svg')?'image/svg+xml':'image/webp');res.end(fs.readFileSync(file));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/home-features.html',browser=await chromium.launch({headless:true});fs.mkdirSync('.browser-output',{recursive:true});
 const results=[];
 try{
 for(const width of [320,360,393,412,550,768]){
  const page=await browser.newPage({viewport:{width,height:852},deviceScaleFactor:width===360?3:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date(now));await page.goto(url);
  await page.evaluate(data=>{window.calls=[];window.HomeHub={resize(){},openArticle:id=>calls.push(['article',id]),openClub:id=>calls.push(['club',id]),openMatch:id=>calls.push(['match',id])};window.setData(JSON.stringify(data));},{articles,clubs,stats:{},videos:{videos:[]}});
  await page.locator('.slide.active img').evaluate(i=>i.decode());const hero=await page.locator('.hero').boundingBox();assert.ok(Math.abs(hero.height-Math.min(390,Math.max(245,width*.62)))<2);
  for(let i=0;i<3;i++){
   await page.evaluate(i=>move(i),i);await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.slide.active')).opacity)>.99);await page.locator('.slide.active img').evaluate(i=>i.decode());const geometry=await page.locator('.slide.active').evaluate(el=>{const h=el.querySelector('h1'),r=h.getBoundingClientRect(),s=el.getBoundingClientRect(),meta=el.querySelector('.meta').getBoundingClientRect(),arrows=[...document.querySelectorAll('.arrow')].map(a=>a.getBoundingClientRect());return {lines:r.height/parseFloat(getComputedStyle(h).lineHeight),inside:r.left>=s.left&&r.right<=s.right&&r.top>=s.top&&r.bottom<=s.bottom,metaBelow:meta.top>=r.bottom-1,arrowOverlap:arrows.some(a=>Math.max(a.left,r.left)<Math.min(a.right,r.right)&&Math.max(a.top,r.top)<Math.min(a.bottom,r.bottom))};});
   assert.ok(geometry.lines<=3.1);assert.equal(geometry.inside,true);assert.equal(geometry.metaBelow,true);assert.equal(geometry.arrowOverlap,false);await page.locator('.slide.active .slide-link').click();assert.equal(await page.evaluate(()=>calls.at(-1)[1]),articles[i].id);
   if(width===393)await page.screenshot({path:'.browser-output/phase32-slide-'+(i+1)+'.png',fullPage:true});
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const card=await page.locator('#matchCard').boundingBox();assert.equal(card.height,width>=550?210:180);assert.ok(!(await page.locator('#matchCard').innerText()).includes('wordt bijgewerkt'));
  for(const club of clubs){const article={id:'spotlight-'+club.name,status:'published',headline:club.name+' bespreekt plannen met supporters',publishedAt:new Date(now-60000).toISOString(),editorialChecks:{claimsIndependentlyChecked:true,originalSourceReviewed:true}};await page.evaluate(articles=>setData(JSON.stringify({articles,stats:{}})),[article]);assert.equal(await page.locator('#matchCard .spotlight-club').innerText(),club.name.toUpperCase());await page.locator('#matchCard').click();assert.deepEqual(await page.evaluate(()=>calls.at(-1)),['article',article.id]);if(width===393)await page.screenshot({path:'.browser-output/phase32-spotlight-'+club.name.toLowerCase()+'.png',fullPage:true});}
  await page.evaluate(()=>setData(JSON.stringify({articles:[],stats:{}})));await page.locator('#matchCard').click();assert.equal(await page.evaluate(()=>calls.at(-1)[0]),'club');assert.ok(await page.locator('#matchCard img').evaluate(i=>i.complete&&i.naturalWidth>=1280));
  const after=await page.locator('#matchCard').boundingBox();assert.equal(after.height,card.height);assert.equal(after.width,card.width);
  await page.getByRole('button',{name:/Automatisch wisselen.*pauzeren/}).click();assert.equal(await page.locator('#pause').getAttribute('aria-label'),'Automatisch wisselen hervatten');assert.deepEqual(errors,[]);results.push({width,heroHeight:hero.height,cardHeight:card.height,passed:true});await page.close();
 }
 fs.writeFileSync('.browser-output/phase32-results.json',JSON.stringify({source:fs.existsSync(livePath)?'read-only production snapshot':'synthetic fixtures',physicalDevice:false,results},null,2));console.log('Phase 32 passed: three slides, safe 3-line titles, preserved geometry, 3 clubs, real photo decoding, whole-card article/profile callbacks and pause; 320–768 px including 360 px / DPR 3 S23 viewport.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
