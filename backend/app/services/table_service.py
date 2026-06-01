"""Table data service for generating plot-ready data from PDS4 tables."""
from __future__ import annotations

import math
from typing import Any

import numpy as np


def compute_histogram(
    data: list[list[Any]],
    column_index: int,
    column_name: str,
    nbins: int = 30,
) -> dict[str, Any]:
    """Compute histogram data for a numeric column."""
    values = _extract_numeric(data, column_index)
    if not values:
        return {"data": [], "layout": {}}

    arr = np.array(values, dtype=float)
    arr = arr[np.isfinite(arr)]
    if len(arr) == 0:
        return {"data": [], "layout": {}}

    return {
        "data": [{
            "type": "histogram",
            "x": arr.tolist(),
            "nbinsx": nbins,
            "marker": {"color": "#1052A5"},
        }],
        "layout": {
            "title": f"Histogram of {column_name}",
            "xaxis": {"title": column_name},
            "yaxis": {"title": "Count"},
        },
    }


def compute_line_plot(
    data: list[list[Any]],
    x_index: int,
    y_index: int,
    x_name: str,
    y_name: str,
) -> dict[str, Any]:
    """Compute line plot data for two columns."""
    x_vals = _extract_values(data, x_index)
    y_vals = _extract_values(data, y_index)

    if not x_vals or not y_vals:
        return {"data": [], "layout": {}}

    min_len = min(len(x_vals), len(y_vals))
    x_vals = x_vals[:min_len]
    y_vals = y_vals[:min_len]

    return {
        "data": [{
            "type": "scatter",
            "mode": "lines",
            "x": x_vals,
            "y": y_vals,
            "line": {"color": "#1052A5", "width": 2},
        }],
        "layout": {
            "title": f"{y_name} vs {x_name}",
            "xaxis": {"title": x_name},
            "yaxis": {"title": y_name},
        },
    }


def compute_scatter_plot(
    data: list[list[Any]],
    x_index: int,
    y_index: int,
    x_name: str,
    y_name: str,
    color_index: int | None = None,
    color_name: str | None = None,
) -> dict[str, Any]:
    """Compute scatter plot data for two columns."""
    x_vals = _extract_values(data, x_index)
    y_vals = _extract_values(data, y_index)

    if not x_vals or not y_vals:
        return {"data": [], "layout": {}}

    min_len = min(len(x_vals), len(y_vals))
    x_vals = x_vals[:min_len]
    y_vals = y_vals[:min_len]

    trace: dict[str, Any] = {
        "type": "scatter",
        "mode": "markers",
        "x": x_vals,
        "y": y_vals,
        "marker": {"color": "#1052A5", "size": 5, "opacity": 0.7},
    }

    if color_index is not None:
        c_vals = _extract_numeric(data, color_index)
        if c_vals:
            trace["marker"]["color"] = c_vals[:min_len]
            trace["marker"]["colorscale"] = "Viridis"
            trace["marker"]["showscale"] = True
            trace["marker"]["colorbar"] = {"title": color_name or f"Column {color_index}"}

    return {
        "data": [trace],
        "layout": {
            "title": f"{y_name} vs {x_name}",
            "xaxis": {"title": x_name},
            "yaxis": {"title": y_name},
        },
    }


def compute_heatmap(
    data: list[list[Any]],
    x_index: int,
    y_index: int,
    x_name: str,
    y_name: str,
    nbins: int = 50,
) -> dict[str, Any]:
    """Compute 2D histogram / heatmap for two columns."""
    x_vals = _extract_numeric(data, x_index)
    y_vals = _extract_numeric(data, y_index)

    if not x_vals or not y_vals:
        return {"data": [], "layout": {}}

    min_len = min(len(x_vals), len(y_vals))
    x_arr = np.array(x_vals[:min_len], dtype=float)
    y_arr = np.array(y_vals[:min_len], dtype=float)

    mask = np.isfinite(x_arr) & np.isfinite(y_arr)
    x_arr = x_arr[mask]
    y_arr = y_arr[mask]

    if len(x_arr) == 0:
        return {"data": [], "layout": {}}

    return {
        "data": [{
            "type": "histogram2d",
            "x": x_arr.tolist(),
            "y": y_arr.tolist(),
            "nbinsx": nbins,
            "nbinsy": nbins,
            "colorscale": "Viridis",
        }],
        "layout": {
            "title": f"Heatmap: {y_name} vs {x_name}",
            "xaxis": {"title": x_name},
            "yaxis": {"title": y_name},
        },
    }


def _extract_numeric(data: list[list[Any]], column_index: int) -> list[float]:
    """Extract numeric values from a column by index, skipping non-numeric entries."""
    values: list[float] = []
    for row in data:
        if column_index >= len(row):
            continue
        val = row[column_index]
        if val is None:
            continue
        try:
            fval = float(val)
            if math.isfinite(fval):
                values.append(fval)
        except (ValueError, TypeError):
            continue
    return values


def _extract_values(data: list[list[Any]], column_index: int) -> list[Any]:
    """Extract values from a column, keeping original types (string, numeric, etc.)."""
    values: list[Any] = []
    for row in data:
        if column_index >= len(row):
            continue
        val = row[column_index]
        if val is None:
            continue
        # Try numeric first
        try:
            fval = float(val)
            if math.isfinite(fval):
                values.append(fval)
                continue
        except (ValueError, TypeError):
            pass
        # Keep as string (e.g. datetime values)
        values.append(str(val).strip())
    return values
