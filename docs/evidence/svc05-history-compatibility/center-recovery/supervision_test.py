"""No services, files, PostgreSQL or model calls; exercise external stop ownership."""
import json
import os
import signal
import sys
import time
import unittest
from supervise import supervise


class SupervisionTest(unittest.TestCase):
    def test_normal_return(self):
        report = supervise([sys.executable, '-c', 'import sys; print("complete"); print("notice", file=sys.stderr)'], .5, .2)
        self.assertEqual(report['operatorExit'], 0)
        self.assertFalse(report['deadlineExceeded'])
        self.assertTrue(report['operatorStopped'])
        self.assertEqual(report['stdout'].strip(), 'complete')
        self.assertEqual(report['stderr'].strip(), 'notice')
        self.assertEqual(report['outcome'], 'operator-returned-zero')
        self.assertEqual(report['supervision']['ownership'], 'childPidOnly')
        self.assertEqual(report['supervision']['capture'], 'separate')
        self.assertEqual(report['supervision']['eof'], {'stdout': True, 'stderr': True})
        self.assertIsNone(report['supervision']['firstFailure'])

    def test_blocked_write_does_not_block_deadline_or_kill_detached_child(self):
        # A detached sleep is a process-ownership stand-in, not a Flow service.
        code = '''import os, subprocess, sys
p = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(30)'], start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print(p.pid, flush=True)
r,w = os.pipe()
while True: os.write(w, b'x' * 65536)
'''
        report = supervise([sys.executable, '-c', code], .3, .3)
        sleeper = int(report['stdout'].strip())
        try:
            self.assertTrue(report['deadlineExceeded'])
            self.assertTrue(report['operatorStopped'])
            self.assertEqual(report['operatorExit'], -signal.SIGKILL)
            self.assertLess(report['elapsedMs'], 1500)
            os.kill(sleeper, 0)  # Supervision stopped only its operator PID.
            self.assertEqual(report['serviceSignals'], 0)
            self.assertEqual(report['outcome'], 'unknown')
            self.assertEqual(report['supervision']['firstFailure']['code'], 'DEADLINE_EXCEEDED')
            self.assertEqual(report['supervision']['ownedState'], 'absent')
            self.assertEqual(report['supervision']['signals'], [
                {'signal': 'SIGKILL', 'state': 'sent', 'errno': None}])
        finally:
            os.kill(sleeper, signal.SIGTERM)  # Only this test-created stand-in.
            deadline = time.monotonic() + 1
            absent = False
            while time.monotonic() < deadline:
                try: os.kill(-sleeper, 0)
                except ProcessLookupError:
                    absent = True
                    break
                time.sleep(.01)
            self.assertTrue(absent, 'Own stand-in group cleanup unknown')
        print(json.dumps({'blockedWriteProof': report, 'standInPid': sleeper, 'standInCleanup': 'group-absent'}))


if __name__ == '__main__':
    unittest.main(verbosity=2)
