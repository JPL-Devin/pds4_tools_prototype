import { useCallback, useRef, useState } from "react";
import { uploadLabel } from "../services/api";
import type { LabelUploadResponse } from "../services/api";

interface FileUploadProps {
  onSuccess: (result: LabelUploadResponse) => void;
}

const LABEL_EXTS = new Set(["xml", "lblx"]);

function getExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export default function FileUpload({ onSuccess }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [dataFiles, setDataFiles] = useState<File[]>([]);

  const categorizeFiles = useCallback((files: File[]) => {
    let label: File | null = null;
    const data: File[] = [];

    for (const file of files) {
      if (LABEL_EXTS.has(getExt(file.name))) {
        if (!label) label = file;
      } else {
        data.push(file);
      }
    }

    if (label) {
      setLabelFile(label);
      setDataFiles(data);
      setError(null);
    } else if (files.length > 0) {
      setError("No .xml or .lblx label file found in selection");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const items = e.dataTransfer.items;
      if (items && items.length > 0) {
        const entries: FileSystemEntry[] = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const entry = item?.webkitGetAsEntry?.();
          if (entry) entries.push(entry);
        }

        if (entries.some((e) => e.isDirectory)) {
          readDirectoryEntries(entries).then(categorizeFiles);
          return;
        }
      }

      const files = Array.from(e.dataTransfer.files);
      categorizeFiles(files);
    },
    [categorizeFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      categorizeFiles(files);
      e.target.value = "";
    },
    [categorizeFiles],
  );

  const handleUpload = async () => {
    if (!labelFile) return;
    setIsUploading(true);
    setError(null);
    try {
      const result = await uploadLabel(labelFile, dataFiles);
      onSuccess(result);
      setLabelFile(null);
      setDataFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-heading font-semibold text-nasa-gray-200 uppercase tracking-wider">
        Upload Label
      </h2>
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-nasa-blue bg-nasa-blue/10"
            : "border-nasa-gray-600 hover:border-nasa-gray-400"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <p className="text-sm text-nasa-gray-400">
          Drop label + data files here
        </p>
        <p className="text-xs text-nasa-gray-500 mt-1">
          Select all files referenced by the label, or drop a folder
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {labelFile && (
        <div className="text-xs text-nasa-gray-300 space-y-1">
          <p>
            Label: <span className="text-white">{labelFile.name}</span>
          </p>
          {dataFiles.length > 0 ? (
            <p>
              Data:{" "}
              <span className="text-white">
                {dataFiles.map((f) => f.name).join(", ")}
              </span>
            </p>
          ) : (
            <p className="text-red-400">
              No data files selected — data files are required alongside the label
            </p>
          )}
        </div>
      )}

      {labelFile && (
        <button
          className="btn-primary w-full text-sm"
          onClick={handleUpload}
          disabled={isUploading}
        >
          {isUploading ? "Parsing..." : "Parse Label"}
        </button>
      )}

      {error && <p className="text-nasa-red text-xs">{error}</p>}
    </div>
  );
}

async function readDirectoryEntries(entries: FileSystemEntry[]): Promise<File[]> {
  const files: File[] = [];

  async function readEntry(entry: FileSystemEntry): Promise<void> {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve) =>
        (entry as FileSystemFileEntry).file(resolve),
      );
      files.push(file);
    } else if (entry.isDirectory) {
      const dirReader = (entry as FileSystemDirectoryEntry).createReader();
      const children = await new Promise<FileSystemEntry[]>((resolve) =>
        dirReader.readEntries(resolve),
      );
      for (const child of children) {
        await readEntry(child);
      }
    }
  }

  for (const entry of entries) {
    await readEntry(entry);
  }
  return files;
}
