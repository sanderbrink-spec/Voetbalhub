"use strict";
// Produce a pending review record only. This command never grants permission or changes production.
const fs=require('node:fs'),R=require('../content-rights');
const [scope,file]=process.argv.slice(2);
if(!['publication','ai-input','image-input','asset','asset-access','snapshot-access','snapshot-content','feed-access','production-method'].includes(scope)||!file)throw Error('Gebruik: node scripts/rights-review.js SCOPE PRIVATE_INPUT.json');
const value=JSON.parse(fs.readFileSync(file,'utf8'));
console.log(JSON.stringify({scope,contentHash:R.digest(scope==='publication'?R.articleContent(value):value),status:'pending',evidenceRef:'',basis:'',reviewer:'',reviewedAt:'',validUntil:''},null,2));
