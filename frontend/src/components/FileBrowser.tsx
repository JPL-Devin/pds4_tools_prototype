import { useCallback, useEffect, useRef, useState } from "react";
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

const LABEL_EXTS = new Set(["xml", "lblx"]);

function isLabelPath(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return LABEL_EXTS.has(ext);
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
  const [canScrollDown, setCanScrollDown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingPath, setEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState("");
  const pathInputRef = useRef<HTMLInputElement>(null);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
  }, []);

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

  // Re-check scroll state after data loads
  useEffect(() => {
    if (browseData) {
      // Small delay to ensure DOM has rendered
      requestAnimationFrame(checkScroll);
    }
  }, [browseData, checkScroll]);

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

  const startEditingPath = () => {
    setPathInput(browseData?.current_path ?? "/");
    setEditingPath(true);
    requestAnimationFrame(() => pathInputRef.current?.select());
  };

  const handlePathSubmit = async () => {
    const trimmed = pathInput.trim();
    setEditingPath(false);
    if (!trimmed) return;

    if (isLabelPath(trimmed)) {
      setOpening(trimmed);
      setError(null);
      try {
        const result = await openLabelFromStorage(activeSource, trimmed);
        onLabelOpened(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to open label");
      } finally {
        setOpening(null);
      }
    } else {
      browse(trimmed);
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
          <label className="text-xs text-gray-600 dark:text-nasa-gray-300 font-medium">
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

      {/* Editable path bar */}
      {browseData && (
        editingPath ? (
          <div className="flex items-center gap-1">
            <input
              ref={pathInputRef}
              type="text"
              className="input-field text-xs flex-1 font-mono py-1"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePathSubmit();
                if (e.key === "Escape") setEditingPath(false);
              }}
              onBlur={() => setEditingPath(false)}
              placeholder="Enter path to directory or label file..."
            />
            <button
              className="btn-primary text-[11px] py-1 px-2 flex-shrink-0"
              onMouseDown={(e) => {
                e.preventDefault();
                handlePathSubmit();
              }}
            >
              Go
            </button>
          </div>
        ) : (
          <div
            className="flex items-center gap-0.5 text-xs overflow-x-auto pb-0.5 cursor-text group rounded px-1 py-0.5 -mx-1 hover:bg-gray-100 dark:hover:bg-nasa-gray-800/40 transition-colors"
            onClick={startEditingPath}
            title="Click to edit path"
          >
            <button
              className="text-gray-500 dark:text-nasa-gray-300 hover:text-gray-700 dark:hover:text-nasa-gray-100 transition-colors flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                browse();
              }}
              title="Go to root"
            >
              {activeSource === "s3" ? "S3" : "/"}
            </button>
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-0.5 flex-shrink-0">
                <span className="text-gray-400 dark:text-nasa-gray-500">/</span>
                {i < breadcrumbs.length - 1 ? (
                  <button
                    className="text-gray-500 dark:text-nasa-gray-300 hover:text-nasa-blue dark:hover:text-nasa-blue-light transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      browse(crumb.path);
                    }}
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
            <span className="ml-auto text-gray-400 dark:text-nasa-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
              </svg>
            </span>
          </div>
        )
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-nasa-red bg-red-50 dark:bg-nasa-red/5 border border-red-200 dark:border-nasa-red/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* File listing */}
      <div className="card p-0 overflow-hidden relative">
        {loading && !browseData ? (
          <div className="flex items-center justify-center py-12 text-gray-500 dark:text-nasa-gray-300">
            <div className="text-center">
              <div className="w-5 h-5 border-2 border-gray-300 dark:border-nasa-gray-600 border-t-nasa-blue rounded-full animate-spin mx-auto mb-2" />
              <span className="text-sm">Loading...</span>
            </div>
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="max-h-96 overflow-y-auto scrollbar-visible"
            onScroll={checkScroll}
          >
            {/* Parent directory */}
            {browseData?.parent_path && (
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-nasa-gray-800/40 transition-colors border-b border-gray-100 dark:border-nasa-gray-700/30"
                onClick={handleNavigateUp}
              >
                <span className="w-4 h-4 flex items-center justify-center text-gray-500 dark:text-nasa-gray-300 text-[11px]">
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
                className={`flex items-center gap-2 px-3 py-1.5 text-xs border-b border-gray-100 dark:border-nasa-gray-700/20 last:border-0 transition-colors ${
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
                  className={`w-4 h-4 flex items-center justify-center flex-shrink-0 text-[11px] ${
                    entry.is_dir
                      ? "text-yellow-500 dark:text-yellow-400"
                      : entry.is_label
                        ? "text-nasa-blue"
                        : "text-gray-500 dark:text-nasa-gray-400"
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
                  <span className="text-[10px] text-gray-500 dark:text-nasa-gray-400 flex-shrink-0">
                    {formatSize(entry.size)}
                  </span>
                )}

                {/* Open button for labels */}
                {entry.is_label && (
                  <button
                    className="btn-primary text-[11px] py-0.5 px-2 flex-shrink-0"
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
              <div className="py-6 text-center text-gray-500 dark:text-nasa-gray-300 text-xs">
                Empty directory
              </div>
            )}
          </div>
        )}

        {/* Scroll fade indicator */}
        {canScrollDown && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white dark:from-nasa-gray-800 to-transparent pointer-events-none" />
        )}
      </div>

      {/* Item count */}
      {browseData && browseData.entries.length > 0 && (
        <p className="text-[10px] text-gray-500 dark:text-nasa-gray-400 text-right">
          {browseData.entries.length} items
          {canScrollDown && " · scroll for more"}
        </p>
      )}
    </div>
  );
}
