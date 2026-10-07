import dataclasses,datetime,hashlib,importlib.util,json,os,shutil,signal,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]; HERE=Path(__file__).resolve().parent
NODE='/opt/homebrew/opt/node@24/bin/node'
def save(path,value):
 data=value if isinstance(value,bytes) else (json.dumps(value,indent=2)+'\n').encode()
 with path.open('xb') as f:f.write(data);f.flush();os.fsync(f.fileno())
def main():
 signal.signal(signal.SIGALRM,lambda *_:os._exit(124));signal.setitimer(signal.ITIMER_REAL,39)
 label,kind=sys.argv[1:3]; assert kind in ['tests','types']; assert label.isalnum()
 free=shutil.disk_usage(ROOT).free; assert free>=1107296256
 cumulative=sum(json.loads(p.read_text())['elapsed_ms'] for p in HERE.glob('*-result.json')); assert cumulative+36500<=90000
 scratch=Path(tempfile.mkdtemp(prefix='flow-eng01i-check-')).resolve(); identity=scratch.stat()
 args=[NODE,str(ROOT/'node_modules/vitest/vitest.mjs'),'run','--config',str(HERE/'vitest.config.mjs'),'apps/runner/src/engineering/native-adapter.test.ts','apps/runner/src/engineering/calculator-receipt.test.ts'] if kind=='tests' else [NODE,str(ROOT/'node_modules/typescript/bin/tsc'),'--noEmit','-p',str(HERE/'tsconfig.json')]
 if len(sys.argv)>3: args.extend(['-t',sys.argv[3]])
 files=['apps/runner/src/engineering/'+n for n in ['native-adapter.ts','native-adapter.test.ts','calculator-receipt.ts','calculator-receipt.test.ts']]
 save(HERE/f'{label}-reservation.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'args':args,'freeBytes':free,'scratch':str(scratch),'dev':identity.st_dev,'ino':identity.st_ino,'cumulativePriorMs':cumulative,'bindings':[{'path':p,'sha256':hashlib.sha256((ROOT/p).read_bytes()).hexdigest()} for p in files],'PG':0,'provider':0})
 spec=importlib.util.spec_from_file_location('eng01i_supervisor',ROOT/'tools/owned-process-supervision/supervise.py');m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
 env={'PATH':'/opt/homebrew/opt/node@24/bin:/usr/bin:/bin','HOME':str(scratch),'TMPDIR':str(scratch),'NO_COLOR':'1','NODE_DISABLE_COMPILE_CACHE':'1','FLOW_ENG01I_LOCAL_FACTS':str(scratch/'facts.json'),'FLOW_ENG01I_CACHE':str(scratch/'cache')}
 report=m.supervise(m.Launch(tuple(args),str(ROOT),env,m.Ownership.NEW_CHILD_SESSION),m.Policy(34,.5,2,524288))
 value=dataclasses.asdict(report)
 for name in ['stdout','stderr']: data=value.pop(name);save(HERE/f'{label}-{name}.log',data);value[name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
 value['at']=datetime.datetime.now(datetime.timezone.utc).isoformat();value['scratchEntries']=sorted(p.name for p in scratch.iterdir());value['scratchBytes']=sum(p.lstat().st_size for p in scratch.rglob('*') if p.is_file() and not p.is_symlink());value['freeAfter']=shutil.disk_usage(ROOT).free
 if (scratch/'facts.json').exists():save(HERE/f'{label}-facts.json',(scratch/'facts.json').read_bytes())
 save(HERE/f'{label}-result.json',value)
 removed=False
 if report.owned_state=='absent' and all(report.eof.values()) and set(value['scratchEntries'])<=set(['facts.json','cache']):
  current=scratch.stat();assert(current.st_dev,current.st_ino)==(identity.st_dev,identity.st_ino);shutil.rmtree(scratch);removed=True
 save(HERE/f'{label}-cleanup.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scratch':str(scratch),'removed':removed,'ownedState':report.owned_state})
 okay=report.exit_code==0 and report.owned_state=='absent' and all(report.eof.values()) and report.first_failure is None and not report.secondary_failures and removed and value['scratchBytes']<=16777216
 print(json.dumps({'round':label,'exit':report.exit_code,'elapsedMs':report.elapsed_ms,'ownedState':report.owned_state,'removed':removed,'okay':okay}));return 0 if okay else 1
if __name__=='__main__':raise SystemExit(main())
