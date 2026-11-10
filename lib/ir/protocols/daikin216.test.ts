import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { daikin216 as p } from "./daikin216";

const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "off", swingH: "off" };

test("TestDaikin216Class.ReconstructKnownState: power off, auto 19°C, auto fan", () => {
  const want = fromHex("11 DA 27 F0 00 00 00 02 11 DA 27 00 00 00 26 00 A0 00 00 00 00 00 00 C0 00 00 98");
  assert.equal(hex(p.build({ ...base, power: false, mode: "auto", temp: 19 })), hex(want));
});

test("TestDecodeDaikin216.RealExample demodulates", () => {
  const want = fromHex("11 DA 27 F0 00 00 00 02 11 DA 27 00 00 00 26 00 A0 00 00 00 00 00 00 C0 00 00 98");
  assert.equal(hex(p.demodulate(realExample)!), hex(want));
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "dry", temp: 28, fan: "quiet", swingV: "auto", swingH: "auto", turbo: true });
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
  3402, 1770, 382, 1340, 382, 480, 382, 478, 382, 480, 380, 1342,
  382, 478, 356, 504, 382, 480, 380, 478, 384, 1342, 380, 480,
  380, 1342, 382, 1342, 382, 478, 382, 1340, 382, 1340, 384, 1340,
  382, 1342, 382, 1340, 380, 480, 382, 480, 382, 1296, 426, 480,
  380, 480, 382, 480, 380, 480, 382, 480, 382, 478, 382, 1342,
  382, 1342, 382, 1340, 356, 1368, 382, 478, 382, 480, 382, 478,
  380, 480, 382, 480, 382, 480, 382, 478, 382, 480, 382, 478,
  358, 504, 382, 480, 380, 480, 382, 480, 382, 480, 380, 480,
  382, 478, 382, 480, 382, 478, 382, 480, 354, 506, 354, 506,
  380, 480, 382, 480, 382, 480, 382, 480, 380, 1342, 382, 480,
  382, 480, 382, 478, 382, 478, 382, 478, 384, 478, 382, 29652,
  3426, 1772, 382, 1340, 382, 480, 380, 478, 382, 480, 382, 1342,
  382, 480, 382, 480, 382, 478, 356, 506, 382, 1342, 380, 480,
  382, 1340, 382, 1340, 382, 478, 356, 1366, 382, 1340, 384, 1340,
  382, 1340, 382, 1342, 382, 478, 382, 478, 382, 1340, 382, 478,
  382, 478, 382, 478, 382, 480, 382, 480, 384, 478, 358, 504,
  382, 478, 382, 480, 382, 478, 382, 480, 382, 480, 382, 478,
  382, 480, 382, 478, 382, 478, 382, 478, 382, 478, 384, 478,
  382, 478, 360, 500, 358, 504, 382, 478, 382, 480, 382, 480,
  382, 478, 382, 478, 382, 1340, 382, 1342, 382, 480, 380, 480,
  382, 1342, 382, 478, 382, 480, 356, 506, 382, 478, 382, 480,
  382, 480, 356, 506, 382, 478, 382, 480, 382, 478, 382, 480,
  382, 478, 382, 480, 380, 480, 380, 480, 382, 1342, 382, 478,
  382, 1342, 382, 480, 382, 480, 382, 478, 382, 478, 382, 480,
  382, 478, 382, 480, 356, 504, 384, 478, 382, 480, 382, 480,
  380, 480, 382, 478, 382, 480, 382, 480, 382, 478, 356, 504,
  384, 478, 380, 480, 382, 480, 382, 480, 382, 478, 356, 506,
  382, 478, 382, 480, 380, 480, 382, 478, 382, 480, 382, 478,
  382, 480, 358, 504, 382, 478, 382, 478, 356, 504, 382, 478,
  382, 480, 382, 478, 382, 478, 382, 478, 382, 480, 380, 480,
  382, 480, 380, 480, 356, 506, 356, 504, 382, 480, 382, 478,
  382, 478, 382, 478, 382, 478, 382, 480, 382, 478, 382, 480,
  382, 480, 382, 1340, 382, 1342, 382, 478, 384, 478, 382, 478,
  382, 480, 380, 480, 382, 478, 382, 480, 356, 506, 382, 478,
  382, 480, 382, 478, 356, 506, 380, 480, 382, 478, 382, 478,
  382, 478, 382, 480, 382, 480, 380, 480, 382, 1342, 382, 1340,
  382, 480, 356, 504, 382, 1342, 382,
];
