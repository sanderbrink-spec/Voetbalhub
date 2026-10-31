'use strict';
const policy = require('./rights-policy.json');
// A domain, API key, visual identity check or credit is never a licence.
function permitted(feature, now = Date.now()) {
  const evidence = policy.evidence[feature];
  return policy[feature] === true && !!evidence && evidence.commercialUse === true &&
    typeof evidence.reference === 'string' && evidence.reference.trim().length > 10 &&
    Number.isFinite(Date.parse(evidence.expiresAt)) && Date.parse(evidence.expiresAt) > now;
}
function requirePermission(feature) {
  if (!permitted(feature)) throw new Error('Rechtencontrole vereist: ' + feature + '. Functie veilig uitgeschakeld.');
}
function safePublicArticle(article) {
  const result = {...article};
  // Fixture composites contain third-party logos/photos. Legacy review booleans
  // establish identity, not permission. Keep the article and use its local fallback.
  if (!permitted('thirdPartyVisuals') &&
      (!['reviewed-match-cover', 'original-editorial-artwork'].includes(article.imageReview?.method))) {
    for (const field of ['imageUrl','imageSource','imageCredit','imageReview']) delete result[field];
    result.imageRights = 'not_needed';
  }
  // Evidence is private editorial material, not part of the public news API.
  for (const field of ['verifiedFacts','sourceEvidence','claims','editorialChecks']) delete result[field];
  return result;
}
module.exports = {permitted, requirePermission, safePublicArticle};
