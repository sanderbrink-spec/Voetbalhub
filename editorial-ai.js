'use strict';
const { draftIssues, paragraphs } = require('./editorial-desk-model');
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
function generationIssues(draft,facts,match=null) {
  if(!draft)return ['Geef uitsluitend een geldig JSON-object met kop, intro en body.'];
  const issues=draftIssues(draft);
  if(headlineContradictions(draft))issues.push('De kop noemt tegenstrijdige wedstrijdresultaten. Gebruik alleen het aangeleverde resultaat.');
  issues.push(...require('./editorial-facts').evidenceIssues(draft,facts,match));
  return [...new Set(issues)];
}
async function createEditorialDraft({topic,category,facts,sourceUrls,match=null}, {apiKey,model,fetcher=fetch,timeoutMs=25000}) {
  const prompt=`Je bent de Nederlandstalige VoetbalHub-redactie. Schrijf een zelfstandig feitelijk voetbalconcept uitsluitend op basis van de aangeleverde feiten. URL's zijn geen bewijs dat je pagina's hebt gelezen. Verzin geen feiten, namen, citaten, scores, cijfers, conclusies of attributies. Neem geen uitgeverstekst over en vertaal geen artikel. Kies eerst welke verschillende feiten in iedere alinea thuishoren; schrijf daarna de tekst. Iedere alinea behandelt andere aangeleverde informatie. Gebruik scores alleen exact zoals ze in de feiten staan, met dezelfde thuis-uit-volgorde. Beschrijf geen doelpuntenmakers, spelbeeld, blessure, citaat, ruststand of wedstrijdverloop dat niet expliciet als feit is aangeleverd. De intro vat het hoofdpunt samen en wordt niet in de eerste alinea herhaald. Als de informatie onvoldoende is voor drie inhoudelijke alinea's, geef JSON {"skip":true,"reason":"onvoldoende feiten"}; vul nooit op. Anders: geef uitsluitend JSON met headline (5-14 Nederlandse woorden), standfirst (8-35 woorden), body (3-5 alinea's, elk 18-120 woorden en minimaal 70 tekens), why_it_matters, verification_notes en claims. Gebruik helder, direct Nederlands. Claims bevatten claim, evidence en status; gebruik unverified tenzij het bewijs letterlijk in de aangeleverde feiten staat. verification_notes begint met "BRONCONTROLE VEREIST: AI heeft de feiten niet onafhankelijk geverifieerd." Publiceer nooit zelf.`;
  const messages=[{role:'system',content:prompt},{role:'user',content:JSON.stringify({topic,category,facts,sourceUrls,match})}];
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
      if(error instanceof DraftError)throw error;
      if(signal.aborted||['TimeoutError','AbortError'].includes(error?.name))throw new DraftError(504,'De AI-dienst antwoordde niet binnen 25 seconden. Je invoer blijft bewaard.');
      throw new DraftError(502,'Geen bruikbaar antwoord van de AI-dienst. Je invoer blijft bewaard.');
    }
    const text=data?.choices?.[0]?.message?.content||'';
    const draft=normalizeDraft(text);
    if(draft?.skip)throw new DraftError(422,'Onvoldoende gecontroleerde feiten voor een inhoudelijk concept. Vul extra informatie aan, bij voorkeur 4 tot 8 verschillende feiten.');
    const issues=generationIssues(draft,facts,match);
    if(!issues.length)return {...draft,qualityReview:{automatedTextChecksPassed:true,revisionApplied:attempt===1,attempts:attempt+1,factVerificationRequired:true,autoPublish:false}};
    if(attempt===1){const error=new DraftError(502,'Concept na herstel nog niet geschikt: '+issues.join(' '));error.issues=issues;throw error;}
    messages.push({role:'assistant',content:String(text).slice(0,12000)},{role:'user',content:'Herstel uitsluitend de onderstaande problemen met dezelfde aangeleverde feiten. Voeg geen nieuwe feiten of cijfers toe. Als herstel meer feiten vereist, geef {"skip":true,"reason":"onvoldoende feiten"}. Controlepunten: '+issues.join(' ')});
  }
}
module.exports={createEditorialDraft,DraftError,normalizeDraft,generationIssues};

