import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { airwell as p } from "./airwell";
import { roundTripFailures } from "./_roundtrip";

const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "off", swingH: "off" };

test("stateReset + heat 25°C, fan auto, toggle set", () => {
  const want = fromHex("02 00 50 B0 02");
  assert.equal(hex(p.build({ ...base, power: false, mode: "heat", temp: 25 })), hex(want));
  assert.equal(p.parse(want).mode, "heat");
  assert.equal(p.parse(want).temp, 25);
});

test("TestDecodeAirwell.RealExample value 0x2B0D0181B keeps the capture's fixed bits", () => {
  const want = fromHex("1B 18 D0 B0 02");
  assert.equal(p.parse(want).power, false);
  assert.equal(p.parse(want).mode, "heat");
  assert.equal(p.parse(want).fan, "auto");
  assert.equal(p.parse(want).temp, 25);
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, power: false, mode: "dry", temp: 30, fan: "high" });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build) round-trips every capability", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});

test("TestDecodeAirwell.RealExample raw", () => {
  const raw = [2860,3862,1924,1952,1926,1952,956,984,1924,1028,952,958,980,956,982,1882,1016,950,1958,1920,1948,1004,954,956,984,956,952,984,974,966,974,964,974,1888,1010,960,1948,1002,946,962,978,962,976,960,948,992,978,1886,982,984,1924,1954,952,986,3892,3862,1924,1954,1924,1954,984,952,1956,996,954,990,948,958,980,1882,1016,952,1958,1920,1956,994,944,962,986,956,972,962,976,962,978,964,952,1908,1010,960,1948,1002,946,960,978,962,946,990,978,960,978,1888,1008,954,1952,1928,982,956,3920,3830,1946,1934,1954,1922,976,962,1946,1006,922,990,948,988,950,1910,1008,964,1922,1952,1924,1030,920,984,954,986,952,986,952,984,954,986,952,1910,1010,960,1928,1024,944,996,924,984,954,988,950,984,954,1910,1008,960,1920,1958,980,958,4800];
  assert.equal(hex(p.demodulate(raw)!), "1B 18 D0 B0 02");
});
