// Inert thin entry for the one fixed Sandbox syscall-67 candidate.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runReviewedCli } from '../fd-canary/execute-reviewed.mjs';
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runReviewedCli('sandbox67');
