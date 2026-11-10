import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { trotec as p } from "./trotec";

const base: ClimateState = { power: true, mode: "cool", temp: 20, fan: "medium", swingV: "off", swingH: "off", sleep: true };

test("IRremoteESP8266 TestTrotecESPClass.MessageConstructon", () => {
  assert.equal(hex(p.build(base)), "12 34 29 82 00 00 00 00 AB");
});

test("modulate adds the second footer and demodulates", () => {
  const b = p.build({ ...base, mode: "dry", temp: 32, fan: "low", sleep: false, power: false });
  const pulses = p.modulate(b);
  assert.equal(pulses.at(-2), 592);
  assert.equal(pulses.at(-1), 1500);
  assert.equal(hex(p.demodulate(pulses)!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
