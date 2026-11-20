'use strict';

// Fase 103A: bewijsgebonden redactievergadering vóór de AI-schrijver.
// Maakt verschillende mogelijke invalshoeken uit reeds geverifieerde feiten.
// Geen webclaims, geen extra modelcalls en geen automatische goedkeuring.
const {planEvidenceResearch}=require('./editorial-investigation100b');

const contextKind={
 verified_history:'historische_context',
 verified_next_step:'bevestigd_vervolg',
 verified_standing:'competitiecontext',
 attributed_reaction:'toegeschreven_reactie'
};
const types=Object.keys(contextKind);
function buildStoryStrategy(facts,{topic='',compact=false}={}){
 const plan=planEvidenceResearch(facts,{topic,compact});
 const factIds=new Set(plan.supportedFactIds||[]);
 const leadId=plan.leadFactIds?.[0];
 const sections=plan.bodySections||[];
 const groups=Object.fromEntries(types.map(type=>[type,sections
  .filter(section=>section.kind===type)
  .flatMap(section=>section.factIds)
  .filter(id=>factIds.has(id)&&id!==leadId)]));
 const other=sections.flatMap(section=>section.factIds)
  .filter(id=>factIds.has(id)&&id!==leadId);
 const angleOptions=[];
 function add(id,focus,anchors,readerQuestion){
  const distinct=[...new Set(anchors.filter(value=>value&&factIds.has(value)&&value!==leadId))];
  if(!leadId||distinct.length===0)return;
  angleOptions.push({id,focus,leadFactId:leadId,
   supportingFactIds:distinct.slice(0,compact?3:5),readerQuestion,
   // Dit zijn redactionele structuurlabels, nooit nieuwe feiten.
   factIds:[leadId,...distinct.slice(0,compact?3:5)]});
 }
 add('kernnieuws','actuele ontwikkeling',other,
  'Wat is de actuele geverifieerde ontwikkeling en wat is daarover concreet bekend?');
 if(groups.verified_history?.length)add('context','bewezen voorgeschiedenis',
  [...groups.verified_history,...groups.verified_next_step,...other],
  'Welke afzonderlijk geverifieerde voorgeschiedenis maakt de ontwikkeling nieuwswaardig?');
 if(groups.verified_next_step?.length)add('vervolg','concreet bevestigd vervolg',
  [...groups.verified_next_step,...groups.verified_standing,...other],
  'Welke concrete vervolgstap is al officieel bevestigd, zonder een uitkomst te voorspellen?');
 if(groups.attributed_reaction?.length)add('reactie','gecontroleerde toegeschreven uitspraak',
  [...groups.attributed_reaction,...other],
  'Wat heeft de genoemde spreker werkelijk verklaard en wat staat daarvan feitelijk vast?');
 if(groups.verified_standing?.length)add('competitie','bewezen competitiestand',
  [...groups.verified_standing,...other],
  'Wat is de relevante bevestigde groeps- of competitiestand, zonder daar een resultaat uit af te leiden?');
 const rank={context:5,vervolg:4,reactie:4,competitie:3,kernnieuws:2};
 angleOptions.sort((a,b)=>rank[b.id]-rank[a.id]||
  b.supportingFactIds.length-a.supportingFactIds.length);
 const selectedAngle=angleOptions[0]||null;
 // Niet-onderbouwde context blijft een onderzoeksvraag, nooit artikelinhoud.
 const evidenceGaps=(plan.researchQuestions||[]).map((question,index)=>({
  id:'Q'+(index+1),question,status:'onderzoek_nodig',usableAsEvidence:false
 }));
 const newsroomInstruction=plan.newsroomInstruction+' '+(
  selectedAngle?
   'Redactievergadering: schrijf vanuit selectedAngle.focus en beantwoord selectedAngle.readerQuestion alleen met de vermelde factIds. Gebruik leadFactId voor de kern. Iedere bodyalinea moet een nieuw supportingFactId uit de geverifieerde feiten benutten. Geef bij gebrek aan afzonderlijke inhoud JSON {"skip":true}. Andere angleOptions zijn alternatieven, geen extra bewezen gebeurtenissen.':
   'Redactievergadering: er is geen zelfstandig verhaal uit de bestaande feiten te construeren; antwoord JSON {"skip":true}.'
 )+' Open researchQuestions zijn nadrukkelijk geen feiten; haal geen ontbrekende context uit voorkennis of aannames.';
 return {...plan,strategyVersion:'103A',angleOptions,selectedAngle,evidenceGaps,
  newsroomInstruction,readyForWriting:!!selectedAngle,
  researchQuestionsAreEvidence:false};
}
module.exports={buildStoryStrategy};
