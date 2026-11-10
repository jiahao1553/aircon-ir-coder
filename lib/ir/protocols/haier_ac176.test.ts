import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { haierAc176 as p } from "./haier_ac176";

const base: ClimateState = { power: true, mode: "cool", temp: 17, fan: "high", swingV: "middle", swingH: "middle" };

// First 14 bytes: TestDecodeHaierAC_YRW02.RealExample (on, cool, 17C, high, swing V middle).
// Tail: the high-fan tail of TestHaierAC176Class.BuildKnownState's expected state.
const known = fromHex("A6 12 00 02 40 20 00 20 00 00 00 00 05 3F B7 00 40 00 00 00 00 F7");
// Settings of TestIRac.Haier176 (cool, 23C, medium, highest, turbo, sleep); bytes produced by the IRremoteESP8266 class.
const iracTurbo = fromHex("A6 71 00 02 40 40 40 20 80 00 00 00 05 7E B7 00 80 00 00 00 00 37");
// TestDecodeHaierAC176.RealExample (its swing V value 6 has no named position).
const realExample = fromHex("A6 86 00 00 40 A0 00 20 00 00 00 00 05 31 B7 00 00 00 00 00 00 B7");
// Captured rawData from IRremoteESP8266 test/ir_Haier_test.cpp.
const raw = [
  3096, 2948, 3048, 4388, 588, 1610, 614, 498, 586, 1612, 612, 500, 612, 500, 586, 1610,
  588, 1612, 612, 502, 586, 1612, 612, 500, 612, 500, 614, 500, 612, 498, 586, 1610,
  586, 1612, 612, 502, 612, 500, 612, 500, 612, 500, 612, 500, 612, 500, 612, 500,
  612, 500, 612, 504, 612, 500, 612, 500, 612, 500, 612, 500, 612, 500, 612, 500,
  612, 500, 612, 502, 614, 498, 586, 1612, 612, 500, 612, 500, 612, 500, 612, 500,
  612, 500, 612, 502, 586, 1612, 612, 500, 586, 1610, 612, 500, 612, 498, 612, 500,
  614, 478, 634, 502, 612, 500, 612, 500, 612, 500, 612, 500, 612, 500, 612, 500,
  612, 498, 614, 504, 612, 500, 614, 500, 586, 1612, 612, 500, 612, 500, 612, 500,
  612, 500, 612, 502, 612, 500, 612, 500, 612, 500, 612, 500, 612, 500, 612, 500,
  612, 500, 612, 504, 614, 500, 612, 500, 612, 498, 614, 500, 612, 500, 612, 500,
  612, 500, 612, 482, 632, 500, 612, 502, 610, 500, 614, 500, 612, 500, 612, 500,
  612, 480, 632, 504, 612, 480, 632, 500, 612, 500, 612, 480, 632, 500, 612, 500,
  612, 500, 612, 502, 612, 500, 612, 500, 612, 500, 612, 500, 612, 500, 586, 1612,
  612, 500, 586, 1616, 612, 500, 612, 500, 586, 1610, 588, 1612, 612, 502, 612, 500,
  614, 498, 586, 1614, 586, 1612, 612, 500, 586, 1610, 586, 1592, 632, 498, 586, 1610,
  588, 1610, 586, 1614, 614, 500, 612, 480, 632, 500, 612, 500, 612, 500, 612, 500,
  614, 498, 612, 500, 614, 500, 614, 500, 612, 500, 612, 500, 614, 498, 614, 498,
  614, 500, 612, 504, 612, 500, 612, 500, 612, 500, 612, 498, 612, 502, 612, 500,
  614, 498, 612, 502, 612, 500, 612, 498, 614, 500, 612, 500, 612, 500, 612, 500,
  612, 500, 614, 502, 612, 500, 614, 478, 634, 498, 614, 500, 612, 500, 612, 500,
  612, 500, 612, 482, 634, 500, 612, 500, 612, 500, 612, 500, 614, 498, 614, 500,
  612, 480, 632, 502, 586, 1610, 614, 478, 608, 1610, 588, 1610, 612, 498, 586, 1610,
  588, 1610, 586, 1606, 612,
];

test("build reproduces the YRW02 RealExample head plus the BuildKnownState tail", () => {
  assert.equal(hex(p.build(base)), hex(known));
});

test("build reproduces the TestIRac.Haier176 settings", () => {
  const s: ClimateState = { ...base, temp: 23, fan: "medium", swingV: "highest", turbo: true, sleep: true };
  assert.equal(hex(p.build(s)), hex(iracTurbo));
  assert.deepEqual(p.parse(iracTurbo), {
    power: true,
    mode: "cool",
    temp: 23,
    fan: "medium",
    swingV: "highest",
    swingH: "middle",
    turbo: true,
    quiet: false,
    sleep: true,
  });
});

test("model B changes only the first byte and checksum", () => {
  const b = p.build(base, "b");
  assert.equal(b[0], 0x59);
  assert.equal(hex(b.slice(1, 13)), hex(known.slice(1, 13)));
  assert.equal(hex(p.demodulate(p.modulate(b)) ?? []), hex(b));
});

test("demodulates the RealExample capture", () => {
  assert.equal(hex(p.demodulate(raw) ?? []), hex(realExample));
});

test("modulate -> demodulate round trip", () => {
  const b = p.build({ ...base, mode: "heat", temp: 24, fan: "low", swingV: "lowest", swingH: "left", quiet: true });
  assert.equal(hex(p.demodulate(p.modulate(b)) ?? []), hex(b));
});

test("parse(build(s)) round trips every capability value", () => {
  const c = p.capabilities;
  for (const variant of ["a", "b"])
    for (const mode of c.modes)
      for (const fan of c.fans)
        for (const swingV of c.swingV)
          for (const swingH of c.swingH)
            for (const [turbo, quiet] of [[false, false], [true, false], [false, true]])
              for (let temp = c.temp.min; temp <= c.temp.max; temp++) {
                const heat = mode === "heat";
                if ((heat && swingV === "middle") || (!heat && swingV === "lowest")) continue;
                if ((turbo || quiet) && mode !== "cool" && !heat) continue;
                const s = { ...base, mode, fan, swingV, swingH, temp, turbo, quiet, sleep: quiet };
                assert.deepEqual(p.parse(p.build(s, variant)), {
                  power: true,
                  mode,
                  temp,
                  fan,
                  swingV,
                  swingH,
                  turbo,
                  quiet,
                  sleep: quiet,
                });
              }
});
