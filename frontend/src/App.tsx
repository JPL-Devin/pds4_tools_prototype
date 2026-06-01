import { useState } from "react";
import FileUpload from "./components/FileUpload";
import FileBrowser from "./components/FileBrowser";
import StructureList from "./components/StructureList";
import TableViewer from "./components/TableViewer";
import PlotPanel from "./components/PlotPanel";
import LabelView from "./components/LabelView";
import ImageViewer from "./components/ImageViewer";
import { useTheme } from "./ThemeContext";
import type { LabelUploadResponse, StructureSummary } from "./services/api";

type Tab = "table" | "plot" | "image" | "label";
type InputMode = "browse" | "upload";

export default function App() {
  const [label, setLabel] = useState<LabelUploadResponse | null>(null);
  const [selectedStructure, setSelectedStructure] =
    useState<StructureSummary | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("table");
  const [inputMode, setInputMode] = useState<InputMode>("browse");
  const { theme, toggleTheme } = useTheme();

  const handleLabelLoaded = (result: LabelUploadResponse) => {
    setLabel(result);
    const first = result.structures[0] ?? null;
    setSelectedStructure(first);
    if (first) {
      if (first.structure_type.includes("Table")) {
        setActiveTab("table");
      } else if (first.structure_type.includes("Array")) {
        setActiveTab("image");
      } else {
        setActiveTab("label");
      }
    } else {
      setActiveTab("label");
    }
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

  const tabButton = (tab: Tab, tabLabel: string) => (
    <button
      className={`px-5 py-2.5 text-sm font-medium transition-all relative ${
        activeTab === tab
          ? "text-nasa-blue"
          : "text-gray-500 hover:text-gray-700 dark:text-nasa-gray-300 dark:hover:text-nasa-gray-100"
      }`}
      onClick={() => setActiveTab(tab)}
    >
      {tabLabel}
      {activeTab === tab && (
        <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-nasa-blue rounded-full" />
      )}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-nasa-gray-950">
      {/* Header */}
      <header className="bg-gray-900 dark:bg-nasa-gray-900 border-b border-gray-800 dark:border-nasa-gray-700/50 px-6 py-3.5 flex items-center gap-5">
        <div className="flex items-center gap-3">
          <img src="/assets/logo/pds-view-logo-dark-background.svg" alt="PDS View" className="w-8 h-8" />
          <h1 className="text-lg font-heading font-bold text-white tracking-tight">
            PDS View
          </h1>
        </div>
        <div className="h-5 w-px bg-gray-700 dark:bg-nasa-gray-700/60" />
        <span className="text-gray-400 dark:text-nasa-gray-300 text-sm font-light">
          Planetary Data System Data Explorer
        </span>
        <div className="flex-1" />
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 dark:hover:bg-nasa-gray-800 transition-colors"
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
          )}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-80 bg-gray-50 dark:bg-nasa-gray-900/80 border-r border-gray-200 dark:border-nasa-gray-700/50 flex flex-col overflow-hidden">
          {/* Input mode tabs */}
          <div className="flex border-b border-gray-200 dark:border-nasa-gray-700/40">
            <button
              className={`flex-1 px-4 py-2.5 text-xs font-medium uppercase tracking-wider transition-all ${
                inputMode === "browse"
                  ? "text-nasa-blue border-b-2 border-nasa-blue bg-white dark:bg-nasa-gray-900/60"
                  : "text-gray-500 dark:text-nasa-gray-300 hover:text-gray-700 dark:hover:text-nasa-gray-100"
              }`}
              onClick={() => setInputMode("browse")}
            >
              Browse Files
            </button>
            <button
              className={`flex-1 px-4 py-2.5 text-xs font-medium uppercase tracking-wider transition-all ${
                inputMode === "upload"
                  ? "text-nasa-blue border-b-2 border-nasa-blue bg-white dark:bg-nasa-gray-900/60"
                  : "text-gray-500 dark:text-nasa-gray-300 hover:text-gray-700 dark:hover:text-nasa-gray-100"
              }`}
              onClick={() => setInputMode("upload")}
            >
              Upload
            </button>
          </div>

          {/* Input content */}
          <div className="p-4 border-b border-gray-200 dark:border-nasa-gray-700/40 overflow-auto flex-shrink-0" style={{ maxHeight: label ? "50%" : "100%" }}>
            {inputMode === "browse" ? (
              <FileBrowser onLabelOpened={handleLabelLoaded} />
            ) : (
              <FileUpload onSuccess={handleLabelLoaded} />
            )}
          </div>

          {/* Structures list */}
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
        <main className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-nasa-gray-950">
          {label && selectedStructure ? (
            <>
              {/* Tabs */}
              <div className="flex border-b border-gray-200 dark:border-nasa-gray-700/40 bg-white dark:bg-nasa-gray-900/60 px-4">
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
                <div className="mb-6 opacity-20">
                  <img
                    src="/assets/logo/pds-view-logo-light-background.svg"
                    alt=""
                    className="w-16 h-16 mx-auto dark:hidden"
                  />
                  <img
                    src="/assets/logo/pds-view-logo-dark-background.svg"
                    alt=""
                    className="w-16 h-16 mx-auto hidden dark:block"
                  />
                </div>
                <p className="text-xl font-heading font-medium text-gray-500 dark:text-nasa-gray-300 mb-2">
                  {label
                    ? "Select a data structure from the sidebar"
                    : "Upload a PDS4 label to get started"}
                </p>
                <p className="text-sm text-gray-500 dark:text-nasa-gray-300">
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
