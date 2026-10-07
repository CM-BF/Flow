"""Fetch exactly two approved public npm releases once; verify SRI before bounded extraction."""
from pathlib import Path, PurePosixPath
import base64,hashlib,io,json,tarfile,time,urllib.request,datetime
ROOT=Path(__file__).resolve().parents[3]
E=ROOT/'experiments/plugins/semver-range-upgrade/upstream'
EXPECTED={'7.8.4':'sha512-rUCObTnP32Q08R2uuIrt7r9PlEonuTmtuXYcW6s5kjdlj3xbnwe+21yXptAUYcMAABLkYYTtnmzb3w3EDZfueA==','7.8.5':'sha512-Y7/KDsb8LjooZpwaqGyulO6DQlksgCncchHGk+sZIY4SBvUocMBEFH5Ur1fI4dV+Jvl0w6cjvucaIi40puRioA=='}
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):raise RuntimeError('Redirect forbidden')
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
def fetch(url,cap,path):
 start=time.monotonic(); chunks=[];total=0
 with opener.open(urllib.request.Request(url,headers={'Accept':'application/json','User-Agent':'Flow-fixed-public-source/1'}),timeout=10) as response:
  assert response.status==200 and response.url==url
  while True:
   if time.monotonic()-start>=10:raise TimeoutError('Public request deadline')
   chunk=response.read(16384)
   if not chunk:break
   total+=len(chunk)
   if total>cap:raise RuntimeError('Public response too large')
   chunks.append(chunk)
 data=b''.join(chunks)
 with path.open('xb') as f:f.write(data)
 return data,{'url':url,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'seconds':time.monotonic()-start}
for version,sri in EXPECTED.items():
 d=E/version;d.mkdir(parents=True)
 raw,metadata=fetch('https://registry.npmjs.org/semver/'+version,65536,d/'metadata.json')
 obj=json.loads(raw);assert obj['name']=='semver' and obj['version']==version and obj['license']=='ISC' and obj['dist']['integrity']==sri
 url='https://registry.npmjs.org/semver/-/semver-'+version+'.tgz';assert obj['dist']['tarball']==url
 tar,archive=fetch(url,262144,d/'upstream.tgz');actual='sha512-'+base64.b64encode(hashlib.sha512(tar).digest()).decode();assert actual==sri
 rows=[];size=0;seen=set()
 with tarfile.open(fileobj=io.BytesIO(tar),mode='r:gz') as package:
  for member in package:
   name=member.name;p=PurePosixPath(name)
   assert not p.is_absolute() and len(p.parts)>1 and p.parts[0]=='package' and '..' not in p.parts and '\\' not in name and '\x00' not in name
   assert name not in seen;seen.add(name);assert len(seen)<=80
   assert member.isfile() or member.isdir()
   if member.isdir():continue
   assert 0<=member.size<=131072;size+=member.size;assert size<=262144 and len(rows)<64
   data=package.extractfile(member).read(member.size+1);assert len(data)==member.size
   dest=d.joinpath(*p.parts);dest.parent.mkdir(parents=True,exist_ok=True)
   with dest.open('xb') as f:f.write(data)
   dest.chmod(0o444);rows.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
 assert len(rows)==obj['dist']['fileCount'] and size==obj['dist']['unpackedSize']
 assert json.loads((d/'package/package.json').read_text())['version']==version
 record={'version':version,'obtainedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'metadata':metadata,'archive':archive,'integrity':actual,'gitHead':obj['gitHead'],'license':'ISC','files':rows,'fileCount':len(rows),'unpackedBytes':size,'requests':2,'retries':0}
 (d/'source-receipt.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({k:record[k] for k in ['version','fileCount','unpackedBytes','integrity','gitHead']}))
