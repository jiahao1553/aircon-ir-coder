import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { transcold as p } from "./transcold";
import { fixtureTest, loadData } from "../core/fixtures";

const raw = loadData("fixtures/irremoteesp8266-s-to-y.json").captures.transcold as number[];
const base: ClimateState = { power: true, mode: "cool", temp: 19, fan: "auto", swingV: "off", swingH: "off" };

test("IRremoteESP8266 TestTranscoldAcClass.BuildKnownState: 0xEF6B54", () => {
  assert.equal(hex(p.build(base)), "EF 6B 54");
});

fixtureTest("IRremoteESP8266 TestDecodeTranscold.RealExample: 0xE96554", () => {
  const got = p.demodulate(raw)!;
  assert.equal(hex(got), "E9 65 54");
  assert.deepEqual(p.parse(got), { power: true, mode: "cool", temp: 22, fan: "min", swingV: "off", swingH: "off" });
});

test("power off and swing are their own frames", () => {
  assert.equal(hex(p.build({ ...base, power: false })), "EF 79 54");
  assert.equal(p.parse(fromHex("EF 79 54")).power, false);
  assert.equal(hex(p.build({ ...base, swingV: "swing" })), "E7 61 54");
  assert.equal(p.parse(fromHex("E7 61 54")).swingV, "swing");
});

test("modulate sends each byte then its complement", () => {
  const pulses = p.modulate(p.build(base));
  assert.equal(pulses[0], 5944);
  assert.equal(pulses.length, 2 + 3 * 16 * 2 + 4);
  assert.equal(hex(p.demodulate(pulses)!), hex(p.build(base)));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
