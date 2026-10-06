"""Owned real PTY against one synthetic HTTP fixture. No provider or personal service."""
import os,pty,subprocess,select,time,json,termios,fcntl,struct,signal,urllib.request
master,slave=pty.openpty();original=termios.tcgetattr(slave)
fcntl.ioctl(slave,termios.TIOCSWINSZ,struct.pack('HHHH',28,110,0,0))
child=subprocess.Popen([os.environ['TUI_TEST_NODE'],'--import','tsx','apps/tui/src/main.tsx'],stdin=slave,stdout=slave,stderr=slave,env={k:v for k,v in os.environ.items() if k in ['PATH','TERM','LANG','FLOW_URL','FLOW_TOKEN','FLOW_TUI_STATE_DIR']},close_fds=True)
output=bytearray();checks=[];started=time.monotonic()
def cancelled(_s,_f): raise RuntimeError('Owned PTY timeout')
signal.signal(signal.SIGTERM,cancelled)
def read_once(delay=.05):
 if select.select([master],[],[],delay)[0]:
  try: output.extend(os.read(master,65536))
  except OSError: pass
 if len(output)>2*1024*1024: raise RuntimeError('PTY output bound')
def wait(text,after=0):
 end=time.monotonic()+8
 while text.encode() not in output[after:]:
  if time.monotonic()>end or child.poll() is not None: raise RuntimeError('Missing visible marker: '+text)
  read_once()
 checks.append(text)
def command(text,marker):
 start=len(output);os.write(master,text.encode());wait(text,after=start);os.write(master,b'\r');wait(marker,after=start)
try:
 wait('Ctrl-C disconnect and quit')
 end=time.monotonic()+2
 while termios.tcgetattr(slave)[3]&termios.ICANON:
  if time.monotonic()>end:raise RuntimeError('No raw-mode readiness')
  read_once(.01)
 command('/open '+os.environ['TUI_TEST_CONVERSATION'],'Saved conversation opened.')
 wait('Assistant: First')
 with urllib.request.urlopen(urllib.request.Request(os.environ['FLOW_URL']+'/fixture/advance',data=b'',method='POST'),timeout=2) as response: assert response.status==200
 wait('First 中文🙂 second')
 command('/activity','Activity · turn 1')
 command('/detail 2','No public body is available.')
 command('/detail 1','Truncated public fragment')
 wait('\\u001b]52;c;UNTRUSTED\\u0007')
 command('/back','Back to assistant text.')
 os.write(master,b'\x03');end=time.monotonic()+5
 while child.poll() is None:
  if time.monotonic()>end:raise RuntimeError('Child did not close')
  read_once()
 assert child.returncode==0
 restored=termios.tcgetattr(slave)
 assert restored[3]&(termios.ICANON|termios.ECHO)==original[3]&(termios.ICANON|termios.ECHO)
 assert b'\x1b]52;c;UNTRUSTED' not in output
 print(json.dumps({'exitCode':child.returncode,'bytes':len(output),'elapsedMs':round((time.monotonic()-started)*1000),'visibleCheckpoints':checks,'rawModeRestored':True,'untrustedOscExecuted':False}))
except Exception as error:
 print(json.dumps({'error':str(error),'syntheticTranscript':output.decode('utf8','replace')[-12000:]}));raise
finally:
 if child.poll() is None:
  child.terminate()
  try:child.wait(timeout=2)
  except subprocess.TimeoutExpired:child.kill();child.wait(timeout=2)
 os.close(master);os.close(slave)
