"""PDS4 Label Parser service.

Parses PDS4 XML/LBLX label files and extracts metadata about the data
structures described within (tables, images, arrays, etc.).
"""
from __future__ import annotations

import os
import struct
from pathlib import Path
from typing import Any

import numpy as np
from lxml import etree

PDS4_NS = "http://pds.nasa.gov/pds4/pds/v1"
NSMAP = {"pds": PDS4_NS}

TABLE_TYPES = {
    f"{{{PDS4_NS}}}Table_Character",
    f"{{{PDS4_NS}}}Table_Binary",
    f"{{{PDS4_NS}}}Table_Delimited",
}

ARRAY_TYPES = {
    f"{{{PDS4_NS}}}Array_2D_Image",
    f"{{{PDS4_NS}}}Array_2D",
    f"{{{PDS4_NS}}}Array_3D",
    f"{{{PDS4_NS}}}Array_3D_Spectrum",
}

DATA_STRUCTURE_TYPES = TABLE_TYPES | ARRAY_TYPES

PDS4_TO_NUMPY_DTYPE: dict[str, str] = {
    "ASCII_Real": "float64",
    "ASCII_Integer": "int64",
    "ASCII_String": "U",
    "ASCII_Date_Time_YMD": "U",
    "ASCII_Date_Time_YMD_UTC": "U",
    "ASCII_Date": "U",
    "ASCII_Boolean": "U",
    "ASCII_NonNegative_Integer": "int64",
    "ASCII_Numeric_Base2": "U",
    "ASCII_Numeric_Base8": "U",
    "ASCII_Numeric_Base16": "U",
    "IEEE754MSBSingle": ">f4",
    "IEEE754MSBDouble": ">f8",
    "SignedMSB2": ">i2",
    "SignedMSB4": ">i4",
    "UnsignedMSB2": ">u2",
    "UnsignedMSB4": ">u4",
    "UnsignedByte": "u1",
    "SignedByte": "i1",
}


def _text(element: etree._Element, xpath: str) -> str | None:
    nodes = element.xpath(xpath, namespaces=NSMAP)
    if nodes:
        return nodes[0].text
    return None


def _int(element: etree._Element, xpath: str) -> int | None:
    val = _text(element, xpath)
    return int(val) if val is not None else None


def parse_label(xml_path: str | Path) -> dict[str, Any]:
    """Parse a PDS4 XML label and return metadata about its structures."""
    xml_path = Path(xml_path)
    tree = etree.parse(str(xml_path))
    root = tree.getroot()

    structures: list[dict[str, Any]] = []
    file_areas = root.xpath(
        "pds:File_Area_Observational | pds:File_Area_Observational_Supplemental",
        namespaces=NSMAP,
    )

    for file_area in file_areas:
        data_file_elem = file_area.xpath("pds:File/pds:file_name", namespaces=NSMAP)
        data_filename = data_file_elem[0].text if data_file_elem else None

        if data_filename:
            data_filepath = xml_path.parent / data_filename
        else:
            data_filepath = None

        idx = len(structures)
        for child in file_area:
            tag = child.tag
            if tag not in DATA_STRUCTURE_TYPES:
                continue

            local_tag = etree.QName(tag).localname
            name = _text(child, "pds:name") or _text(child, "pds:local_identifier") or local_tag
            local_id = _text(child, "pds:local_identifier")
            offset = _int(child, "pds:offset") or 0

            structure: dict[str, Any] = {
                "index": idx,
                "name": name,
                "local_identifier": local_id,
                "structure_type": local_tag,
                "data_file": str(data_filepath) if data_filepath else None,
                "offset": offset,
            }

            if tag in TABLE_TYPES:
                structure.update(_parse_table_structure(child, local_tag))
            elif tag in ARRAY_TYPES:
                structure.update(_parse_array_structure(child))

            structures.append(structure)
            idx += 1

    return {
        "filename": xml_path.name,
        "xml_path": str(xml_path),
        "structures": structures,
        "xml_tree": _element_to_dict(root),
    }


def _parse_table_structure(element: etree._Element, table_type: str) -> dict[str, Any]:
    """Extract table-specific metadata: fields, record count, record length."""
    record_count = _int(element, "pds:records")

    if table_type == "Table_Character":
        record_tag = "pds:Record_Character"
        field_tag = "pds:Field_Character"
        group_tag = "pds:Group_Field_Character"
    elif table_type == "Table_Binary":
        record_tag = "pds:Record_Binary"
        field_tag = "pds:Field_Binary"
        group_tag = "pds:Group_Field_Binary"
    else:
        record_tag = "pds:Record_Delimited"
        field_tag = "pds:Field_Delimited"
        group_tag = "pds:Group_Field_Delimited"

    record_elem = element.xpath(record_tag, namespaces=NSMAP)
    record_length = None
    if record_elem:
        record_length = _int(record_elem[0], "pds:record_length")

    fields: list[dict[str, Any]] = []
    if record_elem:
        _extract_fields(record_elem[0], field_tag, group_tag, fields)

    return {
        "record_count": record_count,
        "record_length": record_length,
        "field_count": len(fields),
        "fields": fields,
    }


def _extract_fields(
    parent: etree._Element,
    field_tag: str,
    group_tag: str,
    fields: list[dict[str, Any]],
    prefix: str = "",
) -> None:
    """Recursively extract field definitions, including grouped fields."""
    for child in parent:
        if child.tag == f"{{{PDS4_NS}}}{field_tag.split(':')[1]}":
            field_num = _int(child, "pds:field_number") or (len(fields) + 1)
            name = _text(child, "pds:name") or f"field_{field_num}"
            data_type = _text(child, "pds:data_type") or "ASCII_String"
            unit = _text(child, "pds:unit")
            description = _text(child, "pds:description")
            field_length = _int(child, "pds:field_length")
            field_location = _int(child, "pds:field_location")

            fields.append({
                "name": f"{prefix}{name}" if prefix else name,
                "field_number": field_num,
                "data_type": data_type,
                "unit": unit,
                "description": description,
                "field_length": field_length,
                "field_location": field_location,
            })
        elif child.tag == f"{{{PDS4_NS}}}{group_tag.split(':')[1]}":
            group_name = _text(child, "pds:name") or "group"
            repetitions = _int(child, "pds:repetitions") or 1
            for i in range(repetitions):
                group_prefix = f"{prefix}{group_name}_{i + 1}_" if repetitions > 1 else f"{prefix}{group_name}_"
                _extract_fields(child, field_tag, group_tag, fields, group_prefix)


def _parse_array_structure(element: etree._Element) -> dict[str, Any]:
    """Extract array-specific metadata: dimensions, data type."""
    axes = _int(element, "pds:axes")
    data_type = _text(element, "pds:Element_Array/pds:data_type")

    dimensions: list[int] = []
    axis_elems = element.xpath("pds:Axis_Array", namespaces=NSMAP)
    axis_data = []
    for axis in axis_elems:
        seq = _int(axis, "pds:sequence_number") or 0
        elements_count = _int(axis, "pds:elements") or 0
        axis_name = _text(axis, "pds:axis_name") or f"axis_{seq}"
        axis_data.append((seq, elements_count, axis_name))

    axis_data.sort(key=lambda x: x[0])
    dimensions = [a[1] for a in axis_data]

    return {
        "axes": axes,
        "dimensions": dimensions,
        "element_data_type": data_type,
    }


def read_table_data(
    structure: dict[str, Any],
    offset: int = 0,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """Read table data from a PDS4 data file using the structure metadata."""
    data_file = structure.get("data_file")
    if not data_file or not os.path.exists(data_file):
        raise FileNotFoundError(f"Data file not found: {data_file}")

    table_type = structure["structure_type"]
    fields = structure.get("fields", [])
    record_count = structure.get("record_count", 0)
    record_length = structure.get("record_length")
    file_offset = structure.get("offset", 0)

    if limit is None:
        limit = record_count
    end = min(offset + limit, record_count)

    if table_type == "Table_Character":
        return _read_character_table(data_file, fields, file_offset, record_length, offset, end)
    elif table_type == "Table_Binary":
        return _read_binary_table(data_file, fields, file_offset, record_length, offset, end)
    else:
        return _read_delimited_table(data_file, fields, file_offset, offset, end)


def _read_character_table(
    filepath: str,
    fields: list[dict[str, Any]],
    file_offset: int,
    record_length: int,
    start: int,
    end: int,
) -> list[dict[str, Any]]:
    """Read fixed-width ASCII table data."""
    rows: list[dict[str, Any]] = []

    with open(filepath, "rb") as f:
        f.seek(file_offset + start * record_length)
        for _ in range(end - start):
            record_bytes = f.read(record_length)
            if len(record_bytes) < record_length:
                break

            row: dict[str, Any] = {}
            for field in fields:
                loc = (field.get("field_location") or 1) - 1
                length = field.get("field_length") or 0
                raw = record_bytes[loc : loc + length].decode("ascii", errors="replace").strip()
                row[field["name"]] = _coerce_value(raw, field.get("data_type", "ASCII_String"))

            rows.append(row)

    return rows


def _read_binary_table(
    filepath: str,
    fields: list[dict[str, Any]],
    file_offset: int,
    record_length: int,
    start: int,
    end: int,
) -> list[dict[str, Any]]:
    """Read binary table data."""
    type_to_struct: dict[str, str] = {
        "IEEE754MSBSingle": ">f",
        "IEEE754MSBDouble": ">d",
        "SignedMSB2": ">h",
        "SignedMSB4": ">i",
        "UnsignedMSB2": ">H",
        "UnsignedMSB4": ">I",
        "UnsignedByte": "B",
        "SignedByte": "b",
    }

    rows: list[dict[str, Any]] = []
    with open(filepath, "rb") as f:
        f.seek(file_offset + start * record_length)
        for _ in range(end - start):
            record_bytes = f.read(record_length)
            if len(record_bytes) < record_length:
                break

            row: dict[str, Any] = {}
            for field in fields:
                loc = (field.get("field_location") or 1) - 1
                dt = field.get("data_type", "UnsignedByte")
                fmt = type_to_struct.get(dt, "B")
                size = struct.calcsize(fmt)
                val = struct.unpack(fmt, record_bytes[loc : loc + size])[0]
                row[field["name"]] = float(val) if isinstance(val, (int, float)) else val

            rows.append(row)

    return rows


def _read_delimited_table(
    filepath: str,
    fields: list[dict[str, Any]],
    file_offset: int,
    start: int,
    end: int,
) -> list[dict[str, Any]]:
    """Read delimited (CSV-like) table data."""
    rows: list[dict[str, Any]] = []

    with open(filepath, "r", errors="replace") as f:
        f.seek(file_offset)
        for i, line in enumerate(f):
            if i < start:
                continue
            if i >= end:
                break
            values = line.strip().split(",")
            row: dict[str, Any] = {}
            for j, field in enumerate(fields):
                raw = values[j].strip().strip('"') if j < len(values) else ""
                row[field["name"]] = _coerce_value(raw, field.get("data_type", "ASCII_String"))
            rows.append(row)

    return rows


def _coerce_value(raw: str, data_type: str) -> int | float | str:
    """Coerce a raw string value to its appropriate Python type."""
    if not raw or raw.lower() in ("", "n/a", "null", "nan"):
        return None  # type: ignore[return-value]

    try:
        if "Real" in data_type or "Double" in data_type or "Single" in data_type:
            return float(raw)
        elif "Integer" in data_type:
            return int(raw)
    except (ValueError, TypeError):
        pass

    return raw


def read_array_data(structure: dict[str, Any]) -> np.ndarray:
    """Read array/image data from a PDS4 data file."""
    data_file = structure.get("data_file")
    if not data_file or not os.path.exists(data_file):
        raise FileNotFoundError(f"Data file not found: {data_file}")

    dimensions = structure.get("dimensions", [])
    element_type = structure.get("element_data_type", "IEEE754MSBSingle")
    file_offset = structure.get("offset", 0)

    numpy_dtype = PDS4_TO_NUMPY_DTYPE.get(element_type, ">f4")
    dt = np.dtype(numpy_dtype)
    total_elements = 1
    for d in dimensions:
        total_elements *= d

    with open(data_file, "rb") as f:
        f.seek(file_offset)
        data = np.frombuffer(f.read(total_elements * dt.itemsize), dtype=dt)

    return data.reshape(dimensions)


def _element_to_dict(element: etree._Element) -> dict[str, Any]:
    """Convert an lxml element tree to a nested dict for JSON serialization."""
    tag = etree.QName(element.tag).localname
    result: dict[str, Any] = {"tag": tag}

    if element.attrib:
        result["attributes"] = dict(element.attrib)

    children = list(element)
    if children:
        child_list = [_element_to_dict(c) for c in children]
        result["children"] = child_list
    elif element.text and element.text.strip():
        result["text"] = element.text.strip()

    return result
