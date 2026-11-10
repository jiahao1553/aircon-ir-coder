import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { coronaAc as p } from "./corona_ac";
import { roundTripFailures } from "./_roundtrip";

const base: ClimateState = { power: true, mode: "heat", temp: 23, fan: "low", swingV: "off", swingH: "off", econo: true };

test("TestDecodeCoronaAc expected on state: heat 23°C, fan low, econo", () => {
  const want = fromHex("28 61 3D 19 E6 37 C8 28 61 6D FF 00 FF 00 28 61 CD FF 00 FF 00");
  assert.equal(hex(p.build(base)), hex(want));
  assert.equal(p.parse(want).mode, "heat");
  assert.equal(p.parse(want).temp, 23);
  assert.equal(p.parse(want).econo, true);
});

test("modulate sends the power button clear, then set, and demodulate keeps the last", () => {
  const b = p.build(base);
  const pulses = p.modulate(b);
  assert.equal(hex(p.demodulate(pulses)!), hex(b));
  assert.equal(pulses.length > 400, true);
});

test("parse(build) round-trips every capability", () => {
  assert.deepEqual(roundTripFailures(p, { ...base, mode: "cool", econo: false }), []);
});

test("TestDecodeCoronaAc rawData_On", () => {
  const raw = [3520,1686,460,386,452,454,408,452,410,1320,434,428,434,1296,410,452,490,374,438,1292,434,430,434,428,438,424,438,426,438,1266,464,1266,462,402,462,1266,464,400,462,1268,464,1266,462,1266,464,1268,486,376,462,402,472,1256,488,378,514,346,464,1266,488,1240,462,404,462,426,460,376,462,402,488,1240,464,1266,462,402,462,400,490,1240,462,1266,486,1244,460,1268,462,1266,462,1266,462,404,458,1270,458,1268,462,400,464,428,434,402,460,402,462,398,462,1268,462,404,460,402,460,1266,466,1264,462,10808,3502,1686,462,400,462,400,462,400,464,1266,462,404,458,1266,464,402,460,402,462,1266,464,404,458,402,460,400,488,374,464,1266,462,1266,466,398,462,1268,462,400,518,1208,438,1292,440,426,488,1242,466,1264,460,402,490,1238,490,1238,490,1242,514,1212,464,1268,490,1238,464,1266,490,1238,462,406,458,400,464,398,464,402,488,374,486,376,460,402,488,372,464,1268,462,1264,464,1266,462,1268,462,1266,466,1266,490,1242,458,1264,516,348,462,404,460,404,462,398,516,344,462,400,464,402,488,376,460,10810,3526,1658,462,404,460,400,488,374,464,1264,462,402,464,1266,462,402,486,374,462,1266,546,318,462,400,464,400,462,402,460,1268,466,1262,492,374,516,1212,464,400,462,1266,516,1212,464,402,462,424,462,1242,460,1268,488,1242,462,1268,490,1236,466,1264,462,1268,464,1266,460,1268,464,1266,462,338,528,402,486,374,462,402,460,402,490,374,458,406,458,402,488,1240,490,1238,462,1268,464,1268,490,1238,488,1242,462,1264,464,1270,462,398,436,426,460,406,458,404,434,424,464,400,462,400,460,402,462];
  assert.equal(hex(p.demodulate(raw)!), "28 61 3D 19 E6 37 C8 28 61 6D FF 00 FF 00 28 61 CD FF 00 FF 00");
});
