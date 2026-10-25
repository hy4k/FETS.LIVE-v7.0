import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { it, expect, vi, afterEach } from "vitest";
import { PageErrorBoundary } from "./PageErrorBoundary";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("keeps navigation available and can retry a failed page", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  let broken = true;
  function Page() {
    if (broken) throw Error("fixture render failure");
    return <p>Recovered page</p>;
  }
  const home = vi.fn();
  render(
    <>
      <nav>Main navigation</nav>
      <PageErrorBoundary onHome={home}>
        <Page />
      </PageErrorBoundary>
    </>,
  );
  expect(screen.getByText("Main navigation")).toBeVisible();
  expect(screen.getByRole("alert")).toBeVisible();
  fireEvent.click(screen.getByText("Go to home"));
  expect(home).toHaveBeenCalled();
  broken = false;
  fireEvent.click(screen.getByText("Retry page"));
  expect(screen.getByText("Recovered page")).toBeVisible();
});
