/** Fixed OPS-METER01 implementation; no target file contents or issue paths leave Python. */
export const METER_RUNTIME = Object.freeze({
  python: '/opt/homebrew/Cellar/python@3.13/3.13.3_1/Frameworks/Python.framework/Versions/3.13/bin/python3.13',
  pythonBytes: 52640, pythonSha256: 'f6ec6ad29d65dcb9609fb93f9e9a114d8f654b020cbe8d925f7f01d3bc2ce44b',
  module: '/Users/citrine/Projects/AgentHarness/Flow/tools/owned-resource-measurement/measure.py',
  moduleBytes: 8979, moduleSha256: '52b92553302378ed44ec38550a02cb15b1d644d274547959fabed344f35e9d08',
  source: '1e12eaf13a02b45a99dfe126bc182c2ea45a8390',
});
export const METER_BRIDGE = String.raw`
import errno, hashlib, json, os, stat, sys, time, types
MODULE = ${JSON.stringify(METER_RUNTIME.module)}
MODULE_BYTES = ${METER_RUNTIME.moduleBytes}
MODULE_SHA = ${JSON.stringify(METER_RUNTIME.moduleSha256)}
SPECS = {'stage-evidence': (512, 8, True), 'operator-evidence': (256, 5, False), 'runtime': (2048, 12, False)}

def load_meter():
    fd = os.open(MODULE, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_size != MODULE_BYTES:
            raise ValueError('source')
        source = os.read(fd, MODULE_BYTES + 1)
        after = os.fstat(fd)
        if (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns) or hashlib.sha256(source).hexdigest() != MODULE_SHA:
            raise ValueError('source')
    finally:
        os.close(fd)
    module = types.ModuleType('flow_o16_fixed_meter')
    sys.modules[module.__name__] = module
    exec(compile(source, MODULE, 'exec'), module.__dict__)
    return module

def observe(request, meter):
    roots = request['roots']
    if not isinstance(roots, list) or not 1 <= len(roots) <= 3:
        raise ValueError('roots')
    labels = [item['stage'] for item in roots]
    if len(set(labels)) != len(labels) or any(label not in SPECS for label in labels):
        raise ValueError('stage')
    deadline = time.monotonic() + .12
    results = []
    for item in roots:
        stage = item['stage']
        maximum, depth, optional = SPECS[stage]
        pin = item.get('identity')
        try:
            info = os.stat(item['path'], follow_symlinks=False)
        except FileNotFoundError:
            if optional:
                results.append(dict(stage=stage, state='absent', bytes=0, entries=0, vanished=0))
                continue
            results.append(dict(stage=stage, state='unknown', code='ROOT_IO'))
            break
        except OSError:
            results.append(dict(stage=stage, state='unknown', code='ROOT_IO'))
            break
        if not stat.S_ISDIR(info.st_mode) or (pin is not None and (info.st_dev, info.st_ino) != (pin['dev'], pin['ino'])):
            results.append(dict(stage=stage, state='unknown', code='ROOT_IDENTITY_CHANGED'))
            break
        if stage == 'runtime' and pin is None:
            raise ValueError('runtime identity')
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            results.append(dict(stage=stage, state='unknown', code='TIME_LIMIT'))
            break
        # Shared entries exclude root. One fewer directory level conservatively
        # preserves O16's former depth bound, which also counted terminal files.
        result = meter.measure(meter.Root(item['path'], info.st_dev, info.st_ino),
                               limits=meter.Limits(maximum - 1, remaining, depth - 1))
        if result.state != 'complete' or result.symlinks:
            results.append(dict(stage=stage, state='unknown', code=result.issue.code if result.issue else 'SYMLINK'))
            break
        results.append(dict(stage=stage, state='complete', bytes=result.logical_bytes,
                            entries=result.entries + 1, vanished=result.vanished_entries))
    return dict(results=results)

def main():
    try:
        raw = sys.stdin.buffer.read(16385)
        if len(raw) > 16384:
            raise ValueError('input limit')
        output = observe(json.loads(raw), load_meter())
    except Exception:
        output = dict(failure='O16_METER_HELPER_FAILURE')
    print(json.dumps(output, separators=(',', ':')))
`;
