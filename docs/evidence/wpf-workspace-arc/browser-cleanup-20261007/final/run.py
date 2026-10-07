import os,pathlib,subprocess,json,time,signal,shutil,selectors,datetime,errno,hashlib,sys,math,stat

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

root=pathlib.Path(__file__).parent;binding=json.loads((root/'binding.json').read_text());grant_path=pathlib.Path(sys.argv[1]);grant=json.loads(grant_path.read_text());assert grant.get('allowRun') is True and grant['bindingSha256']==hashlib.sha256((root/'binding.json').read_bytes()).hexdigest();assert datetime.datetime.fromisoformat(grant['expiresAt'].replace('Z','+00:00'))>datetime.datetime.now(datetime.timezone.utc);assert grant['totalMs']==90000 and grant['minimumFreeBytes']>=binding['limits']['minimumFreeBytes'];raw=root/'raw';scratch=root/'scratch';assert not raw.exists() and not scratch.exists();raw.mkdir(mode=0o700);scratch_owner=create_owned_scratch(root);scratch_removed=False;cache_owner=None;start=time.monotonic();errors=[];cleanup_errors=[];interrupts=[];process=None;eof={};peaks={'scratch':0,'raw':0};final_free=None;dropped_bytes=0

def stop(signum,frame):
 interrupts.append(signum)
 if 'report' in globals():report['state']='FAILED'
 if process and process.poll() is None:
  signal_owned(signal.SIGTERM)
signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
def scan_error(error):
 if error.errno!=errno.ENOENT:raise error
def size(directory,exclude=None):
 total=0
 for parent,dirs,files in os.walk(directory,onerror=scan_error):
  dirs[:]=[name for name in dirs if pathlib.Path(parent)/name!=exclude]
  for name in files:
   try:total+=(pathlib.Path(parent)/name).stat().st_size
   except FileNotFoundError:pass
 return total

def sample():
 global final_free
 for name,directory in [('scratch',scratch),('raw',raw)]:peaks[name]=max(peaks[name],size(root,scratch) if name=='raw' else size(directory))
 s=os.statvfs(root);final_free=s.f_bavail*s.f_frsize
 if peaks['scratch']>268435456 or peaks['raw']>8388608 or final_free<1073741824:raise RuntimeError('resource bound')
selector=selectors.DefaultSelector();handles=[];exit_code=None;absent=False;cache_links=[];link_receipts=[]
def drain(timeout):
 global dropped_bytes
 for key,mask in selector.select(timeout):
  chunk=os.read(key.fileobj.fileno(),65536);name,handle=key.data
  if chunk:
   capacity=max(0,262144-sum(h.tell() for h in handles));kept=chunk[:capacity]
   handle.write(kept);handle.flush();dropped_bytes+=len(chunk)-len(kept)
  else:eof[name]=True;selector.unregister(key.fileobj);key.fileobj.close()
def signal_owned(value):
 try:os.killpg(process.pid,value)
 except ProcessLookupError:pass
 except OSError as error:cleanup_errors.append('owned signal '+type(error).__name__)

try:
 if shutil.disk_usage(root).free<grant['minimumFreeBytes']:raise RuntimeError('fresh combined floor')
 if size(root,scratch)>=2*1024**2:raise RuntimeError('prepared bytes leave insufficient reserved evidence allowance')
 if subprocess.check_output(['git','rev-parse','HEAD'],cwd=binding['worktree'],text=True).strip()!=grant['executionHead']:raise RuntimeError('execution HEAD mismatch')
 if subprocess.check_output(['git','status','--porcelain'],cwd=binding['worktree'],text=True):raise RuntimeError('worktree not clean')
 for row in binding['sourcePins']+binding['externalPins']:
  path=pathlib.Path(row['path']);data=path.read_bytes()
  if str(path.resolve())!=row['realpath'] or len(data)!=row['bytes'] or hashlib.sha256(data).hexdigest()!=row['sha256']:raise RuntimeError('fixed input mismatch '+row['path'])
 for row in binding['resolverLinks']:
  path=pathlib.Path(row['path'])
  if not path.is_symlink() or str(path.resolve())!=str(pathlib.Path(row['target']).resolve()):raise RuntimeError('resolver identity mismatch '+str(path))
 for directory in [pathlib.Path(binding['worktree']),pathlib.Path(binding['worktree'])/'apps/web']:
  for name in ['.env','.env.local','.env.development','.env.development.local']:
   if os.path.lexists(directory/name):raise RuntimeError('unexpected env input; not read')
 web_modules=pathlib.Path(binding['worktree'])/'apps/web/node_modules';web_modules.mkdir(exist_ok=True);cache_owner=open_owned_chain(web_modules)
 for name in ['.vite','.vite-temp']:
  destination=scratch/name;destination.mkdir();link=web_modules/name
  if os.path.lexists(link):raise RuntimeError('cache destination already owned')
  link.symlink_to(destination,target_is_directory=True);link_stat=link.lstat();cache_links.append((link,destination,link_stat.st_dev,link_stat.st_ino));link_receipts.append({'path':str(link),'target':str(destination),'dev':link_stat.st_dev,'inode':link_stat.st_ino})
 env={key:os.environ[key] for key in ['PATH','HOME','USER','LOGNAME','SHELL','LANG','LC_ALL'] if key in os.environ}
 env.update(TMPDIR=str(scratch),TMP=str(scratch),TEMP=str(scratch),XDG_CACHE_HOME=str(scratch),NODE_DISABLE_COMPILE_CACHE='1',TSX_DISABLE_CACHE='1',MAC_CHROMIUM_TMPDIR=str(scratch),BREAKPAD_DUMP_LOCATION=str(scratch/'crashpad'))
 process=subprocess.Popen([binding['node'],'--import',binding['tsxLoader'],str(root/'worker.mjs')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,env=env,cwd=binding['worktree'])
 (raw/'start.json').write_text(json.dumps({'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'outerPid':os.getpid(),'workerPid':process.pid,'cacheLinks':link_receipts})+'\n');print(json.dumps({'actualStart':True,'outerPid':os.getpid(),'workerPid':process.pid}),flush=True)
 for name,stream in [('stdout',process.stdout),('stderr',process.stderr)]:
  os.set_blocking(stream.fileno(),False);handle=(raw/('parent-'+name+'.log')).open('wb');handles.append(handle);selector.register(stream,selectors.EVENT_READ,(name,handle));eof[name]=False
 while selector.get_map() or process.poll() is None:
  elapsed=time.monotonic()-start
  if elapsed>60 and 'work-timeout' not in errors:
   errors.append('work-timeout');signal_owned(signal.SIGTERM)
  if elapsed>85:break
  drain(.1)
  sample()
 exit_code=process.poll()
except BaseException as error:errors.append(type(error).__name__+': '+str(error))
finally:
 if process:
  if process.poll() is None:signal_owned(signal.SIGTERM)
  until=min(start+87.5,time.monotonic()+2.5)
  while (selector.get_map() or process.poll() is None) and time.monotonic()<until:
   try:drain(.05)
   except OSError as error:cleanup_errors.append('drain '+type(error).__name__);break
  if process.poll() is None:
   signal_owned(signal.SIGKILL);cleanup_errors.append('worker needed SIGKILL')
  until=start+89
  while selector.get_map() and time.monotonic()<until:
   try:drain(.05)
   except OSError as error:cleanup_errors.append('final drain '+type(error).__name__);break
  try:exit_code=process.wait(timeout=max(.1,start+89-time.monotonic()))
  except subprocess.TimeoutExpired:cleanup_errors.append('worker not reaped')
  try:
   os.killpg(process.pid,0)
   signal_owned(signal.SIGTERM)
   until=min(start+89,time.monotonic()+.5)
   while time.monotonic()<until:
    try:os.killpg(process.pid,0)
    except ProcessLookupError:absent=True;break
    time.sleep(.02)
  except ProcessLookupError:absent=True
  except OSError as error:cleanup_errors.append('group final '+type(error).__name__)
 for handle in handles:handle.close()
 selector.close()
 try:sample()
 except BaseException as error:errors.append('terminal sample '+type(error).__name__)
 try:
  if process is not None and (not absent or exit_code is None or len(eof)!=2 or not all(eof.values())):raise RuntimeError('owned process/EOF incomplete; KEEP')
  if cleanup_errors:raise RuntimeError('cleanup unknown; KEEP')
  verify_owned_chain(scratch_owner)
  if cache_owner:verify_owned_chain(cache_owner)
  for link,target,dev,ino in cache_links:
   verify_owned_chain(scratch_owner);verify_owned_chain(cache_owner)
   current=os.stat(link.name,dir_fd=cache_owner[-1]['fd'],follow_symlinks=False)
   if not stat.S_ISLNK(current.st_mode) or os.readlink(link.name,dir_fd=cache_owner[-1]['fd'])!=str(target) or (current.st_dev,current.st_ino)!=(dev,ino):raise RuntimeError('cache link identity changed; KEEP')
   os.unlink(link.name,dir_fd=cache_owner[-1]['fd'])
  remove_owned_scratch(scratch_owner,start+89)
  scratch_removed=True
 except BaseException as error:cleanup_errors.append('owned scratch/cache cleanup '+type(error).__name__+': '+str(error))
 finally:
  if cache_owner:close_owned_chain(cache_owner)
  close_owned_chain(scratch_owner)
 elapsed=(time.monotonic()-start)*1000
 if elapsed>90000:errors.append('duration bound')
 try:
  worker=json.load(open(raw/'worker-result.json'))
  if worker.get('state')!='PASSED' or worker.get('interrupts') or worker.get('cleanupErrors'):errors.append('worker not passed')
  scenario=worker.get('result') or {}
  if scenario.get('selected')!=binding['requiredGroupNames'] or scenario.get('passed')!=binding['requiredGroupNames'] or scenario.get('error') or scenario.get('cleanupErrors'):errors.append('required four groups incomplete')
  if scenario.get('cleanup',{}).get('contextClosed') is not True or scenario.get('cleanup',{}).get('httpClosed') is not True:errors.append('scenario resources not confirmed closed')
 except BaseException as error:errors.append('worker result unavailable');worker={}
 if not all(eof.values()) or len(eof)!=2:errors.append('missing EOF')
 report={'state':'PASSED' if exit_code==0 and not errors and not cleanup_errors and not interrupts and not dropped_bytes else 'FAILED','startedAtApprox':datetime.datetime.fromtimestamp(time.time()-elapsed/1000,datetime.timezone.utc).isoformat(),'actualExit':exit_code,'elapsedMs':elapsed,'ownedGroupAbsent':absent,'scratchRemoved':scratch_removed,'stdoutEOF':eof.get('stdout'),'stderrEOF':eof.get('stderr'),'peakSampledLogicalBytes':peaks,'terminalFreeBytes':final_free,'errors':errors,'cleanupErrors':cleanup_errors,'discardedOutputBytes':dropped_bytes,'interrupts':interrupts,'workerState':worker.get('state'),'chromeExit':worker.get('chromeExit'),'checks':worker.get('result',{}).get('passed',[]) if worker.get('result') else [],'limits':{'totalMs':90000,'cleanupReserveMs':30000,'scratchBytes':268435456,'rawBytes':8388608},'source':binding['source'],'executionHead':grant['executionHead'],'grantSha256':hashlib.sha256(grant_path.read_bytes()).hexdigest(),'cacheLinks':link_receipts,'chargeMs':math.ceil(elapsed),'independentPortProbe':False,'PG':False}
 (raw/'result.json').write_text(json.dumps(report,indent=2)+'\n')
 if size(root,scratch)>8388608 or time.monotonic()-start>90 or interrupts:report['state']='FAILED'
 report['postWriteElapsedMs']=(time.monotonic()-start)*1000;report['postWriteRawBytes']=size(root,scratch)
 print(json.dumps(report,indent=2),flush=True)
 raise SystemExit(0 if report['state']=='PASSED' else 1)
