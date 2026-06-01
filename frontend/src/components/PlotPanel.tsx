import { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import { getPlotData, getTableMetadata } from "../services/api";
import { useTheme } from "../ThemeContext";
import type {
  FieldInfo,
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
  const [xColIdx, setXColIdx] = useState<number | "">("");
  const [yColIdx, setYColIdx] = useState<number | "">("");
  const [colorColIdx, setColorColIdx] = useState<number | "">("");
  const [nbins, setNbins] = useState(30);
  const [plotData, setPlotData] = useState<PlotDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    getTableMetadata(labelId, structureIndex).then((m) => {
      setMeta(m);
      const numericIndices = m.fields
        .map((f, i) => ({ f, i }))
        .filter(
          ({ f }) =>
            f.data_type.includes("Real") || f.data_type.includes("Integer"),
        )
        .map(({ i }) => i);
      if (numericIndices.length > 0) {
        setXColIdx(numericIndices[0]!);
      }
      if (numericIndices.length > 1) {
        setYColIdx(numericIndices[1]!);
      }
    });
  }, [labelId, structureIndex]);

  const numericFields: { field: FieldInfo; index: number }[] =
    meta?.fields
      .map((f, i) => ({ field: f, index: i }))
      .filter(
        ({ field }) =>
          field.data_type.includes("Real") ||
          field.data_type.includes("Integer"),
      ) ?? [];

  const needsY = plotType !== "histogram";

  const handlePlot = async () => {
    if (xColIdx === "") return;
    if (needsY && yColIdx === "") return;

    setLoading(true);
    setError(null);
    try {
      const spec: PlotSpec = {
        plot_type: plotType,
        x_column: xColIdx as number,
        ...(needsY ? { y_column: yColIdx as number } : {}),
        ...(colorColIdx !== "" && plotType === "scatter"
          ? { color_column: colorColIdx as number }
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

  const isDark = theme === "dark";
  const plotColors = isDark
    ? { paper: "#2E3F54", plot: "#1F2F42", font: "#D0D7E0", grid: "#3D4F65", zero: "#516175" }
    : { paper: "#FFFFFF", plot: "#F9FAFB", font: "#374151", grid: "#E5E7EB", zero: "#D1D5DB" };

  const fieldLabel = (f: FieldInfo, idx: number): string => {
    const dupCount = meta?.fields.filter((ff) => ff.name === f.name).length ?? 1;
    const suffix = dupCount > 1 ? ` [${idx + 1}]` : "";
    return `${f.name}${suffix}${f.unit ? ` (${f.unit})` : ""}`;
  };

  if (!meta) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-nasa-gray-300">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-gray-300 dark:border-nasa-gray-600 border-t-nasa-blue rounded-full animate-spin mx-auto mb-3" />
          Loading metadata...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="card">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Plot type */}
          <div>
            <label className="block text-xs text-gray-600 dark:text-nasa-gray-300 mb-1.5 font-medium">
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
            <label className="block text-xs text-gray-600 dark:text-nasa-gray-300 mb-1.5 font-medium">
              {plotType === "histogram" ? "Column" : "X Axis"}
            </label>
            <select
              className="input-field text-sm"
              value={xColIdx}
              onChange={(e) =>
                setXColIdx(e.target.value === "" ? "" : Number(e.target.value))
              }
            >
              <option value="">Select...</option>
              {numericFields.map(({ field, index }) => (
                <option key={index} value={index}>
                  {fieldLabel(field, index)}
                </option>
              ))}
            </select>
          </div>

          {/* Y column */}
          {needsY && (
            <div>
              <label className="block text-xs text-gray-600 dark:text-nasa-gray-300 mb-1.5 font-medium">
                Y Axis
              </label>
              <select
                className="input-field text-sm"
                value={yColIdx}
                onChange={(e) =>
                  setYColIdx(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
              >
                <option value="">Select...</option>
                {numericFields.map(({ field, index }) => (
                  <option key={index} value={index}>
                    {fieldLabel(field, index)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Color column for scatter */}
          {plotType === "scatter" && (
            <div>
              <label className="block text-xs text-gray-600 dark:text-nasa-gray-300 mb-1.5 font-medium">
                Color By
              </label>
              <select
                className="input-field text-sm"
                value={colorColIdx}
                onChange={(e) =>
                  setColorColIdx(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
              >
                <option value="">None</option>
                {numericFields.map(({ field, index }) => (
                  <option key={index} value={index}>
                    {fieldLabel(field, index)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Bins for histogram */}
          {plotType === "histogram" && (
            <div>
              <label className="block text-xs text-gray-600 dark:text-nasa-gray-300 mb-1.5 font-medium">
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
            disabled={loading || xColIdx === "" || (needsY && yColIdx === "")}
          >
            {loading ? "Generating..." : "Generate Plot"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-red-600 dark:text-nasa-red text-sm bg-red-50 dark:bg-nasa-red/5 border border-red-200 dark:border-nasa-red/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Plot display */}
      {plotData && (
        <div className="card p-2">
          <Plot
            data={plotData.data.traces}
            layout={{
              ...plotData.layout,
              paper_bgcolor: plotColors.paper,
              plot_bgcolor: plotColors.plot,
              font: { color: plotColors.font, family: "Public Sans" },
              margin: { t: 40, r: 20, b: 50, l: 60 },
              xaxis: {
                ...plotData.layout.xaxis,
                gridcolor: plotColors.grid,
                zerolinecolor: plotColors.zero,
              },
              yaxis: {
                ...plotData.layout.yaxis,
                gridcolor: plotColors.grid,
                zerolinecolor: plotColors.zero,
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
