import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { neoclima as p } from "./neoclima";
import { roundTripFailures } from "./_roundtrip";

const base: ClimateState = {
  power: true,
  mode: "cool",
  temp: 26,
  fan: "low",
  swingV: "off",
  swingH: "auto",
};

test("TestDecodeNeoclima.RealExample: cool 26°C, fan low, swing H on", () => {
  const want = fromHex("00 00 00 00 00 00 00 6A 00 2A A5 39");
  assert.equal(hex(p.build(base)), hex(want));
  assert.equal(p.parse(want).fan, "low");
  assert.equal(p.parse(want).swingH, "auto");
  assert.equal(p.parse(want).temp, 26);
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "heat", temp: 22, fan: "high", swingV: "auto", swingH: "off", turbo: true, sleep: true });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build) round-trips every capability", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});

test("TestDecodeNeoclima.RealExample raw", () => {
  const raw = [6112,7392,540,602,516,578,522,604,540,554,540,554,540,576,518,576,516,554,540,608,542,554,540,554,540,576,518,604,516,556,540,576,546,580,542,578,542,602,518,554,542,554,568,582,540,554,540,582,540,578,518,582,542,576,544,530,566,534,562,534,562,552,542,582,540,604,518,608,542,554,540,582,540,604,518,580,540,606,544,554,542,554,542,580,542,576,520,554,540,578,518,578,518,582,544,552,570,580,544,580,542,554,542,604,520,576,520,580,540,556,540,556,542,584,566,580,542,1622,542,554,542,1620,544,604,520,1642,518,1674,548,560,564,580,544,554,544,552,544,554,542,556,542,576,522,554,542,556,542,580,542,1670,520,578,520,1622,542,580,518,1646,520,558,568,552,546,1628,566,580,544,1668,522,576,520,578,520,1670,522,576,522,1670,496,1676,570,560,566,532,564,1648,544,1670,522,1650,544,552,544,576,520,7390,544];
  assert.equal(hex(p.demodulate(raw)!), "00 00 00 00 00 00 00 6A 00 2A A5 39");
});
