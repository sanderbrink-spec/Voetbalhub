'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {run}=require('../scripts/sync-article-covers');
const entries=require('../article-covers.json');
const packets=[require('../redactie/curated/articles.json')[0],require('../redactie/trial/article.json')];
function harness({changed=false,broken=false,existing=false,unpublished=false,missingAfterWrite=false}={}){
 const rows=packets.map((p,i)=>({...structuredClone(p.payload.draft),id:'11111111-1111-4111-8111-11111111111'+i,status:unpublished?'draft':'published',publishedAt:'2026-10-30T10:00:00Z',imageRights:'not_needed'}));
 if(changed)for(const row of rows)row.body[0]+=' Gewijzigde wedstrijd.';
 if(existing)for(const row of rows)row.imageUrl='https://example.org/editor-photo.webp';
 const writes=[];
 async function fetcher(url,options={}){
  if(url.endsWith('/articles'))return {ok:true,json:async()=>({articles:structuredClone(rows)})};
  if(url.includes('raw.githubusercontent.com')){
   const entry=entries.find(e=>e.imageUrl===url);assert.ok(entry);assert.equal(options.redirect,'error');
   return {ok:true,headers:new Headers({'Content-Type':'image/webp'}),arrayBuffer:async()=>broken?Buffer.from('wrong artwork'):fs.readFileSync(path.join(__dirname,'../public/article-covers',entry.file))};
  }
  assert.ok(url.endsWith('/article-image'));assert.equal(options.headers.Authorization,'Bearer test-secret');
  const body=JSON.parse(options.body);writes.push(body);
  const row=rows.find(r=>r.id===body.articleId);
  if(!missingAfterWrite)Object.assign(row,{imageUrl:body.imageUrl,imageRights:body.imageRights,imageCredit:body.imageCredit});
  return {ok:true,json:async()=>({updated:true,article:{id:row.id,imageUrl:body.imageUrl}})};
 }
 return {fetcher,writes,rows};
}
test('two matching articles receive the verified assets and retries are idempotent',async()=>{
 const h=harness();assert.equal((await run({secret:'test-secret',fetcher:h.fetcher})).updated,2);
 assert.equal(h.writes.length,2);assert.notEqual(h.writes[0].imageUrl,h.writes[1].imageUrl);
 for(const write of h.writes){assert.equal(write.approved,true);assert.match(write.imageCredit,/AI-illustratie/);assert.equal(write.imageReview.aiDisclosureVerified,true);}
 assert.equal((await run({secret:'test-secret',fetcher:h.fetcher})).updated,0);
 assert.equal(h.writes.length,2);
});
test('changed copy, private drafts and editor-selected images are untouched',async()=>{
 for(const options of [{changed:true},{existing:true},{unpublished:true}]){
  const h=harness(options);assert.equal((await run({secret:'test-secret',fetcher:h.fetcher})).updated,0);assert.equal(h.writes.length,0);
 }
});
test('different hosted bytes block publication before any write',async()=>{
 const h=harness({broken:true});await assert.rejects(run({secret:'test-secret',fetcher:h.fetcher}),/wijkt af/);assert.equal(h.writes.length,0);
});
test('success requires public feed verification and configured authentication',async()=>{
 const h=harness({missingAfterWrite:true});await assert.rejects(run({secret:'test-secret',fetcher:h.fetcher}),/ontbreekt in de openbare feed/);
 await assert.rejects(run({fetcher:()=>{throw Error('unexpected');}}),/Redactiesleutel/);
});
