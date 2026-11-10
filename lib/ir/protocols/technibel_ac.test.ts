import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { technibelAc as p } from "./technibel_ac";
import { fixtureTest, loadData } from "../core/fixtures";

const raw = loadData("fixtures/irremoteesp8266-s-to-y.json").captures.technibel as number[];
const base: ClimateState = { power: true, mode: "cool", temp: 18, fan: "medium", swingV: "auto", swingH: "off" };

fixtureTest("IRremoteESP8266 TestIRTechnibelAcClass.ConstructKnownState: 0x1881221200004B", () => {
  assert.equal(hex(p.build(base)), "18 81 22 12 00 00 4B");
  assert.equal(hex(p.demodulate(raw)!), "18 81 22 12 00 00 4B");
});

test("dry locks the fan to low", () => {
  assert.equal(p.parse(p.build({ ...base, mode: "dry", fan: "high" })).fan, "low");
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "heat", temp: 31, fan: "high", sleep: true, power: false, swingV: "off" });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
