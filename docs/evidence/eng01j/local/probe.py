"""One tiny own-scratch policy probe. All process bounds belong to fixed OPS14."""
from pathlib import Path
import dataclasses
import hashlib
import importlib.util
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
NODE = '/opt/homebrew/opt/node@24/bin/node'
CLANG = '/Library/Developer/CommandLineTools/usr/bin/clang'
C_SOURCE = ROOT / 'apps/runner/src/engineering/fixtures/native-authority-canary.c'
POLICY = ROOT / 'apps/runner/src/engineering/native-authority-darwin.ts'
SUPERVISOR = ROOT / 'tools/owned-process-supervision/supervise.py'


def save(path, value):
    with path.open('x') as stream:
        json.dump(value, stream, indent=2); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
    fd = os.open(path.parent, os.O_RDONLY); os.fsync(fd); os.close(fd)


def child(scratch):
    binary = scratch / 'canary'
    env = {'PATH': '/usr/bin:/bin', 'TMPDIR': str(scratch), 'HOME': str(scratch), 'NODE_DISABLE_COMPILE_CACHE': '1', 'PYTHONDONTWRITEBYTECODE': '1'}
    if os.environ.get('FLOW_ENG01J_DIRECT') == 'types':
        result = subprocess.run([NODE, '/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/node_modules/typescript/lib/tsc.js', '-p', str(HERE/'tsconfig.json')], env=env, capture_output=True, timeout=5)
        print(json.dumps({'stage':'focused-types','exit':result.returncode,'stdout':result.stdout.decode(errors='replace'),'stderr':result.stderr.decode(errors='replace')}),flush=True)
        return result.returncode
    compile_result = subprocess.run([CLANG, '-isysroot', '/Library/Developer/CommandLineTools/SDKs/MacOSX26.0.sdk', '-std=c11', '-Wall', '-Wextra', '-Werror', '-Os', '-fno-modules', str(C_SOURCE), '-o', str(binary)], env=env, capture_output=True, timeout=5)
    print(json.dumps({'stage': 'compile', 'exit': compile_result.returncode, 'stdout': compile_result.stdout.decode(errors='replace'), 'stderr': compile_result.stderr.decode(errors='replace')}), flush=True)
    if compile_result.returncode: return 1
    if os.environ.get('FLOW_ENG01J_DIRECT') == '1':
        inherited = scratch / 'r06-inherited.txt'; inherited.write_text('0')
        fd = os.open(inherited, os.O_WRONLY)
        try:
            direct_env = {**env, 'TSX_DISABLE_CACHE': '1', 'FLOW_ENG01J_SCRATCH': str(scratch), 'FLOW_ENG01J_CANARY': str(binary), 'FLOW_ENG01J_INHERITED_FD': str(fd)}
            test_source = ROOT/'apps/runner/src/engineering/native-authority.test.ts'
            policy_test = ROOT/'apps/runner/src/engineering/native-authority-darwin.test.ts'
            js = 'await import(' + json.dumps(test_source.as_uri()) + '); await import(' + json.dumps(policy_test.as_uri()) + ');'
            result = subprocess.run([NODE, '--import', '/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/node_modules/tsx/dist/loader.mjs', '--input-type=module', '-e', js], env=direct_env, stdin=subprocess.DEVNULL, capture_output=True, timeout=5, pass_fds=(fd,))
            print(json.dumps({'stage':'r06-direct', 'exit':result.returncode,'stdout':result.stdout.decode(errors='replace'),'stderr':result.stderr.decode(errors='replace'),'inheritedContent':inherited.read_text()}), flush=True)
            return result.returncode
        finally: os.close(fd)
    policy = scratch / 'policy.sb'
    js = "import {writeFileSync} from 'node:fs'; import {createDarwinWriteProfile} from " + json.dumps(POLICY.as_uri()) + "; writeFileSync(process.argv[1],createDarwinWriteProfile({root:process.argv[2],executable:process.argv[3],writableFile:process.argv[2]+'/calculator.mjs'}));"
    render = subprocess.run([NODE, '--input-type=module', '-e', js, str(policy), str(scratch), str(binary)], env=env, capture_output=True, timeout=3)
    print(json.dumps({'stage': 'policy', 'exit': render.returncode, 'stderr': render.stderr.decode(errors='replace')}), flush=True)
    if render.returncode: return 1
    allowed = scratch / 'calculator.mjs'; denied = scratch / 'baseline.txt'; inherited = scratch / 'inherited.txt'
    for p in [allowed, denied, inherited]: p.write_text('0')
    listener = socket.socket(socket.AF_UNIX); listener.bind(str(scratch / 'delegate.sock')); listener.listen(3); listener.settimeout(.2)
    def invoke(label, mode, sandboxed, inherited_fd=None, close_extra=False):
        command = [str(binary), str(scratch), mode, str(inherited_fd if inherited_fd is not None else -1)]
        if sandboxed: command = ['/usr/bin/sandbox-exec', '-f', str(policy), *command]
        result = subprocess.run(command, env=env, stdin=subprocess.DEVNULL, capture_output=True, timeout=3,
                                close_fds=True, pass_fds=() if inherited_fd is None or close_extra else (inherited_fd,))
        value = {'stage': label, 'exit': result.returncode, 'stdout': result.stdout.decode(errors='replace'), 'stderr': result.stderr.decode(errors='replace')}
        print(json.dumps(value), flush=True)
        if len(result.stdout) + len(result.stderr) > 8192: raise RuntimeError('CANARY_OUTPUT_LIMIT')
        return value
    try:
        control = invoke('control', 'control', False)
        connection, _ = listener.accept(); delegated = connection.recv(1); connection.close()
        print(json.dumps({'stage':'control-host','allowed':allowed.read_text(),'denied':denied.read_text(),'delegate':delegated.decode()}), flush=True)
        allowed.write_text('0'); denied.write_text('0')
        trial = invoke('sandbox', 'operations', True)
        print(json.dumps({'stage':'sandbox-host','allowed':allowed.read_text() if allowed.exists() else None,'denied':denied.read_text() if denied.exists() else None,'created':(scratch/'extra').exists(),'renamed':(scratch/'renamed').exists()}), flush=True)
        # Only continue if this exact binary reached main and completed under policy.
        rows = [json.loads(x) for x in trial['stdout'].splitlines()]
        if trial['exit'] or not rows or rows[-1].get('name') != 'complete': return 2
        fd = os.open(inherited, os.O_WRONLY)
        try:
            invoke('inherited-fd', 'fd', True, fd)
            invoke('closed-fd', 'fd', True, fd, close_extra=True)
        finally: os.close(fd)
        print(json.dumps({'stage':'inherited-host','content':inherited.read_text(),'binarySha256':hashlib.sha256(binary.read_bytes()).hexdigest(),'profile':policy.read_text()}), flush=True)
        return 0
    finally: listener.close()


def run(round_id):
    assert round_id in ('01', '02', '03', '04', '05')
    out = HERE / ('round-' + round_id); out.mkdir()
    previous = list(HERE.glob('round-*/result.json'))
    used = sum(json.loads(p.read_text())['elapsed_ms'] for p in previous)
    if used >= 20000: raise RuntimeError('LOCAL_BUDGET_EXHAUSTED')
    volume = os.statvfs(ROOT); free = volume.f_bavail * volume.f_frsize
    if free < 1107296256: save(out/'not-run.json', {'freeBytes':free,'minimumBytes':1107296256}); return 3
    scratch = Path(tempfile.mkdtemp(prefix='eng01j-', dir='/private/tmp'))
    identity = scratch.stat()
    save(out/'reservation.json', {'scratch':str(scratch),'dev':identity.st_dev,'ino':identity.st_ino,'freeBytes':free,'sources':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [C_SOURCE,POLICY,SUPERVISOR,Path(__file__),ROOT/'apps/runner/src/engineering/native-authority.ts',ROOT/'apps/runner/src/engineering/native-authority.test.ts',ROOT/'apps/runner/src/engineering/native-authority-darwin.test.ts']},'previousSupervisedMs':used,'providerCalls':0,'PG':0})
    spec=importlib.util.spec_from_file_location('owned_supervise',SUPERVISOR); module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module)
    report=module.supervise(module.Launch((sys.executable,'-B',str(Path(__file__).resolve()),'child',str(scratch)),str(ROOT),{'PATH':'/usr/bin:/bin','TMPDIR':str(scratch),'HOME':str(scratch),'PYTHONDONTWRITEBYTECODE':'1','FLOW_ENG01J_DIRECT':os.environ.get('FLOW_ENG01J_DIRECT','0')},module.Ownership.NEW_CHILD_SESSION),module.Policy(9,.2,.8,65536))
    (out/'stdout').write_bytes(report.stdout); (out/'stderr').write_bytes(report.stderr)
    value=dataclasses.asdict(report);value.pop('stdout');value.pop('stderr')
    private_bytes=sum(p.stat().st_size for p in scratch.rglob('*') if p.is_file())
    value['privateBytesAtEnd']=private_bytes;value['rawBytes']=len(report.stdout)+len(report.stderr);value['cumulativeSupervisedMs']=used+report.elapsed_ms
    save(out/'result.json',value)
    current=scratch.stat(); safe=(current.st_dev,current.st_ino)==(identity.st_dev,identity.st_ino) and report.owned_state=='absent' and all(report.eof.values())
    if safe: shutil.rmtree(scratch)
    save(out/'cleanup.json',{'scratch':str(scratch),'identityMatched':(current.st_dev,current.st_ino)==(identity.st_dev,identity.st_ino),'group':report.owned_state,'removed':not scratch.exists(),'privateBytesAtEnd':private_bytes})
    print(json.dumps(value));return 0 if report.exit_code==0 and safe and report.first_failure is None and private_bytes+value['rawBytes']<2*1024*1024 else 1

if __name__=='__main__':
    if len(sys.argv)!=3:raise SystemExit(64)
    if sys.argv[1]=='child':raise SystemExit(child(Path(sys.argv[2])))
    if sys.argv[1]=='run':raise SystemExit(run(sys.argv[2]))
    raise SystemExit(64)
