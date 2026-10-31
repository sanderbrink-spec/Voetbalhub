'use strict';
const fs=require('node:fs');
const {draftIssues,host}=require('../editorial-desk-model');
const {evidenceIssues}=require('../editorial-facts');
function identity(payload){
 const m=payload.match;
 if(m)return JSON.stringify([m.playedAt,m.homeTeam.toLowerCase().trim(),m.awayTeam.toLowerCase().trim()]);
 return JSON.stringify((payload.sources||[]).map(s=>s.url.split('#')[0]).sort());
}
async function importPackets({packets,apiUrl,secret,fetcher=fetch}){
 if(!secret)throw Error('HUB_API_SECRET ontbreekt.');
 if(!/^https:\/\//.test(apiUrl))throw Error('Een HTTPS-redactieadres is vereist.');
 const headers={Authorization:'Bearer '+secret,'Content-Type':'application/json'};
 const read=await fetcher(apiUrl+'/editorial-drafts',{headers,signal:AbortSignal.timeout(30000)});
 if(!read.ok)throw Error('Eigen concepten ophalen mislukt: HTTP '+read.status);
 const existing=await read.json();if(!Array.isArray(existing.items))throw Error('Ongeldige conceptenlijst.');
 const known=new Set(existing.items.map(r=>identity(r.payload)));
 const result={saved:0,skipped:0,records:[]};
 for(const packet of packets.slice(0,5)){
  const p=packet.payload||{},sources=p.sources||[];
  const issues=[...draftIssues(p.draft||{}),...evidenceIssues(p.draft||{},p.verifiedFacts||[],p.match)];
  if(sources.length<2||sources.some(s=>!host(s.url))||new Set(sources.map(s=>host(s.url))).size<2)issues.push('Twee geldige bronwebsites zijn vereist.');
  if(issues.length)throw Error('Concept '+packet.key+' niet geschikt voor de leeslijst: '+issues.join(' '));
  const key=identity(p);if(known.has(key)){result.skipped++;continue;}
  // This route only stores a private draft; no approval or publication is performed.
  const response=await fetcher(apiUrl+'/editorial-drafts',{method:'POST',headers,signal:AbortSignal.timeout(30000),body:JSON.stringify({payload:{...p,editorialChecks:{},factChecks:{}},approve:false})});
  const data=await response.json();
  if(!response.ok||!data.record?.id||data.record.status!=='draft'||data.published!==false)throw Error('Privé opslaan mislukt voor '+packet.key+' (HTTP '+response.status+').');
  known.add(key);result.saved++;result.records.push({key:packet.key,id:data.record.id,headline:p.draft.headline});
 }
 return result;
}
if(require.main===module){
 const packets=JSON.parse(fs.readFileSync('redactie/curated/articles.json','utf8'));
 importPackets({packets,apiUrl:(process.env.VELDIO_API_URL||'https://voetbalhub-redactie.onrender.com').replace(/\/$/,''),secret:process.env.HUB_API_SECRET||''})
 .then(result=>{console.log(JSON.stringify(result));if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## Eigen artikelen\\n${result.saved} nieuwe volledige concepten privé opgeslagen; ${result.skipped} bestaande overgeslagen. Geen publicatie.\\n`);})
 .catch(error=>{console.error(error.message);process.exitCode=1;});
}
module.exports={importPackets,identity};
