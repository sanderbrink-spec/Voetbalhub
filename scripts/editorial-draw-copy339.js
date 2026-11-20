'use strict';

// P3/102F: source quotations remain in the reviewer ledger, not the writer's
// prose context. Only call this after the official KNVB/UEFA evidence gate.
function drawWritingBrief(facts) {
 if (!Array.isArray(facts) || facts.length < 4 || facts.length > 8 ||
     facts.some(x => typeof x !== 'string')) return null;
 const find = pattern => facts.find(x => pattern.test(x)) || '';
 const event = find(/^(?:Oranje|Nederland) speelt in de kwartfinale van de Nations League (?:twee keer )?tegen /u);
 const opponent = /\btegen ([\p{Lu}][\p{L} -]+)\./u.exec(event)?.[1]?.trim();
 const drawing = find(/^Dat werd (?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag) bepaald tijdens de loting in /u);
 const draw = /^Dat werd (maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag) bepaald tijdens de loting in ([\p{L} -]+)\./u.exec(drawing);
 const schedule = find(/^De wedstrijden worden in [\p{L}]+ gespeeld\./u);
 const month = /^De wedstrijden worden in ([\p{L}]+) gespeeld\./u.exec(schedule)?.[1];
 const locations = find(/^De eerste wedstrijd is in Nederland, de return wordt gespeeld in /u);
 const away = /^De eerste wedstrijd is in Nederland, de return wordt gespeeld in ([\p{L} -]+)\./u.exec(locations)?.[1]?.trim();
 if (!opponent || !draw || !month || !away || opponent !== away) return null;
 const conditional = find(/^In een eventuele halve finale treft Oranje de winnaar van het duel tussen /u);
 const semis = conditional ? /^In een eventuele halve finale treft Oranje de winnaar van het duel tussen ([\p{L} -]+) en ([\p{L} -]+)\./u.exec(conditional) : null;
 if (conditional && !semis) return null;
 const byId = x => 'F' + (facts.indexOf(x) + 1);
 const cards = [
  {id:byId(event),role:'lotingsbesluit',land:'Nederland',tegenstander:opponent,ronde:'kwartfinale',competitie:'Nations League',duels:2},
  {id:byId(locations),role:'speelvolgorde',eersteDuel:'Nederland thuis',return:opponent+' thuis'},
  {id:byId(schedule),role:'speelperiode',maand:month},
  {id:byId(drawing),role:'loting',dag:draw[1],plaats:draw[2]}
 ];
 if (semis) cards.push({id:byId(conditional),role:'uitsluitend voorwaardelijk vervolg',voorwaarde:'alleen bij bereiken halve finale',tegenstander:'winnaar van '+semis[1]+' tegen '+semis[2]});
 if (new Set(cards.map(x=>x.id)).size !== cards.length || cards.length !== facts.length) return null;
 return {
  factCards:cards,
  plan:{opening:[byId(event)],alinea1:[byId(locations),byId(schedule)],
   alinea2:[byId(drawing),...(semis?[byId(conditional)]:[])]},
  forbiddenInference:['geen exacte speeldatum','geen uitslag','geen automatische halvefinaleplaats','geen zelfbedachte tegenstander']
 };
}
module.exports = {drawWritingBrief};
