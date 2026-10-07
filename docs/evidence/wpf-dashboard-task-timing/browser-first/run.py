import os,pathlib,subprocess,json,time,signal,shutil,selectors,datetime,errno
root=pathlib.Path(__file__).parent;raw=root/'raw';scratch=root/'scratch';start=time.monotonic();errors=[];cleanup_errors=[];interrupts=[];process=None;eof={};peaks={'scratch':0,'raw':0};final_free=None;dropped_bytes=0

def stop(signum,frame):
 interrupts.append(signum)
 if 'report' in globals():report['state']='FAILED'
 if process and process.poll() is None:
  signal_owned(signal.SIGTERM)
signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
def scan_error(error):
 if error.errno!=errno.ENOENT:raise error
def size(directory):
 total=0
 for parent,dirs,files in os.walk(directory,onerror=scan_error):
  for name in files:
   try:total+=(pathlib.Path(parent)/name).stat().st_size
   except FileNotFoundError:pass
 return total

def sample():
 global final_free
 for name,directory in [('scratch',scratch),('raw',raw)]:peaks[name]=max(peaks[name],size(directory))
 s=os.statvfs(root);final_free=s.f_bavail*s.f_frsize
 if peaks['scratch']>268435456 or peaks['raw']>8388608 or final_free<1073741824:raise RuntimeError('resource bound')
selector=selectors.DefaultSelector();handles=[];exit_code=None;absent=False
def drain(timeout):
 global dropped_bytes
 for key,mask in selector.select(timeout):
  chunk=os.read(key.fileobj.fileno(),65536);name,handle=key.data
  if chunk:
   capacity=max(0,8388608-sum(h.tell() for h in handles));kept=chunk[:capacity]
   handle.write(kept);handle.flush();dropped_bytes+=len(chunk)-len(kept)
  else:eof[name]=True;selector.unregister(key.fileobj);key.fileobj.close()
def signal_owned(value):
 try:os.killpg(process.pid,value)
 except ProcessLookupError:pass
 except OSError as error:cleanup_errors.append('owned signal '+type(error).__name__)

try:
 env={key:os.environ[key] for key in ['PATH','HOME','USER','LOGNAME','SHELL','LANG','LC_ALL'] if key in os.environ}
 env.update(TMPDIR=str(scratch),TMP=str(scratch),TEMP=str(scratch),XDG_CACHE_HOME=str(scratch),NODE_DISABLE_COMPILE_CACHE='1',TSX_DISABLE_CACHE='1',MAC_CHROMIUM_TMPDIR=str(scratch),BREAKPAD_DUMP_LOCATION=str(scratch/'crashpad'))
 process=subprocess.Popen(['/opt/homebrew/opt/node@24/bin/node',str(root/'worker.mjs')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,env=env,cwd='/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-task-timing')
 for name,stream in [('stdout',process.stdout),('stderr',process.stderr)]:
  os.set_blocking(stream.fileno(),False);handle=(raw/('parent-'+name+'.log')).open('wb');handles.append(handle);selector.register(stream,selectors.EVENT_READ,(name,handle));eof[name]=False
 while selector.get_map() or process.poll() is None:
  elapsed=time.monotonic()-start
  if elapsed>45.0 and 'work-timeout' not in errors:
   errors.append('work-timeout');signal_owned(signal.SIGTERM)
  if elapsed>55.0:break
  drain(.1)
  sample()
 exit_code=process.poll()
except BaseException as error:errors.append(type(error).__name__+': '+str(error))
finally:
 if process:
  if process.poll() is None:signal_owned(signal.SIGTERM)
  until=min(start+57.5,time.monotonic()+2.5)
  while (selector.get_map() or process.poll() is None) and time.monotonic()<until:
   try:drain(.05)
   except OSError as error:cleanup_errors.append('drain '+type(error).__name__);break
  if process.poll() is None:
   signal_owned(signal.SIGKILL);cleanup_errors.append('worker needed SIGKILL')
  until=start+59.0
  while selector.get_map() and time.monotonic()<until:
   try:drain(.05)
   except OSError as error:cleanup_errors.append('final drain '+type(error).__name__);break
  try:exit_code=process.wait(timeout=max(.1,start+59.0-time.monotonic()))
  except subprocess.TimeoutExpired:cleanup_errors.append('worker not reaped')
  try:
   os.killpg(process.pid,0)
   signal_owned(signal.SIGTERM)
   until=min(start+59.0,time.monotonic()+.5)
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
 if absent:
  try:shutil.rmtree(scratch)
  except OSError as error:errors.append('scratch cleanup '+type(error).__name__)
 else:errors.append('owned group unknown/live; scratch retained')
 elapsed=(time.monotonic()-start)*1000
 if elapsed>60000:errors.append('duration bound')
 try:
  worker=json.load(open(raw/'worker-result.json'))
  if worker.get('state')!='PASSED' or worker.get('interrupts') or worker.get('cleanupErrors'):errors.append('worker not passed')
 except BaseException as error:errors.append('worker result unavailable');worker={}
 if not all(eof.values()) or len(eof)!=2:errors.append('missing EOF')
 report={'state':'PASSED' if exit_code==0 and not errors and not cleanup_errors and not interrupts and not dropped_bytes else 'FAILED','startedAtApprox':datetime.datetime.fromtimestamp(time.time()-elapsed/1000,datetime.timezone.utc).isoformat(),'actualExit':exit_code,'elapsedMs':elapsed,'ownedGroupAbsent':absent,'scratchRemoved':not scratch.exists(),'stdoutEOF':eof.get('stdout'),'stderrEOF':eof.get('stderr'),'peakSampledLogicalBytes':peaks,'terminalFreeBytes':final_free,'errors':errors,'cleanupErrors':cleanup_errors,'discardedOutputBytes':dropped_bytes,'interrupts':interrupts,'workerState':worker.get('state'),'chromeExit':worker.get('chromeExit'),'checks':worker.get('result',{}).get('checks',[]) if worker.get('result') else [],'limits':{'totalMs':60000,'cleanupReserveMs':15000,'scratchBytes':268435456,'rawBytes':8388608},'source':'72a9407e2e733479631b9409c36113e8f450b6f1','metadata':'156b49d33d08a0d47521f8a231684050d648f9c2','previousSpentConservativeMs':0}
 (raw/'result.json').write_text(json.dumps(report,indent=2)+'\n')
 if size(raw)>8388608 or time.monotonic()-start>60.0 or interrupts:report['state']='FAILED'
 report['postWriteElapsedMs']=(time.monotonic()-start)*1000;report['postWriteRawBytes']=size(raw)
 print(json.dumps(report,indent=2),flush=True)
 raise SystemExit(0 if report['state']=='PASSED' else 1)
