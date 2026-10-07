from pathlib import Path
import os,sys,json,time,datetime,subprocess,tempfile,selectors,signal,shutil,hashlib
name=sys.argv[1];cmd=sys.argv[2:];root=Path.cwd();out=root/'docs/evidence/tui01f';free=shutil.disk_usage(root).free;threshold=1024**3+8*1024**2
record={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceHead':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'workingStatus':subprocess.check_output(['git','status','--short'],text=True),'changedTestSha256':hashlib.sha256(Path('packages/interaction/src/task-control/controller.test.ts').read_bytes()).hexdigest(),'freeBefore':free,'threshold':threshold,'maximumSeconds':30,'outputLimitBytes':2*1024**2,'temporaryLimitBytes':8*1024**2,'command':cmd}
if free<threshold:
 record['state']='BLOCKED_RESOURCE_GATE';(out/(name+'.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record));sys.exit(0)
temp=Path(tempfile.mkdtemp(prefix='flow-tui01f-checks-'));record['temporaryDirectory']=str(temp);env=dict(os.environ,TMPDIR=str(temp),XDG_CACHE_HOME=str(temp/'cache'));started=time.monotonic();p=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,env=env,start_new_session=True);sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ);chunks=[];total=0;peak=0;reason=None
while sel.get_map():
 for key,_ in sel.select(.1):
  b=os.read(key.fileobj.fileno(),32768)
  if not b:sel.unregister(key.fileobj);continue
  total+=len(b)
  if total<=2*1024**2:chunks.append(b)
  else:reason='OUTPUT_LIMIT'
 size=sum(f.stat().st_size for f in temp.rglob('*') if f.is_file() and not f.is_symlink());peak=max(peak,size)
 if size>8*1024**2:reason='TEMP_LIMIT'
 if time.monotonic()-started>30:reason='TIMEOUT'
 if reason:os.killpg(p.pid,signal.SIGKILL);p.wait();break
code=p.wait();raw=b''.join(chunks);(out/(name+'.txt')).write_bytes(raw);record.update({'state':'COMPLETED' if not reason else reason,'exitCode':code,'elapsedSeconds':time.monotonic()-started,'outputBytes':len(raw),'outputSha256':hashlib.sha256(raw).hexdigest(),'temporaryPeakSampledBytes':peak,'temporaryFinalBytes':sum(f.stat().st_size for f in temp.rglob('*') if f.is_file() and not f.is_symlink())});shutil.rmtree(temp);record['temporaryRemoved']=not temp.exists();record['freeAfter']=shutil.disk_usage(root).free;(out/(name+'.json')).write_text(json.dumps(record,indent=2)+'\n');print(raw.decode(errors='replace'));print(json.dumps(record))
