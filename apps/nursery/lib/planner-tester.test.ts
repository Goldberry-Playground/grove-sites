import { beforeEach, describe, expect, it, vi } from "vitest";
import { OdooApiError, type OdooClient } from "@grove/odoo-client";
import {
  TESTER_COOKIE,
  cleanTesterBody,
  createPlannerTesterRoute,
  testerDecision,
  testerTokenFrom,
} from "./planner-tester";

/** Tester bench BFF (planner winter-beta spec §B.6 / §C.4, GOL-3551). */

const ORIGIN = "https://atthegrovenursery.com";
const TOKEN = "tQ3x_9-AbCdEfGhIjKlMnOpQrStUvWx";

function client(overrides: Partial<OdooClient["planner"]> = {}) {
  const planner = {
    dispute: vi.fn(async () => ({ ok: true as const })),
    propose: vi.fn(async () => ({ ok: true as const })),
    testerStatus: vi.fn(async () => "valid" as const),
    ...overrides,
  };
  return { odoo: { planner } as unknown as OdooClient, planner };
}

function post(body: unknown, { cookie = `${TESTER_COOKIE}=${TOKEN}`, origin = ORIGIN }: { cookie?: string | null; origin?: string | null } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  return new Request("http://nursery.test/api/planner/dispute", { method: "POST", headers, body: JSON.stringify(body) });
}

const dispute = { product_tmpl_id: 101, fact: "years_to_fruit", note: " Fruited in year two ", zone: 6 };

let store: Map<string, number[]>;
beforeEach(() => {
  store = new Map();
});

describe("createPlannerTesterRoute: dispute", () => {
  it("forwards the cookie's token to Odoo in the body, with a clean dispute", async () => {
    const { odoo, planner } = client();
    const { POST } = createPlannerTesterRoute(odoo, "dispute", { allowedOrigins: [ORIGIN], store });
    const res = await POST(post(dispute, { cookie: `other=1; ${TESTER_COOKIE}=${TOKEN}` }));
    expect(res.status).toBe(200);
    expect(planner.dispute).toHaveBeenCalledTimes(1);
    expect(planner.dispute).toHaveBeenCalledWith({
      product_tmpl_id: 101,
      fact: "years_to_fruit",
      note: "Fruited in year two",
      zone: 6,
      contradicts: true,
      tester_token: TOKEN,
    });
  });

  it("refuses without the tester cookie (403) and never asks Odoo", async () => {
    const { odoo, planner } = client();
    const { POST } = createPlannerTesterRoute(odoo, "dispute", { allowedOrigins: [ORIGIN], store });
    const res = await POST(post(dispute, { cookie: null }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "not_a_tester" });
    // A token in the body is not a way in: only the HttpOnly cookie counts.
    expect((await POST(post({ ...dispute, tester_token: TOKEN }, { cookie: null }))).status).toBe(403);
    expect(planner.dispute).not.toHaveBeenCalled();
  });

  it("refuses an off-site Origin before reading the cookie", async () => {
    const { odoo, planner } = client();
    const { POST } = createPlannerTesterRoute(odoo, "dispute", { allowedOrigins: [ORIGIN], store });
    expect((await POST(post(dispute, { origin: "https://evil.example" }))).status).toBe(403);
    expect(planner.dispute).not.toHaveBeenCalled();
  });

  it("maps Odoo's answers: 403 not a tester, 503 off, 400 invalid, else 502", async () => {
    for (const [status, want] of [[403, 403], [503, 503], [404, 503], [400, 400], [500, 502]] as const) {
      const { odoo } = client({ dispute: vi.fn(async () => { throw new OdooApiError(status, "x", ""); }) });
      const { POST } = createPlannerTesterRoute(odoo, "dispute", { allowedOrigins: [ORIGIN], store: new Map() });
      expect((await POST(post(dispute))).status).toBe(want);
    }
  });

  it("rate-limits per tester token (429) without calling Odoo past the limit", async () => {
    const { odoo, planner } = client();
    const { POST } = createPlannerTesterRoute(odoo, "dispute", { allowedOrigins: [ORIGIN], store, now: () => 1_000 });
    for (let i = 0; i < 60; i++) await POST(post(dispute));
    expect((await POST(post(dispute))).status).toBe(429);
    expect(planner.dispute).toHaveBeenCalledTimes(60);
  });
});

describe("createPlannerTesterRoute: propose", () => {
  it("forwards one rule key and value with the token", async () => {
    const { odoo, planner } = client();
    const { POST } = createPlannerTesterRoute(odoo, "propose", { allowedOrigins: [ORIGIN], store });
    expect((await POST(post({ key: "marginal_penalty", value: 60 }))).status).toBe(200);
    expect(planner.propose).toHaveBeenCalledWith({ key: "marginal_penalty", value: 60, tester_token: TOKEN });
  });

  it("rejects an unknown key or a non-number (400) without calling Odoo", async () => {
    const { odoo, planner } = client();
    const { POST } = createPlannerTesterRoute(odoo, "propose", { allowedOrigins: [ORIGIN], store });
    expect((await POST(post({ key: "drop_table", value: 1 }))).status).toBe(400);
    expect((await POST(post({ key: "season_bonus", value: "4" }))).status).toBe(400);
    expect(planner.propose).not.toHaveBeenCalled();
  });
});

describe("cleanTesterBody", () => {
  it("drops unknown facts, bad ids and fractional zones", () => {
    expect(cleanTesterBody("dispute", { ...dispute, fact: "price" })).toBeNull();
    expect(cleanTesterBody("dispute", { ...dispute, product_tmpl_id: "101" })).toBeNull();
    expect(cleanTesterBody("dispute", { ...dispute, zone: 6.5 })).toBeNull();
    expect(cleanTesterBody("dispute", { product_tmpl_id: 5, fact: "stratum" })).toEqual({
      product_tmpl_id: 5, fact: "stratum", note: null, zone: null, contradicts: true,
    });
  });
});

describe("testerTokenFrom", () => {
  it("reads only a well-formed token from the cookie header", () => {
    const req = (cookie: string) => new Request("http://x/", { headers: { cookie } });
    expect(testerTokenFrom(req(`${TESTER_COOKIE}=${TOKEN}`))).toBe(TOKEN);
    expect(testerTokenFrom(req(`${TESTER_COOKIE}=short`))).toBeNull();
    expect(testerTokenFrom(req(`${TESTER_COOKIE}=${TOKEN}%3Cscript`))).toBeNull();
    expect(testerTokenFrom(new Request("http://x/"))).toBeNull();
  });
});

describe("testerDecision (/plan?tester=<token>)", () => {
  it("sets the cookie only for a token Odoo knows", async () => {
    expect(await testerDecision(client().odoo, TOKEN)).toBe("set");
    expect(await testerDecision(client({ testerStatus: vi.fn(async () => "invalid" as const) }).odoo, TOKEN)).toBe("clear");
  });

  it("keeps the cookie as it was when Odoo is off or unreachable", async () => {
    expect(await testerDecision(client({ testerStatus: vi.fn(async () => "off" as const) }).odoo, TOKEN)).toBe("keep");
    expect(await testerDecision(client({ testerStatus: vi.fn(async () => { throw new Error("ECONNREFUSED"); }) }).odoo, TOKEN)).toBe("keep");
  });

  it("clears a malformed token without asking Odoo", async () => {
    const { odoo, planner } = client();
    expect(await testerDecision(odoo, "nope")).toBe("clear");
    expect(planner.testerStatus).not.toHaveBeenCalled();
  });
});
