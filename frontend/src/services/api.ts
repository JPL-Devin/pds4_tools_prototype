const API_BASE = "/api";

/* ---- Browse / Storage Backend types ---- */

export interface StorageSource {
  name: string;
  root: string;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number | null;
  is_label: boolean;
}

export interface BrowseResponse {
  source: string;
  current_path: string;
  parent_path: string | null;
  entries: FileEntry[];
}

export async function getStorageSources(): Promise<StorageSource[]> {
  const resp = await fetch(`${API_BASE}/browse/sources`);
  if (!resp.ok) throw new Error("Failed to fetch storage sources");
  return resp.json();
}

export async function browseDirectory(
  source: string,
  path?: string,
): Promise<BrowseResponse> {
  const params = new URLSearchParams({ source });
  if (path) params.set("path", path);
  const resp = await fetch(`${API_BASE}/browse/list?${params}`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || "Failed to browse directory");
  }
  return resp.json();
}

export async function openLabelFromStorage(
  source: string,
  path: string,
): Promise<LabelUploadResponse> {
  const params = new URLSearchParams({ source, path });
  const resp = await fetch(`${API_BASE}/browse/open?${params}`, {
    method: "POST",
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || "Failed to open label");
  }
  return resp.json();
}

/* ---- Data types ---- */

export interface StructureSummary {
  index: number;
  name: string;
  local_identifier: string | null;
  structure_type: string;
  record_count: number | null;
  field_count: number | null;
  dimensions: number[] | null;
}

export interface LabelUploadResponse {
  label_id: string;
  filename: string;
  structures: StructureSummary[];
}

export interface LabelMetadata {
  label_id: string;
  filename: string;
  xml_tree: XmlNode;
}

export interface XmlNode {
  tag: string;
  text?: string;
  attributes?: Record<string, string>;
  children?: XmlNode[];
}

export interface FieldInfo {
  name: string;
  field_number: number;
  data_type: string;
  unit: string | null;
  description: string | null;
}

export interface TableMetadata {
  label_id: string;
  structure_index: number;
  name: string;
  structure_type: string;
  record_count: number;
  fields: FieldInfo[];
}

export interface TableDataResponse {
  label_id: string;
  structure_index: number;
  total_records: number;
  offset: number;
  limit: number;
  columns: string[];
  data: Record<string, unknown>[];
}

export interface PlotSpec {
  plot_type: "histogram" | "line" | "scatter" | "heatmap";
  x_column?: string;
  y_column?: string;
  color_column?: string;
  nbins?: number;
  title?: string;
}

export interface PlotDataResponse {
  plot_type: string;
  data: { traces: Plotly.Data[] };
  layout: Partial<Plotly.Layout>;
}

export interface ImageMetadata {
  label_id: string;
  structure_index: number;
  name: string;
  structure_type: string;
  dimensions: number[];
  element_data_type: string;
  width: number;
  height: number;
}

export interface ImageStatistics {
  min: number;
  max: number;
  mean: number;
  std: number;
  shape: number[];
  dtype: string;
  percentiles: Record<string, number>;
}

export interface ImageRenderParams {
  colormap?: string;
  stretch?: string;
  vmin?: number | null;
  vmax?: number | null;
  percentile_low?: number;
  percentile_high?: number;
  band?: number | null;
}

export async function uploadLabel(
  labelFile: File,
  dataFiles?: File[],
): Promise<LabelUploadResponse> {
  const form = new FormData();
  form.append("label_file", labelFile);
  if (dataFiles) {
    for (const df of dataFiles) {
      form.append("data_files", df);
    }
  }
  const resp = await fetch(`${API_BASE}/labels/upload`, {
    method: "POST",
    body: form,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || "Upload failed");
  }
  return resp.json();
}

export async function getLabels(): Promise<
  { label_id: string; filename: string }[]
> {
  const resp = await fetch(`${API_BASE}/labels`);
  if (!resp.ok) throw new Error("Failed to fetch labels");
  return resp.json();
}

export async function getLabelDetail(
  labelId: string,
): Promise<LabelMetadata> {
  const resp = await fetch(`${API_BASE}/labels/${labelId}`);
  if (!resp.ok) throw new Error("Failed to fetch label");
  return resp.json();
}

export async function getStructures(
  labelId: string,
): Promise<StructureSummary[]> {
  const resp = await fetch(`${API_BASE}/labels/${labelId}/structures`);
  if (!resp.ok) throw new Error("Failed to fetch structures");
  return resp.json();
}

export async function getTableMetadata(
  labelId: string,
  structureIndex: number,
): Promise<TableMetadata> {
  const resp = await fetch(
    `${API_BASE}/tables/${labelId}/${structureIndex}`,
  );
  if (!resp.ok) throw new Error("Failed to fetch table metadata");
  return resp.json();
}

export async function getTableData(
  labelId: string,
  structureIndex: number,
  offset = 0,
  limit = 100,
): Promise<TableDataResponse> {
  const resp = await fetch(
    `${API_BASE}/tables/${labelId}/${structureIndex}/data?offset=${offset}&limit=${limit}`,
  );
  if (!resp.ok) throw new Error("Failed to fetch table data");
  return resp.json();
}

export async function getPlotData(
  labelId: string,
  structureIndex: number,
  spec: PlotSpec,
): Promise<PlotDataResponse> {
  const resp = await fetch(
    `${API_BASE}/tables/${labelId}/${structureIndex}/plot`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spec),
    },
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || "Plot generation failed");
  }
  return resp.json();
}

export async function getImageMetadata(
  labelId: string,
  structureIndex: number,
): Promise<ImageMetadata> {
  const resp = await fetch(
    `${API_BASE}/images/${labelId}/${structureIndex}`,
  );
  if (!resp.ok) throw new Error("Failed to fetch image metadata");
  return resp.json();
}

export async function getImageStatistics(
  labelId: string,
  structureIndex: number,
): Promise<ImageStatistics> {
  const resp = await fetch(
    `${API_BASE}/images/${labelId}/${structureIndex}/statistics`,
  );
  if (!resp.ok) throw new Error("Failed to fetch image statistics");
  return resp.json();
}

export async function renderImage(
  labelId: string,
  structureIndex: number,
  params: ImageRenderParams,
): Promise<Blob> {
  const resp = await fetch(
    `${API_BASE}/images/${labelId}/${structureIndex}/render`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    },
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || "Image render failed");
  }
  return resp.blob();
}
