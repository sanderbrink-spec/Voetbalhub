'use strict';
/** Only checked originals may advance the weekly slot. No invented filler on source failure. */
const fs=require('node:fs'),path=require('node:path'),m=require('../stadium-editorial');
const REPO='sanderbrink-spec/Voetbalhub',BRANCH='editorial-media';
async function request(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(12000),redirect:'error'});if(!r.ok)throw Error('HTTP '+r.status);const body=await r.text();if(Buffer.byteLength(body)>3000000)throw Error('Response too large');return JSON.parse(body);}
async function githubFile(file){try{return await request(`https://api.github.com/repos/${REPO}/contents/${file}?ref=${BRANCH}`,{headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json'}});}catch(e){if(e.message==='HTTP 404')return null;throw e;}}
async function put(file,data,previous){const json=JSON.stringify(data,null,2)+'\n';return request(`https://api.github.com/repos/${REPO}/contents/${file}`,{method:'PUT',headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,'Content-Type':'application/json',Accept:'application/vnd.github+json'},body:JSON.stringify({message:'Update checked Veldio '+file+' [backend-only]',branch:BRANCH,content:Buffer.from(json).toString('base64'),...(previous?{sha:previous.sha}:{})})});}
function decoded(file){if(file?.encoding!=='base64'||!file.content)throw Error('Invalid media snapshot');return JSON.parse(Buffer.from(file.content,'base64').toString());}
async function run(){
 if(!process.env.GITHUB_TOKEN)throw Error('GITHUB_TOKEN missing');
 const report={checkedAt:new Date().toISOString(),news:'unchanged',stadium:'unchanged'};
 try{const feed=await request('https://voetbalhub-redactie.onrender.com/articles');if(!Array.isArray(feed.articles)||!feed.articles.length)throw Error('Empty feed');
  const safe=feed.articles.filter(a=>a.status==='published'&&a.id&&a.headline&&a.body?.length>=3&&(['originalSourceReviewed','claimsIndependentlyChecked','duplicateChecked','languageChecked'].every(k=>a.editorialChecks?.[k]===true)||a.authorApproval?.explicit===true));if(!safe.length)throw Error('No reviewed feed');
  // Never strip an explicit policy envelope: an expired policy is not a legacy feed.
  if(feed.rightsPolicyVersion!==undefined&&(feed.rightsPolicyVersion!==26||feed.rightsExpiresAt<=Date.now()))throw Error('Expired rights policy');
  const file=await githubFile('news/current.json'),old=file?decoded(file):null;
  if(JSON.stringify(old?.articles)!==JSON.stringify(safe)){await put('news/current.json',{...feed,articles:safe,count:safe.length,mirroredAt:report.checkedAt,source:'https://voetbalhub-redactie.onrender.com/articles'},file);report.news='updated';}else report.news='unchanged';
 }catch(e){report.news='kept_previous: '+e.message;}
 const file=await githubFile('stadium/current.json');
 let state=file?decoded(file):require('../android-ui/assets/stadium-bootstrap.json');const catalog=require('../news-photo-catalog.json'),registry=require('../stadium/registry.json');
 state.articles.forEach(a=>m.validateArticle(a,catalog));
 const seed=require('../android-ui/assets/stadium-bootstrap.json').articles[0];m.validateArticle(seed,catalog);
 const seedChanged=state.articles.some(a=>a.id===seed.id&&a.contentHash!==seed.contentHash&&a.reviewedAt<=seed.reviewedAt);
 if(seedChanged)state={...state,articles:state.articles.map(a=>a.id===seed.id?seed:a)};
 const venue=m.nextVenue(registry,state.articles),candidateFile=venue&&path.join(__dirname,'../stadium/candidates',venue.venueId+'.json');
 let candidate=candidateFile&&fs.existsSync(candidateFile)?JSON.parse(fs.readFileSync(candidateFile)):null;
 if(!candidate&&venue){const ready=await githubFile('stadium/ready/'+venue.venueId+'.json');if(ready)candidate=decoded(ready);}
 const tick=m.slot(Date.now());
 if(!candidate&&venue&&(tick.due||process.env.STADIUM_PREPARE==='1')&&state.lastPublishedWeek!==tick.key&&process.env.GROQ_API_KEY)try{
  const generated=await require('../stadium-research').research(venue,catalog);candidate=generated.article;
  fs.mkdirSync('.stadium-output',{recursive:true});fs.writeFileSync('.stadium-output/research.json',JSON.stringify(generated.evidence,null,2));report.research='passed';await put('stadium/ready/'+venue.venueId+'.json',candidate,null);
 }catch(e){report.research='kept_previous: '+e.message;}
 // Refresh every cited primary source before advancing; a dead page retains the prior feature.
 if(candidate)try{for(const source of candidate.sources){const response=await fetch(source.url,{signal:AbortSignal.timeout(10000),redirect:'error'});if(!response.ok)throw Error('Source unavailable');await response.body.cancel();}}catch(e){candidate=null;report.sourceCheck=e.message;}
 const result=m.advance(state,candidate,registry,catalog,Date.now());report.stadium=result.reason;report.nextVenue=venue?.venueId;
 if(!file||result.published||seedChanged)await put('stadium/current.json',result.state,file);
 fs.mkdirSync('.stadium-output',{recursive:true});fs.writeFileSync('.stadium-output/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
if(require.main===module)run().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={decoded};
