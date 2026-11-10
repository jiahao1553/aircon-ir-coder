import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { sanyoAc88 as p } from "./sanyo_ac88";
import { fixtureTest, loadData } from "../core/fixtures";

const raw = loadData("fixtures/irremoteesp8266-s-to-y.json").captures.sanyoAc88 as number[];
const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "off", swingH: "off" };

test("stateReset with cool 24°C (IRSanyoAc88::stateReset)", () => {
  assert.equal(hex(p.build({ ...base, temp: 22 })), "AA 55 A0 16 00 00 00 01 00 00 10");
  assert.equal(hex(p.build(base)), "AA 55 A0 18 00 00 00 01 00 00 10");
});

fixtureTest("IRremoteESP8266 TestDecodeSanyoAc88.DecodeRealExamples", () => {
  const got = p.demodulate(raw)!;
  assert.equal(hex(got), "AA 59 A0 18 06 2A 12 00 00 00 80");
  assert.deepEqual(p.parse(got), { ...base, swingH: "off", turbo: false, sleep: false });
});

test("modulate sends three copies and demodulates", () => {
  const b = p.build({ ...base, mode: "heat", temp: 10, fan: "high", swingV: "auto", turbo: true, sleep: true, power: false });
  const pulses = p.modulate(b);
  assert.equal(pulses.filter((v) => v === 3675).length, 2);
  assert.equal(hex(p.demodulate(pulses)!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
