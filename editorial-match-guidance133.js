'use strict';

// Instructions are grounded only in the already validated match evidence.
// A prompt never replaces fact auditing or the independent publication review.
function isRichMatch(record = {}) {
 return record.articleKind === 'match_report' &&
  (Boolean(record.matchEvidence) ||
   (Array.isArray(record.verifiedFacts) && record.verifiedFacts.length >= 5));
}
function allowedNumbers(facts = []) {
 return [...new Set(facts.flatMap(f => String(f).match(/\d+(?:[.,]\d+)?/g) || []))];
}
function allowedScores(facts = []) {
 return [...new Set(facts.flatMap(f => [...String(f).matchAll(/(?<![\d-])\b(\d{1,2})\s*[-–]\s*(\d{1,2})\b(?![-–]\d)/g)]
  .map(m => Number(m[1])+'-'+Number(m[2]))))];
}
// Give the language model a finite evidence allocation, not vague demands
// for 'more detail'. Fact IDs refer only to original verifiedFacts.
function paragraphPlan(record = {}) {
 const facts=Array.isArray(record.verifiedFacts)?record.verifiedFacts:[];
 const ids=facts.map((text,index)=>({id:'F'+(index+1),text:String(text)}));
 const event=ids.flatMap(fact=>{
  const moment=/\bminuut\s+(\d{1,3})(?:\+(\d{1,2}))?\b/.exec(fact.text);
  const registered=/^Volgens (?:de Sportmonks-wedstrijdregistratie|het officiële wedstrijdverslag)/.test(fact.text);
  return registered && moment ? [{...fact, order:Number(moment[1])*100+Number(moment[2]||0)}] : [];
 }).sort((a,b)=>a.order-b.order);
 const eventIds=new Set(event.map(fact=>fact.id));
 const context=ids.filter(x=>!eventIds.has(x.id)&&x.id!=='F1');
 if(!isRichMatch(record)) return {format:'compact',lead:['F1'],body:[{section:1,factIds:context.map(x=>x.id)}],events:event.length};
 const middle=Math.max(1,Math.ceil(event.length/2));
 // If structured event coverage is thin, the writer must skip rather than
 // repeat the final result or fabricate the missing body paragraphs.
 if(event.length<2) return {format:'insufficient',lead:['F1'],body:[],events:event.length};
 return {
  format:'rich',lead:['F1'],
  body:[
   {section:1,factIds:context.map(x=>x.id),angle:'Competition, date and verified half-time score; no score repetition'},
   {section:2,factIds:event.slice(0,middle).map(x=>x.id),angle:'Earlier verified goals and incidents in chronological order'},
   {section:3,factIds:event.slice(middle).map(x=>x.id),angle:'Later verified goals and incidents in chronological order'}
  ],
  events:event.length
 };
}
// Significant incidents are checked only when they are present in verified
// evidence. We never infer an incident from the final score or a headline.
const significantIncidentPatterns=[
 {type:'red_card',evidence:/\b(?:rode kaart|tweede gele kaart|rood gekregen|met tien man|met negen man|van het veld gestuurd)\b/i,copy:/\b(?:rode kaart|tweede gele kaart|rood|van het veld gestuurd|weggestuurd)\b/i},
 {type:'var',evidence:/\b(?:VAR|videoscheidsrechter|videoarbitrage)\b/i,copy:/\b(?:VAR|videoscheidsrechter|videoarbitrage)\b/i},
 {type:'interrupted_attack',evidence:/\bonderbrak (?:de scheidsrechter )?een kansrijke aanval\b/i,copy:/\b(?:onderbrak|stilgelegd|stillegde|floot|afgefloten|onderbroken)\b[^.!?]{0,110}\b(?:aanval|kans)\w*|\b(?:aanval|kans)\w*[^.!?]{0,110}\b(?:onderbrak|stilgelegd|stillegde|floot|afgefloten|onderbroken)\b/i},
 {type:'penalty',evidence:/\b(?:strafschop(?:moment)?|penalty)\b/i,copy:/\b(?:strafschop(?:moment)?|penalty)\b/i}
];
function verifiedIncidentCoverageIssues(record={},draft={}){
 if(!['match_report','score_update'].includes(record.articleKind))return [];
 const evidence=Array.isArray(record.verifiedFacts)?record.verifiedFacts:[];
 const text=[draft.headline,draft.standfirst,...(Array.isArray(draft.body)?draft.body:[])].filter(x=>typeof x==='string').join(' ');
 const issues=[];
 for(const rule of significantIncidentPatterns){
  // Do not let a bare mention of the VAR or a prospective red-card scenario
  // create an obligation. Facts should describe actual match incidents.
  const incident=evidence.some(f=>rule.evidence.test(String(f)));
  if(incident&&!rule.copy.test(text))
   issues.push('Bepalend geverifieerd wedstrijdincident ontbreekt in het artikel: '+rule.type+'. Beschrijf alleen de gecontroleerde gebeurtenis en de juiste bron.');
 }
 // Match each actor to the registered action. A scorer mentioned elsewhere
 // in the article does not cover that player's dismissal or missed penalty.
 const incidents=evidence.flatMap(fact=>{
  const card=/\bkreeg\s+([\p{L}.'’-]+(?:\s+[\p{L}.'’-]+){0,4}?)\s+(?:een directe rode kaart|een rode kaart|(?:een|zijn|haar|de) tweede gele kaart)\b/iu.exec(fact);
  if(card) return [{name:card[1], action:/tweede gele kaart/i.test(card[0]) ?
   /\b(?:tweede (?:gele kaart|keer geel)|twee (?:gele kaarten|keer geel))\b/i :
   /\b(?:rode kaart|(?:direct )?rood|weggestuurd|van het veld gestuurd)\b/i, label:'kaart'}];
  const penalty=/\bmiste\s+([\p{L}.'’-]+(?:\s+[\p{L}.'’-]+){0,4}?)\s+een strafschop\b/iu.exec(fact);
  return penalty?[{name:penalty[1],action:/\b(?:miste|misgeschoten|onbenut|gekeerd|keerde)\b/i,label:'gemiste strafschop'}]:[];
 });
 const normalized=t=>String(t).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const clauses=normalized(text).split(/[.!?;]|\ben\b(?=[^.!?;]{0,70}\b(?:kreeg|ontving|pakte|miste)\b)/i);
 for(const {name,action,label} of incidents){
  if(!clauses.some(clause=>clause.includes(normalized(name))&&action.test(clause)))
   issues.push('Geverifieerde '+label+' van '+name+' ontbreekt in het wedstrijdverslag.');
 }
 return [...new Set(issues)];
}
// Facts are allocated to separate verified paragraphs. Flag an event quoted in
// the wrong paragraph; do not invent missing events or change the article score.
function paragraphChronologyIssues(record = {},draft = {}) {
 const halfTimeIssues=require('./editorial-chronology139').halfTimeNarrativeIssues(record,draft);
 const plan=paragraphPlan(record);
 if(plan.format!=='rich'||!Array.isArray(draft.body)||draft.body.length!==plan.body.length)return [...new Set([...halfTimeIssues,...verifiedIncidentCoverageIssues(record,draft)])];
 const facts=Array.isArray(record.verifiedFacts)?record.verifiedFacts:[];
 const minutes=text=>[...String(text||'').matchAll(/\bminuut\s+(\d{1,2})(?:\+(\d{1,2}))?\b/gi)]
  .map(m=>m[1]+(m[2]?'+'+m[2]:''));
 const minutesFor=part=>part.factIds.flatMap(id=>minutes(facts[Number(id.slice(1))-1]));
 const known=new Set(plan.body.flatMap(minutesFor));
 const issues=[];
 plan.body.forEach((part,index)=>{
  const allowed=new Set(minutesFor(part));
  for(const minute of minutes(draft.body[index]))
   if(known.has(minute)&&!allowed.has(minute))
    issues.push('Geverifieerde minuut '+minute+' staat in de verkeerde bodyalinea. Houd de toegewezen wedstrijdchronologie aan.');
 });
 return [...new Set([...issues,...halfTimeIssues,...verifiedIncidentCoverageIssues(record,draft)])];
}
function writingPrompt(record = {}) {
 const rich = isRichMatch(record);
 const common = [
  'Je bent de onafhankelijke Nederlandstalige voetbalverslaggever van Veldio. Lever uitsluitend JSON met headline, standfirst en body als array van volledige Nederlandse alinea’s, of {"skip":true} wanneer een goed bericht feitelijk niet haalbaar is.',
  'Gebruik alleen verifiedFacts als bewijs voor beweringen. Match en sourceName helpen bij de identificatie maar leveren geen extra gebeurtenissen of interpretaties. URL’s zijn geen door jou gelezen bronnen.',
  'Controleer vóór het schrijven thuisploeg, uitploeg, eindstand en eventuele ruststand. Neem uitslagen en tussenstanden alleen letterlijk en in exact dezelfde thuis-uit-volgorde over uit verifiedFacts; reconstrueer nooit ontbrekende tussenstanden.',
  'Alle getallen, minuten, blessuretijd, jaartallen en rangnummers moeten letterlijk in verifiedFacts staan. allowedNumbers en allowedScores zijn slechts toegestane schrijfwijzen, geen extra bewijs voor een claim. Geen afgeleide minuut, bijvoorbeeld 7e of 8e, zonder dat deze expliciet is aangetoond.',
  'Gebruik alleen de exacte club- en spelersnamen die verifiedFacts vermeldt. Vermijd kunstmatige hoofdlettercombinaties, zelfbedachte afkortingen en namen zoals Het Eredivisieduel. Schrijf bijvoorbeeld "de wedstrijd" of "de ontmoeting".',
  'Beschrijf uitsluitend aantoonbare gebeurtenissen. Geen ongedocumenteerde kansen, assists, kaarten, wissels, tactiek, dominantie, blessure, VAR, supporters, ranglijstgevolgen, gevoelens, comeback of kwalificaties als verdiend, overtuigend of spectaculair. Als verifiedFacts wél rode kaarten, strafschoppen, VAR-besluiten of arbitrale incidenten bewijzen, moeten deze bepalende gebeurtenissen juist herkenbaar in het verslag terugkomen. Scheid feiten van kritiek; schrijf nooit dat een aanval zeker een doelpunt was.',
  'Vermeld broninformatie natuurlijk als "volgens de wedstrijdregistratie" waar dit bij een feit past. Presenteer niet alsof Veldio ter plaatse was. Geen letterlijk overgenomen brontekst, nepquotes of bronkoppen.',
  'De kop heeft 5-14 woorden. De intro heeft 8-35 woorden, noemt de gecontroleerde wedstrijd en uitslag en voegt geen onbewezen duiding toe. Introduceer iedere alinea met een ander geverifieerd detail. Vermijd herhaling van het scorefeit uit de intro en generieke slotzinnen.',
  'De door Veldio berekende paragraphPlan verdeelt uitsluitend bewezen F1/F2-feiten over de body. Gebruik de toegewezen factIds als harde grens voor iedere alinea. De planlabels zijn instructies, GEEN bewijsmateriaal. Een feit uit een andere sectie mag niet herhaald worden om lengte te maken.',
  'Schrijf uitsluitend wat in de feiten staat, niet wat typisch tijdens een wedstrijd kan zijn gebeurd. Een gelijke eindstand bewijst een gelijkspel; niet dat beide ploegen dominant waren. Een laatste doelpunt bewijst niet dat er daarna niet meer is aangevallen. Omschrijf niet dat iets tot minuut 90 onveranderd bleef zonder bron.',
  'Redactionele ordening: iedere bodyalinea heeft een eigen nieuwsfeit en nieuwe bewijsplaats uit haar factIds. Laat een tweede alinea nooit in andere woorden dezelfde tussenstand of doelpunten noemen als de voorgaande. Verbind alleen expliciet geregistreerde doelpunten in tijdsvolgorde; beschrijf geen fictieve fases of omslagmomenten. Vermijd score-opvulling, standaardopeningen en een generieke slotzin. Maak de eerste zin van elke alinea onmiddellijk concreet en controleerbaar.',
  'Bedenk intern vóór het schrijven de feiten per alinea. Controleer iedere zin tegen verifiedFacts en verwijder iedere onbewezen naam, cijfer, tijdsaanduiding of oorzaak. Geef het feitenplan niet uit als JSON.',
  'Bij onvoldoende onafhankelijke feiten voor het vereiste formaat is skip verplicht. Maak het artikel niet langer met speculatie of opvulling. Verlaag nooit redactionele normen. Publiceer niet zelf.'
 ];
 const form = rich ? [
  'Schrijf een inhoudelijk rijk wedstrijdverslag met EXACT DRIE bodyalinea’s, ieder 18-120 woorden en minimaal 70 tekens. Dit is GEEN compact uitslagbericht. Gebruik een eigen zakelijke nieuwsstijl, geen sjabloonachtige vulzinnen.',
  'Volg de drie afzonderlijke bodysecties in paragraphPlan: 1 context, ruststand en expliciet geverifieerde niet-doelpuntincidenten, 2 eerdere gedocumenteerde doelpunten en incidenten, 3 latere gedocumenteerde doelpunten en incidenten. Verzwijg geen geverifieerde rode kaart, strafschop of VAR-controverse uit de toegewezen feiten. Elke alinea behandelt uitsluitend de aldaar toegewezen feiten. Schrijf geen vierde of vijfde alinea. Als een sectie onvoldoende feiten bevat voor 18 zinvolle woorden is skip verplicht.',
  'Een goal-timeline bewijst uitsluitend de genoemde minuut, speler, soort doelpunt en direct daarbij geregistreerde stand. Een ruststand bewijst niets over kansen of spelbeeld. Verbind gebeurtenissen niet met fictieve causaliteit.',
  'Schrijf in ten minste één bodyalinea ondubbelzinnig: volgens de Sportmonks-wedstrijdregistratie, als Sportmonks de bron is. Herhaal die bron niet na iedere doelpuntzin. Noem uitsluitend de expliciet geregistreerde momenten en scores, en herschik zinnen zelfstandig zonder de vaste bronzin "viel in minuut ... waarna de stand ... was" over te nemen.',
  'Een gebeurtenis op 45+3 valt vóór de rust en een gebeurtenis op 47 valt ná de rust. Schrijf bij die overgang expliciet dat de rust tussendoor viel, nooit dat beide gebeurtenissen twee minuten na elkaar plaatsvonden. De ruststand is een harde chronologische grens.',
  'Gebruik NOOIT een berekend tijdsverschil als "drie minuten later", "zes minuten daarna" of "vlak daarna". Verbind gebeurtenissen alleen met afzonderlijk vastgelegde minuten. Een twee-doelpunten-achterstand en het ombuigen daarvan mogen uitsluitend worden beschreven als een aparte afgeleide verificatiefact in verifiedFacts dat uit een complete gecontroleerde doelpuntenreeks is opgesteld. Anders geen achterstand- of comebacktaal.'
 ] : [
  'Schrijf een compact uitslagbericht: body bevat EXACT ÉÉN inhoudelijke alinea van 10-65 woorden, mits dit zonder herhaling of fictie kan. Dit is GEEN langwedstrijdverslag.',
  'Gebruik de body alleen voor geverifieerde datum, competitie, speelronde, een expliciet bevestigde ruststand en bepalende geverifieerde wedstrijdincidenten. Zonder zulke aanvullende feiten: {"skip":true}.'
 ];
 return [...common,...form].join(' ');
}
function revisionPrompt(record = {}) {
 return writingPrompt(record) + ' Dit is een VOLLEDIGE NIEUWE VERSIE na een afkeuring. Het afgekeurde concept is bewust niet beschikbaar. Gebruik rejection uitsluitend als waarschuwing over eerdere fouten, nooit als bron voor nieuwe feiten. Repareer lage journalistieke kwaliteit met afzonderlijke bewezen feiten per alinea. Repareer lage originaliteit met een nieuwe eigen informatievolgorde en zinsbouw, nooit met verzonnen analyse, extra feit of bronkop. Controleer alle numerieke claims en tussenstanden vóór het antwoord opnieuw tegen verifiedFacts en allowedScores. Behoud het juiste rijke of compacte formaat. Neem geen eerdere beoordeling of goedkeuringsscore over. Als de afwijzing niet zonder nieuwe feiten te herstellen is: {"skip":true}.';
}
module.exports = {isRichMatch,allowedNumbers,allowedScores,paragraphPlan,paragraphChronologyIssues,verifiedIncidentCoverageIssues,writingPrompt,revisionPrompt};
