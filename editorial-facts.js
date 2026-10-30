(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DeskFacts=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
 const blocks=d=>[d?.headline,d?.standfirst,...(Array.isArray(d?.body)?d.body:[])].filter(Boolean);
 const text=d=>blocks(d).join(' ');
 const scores=value=>[...String(value||'').matchAll(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})\b/g)].map(m=>Number(m[1])+'-'+Number(m[2]));
 const needsMatch=d=>scores(text(d)).length>0||/\b(?:verslaat|versloeg|gelijkspel|puntendeling|eindstand|ruststand)\b/i.test(text(d))||(/\b(?:wint|won|overwinning)\b/i.test(text(d))&&/\b(?:wedstrijd|duel|speelronde|slotfase|eredivisie|competitie)\b/i.test(text(d)));
 const validDate=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;};
 function evidenceIssues(draft,facts=[],match=null){
  const article=text(draft),evidence=facts.filter(x=>typeof x==='string').join(' '),issues=[];
  const anchored=match&&String(match.homeTeam||'').trim()&&String(match.awayTeam||'').trim()&&Number.isInteger(match.homeScore)&&Number.isInteger(match.awayScore);
  const anchor=anchored?`${match.homeTeam} ${match.awayTeam} ${match.homeScore}-${match.awayScore} ${match.playedAt||''}`:'';
  const supported=evidence+' '+anchor;
  const numbers=value=>(String(value).match(/\d+(?:[.,]\d+)?/g)||[]).map(x=>x.replace(',','.'));
  const allowedNumbers=new Set(numbers(supported));
  const unknownNumbers=[...new Set(numbers(article))].filter(x=>!allowedNumbers.has(x));
  if(unknownNumbers.length)issues.push('Cijfers ontbreken in de gecontroleerde feiten: '+unknownNumbers.join(', ')+'.');
  const allowedScores=new Set(scores(supported));
  const unknownScores=[...new Set(scores(article))].filter(x=>!allowedScores.has(x));
  if(unknownScores.length)issues.push('Uitslag of tussenstand wijkt af van de gecontroleerde feiten: '+unknownScores.join(', ')+'. Controleer ook de volgorde thuis-uit.');
  const names=blocks(draft).flatMap(block=>[...String(block).matchAll(/\b(?:[A-ZÀ-Ý][A-Za-zÀ-ÿ'’\-]+|FC|SC|AZ|PSV)(?:\s+(?:van|de|der|den|ten|ter))?\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ'’\-]+\b/g)].map(m=>m[0]));
  const known=normalize(supported);
  const sentenceStarters=new Set(['Voor','Volgens','Ook','Tegen','Na','Bij','Zonder','Sinds','Tijdens']);
  const missingNames=[...new Set(names)].filter(name=>!sentenceStarters.has(name.split(' ')[0])&&!known.includes(normalize(name)));
  if(missingNames.length)issues.push('Controleer namen die niet in de aangeleverde feiten staan: '+missingNames.join(', ')+'.');
  const quotations=[...article.matchAll(/[“"]([^”"\n]{10,})[”"]/g)].map(m=>m[1]);
  if(quotations.some(q=>!normalize(evidence).includes(normalize(q))))issues.push('Citaat ontbreekt letterlijk in de gecontroleerde feiten. Controleer de uitspraak en de spreker.');
  if(needsMatch(draft)){
   const narrative=[
    [/\b(?:voor rust|na rust|eerste helft|tweede helft|ruststand|voor de pauze|na de pauze|na de onderbreking)\b/i,'verloop per helft en ruststand'],
    [/\b(?:achterstand|terugknok|teruggevochten|omgebogen|comeback)\w*/i,'achterstand of comeback'],
    [/\b(?:domineer|dominantie|overwicht|domina(?:nt|nter))\w*/i,'overwicht of dominantie']
   ];
   for(const [pattern,label] of narrative)if(pattern.test(article)&&!pattern.test(evidence))issues.push('Niet aangeleverd wedstrijdverloop: '+label+'. Voeg controleerbare feiten toe of verwijder deze passage.');
  }
  if(anchored){
   const factScores=new Set(scores(evidence));
   const finalScore=match.homeScore+'-'+match.awayScore;
   if(!factScores.has(finalScore))issues.push('De vastgelegde eindstand thuis-uit staat niet in de gecontroleerde feiten. Leg de bronuitslag expliciet vast.');
   const evidenceText=normalize(evidence);
   for(const team of [match.homeTeam,match.awayTeam]){
    const alias=normalize(team).replace(/^(?:fc|sc|afc)\s+/,'');
    if(!(' '+evidenceText+' ').includes(' '+alias+' '))issues.push('Vastgelegde ploeg ontbreekt in de gecontroleerde feiten: '+team+'.');
   }
   const dates=[...evidence.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map(m=>m[0]);
   if(dates.length&&!dates.includes(match.playedAt))issues.push('De vastgelegde wedstrijddatum wijkt af van de datum in de gecontroleerde feiten.');
   const final=match.homeScore+'-'+match.awayScore;
   const explicitFinal=[...article.matchAll(/\b(?:eindstand|eindscore)\s*(?:was|is|van|:)??\s*(\d{1,2})\s*[-–:]\s*(\d{1,2})\b/gi)].map(m=>Number(m[1])+'-'+Number(m[2]));
   if(explicitFinal.some(x=>x!==final))issues.push('De genoemde eindstand komt niet overeen met de vastgelegde eindstand thuis-uit ('+final+').');
   const head=normalize(draft.headline),alias=value=>normalize(value).replace(/^(?:fc|sc|afc)\s+/,'');
   const win=/\b(?:wint|won|verslaat|versloeg|boekt een zege|boekt zege|pakt de winst)\b/;
   const draw=/\b(?:speelt gelijk|speelde gelijk|gelijkspel|puntendeling)\b/;
   const home=alias(match.homeTeam),away=alias(match.awayTeam);
   if(match.homeScore===match.awayScore&&win.test(head))issues.push('De kop noemt een overwinning terwijl de gecontroleerde eindstand een gelijkspel is.');
   if(match.homeScore!==match.awayScore&&draw.test(head)&&!/^na (?:het |een )?gelijkspel\b/.test(head))issues.push('De kop noemt een gelijkspel terwijl de gecontroleerde eindstand een winnaar heeft.');
   const loser=match.homeScore<match.awayScore?home:match.homeScore>match.awayScore?away:'';
   if(loser){const escaped=loser.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');if(new RegExp('\\b'+escaped+'\\s+(?:wint|won|verslaat|versloeg|boekt (?:een )?zege|pakt de winst)\\b').test(head))issues.push('De kop wijst de verliezende ploeg aan als winnaar. Controleer de teams en thuis-uit-volgorde.');}
   if(validDate(match.playedAt)){
    const day=new Date(match.playedAt+'T12:00:00Z').getUTCDay(),days=['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
    const intro=normalize((draft.headline||'')+' '+(draft.standfirst||''));
    if(days.some((name,i)=>i!==day&&new RegExp('\\b'+name+'\\b').test(intro)))issues.push('De weekdag in kop of intro past niet bij de vastgelegde wedstrijddatum.');
   }
  }
  return [...new Set(issues)];
 }
 function audit(payload){
  const draft=payload.draft||{},match=payload.match||null,issues=evidenceIssues(draft,payload.verifiedFacts||[],match);
  if(needsMatch(draft)||match){
   if(!match||!String(match.homeTeam||'').trim()||!String(match.awayTeam||'').trim()||normalize(match.homeTeam)===normalize(match.awayTeam)||![match.homeScore,match.awayScore].every(x=>Number.isInteger(x)&&x>=0&&x<=99)||!validDate(match.playedAt))
    issues.push('Wedstrijdverslag: leg thuisploeg, uitploeg, eindstand thuis-uit en wedstrijddatum vast.');
   for(const [key,label] of [['resultVerified','eindstand en thuis-uit'],['namesVerified','namen en clubs'],['dateVerified','datum en weekdag'],['timelineVerified','wedstrijdverloop en doelpuntenmakers']])if(payload.factChecks?.[key]!==true)issues.push('Feitencontrole ontbreekt: '+label+'.');
  }
  return [...new Set(issues)];
 }
 return {audit,evidenceIssues,needsMatch};
});

