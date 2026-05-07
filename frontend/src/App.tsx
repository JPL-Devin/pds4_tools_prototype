import { useState } from "react";
import FileUpload from "./components/FileUpload";
import StructureList from "./components/StructureList";
import TableViewer from "./components/TableViewer";
import PlotPanel from "./components/PlotPanel";
import LabelTree from "./components/LabelTree";
import type { LabelUploadResponse, StructureSummary } from "./services/api";

type Tab = "table" | "plot" | "label";

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
    }
  };

  const isTable = selectedStructure?.structure_type.includes("Table") ?? false;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-nasa-gray-800 border-b border-nasa-gray-700 px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-nasa-red flex items-center justify-center">
            <span className="text-white font-heading font-bold text-sm">P4</span>
          </div>
          <h1 className="text-lg font-heading font-semibold text-white">
            PDS4 Viewer
          </h1>
        </div>
        <span className="text-nasa-gray-400 text-sm">
          Planetary Data System 4 Data Explorer
        </span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-80 bg-nasa-gray-800 border-r border-nasa-gray-700 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-nasa-gray-700">
            <FileUpload onSuccess={handleUploadSuccess} />
          </div>
          {label && (
            <div className="flex-1 overflow-auto p-4">
              <StructureList
                structures={label.structures}
                selected={selectedStructure}
                onSelect={handleSelectStructure}
              />
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {label && selectedStructure ? (
            <>
              {/* Tabs */}
              <div className="flex border-b border-nasa-gray-700 bg-nasa-gray-800 px-4">
                {isTable && (
                  <>
                    <button
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === "table"
                          ? "border-nasa-blue text-nasa-blue"
                          : "border-transparent text-nasa-gray-400 hover:text-nasa-gray-200"
                      }`}
                      onClick={() => setActiveTab("table")}
                    >
                      Table Data
                    </button>
                    <button
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === "plot"
                          ? "border-nasa-blue text-nasa-blue"
                          : "border-transparent text-nasa-gray-400 hover:text-nasa-gray-200"
                      }`}
                      onClick={() => setActiveTab("plot")}
                    >
                      Plot
                    </button>
                  </>
                )}
                <button
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "label"
                      ? "border-nasa-blue text-nasa-blue"
                      : "border-transparent text-nasa-gray-400 hover:text-nasa-gray-200"
                  }`}
                  onClick={() => setActiveTab("label")}
                >
                  Label XML
                </button>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-auto p-4">
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
                {activeTab === "label" && (
                  <LabelTree labelId={label.label_id} />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-nasa-gray-400">
                <p className="text-xl font-heading mb-2">
                  {label
                    ? "Select a data structure from the sidebar"
                    : "Upload a PDS4 label to get started"}
                </p>
                <p className="text-sm">
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
