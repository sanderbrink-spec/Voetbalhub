'use strict';
// Uses the existing rights-gated statistics publication, not a new source feed.
const {chooseFeatured,buildPreview,DONE,DATA_URL,githubFile,REPO,BRANCH,hash}=require('./eredivisie-data');
const HOURS=72*3600000;
const scheduled=(f,now)=>f?.status==='NS'&&Date.parse(f.date)>now;
const complete=(f,now)=>DONE.has(f?.status)&&Date.parse(f.date)<=now&&[f.goals?.home,f.goals?.away].every(n=>Number.isInteger(n)&&n>=0&&n<=99);
function valid(feature){const p=feature?.phase==='report'?feature.report:feature?.preview;return !!(p?.fixture?.home?.name&&p.fixture.away?.name&&Array.isArray(p.body)&&p.body.length>=3&&p.body.every(x=>typeof x==='string'&&x.trim())&&/^https:\/\//.test(feature.imageUrl||''));}
function nextSelection(s,now,previous){
 const old=s.fixtures.find(f=>String(f.id)===String(previous?.fixtureId));
 if(previous?.phase!=='report'&&scheduled(old,now))return {...previous,fixture:old,publishAt:new Date(Date.parse(old.date)-HOURS).toISOString()};
 const rounds=[...new Set(s.fixtures.filter(f=>scheduled(f,now)).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)).map(f=>f.round))];
 for(const round of rounds){const fixtures=s.fixtures.filter(f=>f.round===round&&scheduled(f,now));if(!fixtures.length)continue;
  const start=Math.min(...fixtures.map(f=>Date.parse(f.date))),choice=chooseFeatured({...s,fixtures},start-1);
  if(choice)return {...choice,selectedAt:new Date(now).toISOString(),publishAt:new Date(Date.parse(choice.fixture.date)-HOURS).toISOString()};
 }
 return null;
}
function buildReport(f,now){
 if(!complete(f,now))throw Error('Geen bevestigde definitieve wedstrijdstatus en eindstand.');
 const score=f.goals.home+'–'+f.goals.away,names=f.home.name+' en '+f.away.name;
 const outcome=f.status==='PEN'?'Het duel is na strafschoppen afgerond.':f.goals.home===f.goals.away?'De ploegen eindigden met evenveel doelpunten.':(f.goals.home>f.goals.away?f.home.name:f.away.name)+' heeft het duel gewonnen.';
 return {headline:f.home.name+' – '+f.away.name+': '+score,standfirst:'Wedstrijd van de week. '+outcome,
 body:[names+' hebben hun wedstrijd afgerond met een genoteerde doelpuntenstand van '+score+' in de volgorde thuis-uit. '+outcome,
 'De wedstrijd is door de gegevensbron als '+({FT:'afgelopen',AET:'afgelopen na verlenging',PEN:'afgelopen na strafschoppen'})[f.status]+' bevestigd. '+(f.status==='PEN'?'De genoemde doelpuntenstand is geen afzonderlijke strafschoppenserie.':'De eindstand betreft de definitief doorgegeven wedstrijdstand.'),
 'Dit oorspronkelijke resultaatverslag bevat uitsluitend de bevestigde wedstrijdidentiteit, status en uitslag. Doelpuntenmakers, spelverloop en andere wedstrijdstatistieken zijn niet aan dit verslag toegevoegd omdat zij hier niet afzonderlijk zijn gecontroleerd.'],
 fixture:structuredClone(f),publishedAt:new Date(now).toISOString()};
}
async function ownReportImage(f,{token,fetcher=fetch}={}){
 if(!DONE.has(f?.status)||![f.goals?.home,f.goals?.away].every(n=>Number.isInteger(n)&&n>=0&&n<=99))throw Error('Onbevestigde uitslag voor resultaatbeeld.');
 const base=await require('../own-editorial-art').render({draft:{headline:f.home.name+' tegen '+f.away.name},category:'Eredivisie'});
 const score=f.goals.home+' – '+f.goals.away;
 const esc=s=>String(s).slice(0,60).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 // Explicit home/away order; the general renderer's club lookup order is irrelevant.
 const panels=[f.home,f.away].map((team,i)=>{const x=i?1130:470;return '<rect x="'+(x-235)+'" y="286" width="470" height="310" rx="30" fill="#07190e" stroke="#25f06b" stroke-width="2"/><text x="'+x+'" y="420" text-anchor="middle" font-family="DejaVu Sans" font-size="24" fill="#a3b4a8">'+(i?'UIT':'THUIS')+'</text><text x="'+x+'" y="490" text-anchor="middle" font-family="DejaVu Sans" font-size="'+(team.name.length>22?22:32)+'" fill="#f4f8f5">'+esc(team.name)+'</text>';}).join('');
 const overlay=Buffer.from('<svg width="1600" height="900"><rect x="225" y="260" width="1150" height="360" fill="#07190e"/>'+panels+'<text x="800" y="465" text-anchor="middle" font-family="DejaVu Sans" font-size="57" fill="#25f06b">'+score+'</text></svg>');
 const bytes=await require('sharp')(base).composite([{input:overlay}]).webp({quality:90}).toBuffer(),digest=hash(bytes),file='weekly/'+f.id+'-report-'+digest+'.webp';
 await githubFile(file,bytes,{token,fetcher});
 return {imageUrl:`https://raw.githubusercontent.com/${REPO}/${BRANCH}/${file}`,imageCredit:'Veldio · eigen resultaatillustratie, geen wedstrijdfoto',imageReview:{method:'own-weekly-score-v1',fixtureId:f.id,goals:structuredClone(f.goals),sha256:digest}};
}
async function readPrevious(fetcher=fetch){const r=await fetcher(DATA_URL,{signal:AbortSignal.timeout(25000),redirect:'error'});if(r.status===404)return null;if(!r.ok)throw Error('Vorig wedstrijdblok niet leesbaar; publicatie afgebroken.');const data=await r.json();if(data.schemaVersion!==1||data.league?.id!==88)throw Error('Vorig wedstrijdblok ongeldig; publicatie afgebroken.');return data;}
async function update(s,previous,{now=Date.now(),previewImage,reportImage=ownReportImage,token,fetcher=fetch}={}){
 if(!Number.isFinite(now)||!Array.isArray(s?.fixtures)||s.league?.id!==88||!Number.isFinite(Date.parse(s.updatedAt))||Date.parse(s.updatedAt)>now+60000||previous&&Date.parse(previous.updatedAt)>Date.parse(s.updatedAt))throw Error('Wedstrijdgegevens ontbreken of zijn ouder dan de laatste publicatie.');
 const warnings=s.warnings||(s.warnings=[]);let current=valid(previous?.featured)?structuredClone(previous.featured):null;
 const observed=s.fixtures.find(f=>String(f.id)===String(current?.fixtureId));
 if(current&&complete(observed,now)&&Date.parse(s.updatedAt)>=Date.parse(observed.date)){
  const same=current.phase==='report'&&JSON.stringify(current.report.fixture)===JSON.stringify(observed);
  if(!same)try{const report=buildReport(observed,now),art=await reportImage(observed,{token,fetcher}),candidate={...current,phase:'report',publicationId:'weekly-'+s.league.season+'-'+observed.id+'-report',report,fixture:observed,...art};delete candidate.preview;if(!valid(candidate))throw Error('Verslag of afbeelding ontbreekt.');current=candidate;}catch(e){warnings.push('Weekverslag behouden: '+e.message);}
 }
 const priorNext=previous?.nextFeatured;
 // One selected match per round: a later Sunday fixture must not displace
 // Saturday's live match or its just-published report.
 const retainSelection=current?.phase!=='report'&&scheduled(observed,now);
 const selectionSnapshot=current&&!retainSelection?{...s,fixtures:s.fixtures.filter(f=>f.round!==current.round&&String(f.id)!==String(current.fixtureId))}:s;
 const selected=nextSelection(selectionSnapshot,now,retainSelection?current:priorNext);let next=null;
 if(selected)try{
  const cached=[priorNext,current].find(f=>valid(f)&&f.phase!=='report'&&String(f.fixtureId)===String(selected.fixtureId)&&f.preview.fixture.date===selected.fixture.date&&JSON.stringify(f.preview.fixture.venue)===JSON.stringify(selected.fixture.venue));
  next=cached?{...structuredClone(cached),publishAt:selected.publishAt}:null;
  if(!next){const art=await previewImage(selected,s),candidate={...selected,...art,phase:'preview',publicationId:'weekly-'+s.league.season+'-'+selected.fixtureId+'-preview',preview:buildPreview(s,selected)};if(!valid(candidate))throw Error('Voorbeschouwing of afbeelding ontbreekt.');next=candidate;}
 }catch(e){warnings.push('Weekvoorbeschouwing behouden: '+e.message);}
 if(next&&now>=Date.parse(next.publishAt)){current=next;next=null;}
 if(current){s.featured=current;const actual=s.fixtures.find(f=>String(f.id)===String(current.fixtureId));if(actual)s.featured.observedFixture=structuredClone(actual);}else delete s.featured;
 if(next)s.nextFeatured=next;else delete s.nextFeatured;
 return s;
}
module.exports={HOURS,complete,valid,nextSelection,buildReport,ownReportImage,readPrevious,update};
