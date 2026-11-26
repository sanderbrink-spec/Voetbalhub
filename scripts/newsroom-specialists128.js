'use strict';
// 50 functional editorial roles, routed through the existing ten scout channels.
// A role assignment is not an independent model invocation or source verification.
const R=(id,desk,name,pattern,task)=>Object.freeze({id,desk,name,pattern,task});
const club=(id,name,pattern)=>R(id,'clubs',name,pattern,'Controleer de officiële clubbron, juiste eerste elftal, betrokken persoon en datum; scheid clubbesluit van mediabericht.');
const international=(id,name,pattern,task)=>R(id,'international',name,pattern,task);
const ROLES=Object.freeze([
 club('nl-groningen','FC Groningen',/\b(?:fc groningen|groningers|euroborg|lukkien)\b/i),
 club('nl-psv','PSV',/\b(?:psv|philips stadion|bosz)\b/i),
 club('nl-ajax','Ajax',/\b(?:ajax|ajacieden|jong ajax)\b/i),
 club('nl-feyenoord','Feyenoord',/\b(?:feyenoord|de kuip)\b/i),
 club('nl-az','AZ',/\b(?:az|az alkmaar)\b/i),
 club('nl-twente','FC Twente',/\b(?:fc twente|tukkers|grolsch veste)\b/i),
 club('nl-utrecht','FC Utrecht',/\b(?:fc utrecht|galgenwaard)\b/i),
 club('nl-nec','NEC',/\b(?:nec|n\.e\.c\.|goffert)\b/i),
 club('nl-heerenveen','SC Heerenveen',/\b(?:heerenveen|abe lenstra)\b/i),
 club('nl-sparta','Sparta Rotterdam',/\b(?:sparta|spangen)\b/i),
 club('nl-gae','Go Ahead Eagles',/\b(?:go ahead eagles|adelaarshorst)\b/i),
 club('nl-pec','PEC Zwolle',/\b(?:pec zwolle|pec)\b/i),
 club('nl-fortuna','Fortuna Sittard',/\b(?:fortuna sittard|fortunezen)\b/i),
 club('nl-heracles','Heracles Almelo',/\bheracles\b/i),
 club('nl-excelsior','Excelsior',/\bexcelsior\b/i),
 club('nl-nac','NAC Breda',/\b(?:nac|nac breda)\b/i),
 club('nl-volendam','FC Volendam',/\bvolendam\b/i),
 club('nl-telstar','Telstar',/\btelstar\b/i),
 international('int-england','Engeland',/\b(?:premier league|championship|fa cup|arsenal|liverpool|manchester (?:city|united)|chelsea|tottenham|newcastle)\b/i,'Controleer Engelse club- en competitiebronnen, tijdzone en exacte competitie.'),
 international('int-spain','Spanje',/\b(?:la liga|laliga|real madrid|barcelona|atl[eé]tico madrid|copa del rey|valencia|sevilla)\b/i,'Controleer Spaanse club- en bondspublicaties; onderscheid eerste elftal en jeugd.'),
 international('int-germany','Duitsland',/\b(?:bundesliga|bayern|dortmund|leverkusen|dfb.pokal|rb leipzig)\b/i,'Controleer Duitse club- en competitiepublicaties en de juiste divisie.'),
 international('int-italy','Italië',/\b(?:serie a|juventus|ac milaan|ac milan|inter milaan|napoli|as roma|coppa italia)\b/i,'Controleer Italiaanse primaire bronnen en de exacte clubidentiteit.'),
 international('int-france','Frankrijk',/\b(?:ligue 1|paris saint.germain|psg|marseille|olympique lyon|coupe de france)\b/i,'Controleer Franse club- en competitiepublicaties, datum en oorspronkelijke melder.'),
 international('int-belgium','België',/\b(?:jupiler pro league|club brugge|anderlecht|genk|union sint.gillis|standard luik)\b/i,'Controleer Belgische competitie, clubnaam en eventuele play-offvoorwaarden.'),
 international('int-portugal','Portugal',/\b(?:primeira liga|benfica|sporting (?:cp|lissabon)|fc porto)\b/i,'Controleer Portugese primaire bronnen en eventuele contractstatus.'),
 international('int-europe','Overig Europees clubvoetbal',/\b(?:super lig|galatasaray|fenerbahce|olympiakos|celtic|rangers|eredivisie van schotland|ekstraklasa)\b/i,'Identificeer eerst land, competitie en club; gebruik alleen toegestane bronnen.'),
 international('int-uefa','Europese clubtoernooien',/\b(?:champions league|europa league|conference league|uefa)\b/i,'Controleer UEFA-wedstrijdstatus, loting, deelnemers en doorgangsvoorwaarden.'),
 international('int-oranje','Nederlands elftal',/\b(?:oranje|nederlands elftal|knvb|bondscoach)\b/i,'Controleer KNVB/OnsOranje, seniorenteam, selectie en officiële tegenstander.'),
 international('int-national','Internationale landenteams',/\b(?:interland|nations league|wereldkampioenschap|wk kwalificatie|ek kwalificatie|copa am[eé]rica|afrika cup|fifa)\b/i,'Controleer bond en organisator; onderscheid loting, kwalificatie en gespeeld duel.'),
 international('int-world','Voetbal buiten Europa',/\b(?:mls|inter miami|libertadores|brasileir[aã]o|boca juniors|river plate|saudi pro league|al nassr|j.league|afc champions league)\b/i,'Controleer land, bond, lokaal tijdstip en primaire bronnen; geen automatische bronautorisatie.'),
 R('tr-rumour','transfers','Transfergeruchten',/\b(?:gerucht|geruchten|interesse|belangstelling|in de belangstelling|linked|reportedly)\b/i,'Traceer eerste melder, afhankelijkheid tussen media en concrete onbevestigde handeling.'),
 R('tr-bid','transfers','Biedingen en onderhandelingen',/\b(?:bod|bieding|onderhandeling\w*|gesprekken|persoonlijk akkoord)\b/i,'Onderscheid contact, bod, persoonlijk akkoord en clubakkoord; vraag naar onafhankelijk bewijs.'),
 R('tr-confirmed','transfers','Officiële transfers',/\b(?:transfer|overstap|aanwinst|tekent|getekend|verhuurd|huurovereenkomst)\b/i,'Controleer beide clubs, ingangsdatum en contractstatus; nooit bevestigen op basis van koppen.'),
 R('tr-contract','transfers','Contracten en clausules',/\b(?:contract|contractverlenging|clausule|transfervrij|optiejaar)\b/i,'Controleer exacte contracttermijn, bekendmakingsdatum en letterlijk vastgelegde clausules.'),
 R('tr-market','transfers','Transfermarkt en financiële context',/\b(?:transfermarkt|transfersom|marktwaarde|transferbudget|doorverkooppercentage)\b/i,'Scheid gemelde transfersommen, officiële bedragen en schattingen; geen bedragen afleiden.'),
 R('data-match','data','Wedstrijdanalyse',/\b(?:wedstrijd|duel|uitslag|doelpunt|schoten|balbezit|wedstrijdanalyse)\b/i,'Koppel gecontroleerde fixture-ID, thuis-uitvolgorde, eindstatus en feitelijke wedstrijdstatistieken.'),
 R('data-table','data','Standen en competitieanalyse',/\b(?:ranglijst|stand|punten|degradatie|promotie|kampioen|titelstrijd)\b/i,'Controleer volledige standen, geldige competitieregels en onderscheid feit van scenario.'),
 R('data-player','data','Spelersprestatie',/\b(?:assists|topscorer|spelersstatistieken|speelminuten|rendement|xg|expected goals)\b/i,'Controleer speler-ID, periode, competitie, meetdefinitie en datadekking.'),
 R('data-squad','data','Selecties en beschikbaarheid',/\b(?:selectie|opstelling|basiselftal|blessure|schorsing|afwezigheid)\b/i,'Onderscheid bevestigde selectie van verwachte opstelling; geen medische gevolgtrekkingen.'),
 R('data-calendar','data','Kalender en vooruitblik',/\b(?:voorbeschouwing|aftrap|speelronde|programma|komend duel|wedstrijdschema)\b/i,'Verifieer aanvang, tijdzone, deelnemers, wedstrijdstatus en geplande vervolgcontrole.'),
 R('hist-record','history','Records en reeksen',/\b(?:record|records|reeks|recordreeks|mijlpaal)\b/i,'Controleer complete vergelijkingsperiode en recorddefinitie voordat een historische claim ontstaat.'),
 R('hist-career','history','Loopbanen en terugkeer',/\b(?:terugkeer|terugkeert|oud.speler|voormalige club|loopbaan|hereniging)\b/i,'Verifieer speler- of traineridentiteit en geldigheidsdatums van oude clubrelaties.'),
 R('hist-club','history','Clubgeschiedenis',/\b(?:clubgeschiedenis|jubileum|oprichting|historisch|historie)\b/i,'Controleer historische clubidentiteit, datum en oorspronkelijke archiefbron.'),
 R('hist-rivalry','history','Derby’s en onderlinge historie',/\b(?:derby|klassieker|rivaliteit|onderlinge duels|onderling resultaat)\b/i,'Controleer specifieke ontmoetingen, competitie en relevante vergelijkingsperiode.'),
 R('inv-sources','investigation','Brononderzoek en tegenspraak',/\b(?:ontkent|ontkracht|tegenspraak|tegenstrijdig|weerlegt)\b/i,'Vergelijk afzonderlijke uitspraken over dezelfde entiteit, handeling en datum.'),
 R('inv-governance','investigation','Bestuur, regels en integriteit',/\b(?:bestuur|directeur|licentie|tuchtcommissie|onderzoek|schorsingsvoorstel|regelwijziging)\b/i,'Controleer bevoegd gezag, letterlijke beslissing, processtatus en wederhoor.'),
 R('inv-followup','investigation','Vervolgverhalen en algemene onderzoeksdesk',/\b(?:vervolg|achtergrond|ontwikkelingen|nieuws)\b/i,'Bepaal wat aantoonbaar nieuw is, welk bewijs nog ontbreekt en welk controlepunt volgt.'),
 R('check-evidence','review','Feiten en brononafhankelijkheid',null,'De bestaande onafhankelijke bewijscontrole blijft beslissend: identiteit, tijd, bron en kernclaim controleren.'),
 R('check-quality','review','Journalistiek en rechten',null,'De bestaande onafhankelijke eindcontrole bewaakt originaliteit, beeldrechten en 85/90-normen.'),
 R('chief','chief','Hoofdredacteur',null,'Eén eigenaar per dossier; prioriteit, beschikbare capaciteit en bestaande publicatiepoorten bewaken.')
]);
const counts=()=>Object.fromEntries([...new Set(ROLES.map(r=>r.desk))].map(d=>[d,ROLES.filter(r=>r.desk===d).length]));
function assign(group={}){
 const text=[group.subject,...(Array.isArray(group.sources)?group.sources.slice(0,5).map(s=>s?.title):[])]
  .filter(s=>typeof s==='string').map(s=>s.slice(0,200)).join(' ');
 const hits=ROLES.filter(r=>r.pattern?.test(text));
 const pick=id=>ROLES.find(r=>r.id===id);
 const transfer=hits.filter(r=>r.desk==='transfers');
 const preferred=group.contradictory===true?pick('inv-sources'):
  (group.rumour===true&&transfer.length?transfer.find(r=>r.id==='tr-rumour')||transfer[0]:
   hits.find(r=>r.desk==='investigation')||transfer[0]||hits.find(r=>r.desk==='history')||
   hits.find(r=>r.desk==='clubs')||hits.find(r=>r.desk==='international')||hits.find(r=>r.desk==='data')||pick('inv-followup'));
 // Exactly one owner. Other specialists supply distinct checks inside the
 // same existing request. Never represent them as independent reviewers.
 const support=hits.filter(r=>r.id!==preferred.id);
 const selected=[];
 for(const desk of ['data','history','transfers','international','clubs','investigation']){
  const r=support.find(x=>x.desk===desk);
  if(r&&selected.length<2)selected.push(r);
 }
 if(selected.length<2){
  const r=support.find(x=>!selected.includes(x));
  if(r)selected.push(r);
 }
 return {owner:preferred.id,support:selected.map(r=>r.id),
  reviewRoute:['check-evidence','check-quality'],chief:'chief',
  independentReviewPerformed:false,publicationAllowed:false};
}
function brief(assignment){
 const ids=[assignment.owner,...assignment.support];
 const tasks=ids.map(id=>ROLES.find(r=>r.id===id)).filter(Boolean);
 return ['TAAKVERDELING 128: één verantwoordelijke specialist en maximaal twee aanvullende vakcontroles.',
  ...tasks.map((r,i)=>(i?'Aanvullende controle: ':'Verantwoordelijke specialist: ')+r.name+'. '+r.task),
  'Dit is één interne modelaanroep, geen onafhankelijk bewijs of uitgevoerde factcheck. Onafhankelijke eindcontrole en publicatiebesluit blijven in de bestaande redactie.'].join('\n');
}
function coverage(groups=[],notes=[]){
 const planned=groups.map(assign),tally=new Map();
 for(const p of planned)for(const id of [p.owner,...p.support])tally.set(id,(tally.get(id)||0)+1);
 const completed=notes.filter(n=>n.status==='analysis_only_unverified'&&n.deskAssignment?.owner);
 return {configuredRoles:ROLES.length,byDesk:counts(),plannedDossiers:planned.length,
  rolesAssigned:tally.size,roleAssignments:ROLES.map(r=>({id:r.id,desk:r.desk,assigned:tally.get(r.id)||0})),
  completedModelNotes:completed.length,modelOwners:[...new Set(completed.map(n=>n.deskAssignment.owner))],
  independentReviewPerformedByRouter:false,additionalModelCalls:0};
}
module.exports={ROLES,counts,assign,brief,coverage};
