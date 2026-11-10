import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { york as p } from "./york";

const base: ClimateState = { power: true, mode: "heat", temp: 24, fan: "auto", swingV: "off", swingH: "off" };

test("IRremoteESP8266 TestDecodeYork.SyntheticDecode known-good state", () => {
  assert.equal(hex(p.build(base)), "08 10 07 02 40 08 03 18 01 60 00 00 00 00 EC F5 F2");
});

test("power is the absolute Power bit", () => {
  const off = p.build({ ...base, power: false });
  assert.equal((off[7] >> 4) & 1, 0);
  assert.equal(p.parse(off).power, false);
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "cool", temp: 18, fan: "low", swingV: "auto", power: false });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
