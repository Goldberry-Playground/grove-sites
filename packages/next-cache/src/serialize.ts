/**
 * JSON that survives `Buffer` and `Map` values. Page and route cache entries carry both
 * (route bodies, RSC payloads, per-segment data), and plain `JSON.stringify` breaks them.
 */

const BUFFER_MARK = "__groveBuffer";
const MAP_MARK = "__groveMap";

export function serialize(value: unknown): string {
  return JSON.stringify(value, function replacer(this: Record<string, unknown>, key, val) {
    // `val` has already been through Buffer#toJSON, so read the raw value.
    const raw = this[key];
    if (Buffer.isBuffer(raw)) return { [BUFFER_MARK]: raw.toString("base64") };
    if (raw instanceof Map) return { [MAP_MARK]: [...raw.entries()] };
    return val as unknown;
  });
}

/** Parses `serialize` output. Throws on invalid JSON, like `JSON.parse`. */
export function deserialize(text: string): unknown {
  return JSON.parse(text, (_key, val: unknown) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      const b64 = obj[BUFFER_MARK];
      if (typeof b64 === "string") return Buffer.from(b64, "base64");
      const entries = obj[MAP_MARK];
      if (Array.isArray(entries)) return new Map(entries as Array<[unknown, unknown]>);
    }
    return val;
  });
}
