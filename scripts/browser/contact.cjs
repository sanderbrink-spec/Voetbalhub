'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of [393,320]){
  const page=await browser.newPage({viewport:{width,height:852}}),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));await page.exposeFunction('record',(method,value)=>calls.push({method,value}));await page.setContent(fs.readFileSync('android-ui/assets/contact.html','utf8'));
  await page.evaluate(()=>{window.ContactHub=Object.fromEntries(['back','email','copyEmail','compose','draft','copyMessage'].map(k=>[k,x=>window.record(k,x)]));});
  await page.getByRole('heading',{name:'Jouw bericht. Onze aandacht.'}).waitFor();assert.equal(await page.getByRole('button',{name:'redactie.veldio@gmail.com',exact:true}).count(),1);
  await page.getByRole('button',{name:'Open e-mailbericht'}).click();assert.equal(calls.filter(x=>x.method==='compose').length,0);
  await page.getByLabel('Naam *',{exact:true}).fill('Testgebruiker');await page.getByLabel('E-mailadres *',{exact:true}).fill('test@example.com');await page.getByLabel('Onderwerp *',{exact:true}).fill('Vraag over de app');await page.getByLabel('Je bericht *',{exact:true}).fill('Dit is een testbericht voor het contactformulier.');await page.getByRole('button',{name:'Open e-mailbericht'}).click();
  assert.equal(calls.filter(x=>x.method==='compose').length,1);assert.equal(JSON.parse(calls.find(x=>x.method==='compose').value).email,'test@example.com');
  const draft=calls.filter(x=>x.method==='draft').at(-1).value;await page.evaluate(raw=>restoreForm(raw),draft);assert.equal(await page.getByLabel('Naam *',{exact:true}).inputValue(),'Testgebruiker');
  await page.evaluate(()=>showResult(false,'Geen e-mailapp beschikbaar.'));await page.getByRole('button',{name:'Kopieer mijn bericht'}).click();assert.ok(calls.some(x=>x.method==='copyMessage'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);fs.mkdirSync('.browser-output',{recursive:true});await page.screenshot({path:'.browser-output/contact-'+width+'.png',fullPage:true});await page.close();
 }
 console.log('Contact: responsive layout, required fields, truthful email handoff, form restoration and copy fallback passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
