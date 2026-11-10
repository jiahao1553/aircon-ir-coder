import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { airton as p } from "./airton";
import { roundTripFailures } from "./_roundtrip";

const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "off", swingH: "off" };

test("TestDecodeAirton.RealExample: heat 25°C, fan auto, swing off", () => {
  const want = fromHex("D3 11 0C 09 00 14 5E");
  assert.equal(hex(p.build({ ...base, mode: "heat", temp: 25 })), hex(want));
  assert.equal(p.parse(want).mode, "heat");
  assert.equal(p.parse(want).temp, 25);
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "heat", fan: "max", swingV: "auto", turbo: true, sleep: true });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build) round-trips every capability", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});

test("TestDecodeAirton.RealExample raw", () => {
  const raw = [6632,3352,404,1266,404,1264,406,430,406,430,400,1264,406,430,402,1264,408,1262,406,1264,404,430,402,434,402,432,402,1264,406,430,404,432,400,456,376,432,402,430,402,1264,404,1264,404,432,402,434,398,434,402,430,404,1264,404,432,402,430,404,1264,406,430,402,432,400,434,402,430,402,430,404,432,402,430,402,432,402,432,402,430,402,432,402,430,402,434,400,432,402,1264,404,430,404,1264,404,432,402,454,378,432,402,430,404,1264,404,1264,404,1264,378,1292,404,432,402,1264,404,432,402];
  assert.equal(hex(p.demodulate(raw)!), "D3 11 0C 09 00 14 5E");
});
