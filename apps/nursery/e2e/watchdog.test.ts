import { describe, expect, it } from "vitest";
import { isLivechatAbortNoise, isWebKitRscPrefetchNoise } from "./watchdog";
import { collectFailures } from "./qa-helpers";

/**
 * Unit tests for the WebKit gate-noise filters (GOL-3786). Runs under vitest,
 * not Playwright: the Playwright config only collects `*.spec.ts`.
 *
 * The fixtures are verbatim entries from the Train #4 QA gate run of
 * 2026-11-05 (Actions run 42094119800, desktop-mac and iphone projects).
 */

const HOST = "nursery.qa.gatheringatthegrove.com";

const RSC_CONSOLE_ERROR =
  `Failed to fetch RSC payload for https://${HOST}/shop/american-plum. ` +
  "Falling back to browser navigation. TypeError: Load failed";
const RSC_PAGE_ERROR = `/${HOST}/shop/american-plum?_rsc=qXN8NJmu_w0Hw17h due to access control checks.`;

describe("isWebKitRscPrefetchNoise", () => {
  it("matches Next's prefetch fallback when WebKit aborted the fetch", () => {
    expect(isWebKitRscPrefetchNoise(RSC_CONSOLE_ERROR)).toBe(true);
    expect(
      isWebKitRscPrefetchNoise(
        `Failed to fetch RSC payload for https://${HOST}/. Falling back to browser navigation. TypeError: Load failed`,
      ),
    ).toBe(true);
    expect(
      isWebKitRscPrefetchNoise(
        `Failed to fetch RSC payload for https://${HOST}/cart. Falling back to browser navigation. ` +
          `/${HOST}/cart?_rsc=abc due to access control checks.`,
      ),
    ).toBe(true);
  });

  it("matches the page error WebKit raises for the aborted ?_rsc= request", () => {
    expect(isWebKitRscPrefetchNoise(RSC_PAGE_ERROR)).toBe(true);
  });

  it("is not a blanket 'Load failed' swallow", () => {
    expect(isWebKitRscPrefetchNoise("Load failed")).toBe(false);
    expect(isWebKitRscPrefetchNoise("TypeError: Load failed")).toBe(false);
    expect(isWebKitRscPrefetchNoise(`/${HOST}/api/cart/quote due to access control checks.`)).toBe(false);
  });

  it("does not match Next's prefetch fallback for a non-abort cause", () => {
    expect(
      isWebKitRscPrefetchNoise(
        `Failed to fetch RSC payload for https://${HOST}/shop. Falling back to browser navigation. Error: 500 Internal Server Error`,
      ),
    ).toBe(false);
  });

  it("never matches a 5xx resource error or an app exception", () => {
    expect(
      isWebKitRscPrefetchNoise("Failed to load resource: the server responded with a status of 500 (Internal Server Error)"),
    ).toBe(false);
    expect(isWebKitRscPrefetchNoise("TypeError: undefined is not an object (evaluating 'cart.lines')")).toBe(false);
    expect(isWebKitRscPrefetchNoise(`/${HOST}/api/checkout/session due to access control checks.`)).toBe(false);
  });
});

describe("isLivechatAbortNoise", () => {
  it("matches the Odoo livechat long-poll abort by message or stack", () => {
    expect(
      isLivechatAbortNoise({
        message: `Error: Connection to "https://odoo.qa.gatheringatthegrove.com/im_livechat/cors/action" couldn't be established or was interrupted`,
      }),
    ).toBe(true);
    expect(isLivechatAbortNoise({ message: "[object Event]", stack: "at boot (https://odoo.qa.gatheringatthegrove.com/im_livechat/embed.js:1:1)" })).toBe(
      true,
    );
    expect(isLivechatAbortNoise({ message: "[object Event]", stack: "" })).toBe(false);
  });
});

/**
 * A minimal stand-in for a Playwright `Page`: enough of the event surface for
 * `collectFailures` to wire its listeners, plus the browser-type lookup it
 * uses to gate the WebKit filters.
 */
function fakePage(engine: "webkit" | "chromium") {
  const listeners = new Map<string, ((arg: unknown) => void)[]>();
  const page = {
    on(event: string, fn: (arg: unknown) => void) {
      listeners.set(event, [...(listeners.get(event) ?? []), fn]);
      return page;
    },
    context: () => ({ browser: () => ({ browserType: () => ({ name: () => engine }) }) }),
  };
  const emit = (event: string, arg: unknown) => listeners.get(event)?.forEach((fn) => fn(arg));
  return {
    page: page as unknown as Parameters<typeof collectFailures>[0],
    consoleError: (text: string) => emit("console", { type: () => "error", text: () => text }),
    pageError: (message: string, stack = "") => emit("pageerror", { message, stack }),
    response: (status: number, method: string, url: string) =>
      emit("response", { status: () => status, url: () => url, request: () => ({ method: () => method }) }),
  };
}

describe("collectFailures", () => {
  it("drops the RSC prefetch and livechat shapes on WebKit, keeps everything else", () => {
    const fake = fakePage("webkit");
    const { failures, responses5xx } = collectFailures(fake.page);
    fake.consoleError(RSC_CONSOLE_ERROR);
    fake.pageError(RSC_PAGE_ERROR);
    fake.pageError(`Error: Connection to "https://odoo.qa.gatheringatthegrove.com/im_livechat/cors/action" couldn't be established or was interrupted`);
    expect(failures).toEqual([]);

    // A real 5xx page error, a 5xx response and an app exception still fail.
    fake.consoleError("Failed to load resource: the server responded with a status of 502 (Bad Gateway)");
    fake.response(500, "POST", `https://${HOST}/api/checkout/session`);
    fake.pageError("TypeError: undefined is not an object (evaluating 'cart.lines')");
    expect(failures).toEqual([
      "console.error: Failed to load resource: the server responded with a status of 502 (Bad Gateway)",
      `HTTP 500 POST https://${HOST}/api/checkout/session`,
      "pageerror: TypeError: undefined is not an object (evaluating 'cart.lines')",
    ]);
    expect(responses5xx).toHaveLength(1);
  });

  it("does not loosen Chromium: the same shapes still fail there", () => {
    const fake = fakePage("chromium");
    const { failures } = collectFailures(fake.page);
    fake.consoleError(RSC_CONSOLE_ERROR);
    fake.pageError(RSC_PAGE_ERROR);
    expect(failures).toEqual([`console.error: ${RSC_CONSOLE_ERROR}`, `pageerror: ${RSC_PAGE_ERROR}`]);
  });
});
