"""Task-local command selection; lifecycle and bounded inventory reuse the reviewed OPS14/X01 modules."""
import datetime, hashlib, importlib.util, json, os, shutil, sys, tempfile, time
from pathlib import Path

# Imported helpers must not write caches beside source or a shared donor.
sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / 'docs/evidence/x01'
RECORD = EVIDENCE / 'semver-local.json'

def load(name, path, expected=None):
    data = path.read_bytes()
    if expected and hashlib.sha256(data).hexdigest() != expected: raise ValueError('Fixed module changed')
    spec = importlib.util.spec_from_file_location(name, path); module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module; spec.loader.exec_module(module); return module

ops = load('x01_claim_ops', Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py'), '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d')
facts = load('x01_claim_facts', EVIDENCE / 'enable-binding-check-once.py')
resources = load('x01_claim_resources', EVIDENCE / 'enable-binding-pg-once.py')
label = sys.argv[1]
if label not in ('bundle', 'types', 'tests'): raise ValueError('Only bundle and the two direct consumers are selected')
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
record = json.loads(RECORD.read_text()) if RECORD.exists() else {'startedAt': now(), 'startEpoch': time.time(), 'attempts': [], 'unknown': False,
    'limits': {'segmentSeconds': 1200, 'commands': 4, 'commandSeconds': 60, 'temporaryBytes': 16777216, 'rawBytes': 262144, 'sourceMetadataBytes': 1048576},
    'floorBytes': 4071096320, 'PG': 0, 'provider': 0, 'native': 0, 'tarPlanned': 1, 'wholeExternalWall': None}
if record['unknown'] or len(record['attempts']) >= 4 or time.time()-record['startEpoch'] >= 1140: raise ValueError('Segment exhausted or unknown')
free = shutil.disk_usage(ROOT).free
if free < record['floorBytes']: raise ValueError('Fresh combined floor not met')
root = Path(tempfile.mkdtemp(prefix='flow-x01-semver-')); identity = root.lstat()
step = {'label': label, 'startedAt': now(), 'freeBeforeBytes': free, 'temporary': {'path': str(root), 'dev': identity.st_dev, 'ino': identity.st_ino, 'removed': False}}
record['attempts'].append(step)
RECORD.write_text(json.dumps(record, indent=2)+'\n')
(root/'tmp').mkdir(); (root/'cache').mkdir()
node = '/opt/homebrew/opt/node@24/bin/node'
argv = [node, str(ROOT/'node_modules/typescript/bin/tsc'), '--noEmit', '-p', 'docs/evidence/x01/semver-tsconfig.json'] if label=='types' else [node,
    str(ROOT/'node_modules/vitest/vitest.mjs'), 'run', '--config', 'docs/evidence/x01/semver-vitest.config.mjs', '--configLoader', 'native', '--reporter=json', '--outputFile='+str(root/'tests.json')]
if label == 'bundle':
    fixed = json.loads((EVIDENCE/'semver-inputs.json').read_text())
    for item in fixed['upstream']['files']:
        content = resources.read_regular(Path(item['realpath']), 65536)
        if len(content)!=item['bytes'] or hashlib.sha256(content).hexdigest()!=item['sha256']: raise ValueError('Fixed npm source changed')
    tool = fixed['build']; content = resources.read_regular(Path(tool['realpath']), 16777216)
    if len(content)!=tool['bytes'] or hashlib.sha256(content).hexdigest()!=tool['sha256']: raise ValueError('Fixed bundler changed')
    destination=ROOT/'experiments/plugins/semver-compare/package/index.mjs'
    if destination.exists(): raise ValueError('Bundle already exists; do not silently replace')
    argv=[tool['realpath'],'experiments/plugins/semver-compare/adapter.mjs','--bundle','--platform=neutral','--format=esm','--target=es2023','--minify','--legal-comments=none','--define:process.env.NODE_DEBUG=""','--outfile='+str(destination),'--metafile='+str(root/'bundle.json')]
env = dict(os.environ, TMPDIR=str(root/'tmp'), TMP=str(root/'tmp'), TEMP=str(root/'tmp'), FLOW_X01_BINDING_CACHE=str(root/'cache'),
    FLOW_X01_SEMVER_FACTS=str(root/'fixtures.json'), NODE_DISABLE_COMPILE_CACHE='1')
started = time.monotonic()
try:
    remaining = 196608-sum(x.get('rawBytes',0) for x in record['attempts'])
    result = ops.supervise(ops.Launch(tuple(argv), str(ROOT), env, ops.Ownership.NEW_CHILD_SESSION, ops.Capture.MERGED), ops.Policy(58, .25, .75, remaining))
    process, unknown = facts.supervision_facts(result, label); record['unknown'] |= unknown
    step.update(argv=argv, process=process, raw=(result.stdout+result.stderr).decode('utf-8'), rawBytes=len(result.stdout+result.stderr), rawSha256=hashlib.sha256(result.stdout+result.stderr).hexdigest())
    if not unknown:
        rows, size = resources.tree_sample(root, (identity.st_dev,identity.st_ino), started+60, {'temporaryEntries':4096,'temporaryBytes':16777216})
        step['temporary']['endSample']={'entries':len(rows),'bytes':size,'wholePeakProven':False}
        for name in ('tests.json','fixtures.json','bundle.json'):
            if (root/name).exists(): step[name]=json.loads(resources.read_regular(root/name,131072))
        resources.remove_sample(rows, started+60); step['temporary']['removed']=True
        try: root.lstat(); raise ValueError('Temporary still present')
        except FileNotFoundError: step['temporary']['absent']=True
except Exception as error:
    record['unknown']=True; step['errorType']=type(error).__name__
finally:
    step['finishedAt']=now(); step['elapsedBeforeReceiptSeconds']=time.monotonic()-started
    record['updatedAt']=now(); RECORD.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'label':label,'exit':step.get('process',{}).get('exit_code'),'unknown':record['unknown'],'temporary':step['temporary'],'raw':step.get('raw','')}))
if record['unknown'] or step.get('process',{}).get('exit_code')!=0: raise SystemExit(1)
