import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { mitsubishiHeavy88 as p } from "./mitsubishi_heavy_88";

const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "off", swingH: "off" };

test("IRremoteESP8266 TestDecodeMitsubishiHeavy.ZjsSyntheticExample bytes", () => {
  const state: ClimateState = { power: true, mode: "dry", temp: 25, fan: "auto", swingV: "off", swingH: "wide" };
  assert.equal(hex(p.build(state)), "AD 51 3C D9 26 48 B7 00 FF 8A 75");
});

test("modulate and demodulate round-trip (no published raw timing capture)", () => {
  const b = p.build({ ...base, fan: "turbo", swingV: "auto", swingH: "left", clean: true });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
