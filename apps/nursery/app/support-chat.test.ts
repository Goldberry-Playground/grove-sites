import { describe, expect, it } from "vitest";
import { livechatAssetsEmbedSrc, livechatLoaderSrc } from "./support-chat";

describe("livechatLoaderSrc", () => {
  it("builds the im_livechat loader URL for a channel", () => {
    expect(livechatLoaderSrc("https://odoo.gatheringatthegrove.com", "3")).toBe(
      "https://odoo.gatheringatthegrove.com/im_livechat/loader/3",
    );
  });

  it("strips a trailing slash from the Odoo host so the path isn't doubled", () => {
    expect(livechatLoaderSrc("https://odoo.gatheringatthegrove.com/", "3")).toBe(
      "https://odoo.gatheringatthegrove.com/im_livechat/loader/3",
    );
  });

  it("url-encodes the channel id", () => {
    expect(livechatLoaderSrc("https://odoo.qa.gatheringatthegrove.com", "1 2")).toBe(
      "https://odoo.qa.gatheringatthegrove.com/im_livechat/loader/1%202",
    );
  });
});

describe("livechatAssetsEmbedSrc", () => {
  it("builds the im_livechat widget-bundle URL", () => {
    expect(livechatAssetsEmbedSrc("https://odoo.gatheringatthegrove.com")).toBe(
      "https://odoo.gatheringatthegrove.com/im_livechat/assets_embed.js",
    );
  });

  it("strips a trailing slash from the Odoo host so the path isn't doubled", () => {
    expect(livechatAssetsEmbedSrc("https://odoo.gatheringatthegrove.com/")).toBe(
      "https://odoo.gatheringatthegrove.com/im_livechat/assets_embed.js",
    );
  });
});
