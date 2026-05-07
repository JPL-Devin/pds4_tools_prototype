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
    <div className="space-y-2">
      <h2 className="text-sm font-heading font-semibold text-nasa-gray-200 uppercase tracking-wider">
        Data Structures
      </h2>
      <ul className="space-y-1">
        {structures.map((s) => {
          const isSelected = selected?.index === s.index;
          const icon = TYPE_ICONS[s.structure_type] ?? "?";
          return (
            <li key={s.index}>
              <button
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-3 ${
                  isSelected
                    ? "bg-nasa-blue/20 text-nasa-blue border border-nasa-blue/30"
                    : "hover:bg-nasa-gray-700 text-nasa-gray-300"
                }`}
                onClick={() => onSelect(s)}
              >
                <span
                  className={`w-7 h-7 rounded flex items-center justify-center text-xs font-mono font-medium flex-shrink-0 ${
                    isSelected
                      ? "bg-nasa-blue text-white"
                      : "bg-nasa-gray-700 text-nasa-gray-300"
                  }`}
                >
                  {icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-xs text-nasa-gray-400">
                    {s.structure_type}
                    {s.record_count != null && ` | ${s.record_count.toLocaleString()} records`}
                    {s.field_count != null && ` | ${s.field_count} fields`}
                    {s.dimensions && ` | ${s.dimensions.join(" x ")}`}
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
