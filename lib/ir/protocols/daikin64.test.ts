import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { daikin64 as p } from "./daikin64";

const base: ClimateState = { power: false, mode: "cool", temp: 16, fan: "medium", swingV: "off", swingH: "off" };

test("TestDecodeDaikin64.RealExample: toggle frame, cool 16°C, medium fan", () => {
  const want = fromHex("16 42 20 07 16 16 16 7C");
  assert.equal(hex(p.build(base)), hex(want));
  assert.equal(hex(p.demodulate(realExample)!), hex(want));
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, power: true, mode: "heat", temp: 26, fan: "quiet", swingV: "auto", sleep: true });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build) round-trips capability values", () => {
  const cap = p.capabilities;
  const tempMode = "cool" as ClimateState["mode"];
  for (const mode of cap.modes) {
    assert.equal(p.parse(p.build({ ...base, mode })).mode, mode);
  }
  for (const fan of cap.fans) {
    assert.equal(p.parse(p.build({ ...base, fan })).fan, fan);
  }
  for (const swingV of cap.swingV) {
    assert.equal(p.parse(p.build({ ...base, swingV })).swingV, swingV);
  }
  for (const swingH of cap.swingH) {
    assert.equal(p.parse(p.build({ ...base, swingH })).swingH, swingH);
  }
  for (let t = cap.temp.min; t <= cap.temp.max + 1e-9; t += cap.temp.step) {
    const temp = Math.round(t * 2) / 2;
    assert.equal(p.parse(p.build({ ...base, mode: tempMode, temp })).temp, temp);
  }
  for (const feature of cap.features) {
    assert.equal(p.parse(p.build({ ...base, [feature]: true }))[feature], true);
    assert.equal(p.parse(p.build({ ...base, [feature]: false }))[feature], false);
  }
  for (const power of [true, false]) {
    assert.equal(p.parse(p.build({ ...base, power })).power, power);
  }
});

const realExample = [
  9864, 9778, 9810, 9728, 4666, 2482, 384, 342, 390, 922, 386, 928,
  388, 348, 388, 920, 386, 348, 390, 342, 384, 330, 414, 342,
  390, 922, 386, 348, 390, 342, 382, 352, 384, 352, 382, 924,
  386, 356, 382, 344, 384, 350, 388, 346, 390, 342, 386, 348,
  386, 928, 388, 348, 388, 354, 388, 888, 412, 928, 390, 896,
  416, 348, 386, 348, 388, 346, 388, 342, 384, 358, 388, 340,
  384, 926, 384, 932, 386, 346, 388, 922, 384, 350, 384, 348,
  384, 358, 382, 338, 394, 922, 388, 928, 386, 350, 384, 926,
  390, 344, 388, 342, 386, 356, 388, 338, 382, 928, 382, 932,
  390, 344, 386, 924, 390, 344, 388, 314, 414, 356, 384, 344,
  386, 346, 390, 926, 386, 924, 388, 924, 388, 926, 386, 924,
  388, 350, 388, 20258, 4670,
];
