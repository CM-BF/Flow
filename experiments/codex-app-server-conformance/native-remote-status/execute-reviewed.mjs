import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReviewedEntry } from '../native-catalog-observation/execute-reviewed.mjs';
import { recordNotification } from './notifications.mjs';
export { prepareDelivery } from '../native-catalog-observation/execute-reviewed.mjs';

export const { executeReviewed, runCli } = createReviewedEntry('native-remote-status', recordNotification);
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runCli();
