import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { goodweather as p } from "./goodweather";
import { roundTripFailures } from "./_roundtrip";

const base: ClimateState = { power: true, mode: "cool", temp: 20, fan: "low", swingV: "swing", swingH: "off" };

test("TestDecodeGoodweather.RealExampleDecode: cool 20°C, fan low, swing fast", () => {
  const want = fromHex("00 00 00 62 24 D5");
  assert.equal(hex(p.build(base)), hex(want));
  assert.equal(p.parse(want).fan, "low");
  assert.equal(p.parse(want).swingV, "swing");
  assert.equal(p.parse(want).temp, 20);
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "heat", temp: 28, fan: "high", swingV: "off", turbo: true, light: true, sleep: true });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build) round-trips every capability", () => {
  assert.deepEqual(roundTripFailures(p, { ...base, swingV: "off" }), []);
});

test("TestDecodeGoodweather rawData_4624AB", () => {
  const raw = [6828,6828,732,1780,652,1830,652,1806,678,1830,652,1806,678,1830,652,1830,652,1834,706,518,734,508,734,514,734,510,732,510,732,510,732,510,732,514,732,1776,706,1780,628,1854,628,1832,654,1832,654,1856,628,1832,634,1876,680,536,708,536,708,536,706,538,706,538,706,538,706,536,680,564,680,1828,708,1758,680,1804,680,1828,708,1778,732,1754,732,1754,732,1756,732,490,658,586,658,586,658,586,658,586,658,584,658,586,658,586,660,1850,704,520,658,1828,658,1826,658,1826,658,586,660,584,684,1826,730,490,686,1824,660,560,710,532,710,534,712,1776,712,1774,686,560,712,1774,712,1798,730,492,712,1798,684,1798,678,568,730,1756,686,1796,686,532,712,532,712,1796,728,494,712,532,738,1772,730,492,712,532,738,506,738,1772,660,582,728,1736,712,558,710,1750,710,558,710,510,738,1748,738,508,736,1772,684,534,736,1772,704,518,738,1772,660,1824,678,6770,684];
  assert.equal(hex(p.demodulate(raw)!), "00 00 00 62 24 D5");
});
