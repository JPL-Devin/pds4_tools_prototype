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

interface ReferencedFile {
  name: string;
  required: boolean;
}

/**
 * Parse a PDS4 label XML string and return all referenced file_name values,
 * marking each as required (from File_Area_Observational) or optional
 * (from supplemental / other File_Area_* elements).
 */
function extractReferencedFiles(xmlText: string): ReferencedFile[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const seen = new Set<string>();
  const result: ReferencedFile[] = [];

  const allElements = doc.getElementsByTagName("*");
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements.item(i);
    if (!el || el.localName !== "file_name") continue;

    const fname = el.textContent?.trim();
    if (!fname || seen.has(fname)) continue;
    seen.add(fname);

    // Walk up to find the parent File_Area_* element
    let parent = el.parentElement?.parentElement;
    let required = false;
    while (parent) {
      const pName = parent.localName;
      if (pName.startsWith("File_Area_")) {
        required = pName === "File_Area_Observational";
        break;
      }
      parent = parent.parentElement;
    }

    result.push({ name: fname, required });
  }

  return result;
}

export default function FileUpload({ onSuccess }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);
  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [dataFiles, setDataFiles] = useState<File[]>([]);
  const [referencedFiles, setReferencedFiles] = useState<ReferencedFile[]>([]);

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

  const handleViewLabelOnly = async () => {
    if (!labelFile) return;
    setIsUploading(true);
    setError(null);
    try {
      const result = await uploadLabel(labelFile, []);
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
  const requiredFiles = referencedFiles.filter((f) => f.required);
  const optionalFiles = referencedFiles.filter((f) => !f.required);
  const allRequiredProvided =
    requiredFiles.length === 0 ||
    requiredFiles.every((f) => dataFileNames.has(f.name));
  const missingRequired = requiredFiles.filter((f) => !dataFileNames.has(f.name));

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-heading font-semibold text-gray-500 dark:text-nasa-gray-300 uppercase tracking-widest">
        Upload Label
      </h2>
      <div
        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-nasa-blue bg-nasa-blue/10 shadow-lg"
            : "border-gray-300 hover:border-gray-400 hover:bg-gray-100 dark:border-nasa-gray-600/50 dark:hover:border-nasa-gray-500/70 dark:hover:bg-nasa-gray-800/30"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="text-gray-400 dark:text-nasa-gray-400 mb-2">
          <svg className="w-8 h-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <p className="text-sm text-gray-600 dark:text-nasa-gray-300 font-medium">
          Drop label + data files here
        </p>
        <p className="text-xs text-gray-500 dark:text-nasa-gray-400 mt-1">
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
        <div className="text-xs space-y-3 bg-gray-50 dark:bg-nasa-gray-800/40 rounded-lg p-3 border border-gray-200 dark:border-nasa-gray-700/30">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-nasa-blue flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <span className="text-gray-900 dark:text-white font-medium truncate">{labelFile.name}</span>
          </div>

          {referencedFiles.length > 0 && (
            <div className="space-y-2">
              {requiredFiles.length > 0 && (
                <div>
                  <p className="text-gray-600 dark:text-nasa-gray-300 mb-1.5 font-medium">Required data files:</p>
                  <ul className="space-y-1">
                    {requiredFiles.map((ref) => {
                      const found = dataFileNames.has(ref.name);
                      return (
                        <li key={ref.name} className="flex items-center gap-2 pl-1">
                          <span
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${found ? "bg-green-400" : "bg-amber-400"}`}
                          />
                          <span className={found ? "text-gray-700 dark:text-nasa-gray-200" : "text-amber-600 dark:text-amber-300"}>
                            {ref.name}
                          </span>
                          {found && (
                            <span className="text-gray-500 dark:text-nasa-gray-400 text-[10px]">ready</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {optionalFiles.length > 0 && (
                <div>
                  <p className="text-gray-500 dark:text-nasa-gray-400 mb-1.5">Supplemental (optional):</p>
                  <ul className="space-y-1">
                    {optionalFiles.map((ref) => {
                      const found = dataFileNames.has(ref.name);
                      return (
                        <li key={ref.name} className="flex items-center gap-2 pl-1">
                          <span
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${found ? "bg-green-400" : "bg-gray-300 dark:bg-nasa-gray-600"}`}
                          />
                          <span className={found ? "text-gray-700 dark:text-nasa-gray-200" : "text-gray-500 dark:text-nasa-gray-400"}>
                            {ref.name}
                          </span>
                          {found && (
                            <span className="text-gray-500 dark:text-nasa-gray-400 text-[10px]">ready</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {missingRequired.length > 0 && (
                <button
                  className="text-nasa-blue text-xs hover:text-nasa-blue-light transition-colors"
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
        <div className="space-y-2">
          <button
            className="btn-primary w-full text-sm"
            onClick={handleUpload}
            disabled={isUploading || !allRequiredProvided}
          >
            {isUploading
              ? "Loading..."
              : !allRequiredProvided
                ? "Waiting for data files..."
                : "View Data"}
          </button>
          <button
            className="w-full text-xs text-gray-500 dark:text-nasa-gray-300 hover:text-gray-700 dark:hover:text-nasa-gray-100 transition-colors py-1"
            onClick={handleViewLabelOnly}
            disabled={isUploading}
          >
            View label only
          </button>
        </div>
      )}

      {error && (
        <p className="text-red-600 dark:text-nasa-red text-xs bg-red-50 dark:bg-nasa-red/5 border border-red-200 dark:border-nasa-red/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
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
