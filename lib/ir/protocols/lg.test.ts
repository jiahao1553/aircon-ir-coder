import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { decodeBroadlink } from "../transports/broadlink";
import { roundTripFailures } from "./_roundtrip";
import { lg as p } from "./lg";
import { fixtureTest, loadData } from "../core/fixtures";

const captures: Record<string, number[]> = loadData("fixtures/irremoteesp8266-lg.json").captures;
const base: ClimateState = { power: true, mode: "cool", temp: 25, fan: "max", swingV: "off", swingH: "off" };

test("IRremoteESP8266 TestIRLgAcClass.MessageConstruction: 0x8800A4E", () => {
  assert.equal(hex(p.build(base)), "08 80 0A 4E");
});

test("IRremoteESP8266 kLgAcOffCommand: power off sends only 0x88C0051", () => {
  assert.equal(hex(p.build({ ...base, power: false })), "08 8C 00 51");
  assert.deepEqual(p.parse(p.build({ ...base, power: false })), { power: false });
});

fixtureTest("IRremoteESP8266 TestDecodeLG Issue620 real capture: 0x8808721 (cool 22°C, medium)", () => {
  const got = p.demodulate(captures.Issue620)!;
  assert.equal(hex(got), "08 80 87 21");
  assert.deepEqual(p.parse(got), { ...base, temp: 22, fan: "medium", power: true });
});

test("modulate matches sendLG timing (8500/4250 header, 108050 µs minimum message)", () => {
  const pulses = p.modulate(p.build(base));
  assert.equal(pulses.length, 2 + 56 + 2);
  assert.deepEqual(pulses.slice(0, 2), [8500, 4250]);
  assert.equal(
    pulses.reduce((a, b) => a + b, 0),
    108050,
  );
});

test("LG6711A20083V appends the swing toggle word", () => {
  const b = p.build({ ...base, swingV: "auto" }, "lg6711a20083v");
  assert.equal(hex(b), "08 80 0A 4E 08 81 00 01");
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("a corrupted checksum is rejected", () => {
  const pulses = p.modulate(p.build(base));
  pulses[pulses.length - 3] = pulses[pulses.length - 3] > 1000 ? 550 : 1600;
  assert.equal(p.demodulate(pulses), null);
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base, "lg6711a20083v"), []);
});

fixtureTest("SmartIR 1060 (LG R09AWN/R24AWN/E09EK, Broadlink); 261/261 codes in the full file decode", () => {
  const { commands } = loadData("fixtures/smartir-1060-lg.json");
  const want: Record<string, Partial<ClimateState>> = {
    "off": { power: false },
    "heat/low/18": { power: true, mode: "heat", temp: 18, fan: "min" },
    "cool/high/24": { power: true, mode: "cool", temp: 24, fan: "max" },
  };
  for (const [name, fields] of Object.entries(want)) {
    // These codes end in "==" after an already complete base64 body, which atob rejects.
    const b = p.demodulate(decodeBroadlink(commands[name].replace(/=+$/, "")));
    assert.ok(b, name);
    assert.deepEqual({ ...p.parse(b), ...fields }, p.parse(b), name);
  }
});
