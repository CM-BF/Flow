import subprocess,pathlib,json,hashlib,datetime,os,sys
root=pathlib.Path('/Users/citrine/Projects/AgentHarness/Flow');base=root.parent/'Flow-worktrees';out=pathlib.Path(__file__).resolve().parent
pre=json.loads((out/'preflight.json').read_text());row=pre['trees'][int(sys.argv[1])];wt=pathlib.Path(row['worktree']);env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'}
def git(w,*args):return subprocess.check_output(['git','-C',str(w),*args],text=True,env=env).strip()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def free():s=os.statvfs(root);return s.f_bavail*s.f_frsize
def tree(w):return {p.decode():m.split()[2].decode() for x in subprocess.check_output(['git','-C',str(w),'ls-tree','-rz','HEAD'],env=env).split(b'\0') if x for m,p in [x.split(b'\t')]}
ledger=json.loads(subprocess.check_output(['/opt/homebrew/opt/node@24/bin/node','--env-file=/tmp/flow-coordination.env','apps/execution-dashboard/src/coordination/cli.mjs','list'],cwd=base/'m2-integration',text=True));assert ledger['state']=='available' and not [c for c in ledger['claims'] if c['worktree']==str(wt) and c['state']!='released']
assert git(wt,'rev-parse','HEAD')==row['head'] and not git(wt,'status','--porcelain')
assert git(root,'rev-parse','HEAD')==git(root,'rev-parse','main')==git(root,'rev-parse','origin/main')==pre['main']
assert git(root,'config','--get','extensions.worktreeConfig')=='true'
manager=out/'intake.json';confirmation=json.loads(manager.read_text());assert confirmation['readOnly'] is True and confirmation['eligibleCount']==3
remove={x['path']:x for x in row['candidates']};assert 0<len(remove)<=800
opened=subprocess.run(['lsof','-nP','-Fn','+D',str(wt)],capture_output=True,text=True,timeout=30);assert opened.returncode in (0,1) and not opened.stderr
names=[line[1:] for line in opened.stdout.splitlines() if line.startswith('n')];assert not [n for n in names if any(n==str(wt/p) or n==str(wt/p)+' (deleted)' for p in remove)]
fixed=tree(wt);main=tree(root)
for p,r in remove.items():assert fixed[p]==main[p]==r['blob'] and sha(wt/p)==r['sha256']
keep={p:sha(wt/p) for p in fixed if p not in remove and (wt/p).is_file()};assert len(keep)==len(fixed)-len(remove)
protected=[root,base/'m2-integration',base/'dashboard-architecture']
def snapshot(w):return {'head':git(w,'rev-parse','HEAD'),'status':git(w,'status','--porcelain')}
before={str(w):snapshot(w) for w in protected};common=(root/git(root,'rev-parse','--git-common-dir')).resolve();configHash=sha(common/'config');ownConfig=(wt/git(wt,'rev-parse','--git-path','config.worktree')).resolve();configs={str(p):sha(p) for p in common.glob('worktrees/*/config.worktree') if p.resolve()!=ownConfig};ownConfigBefore={'exists':ownConfig.exists(),'sha256':sha(ownConfig) if ownConfig.exists() else None}
modules=wt/'node_modules';modulesIdentity=(modules.lstat().st_dev,modules.lstat().st_ino) if os.path.lexists(modules) else None
start=datetime.datetime.now(datetime.timezone.utc).isoformat();beforeFree=free()
record={'at':start,'worktree':str(wt),'head':row['head'],'main':pre['main'],'ledgerObservedAt':ledger['observedAt'],'candidateCount':len(remove),'logicalCandidateBytes':row['logicalCandidateBytes'],'retainedFiles':len(keep),'retainedMapSha256':hashlib.sha256(json.dumps(keep,sort_keys=True).encode()).hexdigest(),'managerConfirmationSha256':sha(manager),'openCandidateFiles':0,'activePreviewInputsPreserved':True,'freeBeforeBytes':beforeFree,'candidateManifestSha256':sha(out/'preflight.json'),'protectedTreesBefore':before,'sharedConfigBeforeSha256':configHash,'otherConfigsBefore':configs,'targetOwnConfigPath':str(ownConfig),'targetOwnConfigBefore':ownConfigBefore,'allowedConfigChange':'Only target core.sparseCheckout=true and core.sparseCheckoutCone=false; shared and other hashes unchanged'}
recordFile=out/(wt.name+'-result.json');recordFile.write_text(json.dumps(record,indent=2)+'\n')
if beforeFree>=1241513984:
 record.update({'state':'NOT_RUN_PREPARE_MARGIN_REACHED','freeAfterBytes':beforeFree});recordFile.write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record));sys.exit(0)
patterns='/*\n'+''.join('!/'+p+'\n' for p in sorted(remove));(out/(wt.name+'-patterns.txt')).write_text(patterns)
result=subprocess.run(['git','-C',str(wt),'sparse-checkout','set','--no-cone','--stdin'],input=patterns,text=True,capture_output=True,env=env)
record.update({'exit':result.returncode,'stderr':result.stderr,'state':'APPLIED_PENDING_VERIFY','freeAfterBytes':free()});recordFile.write_text(json.dumps(record,indent=2)+'\n')
assert result.returncode==0 and git(wt,'rev-parse','HEAD')==row['head'] and not git(wt,'status','--porcelain')
assert all((wt/p).is_file() and sha(wt/p)==v for p,v in keep.items());assert all(not (wt/p).exists() for p in remove)
assert before=={str(w):snapshot(w) for w in protected};assert sha(common/'config')==configHash and all(sha(pathlib.Path(p))==v for p,v in configs.items())
assert modulesIdentity==((modules.lstat().st_dev,modules.lstat().st_ino) if os.path.lexists(modules) else None)
record.update({'state':'COMPLETE','finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'clean':True,'retainedHashesUnchanged':True,'protectedTreesUnchanged':True,'sharedAndOtherWorktreeConfigsUnchanged':True,'dependenciesUntouched':True,'sharedConfigAfterSha256':sha(common/'config'),'otherConfigsAfter':{p:sha(pathlib.Path(p)) for p in configs},'targetOwnConfigAfterSha256':sha(ownConfig),'freeAfterBytes':free(),'rollback':'git sparse-checkout disable restores committed historical copies; no refs/objects/dependencies/user data removed','limitations':'Known declared consumers and current exact open-file check only; no global future consumer claim. All explicit KEEP paths preserved.','productTests':0,'provider':0});record['observedVolumeDeltaBytes']=record['freeAfterBytes']-beforeFree;record['physicalAttribution']='Shared-volume before/after, not exclusive file-reclaim attribution';recordFile.write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
