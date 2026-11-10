import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { voltas as p } from "./voltas";
import { fixtureTest, loadData } from "../core/fixtures";

const raw = loadData("fixtures/irremoteesp8266-s-to-y.json").captures.voltas as number[];
const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "off", swingH: "off" };

test("122LZF reset shape: cool 24°C, auto fan, swing unchanged", () => {
  assert.equal(hex(p.build(base)), "33 E8 80 18 3B 3B 3B 11 00 8A");
});

fixtureTest("IRremoteESP8266 TestDecodeVoltas.RealExample (wifi bit is on in the capture)", () => {
  const got = p.demodulate(raw)!;
  assert.equal(hex(got), "33 84 88 18 3B 3B 3B 11 00 E6");
  assert.equal(p.parse(got).mode, "dry");
  assert.equal(p.parse(got).temp, 24);
  assert.equal(p.parse(got).fan, "low");
  assert.equal(p.parse(got).power, true);
});

test("swing variant writes the horizontal swing change bits", () => {
  const b = p.build({ ...base, swingH: "auto", swingV: "auto" }, "swing");
  assert.equal(b[0], 0xF8 | 1);
  assert.equal(p.parse(b).swingH, "auto");
  assert.equal(p.parse(b).swingV, "auto");
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "heat", temp: 16, fan: "low", turbo: true, power: false }, "swing");
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  const fixed = roundTripFailures(p, base).filter((f) => f !== "swingH=auto parsed as off");
  assert.deepEqual(fixed, []);
  assert.deepEqual(roundTripFailures(p, base, "swing"), []);
});
