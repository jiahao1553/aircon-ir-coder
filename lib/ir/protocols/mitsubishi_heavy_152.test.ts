import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { mitsubishiHeavy152 as p } from "./mitsubishi_heavy_152";
import { fixtureTest, loadData } from "../core/fixtures";

const captures: Record<string, number[]> = loadData("fixtures/irremoteesp8266-mitsubishi_heavy_152.json").captures;
const base: ClimateState = { power: true, mode: "heat", temp: 24, fan: "max", swingV: "auto", swingH: "auto" };

fixtureTest("IRremoteESP8266 TestMitsubishiHeavy152AcClass.HumanReadable and ZmsRealExample", () => {
  const want = "AD 51 3C E5 1A 0C F3 07 F8 04 FB 00 FF 00 FF 00 FF 80 7F";
  assert.equal(hex(p.build(base)), want);
  assert.equal(hex(p.demodulate(captures.ZmsRealExample)!), want);
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "cool", fan: "low", swingV: "highest", swingH: "right_max", quiet: true, sleep: true });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
