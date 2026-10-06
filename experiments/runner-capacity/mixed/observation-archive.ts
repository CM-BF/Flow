import type { RunContract } from './contract.js';
import type { Observation } from './process.js';

/** Reserve the final compact JSON before retaining each record; transport is counted separately. */
export class ObservationArchive {
  readonly records: Observation[] = [];
  private reserved = 2;
  constructor(private readonly contract: RunContract, private readonly charge: (bytes: number) => void) {
    if (contract.reserveObservations) charge(2);
  }
  append(record: Observation) {
    if (this.records.length >= this.contract.maxRecords) throw new Error('observation_count_exceeded');
    if (this.contract.reserveObservations) {
      const bytes = Buffer.byteLength(JSON.stringify(record));
      if (bytes > this.contract.responseBytes) throw new Error('observation_record_too_large');
      const delta = bytes + (this.records.length ? 1 : 0);
      this.charge(delta); this.reserved += delta;
    }
    this.records.push(record);
  }
  get prepaidBytes() { return this.contract.reserveObservations ? this.reserved : undefined; }
}
