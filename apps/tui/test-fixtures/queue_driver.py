"""Owned real PTY, synthetic center and fixture runner. Never a user's terminal."""
import fcntl, json, os, pty, select, signal, struct, subprocess, termios, time

master, slave = pty.openpty()
original = termios.tcgetattr(slave)
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 28, 100, 0, 0))
child = subprocess.Popen([os.environ['TUI_TEST_NODE'], '--import', 'tsx', 'apps/tui/src/main.tsx'],
    stdin=slave, stdout=slave, stderr=slave, close_fds=True,
    env={key: value for key, value in os.environ.items() if key in
         ['PATH', 'TERM', 'LANG', 'FLOW_URL', 'FLOW_TOKEN', 'FLOW_TUI_STATE_DIR']})
output = bytearray()
checkpoints = []

def stop(_signal, _frame):
    raise KeyboardInterrupt('Owned PTY timeout')

signal.signal(signal.SIGTERM, stop)

def read_output(timeout=0.05):
    if select.select([master], [], [], timeout)[0]:
        output.extend(os.read(master, 65536))
    if len(output) > 2 * 1024 * 1024:
        raise RuntimeError('PTY output bound exceeded')

def wait_for(text, after=0):
    deadline = time.monotonic() + 8
    while text.encode() not in output[after:]:
        if child.poll() is not None or time.monotonic() > deadline:
            raise RuntimeError('PTY marker missing: ' + text)
        read_output()
    checkpoints.append(text)

def command(text, expected):
    changed = len(output)
    os.write(master, text.encode())
    wait_for(text, changed)
    os.write(master, b'\r')
    wait_for(expected, changed)
    # Wait for the editor clear after acknowledgement, not merely the first render.
    wait_for('Message or /command', changed)

try:
    wait_for('Ctrl-C disconnect and quit')
    deadline = time.monotonic() + 2
    while termios.tcgetattr(slave)[3] & termios.ICANON:
        if time.monotonic() > deadline:
            raise RuntimeError('PTY did not enter raw mode')
        read_output(0.01)
    command('/open ' + os.environ['TUI_TEST_CONVERSATION'], 'Saved conversation opened.')
    command('/queue', 'Queue references loaded')
    wait_for('Queue · paused')
    command('/pause', 'Queue control accepted')
    changed = len(output)
    command('/resume', 'Queue control accepted')
    wait_for('Queue · not paused', changed)
    os.write(master, '保留中文🙂'.encode())
    wait_for('保留中文🙂', changed)
    changed = len(output)
    os.write(master, b'\n')
    wait_for('Flow', changed)
    os.write(master, b'second draft')
    wait_for('second draft', changed)
    changed = len(output)
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 20, 60, 0, 0))
    child.send_signal(signal.SIGWINCH)
    wait_for('保留中文🙂', changed)
    wait_for('second draft', changed)
    os.write(master, b'\x03')
    deadline = time.monotonic() + 4
    while child.poll() is None:
        if time.monotonic() > deadline:
            raise RuntimeError('PTY did not exit')
        read_output()
    assert child.returncode == 0
    restored = termios.tcgetattr(slave)
    assert restored[3] & (termios.ICANON | termios.ECHO) == original[3] & (termios.ICANON | termios.ECHO)
    print(json.dumps({'exitCode': child.returncode, 'rawModeRestored': True, 'resized': [60, 20],
        'transcriptBytes': len(output), 'checkpoints': checkpoints, 'unsentCjkMultilineDraft': True}))
except Exception as error:
    print(json.dumps({'error': str(error), 'syntheticTranscript': output.decode('utf8', 'replace')[-16000:]}))
    raise
finally:
    if child.poll() is None:
        child.terminate()
        try:
            child.wait(timeout=2)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait(timeout=2)
    os.close(master)
    os.close(slave)
