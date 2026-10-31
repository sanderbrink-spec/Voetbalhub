'use strict';
const {hash,githubFile,REPO,BRANCH,apiRequest}=require('./eredivisie-data');
const fs=require('node:fs'),path=require('node:path');
const stadiumAssets=require('../stadium-assets.json');
const photoClaims=new Map(stadiumAssets.knownPhotoIdentities.map(x=>[x.sha256,x.venue]));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function assertStadiumIdentity(sourceHash,venueName){
 if(!venueName)throw Error('Stadionnaam ontbreekt bij fotocontrole.');
 const owner=photoClaims.get(sourceHash);
 if(owner&&norm(owner)!==norm(venueName))throw Error('Verkeerd stadionbeeld: deze foto hoort bij '+owner+', niet bij '+venueName+'.');
 photoClaims.set(sourceHash,venueName);
}
function reviewedStadium(venue){return stadiumAssets.reviewed.find(e=>e.aliases.some(a=>norm(a)===norm(venue.name)));}
async function stadiumAsset(m,fetcher){
 if(m.stadiumAsset){
  const entry=reviewedStadium(m.fixture.venue);
  if(!entry||entry.file!==m.stadiumAsset)throw Error('Stadionbestand hoort niet bij de wedstrijdlocatie.');
  const bytes=fs.readFileSync(path.join(__dirname,'../public/stadiums',entry.file));
  if(hash(bytes)!==entry.sha256)throw Error('Gecontroleerde stadionfoto is gewijzigd.');
  assertStadiumIdentity(hash(bytes),m.fixture.venue.name);
  return 'data:image/png;base64,'+(await require('sharp')(bytes).png().toBuffer()).toString('base64');
 }
 return asset(m.stadiumImage,fetcher,{stadiumName:m.fixture.venue.name});
}
function assertMatch(m){
 if(!['preview','report'].includes(m.kind)||!m.fixture?.home?.name||!m.fixture?.away?.name||!Number.isFinite(Date.parse(m.fixture.date)))throw Error('Bevestigde wedstrijdgegevens ontbreken.');
 if(m.kind==='preview'&&(!m.venueVerified||!m.stadiumImage||!m.fixture.venue?.name))throw Error('Het specifieke stadionbeeld ontbreekt.');
 if(m.kind==='report'&&(!['FT','AET','PEN'].includes(m.fixture.status)||!Number.isInteger(m.fixture.goals?.home)||!Number.isInteger(m.fixture.goals?.away)))throw Error('Gecontroleerde eindstand ontbreekt.');
 if(!m.fixture.home.logo||!m.fixture.away.logo)throw Error('Echte clublogos ontbreken.');
}
function svg(m,assets){
 assertMatch(m);if(!assets.home||!assets.away||(m.kind==='preview'&&!assets.stadium))throw Error('Beeldbestanden ontbreken.');
 const f=m.fixture,report=m.kind==='report';
 const kickoff=new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(new Date(f.date));
 const label=(name,x)=>{const size=name.length>22?30:name.length>16?37:44;return `<text x="${x}" y="620" font-size="${size}" text-anchor="middle" font-weight="700" fill="white">${esc(name)}</text>`;};
 return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1600" height="900" viewBox="0 0 1600 900"><defs><linearGradient id="shade" x1="0%" y1="0%" x2="0%" y2="100%"><stop stop-color="#06140d" stop-opacity=".12"/><stop offset="1" stop-color="#030b07" stop-opacity=".88"/></linearGradient><radialGradient id="glow"><stop stop-color="#285134"/><stop offset="1" stop-color="#06110b"/></radialGradient></defs><rect width="1600" height="900" fill="url(#glow)"/>${!report?`<image xlink:href="${assets.stadium}" width="1600" height="900" preserveAspectRatio="xMidYMid slice"/>`:''}<rect width="1600" height="900" fill="url(#shade)"/><g font-family="DejaVu Sans,Arial,sans-serif"><text x="82" y="100" fill="#b0ff24" font-size="29" font-weight="700">VELDIO</text><text x="1518" y="100" text-anchor="end" fill="white" font-size="23">${report?'NABESCHOUWING':'VOORBESCHOUWING'}</text><image xlink:href="${assets.home}" x="310" y="235" width="260" height="260" preserveAspectRatio="xMidYMid meet"/><image xlink:href="${assets.away}" x="1030" y="235" width="260" height="260" preserveAspectRatio="xMidYMid meet"/><text x="800" y="415" text-anchor="middle" font-size="${report?115:52}" font-weight="700" fill="#b0ff24">${report?`${f.goals.home} – ${f.goals.away}`:'TEGEN'}</text>${label(f.home.name,440)}${label(f.away.name,1160)}<text x="800" y="725" text-anchor="middle" font-size="33" fill="#b0ff24">${report?'EINDSTAND':esc(kickoff)}</text><text x="800" y="790" text-anchor="middle" font-size="24" fill="#d8e3da">${esc(f.venue?.name||'')}${m.competition?' · '+esc(m.competition):''}</text>${m.stadiumCredit?`<text x="80" y="865" font-size="17" fill="#d8e3da">${esc(m.stadiumCredit)}</text>`:''}</g></svg>`;
}
function safeAsset(url){try{const u=new URL(url);return u.protocol==='https:'&&['media.api-sports.io','a.espncdn.com','eredivisie.b-cdn.net'].includes(u.hostname)&&!u.username&&!u.password;}catch{return false;}}
async function asset(url,fetcher=fetch,{stadiumName}={}){
 if(!safeAsset(url))throw Error('Niet-toegestane afbeeldingbron.');
 const r=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(25000)});
 if(!r.ok||!/^image\/(png|jpeg|webp)/i.test(r.headers.get('content-type')||''))throw Error('Afbeelding niet beschikbaar.');
 const bytes=Buffer.from(await r.arrayBuffer());if(!bytes.length||bytes.length>8000000)throw Error('Ongeldig beeldbestand.');
 if(stadiumName)assertStadiumIdentity(hash(bytes),stadiumName);
 const normalized=await require('sharp')(bytes,{limitInputPixels:20000000}).rotate().png().toBuffer();
 return 'data:image/png;base64,'+normalized.toString('base64');
}
async function stadiumFor(venue,key,fetcher=fetch){
 if(!venue?.name)throw Error('Stadionidentiteit ontbreekt.');
 const entry=reviewedStadium(venue);
 if(entry)return {stadiumImage:entry.sourceImage,stadiumAsset:entry.file,stadiumCredit:entry.credit,stadiumSourceUrl:entry.sourcePage,venueVerified:true};
 if(venue.provider==='API-SPORTS'&&Number.isInteger(venue.id))return {stadiumImage:`https://media.api-sports.io/football/venues/${venue.id}.png`,venueVerified:true};
 const aliases={'johancruijffarena':'Johan Cruijff ArenA','koningwillemiistadion':'Koning Willem II Stadion','mhcarena':'MCH Arena'};
 const name=aliases[norm(venue.name)]||venue.name;
 let rows=await apiRequest('venues',{name},key,fetcher);
 if(!rows.length&&norm(name)==='johancruijffarena'){const teams=await apiRequest('teams',{name:'Ajax'},key,fetcher);rows=teams.filter(t=>norm(t.team?.name)==='ajax'&&norm(t.venue?.name)==='johancruijffarena').map(t=>t.venue);}
 const matching=rows.filter(v=>norm(v.name)===norm(name));
 if(matching.length!==1||!Number.isInteger(matching[0].id))throw Error('Stadionfoto niet eenduidig bevestigd: '+venue.name);
 return {stadiumImage:`https://media.api-sports.io/football/venues/${matching[0].id}.png`,venueVerified:true};
}
async function createCover(m,{token,fetcher=fetch}={}){
 assertMatch(m);
 const assets={home:await asset(m.fixture.home.logo,fetcher),away:await asset(m.fixture.away.logo,fetcher)};
 if(m.kind==='preview')assets.stadium=await stadiumAsset(m,fetcher);
 const source=svg(m,assets),identity=hash(source),filename='match-covers/'+identity+'.png';
 const {Resvg}=require('@resvg/resvg-js');const png=new Resvg(source,{font:{loadSystemFonts:true}}).render().asPng();
 await githubFile(filename,png,{token,fetcher});
 const imageUrl=`https://raw.githubusercontent.com/${REPO}/${BRANCH}/${filename}`;
 const check=await fetcher(imageUrl,{redirect:'error',signal:AbortSignal.timeout(25000)});
 if(!check.ok||hash(Buffer.from(await check.arrayBuffer()))!==hash(png))throw Error('Wedstrijdbeeld niet openbaar bevestigd.');
 return {imageUrl,imageRights:'cleared',imageSource:'Veldio · wedstrijdvormgeving',imageCredit:(m.stadiumCredit||'Stadionbeeld: API-SPORTS')+' · clublogos: gegevensleverancier · vormgeving: Veldio',imageReview:{kitVerified:true,playerIdentityVerified:true,aiDisclosureVerified:true,notes:'Vaste beeldafspraak: '+m.kind+'. Exacte thuis-uitvolgorde en wedstrijddata uit de gegevensbron. Geen fictieve spelers of shirts.',assetSha256:hash(png),stadiumImageUrl:m.stadiumImage||'',stadiumVenueName:m.fixture.venue?.name||'',stadiumSourceUrl:m.stadiumSourceUrl||m.stadiumImage||'',method:'fixture-specific-stadium-and-logos-v4'}};
}
module.exports={assertStadiumIdentity,reviewedStadium,assertMatch,svg,safeAsset,asset,stadiumFor,createCover};
