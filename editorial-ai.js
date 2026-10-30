'use strict';
const { draftIssues } = require('./editorial-desk-model');
const { headlineContradictions } = require('./editorial-quality');
class DraftError extends Error {
  constructor(status, message, retryAfter) { super(message); this.status=status; this.retryAfter=retryAfter; }
}
async function createEditorialDraft({topic,category,facts,sourceUrls}, {apiKey,model,fetcher=fetch,timeoutMs=25000}) {
  const prompt = `Je bent de Nederlandstalige VoetbalHub-redactie. Schrijf uitsluitend een zelfstandig feitelijk voetbalconcept op basis van de aangeleverde feiten. URL's zijn geen bewijs dat je pagina's hebt gelezen. Verzin geen feiten, namen, citaten, scores, conclusies of attributies. Neem geen uitgeverstekst over en vertaal geen artikel. Als er onvoldoende informatie is voor drie verschillende inhoudelijke alinea's, geef JSON {"skip":true,"reason":"onvoldoende feiten"}. Anders: geef uitsluitend JSON met headline (5-14 Nederlandse woorden), standfirst (8-35 woorden), body (3-5 alinea's, elk 18-120 woorden en minimaal 70 tekens), why_it_matters, verification_notes en claims. Iedere alinea voegt controleerbare informatie toe. Vermijd herhaling en opvulling. Claims bevatten claim, evidence en status; gebruik unverified tenzij bewijs letterlijk in de aangeleverde feiten staat. verification_notes begint met "BRONCONTROLE VEREIST: AI heeft de feiten niet onafhankelijk geverifieerd." Publiceer nooit zelf.`;
  let response,data;
  try {
    const signal=AbortSignal.timeout(timeoutMs);
    response=await fetcher('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',signal,headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
      body:JSON.stringify({model,messages:[{role:'system',content:prompt},{role:'user',content:JSON.stringify({topic,category,facts,sourceUrls})}],response_format:{type:'json_object'},temperature:0.2,max_completion_tokens:1600})
    });
    if (response.status===429) {
      const seconds=Number(response.headers.get('retry-after'));
      throw new DraftError(429,'De AI-dienst heeft tijdelijk zijn limiet bereikt. Je invoer blijft bewaard; probeer later opnieuw.',Number.isFinite(seconds)&&seconds>0?Math.min(3600,Math.ceil(seconds)):60);
    }
    if(!response.ok)throw new DraftError(502,'De AI-dienst is tijdelijk niet beschikbaar. Je invoer blijft bewaard.');
    data=await response.json();
  }catch(error){
    if(error instanceof DraftError)throw error;
    if(['TimeoutError','AbortError'].includes(error?.name))throw new DraftError(504,'De AI-dienst antwoordde niet binnen 25 seconden. Je invoer blijft bewaard.');
    throw new DraftError(502,'Geen bruikbaar antwoord van de AI-dienst. Je invoer blijft bewaard.');
  }
  let draft;
  try{draft=JSON.parse(data?.choices?.[0]?.message?.content||'');}catch{throw new DraftError(502,'De AI-dienst gaf geen geldig concept terug. Je invoer blijft bewaard.');}
  if(!draft||typeof draft!=='object'||Array.isArray(draft))throw new DraftError(502,'Ongeldig AI-concept ontvangen.');
  if(draft.skip===true)throw new DraftError(422,'Onvoldoende gecontroleerde feiten voor een inhoudelijk concept. Vul extra informatie aan.');
  const normalized={...draft,headline:typeof draft.headline==='string'?draft.headline.trim():'',standfirst:typeof draft.standfirst==='string'?draft.standfirst.trim():'',body:Array.isArray(draft.body)?draft.body.filter(p=>typeof p==='string').map(p=>p.trim()).filter(Boolean):[]};
  if(draftIssues(normalized).length||headlineContradictions(normalized))throw new DraftError(502,'Het AI-concept voldoet niet aan de redactionele kwaliteitsnorm. Er wordt niets gepubliceerd.');
  return normalized;
}
module.exports={createEditorialDraft,DraftError};
