import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { haierAcYrw02 as p } from "./haier_ac_yrw02";

const base: ClimateState = { power: true, mode: "cool", temp: 17, fan: "high", swingV: "middle", swingH: "middle" };

// TestDecodeHaierAC_YRW02.RealExample: on, cool, 17C, high fan, swing V middle.
const realExample = fromHex("A6 12 00 02 40 20 00 20 00 00 00 00 05 3F");
// Settings of TestIRac.HaierYrwo2 (cool, 23C, medium, highest, swing H auto, quiet, sleep);
// bytes produced by the IRremoteESP8266 class.
const iracQuiet = fromHex("A6 71 E0 02 40 40 80 20 80 00 00 00 05 9E");
// Captured rawData from IRremoteESP8266 test/ir_Haier_test.cpp.
const raw = [
  2998, 3086, 2998, 4460, 568, 1640, 596, 492, 514, 1690, 590, 496, 566, 532, 592, 1596,
  570, 1618, 518, 584, 590, 538, 524, 536, 568, 532, 590, 1596, 516, 612, 568, 538,
  522, 1638, 586, 500, 512, 614, 568, 538, 520, 538, 586, 538, 566, 540, 520, 538,
  586, 538, 522, 538, 588, 538, 568, 538, 520, 538, 586, 538, 566, 538, 520, 540,
  588, 1596, 590, 536, 568, 538, 520, 1592, 640, 538, 520, 540, 588, 538, 568, 538,
  516, 562, 566, 538, 518, 542, 586, 540, 566, 1596, 590, 538, 566, 538, 516, 544,
  586, 538, 516, 542, 588, 540, 564, 540, 468, 590, 588, 538, 566, 540, 466, 590,
  588, 538, 514, 544, 588, 538, 566, 538, 468, 1692, 606, 526, 466, 592, 588, 538,
  568, 490, 588, 538, 566, 540, 466, 592, 588, 538, 566, 538, 466, 592, 588, 538,
  568, 492, 586, 540, 566, 540, 468, 590, 588, 538, 568, 516, 488, 590, 588, 538,
  568, 492, 588, 538, 566, 518, 488, 590, 588, 540, 564, 518, 490, 590, 588, 538,
  562, 496, 588, 538, 566, 518, 488, 590, 588, 538, 562, 522, 488, 588, 590, 538,
  560, 498, 588, 540, 564, 522, 486, 590, 590, 538, 560, 524, 488, 588, 588, 1598,
  514, 608, 564, 1600, 548, 536, 586, 538, 568, 1594, 590, 1618, 578, 1606, 606, 1582,
  590, 1596, 590, 1616, 580,
];

const off = { turbo: false, quiet: false, sleep: false };

test("build reproduces TestDecodeHaierAC_YRW02.RealExample", () => {
  assert.equal(hex(p.build(base)), hex(realExample));
  assert.deepEqual(p.parse(realExample), {
    power: true,
    mode: "cool",
    temp: 17,
    fan: "high",
    swingV: "middle",
    swingH: "middle",
    ...off,
  });
});

test("build reproduces the TestIRac.HaierYrwo2 settings", () => {
  const s: ClimateState = { ...base, temp: 23, fan: "medium", swingV: "highest", swingH: "auto", quiet: true, sleep: true };
  assert.equal(hex(p.build(s)), hex(iracQuiet));
});

test("demodulates the RealExample capture", () => {
  assert.equal(hex(p.demodulate(raw) ?? []), hex(realExample));
});

test("modulate -> demodulate round trip", () => {
  const b = p.build({ ...base, mode: "heat", temp: 30, fan: "auto", swingV: "auto", turbo: true });
  assert.equal(hex(p.demodulate(p.modulate(b)) ?? []), hex(b));
});

test("parse(build(s)) round trips every capability value", () => {
  const c = p.capabilities;
  for (const mode of c.modes)
    for (const fan of c.fans)
      for (const swingV of c.swingV)
        for (const swingH of c.swingH)
          for (const [turbo, quiet] of [[false, false], [true, false], [false, true]])
            for (let temp = c.temp.min; temp <= c.temp.max; temp++) {
              const heat = mode === "heat";
              if ((heat && swingV === "middle") || (!heat && swingV === "lowest")) continue;
              if ((turbo || quiet) && mode !== "cool" && !heat) continue;
              const s = { ...base, mode, fan, swingV, swingH, temp, turbo, quiet, sleep: turbo };
              assert.deepEqual(p.parse(p.build(s)), { power: true, mode, temp, fan, swingV, swingH, turbo, quiet, sleep: turbo });
            }
});
