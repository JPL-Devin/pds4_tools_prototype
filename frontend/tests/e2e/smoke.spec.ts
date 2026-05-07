import { test, expect } from "@playwright/test";

test("homepage loads with header and upload prompt", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("PDS4 Viewer")).toBeVisible();
  await expect(
    page.getByText("Upload a PDS4 label to get started"),
  ).toBeVisible();
});

test("shows file upload area", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Upload Label")).toBeVisible();
  await expect(
    page.getByText("Drop .xml / .lblx label here"),
  ).toBeVisible();
});
