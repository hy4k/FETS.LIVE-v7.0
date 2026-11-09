import { afterEach, describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ActionablesView from "./ActionablesView";
vi.mock("./MissionWorkspace", () => ({
  default: () => (
    <section aria-label="Existing Pearson mission">
      Existing institutions and duties
    </section>
  ),
}));
vi.mock("../outreach/PrometricWorkspace", () => ({
  default: ({ onBack }: any) => (
    <section aria-label="Prometric partnerships">
      <button onClick={onBack}>Back to clients</button>
    </section>
  ),
}));
afterEach(() => window.history.replaceState(null, "", "/actionables"));
describe("Actionables client navigation", () => {
  it("starts with two client boxes and preserves the existing Pearson workspace behind its choice", () => {
    render(<ActionablesView />);
    expect(
      screen.getByRole("button", { name: /Pearson VUE/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Prometric/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Existing Pearson mission" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Pearson VUE/ }));
    expect(
      screen.getByRole("region", { name: "Existing Pearson mission" })
    ).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("client")).toBe(
      "pearson"
    );
    fireEvent.click(screen.getByRole("button", { name: "All clients" }));
    expect(
      screen.getByRole("button", { name: /Prometric/ })
    ).toBeInTheDocument();
  });
  it("opens Prometric from a saved client link and returns to client selection", async () => {
    window.history.replaceState(null, "", "/actionables?client=prometric");
    render(<ActionablesView />);
    expect(
      await screen.findByRole("region", { name: "Prometric partnerships" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to clients" }));
    expect(
      screen.getByRole("button", { name: /Pearson VUE/ })
    ).toBeInTheDocument();
  });
  it("keeps the existing News alias on its previous mission workspace", () => {
    render(<ActionablesView clientMenu={false} />);
    expect(
      screen.getByRole("region", { name: "Existing Pearson mission" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Prometric/ })
    ).not.toBeInTheDocument();
  });
});
