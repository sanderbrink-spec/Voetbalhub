'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const stadium=require('../stadium-venue74');
const library=require('../image-library49.json').assets;
const premium=require('../premium-match-images72');
const findings=require('../stadium-review-findings79.json');
const prescreen=require('../stadium-visual-prescreen106d.json');

test('109B official named stadium sponsorship can identify a venue without approving advertisements',()=>{
 assert.ok(stadium.aliases('AZ').includes('AFAS Stadion'));
 assert.equal(stadium.safeHomeVenue('AZ','venue:'+stadium.norm('AFAS Stadion')),true);
 assert.equal(stadium.safeHomeVenue('AZ','venue:'+stadium.norm('AFAS Software')),false);
 assert.ok(stadium.aliases('Excelsior Rotterdam').includes('Woudestein'));
 assert.equal(stadium.safeHomeVenue('Excelsior Rotterdam','venue:'+stadium.norm('Woudestein')),true);
 assert.equal(stadium.safeHomeVenue('Excelsior Rotterdam','venue:'+stadium.norm('Stadion Woudestein')),true);
 assert.equal(stadium.safeHomeVenue('Excelsior Rotterdam','venue:'+stadium.norm('Van Donge & De Roo Stadion')),false);
});
test('109B AZ and Excelsior review findings distinguish factual current name from independent artwork risk',()=>{
 const f=findings.findings;
 assert.equal(f['veldio74-az-report'].level,'compare');
 assert.match(f['veldio74-az-report'].reason,/AFAS Stadion/);
 assert.match(f['veldio74-az-preview'].reason,/bezette tribunes/);
 assert.equal(f['veldio74-az-preview'].level,'rebuild');
 assert.match(f['veldio74-excelsiorrotterdam-preview'].reason,/Van Donge.*De Roo/);
 assert.match(f['veldio74-excelsiorrotterdam-report'].reason,/Woudestein/);
 assert.match(f['veldio74-excelsiorrotterdam-report'].reason,/clubemblemen/);
 assert.equal(Object.keys(f).length,8);
 assert.equal(Object.values(f).filter(x=>x.level==='rebuild').length,3);
 assert.equal(Object.values(f).filter(x=>x.level==='compare').length,3);
 assert.equal(Object.values(f).filter(x=>x.level==='identity').length,2);
});
test('109B corrected stadium name cannot bypass approval of pending images or disguise club emblems',()=>{
 for(const id of ['veldio74-az-report','veldio74-az-preview',
  'veldio74-excelsiorrotterdam-report','veldio74-excelsiorrotterdam-preview']){
  const image=library.find(a=>a.id===id);
  assert.ok(image,id);
  assert.equal(image.approval,'pending');
  assert.equal(premium.accepted(image),false);
  assert.ok(findings.findings[id]);
 }
 const az=prescreen.withheld.find(x=>x.id==='veldio74-az-report');
 const excelsior=prescreen.withheld.find(x=>x.id==='veldio74-excelsiorrotterdam-report');
 assert.match(az.reason,/feitelijk correct/);
 assert.match(excelsior.reason,/ronde clubemblemen/);
 assert.equal(prescreen.approvalGranted,0);
});
