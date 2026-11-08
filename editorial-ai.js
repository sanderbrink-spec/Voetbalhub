'use strict';
const { draftIssues, paragraphs, compactStructure, standardStructure } = require('./editorial-desk-model');
const { headlineContradictions } = require('./editorial-quality');
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
async function createEditorialDraft({topic,category,facts,sourceUrls,recentHeadlines=[],match=null,compact=false}, {apiKey,model,fetcher=fetch,timeoutMs=25000}) {
  const prompt=`Je bent de Nederlandstalige Veldio-redactie. Schrijf een zelfstandig feitelijk voetbalconcept uitsluitend op basis van de aangeleverde feiten. URL's zijn geen bewijs dat je pagina's hebt gelezen. Verzin geen feiten, namen, citaten, scores, cijfers, conclusies of attributies. Neem geen uitgeverstekst over en vertaal geen artikel. Kies eerst welke verschillende feiten in iedere alinea thuishoren; schrijf daarna de tekst. Kies bij een trainersaanstelling een eigen journalistieke invalshoek op de concrete verandering: wie de leiding overneemt, wat er met de tijdelijk aangestelde staf gebeurt en wat expliciet bekend is over contract en loopbaan. Gebruik uitsluitend onderdelen die daadwerkelijk door facts zijn bewezen. Presenteer de aanstelling als nieuws en de daaropvolgende alinea’s als verschillende verklarende details, niet als herhaling van de bron. Gebruik in kop en intro geen opeenvolging van de bronwoorden en laat de volgorde van de bewijspassages niet de verhaalopbouw bepalen. Begin een alinea over een stafwissel bijvoorbeeld bij het nieuwe takenpakket, niet bij dezelfde namenreeks waarmee de bron begint. Kies woorden en zinsbouw zelfstandig, niet als synoniemenvervanging. Iedere alinea behandelt andere aangeleverde informatie. Gebruik scores alleen exact zoals ze in de feiten staan, met dezelfde thuis-uit-volgorde. Beschrijf geen doelpuntenmakers, spelbeeld, blessure, citaat, ruststand of wedstrijdverloop dat niet expliciet als feit is aangeleverd. Reserveer het aanstellingsbesluit of andere hoofdpunt voor de intro. Gebruik de inhoudelijk verschillende geverifieerde feiten om werkelijk uit te leggen wat er verandert: (1) ingangsdatum en contractvoorwaarden, (2) concrete stafwijzigingen en gevolgen, (3) expliciet bevestigde loopbaanachtergrond of onderbouwde motivering van het besluit. Kies alleen de onderdelen waarover facts daadwerkelijk informatie bieden. Een directeurquote mag uitsluitend feitelijk worden geparafraseerd en toegeschreven als die aantoonbaar in facts staat. Laat geen relevante afzonderlijke geverifieerde achtergrondfeiten liggen om het besluit nógmaals te herhalen. Verdeel de feiten per alinea zonder dubbele kernboodschap. Begin de eerste alinea niet opnieuw met het besluit uit de intro. Gebruik niet hetzelfde feit als kern van meerdere alinea’s. Kies een op facts gebaseerde invalshoek die afwijkt van meegeleverde recente koppen, zonder sensatie of onbevestigde interpretatie. Namen mogen terugkomen; inhoudelijke herhaling niet. Bij weinig verschillende feiten kies je skip in plaats van opvultekst. ${compact ? "Schrijf een kort nieuwsbericht over het besluit. Gebruik de intro voor de kern en de body voor de concrete details of expliciete bronattributie. Splits één rijk feit waar mogelijk in besluit en details. Herhaal het besluit niet in andere woorden." : "Schrijf een regulier artikel met drie tot vijf inhoudelijke alinea’s."} Als de informatie onvoldoende is voor de gekozen vorm, geef JSON {"skip":true,"reason":"onvoldoende feiten"}; vul nooit op. Anders: geef uitsluitend JSON met headline (5-14 Nederlandse woorden), standfirst (8-35 woorden), ${compact ? compactStructure : standardStructure}, why_it_matters, verification_notes en claims. Gebruik helder, direct Nederlands. Gebruik directe zinnen met de club als onderwerp, bijvoorbeeld "Ajax speelt" of "FC Midtjylland meldt". Vermijd een inleidende constructie als "Voor Ajax" of "Volgens FC". Claims bevatten claim, evidence en status; gebruik unverified tenzij het bewijs letterlijk in de aangeleverde feiten staat. verification_notes begint met "BRONCONTROLE VEREIST: AI heeft de feiten niet onafhankelijk geverifieerd." Publiceer nooit zelf.`;
  // Number and person inventories are supplied separately so the writer cannot
  // infer dates or staff identities from the current date, title or URL.
  const allowedNumbers=[...new Set(facts.flatMap(f=>String(f).match(/\d+(?:[.,]\d+)?/g)||[]))];
  const messages=[{role:'system',content:prompt+' Elke genoemde datum, jaartal en getalwaarde moet letterlijk voorkomen in facts. Vul geen jaartal afgeleid van de publicatiedatum in. Controleer persoonsnamen per woordgroep tegen facts; verzin geen trainersstaf, functie of loopbaanfeit.'},{role:'user',content:JSON.stringify({topic,category,facts,allowedNumbers,sourceUrls,recentHeadlines:recentHeadlines.slice(0,20),match,compact})}];
  // Both writing and its single targeted repair share one 25-second deadline.
  const signal=AbortSignal.timeout(timeoutMs);
  for(let attempt=0;attempt<2;attempt++){
    let data;
    try{
      const response=await fetcher('https://api.groq.com/openai/v1/chat/completions',{
        method:'POST',signal,headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
        body:JSON.stringify({model,messages,response_format:{type:'json_object'},temperature:0.2,max_completion_tokens:1600,...(model.startsWith("openai/gpt-oss-")?{reasoning_effort:"low"}:{})})
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
module.exports={createEditorialDraft,DraftError,normalizeDraft,generationIssues};

