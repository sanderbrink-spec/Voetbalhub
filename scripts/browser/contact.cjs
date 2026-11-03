'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
const {createContactHandler}=require('../../contact-mail');
(async()=>{
 let providerCalls=0,accept=false;
 const env={CONTACT_PRIVACY_READY:'1',RESEND_API_KEY:'test-only',CONTACT_FROM:'Veldio <test@example.com>'};
 const handler=createContactHandler({env,fetchImpl:async()=>{providerCalls++;return {ok:accept,json:async()=>accept?{id:'test-accepted'}:{message:'rejected'}};}});
 const server=http.createServer((req,res)=>{if(req.method==='GET'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(fs.readFileSync('android-ui/assets/contact.html'));}return handler(req,res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 env.CONTACT_PUBLIC_ORIGIN=base;
 const browser=await chromium.launch({headless:true});
 try{
 for(const width of [393,320]){
  const page=await browser.newPage({viewport:{width,height:852}}),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
  await page.exposeFunction('record',(method,value)=>calls.push({method,value}));await page.goto(base+'/contact');
  await page.evaluate(()=>{window.ContactHub=Object.fromEntries(['back','copyEmail','submit','draft'].map(k=>[k,x=>window.record(k,x)]));});
  await page.getByRole('heading',{name:'Jouw bericht. Onze aandacht.'}).waitFor();
  const send=page.locator('button[type=submit]');
  await send.click();assert.equal(calls.filter(x=>x.method==='submit').length,0);
  await page.getByLabel('Naam *',{exact:true}).fill('Testgebruiker');await page.getByLabel('E-mailadres *',{exact:true}).fill('test@example.com');await page.getByLabel('Onderwerp *',{exact:true}).fill('Vraag over de app');await page.getByLabel('Je bericht *',{exact:true}).fill('Dit is een testbericht voor het contactformulier.');await send.click();
  await page.waitForFunction(()=>sending);assert.equal(await send.isDisabled(),true);
  await page.evaluate(()=>document.getElementById('contactForm').dispatchEvent(new Event('submit',{cancelable:true})));assert.equal(calls.filter(x=>x.method==='submit').length,1);
  const sent=JSON.parse(calls.find(x=>x.method==='submit').value);assert.equal(sent.email,'test@example.com');assert.match(sent.requestId,/^[-a-zA-Z0-9]{16,80}$/);assert.equal(sent.website,'');
  const draft=calls.filter(x=>x.method==='draft').at(-1).value;
  await page.evaluate(()=>showNotice('E-mailadres gekopieerd.'));assert.equal(await send.isDisabled(),true);assert.equal(await page.getByLabel('Je bericht *',{exact:true}).inputValue(),'Dit is een testbericht voor het contactformulier.');
  await page.evaluate(()=>showResult(false,'Verzenden is niet gelukt. Probeer het opnieuw.'));assert.equal(await page.getByLabel('Naam *',{exact:true}).inputValue(),'Testgebruiker');
  await send.click();await page.waitForFunction(()=>sending);assert.equal(JSON.parse(calls.filter(x=>x.method==='submit').at(-1).value).requestId,sent.requestId);
  await page.evaluate(()=>showResult(false,'Verzenden is niet gelukt. Probeer het opnieuw.'));await page.evaluate(raw=>restoreForm(raw),draft);assert.equal(await page.getByLabel('Naam *',{exact:true}).inputValue(),'Testgebruiker');
  await page.evaluate(()=>showResult(true,'Je bericht is verzonden naar de redactie van Veldio. Bedankt voor je reactie.'));assert.equal(await page.getByLabel('Naam *',{exact:true}).inputValue(),'');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await page.close();
 }
 // A missing native acknowledgement must unlock retry and preserve the same idempotency key.
 const timeoutPage=await browser.newPage();await timeoutPage.goto(base+'/contact');await timeoutPage.clock.install();
 await timeoutPage.evaluate(()=>{window.ContactHub={submit:()=>{}};restoreForm(JSON.stringify({name:'Testgebruiker',email:'test@example.com',topic:'Vraag over de app',subject:'Test',message:'Dit bericht blijft bewaard als de native bridge niet antwoordt.'}));});
 await timeoutPage.getByRole('button',{name:'Verstuur bericht'}).click();const timeoutId=await timeoutPage.evaluate(()=>requestId);
 await timeoutPage.clock.fastForward(45001);assert.equal(await timeoutPage.locator('button[type=submit]').isDisabled(),false);assert.match(await timeoutPage.locator('#result').textContent(),/Geen verzendbevestiging/);assert.match(await timeoutPage.locator('#message').inputValue(),/blijft bewaard/);
 await timeoutPage.getByRole('button',{name:'Verstuur bericht'}).click();assert.equal(await timeoutPage.evaluate(()=>requestId),timeoutId);await timeoutPage.close();
 // Browser fallback reaches the existing server handler, without any external email app.
 const page=await browser.newPage();await page.goto(base+'/contact');
 await page.getByLabel('Naam *',{exact:true}).fill('Testgebruiker');await page.getByLabel('E-mailadres *',{exact:true}).fill('test@example.com');await page.getByLabel('Onderwerp *',{exact:true}).fill('Vraag');await page.getByLabel('Je bericht *',{exact:true}).fill('Dit is een testbericht via de bestaande serverroute.');
 await page.getByRole('button',{name:'Verstuur bericht'}).click();await page.locator('#result.error').waitFor();assert.equal(providerCalls,1);
 accept=true;await page.getByRole('button',{name:'Verstuur bericht'}).click();await page.waitForFunction(()=>document.querySelector('#result:not(.error)')&&!sending);assert.equal(providerCalls,2);assert.equal(await page.getByLabel('Naam *',{exact:true}).inputValue(),'');assert.equal(page.url(),base+'/contact');await page.close();
 console.log('Contact passed: native submit contract, validation, duplicate clicks, retry ID, draft retention, success reset, responsive layout and HTTP/provider acknowledgement.');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
