'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../football-data47'),UI=require('../android-project/app/src/main/assets/football47');
const now=Date.parse('2026-11-04T12:00:00Z');
const fixture=(id,h,a,goals,date='2026-11-01T12:00:00Z')=>({id,home:{id:h,name:h},away:{id:a,name:a},date,status:goals?'FT':'NS',goals:goals||{home:null,away:null}});
test('round-robin totals conserve goals, wins, draws and points; tied totals share rank',()=>{const rows=M.table([fixture(1,'A','B',{home:2,away:1}),fixture(2,'B','C',{home:1,away:1}),fixture(3,'C','A',{home:2,away:0})]);assert.equal(rows.reduce((s,r)=>s+r.all.goals.for,0),rows.reduce((s,r)=>s+r.all.goals.against,0));assert.equal(rows.reduce((s,r)=>s+r.points,0),8);assert.equal(rows.find(r=>r.team.id==='C').points,4);assert.equal(rows.find(r=>r.team.id==='A').away.lose,1);const tied=M.table([fixture(1,'A','B',{home:1,away:1})]);assert.equal(tied[0].rank,tied[1].rank);});
test('exact score, correct outcome and wrong outcome score 3/1/0; no unknown or future finals',()=>{const f=fixture(1,'A','B',{home:2,away:1});assert.equal(UI.prediction({home:2,away:1},f,now).points,3);assert.equal(UI.prediction({home:4,away:0},f,now).points,1);assert.equal(UI.prediction({home:0,away:1},f,now).points,0);assert.equal(UI.prediction({home:0,away:0},fixture(2,'A','B',{home:1,away:1}),now).points,1);assert.equal(UI.prediction({home:2,away:1},{...f,date:'2026-11-05T12:00:00Z'},now).points,null);assert.equal(UI.prediction({home:2,away:1},{...f,goals:{home:null,away:null}},now).points,null);assert.equal(UI.prediction({home:2,away:1},fixture(2,'A','B',null,'2026-11-03T12:00:00Z'),now).status,'gesloten');});
test('verified award survives missing source and offline restart',()=>{const p=JSON.parse(JSON.stringify({home:1,away:1,kickoff:'2026-11-01T12:00:00Z',assessment:{points:3,checkedAt:'2026-11-02T12:00:00Z'}}));assert.deepEqual(UI.prediction(p,null,now),{points:3,status:'beoordeeld'});});
const input=()=>({competition:'eredivisie',fixtures:[fixture('a','PSV','Ajax',null,'2026-11-06T12:00:00Z')],checks:{independentlyVerified:true,commercialReuseAllowed:true,originalEntry:true,noProtectedDatabaseExtraction:true},reviewer:'Redactie',sourceUrl:'https://example.org/permission',rightsEvidence:'Eigen onafhankelijke invoer met vastgelegde toestemming.'});
test('manual publication fails closed without every approval, duplicate IDs, future final or concrete rights evidence',()=>{for(const key of Object.keys(input().checks)){const b=input();b.checks[key]=false;assert.throws(()=>M.manual(b,now));}const b=input();b.fixtures.push(b.fixtures[0]);assert.throws(()=>M.manual(b,now));const c=input();c.fixtures[0].status='FT';c.fixtures[0].goals={home:1,away:0};assert.throws(()=>M.manual(c,now));const d=input();d.rightsEvidence='gratis';assert.throws(()=>M.manual(d,now));assert.equal(M.manual(input(),now).standings.length,0);});
test('unavailable leagues never acquire fabricated standings or paid fallback; no extra remote calls',async()=>{let calls=0;const service=M.create({clock:()=>now,fetcher:()=>{calls++;throw Error();}});const s=await service.get('kkd');assert.equal(s.status,'unavailable');assert.equal(s.fixtures.length,0);assert.equal(s.standings.length,0);await service.get('kkd');assert.equal(calls,0);});
test('concurrent source requests share a request; outage retries after one minute',async()=>{let calls=0,t=now;const service=M.create({clock:()=>t,fetcher:async()=>{calls++;throw Error('offline');}});await Promise.all([service.get('bundesliga'),service.get('bundesliga')]);assert.equal(calls,1);await service.get('bundesliga');assert.equal(calls,1);t+=61000;await service.get('bundesliga');assert.equal(calls,2);});
test('shirt markup only accepts validated colours and escapes club names',()=>{const s=UI.shirt({name:'<img onerror=alert(1)>',colours:['red" onload="alert(1)','#ffffff']});assert.equal((s.match(/<svg/g)||[]).length,1); assert.ok(s.includes('club-shirt90'));assert.ok(!s.includes('onload='));assert.ok(s.includes('&lt;img'));});

test('known club shirts retain distinct premium kits without invented Veldio chest logos',()=>{
 for(const [club,code] of [['FC Groningen','GRO'],['AZ Alkmaar','AZ'],['Excelsior','EXC'],['PEC Zwolle','PEC'],['PSV','PSV']]){
  const markup=UI.shirt({name:club});
  assert.ok(markup.includes('shirts-premium/'+code+'.svg'));
  assert.ok(!markup.includes('premium-kit-badge'));
  assert.ok(!markup.includes('veldio-logo.png'));
 }
 for(const club of ['FC Barcelona','Aston Villa','Club Brugge','Sabah']){
  const markup=UI.shirt({name:club});
  assert.ok(markup.includes('<svg'));
  assert.ok(!markup.includes('premium-kit-badge'));
 }
});
test('postponed or unknown-time games never remain open for predictions',()=>{for(const status of ['PST','CANC','TBD','AWAITING'])assert.equal(UI.prediction({home:1,away:0},{...fixture(1,'A','B',null,'2026-11-05T12:00:00Z'),status},now).status,'gesloten');});

test('supplementary Eredivisie results match the same fixture and preserve known scores and IDs',()=>{
 const {supplement}=require('../football-results52');
 const now=Date.parse('2026-11-06T12:00:00Z');
 const fixture={id:'stable',status:'AWAITING',date:'2026-11-01T13:30:00Z',round:'Speelronde 11',home:{name:'Excelsior'},away:{name:'FC Twente'}};
 const match={matchday:11,season:{startDate:'2026-08-07'},utcDate:fixture.date,status:'FINISHED',
  homeTeam:{name:'SBV Excelsior',shortName:'Excelsior'},awayTeam:{name:'FC Twente',shortName:'Twente'},
  score:{duration:'REGULAR',fullTime:{home:0,away:2}}};
 const run=(rows,matches)=>supplement(rows,{competition:{code:'DED'},matches},2026,now);
 assert.deepEqual(run([fixture],[match])[0].goals,{home:0,away:2});
 assert.equal(run([fixture],[match])[0].id,'stable');
 assert.equal(run([fixture],[match])[0].resultExpiresAt,now+36*3600000);
 const final={...fixture,status:'FT',goals:{home:3,away:0}};
 assert.equal(run([final],[match])[0],final);
 for(const variants of [[match,match],[{...match,matchday:10}],[{...match,status:'IN_PLAY'}],[{...match,utcDate:'2026-11-02T13:30:00Z'}],[{...match,score:{...match.score,fullTime:{home:null,away:2}}}]]){
  assert.equal(run([fixture],variants)[0],fixture);
 }
});

test('localizes round labels for display and preserves Dutch labels and competition codes',()=>{
 const cases=[
  ['5.Spieltag','Speelronde 5'],['6. Spieltag','Speelronde 6'],['Spieltag 7','Speelronde 7'],
  ['Round 12','Speelronde 12'],['Matchday 8','Speelronde 8'],['4','Speelronde 4'],
  ['Regular Season - 3','Speelronde 3'],['Quarter-finals','Kwartfinales'],
  ['Speelronde 12','Speelronde 12'],['Halve finales','Halve finales'],
  ['CL','CL'],['EL','EL'],['UCL','UCL'],[null,'Speelronde']
 ];
 for(const [raw,label] of cases)assert.equal(UI.roundLabel(raw),label);
});

test('UEFA 2026/27 Barcelona identity correction is exact and preserves other competitions',()=>{
 const original=(home,away,date='2026-11-03T20:00:00Z',key='championsleague',season=2026,finished=false,score=null)=>
  M.verifiedUefaClubIdentity({key,season,date,home:{id:'h',name:home},away:{id:'a',name:away},finished,score});
 assert.equal(original('Excelsior Rotterdam','Aston Villa').home.name,'FC Barcelona');
 assert.equal(original('Sabah','Excelsior Rotterdam','2026-11-25T17:45:00Z').away.name,'FC Barcelona');
 assert.equal(original('Excelsior Rotterdam','Aston Villa','2025-11-03T20:00:00Z').home.name,'Excelsior Rotterdam');
 assert.equal(original('Excelsior Rotterdam','Aston Villa',undefined,'eredivisie').home.name,'Excelsior Rotterdam');
 assert.equal(original('Excelsior Rotterdam','Other Club').home.name,'Excelsior Rotterdam');
 assert.throws(()=>original('Excelsior Rotterdam','Aston Villa',undefined,'championsleague',2026,true,{pointsTeam1:0,pointsTeam2:3}),/geblokkeerd/);
});
test('OpenLiga Champions League source fixes exactly the verified fixtures without changing their scores or IDs',()=>{
 const now=Date.parse('2026-11-15T14:00:00Z');
 const make=(matchID,home,away,date='2026-11-26T20:00:00Z',finished=false)=>
  ({matchID,leagueShortcut:'ucl',leagueSeason:2026,matchDateTimeUTC:date,
    team1:{teamId:matchID*2,teamName:home},team2:{teamId:matchID*2+1,teamName:away},
    matchIsFinished:finished,matchResults:finished?[{resultTypeID:2,pointsTeam1:3,pointsTeam2:0}]:[]});
 const rows=Array.from({length:98},(_,i)=>make(i+3,'Club '+i,'Opponent '+i));
 rows.push(make(1,'Excelsior Rotterdam','Aston Villa','2026-11-03T20:00:00Z',true));
 rows.push(make(2,'Sabah','Excelsior Rotterdam','2026-11-25T17:45:00Z'));
 const snapshot=M.fromOpenLiga(rows,now,'championsleague');
 const barcelona=snapshot.fixtures.find(x=>x.id==='oldb-1');
 const sabah=snapshot.fixtures.find(x=>x.id==='oldb-2');
 assert.equal(barcelona.home.name,'FC Barcelona');
 assert.equal(barcelona.goals.home,3);
 assert.equal(barcelona.goals.away,0);
 assert.equal(sabah.away.name,'FC Barcelona');
 assert.equal(sabah.away.id,barcelona.home.id);
 assert.equal(sabah.status,'NS');
 assert.equal(snapshot.fixtures.length,100);
});
test('Android match layout separates date and time and never inserts unsupported kit badges',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const root=path.join(__dirname,'../android-project/app/src/main/assets');
 const html=fs.readFileSync(path.join(root,'destinations39.html'),'utf8');
 const css=fs.readFileSync(path.join(root,'veldio-ui86.css'),'utf8');
 assert.match(html,/kickoff97/);
 assert.match(css,/no overlap between long club names/);
 assert.match(css,/overflow-wrap:anywhere!important/);
 assert.ok(css.includes('padding-bottom:max(112px'));
 const ui=fs.readFileSync(path.join(root,'football47.js'),'utf8');
 assert.ok(!ui.includes('premium-kit-badged'));
});

test('corrects complete club-name variants, including whitespace and decomposed accents',()=>{
 const cases=[
  ['Feyenoord Rotterdam','Feyenoord'],['Inter Mailand','Inter'],['Internazionale Milano','Inter'],['Inter Milan','Inter'],
  ['AC Mailand','AC Milaan'],['AC Milan','AC Milaan'],
  ['Olympiakos Piräus','Olympiakos Pireus'],['Olympiakos Piraus','Olympiakos Pireus'],
  ['Olympiakos Piraeus','Olympiakos Pireus'],['Olympiacos Piraeus','Olympiakos Pireus'],
  ['Atletico Madrid','Atlético Madrid'],['Atletico de Madrid','Atlético Madrid'],
  ['FC Bayern München','Bayern München'],['FC Bayern Munchen','Bayern München'],['Bayern Munich','Bayern München'],
  ['FC Brugge','Club Brugge'],['FC Brügge','Club Brugge'],['Club Brugge KV','Club Brugge'],
  ['PSV Eindhoven','PSV'],['fc porto','FC Porto'],
  ['Ajax Amsterdam','Ajax'],['AFC Ajax','Ajax'],['FC Twente Enschede','FC Twente'],
  ['AEK Athen','AEK Athene'],['AEK Athens','AEK Athene'],['AS Rom','AS Roma'],
  ['FC Arsenal','Arsenal'],['FC Liverpool','Liverpool'],['Manchester United FC','Manchester United'],
  ['Crystal Palace FC','Crystal Palace'],['Brighton & Hove Albion F.C.','Brighton & Hove Albion'],
  ['Brentford F.C.','Brentford'],['Chelsea FC','Chelsea'],['Everton FC','Everton'],
  ['Fulham FC','Fulham'],['Newcastle United FC','Newcastle United'],['Tottenham Hotspur FC','Tottenham Hotspur'],
  ['Paris St. Germain','Paris Saint-Germain'],['Paris Saint Germain','Paris Saint-Germain'],
  ['FK Bodö/Glimt','Bodø/Glimt'],['Bodo/Glimt','Bodø/Glimt'],
  ['Slavia Prag','Slavia Praag'],['Slavia Prague','Slavia Praag'],
  ['Sparta Prag','Sparta Praag'],['Sparta Prague','Sparta Praag'],
  ['Viktoria Pilsen','Viktoria Plzeň'],['Viktoria Plzen','Viktoria Plzeň'],
  ['Benfica Lissabon','Benfica'],['Besiktas Istanbul','Beşiktaş'],['Besiktas','Beşiktaş'],
  ['Celtic Glasgow','Celtic'],['Juventus Turin','Juventus'],['Hapoel Beer Scheva','Hapoel Beer Sheva'],
  ['Jagiellonia Bialystok','Jagiellonia Białystok'],['Lech Poznan','Lech Poznań'],['Omonia Nikosia','Omonia Nicosia'],
  ['FC Getafe','Getafe CF'],['FC Malaga','Málaga CF'],['Deportivo Alaves','Deportivo Alavés'],
  ['FC Sevilla','Sevilla FC'],['FC Valencia','Valencia CF'],['FC Villareal','Villarreal CF'],
  ['FC Iberia 1999 Tiflis','Iberia Tbilisi'],['FC Nordsjaelland','FC Nordsjælland'],
  ['Paphos FC','Pafos FC'],['Roter Stern Belgrad','Rode Ster Belgrado'],['ZSKA Sofia','CSKA Sofia'],
  ['SSC Napoli  ','SSC Napoli'],
  ['  '+ 'FC BRÜGGE'.normalize('NFD') +'  ','Club Brugge'],
 ];
 for(const [input,expected] of cases){
  for(const key of ['championsleague','europaleague','conferenceleague']){
   assert.equal(M.displayClubName(input,key),expected,input+' / '+key);
   assert.equal(M.displayClubName(expected,key),expected);
  }
 }
 assert.equal(M.displayClubName('FC Bayern München','bundesliga'),'FC Bayern München');
 assert.equal(M.displayClubName('AFC Ajax','eredivisie'),'Ajax');
 assert.equal(M.displayClubName('Brentford F.C.','premierleague'),'Brentford');
 assert.equal(M.displayClubName('FC Villareal','laliga'),'Villarreal CF');
});

test('preserves correct names and distinguishes similar club identities',()=>{
 for(const input of ['Ajax Amateurs','Jong Ajax','Excelsior Rotterdam','Excelsior Maassluis',
  'Cercle Brugge','Club Brugge','AEK Larnaca','CSKA 1948 Sofia','AC Milaan','Inter',
  "Inter Club d'Escaldes",'Sparta Rotterdam','Sparta Nijkerk','AZ Alkmaar',
  'Olympique Marseille','Olympique Lyon','Sporting CP','Stade Rennes','FC Kopenhagen','Bodø/Glimt']){
  assert.equal(M.displayClubName(input,'conferenceleague'),input);
 }
 assert.equal(M.displayClubName('AC Mailand','unknown'),'AC Mailand');
});

test('corrects cached fixtures and standings without changing IDs, scores, sources or match selection',async()=>{
 const base=fixture('oldb-123','AC Mailand','Real Madrid',{home:2,away:1});
 const match={...base,competition:'europaleague',resultSource:'Bron',
  home:{id:'oldb-45',name:'AC Mailand'},away:{id:'oldb-67',name:'Real Madrid'}};
 const snapshot=M.envelope('europaleague',[match],now);
 const getCache=async key=>{
  if(key==='football47:europaleague')return JSON.stringify(snapshot);
  return JSON.stringify(M.envelope(key.slice('football47:'.length),[],now));
 };
 const service=M.create({clock:()=>now,redis:{isReady:true,get:getCache},fetcher:()=>assert.fail('Unexpected fetch')});
 const localized=await service.get('europaleague');
 assert.deepEqual(localized.fixtures,[{...match,home:{...match.home,name:'AC Milaan'}}]);
 assert.deepEqual(localized.standings[0],{...snapshot.standings[0],team:{...match.home,name:'AC Milaan'}});
 assert.deepEqual(localized.sourceDetails,snapshot.sourceDetails);
 assert.deepEqual((await service.getSelected('europaleague')).fixtures,[]);
 assert.deepEqual((await service.overview()).europeanFixtures,[]);
 assert.deepEqual(await service.get('europaleague',{legacy:true}),snapshot);
 assert.equal(snapshot.fixtures[0].home.name,'AC Mailand');
});

test('legacy names remain available for installed APK shirt lookups',()=>{
 const legacy={legacy:true};
 assert.equal(M.displayClubName('Olympiakos Piräus','europaleague',legacy),'Olympiakos Piräus');
 assert.equal(M.displayClubName('AC Mailand','europaleague',legacy),'AC Mailand');
 assert.equal(M.displayClubName('FC Brügge','championsleague',legacy),'FC Brügge');
 assert.equal(M.displayClubName('Club Brugge KV','championsleague',legacy),'Club Brugge');
 assert.equal(M.displayClubName('FC Bayern München','championsleague',legacy),'Bayern München');
 assert.equal(M.displayClubName('FC Bayern München','bundesliga',legacy),'FC Bayern München');
 const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'../server.js'),'utf8');
 assert.match(source,/legacy:url\.searchParams\.get\("clubNames"\)!=="nl"/);
});

test('full UEFA program stays available to fixture view while editorial shortlist remains opt-in',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const source=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 assert.match(source,/view"\)==="veldio50"&&key==="eredivisie"\?football47\.overview\(options\):football47\.get\(key,options\)/);
 assert.doesNotMatch(source,/key==="eredivisie"\?football47\.overview\(options\):football47\.getSelected\(key\)/);
});
