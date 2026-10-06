import subprocess,pathlib,json,hashlib,datetime,os,sys
root=pathlib.Path('/Users/citrine/Projects/AgentHarness/Flow'); rows=json.load(open('/tmp/flow-next12b-final-preflight.json'))['trees']; t=rows[int(sys.argv[1])];wt=pathlib.Path(t['worktree'])
env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'}
def git(w,*args):return subprocess.check_output(['git','-C',str(w),*args],text=True,env=env).strip()
def sha(f):return hashlib.sha256(f.read_bytes()).hexdigest()
def free():s=os.statvfs(root);return s.f_bavail*s.f_frsize
ledger=json.load(open('/tmp/flow-next12b-current-ledger.json'))
consumer=json.load(open('/tmp/flow-next12b-final-consumer-check.json'))
assert str(wt) in consumer['onlyTrees']
assert consumer.get('approvedForSparse') is True, 'consumer check must explicitly allow bounded sparse' 
assert ledger['state']=='available' and not [c for c in ledger['claims'] if c['worktree']==str(wt) and c['state']!='released']
assert git(wt,'rev-parse','HEAD')==t['head'] and not git(wt,'status','--porcelain')
assert git(root,'rev-parse','HEAD')==git(root,'rev-parse','origin/main')=='74bc72f0d32daebc8f89a75528f3d72002b3a29e'
assert git(root,'ls-remote','origin','refs/heads/main').split()[0]=='74bc72f0d32daebc8f89a75528f3d72002b3a29e'
check=subprocess.run(['lsof','-nP','+D',str(wt)],capture_output=True,text=True,timeout=30)
assert check.returncode==1 and not check.stdout and not check.stderr
# Only audited same-main historical copies may be dematerialized; all other tracked paths remain.
paths=git(wt,'ls-files').splitlines(); remove={x['path']:x for x in t['candidates']};keep=[p for p in paths if p not in remove]
def blobs(w):
 out=subprocess.check_output(['git','-C',str(w),'ls-tree','-rz','HEAD'],env=env);return {p.decode():meta.split()[2].decode() for raw in out.split(b'\0') if raw for meta,p in [raw.split(b'\t')]}
mainBlobs=blobs(root); fixedBlobs=blobs(wt)
for p,row in remove.items():
 assert p.startswith('docs/evidence/') and not p.startswith('docs/evidence/d04/')
 assert mainBlobs[p]==row['blob']==fixedBlobs[p]
retained={p:sha(wt/p) for p in keep if (wt/p).is_file()}
assert len(retained)==len(keep)
patterns='/*\n'+''.join('!/'+p+'\n' for p in sorted(remove))
protected=[root]+[wt.parent/n for n in ['m2-shared-foundation','m2-integration','plan-status-review','dashboard-architecture','personal-history-compatibility','goal-input-confirmation']]
def snap(w):return {'head':git(w,'rev-parse','HEAD'),'status':git(w,'status','--porcelain'),'index':sha((w/pathlib.Path(git(w,'rev-parse','--git-path','index'))).resolve())}
before={str(w):snap(w) for w in protected};common=(root/git(root,'rev-parse','--git-common-dir')).resolve();cfg=sha(common/'config');configs={str(p):sha(p) for p in common.glob('worktrees/*/config.worktree')}
assert git(root,'config','--get','extensions.worktreeConfig')=='true'
start=datetime.datetime.now(datetime.timezone.utc).isoformat(); freeBefore=free()
assert freeBefore < 1241513984, 'Stop: target margin reached'
pre={'at':start,'worktree':str(wt),'head':t['head'],'candidateCount':len(remove),'candidateManifestSha256':sha(pathlib.Path('/tmp/flow-next12b-final-preflight.json')),'retainedCount':len(retained),'retainedHashMapSha256':hashlib.sha256(json.dumps(retained,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'protectedWorktrees':before,'sharedConfigSha256':cfg,'freeBeforeBytes':freeBefore}
pathlib.Path('/tmp/flow-next12b-'+wt.name+'-before.json').write_text(json.dumps(pre,indent=2)+'\n')
result=subprocess.run(['git','-C',str(wt),'sparse-checkout','set','--no-cone','--stdin'],input=patterns,text=True,capture_output=True,env=env)
record={'startedAt':start,'worktree':str(wt),'head':t['head'],'ledgerObservedAt':ledger['observedAt'],'openFiles':[],'exit':result.returncode,'stderr':result.stderr,'freeBeforeBytes':freeBefore,'freeAfterBytes':free(),'logicalDematerializedBytes':t['logicalCandidateBytes'],'candidateCount':len(remove),'retainedCount':len(keep),'preflightSha256':sha(pathlib.Path('/tmp/flow-next12b-final-preflight.json'))}
out=pathlib.Path('/tmp/flow-next12b-'+wt.name+'-sparse-result.json');out.write_text(json.dumps(record,indent=2)+'\n')
assert result.returncode==0 and not git(wt,'status','--porcelain') and git(wt,'rev-parse','HEAD')==t['head']
assert all((wt/p).is_file() and sha(wt/p)==v for p,v in retained.items())
assert all(not (wt/p).exists() for p in remove)
assert before=={str(w):snap(w) for w in protected}
assert cfg==sha(common/'config') and all(sha(pathlib.Path(p))==v for p,v in configs.items())
record.update({'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'allRetainedHashesUnchanged':True,'sameMainBlobForAllDematerialized':True,'protectedWorktreesUnchanged':before,'sharedConfigUnchanged':True,'nodeModulesUntouched':True,'clean':True,'patternsSha256':hashlib.sha256(patterns.encode()).hexdigest(),'freeAfterBytes':free(),'rollback':'git sparse-checkout disable restores committed copies; no objects/branches/data/dependencies deleted','providerCalls':0,'productTests':0})
record['observedVolumeDeltaBytes']=record['freeAfterBytes']-freeBefore;record['physicalAttribution']='Shared volume before/after; not exclusive attribution.'
out.write_text(json.dumps(record,indent=2)+'\n');pathlib.Path('/tmp/flow-next12b-'+wt.name+'-sparse-patterns.txt').write_text(patterns)
print(json.dumps({k:v for k,v in record.items() if k!='protectedWorktreesUnchanged'},indent=2))
