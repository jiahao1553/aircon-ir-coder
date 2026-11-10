import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { teco as p } from "./teco";
import { fixtureTest, loadData } from "../core/fixtures";

const raw = loadData("fixtures/irremoteesp8266-s-to-y.json").captures.teco as number[];
const base: ClimateState = { power: true, mode: "cool", temp: 27, fan: "auto", swingV: "auto", swingH: "off", sleep: true };

fixtureTest("IRremoteESP8266 TestTecoACClass.ReconstructKnownMessage: 0x250002BC9", () => {
  assert.equal(hex(p.build(base)), "C9 2B 00 50 02");
  assert.equal(hex(p.demodulate(raw)!), "C9 2B 00 50 02");
  assert.equal(p.modulate(p.build(base)).length, 74);
});

test("power is an absolute bit", () => {
  assert.equal(p.parse(p.build({ ...base, power: false })).power, false);
  assert.equal((p.build({ ...base, power: false })[0] >> 3) & 1, 0);
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "heat", temp: 16, fan: "high", swingV: "off", sleep: false, light: true });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
