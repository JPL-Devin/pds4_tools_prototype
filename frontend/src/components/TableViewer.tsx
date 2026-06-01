import { useEffect, useState } from "react";
import { getTableData, getTableMetadata } from "../services/api";
import type { TableDataResponse, TableMetadata } from "../services/api";

interface TableViewerProps {
  labelId: string;
  structureIndex: number;
}

export default function TableViewer({
  labelId,
  structureIndex,
}: TableViewerProps) {
  const [meta, setMeta] = useState<TableMetadata | null>(null);
  const [tableData, setTableData] = useState<TableDataResponse | null>(null);
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pageSize = 100;

  useEffect(() => {
    setPage(0);
    setSortCol(null);
    setMeta(null);
    setTableData(null);
    setError(null);
    setLoading(true);

    Promise.all([
      getTableMetadata(labelId, structureIndex),
      getTableData(labelId, structureIndex, 0, pageSize),
    ])
      .then(([m, d]) => {
        setMeta(m);
        setTableData(d);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [labelId, structureIndex]);

  useEffect(() => {
    if (page === 0) return;
    setLoading(true);
    getTableData(labelId, structureIndex, page * pageSize, pageSize)
      .then(setTableData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, labelId, structureIndex]);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  const sortedData = () => {
    if (!tableData?.data || !sortCol) return tableData?.data ?? [];
    return [...tableData.data].sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const na = Number(va);
      const nb = Number(vb);
      if (!isNaN(na) && !isNaN(nb)) {
        return sortAsc ? na - nb : nb - na;
      }
      const sa = String(va);
      const sb = String(vb);
      return sortAsc ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  };

  if (error) {
    return (
      <div className="card border-red-200 dark:border-nasa-red/30 bg-red-50 dark:bg-nasa-red/5 text-red-600 dark:text-nasa-red">
        {error}
      </div>
    );
  }

  if (!meta || !tableData) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 dark:text-nasa-gray-400">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-gray-300 dark:border-nasa-gray-600 border-t-nasa-blue rounded-full animate-spin mx-auto mb-3" />
          Loading table data...
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(tableData.total_records / pageSize);
  const rows = sortedData();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-heading font-semibold text-gray-900 dark:text-white">
            {meta.name}
          </h2>
          <p className="text-sm text-gray-500 dark:text-nasa-gray-400 mt-0.5">
            {meta.record_count.toLocaleString()} records · {meta.fields.length}{" "}
            fields · {meta.structure_type}
          </p>
        </div>
        <a
          href={`/api/tables/${labelId}/${structureIndex}/data?format=csv&limit=${meta.record_count}`}
          className="btn-secondary text-sm"
          download
        >
          Export CSV
        </a>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-300px)]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-nasa-gray-800 sticky top-0 z-10">
              <tr>
                {tableData.columns.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-nasa-gray-300 uppercase tracking-wider cursor-pointer hover:text-gray-900 dark:hover:text-white select-none whitespace-nowrap transition-colors"
                    onClick={() => handleSort(col)}
                  >
                    {col}
                    {sortCol === col && (
                      <span className="ml-1.5 text-nasa-blue">
                        {sortAsc ? "\u25B2" : "\u25BC"}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-nasa-gray-700/40">
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className="hover:bg-gray-50 dark:hover:bg-nasa-gray-800/40 transition-colors"
                >
                  {tableData.columns.map((col) => {
                    const val = row[col];
                    const isNum = typeof val === "number";
                    return (
                      <td
                        key={col}
                        className={`px-4 py-2 whitespace-nowrap text-gray-700 dark:text-nasa-gray-200 ${
                          isNum ? "font-mono text-right tabular-nums" : ""
                        }`}
                      >
                        {val != null ? String(val) : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-500 dark:text-nasa-gray-400">
            Showing {page * pageSize + 1}–
            {Math.min((page + 1) * pageSize, tableData.total_records)} of{" "}
            {tableData.total_records.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary text-xs"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              Previous
            </button>
            <span className="px-3 py-1 text-gray-400 dark:text-nasa-gray-400 text-xs">
              {page + 1} / {totalPages}
            </span>
            <button
              className="btn-secondary text-xs"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center text-gray-400 dark:text-nasa-gray-400 text-sm">
          Loading...
        </div>
      )}
    </div>
  );
}
