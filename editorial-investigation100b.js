'use strict';

// Veldio Redactie 5.0, first evidence-bound investigation desk.
// This desk does not fetch, infer, or approve a fact. It evaluates two
// independent editorial perspectives over the same already-verified packet:
// the current development and a relevant, separately supported context line.
// Open research questions are explicitly NOT source material for the writer.

const norm=value=>String(value||'').normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const tokenise=value=>new Set(norm(value).split(/\s+/).filter(w=>w.length>=4&&
 !['heeft','hebben','wordt','werden','voor','tegen','vanaf','volgens','the','and','with','from','een','deze','also','that','official','nieuws','nieuwe','league','club','team'].includes(w)));
const distinct=(a,b)=>{
 const left=tokenise(a),right=tokenise(b);
 const overlap=[...left].filter(t=>right.has(t)).length;
 const size=Math.min(left.size,right.size);
 // Different figures, dates or negation mean potentially distinct claims.
 const signatures=s=>(String(s).match(/\d+(?:[.,]\d+)?/g)||[]).sort().join('|');
 const negated=s=>/\b(?:niet|geen|nooit|not|never|without)\b/i.test(s);
 if(signatures(a)!==signatures(b)||negated(a)!==negated(b))return true;
 return !(size>=4&&overlap/size>=0.85);
};
function kind(value){
 const s=String(value);
 if(/\b(?:qualified|qualification|promoted|relegated|confirmed in first place|gekwalificeerd|geplaatst|promoveert|degradeert|groepswinnaar)\b/i.test(s))return 'competition_decision';
 if(/\b(?:benoem|aangesteld|ontslagen|contract|verlengt|tekent|announced|appointed|signed|schorsing|bevestigt)\b/i.test(s))return 'club_or_federation_decision';
 if(/\b(?:eerder|voorheen|vroegere|vorig seizoen|vorige ontmoeting|historie|previous|formerly|last season|in 20\d{2})\b/i.test(s))return 'verified_history';
 if(/\b(?:volgende wedstrijd|komende wedstrijd|eerstvolgende|toekomstige|upcoming|next fixture|next match)\b/i.test(s))return 'verified_next_step';
 if(/\b(?:volgens|aldus|verklaart|toelicht|licht toe|said|explained)\b/i.test(s))return 'attributed_reaction';
 if(/\b(?:Group [A-D][1-4]|ranglijst|punten|stand|points|table|positie)\b/i.test(s))return 'verified_standing';
 return 'other_verified_fact';
}
function planEvidenceResearch(facts,{topic='',compact=false}={}){
 if(!Array.isArray(facts)||facts.some(f=>typeof f!=='string'))
  return {version:'100B',leadFactIds:[],bodySections:[],researchQuestions:[],contextFactIds:[],distinctFactCount:0};
 const rows=[];
 for(let index=0;index<facts.length;index++){
  const value=facts[index].trim();
  if(!value||rows.some(row=>!distinct(row.text,value)))continue;
  rows.push({id:'F'+(index+1),text:value,kind:kind(value)});
 }
 if(!rows.length)return {version:'100B',leadFactIds:[],bodySections:[],researchQuestions:[],contextFactIds:[],distinctFactCount:0};
 const topicWords=tokenise(topic);
 const priorities={competition_decision:6,club_or_federation_decision:6,verified_next_step:3,verified_standing:3,verified_history:2,attributed_reaction:2,other_verified_fact:1};
 const rank=row=>{
  const matches=[...tokenise(row.text)].filter(token=>topicWords.has(token)).length;
  // Editorial ordering only. A ranking cannot confirm a claim.
  return priorities[row.kind]+Math.min(3,matches);
 };
 const developments=rows.filter(row=>['competition_decision','club_or_federation_decision'].includes(row.kind));
 const lead=[...(developments.length?developments:rows)].sort((a,b)=>rank(b)-rank(a)||Number(a.id.slice(1))-Number(b.id.slice(1)))[0];
 const rest=rows.filter(row=>row.id!==lead.id);
 // The contextual desk works separately from the news desk. A standing,
 // historical fact or next step may enrich a story ONLY if already verified.
 const contextKinds=['verified_history','verified_next_step','verified_standing','attributed_reaction'];
 const contextual=rest.filter(row=>contextKinds.includes(row.kind));
 const remaining=rest.filter(row=>!contextual.includes(row));
 const ordered=[...contextual.sort((a,b)=>rank(b)-rank(a)),...remaining.sort((a,b)=>rank(b)-rank(a))];
 const max=compact?2:4;
 const bodySections=[];
 for(const row of ordered){
  const label=row.kind;
  const existing=bodySections.find(section=>section.kind===label);
  if(existing)existing.factIds.push(row.id);
  else if(bodySections.length<max)bodySections.push({kind:label,factIds:[row.id]});
  else bodySections.at(-1).factIds.push(row.id);
 }
 const contextFactIds=contextual.map(row=>row.id);
 const researchQuestions=[];
 if(!contextual.some(row=>row.kind==='verified_history'))
  researchQuestions.push('Is er een controleerbare eerdere wedstrijd, loopbaanrelatie of historische ontwikkeling die deze gebeurtenis relevant maakt?');
 if(!contextual.some(row=>row.kind==='verified_next_step'))
  researchQuestions.push('Welke concrete volgende wedstrijd of formele vervolgstap is bevestigd door een toegestane bron?');
 if(!developments.length)
  researchQuestions.push('Welke actuele verandering of beslissing is rechtstreeks bevestigd, in plaats van uitsluitend een beschrijvende stand?');
 return {
  version:'100B',
  leadFactIds:[lead.id],
  bodySections,
  contextFactIds,
  distinctFactCount:rows.length,
  supportedFactIds:rows.map(row=>row.id),
  researchQuestions,
  // These must never become prose claims without new source verification.
  researchQuestionsAreEvidence:false,
  newsroomInstruction:'Kies een concreet nieuwsfeit als opening. Gebruik ieder feit-ID in maximaal één inhoudelijk onderdeel. Historische duiding, gevolg, oorzaak of volgende wedstrijd mogen alleen als die letterlijk in facts staan. Voeg geen antwoorden op open researchQuestions toe.'
 };
}
module.exports={planEvidenceResearch};
