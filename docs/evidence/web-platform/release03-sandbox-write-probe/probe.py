import pathlib,json,sys,subprocess,errno
r=pathlib.Path(sys.argv[1]);results=[]
def attempt(name,path,expected):
 try: path.write_text('probe-only\n');result={'name':name,'write':'allowed','expected':expected}
 except OSError as e: result={'name':name,'write':'denied','errno':e.errno,'error':str(e),'expected':expected}
 result['pass']=result['write']==expected;results.append(result)
attempt('cache-a',r/'cache-a'/'allowed.txt','allowed')
attempt('cache-b',r/'cache-b'/'allowed.txt','allowed')
attempt('output',r/'output'/'allowed.txt','allowed')
attempt('config-side-fallback',r/'config-side'/'vite.config.ts.timestamp-probe.mjs','denied')
attempt('symlink-escape',r/'cache-a'/'escape'/'escaped.txt','denied')
child=r"""import pathlib,sys,json
r=pathlib.Path(sys.argv[1]);out=[]
for name,p,expected in [('child-allowed',r/'output'/'child.txt','allowed'),('child-denied',r/'config-side'/'child.txt','denied')]:
 try:p.write_text('child-probe-only\n');v={'name':name,'write':'allowed','expected':expected}
 except OSError as e:v={'name':name,'write':'denied','errno':e.errno,'error':str(e),'expected':expected}
 v['pass']=v['write']==expected;out.append(v)
print(json.dumps(out));sys.exit(0 if all(v['pass'] for v in out) else 2)
"""
p=subprocess.run([sys.executable,'-B','-c',child,str(r)],capture_output=True,text=True,timeout=5)
print(json.dumps({'checks':results,'childExit':p.returncode,'childStdout':p.stdout,'childStderr':p.stderr}));sys.exit(0 if all(v['pass'] for v in results) and p.returncode==0 else 2)
