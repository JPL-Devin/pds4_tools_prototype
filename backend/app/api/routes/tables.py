"""Table data and plotting endpoints."""
from __future__ import annotations

import csv
import io
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.api.deps import get_label
from app.models.schemas import (
    FieldInfo,
    PlotDataResponse,
    PlotSpec,
    TableDataResponse,
    TableMetadata,
)
from app.services.label_parser import read_table_data
from app.services.table_service import (
    compute_heatmap,
    compute_histogram,
    compute_line_plot,
    compute_scatter_plot,
)

router = APIRouter()


@router.get("/{label_id}/{structure_index}", response_model=TableMetadata)
async def get_table_metadata(label_id: str, structure_index: int) -> TableMetadata:
    """Get metadata for a specific table structure."""
    label = get_label(label_id)
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    structures = label.get("structures", [])
    if structure_index < 0 or structure_index >= len(structures):
        raise HTTPException(status_code=404, detail="Structure not found")

    s = structures[structure_index]
    if "Table" not in s.get("structure_type", ""):
        raise HTTPException(status_code=400, detail="Structure is not a table")

    fields = [
        FieldInfo(
            name=f["name"],
            field_number=f["field_number"],
            data_type=f["data_type"],
            unit=f.get("unit"),
            description=f.get("description"),
        )
        for f in s.get("fields", [])
    ]

    return TableMetadata(
        label_id=label_id,
        structure_index=structure_index,
        name=s["name"],
        structure_type=s["structure_type"],
        record_count=s.get("record_count", 0),
        fields=fields,
    )


@router.get("/{label_id}/{structure_index}/data", response_model=TableDataResponse)
async def get_table_data(
    label_id: str,
    structure_index: int,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=10000),
    format: str = Query(default="json"),
) -> TableDataResponse | StreamingResponse:
    """Get paginated table data. Use format=csv for CSV export."""
    label = get_label(label_id)
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    structures = label.get("structures", [])
    if structure_index < 0 or structure_index >= len(structures):
        raise HTTPException(status_code=404, detail="Structure not found")

    s = structures[structure_index]
    if "Table" not in s.get("structure_type", ""):
        raise HTTPException(status_code=400, detail="Structure is not a table")

    try:
        rows = read_table_data(s, offset=offset, limit=limit)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read table data: {e}")

    fields = s.get("fields", [])
    columns = [f["name"] for f in fields]

    if format == "csv":
        return _rows_to_csv_response(rows, columns)

    return TableDataResponse(
        label_id=label_id,
        structure_index=structure_index,
        total_records=s.get("record_count", 0),
        offset=offset,
        limit=limit,
        columns=columns,
        data=rows,
    )


@router.post("/{label_id}/{structure_index}/plot", response_model=PlotDataResponse)
async def create_plot(
    label_id: str,
    structure_index: int,
    spec: PlotSpec,
) -> PlotDataResponse:
    """Generate plot data for a table structure."""
    label = get_label(label_id)
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    structures = label.get("structures", [])
    if structure_index < 0 or structure_index >= len(structures):
        raise HTTPException(status_code=404, detail="Structure not found")

    s = structures[structure_index]
    if "Table" not in s.get("structure_type", ""):
        raise HTTPException(status_code=400, detail="Structure is not a table")

    try:
        all_data = read_table_data(s, offset=0, limit=None)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read data: {e}")

    fields = s.get("fields", [])
    field_count = len(fields)

    def col_name(idx: int) -> str:
        if 0 <= idx < len(fields):
            return fields[idx]["name"]
        return f"Column {idx}"

    if spec.plot_type == "histogram":
        if spec.x_column is None:
            raise HTTPException(status_code=400, detail="x_column required for histogram")
        if spec.x_column >= field_count:
            raise HTTPException(status_code=400, detail=f"x_column index {spec.x_column} out of range")
        result = compute_histogram(all_data, spec.x_column, col_name(spec.x_column), nbins=spec.nbins or 30, trace_color=spec.trace_color)
    elif spec.plot_type == "line":
        if spec.x_column is None or spec.y_column is None:
            raise HTTPException(status_code=400, detail="x_column and y_column required for line plot")
        result = compute_line_plot(
            all_data, spec.x_column, spec.y_column,
            col_name(spec.x_column), col_name(spec.y_column),
            trace_color=spec.trace_color,
        )
    elif spec.plot_type == "scatter":
        if spec.x_column is None or spec.y_column is None:
            raise HTTPException(status_code=400, detail="x_column and y_column required for scatter plot")
        result = compute_scatter_plot(
            all_data, spec.x_column, spec.y_column,
            col_name(spec.x_column), col_name(spec.y_column),
            spec.color_column, col_name(spec.color_column) if spec.color_column is not None else None,
            trace_color=spec.trace_color,
        )
    elif spec.plot_type == "heatmap":
        if spec.x_column is None or spec.y_column is None:
            raise HTTPException(status_code=400, detail="x_column and y_column required for heatmap")
        result = compute_heatmap(
            all_data, spec.x_column, spec.y_column,
            col_name(spec.x_column), col_name(spec.y_column),
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unknown plot type: {spec.plot_type}")

    return PlotDataResponse(
        plot_type=spec.plot_type,
        data={"traces": result.get("data", [])},
        layout=result.get("layout", {}),
    )


def _rows_to_csv_response(
    rows: list[list[Any]],
    columns: list[str],
) -> StreamingResponse:
    """Convert rows to a CSV streaming response."""
    output = io.StringIO()
    if not rows:
        return StreamingResponse(
            iter(["No data"]),
            media_type="text/csv",
        )

    writer = csv.writer(output)
    writer.writerow(columns)
    for row in rows:
        writer.writerow(row)

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=table_data.csv"},
    )
