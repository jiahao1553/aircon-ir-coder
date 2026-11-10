import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { haierAc as p } from "./haier_ac";

const base: ClimateState = { power: true, mode: "cool", temp: 25, fan: "low", swingV: "off", swingH: "off" };

// TestHaierAcIssues.Issue668 expected_on_state: on, cool, 25C, low fan.
const issue668 = fromHex("A5 91 20 00 0C C0 20 00 42");
// TestDecodeHaierAC.RealExample1.
const real1 = fromHex("A5 01 20 01 00 C0 20 00 A7");
// Captured rawData from IRremoteESP8266 test/ir_Haier_test.cpp.
const raw = [
  3030, 3044, 3030, 4304, 576, 1694, 550, 582, 552, 1704, 552, 714, 550, 582, 550, 1706,
  552, 582, 550, 1836, 552, 582, 578, 568, 550, 582, 550, 714, 550, 582, 550, 582,
  552, 582, 550, 1836, 552, 582, 552, 580, 580, 1692, 550, 712, 552, 582, 550, 582,
  552, 580, 550, 714, 552, 582, 550, 582, 552, 582, 578, 698, 552, 580, 552, 582,
  552, 582, 552, 1836, 552, 580, 552, 582, 552, 582, 550, 714, 578, 568, 550, 582,
  550, 582, 552, 714, 550, 1706, 550, 1706, 550, 582, 550, 714, 552, 582, 580, 566,
  552, 582, 550, 714, 552, 580, 552, 580, 552, 1706, 550, 714, 550, 582, 552, 582,
  578, 568, 552, 712, 552, 582, 550, 582, 550, 582, 550, 712, 552, 582, 550, 582,
  552, 582, 578, 722, 552, 1704, 550, 582, 550, 1706, 550, 736, 550, 582, 550, 1706,
  550, 1704, 552, 1704, 578,
];

test("build reproduces TestHaierAcIssues.Issue668", () => {
  assert.equal(hex(p.build(base)), hex(issue668));
  assert.deepEqual(p.parse(issue668), {
    power: true,
    mode: "cool",
    temp: 25,
    fan: "low",
    swingV: "off",
    sleep: false,
  });
});

test("power off sends the off command", () => {
  assert.equal(p.build({ ...base, power: false })[1] & 0x0f, 0);
});

test("demodulates the RealExample1 capture", () => {
  assert.equal(hex(p.demodulate(raw) ?? []), hex(real1));
});

test("rejects a bad checksum (TestHaierACClass.MessageConstuction state)", () => {
  const good = fromHex("A5 96 EA CF 32 6D 6D 54 54");
  assert.notEqual(p.demodulate(p.modulate(good)), null);
  good[8] ^= 1;
  assert.equal(p.demodulate(p.modulate(good)), null);
});

test("modulate -> demodulate round trip", () => {
  const b = p.build({ ...base, mode: "heat", temp: 30, fan: "high", swingV: "swing", sleep: true });
  assert.equal(hex(p.demodulate(p.modulate(b)) ?? []), hex(b));
});

test("parse(build(s)) round trips every capability value", () => {
  const c = p.capabilities;
  for (const mode of c.modes)
    for (const fan of c.fans)
      for (const swingV of c.swingV)
        for (const sleep of [false, true])
          for (let temp = c.temp.min; temp <= c.temp.max; temp++)
            for (const power of [true, false]) {
              const s = { ...base, power, mode, fan, swingV, temp, sleep };
              assert.deepEqual(p.parse(p.build(s)), { power, mode, temp, fan, swingV, sleep });
            }
});
