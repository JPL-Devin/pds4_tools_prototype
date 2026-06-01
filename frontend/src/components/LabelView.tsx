import { useEffect, useState } from "react";
import { getLabelDetail } from "../services/api";
import type { XmlNode } from "../services/api";

interface LabelViewProps {
  labelId: string;
}

/**
 * PDS4 label sections to display prominently with human-readable titles.
 * The key is the XML tag name, the value is the display label.
 */
const SECTION_LABELS: Record<string, string> = {
  Identification_Area: "Identification",
  Observation_Area: "Observation",
  Context_Area: "Context",
  Reference_List: "References",
  File_Area_Observational: "Data Files",
  File_Area_Observational_Supplemental: "Supplemental Files",
  File_Area_Browse: "Browse Files",
};

const SKIP_TAGS = new Set(["Discipline_Area"]);

/**
 * Tags whose children should be rendered as simple key-value pairs
 * rather than nested sections.
 */
const FLAT_TAGS = new Set([
  "Identification_Area",
  "Time_Coordinates",
  "Primary_Result_Summary",
  "File",
  "Element_Array",
  "Axis_Array",
  "Modification_Detail",
  "Field_Character",
  "Field_Binary",
  "Field_Delimited",
  "Record_Character",
  "Record_Binary",
  "Record_Delimited",
]);

function humanizeTag(tag: string): string {
  return tag.replace(/_/g, " ");
}

export default function LabelView({ labelId }: LabelViewProps) {
  const [tree, setTree] = useState<XmlNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRawXml, setShowRawXml] = useState(false);

  useEffect(() => {
    getLabelDetail(labelId)
      .then((detail) => setTree(detail.xml_tree))
      .catch((err) => setError(err.message));
  }, [labelId]);

  if (error) {
    return (
      <div className="card border-red-200 dark:border-nasa-red/30 bg-red-50 dark:bg-nasa-red/5 text-red-600 dark:text-nasa-red">
        {error}
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-nasa-gray-300">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-gray-300 dark:border-nasa-gray-600 border-t-nasa-blue rounded-full animate-spin mx-auto mb-3" />
          Loading label...
        </div>
      </div>
    );
  }

  const sections = tree.children ?? [];

  return (
    <div className="space-y-5">
      {/* Product type header */}
      <div>
        <h2 className="text-lg font-heading font-semibold text-gray-900 dark:text-white">
          {humanizeTag(tree.tag)}
        </h2>
      </div>

      {/* Main content sections */}
      <div className="space-y-4">
        {sections.map((section, i) => {
          if (SKIP_TAGS.has(section.tag)) return null;
          const sectionTitle = SECTION_LABELS[section.tag] ?? humanizeTag(section.tag);
          return (
            <MetadataSection key={`${section.tag}-${i}`} title={sectionTitle} node={section} />
          );
        })}
      </div>

      {/* Raw XML toggle */}
      <div className="border-t border-gray-200 dark:border-nasa-gray-700/40 pt-4">
        <button
          className="text-sm text-gray-500 dark:text-nasa-gray-300 hover:text-gray-700 dark:hover:text-nasa-gray-100 transition-colors flex items-center gap-2"
          onClick={() => setShowRawXml(!showRawXml)}
        >
          <span className={`transition-transform inline-block ${showRawXml ? "" : "-rotate-90"}`}>
            {"\u25BC"}
          </span>
          Raw XML
        </button>
        {showRawXml && (
          <div className="mt-3 card overflow-auto max-h-96">
            <div className="font-mono text-xs leading-relaxed">
              <RawXmlNode node={tree} depth={0} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetadataSection({ title, node }: { title: string; node: XmlNode }) {
  const [expanded, setExpanded] = useState(true);
  const hasContent = (node.children && node.children.length > 0) || node.text;

  if (!hasContent) return null;

  return (
    <div className="card">
      <button
        className="w-full flex items-center justify-between text-left mb-3"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="text-sm font-heading font-semibold text-gray-600 dark:text-nasa-gray-200 uppercase tracking-wider">
          {title}
        </h3>
        <span className={`text-gray-500 dark:text-nasa-gray-400 transition-transform text-xs ${expanded ? "" : "-rotate-90"}`}>
          {"\u25BC"}
        </span>
      </button>

      {expanded && (
        <div className="space-y-1">
          {node.text && !node.children?.length && (
            <p className="text-sm text-gray-700 dark:text-nasa-gray-200">{node.text}</p>
          )}
          {node.children && (
            <MetadataContent nodes={node.children} depth={0} />
          )}
        </div>
      )}
    </div>
  );
}

function MetadataContent({ nodes, depth }: { nodes: XmlNode[]; depth: number }) {
  return (
    <div className={depth > 0 ? "pl-4 border-l border-gray-200 dark:border-nasa-gray-700/30 ml-1" : ""}>
      {nodes.map((child, i) => (
        <MetadataItem key={`${child.tag}-${i}`} node={child} depth={depth} />
      ))}
    </div>
  );
}

function MetadataItem({ node, depth }: { node: XmlNode; depth: number }) {
  const hasChildren = node.children && node.children.length > 0;
  const isLeaf = !hasChildren;
  const isFlat = FLAT_TAGS.has(node.tag);
  const label = humanizeTag(node.tag);

  if (isLeaf) {
    return (
      <div className="flex items-baseline gap-3 py-1.5 group">
        <span className="text-xs text-gray-500 dark:text-nasa-gray-300 min-w-[140px] flex-shrink-0 font-medium">
          {label}
        </span>
        <span className="text-sm text-gray-800 dark:text-nasa-gray-100 break-all">
          {node.text || "—"}
          {node.attributes && Object.keys(node.attributes).length > 0 && (
            <span className="text-xs text-gray-500 dark:text-nasa-gray-400 ml-2">
              {Object.entries(node.attributes)
                .filter(([k]) => k !== "nilReason")
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")}
              {node.attributes["nilReason"] && (
                <span className="italic"> ({node.attributes["nilReason"]})</span>
              )}
            </span>
          )}
        </span>
      </div>
    );
  }

  if (isFlat) {
    return (
      <div className="py-2">
        <p className="text-xs font-medium text-gray-500 dark:text-nasa-gray-300 mb-1">{label}</p>
        <div className="bg-gray-50 dark:bg-nasa-gray-900/40 rounded-lg p-3 space-y-0.5">
          {node.children!.map((child, i) => (
            <MetadataItem key={`${child.tag}-${i}`} node={child} depth={depth + 1} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="py-2">
      <p className="text-xs font-semibold text-nasa-blue dark:text-nasa-blue-light uppercase tracking-wider mb-2">
        {label}
      </p>
      <MetadataContent nodes={node.children!} depth={depth + 1} />
    </div>
  );
}

/* ---- Raw XML tree (collapsed by default) ---- */

function RawXmlNode({ node, depth }: { node: XmlNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const indent = depth * 18;

  return (
    <div>
      <div
        className="flex items-start py-0.5 hover:bg-gray-100 dark:hover:bg-nasa-gray-700/30 rounded-sm cursor-pointer"
        style={{ paddingLeft: `${indent}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          <span className={`w-4 flex-shrink-0 select-none transition-transform text-gray-500 dark:text-nasa-gray-400 ${expanded ? "" : "-rotate-90"}`}>
            {"\u25BC"}
          </span>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        <span className="text-nasa-blue dark:text-nasa-blue-light">&lt;{node.tag}</span>
        {node.attributes &&
          Object.entries(node.attributes).map(([k, v]) => (
            <span key={k}>
              <span className="text-gray-500 dark:text-nasa-gray-300"> {k}=</span>
              <span className="text-emerald-600 dark:text-emerald-400/80">&quot;{v}&quot;</span>
            </span>
          ))}
        {!hasChildren && !node.text && (
          <span className="text-nasa-blue dark:text-nasa-blue-light"> /&gt;</span>
        )}
        {!hasChildren && node.text && (
          <>
            <span className="text-nasa-blue dark:text-nasa-blue-light">&gt;</span>
            <span className="text-gray-800 dark:text-nasa-gray-100 mx-1">{node.text}</span>
            <span className="text-nasa-blue dark:text-nasa-blue-light">&lt;/{node.tag}&gt;</span>
          </>
        )}
        {hasChildren && <span className="text-nasa-blue dark:text-nasa-blue-light">&gt;</span>}
      </div>
      {hasChildren && expanded && (
        <>
          {node.children!.map((child, i) => (
            <RawXmlNode key={`${child.tag}-${i}`} node={child} depth={depth + 1} />
          ))}
          <div
            className="py-0.5 text-nasa-blue dark:text-nasa-blue-light"
            style={{ paddingLeft: `${indent + 18}px` }}
          >
            &lt;/{node.tag}&gt;
          </div>
        </>
      )}
    </div>
  );
}
