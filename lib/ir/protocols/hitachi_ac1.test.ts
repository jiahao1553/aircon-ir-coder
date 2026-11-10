import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { hitachiAc1 as p } from "./hitachi_ac1";

const base: ClimateState = { power: false, mode: "cool", temp: 23, fan: "auto", swingV: "off", swingH: "off" };

// TestIRHitachiAc1Class.ReconstructKnownGood (same bytes as TestDecodeHitachiAC1.NormalRealExample):
// model B, off with power toggle, cool, 23C, auto fan.
const knownGood = fromHex("B2 AE 4D 51 F0 61 84 00 00 00 00 10 98");
// Captured rawData from IRremoteESP8266 test/ir_Hitachi_test.cpp.
const raw = [
  3400, 3350, 450, 1250, 450, 400, 400, 1300, 400, 1300, 400, 400, 450, 400, 400, 1300,
  400, 400, 400, 1300, 400, 400, 450, 1250, 400, 450, 400, 1300, 400, 1250, 450, 1250,
  450, 400, 400, 450, 400, 1250, 450, 400, 400, 400, 400, 1300, 400, 1300, 400, 400,
  450, 1250, 450, 400, 400, 1300, 400, 400, 450, 1250, 400, 400, 450, 400, 400, 400,
  450, 1250, 400, 1300, 450, 1250, 450, 1250, 400, 1300, 400, 400, 450, 400, 400, 450,
  350, 450, 400, 400, 400, 1300, 400, 1300, 400, 400, 450, 400, 400, 400, 450, 400,
  400, 1300, 400, 1250, 450, 400, 400, 400, 450, 400, 400, 400, 450, 1250, 450, 400,
  400, 400, 450, 400, 400, 400, 450, 400, 400, 400, 450, 400, 400, 400, 450, 400,
  400, 400, 400, 450, 400, 400, 400, 400, 450, 400, 400, 400, 450, 400, 400, 450,
  400, 400, 400, 400, 450, 400, 400, 400, 450, 400, 400, 450, 400, 400, 400, 400,
  400, 450, 400, 400, 400, 400, 450, 400, 400, 400, 450, 400, 400, 400, 450, 400,
  400, 400, 450, 400, 400, 400, 450, 400, 400, 1300, 400, 400, 450, 400, 400, 400,
  400, 400, 450, 1250, 450, 400, 400, 400, 450, 1250, 450, 1250, 450, 400, 400, 400,
  450, 400, 400,
];

test("build reproduces TestIRHitachiAc1Class.ReconstructKnownGood", () => {
  assert.equal(hex(p.build(base, "b")), hex(knownGood));
  assert.deepEqual(p.parse(knownGood), {
    power: false,
    mode: "cool",
    temp: 23,
    fan: "auto",
    swingV: "off",
    swingH: "off",
    sleep: false,
  });
});

test("model A differs only in the model bits and checksum", () => {
  const a = p.build(base, "a");
  assert.equal(a[3], 0x91);
  assert.equal(hex(a.slice(4, 12)), hex(knownGood.slice(4, 12)));
});

test("demodulates the NormalRealExample capture", () => {
  assert.equal(hex(p.demodulate(raw) ?? []), hex(knownGood));
});

test("modulate -> demodulate round trip", () => {
  const b = p.build({ ...base, power: true, fan: "high", swingV: "swing", sleep: true });
  assert.equal(hex(p.demodulate(p.modulate(b)) ?? []), hex(b));
});

test("parse(build(s)) round trips every capability value", () => {
  const c = p.capabilities;
  for (const variant of ["a", "b"])
    for (const mode of c.modes)
      for (const fan of c.fans)
        for (const swingV of c.swingV)
          for (const swingH of c.swingH)
            for (const sleep of [false, true])
              for (let temp = c.temp.min; temp <= c.temp.max; temp++) {
                // Only cool keeps the requested fan; auto pins 25C; sleep exists in auto/cool only.
                if ((mode !== "cool" && fan !== "auto") || (mode === "auto" && temp !== 25)) continue;
                if (sleep && mode !== "auto" && mode !== "cool") continue;
                const want = mode === "cool" || mode === "auto" ? fan : "low";
                for (const power of [true, false]) {
                  const s = { ...base, power, mode, fan, swingV, swingH, temp, sleep };
                  assert.deepEqual(p.parse(p.build(s, variant)), { power, mode, temp, fan: want, swingV, swingH, sleep });
                }
              }
});
