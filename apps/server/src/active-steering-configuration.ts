/** Trusted process configuration only. Never accept this switch from an HTTP request. */
export function parseActiveSteeringConfiguration(raw?: string): boolean {
  if (raw === undefined || raw === '0') return false;
  if (raw === '1') return true;
  throw new Error('FLOW_ACTIVE_STEERING must be absent, 0 or 1.');
}
