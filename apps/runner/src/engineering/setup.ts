import { mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join } from 'node:path';
import { z } from 'zod';
import type { HarnessAdapter } from '@flow/contracts';
import { executionProfileReferenceSchema, type ExecutionProfileReference } from '../../../../packages/contracts/src/execution-profiles.js';
import { engineeringProfileConfigurationJson, engineeringProfileConfigurationSchema, type EngineeringProfileConfiguration } from '../../../../packages/contracts/src/engineering-profile.js';
import { createEngineeringFixtureAdapter } from './adapter.js';
import { createSyntheticProject, restoreSyntheticProject } from './workspace.js';
import { createTrustedChecker, restoreTrustedChecker } from './checker.js';
import { digest, readTextFile } from './resources.js';
import { directoryIdentity, readDirectoryRecord, recordDirectory } from './identity.js';

const settingsSchema = z.strictObject({ protocol: z.literal('flow.engineering-setup.v1'), recipe: z.literal('calculator-v1'), projectId: z.string().min(1).max(128), checkerTimeoutMs: z.number().int().min(1).max(30_000) });
const childDirectory = z.string().regex(/^flow-(?:engineering|checker)-[A-Za-z0-9]+$/);
const setupRecord = z.strictObject({ settings: settingsSchema, recipeDigest: z.string().regex(/^[a-f0-9]{64}$/), projectDirectory: childDirectory, checkerDirectory: childDirectory, baseCommit: z.string().regex(/^[a-f0-9]{40}$/) });
const recipe = Object.freeze({
  initial: { 'calculator.mjs': 'export const add=(a,b)=>a-b;\nexport const subtract=(a,b)=>a-b;\n' },
  checkerId: 'calculator-checker-v1', expectedChecks: ['sum', 'difference'],
  checkerSource: `import { pathToFileURL } from 'node:url'; import { join } from 'node:path';\nconst {add,subtract}=await import(pathToFileURL(join(process.argv[2],'calculator.mjs')).href);\nconsole.log(JSON.stringify({checks:[{id:'sum',passed:add(5,2)===7},{id:'difference',passed:subtract(5,2)===3}]}));\n`,
  fixedSource: 'export const add=(a,b)=>a+b;\nexport const subtract=(a,b)=>a-b;\n',
});
const recipeDigest = digest(JSON.stringify(recipe));
export interface EngineeringSetup { configuration: EngineeringProfileConfiguration; bind(reference: ExecutionProfileReference): Promise<HarnessAdapter> }

/** Trusted local file chooses one fixed recipe. It cannot supply executable code, paths, expected answers or native grants. */
export async function prepareEngineeringSetup(workingDirectory: string, manifestFile: string): Promise<EngineeringSetup> {
  if (!isAbsolute(workingDirectory) || !isAbsolute(manifestFile)) throw new Error('Engineering setup requires explicit absolute host paths.');
  const settings = settingsSchema.parse(JSON.parse((await readTextFile(manifestFile, 16_384)).content));
  await mkdir(workingDirectory, { recursive: true, mode: 0o700 });
  const parent = await realpath(workingDirectory); await directoryIdentity(parent);
  const root = join(parent, 'engineering-fixture'); let created = false;
  try { await mkdir(root, { mode: 0o700 }); created = true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  let project, checker;
  if (created) {
    // A crash or failed preparation leaves this directory intact; the next start must not rebuild it.
    await recordDirectory(root, 'preparing.json', { recipeDigest });
    project = await createSyntheticProject(root, settings.projectId, recipe.initial);
    checker = await createTrustedChecker(root, recipe.checkerId, recipe.checkerSource, recipe.expectedChecks, settings.checkerTimeoutMs);
    await recordDirectory(root, 'setup.json', { settings, recipeDigest, projectDirectory: basename(project.rootDirectory), checkerDirectory: basename(checker.rootDirectory), baseCommit: project.baseCommit });
    await rm(join(root, 'preparing.json'));
  } else {
    const recorded = await readDirectoryRecord(root, 'setup.json', setupRecord);
    if (JSON.stringify(recorded.settings) !== JSON.stringify(settings) || recorded.recipeDigest !== recipeDigest) throw new Error('Engineering setup configuration changed.');
    project = await restoreSyntheticProject(join(root, recorded.projectDirectory), { id: settings.projectId, baseCommit: recorded.baseCommit });
    checker = await restoreTrustedChecker(join(root, recorded.checkerDirectory), { selection: { id: recipe.checkerId, version: '1', baselineDigest: digest(recipe.checkerSource) }, expectedChecks: recipe.expectedChecks, timeoutMs: settings.checkerTimeoutMs });
  }
  const configuration = engineeringProfileConfigurationSchema.parse({ protocol: 'flow.engineering-profile.v1', harness: 'fixture', adapterVersion: 'engineering-1', purpose: 'engineering-fixture', recipe: settings.recipe,
    project: { id: project.id, baseCommit: project.baseCommit }, checker: checker.selection, limits: { checkerTimeoutMs: settings.checkerTimeoutMs } });
  return { configuration, async bind(input) {
    const reference = executionProfileReferenceSchema.parse(input);
    if (reference.configDigest !== digest(engineeringProfileConfigurationJson(configuration))) throw new Error('The center did not confirm the engineering setup.');
    let saved;
    try { saved = await readDirectoryRecord(root, 'profile-pin.json', executionProfileReferenceSchema); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      try { await recordDirectory(root, 'profile-pin.json', reference); }
      catch (writeError) { if ((writeError as NodeJS.ErrnoException).code !== 'EEXIST') throw writeError; }
      saved = await readDirectoryRecord(root, 'profile-pin.json', executionProfileReferenceSchema);
    }
    if (JSON.stringify(saved) !== JSON.stringify(reference)) throw new Error('Engineering setup belongs to another published identity.');
    const adapter = createEngineeringFixtureAdapter(reference.runnerId, [{ project, checker, async execute({ directory, leaseId, signal }) {
      // This fixed writer owns one awaited file operation and starts no child or background work.
      try {
        signal.throwIfAborted(); await writeFile(join(directory, 'calculator.mjs'), recipe.fixedSource); signal.throwIfAborted();
        return { leaseId, settlement: 'stopped', outcome: 'completed' };
      } catch { return { leaseId, settlement: 'stopped', outcome: 'failed' }; }
    } }]);
    return { ...adapter, async run(context) {
      const selected = context.task.engineering?.profile;
      if (!selected || JSON.stringify(executionProfileReferenceSchema.parse(selected)) !== JSON.stringify(reference)) throw new Error('The engineering task does not match the immutable setup pin.');
      await adapter.run(context);
    } };
  } };
}
