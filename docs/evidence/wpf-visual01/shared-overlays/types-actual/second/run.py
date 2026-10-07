"""One bounded compiler invocation; owned PGID and scratch only. No harness imports."""
import datetime, errno, hashlib, json, os, selectors, shutil, signal, stat, subprocess, sys, time
from pathlib import Path
BASE=Path(sys.argv[1]).resolve(); SCRATCH=BASE/'scratch'; started=time.monotonic(); errors=[]; process=None; stopped=False; scratch_identity=None
now=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(name,value): (BASE/name).write_text(json.dumps(value,indent=2)+'\n')
def scan_error(e):
 if e.errno!=errno.ENOENT: raise e
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
report={'startedAt':now(),'state':'FAILED','sourceHead':None,'streams':{},'samples':[],'cleanup':{}}
selector=selectors.DefaultSelector(); streams={}; received=0; raw_cap=128*1024
try:
 b=json.loads((BASE/'binding.json').read_text()); root=Path(b['worktree']); report['sourceHead']=b['head']
 def git(*args):return subprocess.check_output(['git',*args],cwd=root,text=True).strip()
 assert git('rev-parse','HEAD')==b['head'] and git('branch','--show-current')==b['branch'] and git('status','--porcelain')==b['declaredDirty']
 live=json.loads(Path(b['live']).read_text()); assert live['state']=='available'
 c=next(x for x in live['claims'] if x['claimId']==b['claim'])
 assert c['state']=='active' and c['version']==b['claimVersion'] and c['worker']=='w01_owner' and c['worktree']==str(root) and c['branch']==b['branch']
 expected=['apps/web/src/assistant-ui.css', 'apps/web/src/components/ui/dialog.tsx', 'apps/web/src/execution-profiles/ExecutionProfilePicker.tsx', 'apps/web/src/execution-profiles/execution-profiles.css', 'apps/web/test/conversation-recovery.browser.ts', 'apps/web/test/message-settings.browser.ts', 'docs/evidence/wpf-visual01', 'plans/wpf-visual01-shell'];assert sorted(c['scope'])==expected
 for other in live['claims']:
  if other['claimId']==c['claimId'] or other['state']=='released':continue
  assert not any(a==z or a.startswith(z+'/') or z.startswith(a+'/') for a in c['scope'] for z in other['scope']), 'scope conflict'
 for pin in b['pins']:
  path=Path(pin['path']);assert str(path.resolve(strict=True))==pin['realpath'] and path.stat().st_size==pin['bytes'] and sha(path)==pin['sha256']
 assert not SCRATCH.exists();SCRATCH.mkdir(mode=0o700); scratch_identity=SCRATCH.stat()
 def sample():
  free=shutil.disk_usage(BASE).free;logical,allocated=sizes(SCRATCH);report['samples'].append({'elapsedMs':round((time.monotonic()-started)*1000,3),'free':free,'scratchLogical':logical,'scratchAllocated':allocated})
  if free<=b['stopFreeBytes'] or max(logical,allocated)>8*1024*1024:raise RuntimeError('resource stop')
  return free
 assert sample()>=b['startFreeBytes'];assert time.monotonic()-started<5 and not stopped
 env={k:v for k,v in os.environ.items() if not k.startswith(('FLOW_','PG','POSTGRES_')) and k not in ('DATABASE_URL','NODE_OPTIONS','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy')}
 env.update(TMPDIR=str(SCRATCH),TMP=str(SCRATCH),TEMP=str(SCRATCH),NODE_DISABLE_COMPILE_CACHE='1',TSX_DISABLE_CACHE='1',NO_COLOR='1')
 process=subprocess.Popen(['/usr/bin/sandbox-exec','-f',str(BASE/'sandbox.sb'),*b['command']],cwd=root,env=env,start_new_session=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 report.update(pid=process.pid,pgid=process.pid,childStartedAt=now());save('started.json',report);print(json.dumps({'startedAt':report['childStartedAt'],'pid':process.pid,'pgid':process.pid,'base':str(BASE)}),flush=True)
 for name,pipe in [('stdout',process.stdout),('stderr',process.stderr)]:
  os.set_blocking(pipe.fileno(),False);selector.register(pipe,selectors.EVENT_READ,name);streams[name]={'file':open(BASE/(name+'.txt'),'wb'),'eof':False,'bytes':0,'dropped':0}
 while selector.get_map() or process.poll() is None:
  elapsed=time.monotonic()-started
  if elapsed>=13.7 or stopped:raise RuntimeError('work deadline or stop')
  sample()
  for key,_ in selector.select(.02):
   data=os.read(key.fileobj.fileno(),65536);s=streams[key.data]
   if not data:s['eof']=True;selector.unregister(key.fileobj);continue
   s['bytes']+=len(data);keep=data[:max(0,raw_cap-received)];s['file'].write(keep);received+=len(keep);s['dropped']+=len(data)-len(keep)
   if s['dropped']:raise RuntimeError('raw cap')
 report['childExitCode']=process.wait(timeout=max(.01,18.7-(time.monotonic()-started)))
 if report['childExitCode']!=0:errors.append('compiler exit '+str(report['childExitCode']))
except BaseException as e:errors.append(type(e).__name__+':'+str(e))
finally:
 try:
  if alive():
   stop(signal.SIGTERM)
   while alive() and time.monotonic()-started<16.7:
    if process:process.poll()
    time.sleep(.02)
  if alive():stop(signal.SIGKILL)
  if process:
   try:report['childExitCode']=process.wait(timeout=max(.01,17.7-(time.monotonic()-started)))
   except subprocess.TimeoutExpired:errors.append('child wait timeout')
  while selector.get_map() and time.monotonic()-started<17.7:
   for key,_ in selector.select(.02):
    data=os.read(key.fileobj.fileno(),65536);s=streams[key.data]
    if not data:s['eof']=True;selector.unregister(key.fileobj);continue
    s['bytes']+=len(data);keep=data[:max(0,raw_cap-received)];s['file'].write(keep);received+=len(keep);s['dropped']+=len(data)-len(keep)
  report['cleanup']['groupAbsent']=not alive()
  if alive():errors.append('owned group remains')
  if SCRATCH.exists():
   try:sample()
   except BaseException as e:errors.append('final resource:'+str(e))
   if not alive() and scratch_identity is not None:
    current=SCRATCH.lstat(); assert current.st_dev==scratch_identity.st_dev and current.st_ino==scratch_identity.st_ino and stat.S_ISDIR(current.st_mode), 'scratch identity changed; KEEP'
    shutil.rmtree(SCRATCH)
  report['cleanup']['scratchAbsent']=not SCRATCH.exists()
 except BaseException as e:errors.append('cleanup:'+str(e))
 for name,s in streams.items():
  s['file'].close();report['streams'][name]={k:v for k,v in s.items() if k!='file'}
  if not s['eof'] or s['dropped']:errors.append(name+' incomplete')
 selector.close();report.update(errors=errors,finishedAt=now(),elapsedMs=round((time.monotonic()-started)*1000,3),state='PASSED' if not errors and not stopped else 'FAILED')
 if report['elapsedMs']>18700:errors.append('total deadline');report['state']='FAILED'
 save('result.json',report)
 save('budget.json',{'limitMs':18700,'cleanupReserveMs':5000,'elapsedMs':report['elapsedMs'],'tmpCap':8388608,'rawCap':1048576})
 if sizes(BASE)[0]>1048576:errors.append('final retained cap');report['state']='FAILED';save('result.json',report)
 for s,h in handlers.items():signal.signal(s,h)
terminal={'state':report['state'],'resultSha256':sha(BASE/'result.json'),'budgetSha256':sha(BASE/'budget.json'),'elapsedAfterWritesMs':round((time.monotonic()-started)*1000,3),'cleanup':report['cleanup'],'childExitCode':report.get('childExitCode')}
save('terminal.json',terminal);print(json.dumps(terminal),flush=True)
sys.exit(0 if report['state']=='PASSED' else 1)
