import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fields, configuredFields, payload } from "./forms";
import { Questions, SiteEditor } from "./SiteForms";
import AscenderManager from "./AscenderManager";
import type { CentreData, Repository } from "./repository";
const centre = { id: "calicut", code: "calicut", version: 1 };
const seed = (): CentreData => ({
  centres: [centre, { id: "cochin", code: "cochin" }],
  rooms: [],
  programmes: [],
  documents: [],
  renewals: [],
  deployments: [],
  history: [],
  staff: [],
  clients: [],
  leads: [],
  sessions: [],
  fields: [],
  inventory: [],
});
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("flexible Sites forms", () => {
  it("makes all entry questions optional across sections", () => {
    for (const table of [
      "ascender_centres",
      "ascender_rooms",
      "ascender_programmes",
      "ascender_documents",
      "compliance_items",
      "ascender_deployments",
      "ascender_inventory",
    ])
      expect(fields(table, [], [], []).every((f) => f.required === false)).toBe(
        true,
      );
  });
  it("removes questions only for the selected centre and preserves definitions for restoration", () => {
    const data = seed();
    data.fields = [
      {
        centre_id: "calicut",
        section: "ascender_inventory",
        field_key: "quantity",
        kind: "builtin",
        label: "Count",
        removed: true,
      },
    ];
    expect(
      configuredFields("ascender_inventory", data, "calicut").some(
        (f) => f.key === "quantity",
      ),
    ).toBe(false);
    expect(
      configuredFields("ascender_inventory", data, "cochin").some(
        (f) => f.key === "quantity",
      ),
    ).toBe(true);
    expect(
      configuredFields("ascender_inventory", data, "calicut", true).find(
        (f) => f.key === "quantity",
      )?.removed,
    ).toBe(true);
  });
  it("clears only selected answers while retaining removed-question answers and zero/false values", () => {
    const defs: any[] = [
      { key: "name", label: "Item" },
      { key: "quantity", label: "Quantity", type: "number" },
      { key: "q_yes", label: "Yes?", custom: true, type: "checkbox" },
      { key: "q_remove", label: "Other", custom: true, type: "text" },
    ];
    const next = payload(defs, {
      name: "",
      quantity: "0",
      q_yes: "false",
      q_remove: "",
      custom_answers: { q_hidden: "Retain", q_remove: "Clear" },
    });
    expect(next).toMatchObject({
      name: null,
      quantity: 0,
      custom_answers: { q_hidden: "Retain", q_yes: false },
    });
    expect(next.custom_answers).not.toHaveProperty("q_remove");
    expect(() =>
      payload(
        [{ key: "q_num", label: "Number", custom: true, type: "number" }],
        { q_num: "abc" },
      ),
    ).toThrow("valid number");
  });
  it("does not save a cleared answer until Save is chosen", async () => {
    const repo = { load: vi.fn(), save: vi.fn().mockResolvedValue(undefined) };
    render(
      <SiteEditor
        table="ascender_inventory"
        row={{ id: "i", name: "Computers", quantity: 4, version: 1 }}
        centre={centre}
        data={seed()}
        repository={repo}
        saved={vi.fn().mockResolvedValue(undefined)}
        close={vi.fn()}
        configure={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Clear answer: Quantity" }),
    );
    expect(repo.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save", exact: true }));
    await waitFor(() =>
      expect(repo.save).toHaveBeenCalledWith(
        "ascender_inventory",
        expect.objectContaining({ name: "Computers", quantity: null }),
        expect.objectContaining({ id: "i", version: 1 }),
      ),
    );
  });
  it("can save a section with no compulsory answers and keeps entries on a failed save", async () => {
    const repo = {
      load: vi.fn(),
      save: vi.fn().mockRejectedValue(new Error("Offline")),
    };
    render(
      <SiteEditor
        table="ascender_documents"
        centre={centre}
        data={seed()}
        repository={repo}
        saved={vi.fn()}
        close={vi.fn()}
        configure={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Document name"), {
      target: { value: "My record" },
    });
    expect(screen.getByLabelText("Existing document link")).not.toBeRequired();
    fireEvent.click(screen.getByRole("button", { name: "Save", exact: true }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Document name")).toHaveValue("My record");
  });
  it("removes and restores a standard question through versioned settings without deleting answers", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const repo = { load: vi.fn(), save: vi.fn().mockResolvedValue(undefined) };
    const saved = vi.fn().mockResolvedValue(undefined);
    const view = render(
      <Questions
        table="ascender_inventory"
        centre={centre}
        data={seed()}
        repository={repo}
        saved={saved}
        close={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Quantity", exact: true }),
    );
    await waitFor(() =>
      expect(repo.save).toHaveBeenCalledWith(
        "ascender_fields",
        expect.objectContaining({
          field_key: "quantity",
          kind: "builtin",
          removed: true,
          centre_id: "calicut",
        }),
        undefined,
      ),
    );
    const data = seed();
    data.fields = [
      {
        id: "setting",
        centre_id: "calicut",
        section: "ascender_inventory",
        field_key: "quantity",
        label: "Quantity",
        kind: "builtin",
        options: [],
        removed: true,
        version: 2,
      },
    ];
    view.rerender(
      <Questions
        table="ascender_inventory"
        centre={centre}
        data={data}
        repository={repo}
        saved={saved}
        close={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Restore Quantity", exact: true }),
    );
    await waitFor(() =>
      expect(repo.save).toHaveBeenLastCalledWith(
        "ascender_fields",
        expect.objectContaining({ removed: false }),
        expect.objectContaining({ id: "setting", version: 2 }),
      ),
    );
  });
  it("adds a new question with a unique stable key and an optional response type", async () => {
    const repo = { load: vi.fn(), save: vi.fn().mockResolvedValue(undefined) };
    render(
      <Questions
        table="ascender_rooms"
        centre={centre}
        data={seed()}
        repository={repo}
        saved={vi.fn().mockResolvedValue(undefined)}
        close={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Add question", exact: true }),
    );
    fireEvent.change(screen.getByLabelText("Question"), {
      target: { value: "Floor" },
    });
    fireEvent.change(screen.getByLabelText("Answer type"), {
      target: { value: "number" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save question", exact: true }),
    );
    await waitFor(() =>
      expect(repo.save).toHaveBeenCalledWith(
        "ascender_fields",
        expect.objectContaining({
          field_key: expect.stringMatching(/^q_[a-f0-9]{32}$/),
          label: "Floor",
          kind: "number",
          section: "ascender_rooms",
        }),
        undefined,
      ),
    );
  });
  it("offers inventory deletion and restoration while excluding deleted items from the default view", async () => {
    const data = seed();
    data.inventory = [
      {
        id: "item",
        centre_id: "calicut",
        name: "Computers",
        quantity: 5,
        version: 1,
        archived: false,
      },
    ];
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const repo: Repository = {
      load: vi.fn().mockImplementation(async () => structuredClone(data)),
      save: vi.fn().mockImplementation(async (_table, patch) => {
        Object.assign(data.inventory![0], patch, { version: 2 });
      }),
    };
    render(<AscenderManager repository={repo} />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "General inventory",
        exact: true,
      }),
    );
    await screen.findByRole("heading", { name: "Computers", exact: true });
    fireEvent.click(
      screen.getByRole("button", { name: "Delete", exact: true }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Computers", exact: true }),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByLabelText("Show deleted items"));
    await screen.findByRole("heading", { name: "Computers", exact: true });
    fireEvent.click(
      screen.getByRole("button", { name: "Restore", exact: true }),
    );
    await waitFor(() =>
      expect(repo.save).toHaveBeenLastCalledWith(
        "ascender_inventory",
        { archived: false },
        expect.objectContaining({ id: "item", version: 2 }),
      ),
    );
  });
});
