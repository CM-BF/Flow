# Bounded directory measurement

Standard-library Python 3.10+ on POSIX platforms with descriptor-relative directory operations. Import `measure.py` using the caller's existing fixed module loader; importing starts no work. No package installation or CLI is required.

```python
from measure import Root, Limits, measure

# Use the caller's existing pinned directory identity, not a newly invented owner.
sample = measure(
    Root(packet_path, packet_device, packet_inode),
    exclude=('scratch',),
    limits=Limits(max_entries=20_000, max_seconds=0.25),
)
if sample.state == 'unknown':
    # The caller records the partial observation and keeps its existing stop policy.
    handle_unknown(sample.issue)
else:
    retained_regular_bytes = sample.logical_bytes + external_evidence_bytes
```

`Measurement` is a dataclass; `dataclasses.asdict(sample)` is JSON-compatible. It contains `state`, `logical_bytes`, `allocated_bytes`, `entries`, `regular_files`, `directories`, `symlinks`, `vanished_entries`, `excluded_directories`, `elapsed_seconds`, and the first `issue` (`code`, relative path capped at 1024 characters, optional errno). No exception message or file content is returned. Invalid caller arguments raise `ValueError`; filesystem/budget uncertainty is an `unknown` measurement.

Byte totals include **regular files only**, once per path. `allocated_bytes` is the sum of observed `st_blocks * 512`, not physical reclaimable storage. Hardlinks may count the same allocation more than once. Directory and symlink metadata are excluded from both totals; symlinks are counted separately and never followed. Special files, different devices, identity changes, missing accounting fields, and I/O failure yield unknown. Complete does not mean the tree contains only regular files.

Exclusions are disjoint, exact root-relative directory paths. They are not patterns, prefixes, or a second scan to subtract. Missing exclusions are harmless; an existing excluded path of another type is unknown. Entries counts every enumerated child, including excluded directories, links, and children that disappear before an observation. `vanished_entries` is limited to this explicit enumeration-to-stat/open gap. An opened directory losing its binding, or a missing/changed root, remains unknown.

The root must use a canonical real absolute path and an existing device/inode pin. Descendants open relative to pinned parent descriptors with `O_NOFOLLOW`; opened directories are rechecked against their parent bindings before and after traversal. This is a bounded, non-atomic observation, **not** a proof that nothing changed between checks. Concurrent file growth is sampled at the last metadata read. A replacement with the same recycled inode may be indistinguishable; no security authorization or cleanup proof is issued.

Entries and directory depth bound traversal. Depth defaults to 64 and cannot exceed 128. At most one descriptor and directory iterator per active depth are retained. Monotonic deadlines are checked between filesystem calls and after observations; an individual blocked kernel call requires the caller's existing external supervisor. This module creates no processes, timers, databases, deletion actions, or resource admission policy. It cannot measure a peak or stop the caller for exceeding a byte budget.

The [Interface and current two caller inputs](../../docs/evidence/ops-meter01/interface.md) bind Quick and DPERF's existing exact exclusion behavior. Later adoption belongs to those original owners in new caller versions. Historical or active frozen packets remain unchanged; local module checks do not establish real caller adoption.
