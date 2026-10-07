"""Supervised same-PID checkpoint, then the single fixed Vitest child."""
import datetime,json,os,sys
path=os.environ['FLOW_LAZY_CHILD_RECEIPT']
fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
with os.fdopen(fd,'w') as file:
 json.dump({'pid':os.getpid(),'pgid':os.getpgrp(),'window':os.environ['FLOW_C02_WINDOW'],'head':os.environ['FLOW_C02_EXECUTION_HEAD'],'at':datetime.datetime.now(datetime.timezone.utc).isoformat()},file)
 file.flush();os.fsync(file.fileno())
os.execve(sys.argv[1],sys.argv[1:],os.environ)
