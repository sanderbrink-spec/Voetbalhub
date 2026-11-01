import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.js";

const env = { HUB_API_SECRET: "test-secret" };
const req = (path, method="GET", body=null, token=null) => new Request("https://worker.test"+path,{
 method, headers:{...(body!==null?{"Content-Type":"application/json"}:{}),...(token?{Authorization:"Bearer "+token}:{})},
 ...(body!==null?{body:JSON.stringify(body)}:{})
});

test("health endpoint reports publishing disabled", async()=>{
 const res=await worker.fetch(req("/health"),env);
 assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.ok,true);
 assert.equal(data.publishing,false);
});

test("unknown route returns 404",async()=>{
 const res=await worker.fetch(req("/not-real"),env);
 assert.equal(res.status,404);
});

test("draft requires authorization",async()=>{
 const res=await worker.fetch(req("/draft","POST",{}),env);
 assert.equal(res.status,401);
});

test("draft requires topic and two facts before calling AI",async()=>{
 const res=await worker.fetch(req("/draft","POST",{topic:"Test",facts:["Een feit"]},"test-secret"),env);
 assert.equal(res.status,400);
});

test("publish requires explicit approval",async()=>{
 const res=await worker.fetch(req("/publish","POST",{approved:false},"test-secret"),{...env,EDITORIAL_KV:{put:async()=>{throw new Error("must not write")}}});
 assert.equal(res.status,400);
});

test("articles endpoint requires KV configuration",async()=>{
 const res=await worker.fetch(req("/articles"),env);
 assert.equal(res.status,503);
});

test("CORS allows only configured dashboard origin",async()=>{
 const configured={...env,ALLOWED_ORIGINS:"https://sanderbrink-spec.github.io"};
 const allowed=await worker.fetch(new Request("https://worker.test/health",{headers:{Origin:"https://sanderbrink-spec.github.io"}}),configured);
 assert.equal(allowed.headers.get("Access-Control-Allow-Origin"),"https://sanderbrink-spec.github.io");
 const denied=await worker.fetch(new Request("https://worker.test/health",{headers:{Origin:"https://evil.example"}}),configured);
 assert.equal(denied.headers.get("Access-Control-Allow-Origin"),null);
});
test("CORS preflight permits configured origin and authorization header",async()=>{
 const configured={...env,ALLOWED_ORIGINS:"https://sanderbrink-spec.github.io"};
 const res=await worker.fetch(new Request("https://worker.test/draft",{method:"OPTIONS",headers:{Origin:"https://sanderbrink-spec.github.io","Access-Control-Request-Method":"POST"}}),configured);
 assert.equal(res.status,204);
 assert.match(res.headers.get("Access-Control-Allow-Headers"),/Authorization/);
});

test("articles endpoint returns only published entries sorted newest first",async()=>{
 const values={
  "article:draft":JSON.stringify({id:"draft",status:"draft",publishedAt:"2026-10-23T12:00:00Z"}),
  "article:old":JSON.stringify({id:"old",status:"published",publishedAt:"2026-10-20T12:00:00Z"}),
  "article:new":JSON.stringify({id:"new",status:"published",publishedAt:"2026-10-23T12:00:00Z"})
 };
 const kv={list:async({prefix})=>({keys:Object.keys(values).filter(k=>k.startsWith(prefix)).map(name=>({name}))}),get:async k=>values[k]||null};
 const approval={scope:"publication",contentHash:"44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",status:"approved",evidenceRef:"private:fictional-fixture",basis:"Fictieve lege testartikelen",reviewer:"Test",reviewedAt:"2026-01-01",validUntil:"2099-01-01"};
 const res=await worker.fetch(req("/articles"),{...env,EDITORIAL_KV:kv,CONTENT_RIGHTS_JSON:JSON.stringify({version:1,approvals:[approval]})});
 assert.equal(res.status,200);
 const data=await res.json();
 assert.deepEqual(data.articles.map(a=>a.id),["new","old"]);
});
test("inbox fails safely when feed allowlist is not configured",async()=>{
 const res=await worker.fetch(req("/inbox","POST",{},"test-secret"),env);
 assert.equal(res.status,400);
 assert.match((await res.json()).error,/ALLOWED_FEED_URLS/);
});

test("stored inbox requires authorization",async()=>{
 const res=await worker.fetch(req("/inbox"),{...env,EDITORIAL_KV:{list:async()=>({keys:[]})}});
 assert.equal(res.status,401);
});
test("stored inbox returns saved feed leads in reverse date order",async()=>{
 const values={
  "inbox:2026-10-20":JSON.stringify([{title:"Oud nieuws",link:"https://news.example/old",status:"needs_editor_review"}]),
  "inbox:2026-10-23":JSON.stringify([{title:"Nieuw nieuws",link:"https://news.example/new",status:"needs_editor_review"}])
 };
 const kv={list:async({prefix})=>({keys:Object.keys(values).filter(k=>k.startsWith(prefix)).map(name=>({name}))}),get:async k=>values[k]||null};
 const res=await worker.fetch(req("/inbox","GET",null,"test-secret"),{...env,EDITORIAL_KV:kv});
 assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.count,2);
 assert.equal(data.items[0].title,"Nieuw nieuws");
 assert.equal(data.autoPublish,false);
});

test("configured feed URL does not authorize external collection",async()=>{
 const res=await worker.fetch(req("/inbox","POST",{},"test-secret"),{...env,ALLOWED_FEED_URLS:"https://news.example/feed.xml"});
 assert.equal(res.status,403);assert.match((await res.json()).error,/Feedrechten/);
});

test("worker blocks AI and legacy public content without server evidence",async()=>{
 const ai=await worker.fetch(req("/draft","POST",{topic:"Test",facts:["Een feit","Tweede feit"],rightsCleared:true},"test-secret"),{...env,OPENAI_API_KEY:"test-only"});assert.equal(ai.status,403);
 const kv={list:async()=>({keys:[{name:"article:old"}]}),get:async()=>JSON.stringify({status:"published",headline:"Niet vrijgegeven",imageRights:"cleared"})};
 const feed=await worker.fetch(req("/articles"),{...env,EDITORIAL_KV:kv});assert.deepEqual((await feed.json()).articles,[]);
});
