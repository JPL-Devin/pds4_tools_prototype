import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "../../src/App";
import { ThemeProvider } from "../../src/ThemeContext";

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}

describe("App", () => {
  it("renders the header", () => {
    renderApp();
    expect(screen.getByText("PDS View")).toBeInTheDocument();
  });

  it("shows upload prompt when no label is loaded", () => {
    renderApp();
    expect(
      screen.getByText("Upload a PDS4 label to get started"),
    ).toBeInTheDocument();
  });

  it("shows supported file types hint", () => {
    renderApp();
    expect(
      screen.getByText("Supports .xml and .lblx PDS4 label files"),
    ).toBeInTheDocument();
  });
});
