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

module.exports = { articleUrl, discoverGdelt };
