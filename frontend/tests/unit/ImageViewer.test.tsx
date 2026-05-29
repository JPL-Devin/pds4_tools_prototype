import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ImageViewer from "../../src/components/ImageViewer";

vi.mock("../../src/services/api", () => ({
  getImageMetadata: vi.fn().mockResolvedValue({
    label_id: "test-id",
    structure_index: 0,
    name: "Test Image",
    structure_type: "Array_2D_Image",
    dimensions: [360, 720],
    element_data_type: "UnsignedByte",
    width: 720,
    height: 360,
  }),
  getImageStatistics: vi.fn().mockResolvedValue({
    min: 0,
    max: 255,
    mean: 128,
    std: 40,
    shape: [360, 720],
    dtype: "uint8",
    percentiles: {
      "1": 5,
      "5": 15,
      "25": 80,
      "50": 130,
      "75": 175,
      "95": 220,
      "99": 245,
    },
  }),
  renderImage: vi.fn().mockResolvedValue(new Blob(["test"], { type: "image/png" })),
}));

describe("ImageViewer", () => {
  it("renders loading state initially", () => {
    render(<ImageViewer labelId="test-id" structureIndex={0} />);
    expect(screen.getByText("Loading image metadata...")).toBeInTheDocument();
  });

  it("renders image header after metadata loads", async () => {
    render(<ImageViewer labelId="test-id" structureIndex={0} />);
    expect(await screen.findByText("Test Image")).toBeInTheDocument();
  });

  it("shows image dimensions", async () => {
    render(<ImageViewer labelId="test-id" structureIndex={0} />);
    expect(await screen.findByText(/720 x 360/)).toBeInTheDocument();
  });

  it("shows colormap selector", async () => {
    render(<ImageViewer labelId="test-id" structureIndex={0} />);
    await screen.findByText("Test Image");
    expect(screen.getByText("Colormap")).toBeInTheDocument();
  });

  it("shows stretch selector", async () => {
    render(<ImageViewer labelId="test-id" structureIndex={0} />);
    await screen.findByText("Test Image");
    expect(screen.getByText("Stretch")).toBeInTheDocument();
  });

  it("shows statistics after loading", async () => {
    render(<ImageViewer labelId="test-id" structureIndex={0} />);
    expect(await screen.findByText(/Min:/)).toBeInTheDocument();
    expect(screen.getByText(/Max:/)).toBeInTheDocument();
    expect(screen.getByText(/Mean:/)).toBeInTheDocument();
  });
});
