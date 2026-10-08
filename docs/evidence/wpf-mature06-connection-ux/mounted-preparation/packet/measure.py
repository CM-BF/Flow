"""Bounded, non-atomic regular-file byte observations of a pinned directory.

No file contents, symlink targets, resource ownership, or deletion decisions.
The caller supplies the hard process deadline around potentially blocking I/O.
"""
from dataclasses import dataclass
import math
import os
import stat
import time

_SUPPORTED = (hasattr(os, 'O_NOFOLLOW') and hasattr(os, 'O_DIRECTORY')
              and os.stat in os.supports_dir_fd and os.open in os.supports_dir_fd
              and os.scandir in os.supports_fd)


@dataclass(frozen=True)
class Root:
    path: str
    device: int
    inode: int


@dataclass(frozen=True)
class Limits:
    max_entries: int
    max_seconds: float
    max_depth: int = 64


@dataclass(frozen=True)
class Issue:
    code: str
    relative_path: str
    errno: int | None = None


@dataclass(frozen=True)
class Measurement:
    state: str
    logical_bytes: int
    allocated_bytes: int
    entries: int
    regular_files: int
    directories: int
    symlinks: int
    vanished_entries: int
    excluded_directories: int
    elapsed_seconds: float
    issue: Issue | None


def measure(root: Root, *, exclude: tuple[str, ...] = (), limits: Limits) -> Measurement:
    """Measure once. Invalid arguments raise ValueError; observation failures are unknown.

    Complete means only the declared regular-file traversal finished. Symlinks are
    counted, never followed or charged to byte totals. Hardlinks count per path.
    Unknown returns partial observations, never a usable whole-directory total.
    """
    _validate(root, exclude, limits)
    return _Scan(root, frozenset(exclude), limits).run()


def _validate(root, exclude, limits):
    if not isinstance(root, Root) or not isinstance(limits, Limits):
        raise ValueError('Root and Limits required')
    if (not isinstance(root.path, str) or not os.path.isabs(root.path)
            or os.path.normpath(root.path) != root.path or '\0' in root.path
            or len(os.fsencode(root.path)) > 4096):
        raise ValueError('Canonical absolute root path required')
    if any(type(value) is not int or value < 0 for value in (root.device, root.inode)):
        raise ValueError('Explicit device and inode required')
    if type(limits.max_entries) is not int or limits.max_entries < 1:
        raise ValueError('Positive entry bound required')
    if (isinstance(limits.max_seconds, bool) or not isinstance(limits.max_seconds, (int, float))
            or not math.isfinite(limits.max_seconds) or limits.max_seconds <= 0):
        raise ValueError('Positive finite time bound required')
    if type(limits.max_depth) is not int or not 1 <= limits.max_depth <= 128:
        raise ValueError('Depth must be between 1 and 128')
    if not isinstance(exclude, tuple) or len(exclude) > 128:
        raise ValueError('At most 128 exact excluded subtrees required')
    for path in exclude:
        if (not isinstance(path, str) or '\0' in path or len(os.fsencode(path)) > 4096
                or any(part in ('', '.', '..') for part in path.split('/'))):
            raise ValueError('Excluded subtree must be a literal relative path')
    if len(set(exclude)) != len(exclude) or any(
            a != b and b.startswith(a + '/') for a in exclude for b in exclude):
        raise ValueError('Excluded subtrees must be disjoint and unique')


class _Stop(Exception):
    pass


def _identity(info):
    return info.st_dev, info.st_ino, stat.S_IFMT(info.st_mode)


class _Scan:
    def __init__(self, root, exclude, limits):
        self.root = root
        self.exclude = exclude
        self.limits = limits
        self.started = time.monotonic()
        self.deadline = self.started + limits.max_seconds
        self.logical = self.allocated = self.entries = self.files = 0
        self.directories = self.symlinks = self.vanished = self.excluded = 0
        self.issue = None

    def fail(self, code, path, error=None):
        if self.issue is None:
            self.issue = Issue(code, path[:1024], getattr(error, 'errno', None))
        raise _Stop()

    def checkpoint(self, path):
        if time.monotonic() >= self.deadline:
            self.fail('TIME_LIMIT', path)

    def run(self):
        try:
            self.checkpoint('.')
            if not _SUPPORTED:
                self.fail('UNSUPPORTED_PLATFORM', '.')
            if os.path.realpath(self.root.path) != self.root.path:
                self.fail('ROOT_PATH_CHANGED', '.')
            info = os.stat(self.root.path, follow_symlinks=False)
            if (_identity(info) != (self.root.device, self.root.inode, stat.S_IFDIR)):
                self.fail('ROOT_IDENTITY_CHANGED', '.')
            self.directory(self.root.path, None, '.', info, 0)
            if os.path.realpath(self.root.path) != self.root.path:
                self.fail('ROOT_PATH_CHANGED', '.')
            self.checkpoint('.')
        except _Stop:
            pass
        except OSError as error:
            self.issue = self.issue or Issue('ROOT_IO', '.', error.errno)
        return Measurement('unknown' if self.issue else 'complete', self.logical,
                           self.allocated, self.entries, self.files, self.directories,
                           self.symlinks, self.vanished, self.excluded,
                           time.monotonic() - self.started, self.issue)

    def binding(self, name, parent_fd, relative, expected):
        self.checkpoint(relative)
        try:
            current = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
        except OSError as error:
            self.fail('DIRECTORY_BINDING_UNKNOWN', relative, error)
        if _identity(current) != _identity(expected):
            self.fail('DIRECTORY_IDENTITY_CHANGED', relative)
        self.checkpoint(relative)

    def directory(self, name, parent_fd, relative, expected, depth):
        self.checkpoint(relative)
        if depth > self.limits.max_depth:
            self.fail('DEPTH_LIMIT', relative)
        try:
            fd = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                         dir_fd=parent_fd)
        except FileNotFoundError as error:
            if parent_fd is None:
                self.fail('ROOT_IO', relative, error)
            self.vanished += 1
            return
        except OSError as error:
            self.fail('DIRECTORY_OPEN_UNKNOWN', relative, error)
        try:
            actual = os.fstat(fd)
            if _identity(actual) != _identity(expected):
                self.fail('DIRECTORY_IDENTITY_CHANGED', relative)
            self.binding(name, parent_fd, relative, actual)
            self.directories += 1
            with os.scandir(fd) as children:
                for child in children:
                    self.checkpoint(relative)
                    if self.entries >= self.limits.max_entries:
                        self.fail('ENTRY_LIMIT', relative)
                    self.entries += 1
                    child_path = child.name if relative == '.' else relative + '/' + child.name
                    self.entry(child.name, fd, child_path, depth + 1)
            self.binding(name, parent_fd, relative, actual)
        except OSError as error:
            self.fail('DIRECTORY_IO', relative, error)
        finally:
            try:
                os.close(fd)
            except OSError as error:
                self.fail('DIRECTORY_CLOSE_UNKNOWN', relative, error)

    def entry(self, name, parent_fd, relative, depth):
        self.checkpoint(relative)
        try:
            first = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
            self.checkpoint(relative)
            # Re-read the directory entry, not a cached DirEntry.stat result.
            current = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
        except FileNotFoundError:
            self.vanished += 1
            return
        except OSError as error:
            self.fail('ENTRY_IO', relative, error)
        self.checkpoint(relative)
        if _identity(first) != _identity(current):
            self.fail('ENTRY_IDENTITY_CHANGED', relative)
        if current.st_dev != self.root.device:
            self.fail('DEVICE_BOUNDARY', relative)
        if relative in self.exclude:
            if not stat.S_ISDIR(current.st_mode):
                self.fail('EXCLUSION_NOT_DIRECTORY', relative)
            self.excluded += 1
        elif stat.S_ISDIR(current.st_mode):
            self.directory(name, parent_fd, relative, current, depth)
        elif stat.S_ISLNK(current.st_mode):
            self.symlinks += 1
        elif stat.S_ISREG(current.st_mode):
            blocks = getattr(current, 'st_blocks', None)
            if type(blocks) is not int or blocks < 0 or current.st_size < 0:
                self.fail('FILE_ACCOUNTING_UNKNOWN', relative)
            self.logical += current.st_size
            self.allocated += blocks * 512
            self.files += 1
        else:
            self.fail('SPECIAL_FILE', relative)
