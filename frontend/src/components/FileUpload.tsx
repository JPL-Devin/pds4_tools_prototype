import { useCallback, useRef, useState } from "react";
import { uploadLabel } from "../services/api";
import type { LabelUploadResponse } from "../services/api";

interface FileUploadProps {
  onSuccess: (result: LabelUploadResponse) => void;
}

export default function FileUpload({ onSuccess }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);
  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [dataFile, setDataFile] = useState<File | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    categorizeFiles(files);
  }, []);

  const categorizeFiles = (files: File[]) => {
    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "xml" || ext === "lblx") {
        setLabelFile(file);
      } else {
        setDataFile(file);
      }
    }
  };

  const handleUpload = async () => {
    if (!labelFile) return;
    setIsUploading(true);
    setError(null);
    try {
      const result = await uploadLabel(labelFile, dataFile ?? undefined);
      onSuccess(result);
      setLabelFile(null);
      setDataFile(null);
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
        onClick={() => labelInputRef.current?.click()}
      >
        <p className="text-sm text-nasa-gray-400">
          Drop .xml / .lblx label here
        </p>
        <input
          ref={labelInputRef}
          type="file"
          accept=".xml,.lblx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setLabelFile(f);
          }}
        />
      </div>

      {labelFile && (
        <div className="text-xs text-nasa-gray-300 space-y-1">
          <p>
            Label: <span className="text-white">{labelFile.name}</span>
          </p>
          <div className="flex items-center gap-2">
            <span className="text-nasa-gray-400">Data file (optional):</span>
            <button
              className="text-nasa-blue text-xs underline"
              onClick={() => dataInputRef.current?.click()}
            >
              {dataFile ? dataFile.name : "Select"}
            </button>
            <input
              ref={dataInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setDataFile(f);
              }}
            />
          </div>
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

      {error && (
        <p className="text-nasa-red text-xs">{error}</p>
      )}
    </div>
  );
}
