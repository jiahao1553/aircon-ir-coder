import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { argo as p } from "./argo";
import { roundTripFailures } from "./_roundtrip";

const base: ClimateState = { power: true, mode: "cool", temp: 20, fan: "auto", swingV: "auto", swingH: "off" };

test("WREM2 cool 20°C, fan auto, 25°C room sensor", () => {
  const want = fromHex("AC F5 00 A4 02 00 00 00 00 20 A6 01");
  assert.equal(hex(p.build(base, "wrem2")), hex(want));
  assert.equal(p.parse(want).temp, 20);
  assert.equal(p.parse(want).power, true);
});

test("TestArgoAC_WREM3Class.MessageConstructon_ACControl with the 25°C room sensor", () => {
  const state = { ...base, temp: 22, swingV: "swing" as const, light: true };
  assert.equal(hex(p.build(state, "wrem3")), hex(fromHex("0B 35 12 0F C2 23")));
});

test("modulate and demodulate round-trip", () => {
  for (const variant of ["wrem2", "wrem3"]) {
    const b = p.build({ ...base, mode: "heat", temp: 26, fan: "max", swingV: "highest", turbo: true, sleep: true }, variant);
    assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b), variant);
  }
});

test("parse(build) round-trips every capability", () => {
  assert.deepEqual(roundTripFailures(p, base, "wrem2"), []);
  assert.deepEqual(roundTripFailures(p, base, "wrem3"), []);
});

test("WREM3 keeps the extra fan speeds, econo and light", () => {
  for (const fan of ["low", "medium_high", "high"] as const) {
    const b = p.build({ ...base, fan, econo: true, light: true }, "wrem3");
    assert.equal(p.parse(b).fan, fan);
    assert.equal(p.parse(b).econo, true);
    assert.equal(p.parse(b).light, true);
  }
});
