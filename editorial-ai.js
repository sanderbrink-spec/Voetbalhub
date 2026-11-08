'use strict';
const { draftIssues, paragraphs, compactStructure, standardStructure } = require('./editorial-desk-model');
const { headlineContradictions } = require('./editorial-quality');
// Task-specific free-tier GPT-OSS policy. Source extraction stays fast;
// writing gets deeper reasoning and the independent review gets high effort.
const editorialModelTasks=Object.freeze({
 extraction:{effort:'low',budget:2400},
 writing:{effort:'medium',budget:3600},
 revision:{effort:'high',budget:4200},
 review:{effort:'high',budget:4200}
});
function groqEditorialOptions(model,task,{automaticPublication=false}={}){
 const spec=editorialModelTasks[task];
 if(!spec)throw new RangeError('Onbekende redactietaak: '+task);
 const oss=/^openai\/gpt-oss-(?:20b|120b)$/.test(String(model));
 return {
  response_format:{type:'json_object'},
  max_completion_tokens:task==='writing'&&!automaticPublication?2000:spec.budget,
  ...(oss?{reasoning_effort:spec.effort,include_reasoning:false}:{})
 };
}
// Facts remain verbatim and source-verified. This is a deterministic assignment
// of fact IDs, not another generative model or a second source of claims.
function editorialAssignment(facts,{compact=false}={}){
 if(!Array.isArray(facts)||!facts.length)return {leadFactIds:[],bodySections:[]};
 // Only suppress facts with identical meaningful tokens and numbers. This
 // catches reworded duplicates while retaining differing dates, roles or claims.
 const seen=new Set(),records=[];
 const filler=new Set(['heeft','hebben','wordt','worden','werden','waren','deze','dezelfde','voor','door','naar','zoals','daarna','hierbij','volgens','samen','waarbij']);
 const fingerprint=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLocaleLowerCase('nl').replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/)
  .filter(w=>w&&(w.length>=4||/^\d+$/.test(w))&&!filler.has(w))
  .sort().join('|');
 for(let i=0;i<facts.length;i++){
  const value=String(facts[i]||'').replace(/\s+/g,' ').trim();
  if(!value)continue;
  const key=fingerprint(value);
  if(seen.has(key))continue;
  seen.add(key);
  const label=/\b(?:technisch directeur|algemeen directeur|bestuurder|toelicht|verklaar|zegt|aldus|vertelt|benadrukt|enthousiast|motiver|opties bekeken)\b/i.test(value)?'Officiële toelichting'
   :/\b(?:loopbaan|ervaring|eerder|carrière|bondscoach|gestopt|in 20\d\d|tijdens 20\d\d|Indonesi[eë])\b/i.test(value)?'Bevestigde achtergrond'
   :/\b(?:assistent(?:-trainer|-bondscoach)?|keeperstrainer|staf|interim|tijdelijk de leiding|terug(?:keer|keren|gekeerd))\b/i.test(value)?'Concrete personele wijzigingen'
   :/\b(?:contract|verbintenis|ingaande|vanaf maandag|vanaf dinsdag|tot de zomer|looptijd)\b/i.test(value)?'Ingangsdatum en voorwaarden'
   :/\b(?:aanstell|benoem|hoofdtrainer|nieuwe trainer|nieuwe coach|bevestig|besluit)\b/i.test(value)?'Kernbesluit'
   :'Overige gecontroleerde informatie';
  records.push({id:'F'+(i+1),label});
 }
 if(!records.length)return {leadFactIds:[],bodySections:[]};
 const lead=records.find(r=>r.label==='Kernbesluit')||records.find(r=>r.label==='Ingangsdatum en voorwaarden')||records[0];
 const remaining=records.filter(r=>r.id!==lead.id),angles=[];
 for(const label of ['Concrete personele wijzigingen','Bevestigde achtergrond','Officiële toelichting','Ingangsdatum en voorwaarden','Overige gecontroleerde informatie','Kernbesluit']){
  const selected=remaining.filter(f=>f.label===label);
  if(selected.length)angles.push({angle:label,factIds:selected.map(f=>f.id)});
 }
 const max=compact?2:5;
 // Combine only surplus sections, never silently discard evidence.
 while(angles.length>max){
  const last=angles.pop();
  angles[angles.length-1].factIds.push(...last.factIds);
 }
 // The full format needs three different factual body paragraphs. Split a
 // multi-fact section rather than inventing topics or repeating one fact.
 while(!compact&&angles.length<3){
  const target=angles.find(a=>a.factIds.length>1);
  if(!target)break;
  const id=target.factIds.pop();
  angles.splice(angles.indexOf(target)+1,0,{angle:target.angle+' (ander controleerbaar detail)',factIds:[id]});
 }
 return {leadFactIds:[lead.id],bodySections:angles};
}
// A publisher identity comes from a trusted official HTTPS host, not AI prose.
function officialPublisherName(url){
 const names={
  'peczwolle.nl':'PEC Zwolle','ajax.nl':'Ajax','psv.nl':'PSV','feyenoord.com':'Feyenoord',
  'fctwente.nl':'FC Twente','az.nl':'AZ','fcgroningen.nl':'FC Groningen',
  'fortunasittard.nl':'Fortuna Sittard','willem-ii.nl':'Willem II',
  'fcemmen.nl':'FC Emmen','fcdenbosch.nl':'FC Den Bosch',
  'knvb.nl':'KNVB','eurojackpotknvbbeker.nl':'KNVB Beker','eredivisie.nl':'Eredivisie',
  'inter.it':'Inter','clubbrugge.be':'Club Brugge','liverpoolfc.com':'Liverpool',
  'fcm.dk':'FC Midtjylland','keukenkampioendivisie.nl':'Keuken Kampioen Divisie'
 };
 try{
  const value=new URL(url);
  if(value.protocol!=='https:'||value.username||value.password)return null;
  return names[value.hostname.toLowerCase().replace(/^www\./,'')]||null;
 }catch{return null;}
}
// Attribute both the decision and its contextual claims. This is an
// additional preflight rejection, never a substitute for independent review.
function editorialAttributionIssues(draft,{primaryAuthority=null,sourceUrls=[],facts=[]}={}){
 if(!['club_decision','association_decision'].includes(primaryAuthority)||sourceUrls.length!==1)return [];
 const publisher=officialPublisherName(sourceUrls[0]);
 if(!publisher||!draft||!Array.isArray(draft.body))return [];
 const lowered=x=>String(x||'').toLocaleLowerCase('nl');
 const name=lowered(publisher);
 const signals=['volgens','aldus','meldt','bevestigt','schrijft','laat weten','maakt bekend','bekendgemaakt','bekendmaking'];
 const isNamedAttribution=x=>lowered(x).split(/[.!?](?:\s+|$)/).some(sentence=>
  sentence.includes(name)&&(signals.some(signal=>sentence.includes(signal))||(sentence.includes('legt ')&&sentence.includes(' uit'))||(sentence.includes('licht ')&&sentence.includes(' toe'))));
 const paragraphs=draft.body.filter(x=>typeof x==='string');
 const lead=String(draft.standfirst||'');
 const result=[];
 if(![lead,...paragraphs].some(isNamedAttribution))
  result.push('Noem '+publisher+' in de intro of tekst expliciet als de organisatie die de officiële mededeling meldt of bevestigt.');
 if(facts.length>=4&&paragraphs.length>=3){
  const bodyAttribution=paragraphs.some(p=>isNamedAttribution(p)||['de club meldt','de club bevestigt','de club schrijft','volgens de club','in de bekendmaking','in haar bekendmaking','de bond meldt'].some(signal=>lowered(p).includes(signal)));
  if(!bodyAttribution)
   result.push('Wijs in een inhoudelijke alinea de staf-, loopbaan- of contractdetails duidelijk toe aan de officiële clubbekendmaking.');
 }
 return result;
}
// A year is not a competition season, and a named job title must appear
// literally in the independently verified evidence.
function unverifiedTimelineAndRoles(draft,facts=[]){
 if(!draft||!Array.isArray(draft.body))return [];
 const text=[draft.headline,draft.standfirst,...draft.body].filter(v=>typeof v==='string').join(' ').toLocaleLowerCase('nl');
 const evidence=facts.filter(v=>typeof v==='string').join(' ').toLocaleLowerCase('nl');
 const issues=[];
 for(const m of text.matchAll(/\b20\d{2}\s*\/\s*20\d{2}\b/g)){
  if(!evidence.includes(m[0]))issues.push('Niet-geverifieerde seizoenscombinatie '+m[0]+': losse jaartallen bewijzen geen seizoen.');
 }
 for(const role of ['clubdirecteur','algemeen directeur','sportdirecteur','sportief directeur','technisch directeur']){
  if(text.includes(role)&&!evidence.includes(role))issues.push('Functietitel '+role+' ontbreekt in verifiedFacts; verwijder of corrigeer op basis van de bron.');
 }
 return [...new Set(issues)];
}
// Factual announcement articles must not manufacture extra paragraphs from
// the same facts. Each certified coaching appointment gets three themes.
function officialCoachStructureIssues(draft,{topic='',primaryAuthority=null,facts=[]}={}){
 const coach=primaryAuthority==='club_decision'&&String(topic).toLocaleLowerCase('nl').includes('hoofdtrainer')&&facts.length>=4;
 if(!coach)return [];
 return Array.isArray(draft?.body)&&draft.body.length===3?[]:
  ['Officiële trainersbenoeming: schrijf precies drie inhoudelijk verschillende alinea’s: stafwijziging, geverifieerde loopbaan, toegeschreven toelichting. Geen extra contractherhaling of speculatieve vooruitblik.'];
}
// Obvious claims of consequences/preference require evidence, not a plausible
// deduction from a contract term or an official's praise.
function unsupportedInterpretationIssues(draft,facts=[]){
 if(!draft||!Array.isArray(draft.body))return [];
 const content=[draft.headline,draft.standfirst,...draft.body].join(' ').toLocaleLowerCase('nl');
 const evidence=facts.filter(x=>typeof x==='string').join(' ').toLocaleLowerCase('nl');
 const risks=[
  ['langetermijnvisie','visie'],['lange-termijnvisie','visie'],['visie op de lange termijn','visie'],
  ['garandeert stabiliteit','stabiliteit'],['waarborgt stabiliteit','stabiliteit'],
  ['biedt de club stabiliteit','stabiliteit'],['geeft de club stabiliteit','stabiliteit'],
  ['meest aantrekkelijke','meest aantrekkelijke'],['zijn profiel verrijkt','profiel verrijkt']
 ];
 return risks.filter(([claim,required])=>content.includes(claim)&&!evidence.includes(required))
  .map(([claim])=>'Onbewezen interpretatie: '+claim+'. Verwijder dit gevolg of deze persoonlijke voorkeur; een contract of clubquote bewijst het niet.');
}
class DraftError extends Error {
  constructor(status, message, retryAfter) { super(message); this.status=status; this.retryAfter=retryAfter; }
}
function normalizeDraft(text) {
  const cleaned=String(text||'').trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i,'$1');
  let value;
  try { value=JSON.parse(cleaned); } catch { return null; }
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  if(value.skip===true||String(value.editorialDecision||value.editorial_decision||'').toLowerCase()==='skip')return {skip:true};
  return {...value,headline:typeof value.headline==='string'?value.headline.trim():'',standfirst:typeof value.standfirst==='string'?value.standfirst.trim():'',body:paragraphs(value).map(p=>p.trim())};
}
function generationIssues(draft,facts,match=null,compact=false) {
  if(!draft)return ['Geef uitsluitend een geldig JSON-object met kop, intro en body.'];
  const issues=draftIssues(draft,compact);
  // A conservative preflight for the observed English rewrite. Names and
  // isolated foreign football terms do not qualify as a language failure.
  const words=[draft.headline,draft.standfirst,...(Array.isArray(draft.body)?draft.body:[])].join(' ').toLowerCase().match(/[a-zà-ÿ]+/g)||[];
  const english=new Set('the and with from according will who his their which for by this has was its while been into includes'.split(' '));
  const dutch=new Set('de het een en van voor met dat die zijn wordt volgens heeft als deze door bij op'.split(' '));
  const en=words.filter(word=>english.has(word)).length,nl=words.filter(word=>dutch.has(word)).length;
  if(en>=8&&en>2*nl)issues.push('Het artikel is Engelstalig. Schrijf kop, intro en alle alinea’s in natuurlijk Nederlands met dezelfde geverifieerde feiten.');
  if(headlineContradictions(draft))issues.push('De kop noemt tegenstrijdige wedstrijdresultaten. Gebruik alleen het aangeleverde resultaat.');
  issues.push(...require('./editorial-facts').evidenceIssues(draft,facts,match));
  return [...new Set(issues)];
}
// Delegate the single known structural overlap to the specialist editor.
// The publication workflow independently re-runs the exact same preflight,
// source attribution, overlap checks and 85/90 approval gates on its rewrite.
function mayDelegateLeadOverlap(issues,{automaticPublication=false,coachPlan=false}={}){
 return Boolean(automaticPublication&&coachPlan&&Array.isArray(issues)&&issues.length===1&&
  issues[0]==='Intro en alinea’s herhalen te veel dezelfde inhoud. Gebruik per alinea andere aangeleverde feiten.');
}
async function createEditorialDraft({topic,category,facts,sourceUrls,recentHeadlines=[],primaryAuthority=null,match=null,compact=false,automaticPublication=false}, {apiKey,model,fetcher=fetch,timeoutMs=25000}) {
  const assignment=editorialAssignment(facts,{compact});
  const coachPlan=primaryAuthority==='club_decision'&&String(topic||'').toLocaleLowerCase('nl').includes('hoofdtrainer')&&facts.length>=4;
  const officialPublisher=['club_decision','association_decision'].includes(primaryAuthority)&&sourceUrls.length===1?officialPublisherName(sourceUrls[0]):null;
  const coachStoryline=primaryAuthority==='club_decision'&&/\bhoofdtrainer\b/i.test(topic||'')&&facts.length>=4?
   ' Voor deze officieel aangekondigde trainersbenoeming: gebruik de intro éénmaal voor de benoeming en contractduur. Bodyalinea 1 behandelt de aantoonbare wissel van interim-leiding naar vaste hoofdtrainer en de terugkeer naar assistentrollen, indien aangeleverd. Verwar tijdelijk hoofdtrainer zijn nooit met tijdelijk assistent zijn. Bodyalinea 2 beschrijft uitsluitend aantoonbare eerdere functies of onderbreking in tijdsvolgorde. Bodyalinea 3 behandelt indien aangeleverd de officiële motivering en de concrete blijvende stafbezetting. Benut minstens vier echt verschillende aangeleverde feiten. Laat iedere bodyalinea inhoudelijk beginnen met een ander feit; herhaal de aanstelling of contractduur niet. Gebruik een andere journalistieke invalshoek dan de officiële bronkop, zonder nieuwe conclusies. Als een onderdeel niet onderbouwd is, vervang het door een ander feit of geef skip.' : '';
  const officialStyle=officialPublisher?
   ' Deze nieuwsgebeurtenis is uitsluitend via een officiële mededeling van '+officialPublisher+' vastgesteld. Noem in de intro expliciet dat '+officialPublisher+' het besluit meldt of bevestigt. Benoem in minstens één inhoudelijke alinea duidelijk dat de details over staf, achtergrond of contract uit dezelfde bekendmaking komen. Claim niet dat Veldio die feiten zelf onafhankelijk onderzocht. Bouw een eigen bericht op: eerst het besluit, daarna de afzonderlijke gevolgen voor personen, vervolgens de geverifieerde voorgeschiedenis en eventueel de expliciet toegeschreven onderbouwing van de club. Maak geen analyse zonder extra feiten. Gebruik een andere vertelvolgorde en zinsbouw dan de brontekst; kopieer geen zinnen en voeg geen opvulling toe.' : '';
  const outputFields=automaticPublication?'uitsluitend headline (5-14 Nederlandse woorden), standfirst (8-35 woorden) en body als JSON-array met '+(compact?'1-2':coachPlan?'precies 3':'3-5')+' volledig geschreven, verschillende alinea’s; GEEN claims, why_it_matters of verification_notes':'headline (5-14 Nederlandse woorden), standfirst (8-35 woorden), '+(compact?compactStructure:standardStructure)+', why_it_matters, verification_notes en claims';
  let prompt=`Je bent de Nederlandstalige Veldio-redactie. Schrijf een zelfstandig feitelijk voetbalconcept uitsluitend op basis van de aangeleverde feiten. URL's zijn geen bewijs dat je pagina's hebt gelezen. Verzin geen feiten, namen, citaten, scores, cijfers, conclusies of attributies. Neem geen uitgeverstekst over en vertaal geen artikel. Als een aangeleverd gecontroleerd feit een uitdrukkelijke uitspraak van een genoemde coach of bestuurder bevat, vat die dan bondig samen in volledig eigen woorden met expliciete bronvermelding. Presenteer de mening of verwachting nooit als objectief feit. Leid nooit automatisch een langetermijnstrategie uit contractduur af, beweer geen ongewijzigde staf of komende seizoensvoorbereiding zonder letterlijk aangeleverd feit, en verzin geen omstandigheden of gevolgen. Kopieer geen letterlijke uitspraak. Gebruik dergelijke officiële motivering alleen als die in de aangeleverde feiten staat. Kies eerst welke verschillende feiten in iedere alinea thuishoren; schrijf daarna de tekst. Iedere alinea behandelt andere aangeleverde informatie. Gebruik scores alleen exact zoals ze in de feiten staan, met dezelfde thuis-uit-volgorde. Beschrijf geen doelpuntenmakers, spelbeeld, blessure, citaat, ruststand of wedstrijdverloop dat niet expliciet als feit is aangeleverd. Reserveer het aanstellingsbesluit of andere hoofdpunt voor de intro. Gebruik de inhoudelijk verschillende geverifieerde feiten om werkelijk uit te leggen wat er verandert: (1) ingangsdatum en contractvoorwaarden, (2) concrete stafwijzigingen en gevolgen, (3) expliciet bevestigde loopbaanachtergrond of onderbouwde motivering van het besluit. Kies alleen de onderdelen waarover facts daadwerkelijk informatie bieden. Een directeurquote mag uitsluitend feitelijk worden geparafraseerd en toegeschreven als die aantoonbaar in facts staat. Laat geen relevante afzonderlijke geverifieerde achtergrondfeiten liggen om het besluit nógmaals te herhalen. Verdeel de feiten per alinea zonder dubbele kernboodschap. Begin de eerste alinea niet opnieuw met het besluit uit de intro. Gebruik niet hetzelfde feit als kern van meerdere alinea’s. Kies een op facts gebaseerde invalshoek die afwijkt van meegeleverde recente koppen, zonder sensatie of onbevestigde interpretatie. Namen mogen terugkomen; inhoudelijke herhaling niet. Bij weinig verschillende feiten kies je skip in plaats van opvultekst. ${coachStoryline} ${officialStyle} ${coachPlan?'Lever precies drie bodyalinea’s: (1) aantoonbare stafwijziging, (2) controleerbare loopbaan, (3) expliciet aan de spreker of club toegeschreven motivering of uitspraak. Noem het contract alleen in de intro en herhaal de aanstelling niet in de body. Gebruik geen vierde of vijfde alinea; geen nieuwe interpretaties of conclusies.':' '} ${compact ? "Schrijf een kort nieuwsbericht over het besluit. Gebruik de intro voor de kern en de body voor de concrete details of expliciete bronattributie. Splits één rijk feit waar mogelijk in besluit en details. Herhaal het besluit niet in andere woorden." : "Schrijf een regulier artikel met drie tot vijf inhoudelijke alinea’s."} Als de informatie onvoldoende is voor de gekozen vorm, geef JSON {"skip":true,"reason":"onvoldoende feiten"}; vul nooit op. Anders: geef uitsluitend JSON met ${outputFields}. Een body met ontbrekende of lege alinea’s is altijd een ongeldig concept. Begin met body als volledig ingevulde array van alinea’s na kop en intro. Gebruik helder, direct Nederlands. Gebruik directe zinnen met de club als onderwerp, bijvoorbeeld "Ajax speelt" of "FC Midtjylland meldt". Vermijd een inleidende constructie als "Voor Ajax" of "Volgens FC". ${automaticPublication?'Geef geen extra JSON-velden; alle inhoud hoort in kop, intro of body. De onafhankelijke feitenredacteur voert later de controle uit.':'Claims bevatten claim, evidence en status; gebruik unverified tenzij het bewijs letterlijk in de aangeleverde feiten staat. verification_notes begint met "BRONCONTROLE VEREIST: AI heeft de feiten niet onafhankelijk geverifieerd."'} Publiceer nooit zelf.`;
  if(coachPlan&&automaticPublication){
   // Short factual brief replaces the contradictory long generic coaching prompt.
   prompt='Je schrijft als Veldio-journalist een origineel Nederlands nieuwsartikel op basis van uitsluitend verified facts in het gebruikersbericht. '+
    'Voor deze officieel aangekondigde trainersbenoeming geldt: Deze nieuwsgebeurtenis is uitsluitend via een officiële mededeling van '+(officialPublisher||'de club')+' vastgesteld. '+
    'Geef uitsluitend JSON met headline (5-14 woorden), standfirst (8-35 woorden) en body (exact drie alinea’s van 18-120 woorden en minimaal 70 tekens). '+
    'De intro meldt wie officieel is aangesteld, de contractduur indien geverifieerd en dat de club dit zelf bevestigt. '+
    'Alinea 1 beschrijft alleen de feitelijke verandering in assistentrollen en keeperstrainer, voor zover de feiten dit bevestigen. '+
    'Alinea 2 beschrijft alleen afzonderlijk bewezen loopbaanstappen en exacte jaartallen. Verzin geen seizoen of verband tussen twee datums. '+
    'Alinea 3 geeft uitsluitend de expliciet genoemde overwegingen of verwachtingen weer, toegeschreven aan de correcte spreker. Een mening is geen bewezen uitkomst. '+
    'Vermeld in de body minstens eenmaal dat de informatie uit de officiële clubbekendmaking komt. '+
    'Herhaal de benoeming en het contract niet in een extra slotparagraaf. Geen vierde of vijfde alinea. '+
    'Gebruik zelfstandige korte zinnen en andere ordening dan de bron. Geen lange bronpassages, nagesynchroniseerde citaten of opvulling. '+
    'Geen gevolgtrekkingen over stabiliteit, langetermijnvisie, aantrekkelijkheid, resultaten of toekomst tenzij letterlijk geverifieerd. '+
    'Noem geen andere namen, functies, datums of cijfers dan in facts. Zie URL of publicatiedatum niet als bewijs voor een claim. '+
    'Als onvoldoende feitelijke stof bestaat, antwoord alleen met JSON {"skip":true}. Publiceer nooit zelf.';
  }
  // Number and person inventories are supplied separately so the writer cannot
  // infer dates or staff identities from the current date, title or URL.
  const allowedNumbers=[...new Set(facts.flatMap(f=>String(f).match(/\d+(?:[.,]\d+)?/g)||[]))];
  const messages=[{role:'system',content:prompt+' De bijgevoegde editorialAssignment is een taakverdeling op basis van bestaande feiten-ID’s. Begin de intro bij leadFactIds. Gebruik voor elke bodyalinea een ander controleerbaar detail uit bodySections en herhaal geen feiten uit de intro als alineaonderwerp. De labels voegen geen feiten toe. Als er te weinig onafhankelijke details zijn voor de gevraagde vorm, geef skip in plaats van opvulling. Elke naam, datum en claim blijft uitsluitend verifieerbaar met facts. Elke genoemde datum, jaartal en getalwaarde moet letterlijk voorkomen in facts. Vul geen jaartal afgeleid van de publicatiedatum in. Controleer persoonsnamen per woordgroep tegen facts; verzin geen trainersstaf, functie of loopbaanfeit.'},{role:'user',content:JSON.stringify({topic,category,facts,allowedNumbers,sourceUrls,recentHeadlines:recentHeadlines.slice(0,20),primaryAuthority,match,compact,automaticPublication,officialPublisher,editorialAssignment:assignment})}];
  // Both writing and its single targeted repair share one 25-second deadline.
  const signal=AbortSignal.timeout(timeoutMs);
  for(let attempt=0;attempt<2;attempt++){
    let data;
    try{
      const response=await fetcher('https://api.groq.com/openai/v1/chat/completions',{
        method:'POST',signal,headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
        body:JSON.stringify({model,messages,temperature:0.2,...groqEditorialOptions(model,'writing',{automaticPublication})})
      });
      if(response.status===429){
        const seconds=Number(response.headers.get('retry-after'));
        throw new DraftError(429,'De AI-dienst heeft tijdelijk zijn limiet bereikt. Je invoer blijft bewaard; probeer later opnieuw.',Number.isFinite(seconds)&&seconds>0?Math.min(3600,Math.ceil(seconds)):60);
      }
      if(!response.ok)throw new DraftError(502,'De AI-dienst is tijdelijk niet beschikbaar. Je invoer blijft bewaard.');
      data=await response.json();
    }catch(error){
      if(error?.code==='GROQ_DAILY_QUOTA')throw error;
      if(error instanceof DraftError)throw error;
      if(signal.aborted||['TimeoutError','AbortError'].includes(error?.name))throw new DraftError(504,'De AI-dienst antwoordde niet binnen 25 seconden. Je invoer blijft bewaard.');
      throw new DraftError(502,'Geen bruikbaar antwoord van de AI-dienst. Je invoer blijft bewaard.');
    }
    const text=data?.choices?.[0]?.message?.content||'';
    const draft=normalizeDraft(text);
    if(draft?.skip){
     const sufficientCoachEvidence=automaticPublication&&coachPlan&&officialPublisher&&facts.length>=7&&
      facts.some(x=>/assistent|keeperstrainer/i.test(x))&&facts.some(x=>/\b20\d\d\b/.test(x))&&
      facts.some(x=>/licht.*toe|verklaar|: ,,|: “|: „/i.test(x));
     // A rich official packet gets at most one second writer attempt, not
     // an automatic approval or a relaxation of any source/quality gate.
     if(attempt===0&&sufficientCoachEvidence){
      messages.push({role:'assistant',content:'{"skip":true}'},{
       role:'user',content:'Controleer of je skip ten onrechte hebt gekozen. De officiële feiten bevatten aantoonbaar een besluit, stafrollen, eerdere loopbaanstappen en expliciete toegeschreven toelichting. Schrijf een nieuw, kort, origineel artikel met precies drie afzonderlijke bodyalinea’s uitsluitend uit die bestaande facts. De intro bevestigt het besluit namens officialPublisher. Voeg geen zelfbedachte seizoenen, nieuwe functietitels, gevolgen of persoonlijke oordelen toe. Indien een deel toch geen feitelijke grond heeft, laat uitsluitend dat detail weg en gebruik een ander geverifieerd feit. Bij echt onvoldoende bewijs blijft skip toegestaan.'
      });
      continue;
     }
     throw new DraftError(422,'Onvoldoende gecontroleerde feiten voor een inhoudelijk concept. Vul zo nodig aanvullende, verschillende feiten aan.');
    }
    const issues=generationIssues(draft,facts,match,compact);
    if(automaticPublication){
     issues.push(...editorialAttributionIssues(draft,{primaryAuthority,sourceUrls,facts}));
     issues.push(...officialCoachStructureIssues(draft,{topic,primaryAuthority,facts}));
     issues.push(...unsupportedInterpretationIssues(draft,facts));
     issues.push(...unverifiedTimelineAndRoles(draft,facts));
    }
    if(!issues.length)return {...draft,qualityReview:{automatedTextChecksPassed:true,revisionApplied:attempt===1,attempts:attempt+1,factVerificationRequired:true,autoPublish:false}};
    if(attempt===1){
     if(mayDelegateLeadOverlap(issues,{automaticPublication,coachPlan}))return {...draft,qualityReview:{automatedTextChecksPassed:false,needsSpecialistRevision:true,attempts:attempt+1,factVerificationRequired:true,autoPublish:false}};
     const error=new DraftError(502,'Concept na herstel nog niet geschikt: '+issues.join(' '));error.issues=issues;error.rejectedDraft=draft;throw error;
    }
    messages.push({role:'assistant',content:String(text).slice(0,12000)},{role:'user',content:'Herstel uitsluitend de onderstaande problemen met dezelfde aangeleverde feiten. Voeg geen nieuwe feiten of cijfers toe. Als herstel meer feiten vereist, geef {"skip":true,"reason":"onvoldoende feiten"}. Controlepunten: '+issues.join(' ')});
  }
}
module.exports={createEditorialDraft,DraftError,normalizeDraft,generationIssues,groqEditorialOptions,editorialAssignment,officialPublisherName,editorialAttributionIssues,officialCoachStructureIssues,unsupportedInterpretationIssues,unverifiedTimelineAndRoles,mayDelegateLeadOverlap};

