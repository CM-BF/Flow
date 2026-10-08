from pathlib import Path
import os,json,subprocess,hashlib,shutil,datetime,stat
root=Path(__file__).parent;base=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-workspace-composition');currentPath=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform/host-i01-newpair-queue-20261007/current.json');now=lambda:datetime.datetime.now(datetime.timezone.utc)
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def run(args):return subprocess.check_output(args,cwd=base,text=True).strip()
def write(p,d):Path(p).write_text(json.dumps(d,indent=2)+'\n')
current=json.loads(currentPath.read_text());g=current['ArcScrollbarClearanceGrant']
assert g['logicalId']=='ARC-SCROLLBAR-CLEARANCE-20261008' and g['state']=='SELECTED' and g['allowRun'] is True and g['browserGranted'] is True
assert current.get('actualHolder') is None and current.get('currentActual') is None and set(current.get('selectedWindows',{}))=={'ArcScrollbarClearance'}
assert current['selectedWindows']['ArcScrollbarClearance']==g
assert g['currentAttempt']==1 and g['previousAttempts']==0 and g['previousRuntimeMs']==0 and g['maxAttempts']==2 and g['cumulativeMaxMs']==180000
assert now()<datetime.datetime.fromisoformat(g['latestStart'].replace('Z','+00:00'))
assert now()+datetime.timedelta(seconds=90)<datetime.datetime.fromisoformat(g['deadline'].replace('Z','+00:00'))
assert sum(current['forwardAdmission']['termsBytes'].values())==current['floor']==current['forwardAdmission']['minimumFreshFreeBytes']
floor=max(current['floor'],g['minimumFreshFreeBytes'],1024**3)
assert g['packet']==str(root) and sha(root/'manifest.json')==g['manifestSHA256']=='9836cbaa94779458080d69e2e10a02888d92e280066e56a5b19ecfdb37081a7c'
assert sha(root/'binding.json')==g['bindingSHA256']=='dfca290455fe10bc06a7ceb40bf4f4adbd90cc299fc14e6093b1b2bfed2cbddd'
assert sha(root/'execution-binding.json')==g['executionSHA256']=='160024f97a9058fcea111903f57509e09745a5c5960931fbf362d1c72f2e9e55'
execution=json.loads((root/'execution-binding.json').read_text());assert execution['executionHead']==g['executionHead'] and execution['source']==g['source']
phase=json.loads((root/'phase.json').read_text());assert phase['spentMs']==0 and phase['maxAttempts']==2 and phase['totalMs']==180000 and phase['oldCreditTransfer'] is False
manifest=json.loads((root/'manifest.json').read_text())
for row in manifest['files']:
 p=Path(row['path']);assert p.stat().st_size==row['bytes'] and sha(p)==row['sha256'],str(p)
binding=json.loads((root/'binding.json').read_text());head=run(['git','rev-parse','HEAD']);assert head==execution['executionHead'];assert run(['git','branch','--show-current'])==g['branch'];assert not run(['git','status','--porcelain']);remote=run(['git','ls-remote','origin','refs/heads/'+g['branch']]).split()[0];assert remote==head
ledger=json.loads(run(['/opt/homebrew/opt/node@24/bin/node','--env-file=/tmp/flow-coordination.env','/Users/citrine/Projects/AgentHarness/Flow/apps/execution-dashboard/src/coordination/cli.mjs','list']))
claims=ledger['claims'];claim=next(c for c in claims if c['claimId']==binding['claim']['id']);prior=json.loads((base/'docs/evidence/wpf-workspace-arc/body-classifier-fix-20261007/segment.json').read_text())['claim'];assert claim['state']=='active' and claim['version']==2 and len(claim['scope'])==18 and sorted(claim['scope'])==sorted(prior['scope']) and claim['worker']=='workspace_panels_owner' and claim['worktree']==str(base) and claim['branch']==g['branch']
def overlaps(a,b):return a==b or a.startswith(b.rstrip('/')+'/') or b.startswith(a.rstrip('/')+'/')
conflicts=[{'id':c['claimId'],'left':a,'right':b} for c in claims if c['claimId']!=claim['claimId'] and c.get('state')=='active' and c.get('role')=='writer' for a in claim['scope'] for b in c['scope'] if overlaps(a,b)];assert not conflicts
for row in binding['sourcePins']+binding['externalPins']:
 p=Path(row['path']);assert str(p.resolve())==row['realpath'] and p.stat().st_size==row['bytes'] and sha(p)==row['sha256'],str(p)
rows=[r for r in binding['sourcePins'] if r.get('gitPath')];blobs=run(['git','rev-parse']+[execution['source']+':'+r['gitPath'] for r in rows]).splitlines();assert all(blob==r['blob'] for r,blob in zip(rows,blobs))
for row in binding['resolverLinks']:
 p=Path(row['path']);assert p.is_symlink() and p.resolve()==Path(row['target']).resolve()
for name in ['raw','scratch','outer','grant.json','preflight.json']:
 assert not os.path.lexists(root/name),name
for name in ['.vite','.vite-temp']:assert not os.path.lexists(base/'apps/web/node_modules'/name)
for directory in [base,base/'apps/web']:
 for name in ['.env','.env.local','.env.development','.env.development.local']:assert not os.path.lexists(directory/name)
assert root.resolve()==root and not root.is_symlink();identity=root.stat();assert identity.st_uid==os.getuid()
free=shutil.disk_usage(root).free;assert free>=floor;assert sum(p.stat().st_size for p in root.iterdir() if p.is_file())<2*1024**2
# Re-read selection immediately before consuming data-only grant.
latest=json.loads(currentPath.read_text());assert latest['ArcScrollbarClearanceGrant']==g and latest['actualHolder'] is None and latest['currentActual'] is None and latest.get('selectedWindows')=={'ArcScrollbarClearance':g}
shutil.copyfile(root/'binding.json',root/'binding-before-actual.json');shutil.copyfile(root/'manifest.json',root/'manifest-before-actual.json');binding['limits']['minimumFreeBytes']=floor;write(root/'binding.json',binding)
name='arc-scrollbar-1-'+now().strftime('%Y%m%d-%H%M%S');gate={'allowRun':True,'run':name,'expiresAt':g['deadline'],'executionHead':head,'bindingSha256':sha(root/'binding.json'),'totalMs':90000,'minimumFreeBytes':floor,'logicalId':g['logicalId']};write(root/'grant.json',gate)
write(root/'preflight.json',{'at':now().isoformat(),'run':name,'logicalId':g['logicalId'],'managerAt':current['at'],'managerGrant':g,'termsBytes':current['forwardAdmission']['termsBytes'],'termSum':current['floor'],'freeBytes':free,'minimumFreshFreeBytes':floor,'attempt':1,'phaseConsumedBeforeMs':0,'head':head,'actualRemote':remote,'dirty':False,'claimObservedAt':ledger.get('observedAt'),'claim':claim,'overlap':conflicts,'sourcePins':len(binding['sourcePins']),'externalPins':len(binding['externalPins']),'resolverLinks':len(binding['resolverLinks']),'rootIdentity':{'dev':identity.st_dev,'ino':identity.st_ino,'uid':identity.st_uid},'noRuntimeBefore':True})
write(root/'actual-data-binding.json',{'beforeSHA':sha(root/'binding-before-actual.json'),'afterSHA':sha(root/'binding.json'),'onlyDelta':'limits.minimumFreeBytes routine max(manager frozen,current complete,intrinsic1GiB); callers unchanged','gateSHA':sha(root/'grant.json'),'callersUnchanged':[{"name":n,"sha256":sha(root/n)} for n in ['run.py','worker.mjs','capture.py']]})
os.execv('/opt/homebrew/opt/python@3.13/bin/python3.13',['/opt/homebrew/opt/python@3.13/bin/python3.13',str(root/'capture.py'),'--grant',str(root/'grant.json'),'--output',str(root/'outer')])
