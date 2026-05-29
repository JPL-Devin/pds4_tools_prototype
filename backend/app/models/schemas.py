from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class StructureType(str, Enum):
    TABLE_CHARACTER = "Table_Character"
    TABLE_BINARY = "Table_Binary"
    TABLE_DELIMITED = "Table_Delimited"
    ARRAY_2D_IMAGE = "Array_2D_Image"
    ARRAY_3D_SPECTRUM = "Array_3D_Spectrum"
    ARRAY_2D = "Array_2D"
    ARRAY_3D = "Array_3D"


class FieldInfo(BaseModel):
    name: str
    field_number: int
    data_type: str
    unit: str | None = None
    description: str | None = None


class StructureSummary(BaseModel):
    index: int
    name: str
    local_identifier: str | None = None
    structure_type: str
    record_count: int | None = None
    field_count: int | None = None
    dimensions: list[int] | None = None


class LabelUploadResponse(BaseModel):
    label_id: str
    filename: str
    structures: list[StructureSummary]


class LabelMetadata(BaseModel):
    label_id: str
    filename: str
    xml_tree: dict[str, Any]


class TableMetadata(BaseModel):
    label_id: str
    structure_index: int
    name: str
    structure_type: str
    record_count: int
    fields: list[FieldInfo]


class TableDataResponse(BaseModel):
    label_id: str
    structure_index: int
    total_records: int
    offset: int
    limit: int
    columns: list[str]
    data: list[dict[str, Any]]


class PlotSpec(BaseModel):
    plot_type: str = Field(description="One of: histogram, line, scatter, heatmap")
    x_column: str | None = None
    y_column: str | None = None
    color_column: str | None = None
    nbins: int | None = Field(default=None, description="Number of bins for histogram")
    title: str | None = None


class PlotDataResponse(BaseModel):
    plot_type: str
    data: dict[str, Any]
    layout: dict[str, Any]


class ImageMetadata(BaseModel):
    label_id: str
    structure_index: int
    name: str
    structure_type: str
    dimensions: list[int]
    element_data_type: str
    width: int
    height: int


class ImageRenderParams(BaseModel):
    colormap: str = Field(default="grayscale", description="Colormap name")
    stretch: str = Field(default="linear", description="Stretch: linear, log, sqrt, squared, histeq")
    vmin: float | None = Field(default=None, description="Min clip value (None = auto from percentile)")
    vmax: float | None = Field(default=None, description="Max clip value (None = auto from percentile)")
    percentile_low: float = Field(default=1.0, ge=0, le=100, description="Low percentile for auto-clip")
    percentile_high: float = Field(default=99.0, ge=0, le=100, description="High percentile for auto-clip")
    band: int | None = Field(default=None, description="Band index for 3D arrays")


class ErrorResponse(BaseModel):
    detail: str
