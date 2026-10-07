import assert from 'node:assert/strict';
import { transferWebArtifact, validateWebTransferInput, runWebTransfer } from './current-web-transfer.mjs';
import { runWebAction, webActionParameters, webActions } from './current-web-actions.mjs';
assert.equal(process.permission.has('fs.read', '/Users/citrine/.flow-personal'), false);
assert.equal(process.permission.has('child'), false);
for (const value of [transferWebArtifact, validateWebTransferInput, runWebTransfer, runWebAction, webActionParameters]) assert.equal(typeof value, 'function');
assert.equal(webActions.length, 3);
console.log(JSON.stringify({ outcome: 'actual-Node-import-with-personal-read-and-child-denied', callableExports: 5, operationalCalls: 0 }));
