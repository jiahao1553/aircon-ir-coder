import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { sharpAc as p } from "./sharp_ac";
import { fixtureTest, loadData } from "../core/fixtures";

const captures: Record<string, number[]> = loadData("fixtures/irremoteesp8266-sharp_ac.json").captures;
const base: ClimateState = { power: true, mode: "cool", temp: 26, fan: "auto", swingV: "off", swingH: "off" };

test("IRremoteESP8266 TestSharpAcClass.Power: on (previously off) and off states", () => {
  assert.equal(hex(p.build(base)), "AA 5A CF 10 CB 11 22 00 08 80 00 E0 51");
  assert.equal(hex(p.build({ ...base, power: false })), "AA 5A CF 10 CB 21 22 00 08 80 00 E0 61");
});

test("IRremoteESP8266 TestSharpAcClass.ReconstructKnownState: on, auto, auto fan", () => {
  assert.equal(hex(p.build({ ...base, mode: "auto", temp: 15 })), "AA 5A CF 10 00 11 20 00 08 80 00 E0 01");
});

fixtureTest("IRremoteESP8266 TestDecodeSharpAc RealExample (cool-auto-27)", () => {
  const got = p.demodulate(captures.RealExample)!;
  assert.equal(hex(got), "AA 5A CF 10 CC 31 22 00 08 80 04 E0 41");
  assert.deepEqual(p.parse(got), { ...base, temp: 27 });
});

test("A705 / A903: heat becomes fan mode, A705 marks the temp byte with 0xD0", () => {
  const a705 = p.build({ ...base, temp: 20, fan: "max" }, "a705");
  assert.equal(a705[4], 0xd5);
  assert.deepEqual(p.parse(a705), { ...base, temp: 20, fan: "max" });
  assert.equal(p.parse(p.build({ ...base, mode: "heat" }, "a903")).mode, "fan_only");
  assert.equal(p.build({ ...base, fan: "low" }, "a903")[6] >> 4, 3);
});

test("a corrupted checksum is rejected", () => {
  const b = p.build(base);
  b[12] ^= 0x10;
  assert.equal(p.demodulate(p.modulate(b)), null);
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "heat", temp: 22, fan: "high", swingV: "lowest" });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips (heat base: the lowest vane is heat-only)", () => {
  assert.deepEqual(roundTripFailures(p, { ...base, mode: "heat" }), []);
});
