'use strict';
// Conservative image variation: approved, file-hash-checked library entries only.
// No football artwork may be reused for an unrelated pair of teams.
const crypto = require('node:crypto');
const library = require('./image-library49');
const ORIGIN = 'https://voetbalhub-redactie.onrender.com';
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const hash = value => parseInt(crypto.createHash('sha256').update(String(value)).digest('hex').slice(0,8),16);

function kind(article) {
 const k = String(article.articleKind || article.imageCategory || '').toLowerCase();
 if (['match_report','score_update','report'].includes(k)) return 'report';
 if (['preview','match_preview'].includes(k)) return 'preview';
 if (article.match) return 'report';
 return library.context(article).category;
}
function isProtected(article) {
 if (article.imageRights === 'licensed') return true;
 if (article.imageReview?.contentHash) return true;
 // A manually reviewed image must not be displaced by automatic rotation.
 if (article.imageReview?.reviewedAt && article.imageReview?.method !== 'approved-library49') return true;
 return false;
}
function eligible(article, rows = library.catalog()) {
 if (!article || article.status !== 'published' || /^column$/i.test(String(article.type || '')) ||
     /^(column|de derde helft)$/i.test(String(article.category || ''))) return [];
 const match = article.match;
 const isMatch = Boolean(match?.homeTeam && match?.awayTeam);
 const category = kind(article);
 if (isMatch && !['preview','report'].includes(category)) return [];
 if (!isMatch && (!library.categories.includes(category) || category === 'quiz' || category === 'neutral')) return [];
 const ctx = library.context(article);
 return rows.filter(asset => {
  if (asset.approval !== 'approved' || !['original-ai','original-vector','licensed'].includes(asset.rights) ||
      !asset.reviewer || !asset.sha256 || !asset.rightsEvidence || !asset.categories.includes(category)) return false;
  if (asset.competitions?.length && !asset.competitions.includes(article.category)) return false;
  if (asset.fixtureId && asset.fixtureId !== article.matchId) return false;
  // Only a verified kick-off and venue can justify a daypart-specific image.
  if (asset.daypart !== 'neutral' && asset.daypart !== ctx.daypart) return false;
  if (isMatch) return asset.clubs?.length === 2 &&
   normalize(asset.clubs[0]) === normalize(match.homeTeam) &&
   normalize(asset.clubs[1]) === normalize(match.awayTeam);
  // Non-match pieces may rotate only category-neutral, not match-branded artwork.
  return Array.isArray(asset.clubs) && asset.clubs.length === 0 && !asset.fixtureId;
 }).sort((a,b) => Number(Boolean(b.fixtureId)) - Number(Boolean(a.fixtureId)) || a.id.localeCompare(b.id)).slice(0,6);
}
function present(article, {round = 0, rows} = {}) {
 if (isProtected(article)) return article;
 const options = eligible(article, rows);
 if (!options.length) return article;
 const selectedIndex = ((Math.trunc(round) || 0) + hash(article.id || article.headline || '') % options.length) % options.length;
 const asset = options[selectedIndex < 0 ? selectedIndex + options.length : selectedIndex];
 const fields = library.fields(asset);
 return {
  ...article, ...fields,
  imageVariants: options.map(item => ({id:item.id, url:ORIGIN + '/' + item.file.slice(7), caption:item.caption})),
  imageRotation: {method:'approved-exact-topic-v65',count:options.length,slot:selectedIndex + 1,maximum:6},
  imageCaption: asset.caption,
  imageReview: {...fields.imageReview, generated:asset.rights === 'original-ai', noDocumentaryClaim:true,
   rotationPolicy:'exact-team-pair-or-neutral-topic', rotationVersion:65}
 };
}
module.exports = {eligible,present,kind,isProtected,normalize};
