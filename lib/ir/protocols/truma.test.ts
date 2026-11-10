import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { truma as p } from "./truma";
import { fixtureTest, loadData } from "../core/fixtures";

const raw = loadData("fixtures/irremoteesp8266-s-to-y.json").captures.truma as number[];
const base: ClimateState = { power: true, mode: "cool", temp: 17, fan: "medium", swingV: "off", swingH: "off" };

test("IRremoteESP8266 TestTrumaAcClass.KnownMessageConstuction: on, cool, med, 17°C", () => {
  assert.equal(hex(p.build(base)), "81 EA E7 FF FF FF 54");
});

test("off, auto, 16°C, high is the reset word 0x50FFFFFFE6E781", () => {
  assert.equal(hex(p.build({ ...base, power: false, mode: "auto", temp: 16, fan: "high" })), "81 E7 E6 FF FF FF 50");
});

fixtureTest("IRremoteESP8266 TestDecodeTruma.RealExample: 16°C auto, power on", () => {
  const got = p.demodulate(raw)!;
  assert.equal(hex(got), "81 E0 E6 FF FF FF 49");
  assert.deepEqual(p.parse(got), { power: true, mode: "auto", temp: 16, fan: "high", swingV: "off", swingH: "off", quiet: false });
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, fan: "quiet", temp: 31 });
  assert.equal(p.modulate(b)[0], 20200);
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
