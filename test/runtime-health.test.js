'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withDeadline, readiness, revision} = require('../runtime-health');

test('readiness probes Redis, including a stalled socket reported as ready', async () => {
  assert.equal(await readiness(null), false);
  let calls = 0;
  assert.equal(await readiness({isReady:false, ping(){calls++;}}), false);
  assert.equal(calls, 0);
  assert.equal(await readiness({isReady:true, ping:async () => 'PONG'}), true);
  assert.equal(await readiness({isReady:true, ping:async () => 'unexpected'}), false);
  assert.equal(await readiness({isReady:true, ping:async () => {throw Error('disconnected');}}), false);
  assert.equal(await readiness({isReady:true, ping:() => new Promise(() => {})}, 20), false);
  const client = {isReady:true, ping:async () => {client.isReady=false;return 'PONG';}};
  assert.equal(await readiness(client), false);
});

test('feed deadline rejects stalled storage and preserves normal results and errors', async () => {
  await assert.rejects(withDeadline(() => new Promise(() => {}), 20), /READ_TIMEOUT/);
  const rows = [{id:'retained'}];
  assert.equal(await withDeadline(() => rows, 100), rows);
  await assert.rejects(withDeadline(() => {throw Error('storage failed');}, 100), /storage failed/);
  let rejectLater;
  const late = new Promise((_, reject) => {rejectLater=reject;});
  await assert.rejects(withDeadline(() => late, 20), /READ_TIMEOUT/);
  rejectLater(Error('late storage failure'));
  await new Promise(resolve => setImmediate(resolve));
});

test('health exposes only a validated deployment revision', () => {
  const sha='4c2f54a550ac2edd6e5f43b61bd5b4c520c7f82b';
  assert.equal(revision({RENDER_GIT_COMMIT:sha}), sha);
  assert.equal(revision({}), null);
  assert.equal(revision({RENDER_GIT_COMMIT:'invalid or sensitive content'}), null);
});
