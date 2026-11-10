import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { trotec3550 as p } from "./trotec_3550";
import { fixtureTest, loadData } from "../core/fixtures";

const raw = loadData("fixtures/irremoteesp8266-s-to-y.json").captures.trotec3550 as number[];
const base: ClimateState = { power: true, mode: "cool", temp: 18, fan: "high", swingV: "auto", swingH: "off" };

fixtureTest("IRremoteESP8266 TestDecodeTrotec3550.RealDecode", () => {
  const want = "55 23 00 05 00 00 31 88 36";
  assert.equal(hex(p.build(base)), want);
  assert.equal(hex(p.demodulate(raw)!), want);
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "fan_only", temp: 30, fan: "low", swingV: "off", power: false });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
