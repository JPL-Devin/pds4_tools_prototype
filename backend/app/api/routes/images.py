"""Image/array data viewing endpoints."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.api.deps import get_label
from app.models.schemas import ImageMetadata, ImageRenderParams
from app.services.image_service import get_image_statistics, render_image
from app.services.label_parser import read_array_data

router = APIRouter()


@router.get("/{label_id}/{structure_index}", response_model=ImageMetadata)
async def get_image_metadata(label_id: str, structure_index: int) -> ImageMetadata:
    """Get metadata for a specific array/image structure."""
    label = get_label(label_id)
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    structures = label.get("structures", [])
    if structure_index < 0 or structure_index >= len(structures):
        raise HTTPException(status_code=404, detail="Structure not found")

    s = structures[structure_index]
    if "Array" not in s.get("structure_type", ""):
        raise HTTPException(status_code=400, detail="Structure is not an array/image")

    dimensions = s.get("dimensions", [])
    return ImageMetadata(
        label_id=label_id,
        structure_index=structure_index,
        name=s.get("name", "Unknown"),
        structure_type=s["structure_type"],
        dimensions=dimensions,
        element_data_type=s.get("element_data_type", "unknown"),
        width=dimensions[1] if len(dimensions) >= 2 else dimensions[0] if dimensions else 0,
        height=dimensions[0] if len(dimensions) >= 2 else 1,
    )


@router.get("/{label_id}/{structure_index}/statistics")
async def get_image_stats(label_id: str, structure_index: int) -> dict[str, Any]:
    """Get statistics for the image data (min, max, mean, std, percentiles)."""
    label = get_label(label_id)
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    structures = label.get("structures", [])
    if structure_index < 0 or structure_index >= len(structures):
        raise HTTPException(status_code=404, detail="Structure not found")

    s = structures[structure_index]
    if "Array" not in s.get("structure_type", ""):
        raise HTTPException(status_code=400, detail="Structure is not an array/image")

    try:
        data = read_array_data(s)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return get_image_statistics(data)


@router.post("/{label_id}/{structure_index}/render")
async def render_image_endpoint(
    label_id: str,
    structure_index: int,
    params: ImageRenderParams,
) -> Response:
    """Render an image with the specified colormap and stretch parameters."""
    label = get_label(label_id)
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    structures = label.get("structures", [])
    if structure_index < 0 or structure_index >= len(structures):
        raise HTTPException(status_code=404, detail="Structure not found")

    s = structures[structure_index]
    if "Array" not in s.get("structure_type", ""):
        raise HTTPException(status_code=400, detail="Structure is not an array/image")

    try:
        data = read_array_data(s)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    try:
        png_bytes = render_image(data, params)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render image: {e}")

    return Response(content=png_bytes, media_type="image/png")


@router.get("/{label_id}/{structure_index}/pixel")
async def get_pixel_value(
    label_id: str,
    structure_index: int,
    x: int = Query(ge=0),
    y: int = Query(ge=0),
) -> dict[str, Any]:
    """Get the raw pixel value at the specified coordinates."""
    label = get_label(label_id)
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    structures = label.get("structures", [])
    if structure_index < 0 or structure_index >= len(structures):
        raise HTTPException(status_code=404, detail="Structure not found")

    s = structures[structure_index]
    if "Array" not in s.get("structure_type", ""):
        raise HTTPException(status_code=400, detail="Structure is not an array/image")

    try:
        data = read_array_data(s)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if y >= data.shape[0] or x >= data.shape[1] if data.ndim >= 2 else x >= data.shape[0]:
        raise HTTPException(status_code=400, detail="Coordinates out of bounds")

    if data.ndim >= 2:
        value = float(data[y, x])
    else:
        value = float(data[x])

    return {"x": x, "y": y, "value": value}
