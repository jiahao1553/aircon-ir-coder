import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { kelon168 as p } from "./kelon168";
import { roundTripFailures } from "./_roundtrip";
import { whirlpoolAc } from "./whirlpool_ac";

const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "off", swingH: "off" };

test("cool 24°C, auto fan, power on: model bits and absolute power bit", () => {
  assert.equal(hex(p.build(base)), "83 06 04 82 00 00 80 00 00 00 00 00 00 06 00 01 00 00 38 00 39");
});

test("power off clears only the absolute power bit", () => {
  const b = p.build({ ...base, power: false });
  assert.equal(b[18], 0x28);
  assert.equal(p.parse(b).power, false);
});

test("a Hisense frame is not a Whirlpool frame", () => {
  const pulses = p.modulate(p.build(base));
  assert.equal(whirlpoolAc.demodulate(pulses), null);
  assert.equal(hex(p.demodulate(pulses)!), hex(p.build(base)));
});

test("DG11R2 capture bytes: heat 23°C, min fan, power on", () => {
  const got = fromHex("83 06 03 70 00 00 8D 17 00 00 00 80 18 71 20 00 00 00 38 00 18");
  assert.equal(p.parse(got).mode, "heat");
  assert.equal(p.parse(got).temp, 23);
  assert.equal(p.parse(got).fan, "min");
  assert.equal(p.parse(got).power, true);
});

test("parse(build) round-trips every capability", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
