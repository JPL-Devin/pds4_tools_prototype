import { useCallback, useEffect, useState } from "react";
import {
  browseDirectory,
  getStorageSources,
  openLabelFromStorage,
} from "../services/api";
import type {
  BrowseResponse,
  FileEntry,
  LabelUploadResponse,
  StorageSource,
} from "../services/api";

interface FileBrowserProps {
  onLabelOpened: (result: LabelUploadResponse) => void;
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function FileBrowser({ onLabelOpened }: FileBrowserProps) {
  const [sources, setSources] = useState<StorageSource[]>([]);
  const [activeSource, setActiveSource] = useState("local");
  const [browseData, setBrowseData] = useState<BrowseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  // Load sources on mount
  useEffect(() => {
    getStorageSources()
      .then((s) => {
        setSources(s);
        if (s.length > 0 && s[0]) setActiveSource(s[0].name);
      })
      .catch(() => {});
  }, []);

  // Browse when source changes
  const browse = useCallback(
    async (path?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await browseDirectory(activeSource, path);
        setBrowseData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Browse failed");
      } finally {
        setLoading(false);
      }
    },
    [activeSource],
  );

  useEffect(() => {
    browse();
  }, [browse]);

  const handleEntryClick = (entry: FileEntry) => {
    if (entry.is_dir) {
      browse(entry.path);
    }
  };

  const handleOpenLabel = async (entry: FileEntry) => {
    setOpening(entry.path);
    setError(null);
    try {
      const result = await openLabelFromStorage(activeSource, entry.path);
      onLabelOpened(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open label");
    } finally {
      setOpening(null);
    }
  };

  const handleNavigateUp = () => {
    if (browseData?.parent_path) {
      browse(browseData.parent_path);
    }
  };

  // Build breadcrumb from current_path
  const breadcrumbs = (() => {
    if (!browseData) return [];
    const path = browseData.current_path;
    if (path.startsWith("s3://")) {
      const parts = path.replace("s3://", "").split("/").filter(Boolean);
      const crumbs: { label: string; path: string }[] = [];
      for (let i = 0; i < parts.length; i++) {
        crumbs.push({
          label: parts[i]!,
          path: "s3://" + parts.slice(0, i + 1).join("/"),
        });
      }
      return crumbs;
    }
    // Local path
    const parts = path.split("/").filter(Boolean);
    const crumbs: { label: string; path: string }[] = [];
    for (let i = 0; i < parts.length; i++) {
      crumbs.push({
        label: parts[i]!,
        path: "/" + parts.slice(0, i + 1).join("/"),
      });
    }
    return crumbs;
  })();

  return (
    <div className="space-y-4">
      {/* Source selector */}
      {sources.length > 1 && (
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500 dark:text-nasa-gray-400 font-medium">
            Source:
          </label>
          <div className="flex gap-1.5">
            {sources.map((s) => (
              <button
                key={s.name}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
                  activeSource === s.name
                    ? "bg-nasa-blue text-white"
                    : "bg-gray-100 dark:bg-nasa-gray-700/60 text-gray-600 dark:text-nasa-gray-300 hover:bg-gray-200 dark:hover:bg-nasa-gray-600/60"
                }`}
                onClick={() => setActiveSource(s.name)}
              >
                {s.name === "local" ? "Local Files" : s.name === "s3" ? "S3 Bucket" : s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Breadcrumb navigation */}
      {browseData && (
        <div className="flex items-center gap-1 text-sm overflow-x-auto pb-1">
          <button
            className="text-gray-400 dark:text-nasa-gray-400 hover:text-gray-600 dark:hover:text-nasa-gray-200 transition-colors flex-shrink-0"
            onClick={() => browse()}
            title="Go to root"
          >
            {activeSource === "s3" ? "S3" : "/"}
          </button>
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-1 flex-shrink-0">
              <span className="text-gray-300 dark:text-nasa-gray-600">/</span>
              {i < breadcrumbs.length - 1 ? (
                <button
                  className="text-gray-500 dark:text-nasa-gray-300 hover:text-nasa-blue dark:hover:text-nasa-blue-light transition-colors"
                  onClick={() => browse(crumb.path)}
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-gray-800 dark:text-white font-medium">
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-nasa-red bg-red-50 dark:bg-nasa-red/5 border border-red-200 dark:border-nasa-red/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* File listing */}
      <div className="card p-0 overflow-hidden">
        {loading && !browseData ? (
          <div className="flex items-center justify-center py-12 text-gray-400 dark:text-nasa-gray-400">
            <div className="text-center">
              <div className="w-5 h-5 border-2 border-gray-300 dark:border-nasa-gray-600 border-t-nasa-blue rounded-full animate-spin mx-auto mb-2" />
              <span className="text-sm">Loading...</span>
            </div>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {/* Parent directory */}
            {browseData?.parent_path && (
              <button
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-nasa-gray-800/40 transition-colors border-b border-gray-100 dark:border-nasa-gray-700/30"
                onClick={handleNavigateUp}
              >
                <span className="w-5 h-5 flex items-center justify-center text-gray-400 dark:text-nasa-gray-400">
                  ..
                </span>
                <span className="text-gray-500 dark:text-nasa-gray-300">
                  Parent directory
                </span>
              </button>
            )}

            {/* Entries */}
            {browseData?.entries.map((entry) => (
              <div
                key={entry.path}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm border-b border-gray-100 dark:border-nasa-gray-700/20 last:border-0 transition-colors ${
                  entry.is_dir
                    ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-nasa-gray-800/40"
                    : entry.is_label
                      ? "hover:bg-nasa-blue/5 dark:hover:bg-nasa-blue/10"
                      : ""
                }`}
                onClick={() => entry.is_dir && handleEntryClick(entry)}
              >
                {/* Icon */}
                <span
                  className={`w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs ${
                    entry.is_dir
                      ? "text-yellow-500 dark:text-yellow-400"
                      : entry.is_label
                        ? "text-nasa-blue"
                        : "text-gray-400 dark:text-nasa-gray-500"
                  }`}
                >
                  {entry.is_dir ? "\uD83D\uDCC1" : entry.is_label ? "\uD83C\uDFF7\uFE0F" : "\uD83D\uDCC4"}
                </span>

                {/* Name */}
                <span
                  className={`flex-1 truncate ${
                    entry.is_dir
                      ? "text-gray-800 dark:text-nasa-gray-100 font-medium"
                      : entry.is_label
                        ? "text-nasa-blue dark:text-nasa-blue-light font-medium"
                        : "text-gray-600 dark:text-nasa-gray-300"
                  }`}
                >
                  {entry.name}
                </span>

                {/* Size */}
                {!entry.is_dir && entry.size != null && (
                  <span className="text-xs text-gray-400 dark:text-nasa-gray-500 flex-shrink-0">
                    {formatSize(entry.size)}
                  </span>
                )}

                {/* Open button for labels */}
                {entry.is_label && (
                  <button
                    className="btn-primary text-xs py-1 px-3 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenLabel(entry);
                    }}
                    disabled={opening === entry.path}
                  >
                    {opening === entry.path ? "Opening..." : "Open"}
                  </button>
                )}
              </div>
            ))}

            {browseData?.entries.length === 0 && (
              <div className="py-8 text-center text-gray-400 dark:text-nasa-gray-400 text-sm">
                Empty directory
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
