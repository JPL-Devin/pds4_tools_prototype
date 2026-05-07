import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import StructureList from "../../src/components/StructureList";
import type { StructureSummary } from "../../src/services/api";

const mockStructures: StructureSummary[] = [
  {
    index: 0,
    name: "Test Table",
    local_identifier: null,
    structure_type: "Table_Character",
    record_count: 100,
    field_count: 5,
    dimensions: null,
  },
  {
    index: 1,
    name: "Test Image",
    local_identifier: null,
    structure_type: "Array_2D_Image",
    record_count: null,
    field_count: null,
    dimensions: [720, 360],
  },
];

describe("StructureList", () => {
  it("renders all structures", () => {
    render(
      <StructureList
        structures={mockStructures}
        selected={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("Test Table")).toBeInTheDocument();
    expect(screen.getByText("Test Image")).toBeInTheDocument();
  });

  it("calls onSelect when a structure is clicked", () => {
    const onSelect = vi.fn();
    render(
      <StructureList
        structures={mockStructures}
        selected={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText("Test Table"));
    expect(onSelect).toHaveBeenCalledWith(mockStructures[0]);
  });

  it("shows record count for tables", () => {
    render(
      <StructureList
        structures={mockStructures}
        selected={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/100 records/)).toBeInTheDocument();
  });

  it("shows dimensions for arrays", () => {
    render(
      <StructureList
        structures={mockStructures}
        selected={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/720 x 360/)).toBeInTheDocument();
  });
});
