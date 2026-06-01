"""File browsing endpoints for navigating storage backends."""
from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from app.api.deps import store_label
from app.models.schemas import LabelUploadResponse, StructureSummary
from app.services.label_parser import parse_label
from app.services.storage import get_backend, list_backends

router = APIRouter()


@router.get("/sources")
async def get_sources() -> list[dict[str, str]]:
    """List all configured storage backends."""
    return list_backends()


@router.get("/list")
async def browse_directory(
    source: str = Query(default="local", description="Storage backend name"),
    path: str = Query(default="", description="Directory path to browse"),
) -> dict:
    """List files and directories at the given path."""
    backend = get_backend(source)
    if not backend:
        raise HTTPException(status_code=404, detail=f"Storage source '{source}' not found")

    target_path = path if path else backend.root

    try:
        entries = backend.list_directory(target_path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    parent = backend.get_parent(target_path)

    return {
        "source": source,
        "current_path": target_path,
        "parent_path": parent,
        "entries": [
            {
                "name": e.name,
                "path": e.path,
                "is_dir": e.is_dir,
                "size": e.size,
                "is_label": e.is_label,
            }
            for e in entries
        ],
    }


@router.post("/open")
async def open_label(
    source: str = Query(default="local", description="Storage backend name"),
    path: str = Query(description="Path to the label file"),
) -> LabelUploadResponse:
    """Open a label file from the storage backend and parse it.

    For local filesystem, reads the label directly.
    For S3, downloads the label and its data files to a temp directory first.
    """
    backend = get_backend(source)
    if not backend:
        raise HTTPException(status_code=404, detail=f"Storage source '{source}' not found")

    if not backend.file_exists(path):
        raise HTTPException(status_code=404, detail=f"Label file not found: {path}")

    if source == "local":
        # For local FS, parse directly from the filesystem path
        try:
            parsed = parse_label(path)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Failed to parse label: {e}")
    else:
        # For remote backends (S3), download files to temp dir
        temp_dir = Path(tempfile.mkdtemp(prefix="pds4_browse_"))
        try:
            # Download label
            label_content = backend.read_file(path)
            label_name = Path(path).name if "/" not in path else path.rsplit("/", 1)[-1]
            label_path = temp_dir / label_name
            label_path.write_bytes(label_content)

            # Quick parse to find referenced data files
            from lxml import etree
            root = etree.fromstring(label_content)
            nsmap = {"pds": "http://pds.nasa.gov/pds4/pds/v1"}
            file_names: list[str] = []
            for file_area in root:
                if hasattr(file_area, "tag"):
                    local = etree.QName(file_area.tag).localname
                    if local.startswith("File_Area_"):
                        for fn_el in file_area.xpath("pds:File/pds:file_name", namespaces=nsmap):
                            if fn_el.text:
                                file_names.append(fn_el.text)

            # Download each referenced data file from the same "directory"
            parent_path = backend.get_parent(path)
            for fname in file_names:
                if parent_path:
                    data_path = f"{parent_path}/{fname}"
                else:
                    data_path = fname
                if backend.file_exists(data_path):
                    data_content = backend.read_file(data_path)
                    (temp_dir / fname).write_bytes(data_content)

            parsed = parse_label(label_path)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Failed to parse label: {e}")

    label_id = store_label(parsed)

    structures = [
        StructureSummary(
            index=s["index"],
            name=s["name"],
            local_identifier=s.get("local_identifier"),
            structure_type=s["structure_type"],
            record_count=s.get("record_count"),
            field_count=s.get("field_count"),
            dimensions=s.get("dimensions"),
        )
        for s in parsed["structures"]
    ]

    return LabelUploadResponse(
        label_id=label_id,
        filename=parsed["filename"],
        structures=structures,
    )
