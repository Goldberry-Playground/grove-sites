import { describe, expect, it } from "vitest";
import { deserialize, serialize } from "./serialize";

describe("serialize", () => {
  it("round-trips a Buffer (route bodies)", () => {
    const body = Buffer.from("<urlset>é</urlset>", "utf8");
    const out = deserialize(serialize({ kind: "APP_ROUTE", body, status: 200 })) as {
      body: Buffer;
    };
    expect(Buffer.isBuffer(out.body)).toBe(true);
    expect(out.body.equals(body)).toBe(true);
  });

  it("round-trips a Map, including Buffer values (page segment data)", () => {
    const segmentData = new Map<string, Buffer>([
      ["/_tree", Buffer.from([0, 1, 2, 255])],
      ["/shop/__PAGE__", Buffer.from("rsc")],
    ]);
    const out = deserialize(serialize({ kind: "APP_PAGE", segmentData })) as {
      segmentData: Map<string, Buffer>;
    };
    expect(out.segmentData).toBeInstanceOf(Map);
    expect([...out.segmentData.keys()]).toEqual(["/_tree", "/shop/__PAGE__"]);
    expect(out.segmentData.get("/_tree")?.equals(Buffer.from([0, 1, 2, 255]))).toBe(true);
  });

  it("leaves plain JSON values alone", () => {
    const value = { a: 1, b: [true, null, "x"], c: { __b: "x", __m: [] } };
    expect(deserialize(serialize(value))).toEqual(value);
  });
});
