"""Owned PTY driver: synthetic center only. No provider, credentials, or user terminal."""
import os, pty, subprocess, select, time, json, termios, fcntl, struct, signal, sys
master, slave = pty.openpty()
original = termios.tcgetattr(slave)
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 24, 100, 0, 0))
child = subprocess.Popen([os.environ['TUI_TEST_NODE'], '--import', 'tsx', 'apps/tui/src/main.tsx'], stdin=slave, stdout=slave, stderr=slave, env={key:value for key,value in os.environ.items() if key in ['PATH','TERM','LANG','FLOW_URL','FLOW_TOKEN','FLOW_TUI_STATE_DIR']}, close_fds=True)
output = bytearray(); started=time.monotonic(); checkpoints=[]
def terminate(_signal,_frame): raise KeyboardInterrupt('Owned test timeout')
signal.signal(signal.SIGTERM,terminate)
def wait_for(text, timeout=10, after=0):
 deadline=time.monotonic()+timeout
 while text.encode() not in output[after:]:
  if time.monotonic()>deadline or child.poll() is not None: raise RuntimeError('PTY expected marker missing: '+text)
  readable,_,_=select.select([master],[],[],0.05)
  if readable:
   try: output.extend(os.read(master,65536))
   except OSError: break
  if len(output)>2*1024*1024: raise RuntimeError('PTY output budget exceeded')
 checkpoints.append(text)
def send(text): os.write(master,text.encode())
try:
 wait_for('Ctrl-C disconnect and quit')
 # Raw mode is an observable readiness condition; render commit alone precedes focus effects.
 deadline=time.monotonic()+2
 while termios.tcgetattr(slave)[3] & termios.ICANON:
  if time.monotonic()>deadline: raise RuntimeError('PTY never entered raw mode')
  if select.select([master],[],[],0.01)[0]: output.extend(os.read(master,65536))
 command='/open '+os.environ['TUI_TEST_CONVERSATION']
 send(command); wait_for(command); send('\r')
 wait_for('Saved conversation opened.')
 fcntl.ioctl(slave,termios.TIOCSWINSZ,struct.pack('HHHH',20,60,0,0)); child.send_signal(signal.SIGWINCH)
 if os.environ.get('TUI_TEST_MODE')=='send':
  send(os.environ['TUI_TEST_NONCE']+' 中文🙂')
  wait_for('中文🙂')
  changed=len(output); send('\x7f'); wait_for('中文',after=changed)
  changed=len(output); send('\n'); wait_for('Flow',after=changed)
  send('second🙂'); wait_for('second🙂'); send('\r')
  wait_for('[pending; task running]')
 else:
  wait_for('second🙂'); wait_for('\\u001b]52;c;NO\\u0007')
 send('\x03')
 deadline=time.monotonic()+5
 while child.poll() is None:
  if time.monotonic()>deadline: raise RuntimeError('PTY child did not exit')
  if select.select([master],[],[],0.05)[0]: output.extend(os.read(master,65536))
  if len(output)>2*1024*1024: raise RuntimeError('PTY output budget exceeded')
 while select.select([master],[],[],0)[0]:
  try:
   chunk=os.read(master,65536)
   if not chunk:break
   output.extend(chunk)
  except OSError:break
 restored=termios.tcgetattr(slave)
 assert child.returncode==0
 assert restored[3] & (termios.ICANON|termios.ECHO) == original[3] & (termios.ICANON|termios.ECHO)
 assert b'\x1b]52;c;NO' not in output
 print(json.dumps({'exitCode':child.returncode,'rawModeRestored':True,'resized':[60,20],'bytes':len(output),'elapsedMs':round((time.monotonic()-started)*1000),'checkpoints':checkpoints,'untrustedOscExecuted':False}))
except Exception as error:
 # Synthetic-only output is bounded; error transcript helps diagnose real PTY behavior.
 print(json.dumps({'error':str(error),'output':output.decode('utf8','replace')[-12000:]}))
 raise
finally:
 if child.poll() is None:
  child.terminate()
  try: child.wait(timeout=2)
  except subprocess.TimeoutExpired: child.kill(); child.wait(timeout=2)
 os.close(master);os.close(slave)
