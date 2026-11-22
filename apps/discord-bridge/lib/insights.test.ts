import { describe, it, expect } from "vitest";
import { DEFAULT_DIGEST_SERVICES } from "./insights";

describe("DEFAULT_DIGEST_SERVICES", () => {
  it("covers the content channels and leaves out Google Business", () => {
    expect([...DEFAULT_DIGEST_SERVICES].sort()).toEqual(
      ["facebook", "instagram", "threads", "tiktok", "youtube"],
    );
  });
});
