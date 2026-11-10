import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { sanyoAc as p } from "./sanyo_ac";
import { fixtureTest, loadData } from "../core/fixtures";

const raw = loadData("fixtures/irremoteesp8266-s-to-y.json").captures.sanyoAc as number[];
const base: ClimateState = { power: true, mode: "cool", temp: 21, fan: "auto", swingV: "upper_middle", swingH: "off", beep: true };

test("stateReset + power/mode/temp/fan/swing, beep left on (TestSanyoAcClass)", () => {
  assert.equal(hex(p.build(base)), "6A 71 51 00 20 85 00 00 2D");
});

fixtureTest("IRremoteESP8266 TestDecodeSanyoAc.DecodeRealExamples", () => {
  const got = p.demodulate(raw)!;
  assert.equal(hex(got), "6A 71 47 00 20 85 00 00 32");
  assert.equal(p.parse(got).temp, 21);
  assert.equal(p.parse(got).beep, true);
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "dry", temp: 16, fan: "low", swingV: "highest", sleep: true, beep: false });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
