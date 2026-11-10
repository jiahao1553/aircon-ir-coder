import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { daikin152 as p } from "./daikin152";

const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "off", swingH: "off" };

test("TestDaikin152Class.BuildKnownState: cool 20°C, fan min, swing on", () => {
  const want = fromHex("11 DA 27 00 00 31 28 00 3F 00 00 00 00 00 00 C5 00 00 6F");
  assert.equal(hex(p.build({ ...base, temp: 20, fan: "min", swingV: "auto" })), hex(want));
});

test("TestDecodeDaikin152.RealExample demodulates", () => {
  const want = fromHex("11 DA 27 00 00 00 34 00 40 00 00 00 00 20 00 C5 40 00 AB");
  assert.equal(hex(p.demodulate(realExample)!), hex(want));
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "heat", temp: 21, fan: "max", swingV: "auto", econo: true });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build) round-trips capability values", () => {
  const cap = p.capabilities;
  const tempMode = "heat" as ClimateState["mode"];
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
  450, 420, 448, 446, 422, 444, 422, 446, 422, 446, 422, 25182,
  3492, 1718, 450, 1288, 448, 422, 446, 448, 420, 446, 422, 1290,
  448, 422, 446, 446, 422, 446, 424, 420, 448, 1290, 448, 446,
  422, 1288, 448, 1288, 450, 420, 448, 1288, 448, 1288, 450, 1288,
  448, 1288, 448, 1290, 448, 446, 422, 446, 422, 1288, 450, 446,
  422, 420, 446, 446, 422, 422, 446, 446, 422, 420, 448, 422,
  446, 446, 422, 446, 422, 446, 422, 420, 446, 446, 422, 446,
  422, 422, 446, 446, 422, 422, 446, 446, 422, 446, 422, 446,
  422, 446, 422, 446, 424, 444, 424, 446, 420, 446, 422, 446,
  422, 424, 444, 444, 422, 424, 444, 1288, 450, 444, 422, 1288,
  450, 1288, 450, 444, 422, 422, 446, 446, 422, 446, 422, 446,
  422, 446, 422, 422, 446, 420, 448, 444, 422, 446, 422, 446,
  422, 420, 448, 446, 422, 446, 422, 446, 422, 422, 446, 1286,
  450, 422, 448, 446, 422, 446, 422, 422, 446, 420, 446, 422,
  446, 446, 422, 422, 446, 446, 422, 422, 446, 446, 424, 444,
  422, 420, 448, 446, 422, 420, 446, 446, 422, 446, 422, 420,
  448, 444, 422, 422, 448, 444, 424, 420, 446, 446, 422, 446,
  422, 422, 446, 444, 422, 446, 422, 444, 422, 446, 422, 420,
  448, 446, 422, 420, 448, 446, 422, 446, 422, 446, 422, 446,
  422, 446, 422, 444, 422, 1288, 450, 420, 448, 446, 420, 446,
  422, 446, 422, 446, 424, 420, 448, 444, 422, 422, 446, 446,
  424, 420, 448, 1312, 424, 420, 448, 1288, 448, 446, 422, 446,
  424, 420, 446, 1288, 450, 1288, 450, 444, 422, 446, 422, 422,
  448, 444, 422, 420, 448, 446, 422, 1288, 448, 446, 422, 446,
  422, 444, 424, 444, 422, 446, 422, 446, 422, 420, 448, 446,
  422, 420, 446, 1290, 448, 1288, 448, 420, 446, 1288, 448, 420,
  446, 1288, 450, 444, 424, 1286, 450,
];
