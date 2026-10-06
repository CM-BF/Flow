"""Read only fixed public runtime path components; emit a candidate, never execute it."""
import datetime
import hashlib
import json
import os
import pathlib
import stat

BASE = pathlib.Path('experiments/codex-app-server-conformance/node-rootliteral/candidate.sb')
SOURCE = pathlib.Path('docs/evidence/wpf-mature-02/isolation/bootstrap-inspection.json')
OUTPUT = pathlib.Path('docs/evidence/wpf-mature-02/node-runtime-metadata')
PROFILE = pathlib.Path('experiments/codex-app-server-conformance/node-runtime-metadata/candidate.sb')
SOURCE_SHA = '98cd28ee66084d5562c3cfed8e143e246118e68884d2eaf1713ddd11a66d18a1'
BASE_SHA = 'f563a084a8223bb088626f0f1e580ffcabd09ccde6772c7a78f6e9cd22a17c5b'
EXCLUDED = '/opt/homebrew/lib/node_modules/@openai/codex/node_modules/@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin/bin/codex'
ROOTS = ('/opt/homebrew', '/System/Library', '/usr/lib')
PARENTS = {'/', '/opt', '/System', '/usr'}
nodes, literals = {}, set()


def public_path(value):
    if not value.startswith('/') or any(c in value for c in '\n\r\0"\\'):
        raise ValueError('Non-public runtime path')
    if value not in PARENTS and not any(value == p or value.startswith(p + '/') for p in ROOTS):
        raise ValueError('Runtime path escaped fixed public roots')
    return value


def add_parents(value):
    # No readdir/glob. Every literal is a component prefix of a fixed seed or its observed symlink target.
    value = os.path.normpath(value)
    for parent in (value, *map(str, pathlib.PurePosixPath(value).parents)):
        literals.add(public_path(parent))


def inspect(value):
    public_path(value)
    if value not in nodes:
        try:
            info = os.lstat(value)
            kind = 'symlink' if stat.S_ISLNK(info.st_mode) else 'directory' if stat.S_ISDIR(info.st_mode) else 'regular' if stat.S_ISREG(info.st_mode) else 'other'
            row = {'path': value, 'kind': kind}
            if kind == 'symlink':
                row['target'] = os.readlink(value)
            elif kind == 'regular':
                row['bytes'] = info.st_size
        except FileNotFoundError:
            row = {'path': value, 'kind': 'absent', 'errno': 2}
        nodes[value] = row
    return nodes[value]


def derive(seed):
    add_parents(seed)
    pending, resolved, trace, link_count = seed.split('/')[1:], [], [], 0
    while pending:
        component = pending.pop(0)
        if component in ('', '.'):
            continue
        if component == '..':
            if not resolved:
                raise ValueError('Invalid runtime parent')
            resolved.pop()
            continue
        current = '/' + '/'.join([*resolved, component])
        add_parents(current)
        row = inspect(current)
        trace.append(current)
        if len(trace) > 160:
            raise ValueError('Path chain too long')
        if row['kind'] == 'symlink':
            link_count += 1
            if link_count > 16:
                raise ValueError('Symlink chain too long')
            target = row['target']
            if target.startswith('/'):
                resolved = []
            pending = target.split('/') + pending
        elif row['kind'] == 'absent':
            return {'seed': seed, 'status': 'absent-standalone', 'missingAt': current, 'trace': trace, 'realpath': None}
        elif row['kind'] not in ('regular', 'directory'):
            raise ValueError('Unexpected runtime entry kind')
        else:
            resolved.append(component)
    canonical = '/' + '/'.join(resolved)
    if os.path.realpath(seed) != canonical:
        raise ValueError('Path changed during derivation')
    return {'seed': seed, 'status': 'resolved', 'trace': trace, 'realpath': canonical}


source, base = SOURCE.read_bytes(), BASE.read_bytes()
assert hashlib.sha256(source).hexdigest() == SOURCE_SHA
assert hashlib.sha256(base).hexdigest() == BASE_SHA
seeds = json.loads(source)['allowedRuntimeLoadPaths']
assert len(seeds) == 62 and seeds.count(EXCLUDED) == 1
chains = [derive(seed) for seed in seeds if seed != EXCLUDED]
assert len(literals) <= 512
# Root already has read/test permission. Repeated leaf read-metadata is harmless;
# test-existence is explicit even for leaves with an existing file-read* grant.
grants = sorted(literals - {'/'})
suffix = '\n;; Runtime path closure: exact metadata/test only; no recursive read or executable grants.\n(allow file-read-metadata file-test-existence\n' + ''.join('  (literal ' + json.dumps(value) + ')\n' for value in grants) + ')\n'
candidate = base + suffix.encode()
PROFILE.parent.mkdir(parents=True, exist_ok=True)
with PROFILE.open('xb') as handle:
    handle.write(candidate)
payload = {
    'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'source': {'path': str(SOURCE), 'sha256': SOURCE_SHA},
    'baseProfile': {'path': str(BASE), 'sha256': BASE_SHA},
    'candidate': {'path': str(PROFILE), 'bytes': len(candidate), 'sha256': hashlib.sha256(candidate).hexdigest()},
    'operations': ['file-read-metadata', 'file-test-existence'],
    'excludedSeed': EXCLUDED, 'seedCount': len(chains), 'literalCount': len(grants),
    'limits': 'Fixed seeds only; no directory enumeration or child execution. Absent standalone paths do not prove shared-cache presence or sandbox necessity.',
    'nodes': [nodes[key] for key in sorted(nodes)], 'chains': chains, 'literals': grants,
}
with (OUTPUT / 'path-closure.json').open('x') as handle:
    json.dump(payload, handle, indent=2)
    handle.write('\n')
print(json.dumps({'seeds': len(chains), 'literals': len(grants), 'nodes': len(nodes), 'resolved': sum(x['status'] == 'resolved' for x in chains), 'candidateSha256': payload['candidate']['sha256']}))
