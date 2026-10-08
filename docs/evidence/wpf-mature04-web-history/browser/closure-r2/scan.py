from pathlib import Path
import json,subprocess,re,posixpath,hashlib,collections,os
R=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-context-history');P=Path('/private/tmp/context-history-closure-r2-20261007');H='9cd2ae350887ca80e59765f1867627a29cdca787'
raw=subprocess.check_output(['git','ls-tree','-r','-z',H,'--','apps/web/src','apps/web/test','apps/web/index.html','apps/web/package.json','apps/server','packages'],cwd=R)
tree={}
for row in raw.split(b'\0'):
 if row:
  a,name=row.split(b'\t',1);mode,typ,oid=a.decode().split();tree[name.decode()]={'mode':mode,'oid':oid,'type':typ}
proc=subprocess.Popen(['git','cat-file','--batch'],cwd=R,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
cache={}
def blob(path):
 if path in cache:return cache[path]
 assert path in tree and tree[path]['type']=='blob',path
 proc.stdin.write((tree[path]['oid']+'\n').encode());proc.stdin.flush();head=proc.stdout.readline().split();n=int(head[-1]);b=proc.stdout.read(n);assert proc.stdout.read(1)==b'\n';cache[path]=b;return b
packages={}
for path in tree:
 if re.fullmatch(r'packages/[^/]+/package.json',path):
  v=json.loads(blob(path));packages[v['name']]={'path':path,'manifest':v}
roots=['apps/web/test/context-history-fixture.ts','apps/web/test/context-history.browser.ts','apps/web/test/conversation-recovery.fixture.ts','apps/web/src/main.tsx','apps/web/index.html','apps/server/src/index.ts']
queue=collections.deque(roots);seen=set();edges=[];unresolved=[];external=[];dynamic=[];resources=[]
# Conservative syntactic extraction, not code execution. All literal branches included.
patterns=[('static-from',r'\b(?:import|export)\s+(?!\()(?:(?!;).)*?\bfrom\s*[\'\"]([^\'\"]+)[\'\"]'),('side-effect',r'\bimport\s*[\'\"]([^\'\"]+)[\'\"]'),('dynamic-literal',r'\b(?:import|require)\s*\(\s*[\'\"]([^\'\"]+)[\'\"]\s*\)'),('css-import',r'@import\s+(?:url\()?\s*[\'\"]([^\'\"]+)[\'\"]')]
def resolve_relative(base,spec):
 spec=spec.split('?')[0];x=posixpath.normpath(posixpath.join(posixpath.dirname(base),spec));opts=[x]
 if x.endswith(('.js','.mjs','.cjs')):opts += [x.rsplit('.',1)[0]+ext for ext in ['.ts','.tsx','.mts','.cts']]
 else:opts += [x+ext for ext in ['.ts','.tsx','.js','.jsx','.mjs','.json','.css']]+[x+'/index'+ext for ext in ['.ts','.tsx','.js']]
 return next((x for x in opts if x in tree),None)
def bare(spec):
 parts=spec.split('/');name='/'.join(parts[:2]) if spec.startswith('@') else parts[0];sub=spec[len(name):]
 if name in packages:
  item=packages[name];exp=item['manifest'].get('exports');key='.'+sub
  if isinstance(exp,str):target=exp if not sub else None
  elif isinstance(exp,dict):target=exp.get(key)
  else:target=item['manifest'].get('module',item['manifest'].get('main','index.js')) if not sub else sub[1:]
  if isinstance(target,dict):target=target.get('import',target.get('default'))
  if isinstance(target,str):return resolve_relative(item['path'],target),item['path']
  return None,item['path']
 return None,None
while queue:
 path=queue.popleft()
 if path in seen:continue
 assert len(seen)<1600,'bound exceeds1600';seen.add(path);b=blob(path);text=b.decode('utf8');suffix=Path(path).suffix
 if suffix not in ['.ts','.tsx','.mts','.js','.jsx','.mjs','.css','.html']:continue
 found=[]
 for kind,pat in patterns:
  for m in re.finditer(pat,text,re.S):found.append((m.start(),kind,m.group(1)))
 if suffix=='.html':
  for m in re.finditer(r'(?:src|href)=[\'\"](/src/[^\'\"]+)[\'\"]',text):found.append((m.start(),'html-entry','.'+m.group(1)))
 for at,kind,spec in sorted(set(found)):
  line=text[:at].count('\n')+1
  if spec.startswith('node:'):edges.append({'from':path,'line':line,'specifier':spec,'kind':kind,'builtin':True});continue
  if spec.startswith('.'):
   dest=resolve_relative(path,spec);manifest=None
  elif spec.startswith(str(R)+'/'):
   dest=spec[len(str(R))+1:];dest=dest if dest in tree else resolve_relative('x','./'+dest);manifest=None
  else:
   dest,manifest=bare(spec)
   if manifest and manifest not in seen:queue.append(manifest)
   if not manifest:external.append({'from':path,'line':line,'specifier':spec,'kind':kind});continue
  if dest:edges.append({'from':path,'line':line,'specifier':spec,'kind':kind,'to':dest});queue.append(dest)
  else:unresolved.append({'from':path,'line':line,'specifier':spec,'kind':kind})
 for m in re.finditer(r'\b(?:import|require)\s*\(([^\n;]+)',text):
  arg=m.group(1).strip()
  if not re.match(r'^[\'\"][^\'\"]+[\'\"]\s*\)',arg):dynamic.append({'from':path,'line':text[:m.start()].count('\n')+1,'expression':arg[:180]})
 for m in re.finditer(r'new\s+URL\(\s*[\'\"]([^\'\"]+)[\'\"]\s*,\s*import\.meta\.url\s*\)',text):
  spec=m.group(1);target=posixpath.normpath(posixpath.join(posixpath.dirname(path),spec));resources.append({'from':path,'line':text[:m.start()].count('\n')+1,'url':spec,'target':target,'fixedFile':target in tree,'directory':any(t.startswith(target.rstrip('/')+'/') for t in tree)})
# Runtime migration reads use a directory rather than ES imports. Bind exact fixed SQL set.
for path in tree:
 if path.startswith('packages/storage/migrations/') and path.endswith('.sql'):seen.add(path);blob(path)
files=[];missing=[];mismatches=[]
for path in sorted(seen):
 b=blob(path);row={'path':path,'gitBlob':tree[path]['oid'],'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()};files.append(row)
 q=R/path
 if not os.path.lexists(q):missing.append(row)
 elif q.is_symlink() or q.read_bytes()!=b:mismatches.append({'path':path,'symlink':q.is_symlink()})
proc.stdin.close();proc.stdout.close();proc.wait(timeout=5)
report={'schema':'fixed-literal-source-closure.v1','fixedHead':H,'roots':roots,'method':'Bounded static regex extraction from immutable Git blobs; relative static/from/side-effect/dynamic literal/require/CSS imports and local package exports, conservative overapproximation including unused functions. Explicit dynamic/resource boundaries below. Does not execute or fully parse JavaScript.','limits':{'maxFiles':1600,'installer':False,'productImports':False},'files':files,'edges':edges,'externalEdges':external,'dynamicBoundaries':dynamic,'resourceBoundaries':resources,'unresolvedLiteralEdges':unresolved,'missingMaterialization':missing,'existingMismatch':mismatches}
(P/'closure.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'files':len(files),'bytes':sum(x['bytes'] for x in files),'edges':len(edges),'externalEdges':len(external),'dynamic':dynamic,'resources':resources,'unresolved':unresolved,'missing':missing,'mismatches':mismatches,'reportBytes':(P/'closure.json').stat().st_size},indent=2))
