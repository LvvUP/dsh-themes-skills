#!/usr/bin/env python3
"""Extract regular files from a reviewed npm archive, without executing code."""
import pathlib
import sys
import tarfile

root = pathlib.Path(sys.argv[2]).resolve()
with tarfile.open(sys.argv[1]) as archive:
    for member in archive:
        if member.isdir():
            continue
        parts = pathlib.PurePosixPath(member.name).parts
        if not member.isfile() or len(parts) < 2 or '..' in parts or member.name.startswith('/'):
            raise ValueError('Unsafe archive entry')
        destination = root.joinpath(*parts[1:])
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(archive.extractfile(member).read())
