"""Pluggable storage backend for browsing and reading PDS4 label files.

Supports local filesystem and S3 backends via a common protocol.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, runtime_checkable


@dataclass
class FileEntry:
    """A single file or directory entry returned by a storage backend."""

    name: str
    path: str
    is_dir: bool
    size: int | None = None
    is_label: bool = False


@dataclass
class StorageConfig:
    """Configuration for a storage backend."""

    backend_type: str  # "local" or "s3"
    # Local FS options
    root_path: str | None = None
    # S3 options
    bucket: str | None = None
    prefix: str | None = None
    region: str | None = None
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None


@runtime_checkable
class StorageBackend(Protocol):
    """Protocol for storage backends that can browse and read files."""

    def list_directory(self, path: str) -> list[FileEntry]:
        """List files and directories at the given path."""
        ...

    def read_file(self, path: str) -> bytes:
        """Read the full contents of a file."""
        ...

    def file_exists(self, path: str) -> bool:
        """Check if a file exists at the given path."""
        ...

    def get_parent(self, path: str) -> str | None:
        """Return the parent path, or None if at root."""
        ...

    @property
    def root(self) -> str:
        """Return the root path for this backend."""
        ...


LABEL_EXTS = {".xml", ".lblx"}


class LocalFilesystemBackend:
    """Browse and read files from the local filesystem."""

    def __init__(self, root_path: str | None = None) -> None:
        self._root = Path(root_path) if root_path else Path.home()

    @property
    def root(self) -> str:
        return str(self._root)

    def list_directory(self, path: str) -> list[FileEntry]:
        target = Path(path) if path else self._root
        if not target.is_dir():
            raise FileNotFoundError(f"Directory not found: {path}")

        entries: list[FileEntry] = []
        try:
            for item in sorted(target.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
                # Skip hidden files/dirs
                if item.name.startswith("."):
                    continue
                try:
                    is_dir = item.is_dir()
                    size = item.stat().st_size if not is_dir else None
                    is_label = not is_dir and item.suffix.lower() in LABEL_EXTS
                    entries.append(
                        FileEntry(
                            name=item.name,
                            path=str(item),
                            is_dir=is_dir,
                            size=size,
                            is_label=is_label,
                        )
                    )
                except PermissionError:
                    continue
        except PermissionError:
            raise PermissionError(f"Access denied: {path}")

        return entries

    def read_file(self, path: str) -> bytes:
        target = Path(path)
        if not target.is_file():
            raise FileNotFoundError(f"File not found: {path}")
        return target.read_bytes()

    def file_exists(self, path: str) -> bool:
        return Path(path).is_file()

    def get_parent(self, path: str) -> str | None:
        target = Path(path)
        parent = target.parent
        if parent == target:
            return None
        return str(parent)


class S3StorageBackend:
    """Browse and read files from an S3 bucket."""

    def __init__(self, bucket: str, prefix: str = "", region: str | None = None,
                 aws_access_key_id: str | None = None, aws_secret_access_key: str | None = None) -> None:
        try:
            import boto3
        except ImportError:
            raise ImportError("boto3 is required for S3 storage backend. Install with: pip install boto3")

        session_kwargs: dict[str, str] = {}
        if region:
            session_kwargs["region_name"] = region
        if aws_access_key_id:
            session_kwargs["aws_access_key_id"] = aws_access_key_id
        if aws_secret_access_key:
            session_kwargs["aws_secret_access_key"] = aws_secret_access_key

        self._s3 = boto3.client("s3", **session_kwargs)
        self._bucket = bucket
        self._prefix = prefix.rstrip("/")

    @property
    def root(self) -> str:
        return f"s3://{self._bucket}/{self._prefix}" if self._prefix else f"s3://{self._bucket}"

    def _normalize_key(self, path: str) -> str:
        """Convert a display path to an S3 key."""
        if path.startswith(f"s3://{self._bucket}/"):
            path = path[len(f"s3://{self._bucket}/"):]
        return path.strip("/")

    def list_directory(self, path: str) -> list[FileEntry]:
        prefix = self._normalize_key(path)
        if prefix:
            prefix = prefix.rstrip("/") + "/"

        response = self._s3.list_objects_v2(
            Bucket=self._bucket,
            Prefix=prefix,
            Delimiter="/",
        )

        entries: list[FileEntry] = []

        # Directories (common prefixes)
        for cp in response.get("CommonPrefixes", []):
            dir_path = cp["Prefix"].rstrip("/")
            name = dir_path.split("/")[-1]
            entries.append(
                FileEntry(
                    name=name,
                    path=f"s3://{self._bucket}/{dir_path}",
                    is_dir=True,
                )
            )

        # Files
        for obj in response.get("Contents", []):
            key = obj["Key"]
            if key == prefix:
                continue
            name = key.split("/")[-1]
            suffix = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
            entries.append(
                FileEntry(
                    name=name,
                    path=f"s3://{self._bucket}/{key}",
                    is_dir=False,
                    size=obj.get("Size"),
                    is_label=suffix in LABEL_EXTS,
                )
            )

        return entries

    def read_file(self, path: str) -> bytes:
        key = self._normalize_key(path)
        response = self._s3.get_object(Bucket=self._bucket, Key=key)
        return response["Body"].read()

    def file_exists(self, path: str) -> bool:
        key = self._normalize_key(path)
        try:
            self._s3.head_object(Bucket=self._bucket, Key=key)
            return True
        except Exception:
            return False

    def get_parent(self, path: str) -> str | None:
        key = self._normalize_key(path)
        if "/" not in key:
            return None
        parent_key = key.rsplit("/", 1)[0]
        return f"s3://{self._bucket}/{parent_key}"


# Global storage registry
_storage_backends: dict[str, StorageBackend] = {}


def register_backend(name: str, backend: StorageBackend) -> None:
    _storage_backends[name] = backend


def get_backend(name: str) -> StorageBackend | None:
    return _storage_backends.get(name)


def list_backends() -> list[dict[str, str]]:
    return [{"name": name, "root": b.root} for name, b in _storage_backends.items()]


def init_default_backends() -> None:
    """Initialize default storage backends from environment variables."""
    # Always register local filesystem
    local_root = os.environ.get("PDS_LOCAL_ROOT", str(Path.home()))
    register_backend("local", LocalFilesystemBackend(root_path=local_root))

    # Register S3 backend if configured
    s3_bucket = os.environ.get("PDS_S3_BUCKET")
    if s3_bucket:
        register_backend("s3", S3StorageBackend(
            bucket=s3_bucket,
            prefix=os.environ.get("PDS_S3_PREFIX", ""),
            region=os.environ.get("PDS_S3_REGION"),
            aws_access_key_id=os.environ.get("PDS_S3_ACCESS_KEY_ID"),
            aws_secret_access_key=os.environ.get("PDS_S3_SECRET_ACCESS_KEY"),
        ))
