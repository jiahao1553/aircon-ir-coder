import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { teknopoint as p } from "./teknopoint";
import { fixtureTest, loadData } from "../core/fixtures";

const captures: Record<string, number[]> = loadData("fixtures/irremoteesp8266-teknopoint.json").captures;
const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "off", swingH: "off", light: true };

test("GZ055BE1 stateReset checksum is 0x83", () => {
  assert.equal(hex(p.build(base)), "23 CB 26 01 00 24 03 07 40 00 00 00 00 83");
});

fixtureTest("IRremoteESP8266 TestDecodeTeknopoint.RealExample: cool 16°C, swing highest, no timer bit", () => {
  const got = p.demodulate(captures.RealExample)!;
  assert.equal(hex(got), "23 CB 26 01 00 24 03 0F 08 00 00 00 00 53");
  assert.deepEqual(p.parse(got), { ...base, temp: 16, swingV: "highest", econo: false, turbo: false });
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, temp: 20.5, swingH: "swing", econo: true });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
