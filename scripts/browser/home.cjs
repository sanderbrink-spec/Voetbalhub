'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const html=fs.readFileSync('android-ui/assets/home-features.html','utf8')
   .replace('<script src="home-model.js"></script>','<script>'+fs.readFileSync('android-ui/assets/home-model.js','utf8')+'</script>');
  for(const width of [320,393,768]){
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[],external=[],calls=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://**/*',route=>{external.push(route.request().url());return route.abort();});
   await page.exposeFunction('record',(method,value)=>calls.push({method,value}));
   await page.setContent(html);
   await page.evaluate(()=>{window.HomeHub={openArticle:id=>window.record('article',id),openColumn:()=>window.record('column',''),openVideo:x=>window.record('video',x),resize:()=>{}};});
   const now=new Date().toISOString();
   await page.evaluate(data=>window.setData(JSON.stringify(data)),{
    articles:[{id:'test-news',status:'published',headline:'Testartikel over de voorbereiding van een voetbalclub',publishedAt:now}],
    stats:{},videos:{videos:[{id:'AAAAAAAAAAA',title:'Testvideo over Eredivisie',channel:'Testkanaal',publishedAt:now}]},loading:false,videoLoading:false
   });
   assert.equal(await page.locator('.slide').count(),3);
   assert.equal(await page.locator('.slide.active').count(),1);
   await page.locator('.slide.active button').click();assert.equal(calls.at(-1).method,'article');
   await page.locator('.next').click();await page.locator('.slide.active button').click();assert.equal(calls.at(-1).method,'column');
   await page.locator('.next').click();assert.equal(await page.locator('.slide.active button').isDisabled(),true);
   assert.equal(await page.locator('#matchCard').isDisabled(),true);
   const column=await page.locator('.column-card').boundingBox(),match=await page.locator('#matchCard').boundingBox();
   assert.ok(Math.abs(column.height-match.height)<1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await page.locator('#videos iframe,#videos img').count(),0);
   await page.locator('[data-video]').click();assert.equal(calls.at(-1).method,'video');
   assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
   fs.mkdirSync('.browser-output',{recursive:true});
   await page.screenshot({path:'.browser-output/home-'+width+'.png',fullPage:true});
   await page.close();
  }
  console.log('Home: three slides, column navigation, equal feature sizes, safe match placeholder, no overflow and no YouTube requests before consent passed at 320/393/768px.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
