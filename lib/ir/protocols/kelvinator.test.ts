import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { kelvinator as p } from "./kelvinator";

const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "off", swingH: "off", light: false };

test("IRremoteESP8266 TestKelvinatorClass.SetAndGetRaw", () => {
  const reset: ClimateState = { power: false, mode: "auto", temp: 16, fan: "auto", swingV: "off", swingH: "off", light: false };
  assert.equal(hex(p.build(reset)), "00 00 00 50 00 00 00 A0 00 00 00 70 00 00 00 A0");
  assert.equal(
    hex(p.build({ ...reset, power: true, temp: 21, light: true })),
    "08 05 20 50 00 00 00 70 08 05 20 70 00 00 00 70",
  );
});

test("modulate and demodulate round-trip (the reference suite has no raw capture)", () => {
  const b = p.build({ ...base, fan: "max", swingV: "auto", swingH: "swing", quiet: true, clean: true });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
