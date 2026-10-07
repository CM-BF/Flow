"""One real Ink PTY. The registered parent owns whole-group settlement and resource cleanup."""
import fcntl
import json
import os
import pty
import re
import select
import signal
import struct
import subprocess
import sys
import termios
import time


def safe_failure(stage, error, token=''):
    message = str(error)
    if token:
        message = message.replace(token, '[redacted]')
    message = re.sub(r'Bearer\s+[^\s"\'<>]+', 'Bearer [redacted]', message, flags=re.I)
    message = re.sub(r'([a-z][a-z0-9+.-]*://)[^\s/@]+:[^\s/@]+@', r'\1[redacted]@', message, flags=re.I)
    message = re.sub(r'[\x00-\x1f\x7f]', ' ', message)
    return {'stage': stage[:96], 'name': type(error).__name__[:64], 'code': getattr(error, 'errno', None),
            'message': message.encode('utf8')[:512].decode('utf8', 'ignore')}


def run(startup_only=False):
    master = slave = child = None
    original = None
    output, checkpoints = bytearray(), []
    deadline = time.monotonic() + (15 if startup_only else 80)

    def interrupted(_signal, _frame):
        raise RuntimeError('Owned PTY interrupted')

    signal.signal(signal.SIGTERM, interrupted)

    def read_output(timeout=0.03):
        if time.monotonic() >= deadline:
            raise RuntimeError('PTY work deadline')
        if select.select([master], [], [], timeout)[0]:
            try:
                output.extend(os.read(master, 32768))
            except OSError:
                if child.poll() is None:
                    raise
        if len(output) > 256 * 1024:
            raise RuntimeError('PTY transcript bound')

    def wait_for(text, after=0):
        end = min(deadline, time.monotonic() + 15)
        while text.encode() not in output[after:]:
            if child.poll() is not None or time.monotonic() >= end:
                raise RuntimeError('Visible PTY marker missing: ' + text)
            read_output()
        checkpoints.append({'text': text, 'after': after, 'observedBytes': len(output)})

    def emit(phase, **values):
        print(json.dumps({'phase': phase, **values}), flush=True)

    def next_stage(phase):
        end = min(deadline, time.monotonic() + 20)
        while not select.select([sys.stdin], [], [], 0)[0]:
            if time.monotonic() >= end:
                raise RuntimeError('Parent stage deadline')
            read_output()
        value = json.loads(sys.stdin.readline(1024))
        task = value.get('taskId')
        if value.get('phase') != phase or not isinstance(task, str) or len(task) != 36:
            raise RuntimeError('Invalid parent stage identity')
        return task

    def command(text, expected):
        start = len(output)
        os.write(master, text.encode()); wait_for(text, start)
        os.write(master, b'\r'); wait_for(expected, start)
        wait_for('Message or /command', start)

    stage = 'terminal-spawn'
    try:
        master, slave = pty.openpty()
        original = termios.tcgetattr(slave)
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 28, 100, 0, 0))
        # Inherit the registered Python PGID; never detach the actual TUI child.
        child = subprocess.Popen([os.environ['TUI_TEST_NODE'], '--import', 'tsx', 'apps/tui/src/main.tsx'],
                                 stdin=slave, stdout=slave, stderr=slave, close_fds=True,
                                 env={key: os.environ[key] for key in ['PATH', 'TERM', 'LANG', 'FLOW_URL', 'FLOW_TOKEN', 'FLOW_TUI_STATE_DIR', 'TSX_DISABLE_CACHE']})
        emit('progress', stage='terminal-spawned', tuiPid=child.pid, pgid=os.getpgrp())
        stage = 'terminal-render'
        wait_for('Ctrl-C disconnect and quit')
        emit('progress', stage='terminal-rendered', transcriptBytes=len(output))
        stage = 'terminal-raw-mode'
        until = min(deadline, time.monotonic() + 2)
        while termios.tcgetattr(slave)[3] & termios.ICANON:
            if time.monotonic() >= until:
                raise RuntimeError('PTY did not enter raw mode')
            read_output(0.01)
        emit('progress', stage='terminal-raw', canonicalInput=False)
        if startup_only:
            stage = 'startup-quit'
            os.write(master, b'\x03')
            while child.poll() is None:
                read_output()
            mask = termios.ICANON | termios.ECHO
            if child.returncode != 0 or termios.tcgetattr(slave)[3] & mask != original[3] & mask:
                raise RuntimeError('TUI exit or raw-mode restoration failed')
            emit('finished', result={'startupOnly': True, 'exitCode': child.returncode, 'tuiPid': child.pid,
                 'pgid': os.getpgrp(), 'rawModeRestored': True, 'checkpoints': checkpoints,
                 'transcriptBytes': len(output), 'transcript': output.decode('utf8', 'replace')})
            return
        stage = 'terminal-open'
        command('/open ' + os.environ['TUI_TEST_CONVERSATION'], 'Saved conversation opened.')
        emit('progress', stage='terminal-opened')
        stage = 'draft-submit'
        draft = '保留中文🙂\nconflicting terminal draft'
        start = len(output)
        os.write(master, '保留中文🙂'.encode()); wait_for('保留中文🙂', start)
        os.write(master, b'\n'); os.write(master, b'conflicting terminal draft')
        wait_for('conflicting terminal draft', start)
        os.write(master, b'\r'); emit('submitted')
        stage = 'conflict-response'
        wait_for('Center rejected the request. No replacement request was sent.', start)
        task_a = next_stage('cancel')
        wait_for('Task: ' + task_a, start)
        stage = 'conflict-redraw'
        # Force an actual fresh render; old transcript text is not proof that the draft survived.
        start = len(output)
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 20, 60, 0, 0)); child.send_signal(signal.SIGWINCH)
        wait_for('保留中文🙂', start); wait_for('conflicting terminal draft', start)
        emit('conflict-visible', draft=draft, taskId=task_a, visibleAfterResize=True)
        stage = 'cancel-a'
        # Explicit user editing: kill line 2, its newline, then line 1. The application never clears it silently.
        start = len(output)
        os.write(master, b'\x15\x7f\x15'); wait_for('Message or /command', start)
        command('/cancel ' + task_a, 'Cancellation acknowledged for the saved task.')
        wait_for(' · cancelled', start); emit('cancelled-visible', taskId=task_a)
        stage = 'recover-b'
        task_b = next_stage('recover')
        if task_b == task_a:
            raise RuntimeError('Second task did not change')
        start = len(output)
        command('/recover', 'Center history reloaded.')
        wait_for('Task: ' + task_b, start); wait_for('running', start)
        emit('recovered-visible', taskId=task_b)
        start = len(output)
        stage = 'quit-with-draft'
        os.write(master, '退出后仍保留🙂'.encode()); wait_for('退出后仍保留🙂', start)
        os.write(master, b'\n'); os.write(master, b'unsent observer draft'); wait_for('unsent observer draft', start)
        os.write(master, b'\x03')
        until = min(deadline, time.monotonic() + 4)
        while child.poll() is None:
            if time.monotonic() >= until:
                raise RuntimeError('TUI exit unknown')
            read_output()
        mask = termios.ICANON | termios.ECHO
        if child.returncode != 0 or termios.tcgetattr(slave)[3] & mask != original[3] & mask:
            raise RuntimeError('TUI exit or raw-mode restoration failed')
        emit('finished', result={'taskA': task_a, 'taskB': task_b, 'exitCode': child.returncode, 'tuiPid': child.pid,
             'pgid': os.getpgrp(), 'rawModeRestored': True, 'resized': [60, 20], 'unsentDraftAtExit': True,
             'checkpoints': checkpoints, 'transcriptBytes': len(output), 'transcript': output.decode('utf8', 'replace')})
    except Exception as error:
        emit('failure', error=safe_failure(stage, error, os.environ.get('FLOW_TOKEN', '')), result={'checkpoints': checkpoints, 'transcriptBytes': len(output),
                               'transcript': output.decode('utf8', 'replace')[-32768:]})
        raise SystemExit(1)
    finally:
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        if child is not None and child.poll() is None:
            child.terminate()
            try:
                child.wait(timeout=2)
            except subprocess.TimeoutExpired:
                child.kill(); child.wait(timeout=2)
        for descriptor in [master, slave]:
            if descriptor is not None:
                os.close(descriptor)


if __name__ == '__main__':
    if sys.argv[1:] == ['--failure-self-test']:
        print(json.dumps(safe_failure('conflict-redraw', RuntimeError('Visible PTY marker missing synthetic-token'), 'synthetic-token')))
    else:
        run(startup_only=sys.argv[1:] == ['--startup-only'])
