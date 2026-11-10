import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { amcor as p } from "./amcor";
import { roundTripFailures } from "./_roundtrip";

const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "off", swingH: "off" };

test("TestDecodeAmcor.RealExample: cool 27°C, fan auto", () => {
  const want = fromHex("01 41 36 00 00 30 00 12");
  assert.equal(hex(p.build({ ...base, temp: 27 })), hex(want));
  assert.equal(p.parse(want).temp, 27);
});

test("TestDecodeAmcor cool 12°C", () => {
  assert.equal(hex(p.build({ ...base, temp: 12 })), hex(fromHex("01 41 18 00 00 30 00 12")));
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "heat", temp: 30, fan: "min", turbo: true });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
  assert.equal(p.modulate(b).length > 100, true);
});

test("parse(build) round-trips every capability", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});

test("TestDecodeAmcor.RealExample raw", () => {
  const raw = [8210,4276,1544,480,596,1510,596,1510,596,1692,388,1534,596,1510,596,1510,596,1684,1450,480,596,1510,570,1534,570,1718,386,1536,594,1500,1632,482,596,1694,362,1550,1632,472,1658,456,596,1684,1474,446,1634,480,572,1534,572,1718,362,1558,572,1534,570,1534,570,1720,360,1558,572,1534,570,1534,570,1718,360,1560,572,1534,570,1534,570,1718,362,1560,572,1532,572,1534,570,1718,362,1558,572,1532,572,1534,570,1710,1448,472,1634,480,572,1534,570,1718,362,1558,572,1534,570,1534,572,1716,362,1560,572,1534,572,1534,570,1718,362,1550,1634,480,570,1536,570,1710,1448,482,570,1534,570,1536,570,1508,1856,34298,8218,4314,1502,522,530,1576,504,1602,504,1786,392,1528,504,1600,504,1600,504,1770,1414,522,528,1578,502,1602,504,1784,394,1528,504,1584,1574,548,528,1762,392,1512,1572,530,1600,524,528,1744,1390,530,1574,546,506,1600,504,1784,394,1528,504,1600,578,1528,504,1784,394,1526,504,1600,504,1600,506,1784,394,1528,504,1602,504,1602,504,1784,394,1526,506,1600,504,1600,506,1784,392,1526,506,1600,504,1602,502,1768,1390,530,1574,548,504,1600,504,1786,392,1530,504,1600,504,1600,504,1786,392,1528,504,1600,504,1600,506,1784,394,1512,1574,548,504,1602,504,1768,1388,548,504,1602,504,1602,502,1574,1792];
  assert.equal(hex(p.demodulate(raw)!), "01 41 36 00 00 30 00 12");
});
