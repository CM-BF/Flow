from pathlib import Path
import os,stat,json,hashlib,subprocess,datetime,re,secrets,signal,time
R=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-context-history'); P=Path('/private/tmp/context-history-continuous-attempt2-20261008'); O=Path('/private/tmp/context-history-browser-20261007'); C=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform/host-i01-newpair-queue-20261007/current.json'); NODE='/opt/homebrew/opt/node@24/bin/node'
def h(b):return hashlib.sha256(b).hexdigest()
def save(f,v):f.write_text(json.dumps(v,indent=2)+'\n')
def call(args,**kw):return subprocess.check_output(args,timeout=15,**kw)
def ident(p):
 s=os.lstat(p);return {'dev':s.st_dev,'ino':s.st_ino,'uid':s.st_uid,'mode':s.st_mode,'nlink':s.st_nlink,'bytes':s.st_size}
def pin(x):
 f=Path(x['path']);b=f.read_bytes();assert len(b)==x['bytes'] and h(b)==x['sha256'], 'pin mismatch '+str(f)
 if 'realpath' in x:assert str(f.resolve())==x['realpath'],'realpath mismatch '+str(f)
current=json.loads(C.read_text()); g=current['ContextHistoryContinuousGrant'];assert g['state']=='CONTINUOUS_BUNDLE_BETWEEN_ATTEMPTS' and g['logicalId']=='CONTEXT-HISTORY-CONTINUOUS-ACCEPTANCE-20261008';assert not current.get('activeWindows');assert datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=90)<datetime.datetime.fromisoformat(g['segmentDeadline'].replace('Z','+00:00'))
assert call(['git','branch','--show-current'],cwd=R,text=True).strip()=='codex/web-context-history'
head=call(['git','rev-parse','HEAD'],cwd=R,text=True).strip();assert head==json.loads((P/'binding.json').read_text())['executionHead'];assert not call(['git','status','--porcelain=v1'],cwd=R,text=True).strip()
remote=call(['git','ls-remote','origin','refs/heads/codex/web-context-history'],cwd=R,text=True).split()[0];assert remote==head
ledger=json.loads(call([NODE,'--env-file=/tmp/flow-coordination.env','/Users/citrine/Projects/AgentHarness/Flow/apps/execution-dashboard/src/coordination/cli.mjs','list'],cwd=R,text=True))
# Project CLI schema is inspected without persisting the whole ledger.
rows=ledger.get('claims',ledger.get('data',{}).get('claims',[]));assert isinstance(rows,list) and rows,'claim rows unavailable'
own=[x for x in rows if x.get('claimId',x.get('id'))=='25d7e029-9334-479e-8872-61090c406e0a'];assert len(own)==1
own=own[0];assert own['version']==3 and own['state']=='active';scopes=own.get('scopes',own.get('scope',[]));assert len(scopes)==8
assert own.get('workerId',own.get('worker'))=='w01_owner'
assert own.get('worktree')==str(R) and own.get('branch')=='codex/web-context-history'
assert own.get('lead')=='external_web_d01_owner'
def pathv(v):return v if isinstance(v,str) else v.get('path',v.get('literal'))
ss=[pathv(x) for x in scopes];assert all(ss)
assert set(ss)=={'apps/web/src/App.tsx','apps/web/src/conversation-context-history','apps/web/src/conversations/ConversationThread.tsx','apps/web/src/plugin-integration/context-history.tsx','apps/web/src/plugin-integration/session.ts','apps/web/test/context-history-fixture.ts','apps/web/test/context-history.browser.ts','docs/evidence/wpf-mature04-web-history'}
conflicts=[]
for x in rows:
 if x is own or x.get('state')!='active':continue
 for a in ss:
  for y in x.get('scopes',x.get('scope',[])):
   b=pathv(y)
   if b and (a==b or a.startswith(b.rstrip('/')+'/') or b.startswith(a.rstrip('/')+'/')):conflicts.append({'claim':x.get('claimId',x.get('id')),'path':b})
assert not conflicts,'scope overlap'
assert h((P/'binding.json').read_bytes())=='ef3182b9e0d72b7954a8a64b23120d602f56a1a277c19ecdc5dfe689f4150498'; assert json.loads((P/'binding.json').read_text())['attemptNumber']==2; assert json.loads(Path('/private/tmp/context-history-closure-r2-20261007/actual/context-history-001354-9118a6/return.json').read_text())['chargeMs']==15603
for x in json.loads((P/'manifest.json').read_text())['files']:pin(x)
si=json.loads((P/'source-inputs.json').read_text())
for x in si['fixedChangedAndConsumerSources']:pin(x)
for x in json.loads((P/'source-supply.json').read_text())['allFiles']:pin({**x,'path':str(R/x['path'])})
for x in json.loads((O/'readonly-references.json').read_text()):pin(x)
num=0
for fn in ['package-files.json','peer-files.json']:
 for pkg in json.loads((Path('/private/tmp/vis-recovery-b1')/fn).read_text())['packages']:
  d=Path(pkg['root']);s=d.stat();q=pkg['identity'];expected=[q['dev'],q['ino'],q['uid']] if isinstance(q,dict) else q
  assert [s.st_dev,s.st_ino,s.st_uid]==expected,'package identity mismatch'
  for n,size,digest in pkg['files']:
   b=(d/n).read_bytes();assert len(b)==size and h(b)==digest,'dependency changed '+str(d/n);num+=1
links=json.loads((O/'link-supply.json').read_text())
for x in links['createdDirectories']:
 z=ident(Path(x['path']));assert all(z[k]==x[k] for k in ['dev','ino','uid','mode'])
for x in links['links']:
 z=ident(Path(x['path']));assert all(z[k]==x[k] for k in ['dev','ino','uid','mode']);assert os.readlink(x['path'])==x['actualTarget']
for x in json.loads(Path('/private/tmp/vis-recovery-b1/native-inputs.json').read_text())['files']:pin(x)
terms=current['forwardAdmission']['termsBytes']; total=sum(terms.values()); assert total==current['forwardAdmission']['minimumFreshFreeBytes']==current['floor']; minimum=max(total,g['minimumFreshFreeBytes']);
space=os.statvfs(R);free=space.f_bavail*space.f_frsize;assert free>=minimum,'insufficient disk'
ns=json.loads((P/'namespace.json').read_text());
for field in ('preparedRoot','actualParent'):
 x=ns[field]; f=Path(x['path']); z=ident(f); assert stat.S_ISDIR(z['mode']) and not f.is_symlink(); assert all(z[k]==x[k] for k in ['dev','ino','uid','mode']);
assert not list((P/'actual').iterdir())
closure=json.loads((P/'closure.json').read_text());
for x in closure['files']:pin({**x,'path':str(R/x['path'])})
run='context-history-'+datetime.datetime.now(datetime.timezone.utc).strftime('%H%M%S')+'-'+secrets.token_hex(3);A=P/('admission-'+run);assert not A.exists() and not (P/'actual'/run).exists();A.mkdir(mode=0o700)
save(A/'fresh.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'grant':g,'head':head,'remote':remote,'claim':{'id':own.get('claimId',own.get('id')),'version':3,'scope':ss},'conflicts':[],'dependencies':num,'freeBytes':free,'sourceCount':615,'closureFixedFiles':372,'termsSummary':{'at':current['forwardAdmission']['at'],'sum':total,'terms':terms},'minimumConsumed':minimum,'linkCount':38,'actualOutput':str(P/'actual'/run)})
blob=call(['git','show','ef458ff06cf7f12549b4bf3e10fc9b3e4c886ec7:apps/web/test/web-current-preview.browser.ts'],cwd=R);assert h(blob)=='2b010a0eab2155b048e1af634774515bd2f37b1db1b8dbdd9f9282a64ee5e0b7'
m=re.search(rb'const adminUrl = [\'\"]([^\'\"\n]+)[\'\"]',blob);assert m,'fixed admin constant absent';env=A/'admin.env';fd=os.open(env,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600);os.write(fd,b'FLOW_RECOVERY_TEST_ADMIN='+m.group(1)+b'\n');os.close(fd);save(A/'admin-identity.json',{'path':str(env),**ident(env),'sourceBlobSha256':h(blob),'field':'adminUrl'})
script=A/'pg-preflight.mjs';script.write_text("import pg from '"+str(R/'node_modules/pg/lib/index.js')+"'; const p=new pg.Pool({connectionString:process.env.FLOW_RECOVERY_TEST_ADMIN,max:1,connectionTimeoutMillis:3000,statement_timeout:3000});let r;try{const q=await p.query(\"select current_setting('max_connections')::int max,(select count(*)::int from pg_stat_activity) used,current_setting('superuser_reserved_connections')::int reserved\");r=q.rows[0];}finally{await p.end();}const available=r.max-r.used-r.reserved;console.log(JSON.stringify({max:r.max,used:r.used,reserved:r.reserved,available,poolClosed:true}));if(available<29)process.exitCode=2;\n")
c=subprocess.Popen([NODE,'--env-file='+str(env),str(script)],cwd=R,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
try:o,e=c.communicate(timeout=10)
except subprocess.TimeoutExpired:os.killpg(c.pid,signal.SIGKILL);c.communicate();raise Exception('PG preflight timeout; own env retained')
(A/'pg.stdout').write_bytes(o);(A/'pg.stderr').write_bytes(e);assert c.returncode==0 and not e,'PG preflight failed';pg=json.loads(o);assert pg['poolClosed'] and pg['available']>=29
try:os.killpg(c.pid,0);raise Exception('PG preflight group remains')
except ProcessLookupError:pass
save(A/'pg-return.json',{'pid':c.pid,'group':c.pid,'exit':c.returncode,'stdoutEOF':True,'stderrEOF':True,'groupState':'ESRCH',**pg})
latest=json.loads(C.read_text());assert latest['ContextHistoryContinuousGrant']['logicalId']==g['logicalId'] and latest['ContextHistoryContinuousGrant']['state']=='CONTINUOUS_BUNDLE_BETWEEN_ATTEMPTS';assert not latest.get('activeWindows');assert datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=90)<datetime.datetime.fromisoformat(g['segmentDeadline'].replace('Z','+00:00'))
lt=latest['forwardAdmission']['termsBytes']; ls=sum(lt.values()); assert ls==latest['forwardAdmission']['minimumFreshFreeBytes']==latest['floor']; minimum=max(minimum,ls);
space=os.statvfs(R);free=space.f_bavail*space.f_frsize;assert free>=minimum
section=(P/'parent.ts').read_text().split('const journeyGroups =')[0];srcs=sorted(set(re.findall(r'"(apps/[^\"]+)"',section)));hashes={x:h((R/x).read_bytes()) for x in srcs}
gate={'allowRun':True,'run':run,'journey':'context-history','sourceCommit':head,'sourceHashes':hashes,'expiresAt':(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=60)).isoformat(),'visualAppearancePhase':{'id':'CONTEXT-HISTORY-CONTINUOUS-ATTEMPT2-20261008','budgetMs':90000,'spentMs':0,'cleanupMs':30000},'totalMs':90000,'minimumFreeBytes':minimum,'scratchParent':'/private/tmp','maxScratchBytes':67108864}
save(A/'gate.json',gate);save(P/'selected-attempt.json',{'admission':str(A),'run':run,'gate':str(A/'gate.json'),'env':str(env),'output':str(P/'actual'/run),'freshFreeBytes':free,'preparedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()})
print(json.dumps({'PREFLIGHT_COMPLETE':str(A),'freshFreeBytes':free,'PGavailable':pg['available'],'dependencies':num}),flush=True)
os.execv('/usr/bin/python3',['/usr/bin/python3',str(P/'capture.py'),'--gate',str(A/'gate.json'),'--env-file',str(env),'--output',str(P/'actual'/run)])
