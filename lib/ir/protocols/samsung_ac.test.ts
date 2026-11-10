import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { decodeBroadlink } from "../transports/broadlink";
import { roundTripFailures } from "./_roundtrip";
import { samsungAc as p } from "./samsung_ac";
import { fixtureTest, loadData } from "../core/fixtures";

const captures: Record<string, number[]> = loadData("fixtures/irremoteesp8266-samsung_ac.json").captures;
const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "off", swingH: "off" };

const ON = "02 92 0F 00 00 00 F0 01 D2 0F 00 00 00 00 01 E2 FE 71 80 11 F0";
const OFF = "02 B2 0F 00 00 00 C0 01 D2 0F 00 00 00 00 01 02 FF 71 80 11 C0";

test("IRremoteESP8266 TestDecodeSamsungAC DecodePowerOnSample / DecodePowerOffSample: build reproduces them", () => {
  assert.equal(hex(p.build(base)), ON);
  assert.equal(hex(p.build({ ...base, power: false })), OFF);
});

fixtureTest("IRremoteESP8266 real captures demodulate (DecodePowerOnSample, DecodePowerOffSample)", () => {
  assert.equal(hex(p.demodulate(captures.DecodePowerOnSample)!), ON);
  assert.equal(hex(p.demodulate(captures.DecodePowerOffSample)!), OFF);
  assert.equal(p.parse(p.demodulate(captures.DecodePowerOffSample)!).power, false);
});

test("IRremoteESP8266 TestIRac.Samsung: auto mode forces the auto fan, quiet/light/clean/beep set", () => {
  const s: ClimateState = {
    ...base,
    mode: "auto",
    temp: 28,
    fan: "medium",
    swingV: "auto",
    swingH: "auto",
    quiet: true,
    turbo: false,
    econo: false,
    light: true,
    clean: true,
    beep: true,
  };
  assert.deepEqual(p.parse(p.build(s)), { ...s, fan: "auto" });
});

test("a corrupted section checksum is rejected", () => {
  const pulses = p.modulate(p.build(base));
  const i = pulses.length - 3;
  pulses[i] = pulses[i] > 900 ? 436 : 1432;
  assert.equal(p.demodulate(pulses), null);
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "heat", temp: 30, fan: "high", swingV: "auto", turbo: true });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});

fixtureTest("SmartIR 1400 (Samsung, Broadlink); 367/367 codes in the full file decode", () => {
  const { commands } = loadData("fixtures/smartir-1400-samsung_ac.json");
  const want: Record<string, Partial<ClimateState>> = {
    "off": { power: false },
    "heat/quiet/16": { power: true, mode: "heat", temp: 16, quiet: true },
    "cool/auto/24": { power: true, mode: "cool", temp: 24, fan: "auto" },
  };
  for (const [name, fields] of Object.entries(want)) {
    const b = p.demodulate(decodeBroadlink(commands[name].replace(/=+$/, "")));
    assert.ok(b, name);
    assert.deepEqual({ ...p.parse(b), ...fields }, p.parse(b), name);
  }
});
