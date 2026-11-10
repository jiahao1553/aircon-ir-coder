import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { tcl112ac as p } from "./tcl112ac";
import { fixtureTest, loadData } from "../core/fixtures";

const captures: Record<string, number[]> = loadData("fixtures/irremoteesp8266-tcl112ac.json").captures;
const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "off", swingH: "off", light: true };

fixtureTest("IRremoteESP8266 TestDecodeTcl112Ac.DecodeRealExample is stateReset plus model TAC09CHSD", () => {
  const want = "23 CB 26 01 00 24 03 07 40 00 00 00 80 03";
  assert.equal(hex(p.build(base, "tac09chsd")), want);
  assert.equal(hex(p.demodulate(captures.DecodeRealExample)!), want);
  assert.equal(p.build(base, "gz055be1")[12] & 0x80, 0);
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, temp: 22.5, fan: "high", swingV: "swing", turbo: true });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base, "tac09chsd"), []);
  assert.deepEqual(roundTripFailures(p, base, "gz055be1"), []);
});
