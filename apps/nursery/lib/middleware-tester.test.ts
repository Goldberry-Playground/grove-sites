import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/** `/plan?tester=<token>` (planner winter-beta §B.6 / §C.4, GOL-3551). */

const testerStatus = vi.fn();
vi.mock("@grove/odoo-client", async (orig) => ({
  ...(await orig<typeof import("@grove/odoo-client")>()),
  createOdooClient: () => ({ planner: { testerStatus }, products: { get: vi.fn() } }),
}));

const { middleware } = await import("../middleware");
const TOKEN = "tQ3x_9-AbCdEfGhIjKlMnOpQrStUvWx";

beforeEach(() => testerStatus.mockReset());

describe("middleware: tester link", () => {
  it("sets a 90-day HttpOnly cookie for a token Odoo knows and drops it from the URL", async () => {
    testerStatus.mockResolvedValue("valid");
    const res = await middleware(new NextRequest(`https://atthegrovenursery.com/plan?zip=26501&tester=${TOKEN}`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://atthegrovenursery.com/plan?zip=26501");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`grove_planner_tester=${TOKEN}`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Max-Age=7776000/);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Secure/i);
    expect(testerStatus).toHaveBeenCalledWith(TOKEN);
  });

  it("clears the cookie for a token Odoo refuses, still dropping it from the URL", async () => {
    testerStatus.mockResolvedValue("invalid");
    const res = await middleware(new NextRequest(`https://atthegrovenursery.com/plan?tester=${TOKEN}`));
    expect(res.headers.get("location")).toBe("https://atthegrovenursery.com/plan");
    expect(res.headers.get("set-cookie") ?? "").toMatch(/grove_planner_tester=;.*(Max-Age=0|Expires=Thu, 01 Jan 1970)/i);
  });

  it("leaves the cookie alone when Odoo is off", async () => {
    testerStatus.mockResolvedValue("off");
    const res = await middleware(new NextRequest(`https://atthegrovenursery.com/plan?tester=${TOKEN}`));
    expect(res.status).toBe(303);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("passes a plain /plan through without asking Odoo", async () => {
    const res = await middleware(new NextRequest("https://atthegrovenursery.com/plan?zip=26501"));
    expect(res.headers.get("location")).toBeNull();
    expect(testerStatus).not.toHaveBeenCalled();
  });
});
