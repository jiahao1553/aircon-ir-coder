import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { delonghiAc as p } from "./delonghi_ac";
import { roundTripFailures } from "./_roundtrip";

const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "off", swingH: "off" };

test("stateReset power off, cool 18°C, fan auto", () => {
  const want = fromHex("53 01 00 00 00 00 00 54");
  assert.equal(hex(p.build({ ...base, power: false, temp: 18 })), hex(want));
  assert.equal(p.parse(want).power, false);
  assert.equal(p.parse(want).temp, 18);
});

test("power on is 0x5500000000010153", () => {
  assert.equal(hex(p.build({ ...base, temp: 18 })), hex(fromHex("53 01 01 00 00 00 00 55")));
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "dry", fan: "low", turbo: true, sleep: true });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build) round-trips every capability", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});

test("TestDecodeDelonghiAc.RealExample raw", () => {
  const raw = [8984,4200,608,1516,608,1516,612,472,556,528,560,1564,556,528,560,1564,564,528,552,1572,556,1568,556,528,552,1572,556,1568,560,1564,552,1572,556,1576,552,1568,560,528,560,524,556,528,552,532,560,528,552,532,556,532,560,1564,560,528,552,1568,560,1564,564,524,556,528,560,524,556,536,556,1568,560,524,556,1568,560,1564,584,500,588,496,584,500,592,500,588,496,584,500,592,496,584,500,588,496,584,500,592,492,584,508,584,500,588,496,584,500,592,496,584,500,580,504,584,500,580,508,584,1544,584,500,588,496,584,1540,588,500,580,1540,588,1536,588,500,592];
  assert.equal(hex(p.demodulate(raw)!), "53 FB 01 0D 0D 00 00 69");
});
