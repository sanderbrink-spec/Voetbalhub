'use strict';

// P3/102F: source quotations remain in the reviewer ledger, not the writer's
// prose context. Only call this after the official KNVB/UEFA evidence gate.
function drawWritingBrief(facts) {
 if (!Array.isArray(facts) || facts.length < 4 || facts.length > 10 ||
     facts.some(x => typeof x !== 'string')) return null;
 const find = pattern => facts.find(x => pattern.test(x)) || '';
 const event = find(/^(?:Oranje|Nederland) speelt in de kwartfinale van de Nations League (?:twee keer )?tegen /u);
 const opponent = /\btegen ([\p{Lu}][\p{L} -]+)\./u.exec(event)?.[1]?.trim();
 const drawing = find(/^Dat werd (?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag) bepaald tijdens de loting in /u);
 const draw = /^Dat werd (maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag) bepaald tijdens de loting in ([\p{L} -]+)(?:,\s*([\p{L} -]+))?\.$/u.exec(drawing);
 const schedule = find(/^De wedstrijden (?:worden in [\p{L}]+ gespeeld|vinden in [\p{L}]+ plaats)\.$/u);
 const month = /^De wedstrijden (?:worden in|vinden in) ([\p{L}]+) (?:gespeeld|plaats)\.$/u.exec(schedule)?.[1];
 const locations = find(/^De eerste wedstrijd is in Nederland, de return wordt gespeeld in /u);
 const away = /^De eerste wedstrijd is in Nederland, de return wordt gespeeld in ([\p{L} -]+)\./u.exec(locations)?.[1]?.trim();
 if (!opponent || !draw || !month || !away || opponent !== away) return null;
 const conditional = find(/^In een eventuele halve finale treft Oranje de winnaar van het duel tussen /u);
 const semis = conditional ? /^In een eventuele halve finale treft Oranje de winnaar van het duel tussen ([\p{L} -]+) en ([\p{L} -]+)\./u.exec(conditional) : null;
 if (conditional && !semis) return null;
 // The added context is admitted only when the original UEFA wording
 // describes this same opponent and a provable tournament consequence.
 const translated={Spanje:'Spain',Frankrijk:'France',Duitsland:'Germany',
  Engeland:'England',België:'Belgium',Noorwegen:'Norway',
  Italië:'Italy',Kroatië:'Croatia',Denemarken:'Denmark',Zwitserland:'Switzerland'};
 const titleholder=find(/^Netherlands take on titleholders [A-Za-z -]+$/u);
 const titleCountry=/^Netherlands take on titleholders ([A-Za-z -]+)$/u.exec(titleholder)?.[1];
 if(titleholder && titleCountry!==(translated[opponent]||opponent))return null;
 const leg=find(/^The quarter-finals are two-legged ties and take place in March 20\d{2}\.$/u);
 const year=/^The quarter-finals are two-legged ties and take place in March (20\d{2})\.$/u.exec(leg)?.[1];
 if(year && month!=='maart')return null;
 const finals=find(/^Winners advance to the Nations League finals\.$/u);
 const dutchProfile=find(/^Netherlands.{0,350}How they qualified: Group A2 runners-up$/u);
 const portugalProfile=find(/^Portugal.{0,350}How they qualified: Group A4 winners(?: Best Nations League performance: Winners \(2018\/19, 2024\/25\))?$/u);
 if(Boolean(dutchProfile)!==Boolean(portugalProfile))return null;
 const byId = x => 'F' + (facts.indexOf(x) + 1);
 const cards = [
  {id:byId(event),role:'lotingsbesluit',land:'Nederland',tegenstander:opponent,ronde:'kwartfinale',competitie:'Nations League',duels:2},
  {id:byId(locations),role:'speelvolgorde',eersteDuel:'Nederland thuis',return:opponent+' thuis'},
  {id:byId(schedule),role:'speelperiode',maand:month},
  {id:byId(drawing),role:'loting',dag:draw[1],plaats:draw[2],...(draw[3]?{land:draw[3]}:{})}
 ];
 if (semis) cards.push({id:byId(conditional),role:'uitsluitend voorwaardelijk vervolg',voorwaarde:'alleen bij bereiken halve finale',tegenstander:'winnaar van '+semis[1]+' tegen '+semis[2]});
 if(titleholder)cards.push({id:byId(titleholder),role:'sportieve inzet',gegeven:opponent+' is de regerend Nations League-winnaar'});
 if(leg)cards.push({id:byId(leg),role:'officiële UEFA-speelperiode',maand:'maart',jaar:Number(year),vorm:'heen- en terugwedstrijd'});
 if(finals)cards.push({id:byId(finals),role:'sportief toernooigevolg',gegeven:'winnaar kwartfinale plaatst zich voor de Nations League-finaleronde'});
 if(dutchProfile)cards.push({id:byId(dutchProfile),role:'Nederlandse groepsfase',gegeven:'Nederland eindigde als tweede in groep A2'});
 if(portugalProfile)cards.push({id:byId(portugalProfile),role:'Portugese groepsfase',gegeven:'Portugal won groep A4',
  ...(portugalProfile.includes('Winners (2018/19, 2024/25)')?{nationsLeagueTitels:['2018/19','2024/25']}: {})});
 if (new Set(cards.map(x=>x.id)).size !== cards.length || cards.length !== facts.length) return null;
 return {
  factCards:cards,
  plan:dutchProfile?{
   opening:[byId(event),...(titleholder?[byId(titleholder)]:[]),byId(drawing)],
   alinea1:[byId(dutchProfile),byId(portugalProfile)],
   alinea2:[byId(locations),byId(schedule),...(leg?[byId(leg)]:[])],
   alinea3:[...(finals?[byId(finals)]:[]),...(semis?[byId(conditional)]:[])]
  }:{
   opening:[byId(event),...(titleholder?[byId(titleholder)]:[])],
   alinea1:[byId(locations),byId(schedule),...(leg?[byId(leg)]:[])],
   alinea2:[byId(drawing),...(semis?[byId(conditional)]:[]),...(finals?[byId(finals)]:[])]
  },
  forbiddenInference:['geen exacte speeldatum','geen uitslag','geen automatische halvefinaleplaats','geen zelfbedachte tegenstander']
 };
}
module.exports = {drawWritingBrief};
