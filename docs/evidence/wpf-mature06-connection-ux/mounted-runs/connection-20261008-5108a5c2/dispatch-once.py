import json,hashlib,subprocess,pathlib,datetime,os,shutil,time,selectors,math,uuid,signal
P=pathlib.Path('/private/tmp/connection-ux-b1');W=pathlib.Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-connection-actionable');now=lambda:datetime.datetime.now(datetime.timezone.utc);iso=lambda:now().isoformat();sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest();save=lambda p,x:pathlib.Path(p).write_text(json.dumps(x,indent=2)+'\n')
C=pathlib.Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform/host-i01-newpair-queue-20261007/current.json');c=json.loads(C.read_text());g=c['ConnectionUXMountedGrant'];assert g['state']=='SELECTED_NOT_STARTED' and g['allowRun'] and g['singleUse'];assert now()<datetime.datetime.fromisoformat(g['latestStart'].replace('Z','+00:00'));f=c['forwardAdmission'];floor=sum(f['termsBytes'].values());assert floor==f['minimumFreshFreeBytes']==c['floor'];floor=max(floor,g['minimumFreshFreeBytes'])
b=json.loads((P/'binding.json').read_text());assert b['head']==g['executionHead'] and b['sourceSnapshot']==g['source'];assert sha(P/'supervisor.py')==g['runnerSHA256'] and sha(P/'worker.mjs')==g['workerSHA256'];assert sha(P/'binding.json')==g['preparedBindingSHA256'] and sha(P/'manifest.json')==g['preparedManifestSHA256']
for field in ['sourceReview','nativeChromeBoundaryApproval']:assert sha(g[field]['path'])==g[field]['sha256']
node=b['node']['path'];cli=[node,'--env-file=/tmp/flow-coordination.env','/Users/citrine/Projects/AgentHarness/Flow/apps/execution-dashboard/src/coordination/cli.mjs'];live=json.loads(subprocess.check_output(cli+['list']));claim=next(x for x in live['claims'] if x['claimId']==b['claim']['claimId']);expected=sorted(json.loads((P/'amend-receipt-corrected.json').read_text())['claim']['scope']);assert claim['state']=='active' and claim['version']==2 and claim['worker']=='w01_owner' and claim['worktree']==str(W) and claim['branch']==b['branch'] and sorted(claim['scope'])==expected
conflicts=[x['claimId'] for x in live['claims'] if x['state']=='active' and x['claimId']!=claim['claimId'] and any(a==z or a.startswith(z+'/') or z.startswith(a+'/') for a in expected for z in x['scope'])];assert not conflicts
def git(*a):return subprocess.check_output(['git',*a],cwd=W,text=True).strip()
assert git('rev-parse','HEAD')==b['head'] and git('branch','--show-current')==b['branch'] and git('status','--porcelain')=='';remote=git('ls-remote','origin','refs/heads/'+b['branch']).split()[0];assert remote==b['head']
for rel,digest in {**b['sources'],**b['readOnlyDependencies']}.items():assert sha(W/rel)==digest,rel
for rel,digest in b['preparedFiles'].items():assert sha(P/rel)==digest,rel
assert str(pathlib.Path(node).resolve())==b['node']['realpath'] and sha(node)==b['node']['sha256']
for i in b['externalPins']:assert str(pathlib.Path(i['path']).resolve())==i['realpath'] and sha(i['path'])==i['sha256']
for i in json.loads((P/'installed-roots.json').read_text())['roots']:
 p=pathlib.Path(i['root']);s=p.stat();assert str(p.resolve())==str(p) and (s.st_dev,s.st_ino,s.st_uid)==(i['device'],i['inode'],i['uid']) and sha(p/'package.json')==i['packageSha256']
for name,length,digest in json.loads((P/'dependency-files.json').read_text())['files']:
 p=pathlib.Path(name);assert p.is_file() and not p.is_symlink() and p.stat().st_size==length and sha(p)==digest
for n in ['browser-budget.json','result.json','consumed-gate.json','scratch','raw','worker.log','child-gate.json','fresh-gate.json','actual-start.json','outer-result.json']:assert not (P/n).exists(),n
assert (P.stat().st_dev,P.stat().st_ino)==(b['measurementRoot']['device'],b['measurementRoot']['inode']);free=shutil.disk_usage(P).free;assert free>=floor;assert now()<datetime.datetime.fromisoformat(g['latestStart'].replace('Z','+00:00'))
shutil.copyfile(P/'binding.json',P/'before-review-binding.json');shutil.copyfile(P/'manifest.json',P/'before-review-manifest.json');b.update(state='REVIEWED_SOURCE_BOUND',sourceReview=g['sourceReview'],nativeChromeBoundaryApproval=g['nativeChromeBoundaryApproval']);save(P/'binding.json',b)
m=json.loads((P/'manifest.json').read_text());
for i in m['files']:
 p=pathlib.Path(i['path']);i.update(bytes=p.stat().st_size,sha256=sha(p))
save(P/'manifest.json',m)
gate={'mode':'connection-ux-browser','allowRun':True,'singleUse':True,'taskId':b['task'],'entry':'connection-ux','run':'connection-20261008-'+uuid.uuid4().hex[:8],'expiresAt':(now()+datetime.timedelta(seconds=90)).isoformat(),'bindingSha256':sha(P/'binding.json'),'runnerSha256':sha(P/'supervisor.py'),'claim':b['claim'],'overlaps':[],'sourceHead':b['head'],'sourceHashes':b['sources'],'previousRuntimeMs':0,'totalMs':60000,'startFreeBytes':floor,'stopFreeBytes':1073741824+64*1024*1024,'nativeChromeBoundaryApproval':b['nativeChromeBoundaryApproval'],'sourceReview':b['sourceReview'],'priorLocalEvidence':b['priorLocalEvidence']}
save(P/'admission.json',{'at':iso(),'canonicalSha256':sha(C),'grant':g,'claim':claim,'conflicts':[],'termsBytes':{k:v for k,v in f['termsBytes'].items() if v},'sum':c['floor'],'frozenFloor':g['minimumFreshFreeBytes'],'consumedFloor':floor,'free':free,'allInputsVerified':True,'remote':remote,'root':b['measurementRoot']});save(P/'fresh-gate.json',gate)
t=time.monotonic();p=subprocess.Popen(['python3',str(P/'supervisor.py'),'--gate',str(P/'fresh-gate.json')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True);start={'at':iso(),'pid':p.pid,'pgid':p.pid,'run':gate['run'],'floor':floor,'free':free};save(P/'actual-start.json',start);print(json.dumps({'event':'START',**start}),flush=True)
s=selectors.DefaultSelector();streams={};handles=[];total=0
for n,pipe in [('stdout',p.stdout),('stderr',p.stderr)]:
 os.set_blocking(pipe.fileno(),False);h=open(P/('outer-'+n+'.txt'),'xb');handles.append(h);streams[n]={'eof':False,'receivedBytes':0,'keptBytes':0,'droppedBytes':0};s.register(pipe,selectors.EVENT_READ,(n,h))
while s.get_map() or p.poll() is None:
 for key,_ in s.select(.05):
  n,h=key.data;data=os.read(key.fileobj.fileno(),65536);r=streams[n]
  if not data:r['eof']=True;s.unregister(key.fileobj);key.fileobj.close();continue
  keep=min(len(data),max(0,262144-total));h.write(data[:keep]);h.flush();total+=keep;r['receivedBytes']+=len(data);r['keptBytes']+=keep;r['droppedBytes']+=len(data)-keep
 if time.monotonic()-t>65 and p.poll() is None:os.killpg(p.pid,signal.SIGTERM)
exitcode=p.wait();s.close()
for h in handles:h.close()
result=json.loads((P/'result.json').read_text()) if (P/'result.json').exists() else {};terminal=[json.loads(x) for x in (P/'outer-stdout.txt').read_text().splitlines() if x.startswith('{')];term=terminal[-1] if terminal else {};elapsed=(time.monotonic()-t)*1000
out={'at':iso(),'actualExitCode':exitcode,'elapsedMs':elapsed,'chargeMs':math.ceil(max(elapsed,term.get('afterFinalWritesElapsedMs',0),result.get('elapsedMs',0))),'streams':streams,'terminal':term,'parentPid':p.pid};save(P/'outer-result.json',out);print(json.dumps({'event':'TERMINAL',**out}),flush=True)
