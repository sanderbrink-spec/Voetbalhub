'use strict';
const policy = require('./feed-policy.json');

// Visibility only: Redis records, original dates and article text remain intact.
function archiveReason(article, now = Date.now()) {
  if (Object.hasOwn(policy.archived, article.id)) return policy.archived[article.id];
  const lifecycle = article.feedLifecycle;
  // Never guess a deadline from prose or apply a general age limit to reports.
  if (lifecycle?.kind === 'preview' && Number.isFinite(Date.parse(lifecycle.expiresAt)) &&
      Date.parse(lifecycle.expiresAt) <= now) return 'Voorbeschouwing verlopen';
  return '';
}
function selectFeed(articles, {view = 'current', now = Date.now()} = {}) {
  return articles.map(article => {
    const reason = archiveReason(article, now);
    return {...article, feedState: reason ? 'archived' : 'current', ...(reason ? {archiveReason: reason} : {})};
  }).filter(article => view === 'all' || (view === 'archive' ? article.feedState === 'archived' : article.feedState === 'current'))
    .sort((a,b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')) || String(a.id).localeCompare(String(b.id)));
}
function publicationLifecycle(value) {
  if (value == null) return undefined;
  if (value.kind !== 'preview' || typeof value.expiresAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value.expiresAt) ||
      !Number.isFinite(Date.parse(value.expiresAt))) throw Error('Voorbeschouwing vereist een geldige vervaldatum met tijdzone.');
  return {kind: 'preview', expiresAt: new Date(value.expiresAt).toISOString()};
}
module.exports = {archiveReason, selectFeed, publicationLifecycle};
