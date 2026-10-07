import subprocess,pathlib,json,os,time,signal,datetime,hashlib,math,sys
r=pathlib.Path(__file__).parent;wt='/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-workspace-composition';parent=pathlib.Path('/private/tmp/arc-browser-owned-cleanup-tp1sri1w/run.py');floor=16846028800
ledger=json.loads(subprocess.check_output(['/opt/homebrew/opt/node@24/bin/node','--env-file=/tmp/flow-coordination.env','/Users/citrine/Projects/AgentHarness/Flow/apps/execution-dashboard/src/coordination/cli.mjs','list'],text=True));c=next(x for x in ledger['claims'] if x['claimId']=='c34d95d1-af01-4325-bcd5-77ba9dd28379')
assert ledger['state']=='available' and c['state']=='active' and c['version']==1 and len(c['scope'])==20 and c['worker']=='workspace_panels_owner' and c['worktree']==wt and c['branch']=='codex/web-workspace-composition'
over=lambda a,b:a==b or a.startswith(b+'/') or b.startswith(a+'/')
assert not [q for q in ledger['claims'] if q['state']=='active' and q['role']=='writer' and q['claimId']!=c['claimId'] and any(over(a,b) for a in c['scope'] for b in q['scope'])]
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=wt,text=True).strip()=='0be5087d9d213cfbbcc26975d63d644d64dbaf93'
assert subprocess.check_output(['git','branch','--show-current'],cwd=wt,text=True).strip()==c['branch']
assert set(subprocess.check_output(['git','diff','--name-only'],cwd=wt,text=True).splitlines())=={'plans/wpf-workspace-arc/status.md'}
s=os.statvfs(r);free=s.f_bavail*s.f_frsize;assert free>=floor
scratch=r/'scratch';st=scratch.lstat();identity=(st.st_dev,st.st_ino,st.st_uid);raw=r/'raw';assert not (raw/'start.json').exists()
start=time.monotonic();at=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();errors=[];p=None
out=(raw/'stdout.log').open('xb');err=(raw/'stderr.log').open('xb')
try:
 p=subprocess.Popen(['/usr/bin/sandbox-exec','-p','(version 1)(allow default)(deny network*)','/usr/bin/python3','-B',str(r/'test.py'),str(parent),str(scratch)],stdout=out,stderr=err,start_new_session=True,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1','TMPDIR':str(scratch)},cwd=r)
 receipt={'at':at(),'pid':p.pid,'pgid':p.pid,'minimumFreeBytes':floor,'availableBytes':free,'sourceSha256':hashlib.sha256(parent.read_bytes()).hexdigest(),'testSha256':hashlib.sha256((r/'test.py').read_bytes()).hexdigest(),'python':os.path.realpath('/usr/bin/python3'),'claimObservedAt':ledger['observedAt'],'totalMs':20000,'workMs':15000,'cleanupMs':5000,'stdout':'regular file','stderr':'regular file'}
 (raw/'start.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({'actualSTART':receipt}),flush=True)
 try:exitcode=p.wait(timeout=15)
 except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGTERM);errors.append('work timeout');exitcode=p.wait(timeout=2)
finally:
 if p and p.poll() is None:
  os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=2);errors.append('required kill')
 out.close();err.close()
 absent=False
 if p:
  try:os.killpg(p.pid,0)
  except ProcessLookupError:absent=True
 if not absent:errors.append('group not absent')
 st=scratch.lstat()
 if (st.st_dev,st.st_ino,st.st_uid)!=identity or scratch.is_symlink():errors.append('scratch identity changed')
 elif absent:
  if list(scratch.iterdir()):errors.append('scratch nonempty KEEP')
  else:scratch.rmdir()
 elapsed=(time.monotonic()-start)*1000
 result={'at':at(),'exitCode':p.returncode if p else None,'pid':p.pid if p else None,'groupAbsent':absent,'scratchAbsent':not os.path.lexists(scratch),'regularLogsClosed':out.closed and err.closed,'dualEOF':'NOT_APPLICABLE_REGULAR_FILES','elapsedMs':elapsed,'chargeMs':math.ceil(elapsed),'state':'PASSED' if p and p.returncode==0 and not errors else 'FAILED','errors':errors,'PG':False,'HTTP':False,'Chrome':False}
 (raw/'result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'actualRETURN':result}),flush=True)
raise SystemExit(0 if result['state']=='PASSED' else 1)
