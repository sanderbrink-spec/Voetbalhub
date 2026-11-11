'use strict';
// Fase 72: previously approved raster artworks are frozen to their exact
// reviewed SHA256 hashes. This is a compatibility list, NOT a new 8.5 score.
// Every NEW match asset needs an explicit dated visual approval and score.
const historical = require('./premium-match-raster-baseline72.json');
const MATCH = new Set(['preview','report','match-analysis','recap']);
const MIN_SCORE = 8.5;
const isMatch = asset => Boolean(asset && (asset.fixtureId || asset.imageKind ||
  Array.isArray(asset.categories) && asset.categories.some(category=>MATCH.has(category))));
const isRetiredVector = asset => Boolean(isMatch(asset) &&
  (asset.rights === 'original-vector' || /\.svg$/i.test(String(asset.file||''))));
function reviewedPremium(asset) {
 const q=asset?.visualReview;
 return Boolean(q && Number.isFinite(q.score) && q.score>=MIN_SCORE && q.score<=10 &&
   q.style==='photorealistic' && q.assetSha256===asset.sha256 &&
   q.checked?.photorealism===true && q.checked?.clubNames===true &&
   q.checked?.stadiumContext===true && q.checked?.rights===true &&
   q.checked?.aiNotDocumentary===true &&
   typeof q.reviewer==='string' && q.reviewer.trim().length>=3 &&
   /^20\d\d-\d\d-\d\d$/.test(q.reviewedAt||'') && Number.isFinite(Date.parse(q.reviewedAt)) &&
   ['preview','report'].includes(asset.imageKind) &&
   asset.stadiumOccupancy===(asset.imageKind==='report'?'full':'empty') &&
   /^(home|venue):[a-z0-9]+$/.test(asset.stadiumIdentity||'') &&
   Array.isArray(asset.clubs) && asset.clubs.length===2 &&
   (!asset.homeClubReusable || (!asset.fixtureId && asset.clubs[1]==='*' &&
     asset.stadiumIdentity==='home:'+String(asset.clubs[0]).normalize('NFD')
       .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,''))));
}
function accepted(asset) {
 if(!asset || asset.approval!=='approved' || !asset.reviewer ||
    !asset.rightsEvidence) return false;
 if(!isMatch(asset)) return true;
 // A machine-readable fixture approval does not establish photographic quality.
 if(isRetiredVector(asset) || !/\.(webp|png|jpe?g)$/i.test(asset.file||'') ||
    asset.file.startsWith('public/match-covers64/') ||
    !['original-ai','licensed'].includes(asset.rights)) return false;
 // An explicitly failed or incomplete new review always takes precedence
 // over historical acceptance. No fabricated quality scores for old assets.
 if(asset.visualReview !== undefined) return reviewedPremium(asset);
 return historical[asset.id]===asset.sha256;
}
function isRetiredReference(article,assets=[]) {
 if(article?.status!=='published')return false;
 return assets.some(asset=>{
   if(asset.approval!=='rejected'||!isMatch(asset))return false;
   const publicUrl='/'+asset.file.slice(7).replace(/\.svg$/i,'.webp');
   return article.imageAssetId===asset.id ||
     (typeof article.imageUrl==='string' && article.imageUrl.endsWith(publicUrl));
 });
}
module.exports={MIN_SCORE,isMatch,isRetiredVector,reviewedPremium,accepted,isRetiredReference};
