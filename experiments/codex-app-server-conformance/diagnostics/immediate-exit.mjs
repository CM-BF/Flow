// Owned synthetic capture control: no imports beyond local fs, no provider/network/account.
import { writeSync } from 'node:fs';
for (const bytes of [Buffer.from('flow-diag-prefix\n'), Buffer.from('中🙂'), Buffer.from('\nflow-diag-tail\n')]) {
  let offset = 0;
  while (offset < bytes.length) offset += writeSync(2, bytes, offset, bytes.length - offset);
}
process.exit(7);
