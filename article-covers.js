'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const manifest = require('./article-covers.json');
const ROOT = path.join(__dirname, 'public/article-covers');
const ORIGIN = 'https://voetbalhub-redactie.onrender.com';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
function contentHash(article) {
  const d = article?.draft || article || {};
  return sha256(JSON.stringify([d.headline, d.standfirst, d.body]));
}
function readCover(filename) {
  if (typeof filename !== 'string' || !/^[a-z0-9-]+\.webp$/.test(filename)) return null;
  const entry = manifest.find(row => row.reviewed === true && row.file === filename);
  if (!entry) return null;
  try {
    const bytes = fs.readFileSync(path.join(ROOT, filename));
    return sha256(bytes) === entry.assetSha256 ? bytes : null;
  } catch { return null; }
}
function withArticleCover(article) {
  // Never replace an editor-selected image or attach a cover to different copy.
  if (article.imageUrl) return article;
  const entry = manifest.find(row => row.reviewed === true && row.contentHash === contentHash(article));
  if (!entry || !readCover(entry.file)) return article;
  return {
    ...article,
    imageUrl: ORIGIN + '/article-covers/' + entry.file,
    imageSource: 'VoetbalHub · AI-illustratie',
    imageCredit: 'VoetbalHub · AI-illustratie',
    imageRights: 'cleared',
    imageReview: {
      kitVerified: true,
      playerIdentityVerified: true,
      aiDisclosureVerified: true,
      notes: entry.reviewNotes,
      contentHash: entry.contentHash,
      assetSha256: entry.assetSha256,
      method: 'reviewed-match-cover'
    }
  };
}
module.exports = { contentHash, readCover, withArticleCover };
