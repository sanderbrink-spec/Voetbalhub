'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const response=await fetch('https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/editorial-media/statistics/eredivisie.json');if(!response.ok)throw Error('No preview data');const data=await response.json();if(!data.featured?.preview)throw Error('No selected weekly preview');const f=data.featured.preview.fixture;
 const page=await browser.newPage({viewport:{width:393,height:852}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent(fs.readFileSync('android-ui/assets/match-preview.html','utf8'));
 // Data arrives after the document, as it does in the Android WebView.
 await page.evaluate(x=>window.setData(JSON.stringify(x)),data);
 await page.getByRole('heading',{name:f.home.name+' – '+f.away.name,exact:true}).waitFor();
 assert.equal(await page.locator('nav').count(),0);
 assert.equal(await page.getByRole('heading',{name:'De stand',exact:true}).count(),0);
 assert.ok(await page.locator('article.body p').count()>=3);
 await page.getByRole('heading',{name:'Onderlinge ontmoetingen',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 fs.mkdirSync('.browser-output',{recursive:true});await page.screenshot({path:'.browser-output/match-preview-mobile.png',fullPage:true});
 // Preserve the exact clicked fixture, even if the global weekly feed changes later.
 const saved=structuredClone(data);saved.featured.preview.fixture.home.name='Geselecteerde thuisclub';await page.evaluate(x=>window.setData(JSON.stringify(x)),saved);await page.getByRole('heading',{name:'Geselecteerde thuisclub – '+f.away.name,exact:true}).waitFor();
 // Regression for the old lexical-global flag that opened standings on a late response.
 await page.setContent(fs.readFileSync('android-ui/assets/eredivisie.html','utf8'));await page.evaluate(()=>window.showFeatured());await page.evaluate(x=>window.setData(JSON.stringify(x)),data);await page.getByRole('heading',{name:f.home.name+' – '+f.away.name,exact:true}).waitFor();
 console.log('Dedicated preview, delayed data delivery, clicked fixture and legacy feature navigation passed.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
