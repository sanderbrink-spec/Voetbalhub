'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {scanOfficialIndexes}=require('../scripts/editorial-discovery53');

test('124A index scan isolates outages, preserves ordering and caps concurrency per origin',async()=>{
 const indexes=['www.uefa.com/a','uefa.com/b','club1.example/a','club2.example/a','club3.example/a','club4.example/a','club5.example/a','uefa.com/c'].map(path=>({url:'https://'+path}));
 let active=0, peak=0;
 const busy=new Set(),seen=[];
 const result=await scanOfficialIndexes(indexes,async index=>{
  const host=new URL(index.url).hostname.replace(/^www\./,'');
  assert.equal(busy.has(host),false);
  busy.add(host);active++;peak=Math.max(peak,active);seen.push(index.url);
  try{
   await new Promise(resolve=>setImmediate(resolve));
   if(index.url.endsWith('/b'))throw Error('HTTP 403');
   return [index.url];
  }finally{busy.delete(host);active--;}
 });
 assert.equal(peak,4);
 assert.equal(active,0);
 assert.equal(seen.length,indexes.length);
 assert.equal(result[1].status,'rejected');
 assert.equal(result[1].reason.message,'HTTP 403');
 for(const [i,index] of indexes.entries())if(i!==1)assert.deepEqual(result[i],{status:'fulfilled',value:[index.url]});
});
test('124A empty index configuration makes no requests',async()=>{
 assert.deepEqual(await scanOfficialIndexes([],()=>{throw Error('unexpected request');}),[]);
});
