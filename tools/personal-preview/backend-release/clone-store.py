"""Build-only macOS clonefile wrapper: no ordinary-copy or hardlink fallback."""
import ctypes
import os
import stat
import sys

clone = ctypes.CDLL(None, use_errno=True).clonefile
clone.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_int]
clone.restype = ctypes.c_int


def copy(source, target):
    info = os.lstat(source)
    if stat.S_ISDIR(info.st_mode):
        os.mkdir(target, 0o700)
        for name in os.listdir(source):
            copy(os.path.join(source, name), os.path.join(target, name))
    elif stat.S_ISREG(info.st_mode):
        if clone(os.fsencode(source), os.fsencode(target), 1) != 0:
            error = ctypes.get_errno()
            raise OSError(error, os.strerror(error))
        result = os.lstat(target)
        if result.st_nlink != 1 or (info.st_dev, info.st_ino) == (result.st_dev, result.st_ino):
            raise RuntimeError('CLONE_NOT_INDEPENDENT')
    else:
        raise RuntimeError('CLONE_REGULAR_FILES_ONLY')


copy(sys.argv[1], sys.argv[2])
