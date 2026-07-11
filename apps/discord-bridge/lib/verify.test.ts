import { describe, it, expect } from "vitest";
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { verifyDiscordRequest, ed25519PublicKey } from "./verify";

// Generate a real Ed25519 keypair and sign like Discord does (timestamp + body).
function makeSigner() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const rawPub = publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("hex");
  const sign = (timestamp: string, body: string): string =>
    cryptoSign(null, Buffer.from(timestamp + body, "utf8"), privateKey).toString("hex");
  return { rawPub, sign };
}

describe("verifyDiscordRequest", () => {
  const { rawPub, sign } = makeSigner();
  const ts = "1720440000";
  const body = JSON.stringify({ type: 1 });

  it("accepts a correctly-signed request", () => {
    const sig = sign(ts, body);
    expect(verifyDiscordRequest(rawPub, sig, ts, body)).toBe(true);
  });

  it("accepts a prebuilt KeyObject", () => {
    const key = ed25519PublicKey(rawPub);
    expect(verifyDiscordRequest(key, sign(ts, body), ts, body)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sig = sign(ts, body);
    expect(verifyDiscordRequest(rawPub, sig, ts, JSON.stringify({ type: 2 }))).toBe(false);
  });

  it("rejects a wrong timestamp", () => {
    const sig = sign(ts, body);
    expect(verifyDiscordRequest(rawPub, sig, "1720450000", body)).toBe(false);
  });

  it("rejects missing / malformed signature or timestamp", () => {
    expect(verifyDiscordRequest(rawPub, undefined, ts, body)).toBe(false);
    expect(verifyDiscordRequest(rawPub, "nothex!!", ts, body)).toBe(false);
    expect(verifyDiscordRequest(rawPub, sign(ts, body), undefined, body)).toBe(false);
  });

  it("rejects an invalid public key length", () => {
    expect(() => ed25519PublicKey("abcd")).toThrow(/32-byte hex/);
  });
});
