import pathlib,subprocess,os,time,json,hashlib,signal,datetime
W=pathlib.Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/tui-task-cancel'); OUT=pathlib.Path('/tmp/flow-tui01f-03-20261006-1714'); EV=pathlib.Path('/tmp/flow-tui01f-03-approved-window-1'); SRC='40508f18432ffc20eadd638b208841a364c72bea'; NODE='/opt/homebrew/opt/node@24/bin/node'
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
free=lambda:os.statvfs(W).f_bavail*os.statvfs(W).f_frsize
def size(p):
 if not p.exists():return 0
 if p.is_file():return p.stat().st_size
 n=0
 for base,dirs,files in os.walk(p,followlinks=False):
  dirs[:]=[d for d in dirs if not (pathlib.Path(base)/d).is_symlink()]
  for f in files:
   q=pathlib.Path(base)/f
   try:
    if not q.is_symlink():n+=q.stat().st_size
   except FileNotFoundError:pass
 return n
def write(name,data):
 p=OUT/name
 with p.open('x') as f:json.dump(data,f,ensure_ascii=False,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
 fd=os.open(OUT,os.O_RDONLY)
 try:os.fsync(fd)
 finally:os.close(fd)
def present(g):
 try:os.killpg(g,0);return True
 except ProcessLookupError:return False
 except PermissionError:return None
def snapshot(root,known):
 r=subprocess.run(['ps','-axo','pid=,ppid=,pgid='],text=True,capture_output=True,timeout=2)
 if r.returncode:return False
 rows=[tuple(map(int,x.split())) for x in r.stdout.splitlines() if len(x.split())==3]; ids={root}; changed=True
 while changed:
  changed=False
  for pid,ppid,pgid in rows:
   if ppid in ids and pid not in ids:ids.add(pid);changed=True
 for pid,ppid,pgid in rows:
  if pid in ids:known[pid]={'pid':pid,'ppid':ppid,'pgid':pgid}
 return True
# Fail before reservation if identity or gate is not satisfied.
assert free()>=1140850688 and not OUT.exists() and not EV.exists()
assert subprocess.check_output(['git','status','--porcelain'],cwd=W)==b''
paths=['apps/tui/src/task-controls/fixture.ts','apps/tui/src/task-controls/journey.test.ts','apps/tui/test-fixtures/cancel_driver.py']
hashes={}
for p in paths:
 raw=(W/p).read_bytes();assert raw==subprocess.check_output(['git','show',SRC+':'+p],cwd=W);hashes[p]=hashlib.sha256(raw).hexdigest()
OUT.mkdir(mode=0o700); TMP=OUT/'temporary';TMP.mkdir(mode=0o700)
cache=W/'node_modules/.vite';cache0=size(cache)
args=[NODE,'node_modules/vitest/vitest.mjs','run','apps/tui/src/task-controls/journey.test.ts','--no-cache','--configLoader','runner','--maxWorkers','1']
write('reservation.json',{'approvalId':'TUI01F-03-20261006-1714','startedAt':now(),'source':SRC,'backend':'a89f42ab57acb53657af6a2d1b745dabd4d50aa5','head':'92202abf3229596fb8cdbfb75493408ac2b14ed7','sourceHashes':hashes,'freeBefore':free(),'gate':1140850688,'argv':args,'evidenceDirectory':str(EV),'temporaryRoot':str(TMP),'limits':{'workSeconds':120,'cleanupSeconds':60,'observedRawThreshold':4194304,'observedTmpThreshold':16777216,'sharedFreeThreshold':1073741824},'providerCalls':0,'attempt':1})
env=os.environ.copy();env.update({'PATH':'/opt/homebrew/opt/node@24/bin:/usr/bin:/bin','FLOW_TUI01F_EVIDENCE_DIR':str(EV),'TMPDIR':str(TMP),'NO_COLOR':'1'});env.pop('FORCE_COLOR',None)
started=time.monotonic();known={};samples=[];reason=None;deadline=None;stopActions=[];maxraw=0;maxtmp=0;minfree=free();process=None
with (OUT/'stdout.txt').open('xb') as stdout,(OUT/'stderr.txt').open('xb') as stderr:
 process=subprocess.Popen(args,cwd=W,env=env,stdout=stdout,stderr=stderr,start_new_session=True)
 write('spawn.json',{'at':now(),'pid':process.pid,'pgid':process.pid})
 while process.poll() is None:
  elapsed=time.monotonic()-started;snapshot(process.pid,known)
  raw=size(OUT/'stdout.txt')+size(OUT/'stderr.txt')+size(EV);tmp=size(TMP)+max(0,size(cache)-cache0);available=free();maxraw=max(maxraw,raw);maxtmp=max(maxtmp,tmp);minfree=min(minfree,available)
  if not samples or elapsed-samples[-1]['seconds']>=1:samples.append({'seconds':round(elapsed,2),'rawBytes':raw,'tempBytes':tmp,'freeBytes':available})
  if reason is None:
   reason='raw-observed-threshold' if raw>4194304 else 'temp-observed-threshold' if tmp>16777216 else 'shared-free-threshold' if available<1073741824 else 'work-deadline' if elapsed>=120 else None
   if reason:
    write('stop-checkpoint.json',{'at':now(),'reason':reason,'knownProcesses':list(known.values()),'samples':samples,'state':'unknown-retain'});deadline=time.monotonic()+60
    for g in sorted({process.pid}|{x['pgid'] for x in known.values()}):
     try:os.killpg(g,signal.SIGINT);stopActions.append({'pgid':g,'signal':'SIGINT'})
     except ProcessLookupError:pass
  if deadline and time.monotonic()>=deadline:
   for g in sorted({process.pid}|{x['pgid'] for x in known.values()}):
    if present(g):
     try:os.killpg(g,signal.SIGTERM);stopActions.append({'pgid':g,'signal':'SIGTERM'})
     except ProcessLookupError:pass
   time.sleep(1)
   for g in sorted({process.pid}|{x['pgid'] for x in known.values()}):
    if present(g):
     try:os.killpg(g,signal.SIGKILL);stopActions.append({'pgid':g,'signal':'SIGKILL'})
     except ProcessLookupError:pass
   break
  time.sleep(.25)
 try:exitcode=process.wait(timeout=5)
 except subprocess.TimeoutExpired:exitcode=None;reason=reason or 'owned-process-unknown'
 stdout.flush();stderr.flush();os.fsync(stdout.fileno());os.fsync(stderr.fileno())
result=None
if (EV/'result.json').is_file():
 try:result=json.loads((EV/'result.json').read_text())
 except Exception:reason=reason or 'result-unreadable'
groups={process.pid}|{x['pgid'] for x in known.values()}
if result:
 for key in ['ptyGroup','ptyGroupFinal']:
  p=result.get('facts',{}).get(key,{}).get('pgid')
  if isinstance(p,int):groups.add(p)
groupFacts=[{'pgid':g,'present':present(g)} for g in sorted(groups)]
# No automatic resource deletion: fixture alone owns checkpoint-gated DB/tmp cleanup.
files=[]
for p in list(OUT.glob('*.txt'))+list(EV.glob('*.json')):
 if p.is_file():files.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
write('supervisor-result.json',{'endedAt':now(),'elapsedSeconds':round(time.monotonic()-started,3),'source':SRC,'exitCode':exitcode,'stopReason':reason,'groups':groupFacts,'observedProcesses':list(known.values()),'stopActions':stopActions,'samples':samples,'maxObservedRawBytes':max(maxraw,size(OUT/'stdout.txt')+size(OUT/'stderr.txt')+size(EV)),'maxObservedTemporaryBytes':max(maxtmp,size(TMP)+max(0,size(cache)-cache0)),'minSampledFreeBytes':minfree,'freeAfter':free(),'cacheGrowthBytes':size(cache)-cache0,'fixtureResult':result,'files':files,'providerCalls':0,'runCount':1,'cleanupPolicy':'No supervisor DROP/rm. Fixture checkpoint gated cleanup only; retained wrapper/raw/cache for evidence.','state':'PASS_CANDIDATE' if exitcode==0 and reason is None and result and result.get('outcome')=='passed' and all(x['present'] is False for x in groupFacts) else 'FAILED_OR_UNKNOWN_RETAINED'})
print(json.dumps({'directory':str(OUT),'evidence':str(EV),'exitCode':exitcode,'stopReason':reason,'elapsed':round(time.monotonic()-started,2),'fixtureOutcome':result.get('outcome') if result else None,'groups':groupFacts}))
