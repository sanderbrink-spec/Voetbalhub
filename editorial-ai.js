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
  if(headlineContradictions(draft))issues.push('De kop noemt tegenstrijdige wedstrijdresultaten. Gebruik alleen het aangeleverde resultaat.');
  issues.push(...require('./editorial-facts').evidenceIssues(draft,facts,match));
  return [...new Set(issues)];
}
async function createEditorialDraft({topic,category,facts,sourceUrls,recentHeadlines=[],primaryAuthority=null,match=null,compact=false,automaticPublication=false}, {apiKey,model,fetcher=fetch,timeoutMs=25000}) {
  const coachStoryline=primaryAuthority==='club_decision'&&/\bhoofdtrainer\b/i.test(topic||'')&&facts.length>=4?
   ' Voor deze officieel aangekondigde trainersbenoeming: gebruik de intro éénmaal voor de benoeming en contractduur. Bodyalinea 1 behandelt de aantoonbare wissel van interim-leiding naar vaste hoofdtrainer en de terugkeer naar assistentrollen, indien aangeleverd. Verwar tijdelijk hoofdtrainer zijn nooit met tijdelijk assistent zijn. Bodyalinea 2 beschrijft uitsluitend aantoonbare eerdere functies of onderbreking in tijdsvolgorde. Bodyalinea 3 behandelt indien aangeleverd de officiële motivering en de concrete blijvende stafbezetting. Benut minstens vier echt verschillende aangeleverde feiten. Laat iedere bodyalinea inhoudelijk beginnen met een ander feit; herhaal de aanstelling of contractduur niet. Gebruik een andere journalistieke invalshoek dan de officiële bronkop, zonder nieuwe conclusies. Als een onderdeel niet onderbouwd is, vervang het door een ander feit of geef skip.' : '';
  const outputFields=automaticPublication?'uitsluitend headline (5-14 Nederlandse woorden), standfirst (8-35 woorden) en body als JSON-array met '+(compact?'1-2':'3-5')+' volledig geschreven, verschillende alinea’s; GEEN claims, why_it_matters of verification_notes':'headline (5-14 Nederlandse woorden), standfirst (8-35 woorden), '+(compact?compactStructure:standardStructure)+', why_it_matters, verification_notes en claims';
  const prompt=`Je bent de Nederlandstalige Veldio-redactie. Schrijf een zelfstandig feitelijk voetbalconcept uitsluitend op basis van de aangeleverde feiten. URL's zijn geen bewijs dat je pagina's hebt gelezen. Verzin geen feiten, namen, citaten, scores, cijfers, conclusies of attributies. Neem geen uitgeverstekst over en vertaal geen artikel. Als een aangeleverd gecontroleerd feit een uitdrukkelijke uitspraak van een genoemde coach of bestuurder bevat, vat die dan bondig samen in volledig eigen woorden met expliciete bronvermelding. Presenteer de mening of verwachting nooit als objectief feit. Leid nooit automatisch een langetermijnstrategie uit contractduur af, beweer geen ongewijzigde staf of komende seizoensvoorbereiding zonder letterlijk aangeleverd feit, en verzin geen omstandigheden of gevolgen. Kopieer geen letterlijke uitspraak. Gebruik dergelijke officiële motivering alleen als die in de aangeleverde feiten staat. Kies eerst welke verschillende feiten in iedere alinea thuishoren; schrijf daarna de tekst. Iedere alinea behandelt andere aangeleverde informatie. Gebruik scores alleen exact zoals ze in de feiten staan, met dezelfde thuis-uit-volgorde. Beschrijf geen doelpuntenmakers, spelbeeld, blessure, citaat, ruststand of wedstrijdverloop dat niet expliciet als feit is aangeleverd. Reserveer het aanstellingsbesluit of andere hoofdpunt voor de intro. Gebruik de inhoudelijk verschillende geverifieerde feiten om werkelijk uit te leggen wat er verandert: (1) ingangsdatum en contractvoorwaarden, (2) concrete stafwijzigingen en gevolgen, (3) expliciet bevestigde loopbaanachtergrond of onderbouwde motivering van het besluit. Kies alleen de onderdelen waarover facts daadwerkelijk informatie bieden. Een directeurquote mag uitsluitend feitelijk worden geparafraseerd en toegeschreven als die aantoonbaar in facts staat. Laat geen relevante afzonderlijke geverifieerde achtergrondfeiten liggen om het besluit nógmaals te herhalen. Verdeel de feiten per alinea zonder dubbele kernboodschap. Begin de eerste alinea niet opnieuw met het besluit uit de intro. Gebruik niet hetzelfde feit als kern van meerdere alinea’s. Kies een op facts gebaseerde invalshoek die afwijkt van meegeleverde recente koppen, zonder sensatie of onbevestigde interpretatie. Namen mogen terugkomen; inhoudelijke herhaling niet. Bij weinig verschillende feiten kies je skip in plaats van opvultekst. ${coachStoryline} ${compact ? "Schrijf een kort nieuwsbericht over het besluit. Gebruik de intro voor de kern en de body voor de concrete details of expliciete bronattributie. Splits één rijk feit waar mogelijk in besluit en details. Herhaal het besluit niet in andere woorden." : "Schrijf een regulier artikel met drie tot vijf inhoudelijke alinea’s."} Als de informatie onvoldoende is voor de gekozen vorm, geef JSON {"skip":true,"reason":"onvoldoende feiten"}; vul nooit op. Anders: geef uitsluitend JSON met ${outputFields}. Een body met ontbrekende of lege alinea’s is altijd een ongeldig concept. Begin met body als volledig ingevulde array van alinea’s na kop en intro. Gebruik helder, direct Nederlands. Gebruik directe zinnen met de club als onderwerp, bijvoorbeeld "Ajax speelt" of "FC Midtjylland meldt". Vermijd een inleidende constructie als "Voor Ajax" of "Volgens FC". ${automaticPublication?'Geef geen extra JSON-velden; alle inhoud hoort in kop, intro of body. De onafhankelijke feitenredacteur voert later de controle uit.':'Claims bevatten claim, evidence en status; gebruik unverified tenzij het bewijs letterlijk in de aangeleverde feiten staat. verification_notes begint met "BRONCONTROLE VEREIST: AI heeft de feiten niet onafhankelijk geverifieerd."'} Publiceer nooit zelf.`;
  // Number and person inventories are supplied separately so the writer cannot
  // infer dates or staff identities from the current date, title or URL.
  const allowedNumbers=[...new Set(facts.flatMap(f=>String(f).match(/\d+(?:[.,]\d+)?/g)||[]))];
  const messages=[{role:'system',content:prompt+' Elke genoemde datum, jaartal en getalwaarde moet letterlijk voorkomen in facts. Vul geen jaartal afgeleid van de publicatiedatum in. Controleer persoonsnamen per woordgroep tegen facts; verzin geen trainersstaf, functie of loopbaanfeit.'},{role:'user',content:JSON.stringify({topic,category,facts,allowedNumbers,sourceUrls,recentHeadlines:recentHeadlines.slice(0,20),primaryAuthority,match,compact,automaticPublication})}];
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
    if(draft?.skip)throw new DraftError(422,'Onvoldoende gecontroleerde feiten voor een inhoudelijk concept. Vul zo nodig aanvullende, verschillende feiten aan.');
    const issues=generationIssues(draft,facts,match,compact);
    if(!issues.length)return {...draft,qualityReview:{automatedTextChecksPassed:true,revisionApplied:attempt===1,attempts:attempt+1,factVerificationRequired:true,autoPublish:false}};
    if(attempt===1){const error=new DraftError(502,'Concept na herstel nog niet geschikt: '+issues.join(' '));error.issues=issues;error.rejectedDraft=draft;throw error;}
    messages.push({role:'assistant',content:String(text).slice(0,12000)},{role:'user',content:'Herstel uitsluitend de onderstaande problemen met dezelfde aangeleverde feiten. Voeg geen nieuwe feiten of cijfers toe. Als herstel meer feiten vereist, geef {"skip":true,"reason":"onvoldoende feiten"}. Controlepunten: '+issues.join(' ')});
  }
}
module.exports={createEditorialDraft,DraftError,normalizeDraft,generationIssues,groqEditorialOptions};

