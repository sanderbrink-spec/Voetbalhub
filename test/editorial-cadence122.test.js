'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const workflow=fs.readFileSync(require('node:path').join(__dirname,'../.github/workflows/automatic-publication.yml'),'utf8');
test('122 production scans every 15 minutes without overlapping runs',()=>{
 assert.match(workflow,/cron: '8,23,38,53 \* \* \* \*'/);
 assert.match(workflow,/group: automatic-verified-editorial-publication/);
 assert.match(workflow,/cancel-in-progress: false/);
});
test('122 full software suite on revision/manual, safety tests and exact live SHA on scheduled production',()=>{
 assert.match(workflow,/Validate publication gates for a new revision or manual proof\n\s+if: github.event_name != 'schedule'\n\s+run: npm test/);
 assert.match(workflow,/Scheduled publication safety checks\n\s+if: github.event_name == 'schedule'/);
 assert.match(workflow,/node --test test\/editorial-registration118.test.js test\/editorial-evidence121.test.js test\/editorial-provider-router.test.js/);
 assert.match(workflow,/\.ready and \.revision == \$sha/);
 assert.match(workflow,/run: node scripts\/automatic-publication.js/);
 assert.match(workflow,/sportmonks_only:[\s\S]*?default: false/);
});
