import datetime,hashlib,json,math,pathlib,shutil,subprocess,sys,time
P=pathlib.Path('/private/tmp/connection-actionable-20261008');W=pathlib.Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-connection-actionable')
kind=sys.argv[1];assert kind in ['direct-1','types-1','types-2'];B=P/kind;assert not B.exists()
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat(json.loads((P/'source-supply.json').read_text())['deadline'])
account=json.loads((P/'local-accounting.json').read_text()) if (P/'local-accounting.json').exists() else {'limitMs':60000,'maxChildren':3,'runs':[]}
assert len(account['runs'])<3 and sum(r['chargeMs'] for r in account['runs'])+20000<=60000
base_source=pathlib.Path('/private/tmp/context-history-20261007/run.py');runner=base_source.read_text()
old="expected=['apps/web/src/conversation-context-history', 'apps/web/src/plugin-integration/context-history.tsx', 'docs/evidence/wpf-mature04-web-history'];assert sorted(c['scope'])==expected"
expected=sorted(json.loads((P/'take-request.json').read_text())['scope'])
assert old in runner;runner=runner.replace(old,'expected='+repr(expected)+";assert sorted(c['scope'])==expected").replace('>8*1024*1024','>2*1024*1024').replace("'tmpCap':8388608","'tmpCap':2097152")
B.mkdir(mode=0o700);(B/'run.py').write_text(runner)
(B/'sandbox.sb').write_text('(version 1)\n(allow default)\n(deny file-write*)\n(allow file-write* (subpath "'+str(B/'scratch')+'") (literal "/dev/null"))\n(deny network*)\n')
node='/opt/homebrew/opt/node@24/bin/node';tsc='/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-attachment-production/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/tsc.js'
files=[W/'apps/web/src/connection/Connection.tsx',W/'apps/web/src/connection/presentation.ts',W/'apps/web/test/connection-presentation.test.ts',W/'apps/web/src/components/ui/button.tsx',W/'apps/web/src/lib/utils.ts',W/'apps/web/src/App.tsx']
oldtypes=json.loads(pathlib.Path('/private/tmp/context-history-20261007/types.json').read_text())['compilerOptions']
options={k:v for k,v in oldtypes.items() if k not in ['paths','baseUrl','types','typeRoots']}
options.update(noEmit=True,strict=True,noUncheckedIndexedAccess=True,exactOptionalPropertyTypes=True,allowImportingTsExtensions=True,skipLibCheck=False,target='ES2022',module='ESNext',moduleResolution='Bundler',jsx='react-jsx',esModuleInterop=True,lib=['ES2022','DOM'],types=['node'],typeRoots=oldtypes['typeRoots'],baseUrl=str(W))
keys=['react','react/*','@radix-ui/react-slot','class-variance-authority','clsx','tailwind-merge'];options['paths']={k:oldtypes['paths'][k] for k in keys}
config={'compilerOptions':options,'files':[str(p) for p in files[:3]]};(B/'types.json').write_text(json.dumps(config,indent=2)+'\n')
command=[node,str(files[2])] if kind.startswith('direct') else [node,tsc,'--project',str(B/'types.json')]
extra=[pathlib.Path(node),pathlib.Path(tsc),pathlib.Path(tsc).with_name('_tsc.js'),B/'run.py',B/'sandbox.sb',B/'types.json']
for key in keys:
 if '*' in key:continue
 root=pathlib.Path(options['paths'][key][0]);extra.append(root/'package.json')
 package=json.loads((root/'package.json').read_text());entry=package.get('types',package.get('typings'))
 if isinstance(entry,str) and (root/entry).is_file():extra.append(root/entry)
react=pathlib.Path(options['paths']['react'][0]);extra.extend(react/n for n in ['global.d.ts','jsx-runtime.d.ts'])
node_types=pathlib.Path(options['typeRoots'][0])/'node';extra.extend([node_types/'package.json',node_types/'index.d.ts'])
def pin(p):s=p.stat();return {'path':str(p),'realpath':str(p.resolve(strict=True)),'bytes':s.st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
pins=[pin(p) for p in files+extra]
cli=[node,'--env-file=/tmp/flow-coordination.env','/Users/citrine/Projects/AgentHarness/Flow/apps/execution-dashboard/src/coordination/cli.mjs']
live=json.loads(subprocess.check_output(cli+['list'],text=True));c=next(c for c in live['claims'] if c['claimId']=='01103af8-051e-4282-bbbb-ba432e269ba6');assert c['state']=='active' and c['version']==1 and sorted(c['scope'])==expected and c['worktree']==str(W) and c['worker']=='w01_owner'
conflicts=[x['claimId'] for x in live['claims'] if x['state']!='released' and x['claimId']!=c['claimId'] and any(a==b or a.startswith(b+'/') or b.startswith(a+'/') for a in expected for b in x['scope'])];assert not conflicts
(B/'live.json').write_text(json.dumps({'state':live['state'],'observedAt':live['observedAt'],'claims':[c],'fullLedgerConflictCheck':conflicts,'scopeLimitedSnapshot':True},indent=2)+'\n')
current=pathlib.Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform/host-i01-newpair-queue-20261007/current.json');raw=current.read_bytes();cur=json.loads(raw);f=cur['forwardAdmission'];total=sum(f['termsBytes'].values());assert total==f['minimumFreshFreeBytes']==cur['floor'];free=shutil.disk_usage(P).free
resource={'observedAt':now(),'canonicalAt':cur.get('at'),'canonicalSha256':hashlib.sha256(raw).hexdigest(),'termsBytes':{k:v for k,v in f['termsBytes'].items() if v},'sum':total,'minimumFreshFreeBytes':f['minimumFreshFreeBytes'],'topFloor':cur['floor'],'actualFree':free};(B/'resource.json').write_text(json.dumps(resource,indent=2)+'\n');assert free>=total,resource

def git(*a):return subprocess.check_output(['git',*a],cwd=W,text=True).strip()
b={'worktree':str(W),'branch':git('branch','--show-current'),'head':git('rev-parse','HEAD'),'declaredDirty':git('status','--porcelain'),'claim':c['claimId'],'claimVersion':1,'live':str(B/'live.json'),'pins':pins,'startFreeBytes':total,'stopFreeBytes':total-2*1024*1024,'command':command}
assert b['declaredDirty']==''
(B/'binding.json').write_text(json.dumps(b,indent=2)+'\n')
print(json.dumps({'event':'START','kind':kind,'at':now(),'source':b['head'],'free':free,'floor':total,'command':command}),flush=True)
start=time.monotonic();r=subprocess.run(['python3',str(B/'run.py'),str(B)],capture_output=True);elapsed=(time.monotonic()-start)*1000
(B/'outer-stdout.txt').write_bytes(r.stdout);(B/'outer-stderr.txt').write_bytes(r.stderr)
terminal=json.loads((B/'terminal.json').read_text());report=json.loads((B/'result.json').read_text());charge=math.ceil(max(elapsed,terminal['elapsedAfterWritesMs'],report['elapsedMs']))
outer={'exitCode':r.returncode,'stdoutEOF':True,'stderrEOF':True,'at':now(),'elapsedMs':elapsed,'chargeMs':charge,'terminalSha256':hashlib.sha256((B/'terminal.json').read_bytes()).hexdigest()};(B/'outer.json').write_text(json.dumps(outer,indent=2)+'\n')
account['runs'].append({'kind':kind,'chargeMs':charge,'exitCode':r.returncode,'state':terminal['state'],'cleanup':report['cleanup']});account['spentMs']=sum(r['chargeMs'] for r in account['runs']);(P/'local-accounting.json').write_text(json.dumps(account,indent=2)+'\n')
print(json.dumps({'event':'RETURN','kind':kind,'outer':outer,'terminal':terminal,'streams':report['streams'],'spent':account['spentMs']}),flush=True)
if r.returncode:print((B/'stderr.txt').read_text()[:6000] if (B/'stderr.txt').exists() else report['errors'])
sys.exit(r.returncode)
