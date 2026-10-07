from pathlib import Path
import os,sys,time,datetime,json,subprocess,signal,hashlib,shutil,math
base=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-message-settings-app');tmp=Path(__file__).parent
assert not (tmp/'result.json').exists()
started=time.monotonic();hard=started+10;signals=[]
for sig in (signal.SIGTERM,signal.SIGINT):signal.signal(sig,lambda n,f:signals.append(n))
def absent(pid):
 try:os.killpg(pid,0);return False
 except ProcessLookupError:return True
p=None;out=b'';err=b'';eof=False;errors=[];scratch=tmp/'scratch';scratch.mkdir()
report={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'budgetMs':10000,'cleanupMs':5000,'freeFloor':6953631744,'freeBefore':shutil.disk_usage(tmp).free,'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=base,text=True).strip(),'sourceSha256':hashlib.sha256((base/'apps/web/test/conversation-recovery.browser.ts').read_bytes()).hexdigest(),'realAdminRead':False}
try:
 assert report['freeBefore']>=report['freeFloor']
 env={k:v for k,v in os.environ.items() if k in ('PATH','HOME','USER','LOGNAME','LANG','LC_ALL')};env.update(TMPDIR=str(scratch),TSX_DISABLE_CACHE='1',NODE_DISABLE_COMPILE_CACHE='1')
 args=['/usr/bin/sandbox-exec','-f',str(tmp/'sandbox.sb'),'/opt/homebrew/opt/node@24/bin/node','--env-file='+str(tmp/'sentinel.env'),'--import','tsx',str(tmp/'check.mjs')]
 p=subprocess.Popen(args,cwd=base,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True);report['pid']=p.pid
 print(json.dumps({'actualStart':report['startedAt'],'pid':p.pid,'budgetMs':10000}),flush=True)
 try:out,err=p.communicate(timeout=max(.01,hard-5-time.monotonic()));eof=True
 except subprocess.TimeoutExpired:errors.append('work deadline')
 if p.poll() not in (None,0):errors.append('child exit '+str(p.returncode))
except BaseException as e:errors.append(type(e).__name__+': '+str(e))
finally:
 if p:
  if not absent(p.pid):
   try:os.killpg(p.pid,signal.SIGTERM)
   except ProcessLookupError:pass
   try:out,err=p.communicate(timeout=max(.01,min(.5,hard-time.monotonic())));eof=True
   except subprocess.TimeoutExpired:
    os.killpg(p.pid,signal.SIGKILL)
    try:out,err=p.communicate(timeout=max(.01,hard-time.monotonic()));eof=True
    except subprocess.TimeoutExpired:errors.append('cleanup deadline')
  report.update(actualExit=p.returncode,groupAbsent=absent(p.pid),stdoutEOF=eof,stderrEOF=eof)
 if len(out)+len(err)>128*1024:errors.append('raw limit')
 (tmp/'stdout.log').write_bytes(out[:128*1024]);(tmp/'stderr.log').write_bytes(err[:128*1024])
 if p and report.get('groupAbsent'):shutil.rmtree(scratch)
 report['scratchAbsent']=not scratch.exists();report['retainedBytes']=sum(f.stat().st_size for f in tmp.iterdir() if f.is_file())
 if report['retainedBytes']>128*1024:errors.append('retained limit')
 report.update(signals=signals,errors=errors,elapsedMs=(time.monotonic()-started)*1000);report['chargeMs']=math.ceil(report['elapsedMs'])
 if signals or time.monotonic()>hard:errors.append('signal/total deadline')
 report['state']='PASS' if p and p.returncode==0 and eof and not errors and report['groupAbsent'] and report['scratchAbsent'] else 'FAIL'
 (tmp/'result.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
sys.exit(0 if report['state']=='PASS' else 1)
