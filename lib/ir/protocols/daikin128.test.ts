import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { daikin128 as p } from "./daikin128";

const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "off", swingH: "off" };

test("TestDecodeDaikin128.RealExample demodulates and parses", () => {
  const want = fromHex("16 12 20 19 47 22 26 AD A1 00 00 00 00 00 00 0B");
  const got = p.demodulate(realExample)!;
  assert.equal(hex(got), hex(want));
  assert.deepEqual(p.parse(got), {
    power: false,
    mode: "cool",
    temp: 26,
    fan: "auto",
    swingV: "auto",
    sleep: false,
    econo: false,
    light: false,
  });
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "heat", temp: 22, fan: "quiet", swingV: "auto", econo: true, sleep: true });
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
  9846, 9794, 9848, 9796, 4638, 2512, 348, 382, 352, 954, 352, 956,
  352, 382, 352, 956, 352, 384, 352, 382, 352, 386, 352, 382,
  352, 954, 352, 384, 352, 382, 352, 954, 352, 384, 352, 382,
  352, 386, 352, 382, 352, 382, 354, 382, 354, 382, 352, 382,
  352, 954, 352, 382, 352, 384, 352, 954, 352, 382, 352, 382,
  352, 954, 352, 954, 354, 382, 352, 382, 352, 386, 352, 954,
  354, 954, 352, 954, 352, 384, 352, 382, 352, 382, 352, 954,
  352, 384, 354, 382, 352, 954, 352, 382, 352, 382, 352, 382,
  352, 956, 352, 382, 354, 384, 354, 382, 354, 954, 352, 954,
  352, 382, 352, 382, 352, 954, 352, 382, 352, 384, 354, 954,
  352, 382, 352, 954, 352, 954, 352, 382, 352, 954, 352, 382,
  352, 956, 352, 20306, 376, 954, 352, 384, 352, 382, 352, 382,
  354, 382, 352, 954, 352, 382, 352, 958, 352, 384, 352, 382,
  352, 382, 352, 382, 352, 382, 354, 382, 352, 382, 352, 386,
  352, 382, 352, 382, 354, 382, 352, 384, 352, 382, 352, 382,
  352, 382, 354, 384, 354, 382, 354, 382, 354, 382, 352, 382,
  352, 382, 352, 382, 352, 382, 352, 386, 354, 382, 352, 382,
  352, 382, 352, 382, 352, 382, 352, 382, 354, 382, 352, 384,
  352, 382, 354, 382, 354, 382, 354, 382, 352, 382, 354, 382,
  354, 382, 354, 384, 354, 382, 354, 382, 352, 382, 352, 382,
  354, 382, 352, 382, 352, 382, 352, 386, 354, 952, 354, 954,
  352, 382, 352, 954, 354, 382, 352, 382, 354, 382, 354, 382,
  4618,
];
