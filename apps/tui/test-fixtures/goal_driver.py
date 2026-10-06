import os, pty, termios, fcntl, struct, subprocess, select, time, signal, json
master, slave = pty.openpty()
original = termios.tcgetattr(slave)
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 24, 100, 0, 0))
child = subprocess.Popen([os.environ['TUI_TEST_NODE'], '--import', 'tsx', 'apps/tui/src/main.tsx', '--goal', os.environ['TUI_TEST_GOAL']], stdin=slave, stdout=slave, stderr=slave, close_fds=True)
output = b''
def wait_for(text, seconds=8):
    global output
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if text.encode() in output: return
        if select.select([master], [], [], .05)[0]:
            try: output += os.read(master, 65536)
            except OSError: break
        if len(output) > 2_000_000: raise RuntimeError('PTY output limit')
    raise RuntimeError('Missing ' + text + ': ' + output[-3000:].decode(errors='replace'))
try:
    wait_for('Flow goal')
    deadline = time.monotonic() + 3
    while termios.tcgetattr(slave)[3] & termios.ICANON and time.monotonic() < deadline: time.sleep(.01)
    os.write(master, b'/history'); wait_for('/history'); os.write(master, b'\r'); wait_for('Historical references')
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 20, 52, 0, 0)); child.send_signal(signal.SIGWINCH)
    os.write(master, '中文🙂'.encode()); wait_for('中文🙂'); os.write(master, b'\x7f'); time.sleep(.05)
    os.write(master, b'\x0a'); os.write(master, '第二行🚀'.encode()); wait_for('第二行🚀'); os.write(master, b'\r'); wait_for('Local draft only')
    os.write(master, b'\x03'); code = child.wait(timeout=5)
    restored = termios.tcgetattr(slave)
    assert (restored[3] & (termios.ICANON | termios.ECHO)) == (original[3] & (termios.ICANON | termios.ECHO))
    print(json.dumps({'exitCode': code, 'narrow': True, 'draftOnly': True, 'rawModeRestored': True, 'observedCjk': True, 'multiline': True, 'resizeColumns': 52, 'transcriptBytes': len(output)}))
finally:
    if child.poll() is None:
        child.terminate()
        try: child.wait(timeout=2)
        except subprocess.TimeoutExpired: child.kill(); child.wait()
    os.close(master); os.close(slave)
