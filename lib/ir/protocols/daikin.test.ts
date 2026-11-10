import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { daikin as p } from "./daikin";

const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "off", swingH: "off" };

test("TestDaikinClass.SetAndGetRaw: power off, heat 21°C, quiet fan, mould", () => {
  const want = fromHex("11 DA 27 00 C5 00 00 D7 11 DA 27 00 42 00 00 54 11 DA 27 00 00 48 2A 00 B0 00 00 06 60 00 00 C0 00 02 5C");
  assert.equal(hex(p.build({ ...base, power: false, mode: "heat", temp: 21, fan: "quiet", clean: true })), hex(want));
});

test("TestDecodeDaikin.RealExample demodulates", () => {
  const want = fromHex("11 DA 27 00 C5 00 00 D7 11 DA 27 00 42 3A 05 93 11 DA 27 00 00 3F 3A 00 A0 00 0A 25 17 01 00 C0 00 00 32");
  assert.equal(hex(p.demodulate(realExample)!), hex(want));
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "heat", temp: 22.5, fan: "high", swingH: "auto", turbo: true });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
  assert.equal(p.parse(b).temp, 22.5);
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
  416, 446, 416, 446, 416, 446, 418, 446, 416, 446, 416, 25434,
  3436, 1768, 390, 1336, 390, 446, 416, 446, 416, 446, 416, 1336,
  390, 446, 416, 446, 416, 446, 416, 446, 416, 1336, 390, 448,
  416, 1336, 390, 1336, 390, 448, 416, 1336, 390, 1336, 390, 1338,
  388, 1338, 390, 1336, 390, 446, 416, 446, 416, 1336, 390, 446,
  416, 446, 416, 446, 416, 446, 416, 446, 416, 446, 416, 448,
  416, 446, 416, 446, 416, 446, 416, 1336, 390, 446, 416, 1336,
  390, 448, 416, 446, 416, 446, 416, 1336, 390, 1336, 390, 446,
  416, 446, 416, 446, 416, 446, 416, 446, 416, 446, 416, 446,
  416, 446, 416, 446, 416, 448, 416, 446, 416, 446, 416, 446,
  416, 448, 414, 448, 416, 448, 416, 1336, 390, 1336, 390, 1336,
  390, 446, 414, 1336, 390, 448, 414, 1336, 390, 1336, 390, 34878,
  3436, 1768, 390, 1336, 390, 446, 416, 448, 416, 446, 416, 1336,
  390, 446, 416, 448, 416, 446, 416, 446, 416, 1336, 390, 446,
  416, 1336, 390, 1336, 390, 446, 416, 1336, 390, 1336, 390, 1336,
  390, 1336, 390, 1336, 392, 446, 414, 448, 416, 1336, 390, 446,
  416, 446, 416, 446, 416, 446, 414, 448, 416, 446, 416, 448,
  414, 448, 416, 446, 416, 446, 416, 446, 414, 1336, 390, 448,
  416, 446, 416, 446, 416, 448, 416, 1336, 390, 446, 416, 446,
  416, 1336, 390, 446, 416, 1336, 390, 1336, 390, 1336, 390, 446,
  416, 446, 414, 1338, 390, 446, 416, 1336, 390, 446, 416, 446,
  416, 446, 416, 446, 416, 446, 416, 1336, 390, 1336, 390, 446,
  416, 446, 416, 1336, 390, 446, 416, 446, 416, 1336, 390, 34876,
  3436, 1768, 388, 1336, 390, 446, 416, 446, 416, 448, 416, 1336,
  390, 446, 416, 446, 416, 446, 416, 448, 416, 1336, 390, 448,
  414, 1336, 390, 1336, 390, 446, 416, 1336, 388, 1338, 388, 1336,
  390, 1336, 390, 1336, 390, 446, 416, 446, 416, 1336, 390, 446,
  420, 442, 416, 446, 416, 446, 416, 446, 416, 446, 416, 446,
  416, 446, 416, 446, 416, 446, 416, 446, 416, 446, 416, 448,
  416, 446, 416, 448, 416, 446, 416, 448, 416, 446, 416, 1336,
  390, 1336, 390, 1336, 388, 1338, 390, 1336, 390, 1336, 392, 446,
  416, 446, 416, 448, 416, 1334, 390, 446, 416, 1338, 388, 1336,
  390, 1336, 390, 446, 416, 446, 416, 448, 414, 446, 416, 446,
  416, 446, 416, 448, 416, 446, 416, 446, 416, 446, 416, 446,
  416, 446, 416, 446, 416, 446, 416, 446, 416, 1336, 390, 446,
  416, 1336, 390, 446, 414, 448, 416, 446, 416, 446, 416, 446,
  416, 448, 416, 446, 416, 446, 416, 446, 416, 1336, 390, 446,
  416, 1336, 390, 446, 416, 446, 416, 446, 416, 448, 416, 1338,
  390, 444, 418, 1336, 390, 448, 416, 446, 416, 1336, 390, 446,
  416, 446, 416, 1336, 390, 1336, 388, 1336, 390, 446, 416, 1336,
  390, 448, 414, 448, 414, 448, 416, 1334, 390, 446, 416, 446,
  416, 446, 416, 448, 416, 446, 416, 446, 416, 448, 416, 446,
  416, 446, 416, 446, 416, 446, 416, 446, 416, 446, 416, 446,
  416, 446, 416, 446, 416, 446, 416, 446, 416, 446, 416, 446,
  416, 448, 416, 1336, 390, 1336, 390, 446, 416, 446, 416, 446,
  416, 446, 414, 446, 416, 448, 416, 446, 416, 448, 414, 446,
  418, 446, 416, 446, 416, 448, 416, 446, 416, 448, 416, 446,
  416, 448, 416, 446, 416, 1336, 390, 446, 416, 446, 416, 1338,
  390, 1336, 390, 446, 416, 446, 416,
];
