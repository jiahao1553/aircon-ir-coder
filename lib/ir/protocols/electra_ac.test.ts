import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { decodeBroadlink } from "../transports/broadlink";
import { roundTripFailures } from "./_roundtrip";
import { electraAc as p } from "./electra_ac";
import { fixtureTest, loadData } from "../core/fixtures";

const captures: Record<string, number[]> = loadData("fixtures/irremoteesp8266-electra_ac.json").captures;
const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "low", swingV: "off", swingH: "off", light: false };

test("IRremoteESP8266 TestIRElectraAcClass.Turbo state", () => {
  assert.equal(hex(p.build({ ...base, turbo: true })), "C3 87 E0 00 60 40 20 00 00 20 00 08 12");
});

fixtureTest("IRremoteESP8266 TestDecodeElectraAC.RealExampleDecode", () => {
  assert.equal(hex(p.demodulate(captures.RealExampleDecode)!), "C3 87 F6 28 60 00 20 00 00 20 00 05 0D");
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, light: true, swingV: "swing" }, "alt");
  assert.equal(b[11], 0x19);
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
  assert.deepEqual(roundTripFailures(p, { ...base, light: true }, "alt"), []);
  assert.equal(p.build(base, "off05")[11], 0x05);
  assert.deepEqual(roundTripFailures(p, base, "off05"), []);
});

fixtureTest("SmartIR 2460 (FanWorld FW6-3000): 138/273 rebuild with light-off 0x05; cool and dry do", () => {
  const { commands } = loadData("fixtures/smartir-2460-electra_ac.json");
  const rest = { swingV: "off", swingH: "off", light: false } as const;
  const want: Record<string, ClimateState> = {
    "cool/auto/24": { ...base, fan: "auto", ...rest },
    "cool/low/24": { ...base, ...rest },
    "cool/mid/24": { ...base, fan: "medium", ...rest },
    "cool/high/24": { ...base, fan: "high", ...rest },
    "dry/auto/24": { ...base, mode: "dry", fan: "auto", ...rest },
  };
  for (const [name, state] of Object.entries(want)) {
    const got = p.demodulate(decodeBroadlink(commands[name].replace(/=+$/, "")));
    assert.equal(hex(got!), hex(p.build(state, "off05")), name);
  }
});
