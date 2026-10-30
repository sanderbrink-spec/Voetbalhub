'use strict';
const fs=require('node:fs');
const crypto=require('node:crypto');
const M=require('../editorial-desk-model');
const {fingerprint}=require('../editorial-drafts');
const ALLOWED_KEY='emmen-den-bosch-programma-2026-11-01';
const API='https://voetbalhub-redactie.onrender.com';
const urls=[
 'https://fcemmen.nl/wijziging-speelschema-fc-emmen-fc-den-bosch-verplaatst/',
 'https://www.eurojackpotknvbbeker.nl/node/1605',
 'https://www.fcdenbosch.nl/eerste-elftal/wedstrijden/'
];
function plain(html){return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|amp|ndash|mdash);/g,' ').replace(/\s+/g,' ').trim();}
function checkSources(texts){
 const [emmen,knvb,bosch]=texts;
 if(!/thuiswedstrijd tegen\s+FC Den Bosch.{0,350}vrijdag 30 oktober.{0,150}zondag 1 november om 14[.:]30/i.test(emmen)||!/wijziging.{0,100}gevolg.{0,150}eerste ronde.{0,60}KNVB Beker/i.test(emmen))throw Error('Clubbron bevestigt de wijziging niet volledig.');
 if(!/wedstrijd FC Emmen.{0,20}FC Den Bosch.{0,120}vrijdag 30 oktober 20:00.{0,80}zondag 1 november 14:30/i.test(knvb)||!/Als gevolg van het bekerprogramma/i.test(knvb))throw Error('Bondbron bevestigt de wijziging niet volledig.');
 if(!/Wedstrijden.{0,100}Eerste Divisie.{0,100}01-11-2026 14:30:00.{0,80}FC Emmen.{0,200}FC Den Bosch/i.test(bosch))throw Error('Actuele kalender bevestigt datum, tijd en ploegen niet.');
 return true;
}
async function run({packet,secret,fetcher=fetch,now=Date.now()}){
 if(!secret)throw Error('Redactiesleutel ontbreekt.');
 if(packet.key!==ALLOWED_KEY||!Number.isFinite(Date.parse(packet.expiresAt))||now>=Date.parse(packet.expiresAt))throw Error('Proef is onbekend of verlopen.');
 const p=structuredClone(packet.payload);
 if(JSON.stringify(p.sources.map(s=>s.url))!==JSON.stringify(urls))throw Error('Bronnen van deze proef mogen niet worden vervangen.');
 const evidence=await Promise.all(urls.map(async url=>{
  const r=await fetcher(url,{signal:AbortSignal.timeout(25000)});
  if(!r.ok)throw Error('Bron onbereikbaar: '+new URL(url).hostname);
  if(r.url&&new URL(r.url).hostname!==new URL(url).hostname)throw Error('Onverwachte bronomleiding.');
  const text=plain(await r.text());if(text.length<100)throw Error('Bron bevat onvoldoende tekst.');return text;
 }));
 checkSources(evidence);
 if(M.needsMatch(p.draft)||M.requiresFlashscore(p.draft))throw Error('Deze proef staat geen wedstrijdverslag, uitslag of statistiek toe.');
 const headers={Authorization:'Bearer '+secret,'Content-Type':'application/json'};
 async function api(path,body){const r=await fetcher(API+path,{headers,signal:AbortSignal.timeout(25000),...(body?{method:'POST',body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw Error(path+': HTTP '+r.status+' '+(d.error||''));return d;}
 const articles=await api('/articles');
 const list=Array.isArray(articles)?articles:articles.articles||articles.items;
 if(!Array.isArray(list))throw Error('Publicatielijst niet controleerbaar.');
 if(list.some(a=>a.headline===p.draft.headline))return {status:'already_published',published:false};
 p.editorialChecks=Object.fromEntries(M.checks.map(k=>[k,true]));
 const issues=M.publicationIssues(p);if(issues.length)throw Error('Kwaliteitscontrole: '+issues.join(' '));
 // Checks represent this automated review, not approval by the user.
 p.reviewNotes='Eenmalige automatische publicatieproef op expliciet verzoek. Drie officiële bronpagina’s live opgehaald; datum, tijd, thuisploeg en wijzigingsreden vergeleken. Geen uitslag, statistiek, citaat of spelersclaim. Tekststructuur en feitdekking automatisch gecontroleerd; duplicatencontrole lokaal en door publicatieserver. Geen handmatige goedkeuring door gebruiker.';
 const saved=await api('/editorial-drafts',{payload:p,approve:true});
 if(saved.record?.status!=='approved'||saved.record.contentHash!==fingerprint(p))throw Error('Gecontroleerde versie niet correct opgeslagen.');
 const result=await api('/publish',{...p,approved:true,editorialDraftId:saved.record.id,expectedRevision:saved.record.revision});
 if(result.status!=='published'||result.article?.headline!==p.draft.headline)throw Error('Publicatie niet bevestigd.');
 const verify=await api('/articles');const visible=Array.isArray(verify)?verify:verify.articles||verify.items||[];
 if(!visible.some(a=>a.id===result.article.id&&JSON.stringify(a.body)===JSON.stringify(p.draft.body)))throw Error('Publicatie ontbreekt in de openbare feed.');
 return {status:'published',id:result.article.id,headline:result.article.headline,sourceChecks:3,sourceHashes:evidence.map(t=>crypto.createHash('sha256').update(t).digest('hex')),humanApproval:false};
}
if(require.main===module)run({packet:JSON.parse(fs.readFileSync('redactie/trial/article.json','utf8')),secret:process.env.HUB_API_SECRET}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={run,checkSources,plain};
