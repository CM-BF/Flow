import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareBackendArtifact, verifyBackendArtifact } from './index.mjs';
const directory = await mkdtemp(join(tmpdir(),'flow-svc06-artifact-'));
await writeFile('/tmp/flow-svc06-artifact-location.json',JSON.stringify({directory}));
try {
 const artifact = await prepareBackendArtifact({ repository: process.cwd(), target: process.env.SVC06_TARGET, directory, offlineStore: '/Users/citrine/Library/pnpm/store/v3', pnpmCli: '/opt/homebrew/lib/node_modules/pnpm/bin/pnpm.cjs' });
 const verified = await verifyBackendArtifact({directory, artifact});
 const result = {directory, artifact, bytes:verified.manifest.inventory.bytes, entries:verified.manifest.inventory.entries.length, nodeImages:verified.manifest.node.images.length, root:verified.root};
 await writeFile('/tmp/flow-svc06-artifact-location.json',JSON.stringify(result));console.log(JSON.stringify(result));
} catch(error){console.error(JSON.stringify({directory,code:error.code,message:error.message}));process.exitCode=1;}
