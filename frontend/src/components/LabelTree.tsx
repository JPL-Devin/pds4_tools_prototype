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
    return <div className="text-nasa-red p-4">{error}</div>;
  }

  if (!tree) {
    return (
      <div className="flex items-center justify-center h-64 text-nasa-gray-400">
        Loading label...
      </div>
    );
  }

  return (
    <div className="card overflow-auto max-h-[calc(100vh-200px)]">
      <h2 className="text-sm font-heading font-semibold text-nasa-gray-200 mb-3">
        PDS4 Label XML Tree
      </h2>
      <div className="font-mono text-xs">
        <TreeNode node={tree} depth={0} />
      </div>
    </div>
  );
}

function TreeNode({ node, depth }: { node: XmlNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const indent = depth * 16;

  return (
    <div>
      <div
        className="flex items-start py-0.5 hover:bg-nasa-gray-700/50 rounded cursor-pointer group"
        style={{ paddingLeft: `${indent}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          <span className="w-4 text-nasa-gray-500 flex-shrink-0 select-none">
            {expanded ? "\u25BC" : "\u25B6"}
          </span>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        <span className="text-nasa-blue">&lt;{node.tag}</span>
        {node.attributes &&
          Object.entries(node.attributes).map(([k, v]) => (
            <span key={k}>
              <span className="text-nasa-gray-400"> {k}=</span>
              <span className="text-green-400">&quot;{v}&quot;</span>
            </span>
          ))}
        {!hasChildren && !node.text && (
          <span className="text-nasa-blue"> /&gt;</span>
        )}
        {!hasChildren && node.text && (
          <>
            <span className="text-nasa-blue">&gt;</span>
            <span className="text-nasa-gray-100 mx-1">{node.text}</span>
            <span className="text-nasa-blue">&lt;/{node.tag}&gt;</span>
          </>
        )}
        {hasChildren && <span className="text-nasa-blue">&gt;</span>}
      </div>
      {hasChildren && expanded && (
        <>
          {node.children!.map((child, i) => (
            <TreeNode key={`${child.tag}-${i}`} node={child} depth={depth + 1} />
          ))}
          <div
            className="py-0.5 text-nasa-blue"
            style={{ paddingLeft: `${indent + 16}px` }}
          >
            &lt;/{node.tag}&gt;
          </div>
        </>
      )}
    </div>
  );
}
