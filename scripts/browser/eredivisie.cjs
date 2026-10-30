'use strict';
const {chromium}=require('playwright');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await fetch('https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/editorial-media/statistics/eredivisie.json');const data=response.ok?await response.json():await require('../eredivisie-official').collectOfficial({save:false});
  await page.setContent(fs.readFileSync('android-ui/assets/eredivisie.html','utf8'));
  await page.evaluate(x=>window.setData(JSON.stringify(x)),data);
  await page.getByRole('heading',{name:'De stand',exact:true}).waitFor();
  assert.equal(await page.locator('tbody tr').count(),18);
  await page.locator('tbody tr.team').first().click();await page.getByRole('heading',{name:'Recente uitslagen',exact:true}).waitFor();
  for(const name of ['Uitslagen','Programma','Spelers','Clubs','Uitgelicht']){await page.getByRole('button',{name,exact:true}).click();assert.ok((await page.locator('main').innerText()).length>60);}
  await page.getByRole('button',{name:'Spelers',exact:true}).click();await page.getByRole('button',{name:'Assists',exact:true}).click();assert.ok(await page.locator('tbody tr').count()>0);
  await page.getByRole('button',{name:'Stand',exact:true}).click();
  assert.equal(await page.locator('a[href^="http"]').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  fs.mkdirSync('.browser-output',{recursive:true});await page.screenshot({path:'.browser-output/eredivisie-mobile.png',fullPage:true});
  console.log('Mobile standings, all tabs, team detail, player filters and internal navigation passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
