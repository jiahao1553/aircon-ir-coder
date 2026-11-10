import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { kelon as p } from "./kelon";
import { roundTripFailures } from "./_roundtrip";

const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "off", swingH: "off" };

test("TestDecodeKelon.TestPowerToggleDryMode: dry 26°C, toggle set", () => {
  const want = fromHex("83 06 04 83 00 00");
  assert.equal(hex(p.build({ ...base, power: false, mode: "dry", temp: 26 })), hex(want));
  assert.equal(p.parse(want).power, false);
  assert.equal(p.parse(want).mode, "dry");
  assert.equal(p.parse(want).temp, 26);
});

test("TestDecodeKelon.TestSwingToggleDryMode", () => {
  const want = fromHex("83 06 80 83 00 00");
  assert.equal(hex(p.build({ ...base, mode: "dry", temp: 26, swingV: "swing" })), hex(want));
  assert.equal(p.parse(want).swingV, "swing");
  assert.equal(p.parse(want).power, true);
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "heat", temp: 22, fan: "low", sleep: true, turbo: true });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build) round-trips every capability", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
