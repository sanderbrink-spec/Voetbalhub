'use strict';
// Read-only production audit. Never calls publication, model or image-generation endpoints.
const fs=require('node:fs');
const {sourceBody}=require('../football-data47');
const BASE='https://voetbalhub-redactie.onrender.com';
const REPO='sanderbrink-spec/Voetbalhub';
const DAY=86400000;
const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function articlesChecks(articles,now=Date.now()){
 const checks=[],seen=new Map();
 const add=(id,status,detail)=>checks.push({id,status,detail});
 const current=articles.filter(a=>a.feedState!=='archived');
 if(!current.length)add('news.available','fail','Geen actuele artikelen');
 let latest=0;
 for(const a of articles){
  const id=String(a.id||'onbekend'),date=Date.parse(a.publishedAt);
  if(!Number.isFinite(date)||date>now)add('news.date:'+id,'fail','Ongeldige of toekomstige publicatiedatum');
  if(a.feedState==='archived')continue;
  if(a.type!=='column')latest=Math.max(latest,Number.isFinite(date)?date:0);
  const key=normalize(a.headline);
  if(!key||!Array.isArray(a.body)||!a.body.length)add('news.content:'+id,'fail','Kop of artikeltekst ontbreekt');
  if(seen.has(key))add('news.duplicate:'+id,'fail','Dubbele kop; eerste artikel '+seen.get(key));
  seen.set(key,id);
  if(a.type!=='column'&&(!Array.isArray(a.sources)||!a.sources.length))add('news.sources:'+id,'fail','Bronverwijzingen ontbreken');
  if(a.type!=='column'&&!a.imageUrl&&!a.imageAsset)add('news.image:'+id,'fail','Artikelafbeelding ontbreekt');
 }
 add('news.freshness',now-latest<=3*DAY?'pass':'fail',latest?'Laatste nieuws: '+new Date(latest).toISOString():'Geen gedateerd nieuws');
 if(!checks.some(c=>c.id.startsWith('news.duplicate:')))add('news.duplicates','pass','Geen dubbele koppen in de actuele feed');
 return checks;
}
function footballChecks(key,s,now=Date.now()){
 const checks=[],add=(name,status,detail)=>checks.push({id:'football.'+key+'.'+name,status,detail});
 const date=Date.parse(s.updatedAt),age=now-date;
 add('available',['available','cached'].includes(s.status)&&s.fixtures?.length?'pass':'fail',s.message||s.status||'Status ontbreekt');
 add('freshness',Number.isFinite(date)&&age>=0&&age<=36*3600000&&Number(s.rightsExpiresAt)>now?'pass':'fail','Bijgewerkt: '+(s.updatedAt||'onbekend'));
 if(s.status==='cached')add('synchronization','fail','Bronuitval; alleen eerder gecontroleerde cache beschikbaar');
 const fixtures=s.fixtures||[],ids=new Set();
 for(const f of fixtures){
  if(!f.id||ids.has(f.id)||!f.home?.id||!f.away?.id||f.home.id===f.away.id||!Number.isFinite(Date.parse(f.date)))add('record:'+f.id,'fail','Ongeldige of dubbele wedstrijd');
  ids.add(f.id);
  if(f.status==='FT'&&(![f.goals?.home,f.goals?.away].every(x=>Number.isInteger(x)&&x>=0)||Date.parse(f.date)>now))add('result:'+f.id,'fail','Onbevestigde of toekomstige eindstand');
 }
 const overdue=fixtures.filter(f=>Date.parse(f.date)<now-DAY&&['NS','AWAITING'].includes(f.status));
 if(overdue.length)add('missing-results','fail',overdue.length+' verstreken wedstrijden zonder gecontroleerde eindstand');
 if(fixtures.length&&!s.standings?.length)add('standings','warn',s.standingsNote||'Geen volledige betrouwbare stand');
 return checks;
}
function workflowChecks(runs,now=Date.now()){
 const paths=['automatic-publication.yml','auto-editor.yml','eredivisie.yml','youtube43.yml'];
 return paths.map(name=>{
  const r=runs.filter(r=>r.path?.endsWith('/'+name)&&r.status==='completed').sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))[0];
  return {id:'task.'+name,status:r&&r.conclusion==='success'&&now-Date.parse(r.created_at)<2*DAY?'pass':'fail',detail:r?'Run '+r.id+': '+r.conclusion+'; '+r.created_at:'Geen recente afgeronde taak gevonden'};
 });
}
const allowedHosts=new Set(['voetbalhub-redactie.onrender.com','raw.githubusercontent.com','www.youtube.com','i.ytimg.com',...require('../automatic-editorial.json').officialDomains]);
function allowedLink(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&allowedHosts.has(u.hostname.replace(/^www\./,''));}catch{return false;}}
// Include both bare and www official host forms, with a fixed host allowlist.
allowedHosts.add('youtube.com');
async function request(url,{fetcher=fetch,json=true,headers={}}={}){
 const signal=AbortSignal.timeout(20000);
 for(let redirects=0;redirects<=2;redirects++){
  const r=await fetcher(url,{signal,redirect:'manual',headers});
  if(r.status>=300&&r.status<400){const next=new URL(r.headers.get('location')||'',url);await r.body?.cancel();if(!allowedLink(next.href))throw Error('Omleiding buiten toegestane bron');url=next.href;continue;}
  if(!r.ok){await r.body?.cancel();throw Error('HTTP '+r.status);}
  if(!json){await r.body?.cancel();return {status:r.status};}
  return JSON.parse(await sourceBody(r,3000000));
 }
 throw Error('Te veel omleidingen');
}
async function audit({fetcher=fetch,now=Date.now(),token=process.env.GITHUB_TOKEN,checkLinks=true,checkTasks=true}={}){
 const report={schemaVersion:48,checkedAt:new Date(now).toISOString(),checks:[],coverage:{externalLimit:12,automaticRepair:false}};
 const add=(id,status,detail)=>report.checks.push({id,status,detail});
 const get=path=>request(BASE+path,{fetcher});
 let health,articles=[];
 try{health=await get('/health');report.revision=health.revision;add('backend.health',health.ok&&health.storage==='connected'?'pass':'fail','Opslag: '+health.storage);add('contact.configuration',health.contact?.configured?'pass':'fail',health.contact?.configured?'Geconfigureerd; bezorging apart te testen':'Mailconfiguratie ontbreekt');add('images.provider',health.imagePipeline?.providerConfigured?'pass':'fail','Beeldprovider '+(health.imagePipeline?.providerConfigured?'geconfigureerd; generatie niet gestart':'ontbreekt'));}catch(e){add('backend.health','fail',e.message);}
 try{const r=await get('/ready');add('backend.ready',r.ready?'pass':'fail','Opslag-PING en gereedheid');}catch(e){add('backend.ready','fail',e.message);}
 const routes=['/desk','/football-desk','/contact','/privacy','/integrations/football/catalog'];
 for(const path of routes)try{await request(BASE+path,{fetcher,json:false});add('route:'+path,'pass','Bereikbaar');}catch(e){add('route:'+path,'fail',e.message);}
 try{const r=await get('/articles?view=all');if(!Array.isArray(r.articles))throw Error('Ongeldige artikelenresponse');articles=r.articles;report.checks.push(...articlesChecks(articles,now));}catch(e){add('news.response','fail',e.message);}
 for(const key of ['eredivisie','kkd','bundesliga','premierleague','laliga','championsleague','europaleague'])try{report.checks.push(...footballChecks(key,await get('/integrations/football?competition='+key),now));}catch(e){add('football.'+key+'.response','fail',e.message);}
 try{const r=await get('/integrations/videos43');add('videos.catalogue',r.videos?.length&&Date.parse(r.expiresAt)>now?'pass':'fail',r.playlistStatus||'Geen status');if(r.videos?.some(v=>v.embeddable&&v.verification!=='youtube-data-api'))add('videos.embedding','fail','Insluittoestemming niet bevestigd');}catch(e){add('videos.catalogue','fail',e.message);}
 if(checkLinks){
  const values=[...new Set(articles.filter(a=>a.feedState!=='archived').flatMap(a=>[a.imageUrl,...(a.sources||[]).map(s=>s.url)]).filter(Boolean))];
  const eligible=values.filter(allowedLink).slice(0,12);report.coverage.externalChecked=eligible.length;report.coverage.externalNotChecked=values.length-eligible.length;
  for(let i=0;i<eligible.length;i+=3)await Promise.all(eligible.slice(i,i+3).map(async url=>{try{await request(url,{fetcher,json:false});add('link:'+url,'pass','Bereikbaar');}catch(e){add('link:'+url,'fail',e.message);}}));
  if(values.length>eligible.length)add('links.coverage','warn',(values.length-eligible.length)+' links buiten dagsteekproef of vaste bronlijst');
 }
 if(checkTasks){try{const r=await request('https://api.github.com/repos/'+REPO+'/actions/runs?branch=main&per_page=100',{fetcher,headers:token?{Authorization:'Bearer '+token,'Accept':'application/vnd.github+json'}:{}});report.checks.push(...workflowChecks(r.workflow_runs||[],now));}catch(e){add('tasks.status','fail',e.message);}}
 report.failed=report.checks.filter(c=>c.status==='fail').length;report.warnings=report.checks.filter(c=>c.status==='warn').length;report.status=report.failed?'fail':report.warnings?'warning':'pass';
 return report;
}
function markdown(r){return '# Veldio productiecontrole\n\nControle: '+r.checkedAt+'  \nCommit: '+(r.revision||'onbekend')+'  \nStatus: '+r.status+'; '+r.failed+' fouten, '+r.warnings+' waarschuwingen.\n\n| Controle | Status | Bevinding |\n| --- | --- | --- |\n'+r.checks.map(c=>'| '+[c.id,c.status,c.detail].map(s=>String(s).replace(/\|/g,' / ').replace(/[\r\n]/g,' ')).join(' | ')+' |').join('\n')+'\n';}
if(require.main===module)audit().then(r=>{fs.mkdirSync('.quality-output',{recursive:true});fs.writeFileSync('.quality-output/production-health.json',JSON.stringify(r,null,2)+'\n');const md=markdown(r);fs.writeFileSync('.quality-output/production-health.md',md);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md);console.log('Veldio productiecontrole: '+r.status+'; '+r.failed+' fouten, '+r.warnings+' waarschuwingen');process.exitCode=r.failed?1:0;}).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={articlesChecks,footballChecks,workflowChecks,allowedLink,request,audit,markdown};
