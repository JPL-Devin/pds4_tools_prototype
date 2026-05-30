import { useEffect, useState } from "react";
import { getLabelDetail } from "../services/api";
import type { XmlNode } from "../services/api";

interface LabelTreeProps {
  labelId: string;
}

export default function LabelTree({ labelId }: LabelTreeProps) {
  const [tree, setTree] = useState<XmlNode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLabelDetail(labelId)
      .then((detail) => setTree(detail.xml_tree))
      .catch((err) => setError(err.message));
  }, [labelId]);

  if (error) {
    return (
      <div className="card border-nasa-red/30 bg-nasa-red/5 text-nasa-red">
        {error}
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="flex items-center justify-center h-64 text-nasa-gray-400">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-nasa-gray-600 border-t-nasa-blue rounded-full animate-spin mx-auto mb-3" />
          Loading label...
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-auto max-h-[calc(100vh-200px)]">
      <h2 className="text-xs font-heading font-semibold text-nasa-gray-400 uppercase tracking-widest mb-4">
        PDS4 Label XML Tree
      </h2>
      <div className="font-mono text-xs leading-relaxed">
        <TreeNode node={tree} depth={0} />
      </div>
    </div>
  );
}

function TreeNode({ node, depth }: { node: XmlNode; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const indent = depth * 18;

  return (
    <div>
      <div
        className="flex items-start py-0.5 hover:bg-nasa-gray-700/30 rounded-sm cursor-pointer group"
        style={{ paddingLeft: `${indent}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          <span className={`w-4 flex-shrink-0 select-none transition-transform ${expanded ? "" : "-rotate-90"} text-nasa-gray-500`}>
            {"\u25BC"}
          </span>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        <span className="text-nasa-blue-light">&lt;{node.tag}</span>
        {node.attributes &&
          Object.entries(node.attributes).map(([k, v]) => (
            <span key={k}>
              <span className="text-nasa-gray-400"> {k}=</span>
              <span className="text-emerald-400/80">&quot;{v}&quot;</span>
            </span>
          ))}
        {!hasChildren && !node.text && (
          <span className="text-nasa-blue-light"> /&gt;</span>
        )}
        {!hasChildren && node.text && (
          <>
            <span className="text-nasa-blue-light">&gt;</span>
            <span className="text-nasa-gray-100 mx-1">{node.text}</span>
            <span className="text-nasa-blue-light">&lt;/{node.tag}&gt;</span>
          </>
        )}
        {hasChildren && <span className="text-nasa-blue-light">&gt;</span>}
      </div>
      {hasChildren && expanded && (
        <>
          {node.children!.map((child, i) => (
            <TreeNode key={`${child.tag}-${i}`} node={child} depth={depth + 1} />
          ))}
          <div
            className="py-0.5 text-nasa-blue-light"
            style={{ paddingLeft: `${indent + 18}px` }}
          >
            &lt;/{node.tag}&gt;
          </div>
        </>
      )}
    </div>
  );
}
