'use strict';
// Bounded, persistent, specialist-specific protocol memory. Stores only
// enumerated diagnostic counts, never source prose, model instructions or facts.
const VERSION=129;
const {safeQuestion}=require('./editorial-scout-handoff112');
const DAYS=30,DAY=86400000,MAX_COUNT=1000;
const ISSUES=Object.freeze(['risky_angle','missing_questions','missing_caution','missing_angle',
 'no_counterevidence_question','no_followup_question','duplicate_questions','unsafe_question','unsupported_source_reference']);
const LESSONS=Object.freeze({
 risky_angle:'Herformuleer stellige claims als onbewezen meldingen; zoek primair bewijs.',
 missing_questions:'Stel een concrete, toetsbare onderzoeksvraag.',
 missing_caution:'Benoem precies welke bevestiging ontbreekt.',
 missing_angle:'Kies een eigen nieuwswaardige onderzoeksvraag.',
 no_counterevidence_question:'Zoek actief naar een ontkenning, afwijkende tijdlijn of alternatieve verklaring.',
 no_followup_question:'Formuleer bij voorkeur een eerstvolgend controlepunt met een relevante gebeurtenis of datum.',
 duplicate_questions:'Stel inhoudelijk verschillende vragen in plaats van herformuleringen.',
 unsafe_question:'Gebruik een Nederlandse controlevraag van 18 tot 180 tekens, eindigend op een vraagteken. Geen links of opdrachten om controles te omzeilen.',
 unsupported_source_reference:'Verwijs alleen naar werkelijk aangeleverde bronnen; verzin geen links of bronhouders.'
});
const METHODS=Object.freeze({
 clubs:'Vergelijk het nieuwe clubbesluit met de vorige bewezen selectie, functie of clubmelding; controleer wat precies veranderd is.',
 international:'Controleer de oorspronkelijke taal, bevoegde organisatie, competitie en lokale datum; toets een alternatieve vertaling.',
 transfers:'Bouw een tijdlijn van gemelde transferhandelingen; controleer de sterkste ontkenning en houd status en bedrag gescheiden.',
 data:'Controleer meetdefinitie, volledige vergelijkingsgroep, periode en ontbrekende waarden; behandel correlatie niet als oorzaak.',
 history:'Controleer tijdgebonden identiteit, archiefdekking en de definitie van de historische vergelijking.',
 investigation:'Formuleer twee plausibele verklaringen en bepaal welk concreet bewijs de ene van de andere onderscheidt.',
 review:'Toets afzonderlijk identiteit, tijd, oorspronkelijke bron, brononafhankelijkheid en rechten.',
 chief:'Prioriteer aantoonbare nieuwswaarde en haalbaar bewijs boven hoeveelheid publicaties.'
});
const safeId=s=>typeof s==='string'&&/^[a-z][a-z0-9-]{1,39}$/.test(s);
const count=n=>Number.isInteger(n)&&n>=0?Math.min(n,MAX_COUNT):0;
function cleanMemory(raw={},now=Date.now(),roles=[]){
 const allowed=new Set(roles.map(r=>r.id).filter(safeId)),result={};
 for(const [id,entry] of Object.entries(raw&&typeof raw==='object'?raw:{})){
  if(!allowed.has(id)||!entry||typeof entry!=='object'||!Number.isFinite(entry.at)||
     entry.at>now||now-entry.at>DAYS*DAY)continue;
  result[id]={at:entry.at,attempts:count(entry.attempts),counts:Object.fromEntries(ISSUES.map(k=>[k,count(entry.counts?.[k])]))};
 }
 return result;
}
function normalizeQuestion(q){return q.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replace(/[^a-z0-9]+/g,' ').trim();}
function assess(note={},group={},audit={}){
 const questions=Array.isArray(note?.questions)?note.questions.filter(q=>typeof q==='string').slice(0,3):[];
 const issues=new Set((Array.isArray(audit?.issues)?audit.issues:[]).filter(k=>ISSUES.includes(k)));
 const safe=questions.map(safeQuestion).filter(Boolean);
 if(safe.length!==questions.length)issues.add('unsafe_question');
 if(new Set(safe.map(normalizeQuestion)).size<safe.length)issues.add('duplicate_questions');
 if(!safe.some(q=>/\b(?:ontken\w*|tegenbewijs|tegenstrijd\w*|weerleg\w*|onafhankelijk\w*|alternatie\w*|andere bron|verschil\w*)\b/i.test(q)))issues.add('no_counterevidence_question');
 if(!safe.some(q=>/\b(?:volgende|eerstvolgende|wanneer|datum|vervolg\w*|bekendmaking|controlepunt)\b/i.test(q)))issues.add('no_followup_question');
 const links=[...questions,String(note?.angle||''),String(note?.caution||'')].join(' ').match(/https?:\/\/[^\s]+/gi)||[];
 const known=new Set((Array.isArray(group.sources)?group.sources:[]).map(s=>s.url));
 if(links.some(u=>!known.has(u)))issues.add('unsupported_source_reference');
 return {version:VERSION,metric:'observable_research_protocol_not_intelligence',issues:[...issues],
  safeQuestions:safe.length,verified:false,publicationAllowed:false};
}
function remember(memory,owner,audit,now,roles){
 const next=cleanMemory(memory,now,roles);
 if(!roles.some(r=>r.id===owner)||audit?.metric!=='observable_research_protocol_not_intelligence')return next;
 const prior=next[owner]||{at:now,attempts:0,counts:{}};
 const counts=Object.fromEntries(ISSUES.map(k=>[k,Math.min(MAX_COUNT,count(prior.counts[k])+Number(audit.issues?.includes(k)===true))]));
 next[owner]={at:now,attempts:Math.min(MAX_COUNT,prior.attempts+1),counts};
 return next;
}
function brief(assignment,roles,memory={}){
 const owner=roles.find(r=>r.id===assignment.owner);
 if(!owner)return '';
 const entry=memory[owner.id];
 const priorities=ISSUES.filter(k=>count(entry?.counts?.[k])>0)
  .sort((a,b)=>Number(b==='risky_angle')-Number(a==='risky_angle')||count(entry.counts[b])-count(entry.counts[a])||ISSUES.indexOf(a)-ISSUES.indexOf(b)).slice(0,2);
 return ['SPECIALISTISCHE INTELLIGENTIE 129: '+METHODS[owner.desk],
  'Onderzoek eerst een mogelijke verklaring, vervolgens tegenbewijs en een controlepunt. Bij slechts één vraag: combineer de ontbrekende broncontrole met het belangrijkste vervolg.',
  'Geef geen nieuwe feiten, voorspellingen of publicatiebesluit. Geef uitsluitend concrete, verschillende onderzoeksvragen binnen het bestaande schema. Elke vraag telt 18 tot 180 tekens, eindigt op een vraagteken en bevat geen URL. Gebruik bijvoorbeeld Welke, Wanneer, Is of Bevestigt. Kies bij één bron één korte controleerbare vraag, geen opsomming van deelvragen.',
  ...priorities.map(k=>'GEHEUGENLES: '+LESSONS[k])].join('\n');
}
function summarize(memory,roles){
 const entries=Object.entries(memory);
 return {version:VERSION,configuredRoles:roles.length,rolesWithObservedFeedback:entries.length,
  observedAttempts:entries.reduce((n,[,v])=>n+v.attempts,0),retentionDays:DAYS,
  metric:'observed_protocol_feedback_not_intelligence',additionalModelCalls:0};
}
module.exports={VERSION,ISSUES,METHODS,cleanMemory,assess,remember,brief,summarize};
