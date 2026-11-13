'use strict';

const library = require('./image-library49');
const premium = require('./premium-match-images72');
const stadium74 = require('./stadium-venue74');
const reviewed = require('./article-image-migration69.json');
const {contentHash} = require('./article-covers');
const {matchImageContext} = require('./match-image-context');
const {archived} = require('./feed-policy.json');
const reviewFor = article => reviewed[article.id] || reviewed[contentHash(article)];
const METHOD = 'approved-article-v69';
const MATCH_CATEGORIES = ['report','preview','match-analysis','recap'];
const normalize = value => {
  const key = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return key === 'azalkmaar' ? 'az' : key;
};

function context(article) {
  const legacy = reviewFor(article);
  const source = article.fixture || article.match || {};
  const home = source.homeTeam || source.home?.name;
  const away = source.awayTeam || source.away?.name;
  const clubs = home && away ? [home, away] : legacy?.clubs || [];
  const requested = article.imageCategory || article.articleKind || article.feedLifecycle?.kind;
  const explicit = requested === 'analysis' && clubs.length === 2 ? 'match_analysis' : requested;
  const fixtureAnnouncement = /\b(?:bekerduel|competitieduel|wedstrijd|duel)\b.*\b(?:datum|verplaatst|aftrap|speelschema)\b/i.test(article.headline || '');
  const category = legacy?.category || (article.type === 'column' ? 'column' :
    ({match_report:'report', score_update:'report', match_preview:'preview', match_analysis:'match-analysis', recap:'recap'})[explicit] ||
    (library.categories.includes(explicit) ? explicit : clubs.length === 2 ? 'report' : fixtureAnnouncement ? 'preview' : library.context(article).category));
  const fixtureId = article.matchId || source.id || '';
  const kickoff = legacy?.kickoff && (!legacy.matchId || legacy.matchId === fixtureId) ? legacy.kickoff : source;
  const venueId = source.venueId || source.venue?.id || legacy?.venueId;
  return {category, clubs:MATCH_CATEGORIES.includes(category) ? clubs : [], fixtureId, competition:article.category || '',
    daypart:library.daypart(kickoff), venueName:source.venue?.name||source.venueName||'', ...(venueId ? {venueId} : {}),
    ...matchImageContext({...article, fixture:{...source, venueId}}, category, clubs, kickoff)};
}

function eligible(article, rows = library.catalog(), ctx = context(article)) {
  const ids = new Set();
  const legacy = reviewFor(article);
  const matches = MATCH_CATEGORIES.includes(ctx.category);
  // Explicitly archived legacy articles keep their existing editorial artwork.
  const legacyArchive = article.status === 'published' && Object.hasOwn(archived, article.id);
  if (legacy?.exclude || (matches && ctx.clubs.length !== 2)) return [];
  return rows.filter(asset => premium.accepted(asset) && asset.sha256 &&
    (['original-ai','original-vector'].includes(asset.rights) ||
      (asset.rights === 'licensed' && asset.credit && asset.source && /^https:\/\//.test(asset.licenseUrl))) &&
    (asset.categories.includes(ctx.category) || legacy?.approvedAsset === asset.id) &&
    (!asset.fixtureId || asset.fixtureId === ctx.fixtureId) &&
    (!ctx.imageKind || legacyArchive ||
      stadium74.allowedForMatch(asset,{...ctx,category:ctx.imageKind})) &&
    (!asset.competitions.length || asset.competitions.includes(ctx.competition)) &&
    (asset.daypart === 'neutral' || asset.daypart === ctx.daypart) &&
    (!asset.venueId || asset.venueId === ctx.venueId) &&
    (matches ? asset.clubs.length === 2 &&
      (asset.homeClubReusable ? (asset.clubs[1] === '*' && normalize(asset.clubs[0]) === normalize(ctx.clubs[0])) :
       asset.clubs.every((club,i) => normalize(club) === normalize(ctx.clubs[i]))) :
      !asset.fixtureId && !asset.clubs.length) &&
    !asset.file.startsWith('public/match-covers64/'))
    .sort((a,b) => Number(Boolean(b.fixtureId)) - Number(Boolean(a.fixtureId)) ||
      (Date.parse(b.approvedAt) || 0) - (Date.parse(a.approvedAt) || 0) || a.id.localeCompare(b.id))
    .filter(asset => { if (ids.has(asset.sha256)) return false; ids.add(asset.sha256); return true; }).slice(0,6);
}

function assetFields(asset, context) {
  const fields = library.fields(asset, context);
  if (context?.imageKind && context.imageKind !== asset.imageKind) {
    for (const key of ['imageKind','stadiumOccupancy','stadiumIdentity','imageIdentity']) delete fields.imageReview[key];
  }
  if (asset.rights !== 'licensed') return {...fields, imageCredit:'Veldio'};
  return {...fields, imageRights:'licensed', imageCredit:asset.credit, imageSource:asset.source, imageLicenseUrl:asset.licenseUrl};
}

function resolve(article, {rows} = {}) {
  // Preserve a deliberate editor-selected image. Only attach explicitly reviewed
  // national-team artwork when no image was selected for the article.
  if (!article.imageUrl) {
    const interland = require('./interland-artwork247').select(article);
    if (interland) return {assignment:{version:247,state:'approved',context:{countryCode:interland.imageReview.countryCode},assetIds:[interland.imageAssetId],reason:'reviewed-interland'},article:{...article,...interland}};
  }
  const ctx = context(article);
  const options = eligible(article, rows, ctx);
  const reason = options.length ? (ctx.clubs.length ? 'ordered-fixture' : 'exact-topic') :
    reviewFor(article)?.exclude || 'Geen goedgekeurd passend artikelbeeld';
  const assignment = {version:69, state:options.length ? 'approved' : 'unpublished_image_quality',
    context:ctx, assetIds:options.map(asset => asset.id), reason};
  if (!options.length) return {assignment, article:null};
  const {imageAsset, imageLicenseUrl, imageVariants, imageRotation, ...content} = article;
  const selected = options[0];
  const fields = assetFields(selected, ctx);
  return {assignment, article:{...content, ...fields, imageCaption:selected.caption,
    imageVariants:options.map(asset => {
      const variant = assetFields(asset, ctx);
      return {id:asset.id, url:variant.imageUrl, caption:asset.caption, credit:variant.imageCredit, source:variant.imageSource,
        rights:variant.imageRights, licenseUrl:variant.imageLicenseUrl, review:variant.imageReview};
    }),
    imageRotation:{method:METHOD, count:options.length, maximum:6, selectedId:selected.id, context:ctx, reason}}};
}

async function migrate(client, articles) {
  const key = 'editorial:article-image-assignments:v72';
  const retired = require('./image-library49.json').assets.filter(a=>a.approval==='rejected' && premium.isMatch(a));
  const previous = await client.hGetAll(key);
  const changes = Object.create(null);
  const visible = [];
  for (const article of articles) {
    const result = resolve(article);
    const encoded = JSON.stringify(result.assignment);
    if (previous[article.id] !== encoded) changes[article.id] = encoded;
    if (result.article) visible.push(result.article);
    else if (premium.isRetiredReference(article,retired)) {
      // Do not erase an already published, fact-checked report simply because
      // its previously approved image has been withdrawn by the owner.
      const clean={...article,imageQualityStatus:'awaiting-premium-replacement'};
      for(const key of ['imageUrl','imageAssetId','imageReview','imageCaption','imageVariants','imageRotation','imageSource','imageCredit'])delete clean[key];
      visible.push(clean);
    }
  }
  if (Object.keys(changes).length) await client.hSet(key, changes);
  return visible;
}

module.exports = {eligible, resolve, migrate, context, assetFields};
