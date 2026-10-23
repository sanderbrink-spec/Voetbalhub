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
