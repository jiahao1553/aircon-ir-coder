import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { haierAc160 as p } from "./haier_ac160";

const base: ClimateState = { power: true, mode: "cool", temp: 26, fan: "low", swingV: "auto", swingH: "off" };

// TestDecodeHaierAC160.RealExample: on, cool, 26C, low fan, swing V auto.
const realExample = fromHex("A6 AC 00 00 40 60 00 20 00 00 00 00 05 17 B5 00 60 00 00 15");
// Captured rawData from IRremoteESP8266 test/ir_Haier_test.cpp.
const raw = [
  3078, 3002, 3058, 4338, 590, 1612, 588, 516, 584, 1588, 586, 542, 560, 540, 560, 1590,
  584, 1618, 584, 542, 558, 1592, 584, 542, 582, 1594, 584, 542, 582, 1592, 560, 1642,
  560, 516, 558, 544, 558, 542, 558, 542, 582, 518, 558, 542, 558, 516, 558, 542,
  558, 542, 582, 520, 558, 542, 558, 542, 564, 510, 608, 492, 558, 542, 582, 520,
  558, 542, 558, 544, 582, 492, 608, 1594, 558, 544, 558, 542, 582, 494, 608, 494,
  558, 544, 558, 542, 558, 544, 558, 1616, 582, 1620, 560, 542, 558, 542, 582, 494,
  558, 542, 558, 542, 558, 544, 556, 542, 582, 520, 580, 494, 582, 520, 582, 520,
  558, 542, 558, 542, 582, 520, 582, 492, 608, 1592, 582, 520, 558, 544, 558, 516,
  584, 518, 558, 542, 582, 520, 580, 520, 582, 520, 580, 492, 584, 516, 556, 544,
  582, 518, 580, 520, 580, 520, 580, 494, 606, 494, 580, 520, 580, 520, 582, 520,
  580, 520, 556, 518, 608, 492, 580, 520, 556, 544, 580, 520, 580, 520, 580, 494,
  606, 494, 580, 520, 580, 520, 580, 520, 580, 520, 580, 494, 606, 496, 578, 522,
  580, 520, 580, 520, 580, 520, 580, 494, 606, 494, 580, 520, 580, 520, 580, 1594,
  608, 494, 580, 1620, 580, 522, 580, 520, 580, 494, 578, 1620, 582, 520, 580, 1596,
  582, 1620, 582, 1594, 608, 1594, 582, 522, 580, 1594, 582, 1620, 582, 520, 580, 1596,
  582, 520, 580, 1620, 582, 494, 606, 496, 580, 522, 580, 522, 580, 520, 580, 520,
  580, 496, 604, 496, 580, 520, 580, 1620, 582, 1594, 582, 522, 578, 522, 580, 522,
  578, 522, 580, 496, 580, 522, 578, 522, 578, 522, 578, 524, 578, 522, 578, 496,
  578, 522, 578, 522, 578, 546, 554, 522, 578, 522, 578, 520, 556, 546, 554, 546,
  554, 546, 556, 544, 556, 546, 554, 520, 554, 544, 556, 1620, 582, 544, 556, 1594,
  580, 546, 556, 1594, 580,
];

test("build reproduces TestDecodeHaierAC160.RealExample", () => {
  assert.equal(hex(p.build(base)), hex(realExample));
  assert.deepEqual(p.parse(realExample), {
    power: true,
    mode: "cool",
    temp: 26,
    fan: "low",
    swingV: "auto",
    turbo: false,
    quiet: false,
    sleep: false,
    clean: false,
  });
});

test("heat sets the aux-heating bit", () => {
  assert.equal(p.build({ ...base, mode: "heat" })[4] & 0x80, 0x80);
});

test("demodulates the RealExample capture", () => {
  assert.equal(hex(p.demodulate(raw) ?? []), hex(realExample));
});

test("modulate -> demodulate round trip", () => {
  const b = p.build({ ...base, mode: "heat", temp: 30, fan: "high", swingV: "lowest", turbo: true, clean: true });
  assert.equal(hex(p.demodulate(p.modulate(b)) ?? []), hex(b));
});

test("parse(build(s)) round trips every capability value", () => {
  const c = p.capabilities;
  for (const mode of c.modes)
    for (const fan of c.fans)
      for (const swingV of c.swingV)
        for (const [turbo, quiet] of [[false, false], [true, false], [false, true]])
          for (const clean of [false, true])
            for (let temp = c.temp.min; temp <= c.temp.max; temp++) {
              if ((turbo || quiet) && mode !== "cool" && mode !== "heat") continue;
              const s = { ...base, mode, fan, swingV, temp, turbo, quiet, clean, sleep: clean };
              assert.deepEqual(p.parse(p.build(s)), {
                power: true,
                mode,
                temp,
                fan,
                swingV,
                turbo,
                quiet,
                sleep: clean,
                clean,
              });
            }
});
