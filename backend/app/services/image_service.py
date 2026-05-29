"""Image rendering and statistics service."""
from __future__ import annotations

from typing import Any

import numpy as np

from app.models.schemas import ImageRenderParams

COLORMAPS = {
    "grayscale": None,
    "viridis": "viridis",
    "plasma": "plasma",
    "inferno": "inferno",
    "magma": "magma",
    "cividis": "cividis",
    "turbo": "turbo",
    "hot": "hot",
}


def get_image_statistics(data: np.ndarray) -> dict[str, Any]:
    """Compute summary statistics for image data."""
    flat = data.ravel().astype(float)
    valid = flat[np.isfinite(flat)]
    if len(valid) == 0:
        return {"min": 0, "max": 0, "mean": 0, "std": 0, "percentiles": {}}

    return {
        "min": float(np.min(valid)),
        "max": float(np.max(valid)),
        "mean": float(np.mean(valid)),
        "std": float(np.std(valid)),
        "shape": list(data.shape),
        "dtype": str(data.dtype),
        "percentiles": {
            "1": float(np.percentile(valid, 1)),
            "5": float(np.percentile(valid, 5)),
            "25": float(np.percentile(valid, 25)),
            "50": float(np.percentile(valid, 50)),
            "75": float(np.percentile(valid, 75)),
            "95": float(np.percentile(valid, 95)),
            "99": float(np.percentile(valid, 99)),
        },
    }


def render_image(data: np.ndarray, params: ImageRenderParams) -> bytes:
    """Render a 2D numpy array to PNG bytes with the specified visualization params."""
    if data.ndim == 1:
        side = int(np.sqrt(len(data)))
        data = data.reshape(side, -1)
    elif data.ndim > 2:
        data = data[0] if data.shape[0] <= data.shape[-1] else data[:, :, 0]

    img = data.astype(np.float64)

    vmin = params.vmin
    vmax = params.vmax
    if vmin is None or vmax is None:
        valid = img[np.isfinite(img)]
        if len(valid) == 0:
            return _empty_png(img.shape)
        if vmin is None:
            vmin = float(np.percentile(valid, params.percentile_low))
        if vmax is None:
            vmax = float(np.percentile(valid, params.percentile_high))

    img = np.clip(img, vmin, vmax)

    if vmax > vmin:
        img = (img - vmin) / (vmax - vmin)
    else:
        img = np.zeros_like(img)

    img = _apply_stretch(img, params.stretch)
    img = _apply_colormap(img, params.colormap)

    return _array_to_png(img)


def _apply_stretch(normalized: np.ndarray, stretch: str) -> np.ndarray:
    """Apply a stretch function to normalized [0,1] data."""
    if stretch == "linear":
        return normalized
    elif stretch == "log":
        return np.log1p(normalized * 9) / np.log(10)
    elif stretch == "sqrt":
        return np.sqrt(normalized)
    elif stretch == "squared":
        return normalized ** 2
    elif stretch == "histeq":
        return _histogram_equalize(normalized)
    return normalized


def _histogram_equalize(data: np.ndarray) -> np.ndarray:
    """Apply histogram equalization to normalized data."""
    flat = data.ravel()
    nbins = 256
    hist, bin_edges = np.histogram(flat, bins=nbins, range=(0, 1))
    cdf = hist.cumsum().astype(float)
    cdf_min = cdf[cdf > 0].min() if np.any(cdf > 0) else 0
    total = cdf[-1]
    if total > cdf_min:
        cdf = (cdf - cdf_min) / (total - cdf_min)
    else:
        cdf = np.zeros_like(cdf)
    indices = np.clip((flat * (nbins - 1)).astype(int), 0, nbins - 1)
    return cdf[indices].reshape(data.shape)


def _apply_colormap(normalized: np.ndarray, colormap: str) -> np.ndarray:
    """Apply a colormap to normalized [0,1] data, returning an RGB uint8 array."""
    if colormap == "grayscale" or colormap not in COLORMAPS:
        gray = (normalized * 255).astype(np.uint8)
        return np.stack([gray, gray, gray], axis=-1)

    try:
        import matplotlib
        cmap = matplotlib.colormaps.get_cmap(COLORMAPS[colormap])
        rgba = cmap(normalized)
        return (rgba[:, :, :3] * 255).astype(np.uint8)
    except ImportError:
        gray = (normalized * 255).astype(np.uint8)
        return np.stack([gray, gray, gray], axis=-1)


def _array_to_png(rgb: np.ndarray) -> bytes:
    """Convert an RGB uint8 array to PNG bytes."""
    import struct
    import zlib

    height, width = rgb.shape[:2]
    raw_rows = []
    for y in range(height):
        raw_rows.append(b"\x00" + rgb[y].tobytes())
    raw_data = b"".join(raw_rows)

    def _chunk(chunk_type: bytes, data: bytes) -> bytes:
        c = chunk_type + data
        crc = zlib.crc32(c) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + c + struct.pack(">I", crc)

    signature = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    idat_data = zlib.compress(raw_data, 6)

    return signature + _chunk(b"IHDR", ihdr_data) + _chunk(b"IDAT", idat_data) + _chunk(b"IEND", b"")


def _empty_png(shape: tuple[int, ...]) -> bytes:
    """Generate a black PNG for empty/invalid data."""
    h = shape[0] if len(shape) >= 1 else 1
    w = shape[1] if len(shape) >= 2 else 1
    black = np.zeros((h, w, 3), dtype=np.uint8)
    return _array_to_png(black)
