"""Owned PTY only. Parent owns the detached PGID, checkpoint and irreversible cleanup."""
import fcntl
import json
import os
import pty
import select
import signal
import struct
import subprocess
import sys
import termios
import time

master, slave = pty.openpty()
original = termios.tcgetattr(slave)
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 28, 100, 0, 0))
# No setsid/start_new_session: TUI and descendants stay in the parent's owned PGID.
child = subprocess.Popen([os.environ['TUI_TEST_NODE'], '--import', 'tsx', 'apps/tui/src/main.tsx'],
    stdin=slave, stdout=slave, stderr=slave, close_fds=True,
    env={key: os.environ[key] for key in ['PATH', 'TERM', 'LANG', 'FLOW_URL', 'FLOW_TOKEN', 'FLOW_TUI_STATE_DIR']})
output = bytearray()
checkpoints = []


def interrupted(_signal, _frame):
    raise RuntimeError('Owned PTY interrupted')


signal.signal(signal.SIGTERM, interrupted)


def read_output(timeout=0.05):
    if select.select([master], [], [], timeout)[0]:
        try:
            output.extend(os.read(master, 65536))
        except OSError:
            if child.poll() is None:
                raise
    if len(output) > 128 * 1024:
        raise RuntimeError('PTY transcript bound exceeded')


def wait_for(text, after=0):
    deadline = time.monotonic() + 6
    while text.encode() not in output[after:]:
        if child.poll() is not None or time.monotonic() > deadline:
            raise RuntimeError('PTY marker missing: ' + text)
        read_output()
    checkpoints.append(text)


def command(text, expected):
    start = len(output)
    os.write(master, text.encode())
    wait_for(text, start)
    os.write(master, b'\r')
    wait_for(expected, start)
    wait_for('Message or /command', start)


try:
    wait_for('Ctrl-C disconnect and quit')
    until = time.monotonic() + 2
    while termios.tcgetattr(slave)[3] & termios.ICANON:
        if time.monotonic() > until:
            raise RuntimeError('PTY did not enter raw mode')
        read_output(0.01)
    conversation = os.environ['TUI_TEST_CONVERSATION']
    task_b = os.environ['TUI_TEST_TASK_B']
    command('/open ' + conversation, 'Saved conversation opened.')
    wait_for('Task: ' + task_b)
    start = len(output)
    command('/cancel ' + task_b, 'Cancellation acknowledged for the saved task.')
    wait_for(' · cancelled', start)
    print(json.dumps({'phase': 'B-cancelled-visible'}), flush=True)
    # No fixed delay or hidden submit: parent confirms actual B termination then admits C publicly.
    if not select.select([sys.stdin], [], [], 10)[0]:
        raise RuntimeError('Next-stage timeout')
    stage = json.loads(sys.stdin.readline(1024))
    task_c = stage.get('taskId')
    if not isinstance(task_c, str) or len(task_c) != 36 or task_c == task_b:
        raise RuntimeError('Invalid next-stage identity')
    start = len(output)
    command('/open ' + conversation, 'Saved conversation opened.')
    wait_for('Task: ' + task_c, start)
    wait_for('running', start)
    start = len(output)
    os.write(master, '保留中文🙂'.encode())
    wait_for('保留中文🙂', start)
    os.write(master, b'\n')  # Ctrl-J is the real multiline editor action.
    os.write(master, b'second draft')
    wait_for('second draft', start)
    start = len(output)
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 20, 60, 0, 0))
    child.send_signal(signal.SIGWINCH)
    wait_for('保留中文🙂', start)
    wait_for('second draft', start)
    os.write(master, b'\x03')
    until = time.monotonic() + 4
    while child.poll() is None:
        if time.monotonic() > until:
            raise RuntimeError('PTY did not exit')
        read_output()
    restored = termios.tcgetattr(slave)
    mask = termios.ICANON | termios.ECHO
    if child.returncode != 0 or restored[3] & mask != original[3] & mask:
        raise RuntimeError('PTY exit or terminal restoration failed')
    print(json.dumps({'phase': 'finished', 'result': {'exitCode': child.returncode,
        'tuiPid': child.pid, 'pgid': os.getpgrp(), 'rawModeRestored': True, 'resized': [60, 20],
        'unsentCjkMultilineDraft': True, 'checkpoints': checkpoints,
        'transcriptBytes': len(output), 'transcript': output.decode('utf8', 'replace')}}), flush=True)
except Exception:
    print(json.dumps({'phase': 'failure', 'result': {'checkpoints': checkpoints,
        'transcriptBytes': len(output), 'transcript': output.decode('utf8', 'replace')[-16000:]}}), flush=True)
    raise SystemExit(1)
finally:
    # Local child reaping is not a claim that the whole PGID stopped; parent verifies it independently.
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    if child.poll() is None:
        child.terminate()
        try:
            child.wait(timeout=2)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait(timeout=2)
    os.close(master)
    os.close(slave)
