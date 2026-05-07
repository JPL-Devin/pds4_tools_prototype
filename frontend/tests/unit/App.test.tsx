import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "../../src/App";

describe("App", () => {
  it("renders the header", () => {
    render(<App />);
    expect(screen.getByText("PDS4 Viewer")).toBeInTheDocument();
  });

  it("shows upload prompt when no label is loaded", () => {
    render(<App />);
    expect(
      screen.getByText("Upload a PDS4 label to get started"),
    ).toBeInTheDocument();
  });

  it("shows supported file types hint", () => {
    render(<App />);
    expect(
      screen.getByText("Supports .xml and .lblx PDS4 label files"),
    ).toBeInTheDocument();
  });
});
