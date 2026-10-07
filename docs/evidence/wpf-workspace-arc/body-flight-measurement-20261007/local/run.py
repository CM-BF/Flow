from pathlib import Path
import pathlib,stat
def owned_identity(info):
 return (info.st_dev,info.st_ino,info.st_uid,stat.S_IFMT(info.st_mode))

def close_owned_chain(chain):
 for entry in reversed(chain):os.close(entry['fd'])

def open_owned_chain(path):
 path=pathlib.Path(path)
 if not path.is_absolute() or '..' in path.parts:raise RuntimeError('owned path must be absolute without traversal')
 flags=os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW
 chain=[]
 try:
  fd=os.open('/',flags);chain.append({'fd':fd,'name':None,'identity':owned_identity(os.fstat(fd))})
  for name in path.parts[1:]:
   parent=chain[-1]['fd'];fd=os.open(name,flags,dir_fd=parent)
   chain.append({'fd':fd,'name':name,'identity':owned_identity(os.fstat(fd))})
  verify_owned_chain(chain)
  return chain
 except BaseException:
  close_owned_chain(chain)
  raise

def verify_owned_chain(chain):
 for index,entry in enumerate(chain):
  if owned_identity(os.fstat(entry['fd']))!=entry['identity']:raise RuntimeError('owned directory descriptor changed')
  if index:
   current=os.stat(entry['name'],dir_fd=chain[index-1]['fd'],follow_symlinks=False)
   if owned_identity(current)!=entry['identity'] or not stat.S_ISDIR(current.st_mode):raise RuntimeError('owned ancestor replaced or symlinked; KEEP')

def create_owned_scratch(root):
 chain=open_owned_chain(root)
 try:
  verify_owned_chain(chain)
  os.mkdir('scratch',mode=0o700,dir_fd=chain[-1]['fd'])
  fd=os.open('scratch',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=chain[-1]['fd'])
  chain.append({'fd':fd,'name':'scratch','identity':owned_identity(os.fstat(fd))})
  verify_owned_chain(chain)
  return chain
 except BaseException:
  close_owned_chain(chain)
  raise

def remove_owned_scratch(chain,deadline):
 # All child operations use held descriptors; never re-resolve the scratch pathname.
 def guard():
  if time.monotonic()>=deadline:raise RuntimeError('cleanup deadline; KEEP remaining scratch')
  verify_owned_chain(chain)
 def clear(directory_fd):
  guard()
  with os.scandir(directory_fd) as entries:
   for entry in entries:
    guard()
    before=os.stat(entry.name,dir_fd=directory_fd,follow_symlinks=False)
    if stat.S_ISDIR(before.st_mode):
     child=os.open(entry.name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=directory_fd)
     try:
      if owned_identity(os.fstat(child))!=owned_identity(before):raise RuntimeError('scratch child replaced; KEEP')
      clear(child)
      guard()
      if owned_identity(os.stat(entry.name,dir_fd=directory_fd,follow_symlinks=False))!=owned_identity(before):raise RuntimeError('scratch child binding changed; KEEP')
      os.rmdir(entry.name,dir_fd=directory_fd)
     finally:os.close(child)
    else:
     guard()
     if owned_identity(os.stat(entry.name,dir_fd=directory_fd,follow_symlinks=False))!=owned_identity(before):raise RuntimeError('scratch entry changed; KEEP')
     os.unlink(entry.name,dir_fd=directory_fd)
 guard()
 clear(chain[-1]['fd'])
 guard()
 os.rmdir('scratch',dir_fd=chain[-2]['fd'])
 verify_owned_chain(chain[:-1])
 try:os.stat('scratch',dir_fd=chain[-2]['fd'],follow_symlinks=False)
 except FileNotFoundError:return
 raise RuntimeError('scratch name reappeared; cleanup absence UNKNOWN')
import os,sys,time,json,subprocess,signal,shutil,hashlib,datetime,math
base=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-workspace-composition'); tmp=Path(__file__).parent
ledger=json.loads((tmp/'segment.json').read_text()); label=sys.argv[1]; assert label.startswith(('direct-','types-')); is_direct=label.startswith('direct-')
assert 20000-ledger['spentMs']>5000,'Need actual work and cleanup reserve'
start=time.monotonic(); hard=start+min(15,(20000-ledger['spentMs'])/1000); work=hard-5; interrupted=[]
previous={s:signal.signal(s,lambda n,f:interrupted.append(n)) for s in (signal.SIGTERM,signal.SIGINT)}
report={'label':label,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'budgetMs':round((hard-start)*1000),'cleanupReserveMs':5000,'errors':[],'network':'sandbox denied','projectWrites':'sandbox denied','sourcePins':{},'PG':False,'Chrome':False,'regularFileLogs':True}
node='/opt/homebrew/opt/node@24/bin/node';scratch=tmp/'scratch';scratch_owner=create_owned_scratch(tmp)
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
 if report['freeBefore']<17479368704:raise RuntimeError('combined free floor')
 report['gitHead']=subprocess.check_output(['git','rev-parse','HEAD'],cwd=base,text=True).strip()
 paths=json.loads((base/'docs/evidence/wpf-workspace-arc/source-manifest.json').read_text())['scope']
 report['sourcePins']={f:hashlib.sha256((base/f).read_bytes()).hexdigest() for f in paths if (base/f).is_file()}
 args=([node,str(base/'node_modules/vitest/vitest.mjs'),'run','--config',str(base/'docs/evidence/wpf-workspace-arc/local-check/vitest.config.ts'),'--configLoader','native','--no-cache','--testNamePattern','Arc','--reporter=json','--outputFile',str(tmp/(label+'.json'))] if is_direct else [node,str(base/'node_modules/typescript/lib/tsc.js'),'--noEmit','-p',str(base/'docs/evidence/wpf-workspace-arc/body-flight-measurement-20261007/tsconfig.json')])
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
  if not p or report.get('groupAbsent'):remove_owned_scratch(scratch_owner,hard);report['scratchAbsent']=not os.path.lexists(scratch)
 except BaseException as e:report['errors'].append('tail '+str(e))
 finally:close_owned_chain(scratch_owner)
 report['elapsedMs']=(time.monotonic()-start)*1000;report['chargeMs']=math.ceil(report['elapsedMs']);report['signals']=interrupted
 if interrupted or time.monotonic()>hard:report['errors'].append('late signal/total deadline')
 report['state']='PASS' if not report['errors'] else 'FAIL';ledger['spentMs']+=report['chargeMs'];ledger['attempts'].append(report);ledger['remainingMs']=20000-ledger['spentMs']
 (tmp/'segment.json').write_text(json.dumps(ledger,indent=2)+'\n');print(json.dumps(report),flush=True)
 for s,h in previous.items():signal.signal(s,h)
sys.exit(0 if report['state']=='PASS' else 1)
