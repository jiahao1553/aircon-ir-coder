import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { toshibaAc as p } from "./toshiba_ac";
import { fixtureTest, loadData } from "../core/fixtures";

const captures: Record<string, number[]> = loadData("fixtures/irremoteesp8266-toshiba_ac.json").captures;
const base: ClimateState = { power: true, mode: "cool", temp: 22, fan: "auto", swingV: "off", swingH: "off" };
const SWING_OFF = "F2 0D 01 FE 21 02 23";

fixtureTest("IRremoteESP8266 TestIRac.Toshiba: dry 29°C low econo, settings + swing frames, each sent twice", () => {
  const b = p.build({ ...base, mode: "dry", temp: 29, fan: "low", econo: true });
  assert.equal(hex(b), `F2 0D 04 FB 09 C0 62 00 03 A8 ${SWING_OFF}`);
  assert.deepEqual(p.modulate(b), captures.TestIRac_Toshiba_sent);
});

test("IRremoteESP8266 TestToshibaACClass vectors: Filter pure_off, SwingCodes on, RealLongExample turbo", () => {
  assert.equal(hex(p.build({ ...base, mode: "heat", temp: 21 })).slice(0, 26), "F2 0D 03 FC 01 40 03 00 42");
  assert.equal(hex(p.build({ ...base, swingV: "auto" })).slice(27), "F2 0D 01 FE 21 01 20");
  assert.equal(hex(p.build({ ...base, mode: "auto", turbo: true })).slice(0, 29), "F2 0D 04 FB 09 50 00 00 01 58");
});

fixtureTest("IRremoteESP8266 real captures: RealExample_WHUB03NJ (off, 20°C), RealShortExample, RealLongExample", () => {
  const off = p.demodulate(captures.RealExample_WHUB03NJ)!;
  assert.equal(hex(off), "F2 0D 03 FC 01 30 07 00 36");
  assert.equal(hex(p.build({ ...base, power: false, temp: 20 })), `F2 0D 03 FC 01 30 07 00 36 ${SWING_OFF}`);
  assert.deepEqual(p.parse(off), { power: false, temp: 20, fan: "auto", turbo: false, econo: false });
  assert.equal(hex(p.demodulate(captures.RealShortExample)!), "F2 0D 01 FE 21 00 21");
  const long = p.demodulate(captures.RealLongExample)!;
  assert.equal(hex(long), "F2 0D 04 FB 09 50 00 00 01 58");
  assert.equal(p.parse(long).turbo, true);
});

test("modulate and demodulate round-trip, both remotes", () => {
  for (const v of ["remote_a", "remote_b"]) {
    const b = p.build({ ...base, mode: "heat", temp: 30, fan: "max", swingV: "auto", turbo: true }, v);
    assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
  }
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
