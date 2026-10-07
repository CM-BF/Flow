from pathlib import Path
import os,sys,time,json,subprocess,signal,shutil,hashlib,datetime,math
base=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-workspace-composition'); tmp=Path(__file__).parent
ledger=json.loads((tmp/'segment.json').read_text()); label=sys.argv[1]; assert label.startswith(('direct-','types-')); is_direct=label.startswith('direct-')
assert 20000-ledger['spentMs']>5000,'Need actual work and cleanup reserve'
start=time.monotonic(); hard=start+min(15,(20000-ledger['spentMs'])/1000); work=hard-5; interrupted=[]
previous={s:signal.signal(s,lambda n,f:interrupted.append(n)) for s in (signal.SIGTERM,signal.SIGINT)}
report={'label':label,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'budgetMs':round((hard-start)*1000),'cleanupReserveMs':5000,'errors':[],'network':'sandbox denied','projectWrites':'sandbox denied','sourcePins':{},'PG':False,'Chrome':False,'regularFileLogs':True}
node='/opt/homebrew/opt/node@24/bin/node';scratch=tmp/'scratch';scratch.mkdir(exist_ok=True)
env={k:v for k,v in os.environ.items() if k in ('PATH','HOME','USER','LOGNAME','LANG','LC_ALL')};env.update(TMPDIR=str(scratch),TSX_DISABLE_CACHE='1',NODE_DISABLE_COMPILE_CACHE='1')
def size(path,exclude=None):
 total=0
 def scan_error(error):
  if path==scratch and isinstance(error,FileNotFoundError):return
  raise error
 for root,dirs,files in os.walk(path,onerror=scan_error):
  dirs[:]=[d for d in dirs if Path(root)/d!=exclude]
  for f in files:
   try:total+=os.lstat(Path(root)/f).st_size
   except FileNotFoundError:pass
 return total
def absent(pid):
 try:os.killpg(pid,0);return False
 except ProcessLookupError:return True
p=None
try:
 report['freeBefore']=shutil.disk_usage(tmp).free
 if report['freeBefore']<18955370496:raise RuntimeError('combined free floor')
 report['gitHead']=subprocess.check_output(['git','rev-parse','HEAD'],cwd=base,text=True).strip()
 paths=json.loads((base/'docs/evidence/wpf-workspace-arc/source-manifest.json').read_text())['scope']
 report['sourcePins']={f:hashlib.sha256((base/f).read_bytes()).hexdigest() for f in paths if (base/f).is_file()}
 args=([node,str(base/'node_modules/vitest/vitest.mjs'),'run','--config',str(base/'docs/evidence/wpf-workspace-arc/local-check/vitest.config.ts'),'--configLoader','native','--no-cache','--testNamePattern','Arc','--reporter=json','--outputFile',str(tmp/(label+'.json'))] if is_direct else [node,str(base/'node_modules/typescript/lib/tsc.js'),'--noEmit','-p',str(base/'docs/evidence/wpf-workspace-arc/http-fix-check/tsconfig.json')])
 report['command']=['/usr/bin/sandbox-exec','-f',str(tmp/'sandbox.sb')]+args
 with (tmp/(label+'.log')).open('xb') as out:
  p=subprocess.Popen(report['command'],cwd=base,env=env,stdout=out,stderr=subprocess.STDOUT,start_new_session=True);report['pid']=p.pid
  print(json.dumps({'actualStart':report['startedAt'],'pid':p.pid,'label':label}),flush=True)
  while p.poll() is None:
   if interrupted or time.monotonic()>=work:raise RuntimeError('interruption/work deadline')
   if size(scratch)>2*1024**2 or size(tmp,scratch)>256*1024:raise RuntimeError('local logical byte limit')
   time.sleep(.03)
  report['actualExit']=p.wait()
  if report['actualExit']:report['errors'].append('child exit '+str(report['actualExit']))
  if is_direct and report['actualExit']==0:
   result=json.loads((tmp/(label+'.json')).read_text());selected=[a for s in result['testResults'] for a in s['assertionResults'] if a['status'] not in ('pending','skipped','todo')]
   report['selection']={'passed':result['numPassedTests'],'failed':result['numFailedTests'],'notSelected':result['numPendingTests'],'selectedTitles':[a['fullName'] for a in selected]}
   if not result['success'] or len(selected)!=13 or any(a['status']!='passed' or 'Arc' not in a['fullName'] for a in selected):raise RuntimeError('selected acceptance')
except BaseException as e:report['errors'].append(type(e).__name__+': '+str(e))
finally:
 if p:
  try:
   if not absent(p.pid):
    os.killpg(p.pid,signal.SIGTERM)
    try:p.wait(timeout=max(.01,min(.5,hard-time.monotonic())))
    except subprocess.TimeoutExpired:pass
    if not absent(p.pid):os.killpg(p.pid,signal.SIGKILL)
    p.wait(timeout=max(.01,hard-time.monotonic()))
   report['actualExit']=p.returncode;report['groupAbsent']=absent(p.pid)
  except BaseException as e:report['errors'].append('cleanup '+str(e))
 try:
  report['scratchBytes']=size(scratch);report['retainedBytes']=size(tmp,scratch);report['freeAfter']=shutil.disk_usage(tmp).free
  if report['scratchBytes']>2*1024**2 or report['retainedBytes']>256*1024:report['errors'].append('terminal bytes')
  if not p or report.get('groupAbsent'):shutil.rmtree(scratch);report['scratchAbsent']=not scratch.exists()
 except BaseException as e:report['errors'].append('tail '+str(e))
 report['elapsedMs']=(time.monotonic()-start)*1000;report['chargeMs']=math.ceil(report['elapsedMs']);report['signals']=interrupted
 if interrupted or time.monotonic()>hard:report['errors'].append('late signal/total deadline')
 report['state']='PASS' if not report['errors'] else 'FAIL';ledger['spentMs']+=report['chargeMs'];ledger['attempts'].append(report);ledger['remainingMs']=20000-ledger['spentMs']
 (tmp/'segment.json').write_text(json.dumps(ledger,indent=2)+'\n');print(json.dumps(report),flush=True)
 for s,h in previous.items():signal.signal(s,h)
sys.exit(0 if report['state']=='PASS' else 1)
