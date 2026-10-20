"""A single API instance owns a runtime, so restart recovery cannot fail live jobs."""

import os
from pathlib import Path


class RuntimeLease:
    def __init__(self, directory: Path):
        self.directory = directory
        self.file = None

    def acquire(self):
        self.directory.mkdir(parents=True, exist_ok=True)
        self.file = (self.directory / "api.lock").open("a+b")
        self.file.seek(0, os.SEEK_END)
        if self.file.tell() == 0:
            self.file.write(b"0")
            self.file.flush()
        self.file.seek(0)
        try:
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(self.file.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            self.file.close()
            self.file = None
            raise RuntimeError("This FloodOps runtime is already in use; run one API worker or choose a different FLOODOPS_DATA_DIR.") from exc

    def release(self):
        if self.file is not None:
            self.file.close()
            self.file = None
