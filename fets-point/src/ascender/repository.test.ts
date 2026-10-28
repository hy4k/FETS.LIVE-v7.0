import { beforeEach, expect, it, vi } from "vitest";
import { repository } from "./repository";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), tables: [] as string[] }));
vi.mock("../lib/supabase", () => ({
  supabase: {
    rpc: (...args: any[]) => mocks.rpc(...args),
    from: (table: string) => {
      mocks.tables.push(table);
      const q: any = new Proxy(
        {},
        {
          get: (_target, key) =>
            key === "then"
              ? (resolve: any, reject: any) =>
                  Promise.resolve({ data: [], error: null }).then(
                    resolve,
                    reject,
                  )
              : () => q,
        },
      );
      return q;
    },
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.tables.length = 0;
});
it("loads Sites for a staff account allowed by the server capability without a UI role gate", async () => {
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  const data = await repository.load();
  expect(data.centres).toEqual([]);
  expect(mocks.rpc).toHaveBeenCalledWith("ascender_capabilities");
  expect(mocks.tables).toEqual(
    expect.arrayContaining([
      "ascender_centres",
      "ascender_rooms",
      "compliance_items",
      "ascender_history",
    ]),
  );
});
it("explains an explicit access denial and does not fetch site records", async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  await expect(repository.load()).rejects.toThrow(
    "FETS Sites permission in User Management",
  );
  expect(mocks.tables).toHaveLength(0);
});
it("keeps a failed capability request distinct from empty site data", async () => {
  mocks.rpc.mockResolvedValue({
    data: null,
    error: new Error("Connection unavailable"),
  });
  await expect(repository.load()).rejects.toThrow("Connection unavailable");
  expect(mocks.tables).toHaveLength(0);
});
