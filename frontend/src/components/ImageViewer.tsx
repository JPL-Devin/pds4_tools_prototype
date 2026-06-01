import { useCallback, useEffect, useRef, useState } from "react";
import {
  getImageMetadata,
  renderImage,
  getImageStatistics,
} from "../services/api";
import type { ImageMetadata, ImageStatistics } from "../services/api";

interface ImageViewerProps {
  labelId: string;
  structureIndex: number;
}

const COLORMAPS = [
  { value: "grayscale", label: "Grayscale" },
  { value: "viridis", label: "Viridis" },
  { value: "plasma", label: "Plasma" },
  { value: "inferno", label: "Inferno" },
  { value: "magma", label: "Magma" },
  { value: "cividis", label: "Cividis" },
  { value: "turbo", label: "Turbo" },
  { value: "hot", label: "Hot" },
];

const STRETCHES = [
  { value: "linear", label: "Linear" },
  { value: "log", label: "Log" },
  { value: "sqrt", label: "Square Root" },
  { value: "squared", label: "Squared" },
  { value: "histeq", label: "Histogram Eq." },
];

export default function ImageViewer({
  labelId,
  structureIndex,
}: ImageViewerProps) {
  const [meta, setMeta] = useState<ImageMetadata | null>(null);
  const [stats, setStats] = useState<ImageStatistics | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [colormap, setColormap] = useState("grayscale");
  const [stretch, setStretch] = useState("linear");
  const [percentileLow, setPercentileLow] = useState(1);
  const [percentileHigh, setPercentileHigh] = useState(99);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [pixelInfo, setPixelInfo] = useState<{
    x: number;
    y: number;
    value: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setMeta(null);
    setStats(null);
    setImageSrc(null);
    setError(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });

    Promise.all([
      getImageMetadata(labelId, structureIndex),
      getImageStatistics(labelId, structureIndex),
    ])
      .then(([m, s]) => {
        setMeta(m);
        setStats(s);
      })
      .catch((err) => setError(err.message));
  }, [labelId, structureIndex]);

  const loadImage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const blob = await renderImage(labelId, structureIndex, {
        colormap,
        stretch,
        percentile_low: percentileLow,
        percentile_high: percentileHigh,
      });
      const url = URL.createObjectURL(blob);
      setImageSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to render image");
    } finally {
      setLoading(false);
    }
  }, [labelId, structureIndex, colormap, stretch, percentileLow, percentileHigh]);

  useEffect(() => {
    if (meta) {
      loadImage();
    }
  }, [meta, loadImage]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setZoom((z) => Math.max(0.1, Math.min(z * factor, 20)));
    },
    [],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      }
      if (imgRef.current && meta) {
        const rect = imgRef.current.getBoundingClientRect();
        const px = Math.floor(
          ((e.clientX - rect.left) / rect.width) * meta.width,
        );
        const py = Math.floor(
          ((e.clientY - rect.top) / rect.height) * meta.height,
        );
        if (px >= 0 && px < meta.width && py >= 0 && py < meta.height) {
          setPixelInfo({ x: px, y: py, value: 0 });
        } else {
          setPixelInfo(null);
        }
      }
    },
    [isDragging, dragStart, meta],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleResetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  if (error) {
    return (
      <div className="card border-red-200 dark:border-nasa-red/30 bg-red-50 dark:bg-nasa-red/5 text-red-600 dark:text-nasa-red">
        {error}
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-nasa-gray-300">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-gray-300 dark:border-nasa-gray-600 border-t-nasa-blue rounded-full animate-spin mx-auto mb-3" />
          Loading image metadata...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-heading font-semibold text-gray-900 dark:text-white">{meta.name}</h2>
          <p className="text-sm text-gray-600 dark:text-nasa-gray-300 mt-0.5">
            {meta.width} × {meta.height} · {meta.element_data_type} ·{" "}
            {meta.structure_type}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-600 dark:text-nasa-gray-300 mb-1.5 font-medium">
              Colormap
            </label>
            <select
              className="input-field text-sm"
              value={colormap}
              onChange={(e) => setColormap(e.target.value)}
            >
              {COLORMAPS.map((cm) => (
                <option key={cm.value} value={cm.value}>
                  {cm.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 dark:text-nasa-gray-300 mb-1.5 font-medium">
              Stretch
            </label>
            <select
              className="input-field text-sm"
              value={stretch}
              onChange={(e) => setStretch(e.target.value)}
            >
              {STRETCHES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 dark:text-nasa-gray-300 mb-1.5 font-medium">
              Low % Clip
            </label>
            <input
              type="number"
              className="input-field text-sm w-20"
              value={percentileLow}
              min={0}
              max={100}
              step={0.5}
              onChange={(e) => setPercentileLow(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 dark:text-nasa-gray-300 mb-1.5 font-medium">
              High % Clip
            </label>
            <input
              type="number"
              className="input-field text-sm w-20"
              value={percentileHigh}
              min={0}
              max={100}
              step={0.5}
              onChange={(e) => setPercentileHigh(Number(e.target.value))}
            />
          </div>

          <button
            className="btn-secondary text-sm"
            onClick={handleResetView}
          >
            Reset View
          </button>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-nasa-gray-700/30 flex flex-wrap gap-5 text-xs text-gray-600 dark:text-nasa-gray-300">
            <span>
              Min: <span className="text-gray-900 dark:text-white">{stats.min.toFixed(2)}</span>
            </span>
            <span>
              Max: <span className="text-gray-900 dark:text-white">{stats.max.toFixed(2)}</span>
            </span>
            <span>
              Mean: <span className="text-gray-900 dark:text-white">{stats.mean.toFixed(2)}</span>
            </span>
            <span>
              Std: <span className="text-gray-900 dark:text-white">{stats.std.toFixed(2)}</span>
            </span>
          </div>
        )}
      </div>

      {/* Image display */}
      <div
        ref={containerRef}
        className="card p-0 overflow-hidden relative cursor-grab active:cursor-grabbing"
        style={{ height: "calc(100vh - 400px)" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-nasa-gray-900/60 backdrop-blur-sm z-10">
            <div className="text-center">
              <div className="w-6 h-6 border-2 border-gray-300 dark:border-nasa-gray-600 border-t-nasa-blue rounded-full animate-spin mx-auto mb-2" />
              <span className="text-gray-600 dark:text-nasa-gray-300 text-sm">Rendering...</span>
            </div>
          </div>
        )}
        {imageSrc && (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
            }}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt={meta.name}
              className="max-w-full max-h-full object-contain"
              style={{ imageRendering: zoom > 2 ? "pixelated" : "auto" }}
              draggable={false}
            />
          </div>
        )}

        {/* Pixel info overlay */}
        {pixelInfo && (
          <div className="absolute bottom-2 left-2 bg-white/80 dark:bg-nasa-gray-900/80 backdrop-blur-sm text-xs text-gray-700 dark:text-nasa-gray-200 px-2.5 py-1.5 rounded-md font-mono border border-gray-200 dark:border-nasa-gray-700/30">
            ({pixelInfo.x}, {pixelInfo.y}) | Zoom: {(zoom * 100).toFixed(0)}%
          </div>
        )}
      </div>
    </div>
  );
}
