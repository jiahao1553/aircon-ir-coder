import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { whirlpoolAc as p } from "./whirlpool_ac";
import { fixtureTest, loadData } from "../core/fixtures";

const raw = loadData("fixtures/irremoteesp8266-s-to-y.json").captures.whirlpool as number[];
const base: ClimateState = { power: true, mode: "cool", temp: 26, fan: "auto", swingV: "auto", swingH: "off", light: true };

test("stateReset + cool 26°C, auto fan, swing, power bit set (DG11J13A)", () => {
  assert.equal(hex(p.build(base)), "83 06 84 82 00 00 80 00 40 00 00 00 00 C6 00 01 00 00 00 00 01");
});

fixtureTest("IRremoteESP8266 TestDecodeWhirlpoolAC.RealExampleDecode", () => {
  const got = p.demodulate(raw)!;
  assert.equal(hex(got), "83 06 10 71 00 00 91 1F 00 00 00 00 00 EF 00 02 00 00 00 00 02");
  assert.equal(p.parse(got).mode, "auto");
  assert.equal(p.parse(got).temp, 25);
  assert.equal(p.parse(got).fan, "auto");
  assert.equal(p.parse(got).power, false);
});

test("DG11J191 shifts the temperature by -2", () => {
  const b = p.build({ ...base, temp: 16, mode: "heat" }, "dg11j191");
  assert.equal(p.parse(b).temp, 16);
  assert.equal((b[18] >> 3) & 1, 1);
});

test("modulate has three sections and demodulates", () => {
  const b = p.build({ ...base, turbo: true, mode: "heat", temp: 32 });
  const pulses = p.modulate(b);
  assert.equal(pulses.filter((v) => v === 7920).length, 2);
  assert.equal(hex(p.demodulate(pulses)!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
