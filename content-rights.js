"use strict";
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])]));
 return value;
}
function articleContent(a){a={...a};if(a.imageReview){a.imageReview={...a.imageReview};delete a.imageReview.reviewedAt;}return Object.fromEntries(['author','headline','standfirst','body','why_it_matters','category','type','blocks','manuscript','match','verifiedFacts','sources','imageUrl','imageSource','imageCredit','imageCaption','imageLicenseUrl','imageRights','imageReview','aiDisclosure'].filter(k=>a[k]!==undefined).map(k=>[k,a[k]]));}
function digest(value){return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');}
function createRights({file=process.env.CONTENT_RIGHTS_FILE||path.join(__dirname,'content-rights.json'),now=Date.now,log=event=>console.info(JSON.stringify(event))}={}){
 function decision(scope,value,{audit=true}={}){
  const contentHash=digest(scope==='publication'?articleContent(value):value);let approvals=[];
  try {const data=JSON.parse(fs.readFileSync(file,'utf8'));if(data.version===1&&Array.isArray(data.approvals))approvals=data.approvals;}catch{}
  const revoked=approvals.some(a=>a.scope===scope&&a.contentHash===contentHash&&a.status==='revoked');
  const approval=!revoked&&approvals.find(a=>a.scope===scope&&a.contentHash===contentHash&&a.status==='approved'&&typeof a.evidenceRef==='string'&&a.evidenceRef.trim().length>=8&&typeof a.basis==='string'&&a.basis.trim().length>=8&&typeof a.reviewer==='string'&&a.reviewer.trim()&&Date.parse(a.reviewedAt)<=now()&&Date.parse(a.validUntil)>now());
  const result={allowed:!!approval,revoked,scope,contentHash,...(approval?{evidenceRef:approval.evidenceRef,validUntil:approval.validUntil}:{reason:'rights_evidence_missing_or_expired'})};
  if(audit)log({event:'rights_decision',at:new Date(now()).toISOString(),scope,contentHash,allowed:result.allowed});return result;
 }
 return {decision};
}
const rights=createRights();module.exports={canonical,articleContent,digest,createRights,decision:rights.decision};
