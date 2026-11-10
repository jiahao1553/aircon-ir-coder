import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { mitsubishi136 as p } from "./mitsubishi136";
import { fixtureTest, loadData } from "../core/fixtures";

const captures: Record<string, number[]> = loadData("fixtures/irremoteesp8266-mitsubishi136.json").captures;
const base: ClimateState = { power: true, mode: "cool", temp: 20, fan: "max", swingV: "highest", swingH: "off" };

fixtureTest("IRremoteESP8266 TestDecodeMitsubishi136.DecodeRealExample", () => {
  const want = "23 CB 26 21 00 40 41 37 04 00 00 BF BE C8 FB FF FF";
  assert.equal(hex(p.build(base)), want);
  assert.equal(hex(p.demodulate(captures.DecodeRealExample)!), want);
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "heat", temp: 26, fan: "low", swingV: "auto" });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
