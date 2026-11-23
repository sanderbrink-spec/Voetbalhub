'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/automatic-publication.yml'),'utf8');
test('112F: every match copyedit touched in this phase is included in the guarded editorial workflow paths',()=>{
 for(const name of [
  'editorial-match-narrative71.js',
  'editorial-match-gap111.js',
  'editorial-match-copyedit112f.js',
  'test/editorial-match-copyedit112f.test.js'
 ])assert.ok(workflow.includes("      - '"+name+"'"),name);
});
test('112F: push only executes editorial run with explicit validation/publish commit marker',()=>{
 assert.match(workflow,/contains\(github\.event\.head_commit\.message, '\[validate-editorial-generation\]'\)/);
 assert.match(workflow,/if: github\.event_name != 'push' \|\|/);
 assert.match(workflow,/EDITORIAL_VALIDATION_ONLY:/);
 assert.match(workflow,/Verify the matching Render revision/);
 assert.match(workflow,/github\.event_name == 'push'/);
});
