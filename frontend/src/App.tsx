import { useState } from "react";
import FileUpload from "./components/FileUpload";
import StructureList from "./components/StructureList";
import TableViewer from "./components/TableViewer";
import PlotPanel from "./components/PlotPanel";
import LabelView from "./components/LabelView";
import ImageViewer from "./components/ImageViewer";
import type { LabelUploadResponse, StructureSummary } from "./services/api";

type Tab = "table" | "plot" | "image" | "label";

export default function App() {
  const [label, setLabel] = useState<LabelUploadResponse | null>(null);
  const [selectedStructure, setSelectedStructure] =
    useState<StructureSummary | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("table");

  const handleUploadSuccess = (result: LabelUploadResponse) => {
    setLabel(result);
    setSelectedStructure(null);
    setActiveTab("table");
  };

  const handleSelectStructure = (structure: StructureSummary) => {
    setSelectedStructure(structure);
    if (structure.structure_type.includes("Table")) {
      setActiveTab("table");
    } else if (structure.structure_type.includes("Array")) {
      setActiveTab("image");
    }
  };

  const isTable = selectedStructure?.structure_type.includes("Table") ?? false;
  const isImage = selectedStructure?.structure_type.includes("Array") ?? false;

  const tabButton = (tab: Tab, label: string) => (
    <button
      className={`px-5 py-2.5 text-sm font-medium transition-all relative ${
        activeTab === tab
          ? "text-nasa-blue"
          : "text-nasa-gray-400 hover:text-nasa-gray-200"
      }`}
      onClick={() => setActiveTab(tab)}
    >
      {label}
      {activeTab === tab && (
        <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-nasa-blue rounded-full" />
      )}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-nasa-gray-900 border-b border-nasa-gray-700/50 px-6 py-3.5 flex items-center gap-5">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="PDS View" className="w-8 h-8" />
          <h1 className="text-lg font-heading font-bold text-white tracking-tight">
            PDS View
          </h1>
        </div>
        <div className="h-5 w-px bg-nasa-gray-700/60" />
        <span className="text-nasa-gray-400 text-sm font-light">
          Planetary Data System Data Explorer
        </span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-80 bg-nasa-gray-900/80 border-r border-nasa-gray-700/50 flex flex-col overflow-hidden">
          <div className="p-5 border-b border-nasa-gray-700/40">
            <FileUpload onSuccess={handleUploadSuccess} />
          </div>
          {label && (
            <div className="flex-1 overflow-auto p-5">
              <StructureList
                structures={label.structures}
                selected={selectedStructure}
                onSelect={handleSelectStructure}
              />
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-nasa-gray-950">
          {label && selectedStructure ? (
            <>
              {/* Tabs */}
              <div className="flex border-b border-nasa-gray-700/40 bg-nasa-gray-900/60 px-4">
                {isTable && (
                  <>
                    {tabButton("table", "Table Data")}
                    {tabButton("plot", "Plot")}
                  </>
                )}
                {isImage && tabButton("image", "Image")}
                {tabButton("label", "Label")}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-auto p-6">
                {activeTab === "table" && isTable && (
                  <TableViewer
                    labelId={label.label_id}
                    structureIndex={selectedStructure.index}
                  />
                )}
                {activeTab === "plot" && isTable && (
                  <PlotPanel
                    labelId={label.label_id}
                    structureIndex={selectedStructure.index}
                  />
                )}
                {activeTab === "image" && isImage && (
                  <ImageViewer
                    labelId={label.label_id}
                    structureIndex={selectedStructure.index}
                  />
                )}
                {activeTab === "label" && (
                  <LabelView labelId={label.label_id} />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="mb-6 opacity-30">
                  <img
                    src="/logo.svg"
                    alt=""
                    className="w-16 h-16 mx-auto"
                  />
                </div>
                <p className="text-xl font-heading font-medium text-nasa-gray-300 mb-2">
                  {label
                    ? "Select a data structure from the sidebar"
                    : "Upload a PDS4 label to get started"}
                </p>
                <p className="text-sm text-nasa-gray-500">
                  Supports .xml and .lblx PDS4 label files
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
