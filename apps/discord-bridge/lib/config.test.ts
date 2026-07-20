import { describe, it, expect } from "vitest";
import { loadConfig, loadBufferConfig, loadDiscordAppConfig, BUFFER_ORG_ID_DEFAULT } from "./config";

const full = {
  BUFFER_API_TOKEN: "buf",
  DISCORD_BOT_TOKEN: "bot",
  DISCORD_APP_ID: "app",
  DISCORD_PUBLIC_KEY: "pub",
  DISCORD_WEEKLY_INSIGHTS_CHANNEL_ID: "chan",
} as NodeJS.ProcessEnv;

describe("loadConfig", () => {
  it("resolves a full config and defaults the org id", () => {
    const cfg = loadConfig(full);
    expect(cfg.bufferOrgId).toBe(BUFFER_ORG_ID_DEFAULT);
    expect(cfg.weeklyInsightsChannelId).toBe("chan");
  });

  it("honors an explicit BUFFER_ORG_ID", () => {
    expect(loadConfig({ ...full, BUFFER_ORG_ID: "custom" }).bufferOrgId).toBe("custom");
  });

  it("throws listing every missing var", () => {
    expect(() => loadConfig({ BUFFER_API_TOKEN: "buf" } as NodeJS.ProcessEnv)).toThrow(
      /DISCORD_BOT_TOKEN.*DISCORD_APP_ID.*DISCORD_PUBLIC_KEY.*DISCORD_WEEKLY_INSIGHTS_CHANNEL_ID/,
    );
  });
});

describe("loadBufferConfig", () => {
  it("resolves just the Buffer creds (no Discord required)", () => {
    const cfg = loadBufferConfig({ BUFFER_API_TOKEN: "buf" } as NodeJS.ProcessEnv);
    expect(cfg.bufferToken).toBe("buf");
    expect(cfg.bufferOrgId).toBe(BUFFER_ORG_ID_DEFAULT);
  });

  it("throws when the Buffer token is absent", () => {
    expect(() => loadBufferConfig({} as NodeJS.ProcessEnv)).toThrow(/BUFFER_API_TOKEN/);
  });
});

describe("loadDiscordAppConfig", () => {
  it("resolves just the bot token + app id (no Buffer/channel required)", () => {
    const cfg = loadDiscordAppConfig({
      DISCORD_BOT_TOKEN: "bot",
      DISCORD_APP_ID: "app",
    } as NodeJS.ProcessEnv);
    expect(cfg.discordBotToken).toBe("bot");
    expect(cfg.discordAppId).toBe("app");
  });

  it("throws listing both missing vars", () => {
    expect(() => loadDiscordAppConfig({} as NodeJS.ProcessEnv)).toThrow(
      /DISCORD_BOT_TOKEN.*DISCORD_APP_ID/,
    );
  });
});
