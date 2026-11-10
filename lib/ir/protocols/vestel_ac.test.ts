import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { vestelAc as p } from "./vestel_ac";
import { fixtureTest, loadData } from "../core/fixtures";

const raw = loadData("fixtures/irremoteesp8266-s-to-y.json").captures.vestel as number[];
const base: ClimateState = { power: true, mode: "cool", temp: 21, fan: "high", swingV: "auto", swingH: "off" };

test("setters on the default 56-bit word: cool 21°C, high, swing, turbo, on", () => {
  assert.equal(hex(p.build({ ...base, turbo: true })), "01 E2 AE 07 50 1B F0");
});

fixtureTest("IRremoteESP8266 TestDecodeVestelAc.RealNormalExample: 0xF4410001FF1201", () => {
  const got = p.demodulate(raw)!;
  assert.equal(hex(got), "01 12 FF 01 00 41 F4");
  assert.equal(p.parse(got).mode, "heat");
  assert.equal(p.parse(got).power, true);
  assert.equal(p.parse(got).fan, "auto");
  assert.equal(p.parse(got).swingV, "off");
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "dry", temp: 18, fan: "low", swingV: "off", turbo: false, sleep: true, power: false });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
