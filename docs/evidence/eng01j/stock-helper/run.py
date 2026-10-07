"""One fixed stock-helper experiment; OPS14 alone supervises spawned processes."""
from pathlib import Path
import dataclasses
import datetime
import hashlib
import importlib.util
import json
import os
import errno
import fcntl
import shutil
import signal
import stat
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
SUPERVISOR = ROOT / 'tools/owned-process-supervision/supervise.py'
POLICY = ROOT / 'apps/runner/src/engineering/native-authority-darwin.ts'
NODE = '/opt/homebrew/opt/node@24/bin/node'
BINARY = Path('/opt/homebrew/lib/node_modules/@openai/codex/node_modules/@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin/bin/codex')
EXPECTED = {
    SUPERVISOR: '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d',
    POLICY: '26c5585d2b256cab1c53d83b28c1ac494aead830fe4dc3f12a4552ff0a4da16c',
    BINARY: '4f85982624b3898c8991cb80c0981b2aa71070e3537046c9a95950318a95afcc',
    Path('/usr/bin/sandbox-exec'): 'abc5bb136d6b5cce8fa85d789f78e3326c51ca60cae637b2064adfb67a1dcd9a',
}


def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def persist(path, value):
    data = (json.dumps(value, indent=2) + '\n').encode() if not isinstance(value, bytes) else value
    with path.open('xb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    fd = os.open(path.parent, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def file_identity(path):
    value = path.lstat()
    if not stat.S_ISREG(value.st_mode) or value.st_uid != os.getuid() or value.st_nlink != 1:
        raise RuntimeError('REGULAR_OWN_FILE_REQUIRED')
    return [value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns, value.st_ctime_ns]


def exec_only(scratch, request, dummy_fd=None):
    """Popen closes inherited FDs; only this readonly FD replaces DEVNULL stdin."""
    if scratch.resolve() != scratch or request.parent != scratch:
        raise RuntimeError('SHIM_PATH_INVALID')
    fd = os.open(request, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size > 1024 or info.st_uid != os.getuid():
            raise RuntimeError('SHIM_REQUEST_INVALID')
        os.dup2(fd, 0, inheritable=True)
    finally:
        os.close(fd)
    # This shim is single threaded. listdir may show its own transient directory
    # FD, which has already closed before it returns; only EBADF is tolerated.
    descriptors = os.listdir('/dev/fd')
    if len(descriptors) > 256 or any(not name.isascii() or not name.isdecimal() or int(name) > 2147483647 for name in descriptors):
        raise RuntimeError('SHIM_FD_SET_UNKNOWN')
    for number in sorted(int(name) for name in descriptors if int(name) > 2):
        try:
            os.close(number)
        except OSError as error:
            if error.errno != errno.EBADF:
                raise
    if fcntl.fcntl(0, fcntl.F_GETFL) & os.O_ACCMODE != os.O_RDONLY:
        raise RuntimeError('SHIM_STDIN_NOT_READONLY')
    if not all(stat.S_ISFIFO(os.fstat(number).st_mode) for number in (1, 2)):
        raise RuntimeError('SHIM_OUTPUT_NOT_PIPE')
    # No new file open after closure. The same supervised PID execs the sandbox.
    if dummy_fd is not None:
        program = '''import os,sys,json,fcntl,stat
number=int(sys.argv[1])
try: os.fstat(number); absent=False
except OSError as error: absent=error.errno==9
print(json.dumps({'extraFdAbsent':absent,'stdinReadonly':fcntl.fcntl(0,fcntl.F_GETFL)&os.O_ACCMODE==os.O_RDONLY,'outputsArePipes':all(stat.S_ISFIFO(os.fstat(n).st_mode) for n in (1,2)),'request':sys.stdin.read()}))
'''
        os.execve(sys.executable, (sys.executable, '-B', '-c', program, str(dummy_fd)), dict(os.environ))
    os.execve('/usr/bin/sandbox-exec', ('/usr/bin/sandbox-exec', '-f', str(scratch/'policy.sb'), str(BINARY), '--codex-run-as-fs-helper'), dict(os.environ))


def run(fixed_fd=False, pagesize=False):
    started = time.monotonic()
    # No persistence in the deadline handler. OPS14 receives the remaining work
    # budget; this guard bounds parent preparation/reporting too. Unknown keeps.
    def deadline(_signum, _frame):
        os._exit(124)
    signal.signal(signal.SIGALRM, deadline)
    total_seconds = 15 if pagesize else 10
    signal.setitimer(signal.ITIMER_REAL, total_seconds)
    out = HERE / ('run-pagesize' if pagesize else 'run-fd-fix' if fixed_fd else 'run-once')
    out.mkdir()  # exclusive; never replays this invocation
    summary = {'startedAt': utc(), 'providerCalls': 0, 'PG': 0, 'cases': [], 'primaryFailure': None,
               'cleanup': {'state': 'unknown', 'removed': False}, 'limits': {'totalSeconds':total_seconds,'rawBytes':65536,'scratchBytes':1048576}}
    scratch = None
    identity = None
    reports = []
    env = None
    try:
        free = os.statvfs(ROOT).f_bavail * os.statvfs(ROOT).f_frsize
        if free < 1107296256:
            summary['primaryFailure'] = {'code':'NOT_RUN_RESOURCE_GATE', 'freeBytes':free}
            return finish(out, summary, started)
        inputs = {str(p): {'bytes':p.stat().st_size, 'sha256':digest(p)} for p in EXPECTED}
        if pagesize:
            inputs[str(HERE/'page-size.c')] = {'bytes':(HERE/'page-size.c').stat().st_size,'sha256':digest(HERE/'page-size.c')}
        if any(inputs[str(p)]['sha256'] != expected for p, expected in EXPECTED.items()):
            raise RuntimeError('FIXED_INPUT_CHANGED')
        binary_identity = file_identity(BINARY)
        scratch = Path(tempfile.mkdtemp(prefix='eng01j-helper-', dir='/private/tmp'))
        own = scratch.stat()
        identity = (own.st_dev, own.st_ino)
        summary['scratch'] = {'path':str(scratch), 'dev':identity[0], 'ino':identity[1]}
        persist(out/'reservation.json', {**summary, 'freeBytes':free, 'inputs':inputs, 'entrySha256':digest(Path(__file__))})
        for name in ('calculator.mjs', 'baseline.txt'):
            persist(scratch/name, b'0')
        for name in ('home', 'tmp', 'codex'):
            (scratch/name).mkdir(mode=0o700)
        env = {'PATH':'/usr/bin:/bin', 'LANG':'C', 'HOME':str(scratch/'home'), 'TMPDIR':str(scratch/'tmp'),
               'CODEX_HOME':str(scratch/'codex'), 'PYTHONDONTWRITEBYTECODE':'1', 'NODE_DISABLE_COMPILE_CACHE':'1'}
        spec = importlib.util.spec_from_file_location('eng01j_supervise', SUPERVISOR)
        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module
        spec.loader.exec_module(module)

        def invoke(label, argv, limit, maximum):
            # Leave two seconds for final durable reporting/cleanup, and .5s for
            # this module's TERM/reap. No child starts after the total allowance.
            remaining = started + total_seconds - 2.5 - time.monotonic()
            if remaining <= 0.1:
                raise RuntimeError('NO_CHILD_BUDGET_REMAINING')
            report = module.supervise(module.Launch(tuple(argv), str(scratch), env, module.Ownership.NEW_CHILD_SESSION),
                                      module.Policy(min(maximum, remaining), .2, .3, limit))
            reports.append(report)
            persist(out/(label+'.stdout'), report.stdout)
            persist(out/(label+'.stderr'), report.stderr)
            record = dataclasses.asdict(report)
            record.pop('stdout'); record.pop('stderr')
            persist(out/(label+'.json'), record)
            if report.first_failure or report.exit_code != 0 or report.owned_state != 'absent' or not all(report.eof.values()):
                raise RuntimeError(label.upper()+'_PROCESS_NOT_CLEAN')
            return report.stdout

        if fixed_fd:
            request = scratch/'dummy.request.json'
            persist(request, b'{"fixture":"readonly"}\n')
            host_file = scratch/'host-only.txt'
            persist(host_file, b'0')
            descriptor = os.open(host_file, os.O_WRONLY | os.O_NOFOLLOW)
            try:
                os.set_inheritable(descriptor, True)
                output = invoke('fd-control', (sys.executable,'-B',str(Path(__file__).resolve()),'exec-dummy',str(scratch),str(request),str(descriptor)), 2048, .8)
            finally:
                os.close(descriptor)
            facts = json.loads(output)
            expected = {'extraFdAbsent':True,'stdinReadonly':True,'outputsArePipes':True,'request':'{"fixture":"readonly"}\n'}
            summary['fdControl'] = {'passed':facts == expected and host_file.read_bytes() == b'0', 'facts':facts}
            persist(out/'fd-control.facts.json', summary['fdControl'])
            if not summary['fdControl']['passed']:
                raise RuntimeError('FD_CONTROL_FAILED')

        if pagesize:
            canary = scratch/'page-size'
            invoke('compile', ('/Library/Developer/CommandLineTools/usr/bin/clang','-isysroot','/Library/Developer/CommandLineTools/SDKs/MacOSX26.0.sdk','-std=c11','-Wall','-Wextra','-Werror','-Os','-fno-modules',str(HERE/'page-size.c'),'-o',str(canary)), 4096, 2)
            render = "import {createDarwinWriteProfile as profile} from " + json.dumps(POLICY.as_uri()) + "; const make = executable => profile({root:process.argv[1],executable,writableFile:process.argv[1]+'/calculator.mjs'}); process.stdout.write(JSON.stringify({control:make(process.argv[2]),native:make(process.argv[3])}));"
            policies = json.loads(invoke('policy', (NODE,'--input-type=module','-e',render,str(scratch),str(canary),str(BINARY)), 8192, 1.5))
            permission = b'(allow sysctl-read (sysctl-name "hw.pagesize"))\n'
            values = {}
            for label, addition in [('pagesize-base',b''),('pagesize-read',permission)]:
                profile = policies['control'].encode()+addition
                path = scratch/(label+'.sb')
                persist(path, profile)
                persist(out/(label+'.sb'), profile)
                value = json.loads(invoke(label, ('/usr/bin/sandbox-exec','-f',str(path),str(canary)), 1024, 1))
                values[label] = value
                persist(out/(label+'.facts.json'), value)
            before, after = values['pagesize-base'], values['pagesize-read']
            size = after.get('sysconf')
            supported = (before.get('sysconf') == -1 and before.get('getpagesize') == -1
                         and before.get('sysconfErrno') in (errno.EPERM,errno.EACCES)
                         and before.get('getpagesizeErrno') in (errno.EPERM,errno.EACCES)
                         and type(size) is int and 0 < size <= 1048576 and size & (size-1) == 0
                         and after.get('getpagesize') == size
                         and after.get('sysconfErrno') == 0 and after.get('getpagesizeErrno') == 0)
            summary['pageSizeControl'] = {'supported':supported,'values':values,'onlyPermissionAdded':permission.decode().strip()}
            persist(out/'pagesize-control.json', summary['pageSizeControl'])
            if not supported:
                raise RuntimeError('PAGE_SIZE_HYPOTHESIS_NOT_SUPPORTED')
            policy = policies['native'].encode()+permission
            persist(out/'native-base-policy.sb',policies['native'].encode())
        else:
            render = "import {createDarwinWriteProfile} from " + json.dumps(POLICY.as_uri()) + "; process.stdout.write(createDarwinWriteProfile({root:process.argv[1],executable:process.argv[2],writableFile:process.argv[1]+'/calculator.mjs'}));"
            policy = invoke('policy', (NODE, '--input-type=module', '-e', render, str(scratch), str(BINARY)), 4096, 1.5)
        persist(scratch/'policy.sb', policy)
        persist(out/'policy.sb', policy)
        for label, filename, expected_status in [('allowed','calculator.mjs','ok'),('denied','baseline.txt','error')]:
            if file_identity(BINARY) != binary_identity:
                raise RuntimeError('BINARY_IDENTITY_CHANGED')
            request = {'operation':'fs/writeFile','params':{'path':(scratch/filename).as_uri(), 'dataBase64':'WA==', 'followSymlinks':False, 'sandbox':None}}
            request_path = scratch/(label+'.request.json')
            request_bytes = (json.dumps(request, separators=(',',':'))+'\n').encode()
            persist(request_path, request_bytes)
            persist(out/(label+'.request.json'), request_bytes)
            output = invoke(label, (sys.executable,'-B',str(Path(__file__).resolve()),'exec-only',str(scratch),str(request_path)), 20480, 3)
            # Neither exit 0 nor an error payload alone establishes file facts.
            response = json.loads(output)
            contents = {name:(scratch/name).read_bytes().hex() for name in ('calculator.mjs','baseline.txt')}
            valid = isinstance(response, dict) and response.get('status') == expected_status and contents == {'calculator.mjs':'58','baseline.txt':'30'}
            if label == 'allowed':
                valid = valid and response.get('payload') == {'operation':'fs/writeFile','response':{}}
            summary['cases'].append({'case':label,'response':response,'contentsHex':contents,'passed':valid})
            persist(out/(label+'.facts.json'), summary['cases'][-1])
            if not valid:
                raise RuntimeError(label.upper()+'_PAYLOAD_OR_FILE_MISMATCH')
    except Exception as error:
        summary['primaryFailure'] = {'code': str(error)[:160] if isinstance(error, RuntimeError) else 'ENTRY_EXCEPTION', 'type':type(error).__name__}
    finally:
        if scratch is not None:
            try:
                current = scratch.lstat()
                summary['finalContentsHex'] = {name: (scratch/name).read_bytes().hex() for name in ('calculator.mjs','baseline.txt') if (scratch/name).is_file()}
                private_bytes = sum(p.lstat().st_size for p in scratch.rglob('*') if p.is_file() and not p.is_symlink())
                clean = all(r.owned_state == 'absent' and all(r.eof.values()) for r in reports)
                same = stat.S_ISDIR(current.st_mode) and (current.st_dev,current.st_ino) == identity
                summary['cleanup'] = {'state':'ready' if clean and same else 'unknown', 'identityMatched':same,
                                      'groups':[{'pid':r.pid,'ownedState':r.owned_state,'eof':r.eof} for r in reports],
                                      'privateBytesAtEnd':private_bytes,'removed':False}
                summary['rawBytes'] = sum(r.retained_bytes for r in reports)
                if private_bytes > 1048576 or summary['rawBytes'] > 65536:
                    summary['cleanup']['state'] = 'unknown'
                    summary['primaryFailure'] = summary['primaryFailure'] or {'code':'RESOURCE_BOUND_EXCEEDED'}
                persist(out/'checkpoint-before-cleanup.json', summary)
                if summary['cleanup']['state'] == 'ready':
                    shutil.rmtree(scratch)
                    summary['cleanup'].update({'state':'complete','removed':True})
            except Exception as error:
                summary['cleanup'].update({'state':'unknown','errorType':type(error).__name__})
                summary['primaryFailure'] = summary['primaryFailure'] or {'code':'CLEANUP_UNKNOWN'}
    return finish(out, summary, started)


def finish(out, summary, started):
    summary['elapsedMs'] = round((time.monotonic()-started)*1000)
    summary['finishedAt'] = utc()
    summary['passed'] = len(summary['cases']) == 2 and all(x['passed'] for x in summary['cases']) and summary['primaryFailure'] is None and summary['cleanup']['state'] == 'complete'
    persist(out/'result.json', summary)
    print(json.dumps({'passed':summary['passed'],'elapsedMs':summary['elapsedMs'],'cases':len(summary['cases']),'cleanup':summary['cleanup']['state']}), flush=True)
    signal.setitimer(signal.ITIMER_REAL, 0)
    return 0 if summary['passed'] else 1


if __name__ == '__main__':
    if sys.argv[1:] in (['--run'], ['--run-fd-fix'], ['--run-pagesize']):
        raise SystemExit(run(sys.argv[1] == '--run-fd-fix', sys.argv[1] == '--run-pagesize'))
    if len(sys.argv) == 5 and sys.argv[1] == 'exec-dummy':
        exec_only(Path(sys.argv[2]), Path(sys.argv[3]), int(sys.argv[4]))
    if len(sys.argv) == 4 and sys.argv[1] == 'exec-only':
        exec_only(Path(sys.argv[2]), Path(sys.argv[3]))
    raise SystemExit(64)
