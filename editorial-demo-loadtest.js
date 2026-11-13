'use strict';
// Synthetic editorial load test. NEVER merge these into the production /articles
// endpoint or count them as verified publications.
const CLUBS=['FC Groningen','Ajax','Feyenoord','PSV','AZ','FC Twente','FC Utrecht','NEC','Sparta Rotterdam','sc Heerenveen','Go Ahead Eagles','PEC Zwolle','NAC Breda','Willem II','Fortuna Sittard','Heracles Almelo','FC Volendam','Excelsior'];
const KINDS=[
 ['wedstrijdanalyse','Zo kan de ploeg het middenveld controleren','Een voorbeeldanalyse van druk zetten en passing onder weerstand.'],
 ['voorbeschouwing','De belangrijkste vragen voorafgaand aan een duel','Een fictief voorbeeld van de keuzes bij de opstelling.'],
 ['tactiek','Drie tactische opties voor de trainer','Een voorbeeld van de afweging tussen balbezit en omschakeling.'],
 ['selectie','Wat een brede selectie kan betekenen','Een fictieve redactionele oefening met roulatie en belastbaarheid.'],
 ['supporters','Hoe een wedstrijddag eruit kan zien','Een fictieve sfeerbeschrijving zonder echte bezoekersaantallen.'],
 ['training','De rol van spelhervattingen in de voorbereiding','Een algemene analyse, zonder claims over bestaande trainingssessies.']
];
function records(){
 return Array.from({length:36},(_,i)=>{
  const club=CLUBS[i%CLUBS.length], [kind,title,intro]=KINDS[Math.floor(i/CLUBS.length)%KINDS.length===0?i%KINDS.length:(i+Math.floor(i/CLUBS.length))%KINDS.length];
  return {id:'demo-20261113-'+String(i+1).padStart(2,'0'),status:'demo',
   isSynthetic:true,sourceProvider:'SYNTHETIC_TEST_ONLY',club,category:'DEMO · '+kind,
   headline:'[DEMO] '+club+': '+title,
   standfirst:'FICTIEF TESTARTIKEL. '+intro+' Geen bewering over een actuele wedstrijd of gebeurtenis.',
   body:[
    'Dit is een volledig fictieve oefentekst om de Veldio-weergave en de redactionele infrastructuur te testen. Er worden geen actuele uitslagen, citaten, blessures of transferberichten beweerd.',
    'In dit denkbeeldige scenario onderzoekt de redactie hoe een elftal de ruimte tussen verdediging en middenveld kan beperken. Spelers kunnen bijvoorbeeld korter bij elkaar aansluiten, terwijl de backs op het juiste moment ondersteuning bieden.',
    'Een tweede aandachtspunt is het tempo na balverlies. In een oefenanalyse kan de ploeg kiezen tussen direct druk zetten of het herstellen van de veldbezetting. Het effect hangt af van de tegenstander en is hier niet op een echte wedstrijd gebaseerd.',
    'Deze demonstratie is uitsluitend bedoeld voor een technische test van de artikelkaart, typografie, uitklapweergave, navigatie en laadprestaties. Het bericht is geen sportnieuws en mag niet in de openbare Veldio-nieuwsfeed worden opgenomen.'
   ],createdAt:'2026-11-13T10:45:00Z',imageRights:'not_needed'};
 });
}
function html(){
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const cards=records().map(a=>'<article><small>'+esc(a.category)+' · '+esc(a.club)+'</small><h2>'+esc(a.headline)+'</h2><p class="intro">'+esc(a.standfirst)+'</p><details><summary>Lees het volledige testartikel</summary>'+a.body.map(p=>'<p>'+esc(p)+'</p>').join('')+'</details></article>').join('');
 return '<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Veldio · DEMO-redactietest</title><style>:root{color-scheme:dark}body{margin:0;background:#050b07;color:#f1f8f3;font:16px/1.55 system-ui,Arial}main{max-width:900px;margin:auto;padding:18px}h1{font-size:27px}.warning{border:2px solid #b8fa42;padding:13px;background:#15230f;font-weight:800}article{background:#101b13;border:1px solid #315539;border-radius:14px;padding:18px;margin:15px 0}small{color:#b7ff54}h2{font-size:20px}summary{cursor:pointer;color:#b7ff54}p{margin:12px 0}.intro{font-weight:600}</style><main><h1>Veldio · 36 testartikelen</h1><p class="warning">DEMO · ALLE ARTIKELEN ZIJN FICTIEF. GEEN ACTUEEL NIEUWS OF ECHTE SPORTSMONKS-DATA.</p><p>Dit is een afzonderlijke, openbare weergavetest. De artikelen komen niet in de echte nieuwsfeed en tellen niet mee als publicaties.</p>'+cards+'</main></html>';
}
module.exports={records,html};
