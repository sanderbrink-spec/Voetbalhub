'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:393,height:852}}),errors=[],calls=[];
 page.on('pageerror',e=>errors.push(e.message));await page.exposeFunction('record',(method,value)=>calls.push({method,value}));
 await page.route('https://**/*',route=>route.abort());
 await page.setContent(fs.readFileSync('android-ui/assets/personal-hub.html','utf8'));
 await page.evaluate(()=>{window.PersonalHub={saveClubs:x=>window.record('clubs',x),openArticle:x=>window.record('open',x),removeSaved:x=>window.record('remove',x),back:()=>window.record('back','')};});
 const team=(id,name)=>({id,name,logo:'https://eredivisie.b-cdn.net/'+id+'.png'}),groningen=team('gro','FC Groningen'),ajax=team('aja','Ajax'),az=team('az','AZ');
 const article=(id,headline,body=[])=>({id,headline,body,status:'published',publishedAt:'2026-10-30T15:00:00Z',category:'Eredivisie',standfirst:''});
 const original=article('1','FC Groningen bereidt zich voor',['Een opvallende verdedigingslinie met drie centrale spelers.']);
 const saved=article('s','Bewaarde analyse',['Onafhankelijke terugblik.']);
 let state={mode:'favorites',articles:[original,article('2','Ajax treft AZ'),article('3','Een bazaar in Spanje'),{...article('private','FC Groningen concept'),status:'draft'}],saved:[saved],clubs:['FC Groningen'],stats:{standings:[{team:groningen,rank:7,points:13},{team:ajax,rank:2,points:20},{team:az,rank:4,points:17}],fixtures:[{id:'future',date:new Date(Date.now()+86400000).toISOString(),status:'NS',home:groningen,away:ajax}]},loading:false,offline:false};
 await page.evaluate(x=>setData(JSON.stringify(x)),state);
 assert.equal(await page.getByRole('heading',{name:'Mijn VoetbalHub',exact:true}).count(),1);
 assert.equal(await page.locator('[data-article="1"]').count(),1);assert.equal(await page.locator('[data-article="2"]').count(),0);
 await page.getByRole('heading',{name:'Eerstvolgende wedstrijden'}).waitFor();assert.equal(await page.locator('.fixture').count(),1);
 await page.getByRole('button',{name:'Bewerken',exact:true}).click();await page.locator('[data-club="AZ"]').click();assert.equal(await page.locator('[data-club="AZ"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-article="2"]').count(),1);assert.equal(await page.locator('[data-article="3"]').count(),0);
 assert.ok(calls.some(x=>x.method==='clubs'&&JSON.parse(x.value).includes('AZ')));
 await page.getByRole('button',{name:'Gereed',exact:true}).click();
 fs.mkdirSync('.browser-output',{recursive:true});await page.screenshot({path:'.browser-output/personal-hub-mobile.png',fullPage:true});
 await page.getByRole('tab',{name:'Bewaard (1)'}).click();await page.locator('[data-article="s"]').click();assert.ok(calls.some(x=>x.method==='open'&&x.value==='s'));await page.getByRole('button',{name:'Verwijderen uit leeslijst'}).click();assert.ok(calls.some(x=>x.method==='remove'&&x.value==='s'));
 // Native update after deleting a bookmark must not reset the tab or the club selection.
 state={...state,saved:[],offline:true};await page.evaluate(x=>setData(JSON.stringify(x)),state);await page.getByRole('heading',{name:'Je leeslijst is nog leeg'}).waitFor();assert.equal(await page.locator('#savedTab').getAttribute('aria-selected'),'true');assert.ok((await page.locator('#status').textContent()).includes('Verbinding beperkt'));
 await page.getByRole('tab',{name:'Mijn clubs'}).click();await page.locator('[data-filter="FC Groningen"]').click();
 assert.equal(await page.locator('.tabs').isVisible(),false);
 await page.getByRole('searchbox').fill('verdedigingslinie');assert.equal(await page.locator('[data-article="1"]').count(),1);
 await page.getByRole('searchbox').fill('nietbestaand');await page.getByRole('heading',{name:'Geen artikelen gevonden'}).waitFor();
 await page.getByRole('searchbox').fill('');assert.equal(await page.locator('[data-article="private"]').count(),0);assert.equal(await page.locator('[data-article]').count(),3);
 // Untrusted titles and IDs must remain text, never DOM or script.
 const malicious=article('evil" onclick="window.bad=true','<img src=x onerror="window.bad=true">');state.articles.push(malicious);await page.evaluate(x=>setData(JSON.stringify(x)),state);assert.equal(await page.evaluate(()=>window.bad),undefined);assert.equal(await page.locator('.row-copy img').count(),0);
 await page.getByRole('searchbox').fill('Ajax');await page.screenshot({path:'.browser-output/search-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 // Initial search route, late data, empty offline state and pagination are separate documents.
 const search=await browser.newPage({viewport:{width:320,height:720}});search.on('pageerror',e=>errors.push(e.message));await search.route('https://**/*',r=>r.abort());await search.setContent(fs.readFileSync('android-ui/assets/personal-hub.html','utf8'));
 await search.evaluate(()=>setData(JSON.stringify({mode:'search',query:'analyse',articles:[],saved:[],clubs:[],stats:{},loading:true})));assert.equal(await search.locator('.tabs').isVisible(),false);
 await search.evaluate(()=>setData(JSON.stringify({mode:'search',articles:[],saved:[{id:'offline',status:'published',headline:'Offline analyse',body:['Volledige tekst']}],clubs:[],stats:{},loading:false,offline:true})));assert.equal(await search.locator('[data-article="offline"]').count(),1);
 await search.getByRole('searchbox').fill('');await search.evaluate(()=>setData(JSON.stringify({mode:'search',articles:Array.from({length:45},(_,i)=>({id:String(i),headline:'Nieuws '+i,status:'published'})),saved:[],clubs:[],stats:{},loading:false})));assert.equal(await search.locator('[data-article]').count(),30);await search.getByRole('button',{name:'Meer berichten (15)'}).click();assert.equal(await search.locator('[data-article]').count(),45);
 assert.equal(await search.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('Personal hub: clubs, actual next fixture, aliases, search in full text, saved reader callbacks, offline text, pagination and escaped content passed.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
