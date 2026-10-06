from pathlib import Path
import os,json,subprocess,hashlib,time,selectors,signal,datetime,re
root=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/goal-input-confirmation');os.chdir(root)
folder=root/'docs/evidence/o15';tag='pg-20261006T1742Z';run=folder/(tag+'.run.json');out=folder/(tag+'.stdout.txt')
assert not run.exists() and not out.exists()
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
free=lambda:os.statvfs(root).f_bavail*os.statvfs(root).f_frsize
sha=lambda b:hashlib.sha256(b).hexdigest()
env={**os.environ,'GIT_OPTIONAL_LOCKS':'0','FLOW_O15_PG_ALLOWANCE_BYTES':'67108864'}
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True,env=env).strip()
entry='apps/server/src/goal-plan-confirmation/confirmation.test.ts';target='e0c0db91d7e6c52b9bb5df890787930db8b7e91d'
facts={'window':'O15-PG-20261006-1742','startedAt':now(),'head':head,'sourceTarget':target,'priorDomain':'9fd1cbf83d52b2b3e52cdd330ddbe4d9376d1cf2','providerCalls':0,'expectedSelected':6,'expectedSchemaNotSelected':1,'gateBytes':1140850688,'limits':{'workSeconds':120,'cleanupObservationSeconds':30,'rawBytes':2097152,'cachePlusRuntimeBytes':8388608,'reserveBytes':1073741824,'PGWAL':'separate; DB bytes and volume observation only'}}
def save():run.write_text(json.dumps(facts,indent=2)+'\n')
try:
 assert subprocess.check_output(['git','status','--porcelain=v1'],env=env)==b''
 facts['cleanBefore']=True
 manifest=json.loads((folder/'cleanup-bound-manifest.json').read_text())
 for e in manifest['entries']:
  b=(root/e['path']).read_bytes();assert sha(b)==e['sha256'] and len(b)==e['bytes'],e['path']
  assert b==subprocess.check_output(['git','show',e['ref']+':'+e['path']],env=env),e['path']
 pf=json.loads(Path('/tmp/flow-o15-cleanup-bound-preflight.json').read_text());assert not pf['missing']
 for e in pf['staticSources']+pf['externalSql']+pf['configs']:
  assert sha((root/e['path']).read_bytes())==e['sha256'],e['path']
 facts['sourceBindingsVerified']=len(manifest['entries']);facts['preflightSha256']=sha(Path('/tmp/flow-o15-cleanup-bound-preflight.json').read_bytes())
except Exception as error:
 facts.update(state='NOT_RUN_INPUT',errorType=type(error).__name__,error=str(error),endedAt=now());save();print(json.dumps(facts));raise SystemExit(0)
cache=root/'node_modules/.vite'
def size(directory):
 total=0
 if not directory.exists():return total
 for base,dirs,files in os.walk(directory,followlinks=False):
  dirs[:]=[n for n in dirs if not (Path(base)/n).is_symlink()]
  for n in files:
   q=Path(base)/n
   try:
    if not q.is_symlink():total+=q.stat().st_size
   except FileNotFoundError:pass
 return total
before=set(folder.glob('flow_o15_*-facts.json'))
def records():return [q for q in folder.glob('flow_o15_*-facts.json') if q not in before]
def runtime_size():
 total=0
 for q in records():
  try:v=json.loads(q.read_text())
  except (json.JSONDecodeError,FileNotFoundError):continue
  d=v.get('directory')
  if d:
   p=Path(d['path'])
   try:s=p.lstat()
   except FileNotFoundError:continue
   if s.st_dev==d['dev'] and s.st_ino==d['ino'] and p.name.startswith('flow-o15-'):total+=size(p)
 return total
facts.update(freeBeforeBytes=free(),cacheBeforeBytes=size(cache));save()
if facts['freeBeforeBytes']<facts['gateBytes']:
 facts.update(state='NOT_RUN_RESOURCE',endedAt=now());save();print(json.dumps(facts));raise SystemExit(0)
cmd=['/opt/homebrew/opt/node@24/bin/node','node_modules/vitest/vitest.mjs','run',entry,'-t','O15 real isolated HTTP/PG confirmation','--maxWorkers=1','--no-cache','--testTimeout=30000','--hookTimeout=30000']
facts['argv']=cmd;facts['environment']={'FLOW_O15_PG_ALLOWANCE_BYTES':env['FLOW_O15_PG_ALLOWANCE_BYTES']}
t=time.monotonic();p=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,env=env);facts.update(pid=p.pid,processGroup=p.pid,state='RUNNING');save()
sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ);written=0;reason=None;terminatedAt=None;minimum=facts['freeBeforeBytes'];peakCache=facts['cacheBeforeBytes'];peakRuntime=0;last=0
with out.open('xb') as f:
 while sel.get_map():
  elapsed=time.monotonic()-t
  if elapsed-last>=.2:
   last=elapsed;minimum=min(minimum,free());peakCache=max(peakCache,size(cache));peakRuntime=max(peakRuntime,runtime_size())
   if reason is None and (minimum<1073741824 or peakCache+peakRuntime>8388608):reason='resource-observation-bound'
  if elapsed>120 and reason is None:reason='work-time-bound'
  if reason and terminatedAt is None:
   terminatedAt=time.monotonic()
   if p.poll() is None:os.killpg(p.pid,signal.SIGTERM)
  if terminatedAt and time.monotonic()-terminatedAt>30:
   try:os.killpg(p.pid,signal.SIGKILL)
   except ProcessLookupError:pass
  for key,_ in sel.select(.1):
   b=os.read(key.fd,65536)
   if not b:sel.unregister(key.fileobj);continue
   if written+len(b)>2097152:b=b[:max(0,2097152-written)];reason=reason or 'raw-byte-bound'
   f.write(b);f.flush();written+=len(b)
code=p.wait(timeout=3);groupAlive=True
for _ in range(10):
 try:os.killpg(p.pid,0)
 except ProcessLookupError:groupAlive=False;break
 time.sleep(.1)
rs=[]
for q in records():
 v=json.loads(q.read_text());rs.append({'path':str(q.relative_to(root)),'bytes':q.stat().st_size,'sha256':sha(q.read_bytes()),'facts':v})
facts.update(state='FINISHED',exitCode=code,stopReason=reason,durationSeconds=time.monotonic()-t,endedAt=now(),freeMinimumBytes=minimum,freeAfterBytes=free(),cachePeakBytes=peakCache,cacheAfterBytes=size(cache),runtimePeakBytes=peakRuntime,stdout=out.name,stdoutBytes=written,stdoutSha256=sha(out.read_bytes()),ownedProcessGroupAlive=groupAlive,fixtureRecords=rs)
save();print(json.dumps(facts));print(out.read_text()[-18000:])
