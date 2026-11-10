import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { mitsubishi112 as p } from "./mitsubishi112";
import { fixtureTest, loadData } from "../core/fixtures";

const captures: Record<string, number[]> = loadData("fixtures/irremoteesp8266-mitsubishi112.json").captures;
const base: ClimateState = { power: true, mode: "cool", temp: 23, fan: "quiet", swingV: "auto", swingH: "auto" };

fixtureTest("IRremoteESP8266 TestDecodeMitsubishi112.DecodeRealExample", () => {
  const want = "23 CB 26 01 00 24 03 08 3A 00 00 00 30 AE";
  assert.equal(hex(p.build(base)), want);
  assert.equal(hex(p.demodulate(captures.DecodeRealExample)!), want);
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, temp: 18, fan: "medium", swingV: "middle", swingH: "wide" });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
