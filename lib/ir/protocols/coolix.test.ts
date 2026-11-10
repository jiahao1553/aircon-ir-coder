import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { decodeBroadlink } from "../transports/broadlink";
import { roundTripFailures } from "./_roundtrip";
import { coolix as p } from "./coolix";
import { fixtureTest, loadData } from "../core/fixtures";

const captures: Record<string, number[]> = loadData("fixtures/irremoteesp8266-coolix.json").captures;
const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "off", swingH: "off" };

test("IRremoteESP8266 TestCoolixACClass.Issue624HandleSpecialStatesBetter: cool 24°C auto fan is 0xB2BF40", () => {
  assert.equal(hex(p.build(base)), "B2 BF 40");
  assert.equal(hex(p.build({ ...base, power: false })), "B2 7B E0");
});

test("stateReset is power on, auto, 25°C, fan Auto0 (0xB21FC8)", () => {
  assert.equal(hex(p.build({ ...base, mode: "auto", temp: 25 })), "B2 1F C8");
});

fixtureTest("IRremoteESP8266 TestDecodeCoolix.Issue1318_DirectMessage: swing-step capture 0xB20FE0", () => {
  assert.equal(hex(p.demodulate(captures.Issue1318_DirectMessage)!), "B2 0F E0");
});

test("modulate sends the frame twice; the last gap absorbs the 100ms message gap", () => {
  const pulses = p.modulate(p.build(base));
  assert.equal(pulses.length, 200);
  assert.deepEqual(pulses.slice(0, 2), [4692, 4416]);
  assert.equal(pulses[99], 5244);
  assert.equal(pulses[199], 105244);
  assert.equal(hex(p.demodulate(pulses)!), hex(p.build(base)));
});

test("parse(build(s)) round-trips; power off is the fixed off code", () => {
  assert.deepEqual(p.parse(p.build({ ...base, power: false })), { power: false });
  assert.equal(p.parse(p.build({ ...base, mode: "fan_only" })).temp, undefined);
  assert.deepEqual(roundTripFailures(p, base), []);
});

fixtureTest("SmartIR 1380 (Midea): 157/157 commands rebuild. The cool/low folder is fan auto", () => {
  const { commands } = loadData("fixtures/smartir-1380-coolix.json");
  const want: Record<string, ClimateState> = {
    off: { ...base, power: false },
    "cool/low/24": base,
    "cool/mid/24": { ...base, fan: "medium" },
    "cool/high/24": { ...base, fan: "max" },
    "heat/low/20": { ...base, mode: "heat", temp: 20 },
  };
  for (const [name, state] of Object.entries(want)) {
    const got = p.demodulate(decodeBroadlink(commands[name].replace(/=+$/, "")));
    assert.equal(hex(got!), hex(p.build(state)), name);
  }
});
