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
      (articleUrl(doc.url,config.newsIndexes)||'').startsWith('https://www.uefa.com/uefanationsleague/news/')&&
      (articleUrl(doc.url,config.newsIndexes)||'').includes('get-to-know-the-eight')&&
      Number.isFinite(Date.parse(doc.publishedAt))&&
      Date.parse(doc.publishedAt)<=now&&
      Date.parse(doc.publishedAt)>=now-config.maxAgeHours*3600000);
    group.profileDiagnostics={
      candidateFound:Boolean(contextual),
      articleCharacters:contextual?.text?.length||0,
      dutchGroupSeen:Boolean(contextual?.text?.includes('Group A2 runners-up')),
      portugalGroupSeen:Boolean(contextual?.text?.includes('Group A4 winners'))
    };
    if(contextual&&opponent==='Portugal'){
      // A long UEFA article may mention a group position in an earlier
      // summary before the actual team's section. Inspect every exact match,
      // not just indexOf's first hit. Keep a short, literal evidence quote:
      // the independent reviewer must still find it in this source.
      const select=(team,qualification,performance='')=>{
        const normalized=String(contextual.text||'').replace(/\s+/gu,' ');
        const target=qualification.slice('How they qualified: '.length);
        // Live UEFA HTML has <b>How they qualified</b>: Group ...
        // The HTML-to-text sanitizer inserts a space before the colon.
        // Match the original punctuation as printed, then retain exact
        // characters in the source evidence quote for independent validation.
        const hits=[...normalized.matchAll(/How they qualified\s*:\s*Group A[1-4] (?:runners-up|winners)/gu)]
          .filter(hit=>hit[0].replace(/^How they qualified\s*:\s*/u,'')===target);
        for(const hit of hits){
          const at=hit.index;
          const prefix=normalized.slice(Math.max(0,at-350),at);
          const mentions=[...prefix.matchAll(new RegExp('(?:^|\\s)'+team+'(?=\\s|$)','g'))];
          for(let index=mentions.length-1;index>=0;index--){
            const mention=mentions[index];
            const from=at-prefix.length+mention.index+(mention[0].startsWith(' ')?1:0);
            // Never cross a preceding team-specific qualification, even
            // when the earlier section mentions the target country's name.
            if(/How they qualified\s*:/iu.test(normalized.slice(from,at)))continue;
            const end=at+hit[0].length;
            const suffix=performance
              ?normalized.slice(end).match(/^ Best Nations League performance\s*:\s*Winners \(2018\/19, 2024\/25\)/u)?.[0]||''
              :'';
            const quote=normalized.slice(from,end)+suffix;
            if(quote.length>=35&&quote.length<=350)return quote;
          }
        }
        return '';
      };
      const dutch=select('Netherlands','How they qualified: Group A2 runners-up');
      const portuguese=select('Portugal','How they qualified: Group A4 winners',
        ' Best Nations League performance: Winners (2018/19, 2024/25)');
      group.profileDiagnostics.netherlandsSectionExtracted=Boolean(dutch);
      group.profileDiagnostics.portugalSectionExtracted=Boolean(portuguese);
      if(dutch&&portuguese){
        group.profileDiagnostics.attached=true;
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
