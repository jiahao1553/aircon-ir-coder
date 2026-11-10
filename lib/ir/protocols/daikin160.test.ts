import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { daikin160 as p } from "./daikin160";

const base: ClimateState = { power: false, mode: "cool", temp: 25, fan: "auto", swingV: "lowest", swingH: "off" };

test("TestDecodeDaikin160.RealExample: power off, cool 25°C, auto fan, swing lowest", () => {
  const want = fromHex("11 DA 27 F0 0D 00 0F 11 DA 27 00 D3 30 11 00 00 1E 0A 08 56");
  assert.equal(hex(p.build(base)), hex(want));
  assert.equal(hex(p.demodulate(realExample)!), hex(want));
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, power: true, mode: "heat", temp: 22, fan: "max", swingV: "highest" });
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
  5024, 2144, 342, 1786, 344, 706, 342, 706, 344, 706, 342, 1786,
  342, 706, 342, 708, 342, 708, 342, 708, 342, 1786, 342, 708,
  342, 1786, 342, 1788, 342, 708, 342, 1786, 344, 1786, 342, 1786,
  342, 1786, 342, 1786, 342, 708, 342, 708, 340, 1786, 344, 706,
  342, 708, 342, 706, 342, 708, 342, 708, 342, 706, 342, 1786,
  342, 1788, 342, 1786, 342, 1786, 342, 1788, 342, 706, 342, 1788,
  342, 1786, 342, 706, 342, 706, 342, 708, 342, 708, 342, 708,
  342, 708, 342, 706, 342, 708, 342, 708, 342, 706, 342, 706,
  342, 708, 342, 1786, 342, 1786, 342, 1786, 342, 1788, 342, 706,
  342, 706, 342, 706, 342, 708, 342, 29442, 5022, 2146, 342, 1786,
  342, 706, 342, 708, 342, 708, 342, 1788, 342, 706, 342, 706,
  342, 706, 342, 706, 342, 1788, 342, 708, 342, 1786, 342, 1786,
  342, 708, 342, 1786, 342, 1788, 342, 1786, 342, 1786, 342, 1786,
  342, 706, 342, 706, 342, 1786, 344, 706, 342, 706, 344, 706,
  342, 706, 342, 706, 342, 708, 342, 706, 342, 706, 342, 706,
  342, 706, 342, 1786, 342, 1786, 342, 706, 342, 706, 342, 1788,
  342, 708, 342, 1786, 342, 1786, 342, 706, 342, 706, 342, 706,
  342, 708, 342, 1786, 342, 1786, 342, 708, 342, 708, 342, 1786,
  342, 706, 342, 706, 344, 706, 342, 1786, 342, 708, 342, 706,
  342, 706, 342, 708, 342, 706, 342, 708, 342, 706, 342, 708,
  342, 706, 342, 704, 344, 706, 342, 706, 344, 706, 342, 706,
  342, 708, 342, 706, 342, 706, 344, 706, 342, 706, 342, 706,
  344, 1786, 342, 1786, 342, 1786, 342, 1786, 342, 706, 342, 706,
  344, 706, 342, 706, 342, 1786, 344, 706, 342, 1786, 342, 706,
  342, 708, 342, 706, 342, 706, 344, 706, 342, 706, 342, 706,
  342, 1786, 342, 706, 344, 706, 342, 706, 342, 708, 342, 706,
  342, 1788, 342, 1786, 342, 706, 344, 1786, 344, 706, 344, 1786,
  342, 708, 342,
];
