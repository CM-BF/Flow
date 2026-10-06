import ast,hashlib,importlib.util,json,os,sys,time
from pathlib import Path
SOURCES=[Path('/tmp/flow-workspace-cache-payload-operator.py'),Path('/tmp/flow-workspace-cache-payload-operator-toy.py')]
MODULE=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py')
assert hashlib.sha256(MODULE.read_bytes()).hexdigest()=='725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
for path in SOURCES:ast.parse(path.read_bytes())
space=os.statvfs('/tmp');free=space.f_bavail*space.f_frsize
record={'atUnix':time.time(),'freeBytes':free,'minimumBytes':32*1024**2,'permission':'bounded resource-recovery operator toy only; 3 scenarios; 128KiB fixture + 128KiB results; <=30s; not product-test gate relaxation','sources':[{'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in SOURCES],'supervisor':{'path':str(MODULE),'sha256':hashlib.sha256(MODULE.read_bytes()).hexdigest()},'provider':0,'PG':0,'Chrome':0,'realDependencyWrites':0}
spec=importlib.util.spec_from_file_location('ops14_operator_toy',MODULE);supervision=importlib.util.module_from_spec(spec);sys.modules[spec.name]=supervision;spec.loader.exec_module(supervision)
if free<32*1024**2:record['state']='NOT_RUN'
else:
 result=supervision.supervise(supervision.Launch((sys.executable,'-B',str(SOURCES[1])),'/tmp',dict(os.environ),supervision.Ownership.NEW_CHILD_SESSION),supervision.Policy(15,.2,.8,65536))
 record['state']='EXECUTED';record['report']={k:(v.decode('utf8',errors='replace') if isinstance(v,bytes) else v) for k,v in vars(result).items()}
output=Path('/tmp/flow-workspace-cache-operator-toy-supervision.json')
with output.open('x') as f:json.dump(record,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
fd=os.open('/tmp',os.O_RDONLY);os.fsync(fd);os.close(fd)
print(json.dumps(record,indent=2))
