"""Bounded sequential compiler/direct checks, adapted from the owned Release local caller."""
import datetime,errno,hashlib,json,os,selectors,shutil,signal,stat,subprocess,sys,time
from pathlib import Path
BASE=Path(sys.argv[1]).resolve(); SCRATCH=BASE/'scratch'; started=time.monotonic(); errors=[]; process=None; stopped=False
b=json.loads((BASE/'binding.json').read_text()); pinfile=Path(b['pinSet']['path']); assert hashlib.sha256(pinfile.read_bytes()).hexdigest()==b['pinSet']['sha256']; b['pins']=json.loads(pinfile.read_text())['pins']+b['extraPins']; limit=b['limitMs']/1000; work=limit-b['cleanupReserveMs']/1000
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(n,v):(BASE/n).write_text(json.dumps(v,indent=2)+'\n')
def scan_error(e):
 if e.errno!=errno.ENOENT:raise e
def sizes(root):
 logical=allocated=0
 for directory,dirs,files in os.walk(root,followlinks=False,onerror=scan_error):
  dirs[:]=[n for n in dirs if not (Path(directory)/n).is_symlink()]
  for n in files:
   try:s=(Path(directory)/n).lstat()
   except FileNotFoundError:continue
   if stat.S_ISREG(s.st_mode):logical+=s.st_size;allocated+=s.st_blocks*512
 return logical,allocated
def alive():
 if process is None:return False
 try:os.killpg(process.pid,0);return True
 except ProcessLookupError:return False
def stop(sig):
 if process:
  try:os.killpg(process.pid,sig)
  except ProcessLookupError:pass
def request_stop(sig,frame):
 global stopped
 stopped=True;errors.append('soft-stop:'+str(sig));stop(signal.SIGTERM)
handlers={s:signal.signal(s,request_stop) for s in (signal.SIGTERM,signal.SIGINT)}
report={'startedAt':now(),'state':'FAILED','head':b['head'],'steps':[],'samples':[],'cleanup':{},'ownedGroups':[]};selector=selectors.DefaultSelector();streams={};received=0
# raw cap includes the prepared packet, direct JSON and all caller logs, with terminal reserve.
raw_cap=b['rawCap']-sizes(BASE)[0]-131072

def sample():
 free=shutil.disk_usage(BASE).free;logical,allocated=sizes(SCRATCH);report['samples'].append({'elapsedMs':round((time.monotonic()-started)*1000,3),'free':free,'scratchLogical':logical,'scratchAllocated':allocated})
 if free<=b['stopFreeBytes'] or max(logical,allocated)>b['tmpCap']:raise RuntimeError('resource stop')
 return free

def drain(timeout):
 global received
 for key,_ in selector.select(timeout):
  data=os.read(key.fileobj.fileno(),65536);s=streams[key.data]
  if not data:s['eof']=True;selector.unregister(key.fileobj);continue
  s['bytes']+=len(data);keep=data[:max(0,raw_cap-received)];s['file'].write(keep);received+=len(keep);s['dropped']+=len(data)-len(keep)
  if s['dropped']:raise RuntimeError('raw cap')
try:
 root=Path(b['worktree'])
 def git(*a):return subprocess.check_output(['git',*a],cwd=root,text=True).strip()
 assert git('rev-parse','HEAD')==b['head'] and git('branch','--show-current')==b['branch'] and git('status','--porcelain')==b['expectedDirty']
 live=json.loads(Path(b['live']).read_text());assert live['state']=='available'
 c=next(x for x in live['claims'] if x['claimId']==b['claim']);assert c['state']=='active' and c['version']==b['claimVersion'] and c['worker']=='w01_owner' and c['worktree']==str(root) and c['branch']==b['branch'] and sorted(c['scope'])==sorted(b['expectedScope'])
 for other in live['claims']:
  if other['claimId']==c['claimId'] or other['state']=='released':continue
  assert not any(a==z or a.startswith(z+'/') or z.startswith(a+'/') for a in c['scope'] for z in other['scope']), 'scope conflict'
 for p in b['pins']:
  path=Path(p['path']);assert str(path.resolve(strict=True))==p['realpath'] and path.stat().st_size==p['bytes'] and sha(path)==p['sha256'],p['path']
 assert not SCRATCH.exists();SCRATCH.mkdir(mode=0o700);assert sample()>=b['startFreeBytes']
 env={k:v for k,v in os.environ.items() if not k.startswith(('FLOW_','PG','POSTGRES_')) and k not in ('DATABASE_URL','NODE_OPTIONS','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy')}
 env.update(TMPDIR=str(SCRATCH),TMP=str(SCRATCH),TEMP=str(SCRATCH),NODE_DISABLE_COMPILE_CACHE='1',TSX_DISABLE_CACHE='1',NO_COLOR='1')
 for step in b['steps']:
  assert time.monotonic()-started<work and not stopped
  process=subprocess.Popen(['/usr/bin/sandbox-exec','-f',str(BASE/'sandbox.sb'),*step['command']],cwd=root,env=env,start_new_session=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  item={'name':step['name'],'startedAt':now(),'pid':process.pid,'pgid':process.pid};report['steps'].append(item);report['ownedGroups'].append(process.pid);save('started.json',report);print(json.dumps({'step':item,'base':str(BASE)}),flush=True)
  for n,pipe in [('stdout',process.stdout),('stderr',process.stderr)]:
   name=step['name']+'-'+n;os.set_blocking(pipe.fileno(),False);selector.register(pipe,selectors.EVENT_READ,name);streams[name]={'file':open(BASE/(name+'.txt'),'wb'),'eof':False,'bytes':0,'dropped':0}
  while selector.get_map() or process.poll() is None:
   if time.monotonic()-started>=work or stopped:raise RuntimeError('work deadline or stop')
   sample();drain(.03)
  item['exitCode']=process.wait();item['finishedAt']=now();item['groupAbsent']=not alive()
  if item['exitCode']!=0:errors.append(step['name']+' exit '+str(item['exitCode']));break
  if alive():raise RuntimeError('owned helper remains after step')
 if len(report['steps'])==1 and not errors:
  path=SCRATCH/'direct.json';assert path.stat().st_size<=262144;raw=json.loads(path.read_text());shutil.copyfile(path,BASE/'direct.json')
  expected=json.loads((BASE/'expected-tests.json').read_text());suites=raw.get('testResults',[]);assert len(suites)==1
  assertions=suites[0]['assertionResults'];assert sorted(x['fullName'].strip() for x in assertions)==expected and all(x['status']=='passed' for x in assertions)
  assert raw['success'] is True and raw['numTotalTests']==15 and raw['numPassedTests']==15 and raw['numFailedTests']==0 and raw['numPendingTests']==0 and raw.get('numTodoTests',0)==0
  report['direct']={'files':1,'passed':15,'failed':0,'pending':0,'todo':0,'exactNames':True}
except BaseException as e:errors.append(type(e).__name__+':'+str(e))
finally:
 try:
  if alive():
   stop(signal.SIGTERM)
   while alive() and time.monotonic()-started<limit-2:
    process.poll();time.sleep(.02)
  if alive():stop(signal.SIGKILL)
  if process:
   try:
    code=process.wait(timeout=max(.01,limit-1-(time.monotonic()-started)))
    if report['steps']:report['steps'][-1]['exitCode']=code
   except subprocess.TimeoutExpired:errors.append('child wait timeout')
  while selector.get_map() and time.monotonic()-started<limit-1:drain(.02)
  absent=[]
  for pgid in report['ownedGroups']:
   try:os.killpg(pgid,0);errors.append('owned group remains:'+str(pgid))
   except ProcessLookupError:absent.append(pgid)
  report['cleanup']['groupsAbsent']=absent;report['cleanup']['allGroupsAbsent']=len(absent)==len(report['ownedGroups'])
  if SCRATCH.exists():
   try:sample()
   except BaseException as e:errors.append('final resource:'+str(e))
   if (SCRATCH/'direct.json').exists() and not (BASE/'direct.json').exists() and (SCRATCH/'direct.json').stat().st_size<=262144:shutil.copyfile(SCRATCH/'direct.json',BASE/'direct.json')
   if report['cleanup']['allGroupsAbsent']:shutil.rmtree(SCRATCH)
  report['cleanup']['scratchAbsent']=not SCRATCH.exists()
 except BaseException as e:errors.append('cleanup:'+str(e))
 report['streams']={}
 for name,s in streams.items():
  s['file'].close();report['streams'][name]={k:v for k,v in s.items() if k!='file'}
  if not s['eof'] or s['dropped']:errors.append(name+' incomplete')
 selector.close();elapsed=(time.monotonic()-started)*1000
 if elapsed>b['limitMs']:errors.append('total deadline')
 report.update(errors=errors,finishedAt=now(),elapsedMs=round(elapsed,3),state='PASSED' if not errors and not stopped else 'FAILED');save('result.json',report)
 save('budget.json',{'limitMs':b['limitMs'],'previousRuntimeMs':b['previousRuntimeMs'],'cleanupReserveMs':5000,'elapsedMs':report['elapsedMs'],'tmpCap':b['tmpCap'],'rawCap':b['rawCap']})
 if sizes(BASE)[0]>b['rawCap']-16384:errors.append('final retained cap');report['state']='FAILED';save('result.json',report)
 # Completion boundary: OS exit and unique terminal/hash must also match; a later signal cannot count as PASS.
 if stopped:report['state']='FAILED';save('result.json',report)
 for s,h in handlers.items():signal.signal(s,h)
terminal={'state':report['state'],'resultSha256':sha(BASE/'result.json'),'budgetSha256':sha(BASE/'budget.json'),'elapsedAfterWritesMs':round((time.monotonic()-started)*1000,3),'cleanup':report['cleanup'],'stepExits':[x.get('exitCode') for x in report['steps']]}
save('terminal.json',terminal);print(json.dumps(terminal),flush=True);sys.exit(0 if report['state']=='PASSED' else 1)
