'use strict';

const GDELT = 'https://api.gdeltproject.org/api/v2/doc/doc';

function articleUrl(value, indexes) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const domain = url.hostname.replace(/^www\./, '');
    const index = indexes.find(entry =>
      new URL(entry.url).hostname.replace(/^www\./, '') === domain &&
      new RegExp(entry.articlePath).test(url.pathname));
    if (!index) return null;
    // Reconstruct links using the configured origin. Discard tracking and fragments.
    return new URL(url.pathname, index.url).href;
  } catch {
    return null;
  }
}

function officialSourceAuthority(canonicalUrl) {
  if (!canonicalUrl) return '';
  const url = new URL(canonicalUrl);
  const domain = url.hostname.replace(/^www\./, '');
  // UEFA is competent to confirm its own men's Nations League qualification
  // status and competition decisions. Match previews, pundit commentary,
  // photographs and unrelated UEFA stories are NOT granted single-source status.
  if (domain === 'uefa.com') {
    const previouslyConfirmed = /^\/uefanationsleague\/news\/02[a-z0-9-]+--[^/]*(?:who-is-through|quarter-final-qualification|state-of-play|qualification-promotion|promotion-relegation|knockout-stage-draw)[^/]*\/?$/.test(url.pathname);
    // These exact article families report decisions by the competition organiser.
    // A preview, interpretation or similarly named analysis is not a decision.
    const decision = /^\/uefanationsleague\/news\/02[a-z0-9-]+--(?:20\d{2}-\d{2}-)?(?:uefa-)?(?:nations-league-)?(?:knockout-stage-and-play-off-draw|quarter-finals-last-eight-confirmed)\/?$/.test(url.pathname);
    return previouslyConfirmed || decision ? 'association_decision' : 'club_decision';
  }
  return ['knvb.nl', 'eurojackpotknvbbeker.nl', 'onsoranje.nl', 'ussoccer.com'].includes(domain)
    ? 'association_decision' : 'club_decision';
}

async function discoverGdelt(indexes, fetcher, readBody) {
  const domains = [...new Set(indexes.map(entry => new URL(entry.url).hostname.replace(/^www\./, '')))];
  if (!domains.length) return [];
  const url = new URL(GDELT);
  url.search = new URLSearchParams({
    query: '(' + domains.map(domain => 'domain:' + domain).join(' OR ') + ')',
    mode: 'artlist',
    format: 'json',
    timespan: '72h',
    maxrecords: '25',
    sort: 'datedesc'
  });
  const response = await fetcher(url.href, {
    redirect: 'error',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw Error('GDELT HTTP ' + response.status);
  }
  const data = JSON.parse(await readBody(response));
  if (!Array.isArray(data.articles)) throw Error('Onverwacht GDELT-antwoord.');
  // Only links are used. Headlines, imagery and indexing dates never enter evidence.
  return [...new Set(data.articles.slice(0, 25).map(article => articleUrl(article?.url, indexes)).filter(Boolean))].slice(0, 8);
}


// Bounded search for independent official sources about a specific unpaired
// lead. Search results are URLs only, never proof; the existing independent
// partner selection, literal quote extraction and publication gates still run.
function researchTerms(title){
 const stop=new Set('voor tegen naar over deze dit een het zijn wordt worden door heeft hebben met van bij aan als ook meer nieuws nieuwe club clubs wedstrijd wedstrijden duel duels voetbal seizoen laatste the and with from this that news team teams match matches season league champions conference europese eredivisie europa league speelt grote eerste tweede volgende vandaag vanavond morgen'.split(' '));
 return [...new Set(String(title||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z0-9]{3,24}/g)||[])].filter(w=>!stop.has(w)).slice(0,4);
}
async function discoverCorroboration(doc,indexes,fetcher,readBody){
 const terms=researchTerms(doc?.title);
 if(terms.length<2)return [];
 const origin=new URL(doc.url).hostname.replace(/^www\./,'');
 const domains=[...new Set(indexes.map(entry=>new URL(entry.url).hostname.replace(/^www\./,'')))].filter(d=>d!==origin);
 if(!domains.length)return [];
 const url=new URL(GDELT);
 // Use at most three headline anchors; all returned pages are independently
 // checked again. Never send article text, private data, or arbitrary URLs.
 url.search=new URLSearchParams({query:terms.slice(0,3).join(' ')+' ('+domains.map(d=>'domain:'+d).join(' OR ')+')',mode:'artlist',format:'json',timespan:'72h',maxrecords:'12',sort:'datedesc'});
 const response=await fetcher(url.href,{redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
 if(!response.ok){await response.body?.cancel();throw Error('GDELT gericht onderzoek HTTP '+response.status);}
 const data=JSON.parse(await readBody(response));
 if(!Array.isArray(data.articles))throw Error('Ongeldig gericht GDELT-antwoord.');
 return [...new Set(data.articles.slice(0,12).map(a=>articleUrl(a?.url,indexes)).filter(u=>u&&new URL(u).hostname.replace(/^www\./,'')!==origin))].slice(0,4);
}

module.exports = { articleUrl, officialSourceAuthority, discoverGdelt, researchTerms, discoverCorroboration };
