import type { StructureSummary } from "../services/api";

interface StructureListProps {
  structures: StructureSummary[];
  selected: StructureSummary | null;
  onSelect: (s: StructureSummary) => void;
}

const TYPE_ICONS: Record<string, string> = {
  Table_Character: "T",
  Table_Binary: "B",
  Table_Delimited: "D",
  Array_2D_Image: "I",
  Array_2D: "2D",
  Array_3D: "3D",
  Array_3D_Spectrum: "S",
};

export default function StructureList({
  structures,
  selected,
  onSelect,
}: StructureListProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-heading font-semibold text-gray-500 dark:text-nasa-gray-300 uppercase tracking-widest">
        Data Structures
      </h2>
      <ul className="space-y-1.5">
        {structures.map((s) => {
          const isSelected = selected?.index === s.index;
          const icon = TYPE_ICONS[s.structure_type] ?? "?";
          return (
            <li key={s.index}>
              <button
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center gap-3 ${
                  isSelected
                    ? "bg-nasa-blue/15 text-nasa-blue-light border border-nasa-blue/25 shadow-sm"
                    : "hover:bg-gray-100 dark:hover:bg-nasa-gray-800 text-gray-600 dark:text-nasa-gray-300 border border-transparent"
                }`}
                onClick={() => onSelect(s)}
              >
                <span
                  className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-mono font-medium flex-shrink-0 ${
                    isSelected
                      ? "bg-nasa-blue text-white"
                      : "bg-gray-200 text-gray-600 dark:bg-nasa-gray-700/80 dark:text-nasa-gray-300"
                  }`}
                >
                  {icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-xs text-gray-500 dark:text-nasa-gray-400 mt-0.5">
                    {s.structure_type}
                    {s.record_count != null && ` · ${s.record_count.toLocaleString()} records`}
                    {s.field_count != null && ` · ${s.field_count} fields`}
                    {s.dimensions && ` · ${s.dimensions.join(" × ")}`}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
