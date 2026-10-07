"""Finite local-only segment; fixed OPS14 owns the sole test child group."""
from dataclasses import asdict
from pathlib import Path
import datetime, hashlib, importlib.util, json, os, re, shutil, subprocess, sys, tempfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
NODE = '/opt/homebrew/Cellar/node@24/24.20.0/bin/node'
SUPERVISOR = ROOT / 'tools/owned-process-supervision/supervise.py'
SHA = '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'

def durable(path, value):
    data = value if isinstance(value, bytes) else (json.dumps(value, indent=2) + '\n').encode()
    with path.open('xb') as f:
        f.write(data); f.flush(); os.fsync(f.fileno())

def main():
    run_name, pattern, *files = sys.argv[1:]
    assert re.fullmatch('local-[0-9]{2}', run_name) and files
    assert all(p.startswith('tools/personal-preview/') and p.endswith('.test.mjs') and '..' not in p for p in files)
    previous = [json.loads(p.read_text()) for p in HERE.glob('local-*/result.json')]
    elapsed = sum(p['report']['elapsed_ms'] for p in previous)
    assert elapsed < 230000
    evidence_bytes = sum(p.stat().st_size for d in HERE.glob('local-*') for p in d.iterdir() if p.is_file())
    assert evidence_bytes < 1500000
    free = shutil.disk_usage(ROOT).free
    assert free >= 1024**3 + 32*1024**2 + 2*1024**2
    assert hashlib.sha256(SUPERVISOR.read_bytes()).hexdigest() == SHA
    run = HERE / run_name; run.mkdir()
    scratch = Path(tempfile.mkdtemp(prefix='flow-svc09a-', dir=Path(tempfile.gettempdir()).resolve()))
    pin = scratch.lstat()
    argv = (NODE, '--experimental-vm-modules', '--test', '--test-concurrency=1', '--test-name-pattern='+pattern, *files)
    durable(run/'reservation.json', {'at':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'argv':argv,
      'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
      'freeBytes':free, 'priorWorkMs':elapsed, 'segmentBudgetMs':240000, 'tmpCapBytes':32*1024**2, 'rawCapBytes':2*1024**2,
      'scratch':str(scratch),'dev':pin.st_dev,'ino':pin.st_ino,'PG':0,'provider':0,'browser':0,
      'inputs':[{'path':p,'bytes':(ROOT/p).stat().st_size,'sha256':hashlib.sha256((ROOT/p).read_bytes()).hexdigest()} for p in files]})
    spec=importlib.util.spec_from_file_location('svc09a_ops14',SUPERVISOR);mod=importlib.util.module_from_spec(spec);sys.modules[spec.name]=mod;spec.loader.exec_module(mod)
    env={'PATH':os.environ['PATH'],'HOME':str(scratch),'TMPDIR':str(scratch),'TSX_DISABLE_CACHE':'1','NODE_DISABLE_COMPILE_CACHE':'1'}
    report=mod.supervise(mod.Launch(argv,str(ROOT),env,mod.Ownership.NEW_CHILD_SESSION),mod.Policy(min(60,(238000-elapsed)/1000),0.5,1,256*1024))
    durable(run/'stdout.txt',report.stdout);durable(run/'stderr.txt',report.stderr)
    value=asdict(report);value.pop('stdout');value.pop('stderr')
    counts={key:int(m[1]) if (m:=re.search(rb'# '+key.encode()+rb' (\d+)', report.stdout)) else None for key in ['tests','pass','fail','skipped']}
    durable(run/'result.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'report':value,'counts':counts,'rawBytes':len(report.stdout)+len(report.stderr),'priorWorkMs':elapsed,'fixturePeakBytes':'NOT_SAMPLED; bounded self-owned small fixtures'})
    current=scratch.lstat();cleanup='KEEP';children=list(scratch.iterdir())
    if report.owned_state=='absent' and all(report.eof.values()) and (pin.st_dev,pin.st_ino)==(current.st_dev,current.st_ino) and not children:
        scratch.rmdir();cleanup='removed'
    durable(run/'cleanup.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scratch':str(scratch),'state':cleanup,'remainingEntries':len(children),'ownedState':report.owned_state,'eof':report.eof})
    print(json.dumps({'run':run_name,'counts':counts,'exit':report.exit_code,'elapsedMs':report.elapsed_ms,'rawBytes':len(report.stdout)+len(report.stderr),'ownedState':report.owned_state,'cleanup':cleanup}))
    return 0 if report.exit_code==0 and report.owned_state=='absent' and all(report.eof.values()) and cleanup=='removed' else 1
if __name__=='__main__':sys.exit(main())
