"""One bounded operator for preparation checks and a separately authorized future PG run.
No mode runs without an explicit, unexpired operator permit; a permit is not a grant generator.
"""
from pathlib import Path
import argparse, dataclasses, datetime, hashlib, importlib.util, json, os, sys, time
ROOT=Path(__file__).resolve().parent
WT=ROOT.parents[1]
NODE=Path('/opt/homebrew/opt/node@24/bin/node')
SUPERVISOR=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py')
SUPERVISOR_SHA='725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def write_new(path, value):
    data=(json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode()
    if len(data)>262144: raise ValueError('record budget')
    with path.open('xb') as f: f.write(data); f.flush(); os.fsync(f.fileno())
def logical_bytes(directory):
    return sum(p.stat().st_size for p in directory.rglob('*') if p.is_file() and not p.is_symlink() and 'node_modules' not in p.parts)
def verify_inputs():
    manifest=json.loads((ROOT/'source-inputs.json').read_text())
    for row in manifest['items']:
        p=ROOT/'source'/row['path']
        if p.stat().st_size!=row['bytes'] or sha(p)!=row['sha256']: raise ValueError('fixed source mismatch '+row['path'])
    dependencies=json.loads((ROOT/'dependencies.json').read_text())
    for row in dependencies['items'] if isinstance(dependencies,dict) else dependencies:
        p=Path(row['target'])/'package.json'
        if p.stat().st_size!=row['packageJsonBytes'] or sha(p)!=row['packageJsonSha256']: raise ValueError('dependency package metadata mismatch')
    if logical_bytes(ROOT)>32*1024*1024: raise ValueError('preparation total budget')
    if sha(SUPERVISOR)!=SUPERVISOR_SHA: raise ValueError('OPS14 changed')
    return manifest

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('mode',choices=['pure','types','pg']); parser.add_argument('--permit',required=True,type=Path)
    args=parser.parse_args(); started=time.time(); permit=json.loads(args.permit.read_text())
    now=datetime.datetime.now(datetime.timezone.utc)
    deadline=datetime.datetime.fromisoformat(permit['expiresAt'].replace('Z','+00:00'))
    if args.mode not in permit.get('modes',[permit.get('mode')]) or permit.get('state')!='OPEN' or now>=deadline: raise ValueError('not OPEN')
    # Permit records actual manager resource release (local) or reviewed source + actual PG window.
    if not permit.get('authority') or not permit.get('sourceHead'): raise ValueError('missing permit provenance')
    manifest=verify_inputs()
    state=ROOT/'.local'; state.mkdir(exist_ok=True)
    if len(list(state.glob('check-*.started.json')))!=len(list(state.glob('check-*.result.json'))): raise ValueError('prior child unknown; HOLD')
    results=[json.loads(p.read_text()) for p in state.glob('check-*.result.json')]
    if any(not r['resourceConfirmed'] for r in results): raise ValueError('prior supervision UNKNOWN; HOLD')
    maximum=120 if args.mode=='pg' else 30
    if (deadline-now).total_seconds()<maximum: raise ValueError('insufficient absolute permit time')
    if args.mode!='pg' and (len(results)>=5 or sum(r['elapsed_ms'] for r in results)+30000>90000): raise ValueError('local iteration budget')
    if args.mode=='pg':
        if permit.get('reviewed') is not True or permit.get('fixedProduct')!=manifest['base']: raise ValueError('PG source review missing')
        expected=permit.get('experimentFiles')
        required={p.name for p in ROOT.iterdir() if p.is_file() and p.name!='preparation.json'}
        if not isinstance(expected,list) or {r.get('path') for r in expected}!=required: raise ValueError('complete experiment binding required')
        for row in expected:
            p=ROOT/row['path']
            if p.parent!=ROOT or p.stat().st_size!=row['bytes'] or sha(p)!=row['sha256']: raise ValueError('experiment binding mismatch')
        namespace=state/'pg-once'; namespace.mkdir(mode=0o700) # existing means no retry, including partial/unknown
        argv=[str(NODE),'--import','tsx',str(ROOT/'run.ts')]
    else:
        namespace=state
        argv=[str(NODE),str(ROOT/'node_modules'/('vitest/vitest.mjs' if args.mode=='pure' else 'typescript/bin/tsc'))]
        argv+=['run','--config',str(ROOT/'vitest.config.mjs'),'--no-cache'] if args.mode=='pure' else ['--noEmit','--project',str(ROOT/'types.tsconfig.json')]
    index=len(results)+1; label=f'check-{index:02d}'
    source_files=[{'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(ROOT.iterdir()) if p.is_file() and p.suffix in ('.py','.ts','.mjs','.json')]
    write_new(state/(label+'.started.json'),{'mode':args.mode,'startedAt':now.isoformat(),'sourceHead':permit['sourceHead'],'authority':permit['authority'],'argv':argv,'fixedProduct':manifest['base'],'sourceFiles':source_files})
    sys.dont_write_bytecode=True
    spec=importlib.util.spec_from_file_location('k01_ops14',SUPERVISOR); module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module)
    env=dict(os.environ); env['PYTHONDONTWRITEBYTECODE']='1'; env.update({'TSX_TSCONFIG_PATH':str(ROOT/'types.tsconfig.json'),'TMPDIR':str(state),'FLOW_K01_QUERY_CACHE':str(state/'cache'),
      'FLOW_K01_QUERY_START_MS':str(int(started*1000)),'FLOW_K01_QUERY_NAMESPACE':str(namespace),'FLOW_K01_QUERY_WINDOW':permit.get('window',''),
      'FLOW_K01_QUERY_PG_OPEN':'reviewed' if args.mode=='pg' else 'NOT_OPEN'})
    if time.time() >= started + (110 if args.mode=='pg' else 22): raise ValueError('preflight consumed work budget')
    report=module.supervise(module.Launch(tuple(argv),str(ROOT),env,module.Ownership.NEW_CHILD_SESSION,module.Capture.MERGED),module.Policy(max(0.001, started + (110 if args.mode=='pg' else 22) - time.time()),3,7 if args.mode=='pg' else 5,49152))
    value=dataclasses.asdict(report)
    value['sourceChanged']=[r['path'] for r in source_files if not (ROOT/r['path']).is_file() or sha(ROOT/r['path'])!=r['sha256']]
    try: verify_inputs(); value['fixedInputsAfter']='matched'
    except Exception: value['fixedInputsAfter']='UNKNOWN'
    raw=value.pop('stdout')+value.pop('stderr'); (state/(label+'.log')).write_bytes(raw)
    value.update({'mode':args.mode,'resourceConfirmed':report.owned_state=='absent' and all(report.eof.values()) and not report.signals and not any(o.get('state')=='unknown' for o in report.observations),
      'outputSha256':hashlib.sha256(raw).hexdigest(),'sourceHead':permit['sourceHead'],'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'logicalBytes':logical_bytes(ROOT)})
    write_new(state/(label+'.result.json'),value)
    if value['logicalBytes']>32*1024*1024 or logical_bytes(state)>8*1024*1024: raise ValueError('preparation storage exceeded; HOLD')
    print(json.dumps({key:value[key] for key in ['mode','exit_code','elapsed_ms','resourceConfirmed','first_failure']}))
    return 0 if report.exit_code==0 and report.first_failure is None and value['resourceConfirmed'] and not value['sourceChanged'] and value['fixedInputsAfter']=='matched' else 1
if __name__=='__main__': raise SystemExit(main())
