'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const art = require('./interland-artwork247');

test('Nederland krijgt exclusieve premiumvariant', () => {
  assert.deepEqual(art.detect({nationalTeams:true,countryCode:'NL'}),{
    code:'NL',countryName:'Nederland',variant:'netherlands-premium'
  });
});
test('alle geldige landen hebben een universele variant', () => {
  for (const code of ['FR','DE','BE','ES','BR','JP','US','ZA']) {
    const plan=art.detect({isInternational:true,countryCode:code});
    assert.equal(plan.code,code);
    assert.equal(plan.variant,'universal');
  }
});
test('geen internationale beelden voor clubduels of losse landnamen', () => {
  assert.equal(art.detect({countryCode:'NL'}),null);
  assert.equal(art.detect({headline:'Nederland tegen Frankrijk'}),null);
  assert.equal(art.detect({isInternational:true,countryCode:'???'}),null);
});
test('Nederland wordt gekozen zodra een van beide landen NL is', () => {
  assert.equal(art.detect({match:{nationalTeams:true,homeCountryCode:'DE',awayCountryCode:'NL'}}).code,'NL');
});
test('niet-goedgekeurde en ontbrekende beelden worden niet gepubliceerd', () => {
  assert.equal(art.select({isInternational:true,countryCode:'NL'}),null);
  assert.equal(art.select({isInternational:true,countryCode:'FR'}),null);
});
