import "@testing-library/jest-dom";

// Mock URL.createObjectURL for Plotly.js compatibility in jsdom
if (typeof window !== "undefined") {
  window.URL.createObjectURL = () => "blob:mock";
  window.URL.revokeObjectURL = () => {};
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
}
