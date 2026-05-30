import { useCallback, useRef, useState, useEffect } from "react";
import { uploadLabel } from "../services/api";
import type { LabelUploadResponse } from "../services/api";

interface FileUploadProps {
  onSuccess: (result: LabelUploadResponse) => void;
}

const LABEL_EXTS = new Set(["xml", "lblx"]);

function getExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

/** Parse a PDS4 label XML string and return all referenced file_name values. */
function extractReferencedFiles(xmlText: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const fileNames: string[] = [];

  // Find all <file_name> elements regardless of namespace
  const allElements = doc.getElementsByTagName("*");
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements.item(i);
    if (el && el.localName === "file_name" && el.textContent) {
      fileNames.push(el.textContent.trim());
    }
  }

  // Deduplicate
  return [...new Set(fileNames)];
}

export default function FileUpload({ onSuccess }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);
  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [dataFiles, setDataFiles] = useState<File[]>([]);
  const [referencedFiles, setReferencedFiles] = useState<string[]>([]);

  // When a label file is selected, parse it to find referenced data files
  useEffect(() => {
    if (!labelFile) {
      setReferencedFiles([]);
      return;
    }
    labelFile.text().then((text) => {
      const refs = extractReferencedFiles(text);
      setReferencedFiles(refs);
    });
  }, [labelFile]);

  const addDataFiles = useCallback((files: File[]) => {
    setDataFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      const newFiles = files.filter((f) => !existing.has(f.name));
      return [...prev, ...newFiles];
    });
  }, []);

  const categorizeFiles = useCallback(
    (files: File[]) => {
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
        // No label found — treat as additional data files
        addDataFiles(files);
      }
    },
    [addDataFiles],
  );

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

  const handleAddDataFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      addDataFiles(files);
      e.target.value = "";
    },
    [addDataFiles],
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
      setReferencedFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const dataFileNames = new Set(dataFiles.map((f) => f.name));
  const allRefsProvided =
    referencedFiles.length === 0 ||
    referencedFiles.every((f) => dataFileNames.has(f));

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
          Or drop a folder, or click to browse
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
        <div className="text-xs text-nasa-gray-300 space-y-2">
          <p>
            Label: <span className="text-white">{labelFile.name}</span>
          </p>

          {referencedFiles.length > 0 && (
            <div>
              <p className="text-nasa-gray-400 mb-1">Referenced data files:</p>
              <ul className="space-y-0.5">
                {referencedFiles.map((fname) => {
                  const found = dataFileNames.has(fname);
                  return (
                    <li key={fname} className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${found ? "bg-green-400" : "bg-red-400"}`}
                      />
                      <span className={found ? "text-green-300" : "text-red-300"}>
                        {fname}
                      </span>
                      {found && (
                        <span className="text-nasa-gray-500 text-[10px]">ready</span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {!allRefsProvided && (
                <button
                  className="mt-2 text-nasa-blue text-xs underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    dataInputRef.current?.click();
                  }}
                >
                  + Add missing data files
                </button>
              )}
              <input
                ref={dataInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleAddDataFiles}
              />
            </div>
          )}
        </div>
      )}

      {labelFile && (
        <button
          className="btn-primary w-full text-sm"
          onClick={handleUpload}
          disabled={isUploading || !allRefsProvided}
        >
          {isUploading
            ? "Parsing..."
            : !allRefsProvided
              ? "Waiting for data files..."
              : "Parse Label"}
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
