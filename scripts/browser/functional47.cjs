'use strict';const {chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict');
const dir='android-project/app/src/main/assets/';function html(file){return fs.readFileSync(dir+file,'utf8').replace(/<script src="([^"]+)"><\/script>/g,(_,f)=>'<script>'+fs.readFileSync(dir+f,'utf8')+'</script>').replace(/<link rel="stylesheet" href="([^"]+)">/g,(_,f)=>'<style>'+fs.readFileSync(dir+f,'utf8')+'</style>');}
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});try{for(const width of [320,393]){const page=await browser.newPage({viewport:{width,height:852}}),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());await page.exposeFunction('record',(m,v)=>calls.push({m,v}));await page.setContent(html('destinations39.html'));await page.evaluate(()=>window.VeldioDestinations={predict:v=>record('predict',JSON.parse(v)),competition:v=>record('competition',v),refresh:()=>record('refresh'),external:v=>record('external',v),open:v=>record('open',v)});
const now=Date.now(),future={id:'test-upcoming',home:{id:'psv',name:'PSV'},away:{id:'ajax',name:'Ajax'},date:new Date(now+3600000).toISOString(),status:'NS',goals:{home:null,away:null}},final={...future,id:'test-final',status:'FT',date:new Date(now-86400000).toISOString(),goals:{home:2,away:1}},stats={schemaVersion:1,rightsPolicyVersion:26,rightsExpiresAt:now+86400000,updatedAt:new Date(now).toISOString(),league:{id:88,name:'Eredivisie',season:2026},source:'Tests, geen productie',sourceDetails:{url:'https://www.openligadb.de/',license:'ODbL-1.0'},fixtures:[future,final],standings:[]};
let state={mode:'predictions',competition:'eredivisie',clubs:['PSV'],stats,predictions:[{fixtureId:final.id,label:'PSV – Ajax',home:2,away:1,kickoff:final.date}]};await page.evaluate(s=>setData(JSON.stringify(s)),state);assert.ok((await page.locator('main').innerText()).includes('3 punten · 1 beoordeeld · 100% correct'));await page.locator('#homeGoals').fill('3');await page.locator('#awayGoals').fill('1');await page.getByRole('button',{name:'Voorspelling opslaan'}).click();assert.deepEqual(calls.find(c=>c.m==='predict').v,{fixtureId:'test-upcoming',home:3,away:1});await page.evaluate(s=>setData(JSON.stringify(s)),state);assert.equal(await page.locator('#homeGoals').inputValue(),'3');await page.locator('#competitionFilter').selectOption('bundesliga');assert.equal(calls.at(-1).v,'bundesliga');
state.stats.fixtures[0].date=new Date(now-1000).toISOString();await page.evaluate(s=>setData(JSON.stringify(s)),state);assert.equal(await page.locator('#prediction').count(),0);await page.evaluate(s=>setData(JSON.stringify({...s,mode:'fixtures'})),state);await page.getByRole('button',{name:'Uitslagen',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Uitslagen',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.match50').count(),1);assert.ok((await page.locator('.match50').innerText()).includes('PSV'));assert.ok((await page.locator('.match50').innerText()).includes('Ajax'));const sampleEvents=[
 {kind:'goal',minute:12,extra:0,sortOrder:1,side:'home',player:'Speler Een',score:'1 – 0'},
 {kind:'own_goal',minute:45,extra:2,sortOrder:2,side:'away',player:'Speler Zes',score:'2 – 0'},
 {kind:'yellow_card',minute:60,extra:0,sortOrder:3,side:'away',player:'Speler Twee'},
 {kind:'substitution',minute:72,extra:0,sortOrder:4,side:'home',player:'Speler Drie',relatedPlayer:'Speler Vier'},
 {kind:'second_yellow',minute:75,extra:0,sortOrder:5,side:'away',player:'Speler Twee'},
 {kind:'penalty',minute:84,extra:0,sortOrder:6,side:'away',player:'Speler Zeven',score:'2 – 1'},
 {kind:'red_card',minute:90,extra:4,sortOrder:7,side:'away',player:'Speler Vijf'}
];
const tracked={...state.stats.fixtures[1],round:'5.Spieltag',eventCoverage:'sportmonks',matchEvents:sampleEvents};
const fallback={...tracked,id:'test-fallback',date:new Date(now-60000).toISOString(),round:'Round 12',eventCoverage:'unavailable'};
const dutch={...fallback,id:'test-dutch',date:new Date(now-30000).toISOString(),round:'Speelronde 13'};
state.stats.fixtures=[tracked,fallback,dutch];
const renderFixtures=()=>page.evaluate(s=>setData(JSON.stringify({...s,mode:'fixtures'})),state);
await renderFixtures();
const round=page.getByRole('combobox',{name:'Speelronde'});
assert.deepEqual(await round.locator('option').evaluateAll(options=>options.map(o=>[o.value,o.textContent])),
 [['5.Spieltag','Speelronde 5'],['Round 12','Speelronde 12'],['Speelronde 13','Speelronde 13']]);
assert.deepEqual(await page.locator('[data-comp50]').allTextContents(),['Eredivisie','CL','EL','UCL']);
const detail=page.locator('details.fixture-expand88');
await page.getByRole('button',{name:'Vorige speelronde'}).click();
assert.equal(await round.inputValue(),'Round 12');
await detail.locator('summary').click();
assert.match(await detail.innerText(),/Geen gecontroleerde wedstrijdmomenten/);
await page.getByRole('button',{name:'Volgende speelronde'}).click();
assert.equal(await round.inputValue(),'Speelronde 13');
await round.selectOption('5.Spieltag');
assert.equal(await detail.count(),1);
const summary=detail.locator('summary');
assert.equal(await detail.locator('.event-group88 h3').first().isVisible(),false);
const callsBeforeOpen=calls.length;
await summary.focus();
await page.keyboard.press('Enter');
assert.equal(await detail.getAttribute('open'),'');
assert.ok((await summary.boundingBox()).height>=44);
assert.deepEqual(await detail.locator('.event-group88 h3').allTextContents(),['Doelpunten','Gele en rode kaarten','Wissels']);
assert.equal(await detail.locator('.event-group88 h3 svg').count(),3);
const event=kind=>detail.locator('[data-event-kind="'+kind+'"]');
for(const [kind,minutes,name] of [['goal','12′','Speler Een'],['own_goal','45+2′','Speler Zes'],['penalty','84′','Speler Zeven'],
 ['yellow_card','60′','Speler Twee'],['second_yellow','75′','Speler Twee'],['red_card','90+4′','Speler Vijf']]){
 assert.equal(await event(kind).locator('.event-minute88').textContent(),minutes);
 assert.equal(await event(kind).locator('strong').textContent(),name);
}
assert.equal(await event('own_goal').locator('.event-score88').textContent(),'2 – 0');
assert.match(await event('own_goal').innerText(),/Ajax · Eigen doelpunt/);
assert.match(await event('second_yellow').innerText(),/Tweede gele kaart/);
const markerColor=kind=>event(kind).locator('.event-card88').evaluate(el=>getComputedStyle(el).backgroundColor);
assert.notEqual(await markerColor('yellow_card'),await markerColor('red_card'));
assert.equal(await event('second_yellow').locator('.event-card88').evaluate(el=>getComputedStyle(el,'::after').backgroundColor),await markerColor('red_card'));
assert.deepEqual(await event('substitution').locator('.event-player88').allTextContents(),['INSpeler Drie','UITSpeler Vier']);
assert.equal(await event('substitution').locator('.event-minute88').textContent(),'72′');
assert.match(await event('substitution').locator('small').innerText(),/PSV/);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
fs.mkdirSync('.browser-output',{recursive:true});
await detail.screenshot({path:'.browser-output/match-events-'+width+'.png'});
await renderFixtures();
assert.equal(await detail.getAttribute('open'),'');
await summary.click();
assert.equal(await detail.getAttribute('open'),null);
assert.equal(calls.length,callsBeforeOpen);
await page.getByRole('button',{name:'Vernieuwen',exact:true}).click();assert.equal(calls.at(-1).m,'refresh');
for(const competition of ['eredivisie','kkd','premierleague','bundesliga','laliga','seriea','ligue1','championsleague','europaleague','conferenceleague']){await page.evaluate(c=>setData(JSON.stringify({mode:'competition',competition:c,stats:{},clubs:[],predictions:[]})),competition);assert.ok((await page.locator('main').innerText()).includes('Competitieachtergrond'));assert.equal(await page.getByRole('button',{name:'Officiële competitiebron ↗'}).count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
assert.deepEqual(errors,[]);await page.close();
const hub=await browser.newPage({viewport:{width,height:852}});hub.on('pageerror',e=>errors.push(e.message));await hub.setContent(html('personal-hub.html'));await hub.evaluate(()=>{window.PersonalHub={savePrimary:()=>{},saveClubs:()=>{}};setData(JSON.stringify({mode:'favorites',clubs:['FC Groningen','AZ'],primaryClub:'AZ',articles:[],saved:[],stats:{},loading:false}));});assert.equal(await hub.locator('#heading').innerText(),'Mijn Clubs');assert.equal(await hub.locator('.clubs .club-shirt').count(),2);assert.equal(await hub.locator('#primaryClub').inputValue(),'AZ');await hub.evaluate(()=>{setData(JSON.stringify({mode:'favorites',clubs:['FC Groningen','AZ'],primaryClub:'AZ',articles:[],saved:[],stats:{schemaVersion:1,rightsPolicyVersion:26,rightsExpiresAt:Date.now()+3600000,updatedAt:new Date().toISOString(),standings:[],fixtures:[],status:'unavailable',message:'Geen actuele, vrijgegeven gegevensbron.'},loading:false,offline:false}));});assert.ok((await hub.locator('#content').innerText()).includes('Geen actuele, vrijgegeven gegevensbron.'));assert.ok(!(await hub.locator('#status').innerText()).includes('Verbinding beperkt'));assert.equal(await hub.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await hub.getByRole('button',{name:'Club toevoegen +'}).click();assert.ok(await hub.locator('.club-choice .club-shirt').count()>30);assert.deepEqual(errors,[]);fs.mkdirSync('.browser-output',{recursive:true});await hub.screenshot({path:'.browser-output/functional47-'+width+'.png',fullPage:true});await hub.close();}
console.log('PASS 47: 320/393px, shirts, primary club, 10 competition pages, prediction 3/1/0 model, bridge submission, kickoff lock, filters, refresh, draft preservation, localized round IDs and all timeline events');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
