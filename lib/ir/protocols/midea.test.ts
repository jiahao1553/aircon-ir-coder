import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { midea as p } from "./midea";
import { fixtureTest, loadData } from "../core/fixtures";

const captures: Record<string, number[]> = loadData("fixtures/irremoteesp8266-midea.json").captures;
const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "low", swingV: "off", swingH: "off" };

test("IRremoteESP8266 TestMideaACClass.CelsiusRemoteTemp: on, cool, low, 17°C is 0xA18840FFFF56", () => {
  assert.equal(hex(p.build({ ...base, temp: 17 })), "56 FF FF 40 88 A1");
  assert.equal(hex(p.build({ ...base, temp: 30 })), "5D FF FF 4D 88 A1");
});

fixtureTest("IRremoteESP8266 TestDecodeMidea.DecodeRealExample: Fahrenheit 65°F auto", () => {
  const got = p.demodulate(captures.DecodeRealExample)!;
  assert.equal(hex(got), "6E FF FF 63 82 A1");
  assert.equal(p.parse(got).temp, 18);
  assert.equal(p.parse(got).mode, "auto");
});

test("modulate sends the word then its inverse; the second gap absorbs 100ms", () => {
  const pulses = p.modulate(p.build(base));
  assert.equal(pulses.length, 200);
  assert.deepEqual(pulses.slice(0, 2), [4480, 4480]);
  assert.equal(pulses[99], 5600);
  assert.equal(pulses[199], 105600);
  assert.equal(hex(p.demodulate(pulses)!), hex(p.build(base)));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
