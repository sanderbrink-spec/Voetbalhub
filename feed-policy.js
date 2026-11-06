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
// The installed Android app accepts compact articles through its versioned rights
// envelope. Apply its legacy per-row checks on the server before using that path.
function articleEnvelope(articles, now = Date.now()) {
  if (!articles.some(article => article.compactVerified === true)) return {count:articles.length,articles};
  const checks = require('./editorial-desk-model').checks;
  const visible = articles.filter(article => {
    if (article.status !== 'published' || !article.id || !article.headline || !Array.isArray(article.body) || !article.body.length) return false;
    const reviewed = checks.every(key => article.editorialChecks?.[key] === true);
    if (article.body.length < 3) return article.compactVerified === true && reviewed &&
      ['cleared','licensed'].includes(article.imageRights);
    const approval = article.authorApproval;
    const column = article.type?.toLowerCase() === 'column' && article.author?.trim().length >= 3 &&
      approval?.explicit === true && approval.method === 'author_supplied_manuscript' && /^[a-f0-9]{64}$/.test(approval.contentHash);
    return reviewed || column;
  });
  return {rightsPolicyVersion:26,rightsExpiresAt:now+36*3600000,count:visible.length,articles:visible};
}
function publicationLifecycle(value) {
  if (value == null) return undefined;
  if (value.kind !== 'preview' || typeof value.expiresAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value.expiresAt) ||
      !Number.isFinite(Date.parse(value.expiresAt))) throw Error('Voorbeschouwing vereist een geldige vervaldatum met tijdzone.');
  return {kind: 'preview', expiresAt: new Date(value.expiresAt).toISOString()};
}
module.exports = {archiveReason, selectFeed, articleEnvelope, publicationLifecycle};
