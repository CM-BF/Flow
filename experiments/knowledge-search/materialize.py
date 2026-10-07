"""Fixed Git input supply only; no imports, tests, dependency install, or database work."""
from pathlib import Path
import hashlib, json, posixpath, re, subprocess
ROOT = Path(__file__).resolve().parent
WT = ROOT.parents[1]
BASE = '3c9345df4aec85a37e8a2a155e079db260d515b1'
def blob(path): return subprocess.check_output(['git', 'show', BASE + ':' + path], cwd=WT)
def main():
    destination = ROOT / 'source'
    if destination.exists(): raise SystemExit('Existing supply requires identity review; never overwrite.')
    files = {}
    for line in subprocess.check_output(['git','ls-tree','-r','-l',BASE],cwd=WT,text=True).splitlines():
        meta,path=line.split('\t'); mode,kind,oid,size=meta.split()
        if kind == 'blob': files[path]={'mode':mode,'bytes':int(size)}
    packages={}
    for path in files:
        if re.fullmatch(r'packages/[^/]+/package.json',path):
            value=json.loads(blob(path)); entry=value.get('exports')
            if isinstance(entry,str): packages[value['name']]=posixpath.normpath(posixpath.join(posixpath.dirname(path),entry))
    pending=['apps/server/src/index.ts','apps/server/src/knowledge/search.ts','apps/server/src/knowledge/text.ts','packages/client/src/index.ts']
    selected={}; bare=set(); unresolved=[]
    while pending:
        path=pending.pop()
        if path in selected: continue
        content=blob(path); selected[path]=content
        for spec in re.findall(r'''(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]''',content.decode()):
            if spec.startswith('.'):
                name=posixpath.normpath(posixpath.join(posixpath.dirname(path),spec))
                choices=[name,re.sub(r'\.js$','.ts',name),re.sub(r'\.js$','.tsx',name),name+'/index.ts']
                match=next((candidate for candidate in choices if candidate in files),None)
                if match: pending.append(match)
                else: unresolved.append([path,spec])
            elif spec in packages: pending.append(packages[spec])
            elif not spec.startswith('node:'): bare.add(spec)
    for path in files:
        if path.startswith('packages/storage/migrations/') and path.endswith('.sql') or path in ['package.json','tsconfig.json'] or re.fullmatch(r'packages/(contracts|client|plugin-runtime)/package.json',path):
            selected[path]=blob(path)
    rows=[{'path':path,'mode':files[path]['mode'],'bytes':len(value),'sha256':hashlib.sha256(value).hexdigest()} for path,value in sorted(selected.items())]
    size=sum(row['bytes'] for row in rows)
    if size>8*1024*1024 or unresolved: raise SystemExit(json.dumps({'bytes':size,'unresolved':unresolved}))
    manifest={'base':BASE,'method':'reachable literal imports plus all fixed dynamic migration SQL and package metadata; no source imports executed','count':len(rows),'bytes':size,'items':rows,'bareImports':sorted(bare),'unresolved':unresolved}
    destination.mkdir()
    for path,value in selected.items():
        target=destination/path; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(value)
    (ROOT/'source-inputs.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'count':len(rows),'bytes':size,'bareImports':sorted(bare),'sqlCount':sum(row['path'].endswith('.sql') for row in rows)}))
if __name__ == '__main__': main()
