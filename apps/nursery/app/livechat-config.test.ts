import { describe, expect, it } from "vitest";
import { DEFAULT_LIVECHAT_ODOO_URL, resolveLivechatConfig } from "./livechat-config";

describe("resolveLivechatConfig", () => {
  it("is null (widget inert) when no channel id is set anywhere", () => {
    expect(resolveLivechatConfig({})).toBeNull();
    expect(resolveLivechatConfig({ LIVECHAT_ODOO_URL: "https://odoo.example" })).toBeNull();
  });

  it("treats a blank / whitespace channel id as unset", () => {
    expect(resolveLivechatConfig({ LIVECHAT_CHANNEL_ID: "" })).toBeNull();
    expect(resolveLivechatConfig({ LIVECHAT_CHANNEL_ID: "   " })).toBeNull();
    expect(resolveLivechatConfig({ NEXT_PUBLIC_LIVECHAT_CHANNEL_ID: " " })).toBeNull();
  });

  it("reads the runtime LIVECHAT_* keys and defaults the Odoo host to prod", () => {
    expect(resolveLivechatConfig({ LIVECHAT_CHANNEL_ID: "1" })).toEqual({
      channelId: "1",
      odooUrl: DEFAULT_LIVECHAT_ODOO_URL,
    });
  });

  it("honours an explicit runtime Odoo host (QA points at odoo.qa)", () => {
    expect(
      resolveLivechatConfig({
        LIVECHAT_CHANNEL_ID: "2",
        LIVECHAT_ODOO_URL: "https://odoo.qa.gatheringatthegrove.com",
      }),
    ).toEqual({ channelId: "2", odooUrl: "https://odoo.qa.gatheringatthegrove.com" });
  });

  it("falls back to the build-time NEXT_PUBLIC_* keys when the runtime keys are absent", () => {
    expect(
      resolveLivechatConfig({
        NEXT_PUBLIC_LIVECHAT_CHANNEL_ID: "7",
        NEXT_PUBLIC_LIVECHAT_ODOO_URL: "https://odoo.local",
      }),
    ).toEqual({ channelId: "7", odooUrl: "https://odoo.local" });
  });

  it("prefers runtime over build-time per key, and trims values", () => {
    expect(
      resolveLivechatConfig({
        LIVECHAT_CHANNEL_ID: " 1 ",
        NEXT_PUBLIC_LIVECHAT_CHANNEL_ID: "9",
        NEXT_PUBLIC_LIVECHAT_ODOO_URL: "https://odoo.local",
      }),
    ).toEqual({ channelId: "1", odooUrl: "https://odoo.local" });
  });

  it("does not let an empty runtime Odoo host mask the build-time one or the default", () => {
    expect(
      resolveLivechatConfig({ LIVECHAT_CHANNEL_ID: "1", LIVECHAT_ODOO_URL: "" })?.odooUrl,
    ).toBe(DEFAULT_LIVECHAT_ODOO_URL);
  });
});
