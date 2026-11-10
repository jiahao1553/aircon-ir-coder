import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { fujitsuAc as p } from "./fujitsu_ac";
import { fixtureTest, loadData } from "../core/fixtures";

const captures: Record<string, number[]> = loadData("fixtures/irremoteesp8266-fujitsu_ac.json").captures;
const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "high", swingV: "auto", swingH: "auto" };
const ISSUE414 = "14 63 00 10 10 FE 09 30 81 04 00 00 00 00 20 2B";

test("IRremoteESP8266 TestFujitsuACClass.GetRawDefault: ARRAH2E and ARDB1", () => {
  assert.equal(hex(p.build(base)), "14 63 00 10 10 FE 09 30 81 01 31 00 00 00 20 FD");
  assert.equal(hex(p.build(base, "ardb1")), "14 63 00 10 10 FC 08 30 81 01 01 00 00 00 4D");
});

test("IRremoteESP8266 TestFujitsuACClass.GetRawTurnOff: short off messages", () => {
  assert.equal(hex(p.build({ ...base, power: false })), "14 63 00 10 10 02 FD");
  assert.equal(hex(p.build({ ...base, power: false }, "ardb1")), "14 63 00 10 10 02");
});

fixtureTest("IRremoteESP8266 TestDecodeFujitsuAC.Issue414: build, sendFujitsuAC output and real capture", () => {
  const s: ClimateState = { ...base, mode: "heat", fan: "auto", swingV: "off", swingH: "off" };
  const b = p.build(s);
  assert.equal(hex(b), ISSUE414);
  assert.deepEqual(p.modulate(b), captures.Issue414_sent);
  const got = p.demodulate(captures.Issue414)!;
  assert.equal(hex(got), ISSUE414);
  assert.deepEqual(p.parse(got), s);
});

fixtureTest("IRremoteESP8266 real ARDB1 captures: RealShortARDB1OffExample, RealLongARDB1Example", () => {
  const off = p.demodulate(captures.RealShortARDB1OffExample)!;
  assert.equal(hex(off), "14 63 00 10 10 02");
  assert.deepEqual(p.parse(off), { power: false });
  const long = p.demodulate(captures.RealLongARDB1Example)!;
  assert.equal(hex(long), "14 63 00 10 10 FC 08 30 21 01 04 00 00 00 AA");
  const s: ClimateState = { ...base, temp: 18, fan: "quiet", swingV: "off", swingH: "off" };
  assert.deepEqual(p.parse(long), s);
  assert.equal(hex(p.build(s, "ardb1")), hex(long));
});

test("corrupted checksum is rejected", () => {
  const pulses = p.modulate(p.build(base));
  pulses[pulses.length - 3] = pulses[pulses.length - 3] > 800 ? 390 : 1182;
  assert.equal(p.demodulate(pulses), null);
});

test("modulate and demodulate round-trip for every variant, on and off", () => {
  for (const { id } of p.variants!) {
    for (const power of [true, false]) {
      const b = p.build({ ...base, power, mode: "dry", temp: 27, fan: "low" }, id);
      assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b), `${id} power=${power}`);
    }
  }
});

test("parse(build(s)) round-trips (ARRAH2E and ARREW4E temperature encoding)", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
  assert.deepEqual(roundTripFailures(p, base, "arrew4e"), []);
});
