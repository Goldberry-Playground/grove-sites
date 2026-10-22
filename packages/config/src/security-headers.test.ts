import { describe, expect, it } from "vitest";
import ggg from "../../../apps/ggg/next.config";
import goldberry from "../../../apps/goldberry/next.config";
import hub from "../../../apps/hub/next.config";
import nursery from "../../../apps/nursery/next.config";
import { securityHeaders, securityHeadersRoute } from "./security-headers";

const header = (key: string) => securityHeaders.find((h) => h.key === key)?.value;

describe("securityHeaders", () => {
  it("sets the GOL-3584 baseline", () => {
    expect(header("Strict-Transport-Security")).toBe("max-age=31536000");
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("Content-Security-Policy")).toBe("frame-ancestors 'none'");
    expect(header("X-Frame-Options")).toBe("DENY");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(header("Permissions-Policy")).toContain("camera=()");
  });

  it("applies to every route", () => {
    expect(securityHeadersRoute.source).toBe("/:path*");
  });
});

describe.each([
  ["ggg", ggg],
  ["goldberry", goldberry],
  ["hub", hub],
  ["nursery", nursery],
])("%s next.config", (_name, config) => {
  it("drops x-powered-by", () => {
    expect(config.poweredByHeader).toBe(false);
  });

  it("sends the shared security headers", async () => {
    const routes = await config.headers!();
    expect(routes).toContainEqual(securityHeadersRoute);
  });
});
