import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { rhoss as p } from "./rhoss";
import { fixtureTest, loadData } from "../core/fixtures";

const raw = loadData("fixtures/irremoteesp8266-s-to-y.json").captures.rhoss as number[];
const base: ClimateState = { power: true, mode: "cool", temp: 20, fan: "auto", swingV: "off", swingH: "off" };

fixtureTest("IRremoteESP8266 TestSendRhoss.RawData: power on, cool 20°C, auto fan", () => {
  const want = fromHex("AA 04 60 00 20 80 54 00 00 00 00 02");
  assert.equal(hex(p.build(base)), hex(want));
  assert.equal(hex(p.demodulate(raw)!), hex(want));
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "heat", temp: 30, fan: "max", swingV: "auto", power: false });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
