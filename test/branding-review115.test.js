'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {brandingAllowed,accepted}=require('../premium-match-images72');
const legacy=require('../branding-review-baseline115.json');
const sha='a'.repeat(64);
const base={id:'new-stadium-115',sha256:sha,caption:'Veldio · AI-illustratie, geen echte wedstrijdfoto.'};
const audit={status:'passed',assetSha256:sha,veldioOnly:true,noOtherText:true,noThirdPartyLogos:true,disclosureOutsideImage:true,reviewer:'Visual QA',reviewedAt:'2026-11-24'};
test('new raster requires explicit hash-bound Veldio-only approval',()=>{
 assert.equal(brandingAllowed(base),false);
 assert.equal(brandingAllowed({...base,brandingAudit115:audit}),true);
 for(const field of ['veldioOnly','noOtherText','noThirdPartyLogos','disclosureOutsideImage'])assert.equal(brandingAllowed({...base,brandingAudit115:{...audit,[field]:false}}),false);
 assert.equal(brandingAllowed({...base,sha256:'b'.repeat(64),brandingAudit115:audit}),false);
 assert.equal(brandingAllowed({...base,caption:'Veldio',brandingAudit115:audit}),false);
});
test('old approved bytes can remain during re-audit but a known defect blocks them',()=>{
 const [id,sha256]=Object.entries(legacy)[0];
 assert.equal(brandingAllowed({id,sha256}),true);
 assert.equal(brandingAllowed({id,sha256,brandingAudit115:{status:'needs-correction',assetSha256:sha256}}),false);
 assert.equal(brandingAllowed({id,sha256:'b'.repeat(64)}),false);
});

test('known defects or stale review hashes cannot be bypassed by changing file bytes, including non-match assets',()=>{
 const original={id:'news-115',sha256:sha,approval:'approved',reviewer:'Visual QA',rightsEvidence:'Documented',categories:['news'],brandingAudit115:{status:'needs-correction',assetSha256:sha}};
 assert.equal(accepted(original),false);
 assert.equal(accepted({...original,sha256:'b'.repeat(64)}),false);
 assert.equal(accepted({...original,brandingAudit115:{status:'text-screen-pass',assetSha256:'b'.repeat(64)}}),false);
 assert.equal(accepted({...original,brandingAudit115:{status:'already-rejected',assetSha256:sha}}),false);
 assert.equal(accepted({...original,brandingAudit115:audit}),true);
});
