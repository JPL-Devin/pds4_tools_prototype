"""Label management endpoints."""
from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile

from app.api.deps import get_label, list_labels, store_label
from app.models.schemas import LabelMetadata, LabelUploadResponse, StructureSummary
from app.services.label_parser import parse_label

router = APIRouter()

UPLOAD_DIR = Path(tempfile.gettempdir()) / "pds4_viewer_uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload", response_model=LabelUploadResponse)
async def upload_label(
    label_file: UploadFile,
    data_files: list[UploadFile] = [],
) -> LabelUploadResponse:
    """Upload a PDS4 label file (XML/LBLX) and its associated data files.

    Drop a label + all referenced data files together. The label's XML
    specifies data filenames via <File><file_name>, so the uploaded data
    files are matched by name automatically.
    """
    if not label_file.filename:
        raise HTTPException(status_code=400, detail="No label file provided")

    suffix = Path(label_file.filename).suffix.lower()
    if suffix not in (".xml", ".lblx"):
        raise HTTPException(status_code=400, detail="Label file must be .xml or .lblx")

    session_dir = UPLOAD_DIR / tempfile.mktemp(prefix="session_", dir="").lstrip("/")
    session_dir.mkdir(parents=True, exist_ok=True)

    label_path = session_dir / label_file.filename
    with open(label_path, "wb") as f:
        shutil.copyfileobj(label_file.file, f)

    for df in data_files:
        if df.filename:
            data_path = session_dir / df.filename
            with open(data_path, "wb") as f:
                shutil.copyfileobj(df.file, f)

    try:
        parsed = parse_label(label_path)
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

    missing_files = []
    xml_dir = label_path.parent
    for fname in parsed.get("referenced_data_files", []):
        if not (xml_dir / fname).exists():
            missing_files.append(fname)

    if missing_files:
        raise HTTPException(
            status_code=422,
            detail=f"Missing required data files referenced by label: {', '.join(missing_files)}. "
            "Upload them alongside the label file.",
        )

    return LabelUploadResponse(
        label_id=label_id,
        filename=parsed["filename"],
        structures=structures,
    )


@router.get("", response_model=list[dict[str, str]])
async def get_labels() -> list[dict[str, str]]:
    """List all uploaded labels."""
    return list_labels()


@router.get("/{label_id}", response_model=LabelMetadata)
async def get_label_detail(label_id: str) -> LabelMetadata:
    """Get label metadata including the XML tree."""
    label = get_label(label_id)
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    return LabelMetadata(
        label_id=label_id,
        filename=label["filename"],
        xml_tree=label["xml_tree"],
    )


@router.get("/{label_id}/structures", response_model=list[StructureSummary])
async def get_structures(label_id: str) -> list[StructureSummary]:
    """List all data structures in a label."""
    label = get_label(label_id)
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    return [
        StructureSummary(
            index=s["index"],
            name=s["name"],
            local_identifier=s.get("local_identifier"),
            structure_type=s["structure_type"],
            record_count=s.get("record_count"),
            field_count=s.get("field_count"),
            dimensions=s.get("dimensions"),
        )
        for s in label["structures"]
    ]
