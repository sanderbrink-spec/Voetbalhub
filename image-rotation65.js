'use strict';

const library = require('./image-library49');
const reviewed = require('./article-image-migration69.json');
const {contentHash} = require('./article-covers');
const reviewFor = article => reviewed[article.id] || reviewed[contentHash(article)];
const METHOD = 'approved-article-v69';
const normalize = value => {
  const key = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return key === 'azalkmaar' ? 'az' : key;
};

function context(article) {
  const legacy = reviewFor(article);
  const source = article.fixture || article.match || {};
  const clubs = source.homeTeam && source.awayTeam ? [source.homeTeam, source.awayTeam] : legacy?.clubs || [];
  const explicit = article.imageCategory || article.articleKind;
  const fixtureAnnouncement = /\b(?:bekerduel|competitieduel|wedstrijd|duel)\b.*\b(?:datum|verplaatst|aftrap|speelschema)\b/i.test(article.headline || '');
  const category = legacy?.category || (article.type === 'column' ? 'column' :
    ({match_report:'report', score_update:'report', match_preview:'preview', match_analysis:'match-analysis', recap:'recap'})[explicit] ||
    (library.categories.includes(explicit) ? explicit : clubs.length === 2 ? 'report' : fixtureAnnouncement ? 'preview' : library.context(article).category));
  return {category, clubs:['report','preview','match-analysis','recap'].includes(category) ? clubs : [], fixtureId:article.matchId || '', competition:article.category || '',
    daypart:library.daypart(legacy?.kickoff && (!legacy.matchId || legacy.matchId === article.matchId) ? legacy.kickoff : source), ...(legacy?.venueId ? {venueId:legacy.venueId} : {})};
}

function eligible(article, rows = library.catalog()) {
  const ctx = context(article);
  const ids = new Set();
  const legacy = reviewFor(article);
  const matches = ['report','preview','match-analysis','recap'].includes(ctx.category);
  if (legacy?.exclude || (matches && ctx.clubs.length !== 2)) return [];
  return rows.filter(asset => asset.approval === 'approved' && asset.reviewer && asset.sha256 && asset.rightsEvidence &&
    ['original-ai','original-vector','licensed'].includes(asset.rights) &&
    (asset.categories.includes(ctx.category) || legacy?.approvedAsset === asset.id) &&
    (!asset.fixtureId || asset.fixtureId === ctx.fixtureId) &&
    (!asset.competitions.length || asset.competitions.includes(ctx.competition)) &&
    (asset.daypart === 'neutral' || asset.daypart === ctx.daypart) &&
    (!asset.venueId || asset.venueId === ctx.venueId) &&
    (matches ? asset.clubs.length === 2 && asset.clubs.every((club,i) => normalize(club) === normalize(ctx.clubs[i])) :
      !asset.fixtureId && !asset.clubs.length) &&
    !asset.file.startsWith('public/match-covers64/'))
    .sort((a,b) => Number(Boolean(b.fixtureId)) - Number(Boolean(a.fixtureId)) || a.id.localeCompare(b.id))
    .filter(asset => { if (ids.has(asset.sha256)) return false; ids.add(asset.sha256); return true; }).slice(0,6);
}

function resolve(article, {rows} = {}) {
  const ctx = context(article);
  const options = eligible(article, rows);
  const reason = options.length ? (ctx.clubs.length ? 'ordered-fixture' : 'exact-topic') :
    reviewFor(article)?.exclude || 'Geen goedgekeurd passend artikelbeeld';
  const assignment = {version:69, state:options.length ? 'approved' : 'unpublished_image_quality',
    context:ctx, assetIds:options.map(asset => asset.id), reason};
  if (!options.length) return {assignment, article:null};
  const {imageAsset, imageLicenseUrl, imageVariants, imageRotation, ...content} = article;
  const selected = options[0];
  const fields = library.fields(selected);
  return {assignment, article:{...content, ...fields, imageCaption:selected.caption,
    imageVariants:options.map(asset => {
      const variant = library.fields(asset);
      return {id:asset.id, url:variant.imageUrl, caption:asset.caption, credit:variant.imageCredit, source:variant.imageSource,
        rights:variant.imageRights, licenseUrl:variant.imageLicenseUrl, review:variant.imageReview};
    }),
    imageRotation:{method:METHOD, count:options.length, maximum:6, selectedId:selected.id, context:ctx, reason}}};
}

async function migrate(client, articles) {
  const key = 'editorial:article-image-assignments:v69';
  const previous = await client.hGetAll(key);
  const changes = Object.create(null);
  const visible = [];
  for (const article of articles) {
    const result = resolve(article);
    const encoded = JSON.stringify(result.assignment);
    if (previous[article.id] !== encoded) changes[article.id] = encoded;
    if (result.article) visible.push(result.article);
  }
  if (Object.keys(changes).length) await client.hSet(key, changes);
  return visible;
}

module.exports = {eligible, resolve, migrate, context, METHOD};
