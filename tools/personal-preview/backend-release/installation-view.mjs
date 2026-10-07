import { fail } from './files.mjs';
import { RUNTIME_CLOSURE_POLICY, semanticDigest } from './dependency-plan.mjs';
const maximumBytes = 4 * 1024 ** 2;

/** Produces only staging bytes. No file writes, parser loading, package-manager execution or source mutation. */
export function installationView(plan) {
  const view = { manifest: `${JSON.stringify(plan.installationManifest, null, 2)}\n`, lock: `${JSON.stringify(plan.installationLock, null, 2)}\n` };
  verifyInstallationView(plan, view);
  return view;
}

/** Must pass after a future frozen install, before restoring the unchanged original source documents. */
export function verifyInstallationView(plan, view) {
  if (plan?.policy !== RUNTIME_CLOSURE_POLICY || !/^[a-f0-9]{64}$/.test(plan.installationSemanticDigest ?? '')) fail('BACKEND_INSTALLATION_VIEW_INVALID');
  let manifest, lock;
  try {
    if (typeof view?.manifest !== 'string' || typeof view?.lock !== 'string' || Buffer.byteLength(view.manifest) + Buffer.byteLength(view.lock) > maximumBytes) fail('BACKEND_INSTALLATION_VIEW_INVALID');
    manifest = JSON.parse(view.manifest); lock = JSON.parse(view.lock);
  } catch { fail('BACKEND_INSTALLATION_VIEW_INVALID'); }
  if (semanticDigest({ lock, manifest }) !== plan.installationSemanticDigest) fail('BACKEND_INSTALLATION_VIEW_CHANGED');
  return true;
}
