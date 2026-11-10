import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { bosch144 as p } from "./bosch144";
import { roundTripFailures } from "./_roundtrip";

const base: ClimateState = { power: true, mode: "cool", temp: 16, fan: "max", swingV: "off", swingH: "off" };

test("TestDecodeBosch144.RealExample: cool 16°C, fan max, quiet off", () => {
  const want = fromHex("B2 4D 3F C0 00 FF B2 4D 3F C0 00 FF D5 64 00 10 00 49");
  assert.equal(hex(p.build(base)), hex(want));
  assert.equal(p.parse(want).fan, "max");
  assert.equal(p.parse(want).temp, 16);
});

test("power off is the 96-bit message", () => {
  assert.equal(hex(p.build({ ...base, power: false })), hex(fromHex("B2 4D 7B 84 E0 1F B2 4D 7B 84 E0 1F")));
});

test("modulate and demodulate round-trip", () => {
  for (const state of [base, { ...base, power: false }, { ...base, mode: "dry" as const, quiet: true, temp: 24 }]) {
    const b = p.build(state);
    assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
  }
});

test("parse(build) round-trips every capability", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});

test("TestDecodeBosch144.RealExample raw", () => {
  const raw = [4380,4400,528,1646,504,570,504,1646,504,1646,504,572,502,570,504,1646,504,570,504,572,502,1646,504,570,502,570,502,1648,502,1646,502,570,502,1646,504,572,502,572,502,1644,504,1646,504,1646,504,1646,502,1648,500,1646,504,1646,504,1646,504,572,502,570,504,570,504,570,504,570,504,570,506,570,502,572,502,570,502,572,502,572,502,572,502,572,502,572,500,1648,502,1644,502,1646,504,1646,502,1646,504,1646,504,1644,504,1646,504,5234,4360,4422,504,1646,502,596,478,1670,478,1646,504,570,504,572,500,1646,502,572,502,572,502,1644,506,570,502,570,504,1644,506,1644,502,574,502,1644,504,570,504,570,504,1644,504,1646,504,1644,506,1644,504,1646,504,1646,504,1644,504,1646,502,570,504,570,504,570,504,570,502,570,504,570,502,572,502,570,504,570,504,570,504,570,502,572,502,570,506,570,504,1646,502,1646,504,1646,504,1646,504,1646,502,1644,504,1644,504,1646,502,5236,4360,4424,504,1646,504,1646,502,572,504,1644,504,570,504,1646,504,570,502,1644,504,570,504,1644,506,1646,502,572,502,572,502,1646,504,570,504,570,504,570,502,572,504,570,504,570,504,570,502,572,502,570,504,570,502,570,504,572,502,572,502,1646,504,570,504,570,504,570,502,574,502,572,502,572,502,572,502,572,502,572,502,570,504,572,502,572,502,572,502,1646,504,572,502,570,502,1646,504,572,504,570,504,1644,504];
  assert.equal(hex(p.demodulate(raw)!), "B2 4D 3F C0 00 FF B2 4D 3F C0 00 FF D5 64 00 10 00 49");
});
