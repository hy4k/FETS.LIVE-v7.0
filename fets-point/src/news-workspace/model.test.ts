import { it, expect } from "vitest";
import { newsPost, industryPost } from "../test/news-fixture";
import {
  visiblePosts,
  needsRead,
  expired,
  istInput,
  localInput,
  safeLink,
} from "./model";
it("keeps centre and client scopes distinct", () => {
  const p = {
    ...newsPost,
    document: { ...newsPost.document, branch: "cochin" },
  };
  expect(
    visiblePosts([p, industryPost], [], "me", { branch: "calicut" }),
  ).toEqual([industryPost]);
  expect(
    visiblePosts([p, industryPost], [], "me", { client: "client" }),
  ).toEqual([p]);
});
it("moves expired and replaced versions to the archive", () => {
  const p = {
    ...newsPost,
    document: { ...newsPost.document, expires_at: "2000-01-01" },
  };
  expect(expired(p)).toBe(true);
  expect(visiblePosts([p], [], "me")).toEqual([]);
  expect(visiblePosts([p], [], "me", { view: "archive" })).toHaveLength(1);
});
it("a new approved version requires a fresh explicit acknowledgement", () => {
  const r = [
    {
      post_id: newsPost.id,
      profile_id: "me",
      acknowledged_at: new Date().toISOString(),
    },
  ];
  expect(needsRead(newsPost, r, "me")).toBe(false);
  expect(needsRead({ ...newsPost, id: "new-version" }, r, "me")).toBe(true);
  expect(needsRead({ ...newsPost, state: "withdrawn" }, [], "me")).toBe(false);
});
it("keeps industry awareness separate and supports plain text search", () => {
  expect(
    visiblePosts([newsPost, industryPost], [], "me", { view: "industry" }),
  ).toEqual([industryPost]);
  expect(
    visiblePosts([newsPost, industryPost], [], "me", { search: "checklist" }),
  ).toEqual([newsPost]);
});
it("uses India time for expiry editing regardless of browser timezone", () => {
  expect(istInput("2026-10-28T18:30")).toBe("2026-10-28T13:00:00.000Z");
  expect(localInput("2026-10-28T13:00:00Z")).toBe("2026-10-28T18:30");
});
it("does not offer unsafe source links", () => {
  expect(safeLink("javascript:alert(1)")).toBeNull();
  expect(safeLink("https://name:secret@example.org/")).toBeNull();
  expect(safeLink("https://example.org/news")).toBe("https://example.org/news");
});
