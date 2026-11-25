'use strict';
// Fase 72: previously approved raster artworks are frozen to their exact
// reviewed SHA256 hashes. This is a compatibility list, NOT a new 8.5 score.
// Every NEW match asset needs an explicit dated visual approval and score.
const historical = require('./premium-match-raster-baseline72.json');
const brandingBaseline115 = require('./branding-review-baseline115.json');
const correctionItems115 = require('./branding-correction-queue115.json').items;
const knownDefects115 = new Map(correctionItems115.map(item => [item.id, item.originalSha256]));
const technicalHolds115 = new Map(correctionItems115.filter(item=>item.technicalReview115?.status==='requires-native-resolution-repair').map(item=>[item.id,item.technicalReview115.assetSha256]));
const ownerRejectedHashes = new Set(require('./owner-replacement-queue115e.json').items.map(row => row.rejectedSha256));
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
       .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'') &&
     q.clubScope==='home-only' && q.scopeHome===String(asset.clubs[0]).normalize('NFD')
       .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'') &&
     q.reviewedStadiumIdentity===asset.stadiumIdentity)));
}
// New or changed match artwork needs an explicit review of the actual raster.
// The fixed hash snapshot only preserves previous approvals during re-audit;
// it is NOT a statement that those images comply with the new rule.
function fullBrandingReview(asset) {
 const audit=asset?.brandingAudit115;
 return Boolean(audit?.status==='passed' && audit.assetSha256===asset?.sha256 &&
   audit.veldioOnly===true && audit.noOtherText===true && audit.noThirdPartyLogos===true &&
   audit.disclosureOutsideImage===true &&
   typeof audit.reviewer==='string' && audit.reviewer.trim().length>=3 &&
   /^20\d\d-\d\d-\d\d$/.test(audit.reviewedAt||'') &&
   Number.isFinite(Date.parse(audit.reviewedAt)) &&
   /AI[- ]illustratie/i.test(asset?.caption||''));
}
function knownDefectBlocked(asset) {
 if(!knownDefects115.has(asset?.id)) return false;
 // The original defective bytes must never be released via legacy approval,
 // a removed audit, or a candidate-only text review.
 return asset.sha256===knownDefects115.get(asset.id) || !fullBrandingReview(asset);
}
function brandingAllowed(asset) {
 if(knownDefectBlocked(asset)) return false;
 const audit=asset?.brandingAudit115;
 if(audit && (audit.assetSha256!==asset?.sha256 || ['needs-correction','already-rejected'].includes(audit.status))) return false;
 if(brandingBaseline115[asset?.id]===asset?.sha256 && typeof asset?.sha256==='string') return true;
 return fullBrandingReview(asset);
}
function accepted(asset) {
 if(!asset || ownerRejectedHashes.has(asset.sha256) || asset.approval!=='approved' || !asset.reviewer ||
    !asset.rightsEvidence) return false;
 // A later individual review takes precedence over any legacy approval.
 // A manual review is valid only for the exact reviewed bytes.
 const manual=asset.manualReview115;
 if(manual && (manual.status!=='passed' || manual.assetSha256!==asset.sha256 || manual.brandingVerified!==true || manual.contextVerified!==true)) return false;
 // Known visual defects apply to every catalog category, not just match art.
 if(knownDefectBlocked(asset)) return false;
 // A known undersized raster remains blocked regardless of a later metadata-only approval.
 if(technicalHolds115.get(asset.id)===asset.sha256 && technicalHolds115.has(asset.id))return false;
 const audit=asset.brandingAudit115;
 if(audit && (audit.assetSha256!==asset.sha256 || ['needs-correction','already-rejected'].includes(audit.status))) return false;
 if(!isMatch(asset)) return true;
 if(!brandingAllowed(asset)) return false;
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
module.exports={MIN_SCORE,isMatch,isRetiredVector,reviewedPremium,brandingAllowed,accepted,isRetiredReference};
