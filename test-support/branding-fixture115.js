'use strict';
// In-memory receipts for data injected into test harnesses.
module.exports = function brandingFixture(assetSha256) {
  return {status:'passed',assetSha256,veldioOnly:true,noOtherText:true,
    noThirdPartyLogos:true,disclosureOutsideImage:true,
    reviewer:'Synthetic test fixture',reviewedAt:'2026-11-24'};
};
