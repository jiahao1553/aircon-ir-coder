import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { daikin176 as p } from "./daikin176";

const base: ClimateState = { power: true, mode: "cool", temp: 25, fan: "max", swingV: "off", swingH: "auto" };

test("TestDaikin176Class.ReconstructKnownStates: cool 25°C, fan max, swing auto", () => {
  const want = fromHex("11 DA 17 18 04 00 1E 11 DA 17 18 00 73 00 21 00 00 20 35 00 20 23");
  assert.equal(hex(p.build(base)), hex(want));
});

test("TestDaikin176Class.UnitId: unit A and unit B", () => {
  const state = { ...base, temp: 24, swingH: "off" as const };
  const unitA = fromHex("11 DA 17 18 04 00 1E 11 DA 17 18 00 73 00 21 00 00 1E 36 00 20 22");
  const unitB = fromHex("11 DA 17 19 04 00 1F 11 DA 17 19 00 73 00 21 00 00 1E 36 00 20 23");
  assert.equal(hex(p.build(state, "a")), hex(unitA));
  assert.equal(hex(p.build(state, "b")), hex(unitB));
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "heat", temp: 22, fan: "min", swingH: "off" }, "b");
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("dry and fan lock the setpoint at 17°C", () => {
  for (const mode of ["dry", "fan_only"] as const) {
    assert.equal(p.parse(p.build({ ...base, mode, temp: 25 })).temp, 17);
    assert.equal(p.parse(p.build({ ...base, mode, temp: 25 })).mode, mode);
  }
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
