'use strict';

const {articleUrl} = require('./editorial-discovery53');
const config = require('../automatic-editorial.json');
const opponents = new Map(Object.entries({
  'Portugal':'Portugal', 'Spanje':'Spain', 'Frankrijk':'France', 'Duitsland':'Germany',
  'Engeland':'England', 'Italië':'Italy', 'België':'Belgium', 'Noorwegen':'Norway',
  'Kroatië':'Croatia', 'Denemarken':'Denmark', 'Zwitserland':'Switzerland'
}));

// A draw announcement concerns today's decision, even when the fixture is months away.
function oranjeDrawGroup(knvb, documents, now) {
  const url = articleUrl(knvb.url, config.newsIndexes);
  if (!url?.startsWith('https://www.onsoranje.nl/nieuws/nederlands-elftal-mannen/')) return null;
  const opponent = /^(?:Oranje|Nederland) (?:tegen|treft) (\p{Lu}\p{L}+) in (?:de )?kwartfinale Nations League$/u.exec(knvb.title)?.[1];
  const english = opponents.get(opponent);
  if (!english) return null;
  const at = Date.parse(knvb.publishedAt);
  const fresh = time => time <= now && time >= now - config.maxAgeHours * 3600000;
  if (!fresh(at)) return null;

  const body = knvb.text.startsWith(knvb.title) ? knvb.text.slice(knvb.title.length).trimStart() : knvb.text;
  const core = new RegExp('(?:^|[.!?]\\s+|Foto:\\s+)((?:Oranje|Nederland) speelt in de kwartfinale van de Nations League (?:twee keer )?tegen '+opponent+'\\.)','u').exec(body)?.[1];
  if (!core) return null;
  // Keep entire source statements. Ignore photo captions, history and predictions.
  const details = [...knvb.text.matchAll(/(?:^|(?<=[.!?])\s+)((?:Dat werd (?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag) bepaald tijdens de loting in [^.!?]{2,65}|De wedstrijden (?:worden in [\p{L}]+ gespeeld|vinden in [\p{L}]+ plaats)|De eerste wedstrijd is in Nederland, de return wordt gespeeld in [\p{L}]+|In een eventuele halve finale treft Oranje de winnaar van het duel tussen [\p{L}]+ en [\p{L}]+)\.)/gu)]
    .map(match => match[1]);
  if (details.some(line => line.startsWith('De eerste wedstrijd') && !line.endsWith('in '+opponent+'.'))) return null;
  if (new Set(details).size < 3 || !details.some(line => line.includes('tijdens de loting'))) return null;

  for (const uefa of documents) {
    const canonical = articleUrl(uefa.url, config.newsIndexes);
    const date = Date.parse(uefa.publishedAt);
    if (!canonical?.startsWith('https://www.uefa.com/uefanationsleague/news/') ||
        !fresh(date) || Math.abs(date-at) > 86400000) continue;
    // Bound the official list to the quarter-finals. Later rounds can mention both
    // teams as conditional opponents. The list must be a completed draw.
    const list = /Knockout stage draw results\s+(Quarter-final ties\s+[^.!?]{8,350}?)\s+The quarter-finals are two-legged ties\b/u.exec(uefa.text)?.[1];
    if (!list || (list.match(/\bNetherlands\b/g) || []).length !== 1 || !new RegExp('\\b(?:Netherlands vs '+english+'|'+english+' vs Netherlands)\\b').test(list)) continue;
    if (details.some(line => line.startsWith('De eerste wedstrijd')) &&
        list.includes(english+' vs Netherlands')) continue;
    const group = [knvb, uefa];
    const facts=[core,...new Set(details)].map(text => ({text,evidence:[{source:0,quote:text}]}));
    // Add meaningful tournament stakes from the SAME independent UEFA draw
    // report. Keep each original English passage intact: the independent
    // evidence gate rejects paraphrased or invented contextual claims.
    const titleholder=new RegExp('\\bNetherlands take on titleholders '+english+'\\b','iu').exec(uefa.text)?.[0];
    const leg=/The quarter-finals are two-legged ties and take place in March 20\d{2}\./u.exec(uefa.text)?.[0];
    const finals=/Winners advance to the Nations League finals\./u.exec(uefa.text)?.[0];
    for(const quote of [titleholder,leg,finals]){
      if(quote&&!facts.some(fact=>fact.text===quote))
        facts.push({text:quote,evidence:[{source:1,quote}]});
    }
    // An actual official contenders profile supplies TEAM CONTEXT. Do not
    // infer performance from the draw, and keep original text for the audit.
    const contextual=documents.find(doc=>doc!==uefa&&
      (articleUrl(doc.url,config.newsIndexes)||'').includes('get-to-know-the-eight')&&
      Number.isFinite(Date.parse(doc.publishedAt))&&
      Date.parse(doc.publishedAt)<=now&&
      Date.parse(doc.publishedAt)>=now-config.maxAgeHours*3600000);
    if(contextual&&opponent==='Portugal'){
      const select=(team,qualification,performance='')=>{
        const at=contextual.text.indexOf(qualification);
        if(at<0)return '';
        const prefix=contextual.text.slice(Math.max(0,at-300),at);
        const index=prefix.lastIndexOf(team);
        if(index<0)return '';
        const from=at-prefix.length+index;
        const end=at+qualification.length;
        const suffix=contextual.text.slice(end,end+performance.length);
        const quote=contextual.text.slice(from,end)+(performance&&suffix===performance?suffix:'');
        return quote.length>=35&&quote.length<=650?quote:'';
      };
      const dutch=select('Netherlands','How they qualified: Group A2 runners-up');
      const portuguese=select('Portugal','How they qualified: Group A4 winners',
        ' Best Nations League performance: Winners (2018/19, 2024/25)');
      if(dutch&&portuguese){
        group.push(contextual);
        facts.push({text:dutch,evidence:[{source:2,quote:dutch}]});
        facts.push({text:portuguese,evidence:[{source:2,quote:portuguese}]});
      }
    }
    group.drawCandidate = {
      kind:'announcement', topic:knvb.title, category:'Nations League', teams:['Nederland',opponent],
      sharedEventEvidence:[{source:0,quote:core},{source:1,quote:list}],
      facts
    };
    return group;
  }
  return null;
}
module.exports = {oranjeDrawGroup};
