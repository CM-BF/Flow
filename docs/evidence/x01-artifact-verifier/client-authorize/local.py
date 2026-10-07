"""One bounded local record; existing OPS14 is the sole process supervisor."""
from pathlib import Path
import dataclasses, datetime, hashlib, importlib.util, json, os, sys, time
sys.dont_write_bytecode = True
R = Path(__file__).resolve().parents[4]; E = Path(__file__).resolve().parent; B = E / 'inputs'
name = sys.argv[1]; assert name in ('behavior', 'types', 'behavior-fix', 'types-fix')
record = E / 'local.json'; state = json.loads(record.read_text()) if record.exists() else {'attempts': []}
assert len(state['attempts']) < 3
used = sum(x['supervision']['elapsed_ms'] for x in state['attempts']); rawused = sum(x['raw']['bytes'] for x in state['attempts'])
assert used < 45000 and rawused < 131072
canonical = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform/resource-window-current.json')
c = json.loads(canonical.read_text()); f = c['forwardAdmission']; floor = f['minimumFreshFreeBytes']; terms = f['termsBytes']
assert floor == sum(terms.values()) and terms['MikaVerifierClientAuthorizeOrdinary'] == 4194304
free = os.statvfs(R).f_bavail * os.statvfs(R).f_frsize; assert free >= floor
node = '/opt/homebrew/opt/node@24/bin/node'
cmd = ([node, str(R/'node_modules/typescript/bin/tsc'), '--noEmit', '-p', str(E/'tsconfig.json')] if name.startswith('types') else
       [node, str(R/'node_modules/vitest/vitest.mjs'), 'run', '--config', str(E/'vitest.config.mjs'), '--no-cache', 'packages/client/src/plugin-runner.test.ts', '-t', 'verifier phase client|phase request preserves stable key', '--reporter=json'])
supply = json.loads((E/'supply.json').read_text())
for row in supply['rows']:
    p = R / row['path']; assert str(p.resolve()) == row['realpath'] and p.stat().st_size == row['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest() == row['sha256']
for rel in ('packages/client/src/plugin-runner.ts','packages/client/src/plugin-runner.test.ts'):
    assert (R/rel).read_bytes() == (B/rel).read_bytes()
ops_path = R/'tools/owned-process-supervision/supervise.py'
assert hashlib.sha256(ops_path.read_bytes()).hexdigest() == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
out = E/name; out.mkdir(); tmp = out/'tmp'; tmp.mkdir(); ident = tmp.lstat()
stamp = lambda: datetime.datetime.now(datetime.UTC).isoformat(timespec='milliseconds').replace('+00:00','Z')
def save(p, value): p.write_text(json.dumps(value, indent=2)+'\n')
started = stamp(); clock = time.monotonic(); maximum = min(20, (45000-used)/1000); assert maximum >= 5
save(out/'reservation.json', {'startedAt':started,'command':cmd,'canonicalAt':c.get('recordedAt'),'canonicalState':c['state'],'floor':floor,'terms':terms,'free':free,'tmp':{'path':str(tmp),'dev':ident.st_dev,'ino':ident.st_ino},'maxSeconds':maximum,'cleanupReservedSeconds':5,'cumulativeMaxSeconds':45,'rawMaxBytes':131072,'tmpMaxBytes':524288})
spec=importlib.util.spec_from_file_location('client_authorize_ops14',ops_path); ops=importlib.util.module_from_spec(spec);sys.modules[spec.name]=ops;spec.loader.exec_module(ops)
env={'PATH':'/usr/bin:/bin','LANG':'C','LC_ALL':'C','TZ':'UTC','TMPDIR':str(tmp),'TMP':str(tmp),'TEMP':str(tmp),'NODE_DISABLE_COMPILE_CACHE':'1','NO_COLOR':'1','FORCE_COLOR':'0','PYTHONDONTWRITEBYTECODE':'1'}
result=ops.supervise(ops.Launch(tuple(cmd),str(R),env,ops.Ownership.NEW_CHILD_SESSION,ops.Capture.MERGED),ops.Policy(maximum-5,2,3,131072-rawused))
raw=result.stdout;(out/'output.log').write_bytes(raw);rep=dataclasses.asdict(result);rep.pop('stdout');rep.pop('stderr')
code=None if result.first_failure is None else result.first_failure.get('code')
closed=result.exit_code is not None and result.owned_state=='absent' and result.eof=={'stdout':True} and result.observed_bytes==result.retained_bytes==len(raw) and not result.secondary_failures and code in (None,'CHILD_EXIT_NONZERO') and not any(s.get('state')=='unknown' for s in result.signals)
cleanup={'knownProcessClosed':closed,'removed':False,'retained':str(tmp),'dev':ident.st_dev,'ino':ident.st_ino}
if closed:
    current=tmp.lstat();same=current.st_dev==ident.st_dev and current.st_ino==ident.st_ino and not tmp.is_symlink() and tmp.resolve()==tmp
    entries=list(tmp.iterdir()) if same else None
    if same and entries==[]:
        tmp.rmdir()
        try: tmp.lstat()
        except FileNotFoundError: cleanup.update(removed=True,retained=None,endSampleEntries=0,endSampleBytes=0,exactAbsence='ENOENT')
state['attempts'].append({'name':name,'startedAt':started,'endedAt':stamp(),'wallBeforePersistenceSeconds':time.monotonic()-clock,'supervision':rep,'cleanup':cleanup,'raw':{'path':str((out/'output.log').relative_to(R)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()},'sourceHashes':{str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [Path(__file__),E/'vitest.config.mjs',E/'tsconfig.json',E/'supply.json',B/'packages/client/src/plugin-runner.ts',B/'packages/client/src/plugin-runner.test.ts']}})
save(record,state);print(json.dumps({'name':name,'exit':result.exit_code,'pid':result.pid,'elapsedMs':result.elapsed_ms,'owned':result.owned_state,'eof':result.eof,'rawBytes':len(raw),'cleanup':cleanup}));sys.exit(0 if result.exit_code==0 and closed and cleanup['removed'] else 1)
