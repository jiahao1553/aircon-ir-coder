import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { hitachiAc264 as p } from "./hitachi_ac264";

const base: ClimateState = { power: false, mode: "heat", temp: 27, fan: "low", swingV: "off", swingH: "off" };

// TestIRHitachiAc264Class.ConstructKnownState (same bytes as TestDecodeHitachiAc264.RealExample): off, heat, 27C, min fan.
const knownState = fromHex(
  "01 10 00 40 BF FF 00 CC 33 92 6D 13 EC 6C 93 00 FF 00 FF 00 FF 00 FF 00 FF 16 E9 C1 3E 00 FF 00 FF",
);
// TestIRHitachiAc264Class.Issue1729_PowerOntoOff off_state: off, heat, 25C, auto fan.
const offState = fromHex(
  "01 10 00 40 BF FF 00 CC 33 92 6D 13 EC 64 9B 00 FF 00 FF 00 FF 00 FF 00 FF 56 A9 C1 3E 00 FF 00 FF",
);
// Captured rawData from IRremoteESP8266 test/ir_Hitachi_test.cpp.
const raw = [
  3392, 1752, 372, 1356, 344, 504, 344, 504, 344, 480, 370, 480, 370, 478, 370, 478,
  372, 480, 370, 478, 370, 480, 370, 478, 370, 480, 370, 1330, 370, 478, 370, 480,
  370, 478, 370, 478, 370, 480, 370, 478, 370, 480, 370, 504, 346, 504, 344, 480,
  370, 504, 346, 478, 370, 478, 370, 478, 372, 480, 370, 480, 370, 504, 346, 1330,
  370, 480, 370, 1356, 346, 1330, 370, 1354, 346, 1328, 370, 1330, 370, 1328, 370, 478,
  372, 1330, 370, 1328, 370, 1356, 346, 1354, 344, 1328, 372, 1354, 344, 1356, 344, 1330,
  370, 1328, 372, 480, 370, 478, 370, 504, 346, 478, 372, 476, 372, 504, 346, 480,
  370, 504, 344, 478, 372, 504, 344, 1328, 372, 1328, 372, 478, 370, 504, 346, 1330,
  370, 1328, 372, 1328, 370, 1356, 344, 478, 370, 478, 370, 1356, 344, 1328, 372, 480,
  370, 478, 372, 504, 346, 1330, 370, 478, 370, 480, 370, 1330, 370, 478, 370, 480,
  370, 1328, 370, 1330, 370, 480, 372, 1352, 346, 1328, 372, 504, 346, 1328, 370, 1328,
  370, 480, 370, 1328, 372, 1328, 370, 504, 344, 478, 372, 1330, 370, 478, 370, 480,
  370, 480, 370, 478, 370, 480, 370, 1356, 346, 1328, 370, 480, 370, 1330, 370, 1330,
  370, 1330, 370, 478, 370, 506, 344, 1328, 372, 1328, 372, 478, 372, 1330, 370, 1328,
  372, 478, 370, 1330, 370, 1328, 372, 504, 344, 480, 370, 1330, 370, 504, 344, 504,
  346, 1354, 346, 504, 346, 478, 372, 478, 370, 480, 370, 478, 370, 492, 358, 478,
  370, 478, 370, 1328, 372, 1330, 370, 1328, 372, 1354, 346, 1328, 372, 1328, 370, 1330,
  370, 1328, 372, 476, 372, 504, 346, 478, 372, 480, 370, 480, 370, 504, 344, 478,
  370, 480, 370, 1328, 370, 1330, 372, 1328, 370, 1330, 370, 1330, 370, 1330, 368, 1330,
  370, 1330, 370, 480, 370, 480, 370, 478, 370, 504, 344, 480, 370, 478, 370, 504,
  344, 478, 372, 1328, 370, 1330, 370, 1330, 370, 1330, 370, 1328, 372, 1356, 344, 1330,
  370, 1330, 370, 480, 370, 478, 370, 482, 368, 480, 370, 480, 370, 480, 370, 480,
  370, 480, 370, 1330, 370, 1354, 346, 1330, 370, 1354, 346, 1330, 370, 1330, 370, 1330,
  370, 1330, 370, 504, 346, 480, 370, 478, 372, 478, 372, 504, 344, 480, 370, 480,
  370, 504, 344, 1330, 370, 1328, 370, 1330, 372, 1328, 370, 1354, 346, 1328, 370, 1330,
  370, 1330, 370, 478, 370, 1330, 370, 1328, 372, 480, 370, 1330, 370, 480, 370, 480,
  370, 480, 370, 1356, 344, 478, 370, 506, 344, 1330, 370, 478, 370, 1330, 372, 1354,
  346, 1354, 346, 1328, 370, 478, 372, 478, 370, 480, 370, 504, 346, 480, 370, 1328,
  370, 1330, 370, 478, 370, 1330, 370, 1328, 370, 1330, 372, 1354, 344, 1328, 372, 504,
  346, 478, 370, 504, 346, 504, 346, 478, 370, 478, 370, 482, 368, 480, 370, 478,
  370, 480, 370, 1328, 372, 1328, 370, 1330, 370, 1328, 370, 1328, 370, 1330, 370, 1354,
  346, 1328, 372, 478, 370, 478, 370, 478, 372, 478, 372, 478, 372, 478, 372, 478,
  370, 478, 372, 1330, 370, 1328, 370, 1328, 372, 1328, 372, 1330, 444, 1256, 370, 1330,
  370, 1330, 442,
];

test("build reproduces TestIRHitachiAc264Class.ConstructKnownState", () => {
  assert.equal(hex(p.build(base)), hex(knownState));
  assert.deepEqual(p.parse(knownState), { power: false, mode: "heat", temp: 27, fan: "low" });
});

test("build reproduces TestIRHitachiAc264Class.Issue1729_PowerOntoOff", () => {
  assert.equal(hex(p.build({ ...base, temp: 25, fan: "auto" })), hex(offState));
});

test("demodulates the RealExample capture", () => {
  assert.equal(hex(p.demodulate(raw) ?? []), hex(knownState));
});

test("modulate -> demodulate round trip", () => {
  const b = p.build({ ...base, power: true, mode: "cool", fan: "high" });
  assert.equal(hex(p.demodulate(p.modulate(b)) ?? []), hex(b));
});

test("parse(build(s)) round trips every capability value", () => {
  const c = p.capabilities;
  for (const mode of c.modes)
    for (const fan of c.fans)
      for (let temp = c.temp.min; temp <= c.temp.max; temp++)
        for (const power of [true, false]) {
          const s = { ...base, power, mode, fan, temp };
          assert.deepEqual(p.parse(p.build(s)), { power, mode, temp, fan });
        }
});
