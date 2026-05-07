import { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import { getPlotData, getTableMetadata } from "../services/api";
import type {
  PlotDataResponse,
  PlotSpec,
  TableMetadata,
} from "../services/api";

interface PlotPanelProps {
  labelId: string;
  structureIndex: number;
}

type PlotType = "histogram" | "line" | "scatter" | "heatmap";

const PLOT_TYPES: { value: PlotType; label: string }[] = [
  { value: "histogram", label: "Histogram" },
  { value: "line", label: "Line" },
  { value: "scatter", label: "Scatter" },
  { value: "heatmap", label: "Heatmap" },
];

export default function PlotPanel({
  labelId,
  structureIndex,
}: PlotPanelProps) {
  const [meta, setMeta] = useState<TableMetadata | null>(null);
  const [plotType, setPlotType] = useState<PlotType>("histogram");
  const [xCol, setXCol] = useState("");
  const [yCol, setYCol] = useState("");
  const [colorCol, setColorCol] = useState("");
  const [nbins, setNbins] = useState(30);
  const [plotData, setPlotData] = useState<PlotDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTableMetadata(labelId, structureIndex).then((m) => {
      setMeta(m);
      const numericFields = m.fields.filter(
        (f) =>
          f.data_type.includes("Real") || f.data_type.includes("Integer"),
      );
      if (numericFields.length > 0 && numericFields[0]) {
        setXCol(numericFields[0].name);
      }
      if (numericFields.length > 1 && numericFields[1]) {
        setYCol(numericFields[1].name);
      }
    });
  }, [labelId, structureIndex]);

  const numericFields =
    meta?.fields.filter(
      (f) => f.data_type.includes("Real") || f.data_type.includes("Integer"),
    ) ?? [];

  const needsY = plotType !== "histogram";

  const handlePlot = async () => {
    if (!xCol) return;
    if (needsY && !yCol) return;

    setLoading(true);
    setError(null);
    try {
      const spec: PlotSpec = {
        plot_type: plotType,
        x_column: xCol,
        ...(needsY ? { y_column: yCol } : {}),
        ...(colorCol && plotType === "scatter"
          ? { color_column: colorCol }
          : {}),
        ...(plotType === "histogram" ? { nbins } : {}),
      };
      const result = await getPlotData(labelId, structureIndex, spec);
      setPlotData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plot failed");
    } finally {
      setLoading(false);
    }
  };

  if (!meta) {
    return (
      <div className="flex items-center justify-center h-64 text-nasa-gray-400">
        Loading metadata...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="card">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Plot type */}
          <div>
            <label className="block text-xs text-nasa-gray-400 mb-1">
              Plot Type
            </label>
            <select
              className="input-field text-sm"
              value={plotType}
              onChange={(e) => setPlotType(e.target.value as PlotType)}
            >
              {PLOT_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>
                  {pt.label}
                </option>
              ))}
            </select>
          </div>

          {/* X column */}
          <div>
            <label className="block text-xs text-nasa-gray-400 mb-1">
              {plotType === "histogram" ? "Column" : "X Axis"}
            </label>
            <select
              className="input-field text-sm"
              value={xCol}
              onChange={(e) => setXCol(e.target.value)}
            >
              <option value="">Select...</option>
              {numericFields.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name}
                  {f.unit ? ` (${f.unit})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Y column */}
          {needsY && (
            <div>
              <label className="block text-xs text-nasa-gray-400 mb-1">
                Y Axis
              </label>
              <select
                className="input-field text-sm"
                value={yCol}
                onChange={(e) => setYCol(e.target.value)}
              >
                <option value="">Select...</option>
                {numericFields.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                    {f.unit ? ` (${f.unit})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Color column for scatter */}
          {plotType === "scatter" && (
            <div>
              <label className="block text-xs text-nasa-gray-400 mb-1">
                Color By
              </label>
              <select
                className="input-field text-sm"
                value={colorCol}
                onChange={(e) => setColorCol(e.target.value)}
              >
                <option value="">None</option>
                {numericFields.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Bins for histogram */}
          {plotType === "histogram" && (
            <div>
              <label className="block text-xs text-nasa-gray-400 mb-1">
                Bins
              </label>
              <input
                type="number"
                className="input-field text-sm w-20"
                value={nbins}
                min={5}
                max={200}
                onChange={(e) => setNbins(Number(e.target.value))}
              />
            </div>
          )}

          <button
            className="btn-primary text-sm"
            onClick={handlePlot}
            disabled={loading || !xCol || (needsY && !yCol)}
          >
            {loading ? "Generating..." : "Generate Plot"}
          </button>
        </div>
      </div>

      {error && <p className="text-nasa-red text-sm">{error}</p>}

      {/* Plot display */}
      {plotData && (
        <div className="card p-2">
          <Plot
            data={plotData.data.traces}
            layout={{
              ...plotData.layout,
              paper_bgcolor: "#212121",
              plot_bgcolor: "#303030",
              font: { color: "#E0E0E0", family: "Public Sans" },
              margin: { t: 40, r: 20, b: 50, l: 60 },
              xaxis: {
                ...plotData.layout.xaxis,
                gridcolor: "#424242",
                zerolinecolor: "#616161",
              },
              yaxis: {
                ...plotData.layout.yaxis,
                gridcolor: "#424242",
                zerolinecolor: "#616161",
              },
            }}
            config={{
              responsive: true,
              displaylogo: false,
              modeBarButtonsToRemove: ["lasso2d", "select2d"],
            }}
            style={{ width: "100%", height: "500px" }}
          />
        </div>
      )}
    </div>
  );
}
