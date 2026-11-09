'use strict';

// A stoppage-time minute 45+3 belongs to the first half; minute 47 to the second.
// Relative interval claims spanning that break must never be calculated.
const relativeInterval=/\b(?:[\p{L}]+|\d+)\s+minut(?:en|e)\s+(?:later|daarna|verder)\b/iu;
const firstHalf=/\b(?:blessuretijd\s+(?:van\s+)?(?:de\s+)?eerste\s+helft|eerste\s+helft|voor\s+rust)\b/iu;
const secondHalf=/\b(?:na\s+(?:de\s+)?rust|na\s+(?:de\s+)?pauze|tweede\s+helft|na\s+de\s+hervatting)\b/iu;
const factsFrom=record=>Array.isArray(record?.verifiedFacts)?record.verifiedFacts.filter(x=>typeof x==='string'):[];
function goalFacts(record) {
 return factsFrom(record).flatMap(f=>{
  const m=f.match(/\bminuut\s+(\d{1,3})(?:\+(\d{1,2}))?\b/i);
  const sportmonks=f.match(/(?:eigen\s+doelpunt\s+van|benutte\s+strafschop\s+van|doelpunt\s+van)\s+([^,.;]+?)\s*,\s*waarna de stand (\d{1,2})-(\d{1,2})/i);
  const official=f.match(/\bdoor\s+(.+?)\s+naar (\d{1,2})-(\d{1,2})\./i);
  const goal=sportmonks||official;
  return m&&goal?[{minute:Number(m[1]),extra:Number(m[2]||0),player:goal[1],home:Number(goal[2]),away:Number(goal[3])}]:[];
 });
}
function goalSequenceIssues(record, events) {
 if (!events.length) return [];
 const issues=[];
 let home=0,away=0,previous=-1,halfHome=0,halfAway=0;
 for (const event of events) {
  const at=event.minute*100+event.extra;
  if (at<previous||event.minute<1||event.minute>120||
      (event.extra>0&&![45,90,105,120].includes(event.minute))||
      !((event.home===home+1&&event.away===away)||(event.home===home&&event.away===away+1)))
   issues.push('De geregistreerde doelpunten volgen geen geldige chronologie of scorevolgorde.');
  previous=at;home=event.home;away=event.away;
  if(event.minute<=45){halfHome=home;halfAway=away;}
 }
 const rest=factsFrom(record).map(f=>f.match(/^Ruststand\s+(\d{1,2})-(\d{1,2})\b/i)).find(Boolean);
 if(rest&&(halfHome!==Number(rest[1])||halfAway!==Number(rest[2])))
  issues.push('De doelpunten uit de eerste helft komen niet overeen met de ruststand.');
 if(record.match&&(home!==record.match.homeScore||away!==record.match.awayScore))
  issues.push('De doelpunten komen niet overeen met de eindstand.');
 return issues;
}
function narrativeOrderIssue(body, events) {
 if (!Array.isArray(body)) return false;
 let previous = -1;
 for (const paragraph of body) {
  if (typeof paragraph !== 'string') continue;
  for (const sentence of paragraph.split(/(?<=[.!?])\s+/u)) {
   const text = sentence.toLocaleLowerCase('nl');
   const times = text.matchAll(/\b(?:minuut\s+(\d{1,3})(?:\+(\d{1,2}))?|(\d{1,3})(?:e|ste|de)\s+minuut|(\d{1,3})\+(\d{1,2}))\b/gu);
   for (const time of times) {
    const minute = Number(time[1] || time[3] || time[4]), extra = Number(time[2] || time[5] || 0);
    const goal = events.find(e => e.minute === minute && e.extra === extra &&
     (text.includes(e.player.toLocaleLowerCase('nl')) ||
      new RegExp('(?<![\\d])' + e.home + '[-\\u2010-\\u2013]' + e.away + '(?![\\d])', 'u').test(text)));
    if (!goal) continue;
    const at = minute * 100 + extra;
    if (at < previous) return true;
    previous = at;
   }
  }
 }
 return false;
}
function halfTimeNarrativeIssues(record={},draft={}) {
 if(record.articleKind!=='match_report')return [];
 const goals=goalFacts(record);
 // Sportmonks and the independent report may both enumerate the same goals.
 const primary=goals.length>0&&factsFrom(record).some(f=>/Sportmonks-wedstrijdregistratie viel in minuut/i.test(f));
 const events=primary?goalFacts({verifiedFacts:factsFrom(record).filter(f=>/Sportmonks-wedstrijdregistratie viel in minuut/i.test(f))}):goals;
 const issues=goalSequenceIssues(record,events);
 if(narrativeOrderIssue(draft.body,events))
   issues.push('De doelpunten in de artikeltekst staan buiten wedstrijdvolgorde.');
 const paragraphs=[draft.headline,draft.standfirst,...(Array.isArray(draft.body)?draft.body:[])].filter(x=>typeof x==='string');
 if(paragraphs.some(p=>relativeInterval.test(p)))
   issues.push('Niet-geverifieerd tijdsverschil tussen doelpunten. Reken nooit blessuretijd door over de rust.');
 for(const sentence of paragraphs.join(' ').split(/(?<=[.!?])\s+/u)){
   if(!firstHalf.test(sentence)||secondHalf.test(sentence))continue;
   if(events.some(e=>e.minute>=46&&sentence.toLocaleLowerCase('nl').includes(e.player.toLocaleLowerCase('nl'))))
     issues.push('Een doelpunt na rust wordt zonder rustovergang als onderdeel van de eerste helft beschreven.');
 }
 return [...new Set(issues)];
}

module.exports={halfTimeNarrativeIssues};
