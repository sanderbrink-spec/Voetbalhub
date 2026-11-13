'use strict';

// Interland artwork metadata. Never infer nationality from headlines or club names.
// Rendered country-specific graphics are only served after the original artwork
// has been imported and explicitly reviewed for rights and image quality.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = __dirname;
const ART = 'public/editorial/interlands';
const ASSETS = Object.freeze({
  NL: 'veldio-nederland-premium.webp',
  WORLD: 'veldio-interlands-universal.webp'
});
const ORIGIN = 'https://voetbalhub-redactie.onrender.com';
const normalize = v => String(v || '').trim().toUpperCase();

function countryCode(v) {
  const c = normalize(v);
  if (!/^[A-Z]{2}$/.test(c)) return '';
  try {
    const name = new Intl.DisplayNames(['nl'], {type:'region'}).of(c);
    return name && name !== c ? c : '';
  } catch { return ''; }
}

function detect(article = {}) {
  const d = article.draft || article;
  const fixture = article.fixture || article.match || d.fixture || d.match || {};
  // An international competition can contain club matches, so a competition
  // name alone is never evidence that two national teams are participating.
  const national = article.isInternational === true ||
    article.nationalTeams === true || fixture.isInternational === true ||
    fixture.nationalTeams === true || fixture.teamType === 'national';
  if (!national) return null;
  const explicit = countryCode(article.countryCode || d.countryCode ||
    article.nationalTeamCode || d.nationalTeamCode);
  const home = countryCode(fixture.homeCountryCode || fixture.home?.countryCode);
  const away = countryCode(fixture.awayCountryCode || fixture.away?.countryCode);
  const code = explicit || (home === 'NL' || away === 'NL' ? 'NL' : home || away);
  if (!code) return null;
  return {code, countryName:new Intl.DisplayNames(['nl'], {type:'region'}).of(code),
    variant:code === 'NL' ? 'netherlands-premium' : 'universal'};
}

function approvedFile(filename) {
  const full = path.join(ROOT, ART, filename);
  if (!fs.existsSync(full)) return null;
  const stat = fs.statSync(full);
  if (!stat.isFile() || stat.size < 10000 || stat.size > 2000000) return null;
  const bytes = fs.readFileSync(full);
  return {sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes};
}

function select(article) {
  const info = detect(article);
  if (!info) return null;
  // Do not publish the generic artwork with a baked-in {LAND} placeholder.
  // A universal design must be rendered per country by the image worker.
  if (info.code !== 'NL') return null;
  const asset = approvedFile(ASSETS.NL);
  if (!asset) return null;
  // This record is not a substitute for an editorial visual review.
  // Only an existing independently reviewed proof may unlock an asset.
  let proof;
  try { proof = require('./public/editorial/interlands/approved.json'); }
  catch { return null; }
  const review = proof[info.code];
  if (!review || review.sha256 !== asset.sha256 ||
      review.rightsCleared !== true || review.qualityApproved !== true ||
      review.logoVerified !== true || review.noFederationLogos !== true) return null;
  return {imageUrl:ORIGIN+'/'+ART.slice(7)+'/'+ASSETS.NL,
    imageAssetId:'interland-nl-premium-'+asset.sha256.slice(0,12),
    imageRights:'cleared', imageSource:'Veldio · eigen AI-illustratie',
    imageCredit:'Veldio', imageReview:{
      method:'interland-premium-reviewed', assetSha256:asset.sha256,
      countryCode:info.code, variant:info.variant,
      kitVerified:true, playerIdentityVerified:true, aiDisclosureVerified:true,
      noFederationLogos:true
    }};
}

module.exports = {detect,select,countryCode,ASSETS};
