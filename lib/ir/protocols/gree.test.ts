import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { decodeBroadlink } from "../transports/broadlink";
import { roundTripFailures } from "./_roundtrip";
import { gree as p } from "./gree";
import { fixtureTest, loadData } from "../core/fixtures";

const captures: Record<string, number[]> = loadData("fixtures/irremoteesp8266-gree.json").captures;
const off: ClimateState = { power: false, mode: "auto", temp: 25, fan: "auto", swingV: "off", swingH: "off", light: true };
const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "off", swingH: "off", light: true };

test("IRremoteESP8266 TestGreeClass.SetAndGetRaw", () => {
  assert.equal(hex(p.build(off)), "00 09 20 50 00 20 00 50");
  assert.equal(
    hex(p.build({ ...base, temp: 21, fan: "medium", light: false, turbo: true, sleep: true, clean: true })),
    "A9 05 D0 50 00 20 00 A0",
  );
});

test("IRremoteESP8266 TestGreeClass.Issue814Power: YBOFB and YAW1F", () => {
  const state: ClimateState = { ...base, temp: 23, fan: "min", swingV: "auto" };
  assert.equal(hex(p.build(state, "ybofb")), "59 07 20 50 01 20 00 C0");
  assert.equal(hex(p.build({ ...state, power: false }, "ybofb")), "51 07 20 50 01 20 00 40");
  assert.equal(hex(p.build(state, "yaw1f")), "59 07 60 50 01 20 00 C0");
});

fixtureTest("IRremoteESP8266 TestDecodeGree.NormalRealExample", () => {
  assert.equal(hex(p.demodulate(captures.NormalRealExample)!), "19 0A 60 50 02 23 00 F0");
});

test("modulate and demodulate round-trip", () => {
  const b = p.build(base);
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips; YX1FSF econo is mode 5", () => {
  for (const variant of ["yaw1f", "ybofb", "yx1fsf"]) assert.deepEqual(roundTripFailures(p, base, variant), [], variant);
  const econo = p.parse(p.build({ ...base, econo: true }, "yx1fsf"));
  assert.equal(econo.econo, true);
  assert.equal(econo.mode, undefined);
});

fixtureTest("SmartIR 1000 (Toyotomi AKIRA GAN/GAG-A128 VL): 181/181 commands rebuild as YBOFB", () => {
  const { commands } = loadData("fixtures/smartir-1000-gree.json");
  const lit = { swingV: "off", swingH: "off", light: true } as const;
  const want: Record<string, ClimateState> = {
    off: { power: false, mode: "cool", temp: 25, fan: "min", ...lit },
    "cool/low/16": { power: true, mode: "cool", temp: 16, fan: "min", ...lit },
    "cool/mid/24": { power: true, mode: "cool", temp: 24, fan: "medium", ...lit },
    "cool/high/30": { power: true, mode: "cool", temp: 30, fan: "max", ...lit },
    "heat/auto/25": { power: true, mode: "heat", temp: 25, fan: "auto", ...lit },
  };
  for (const [name, state] of Object.entries(want)) {
    const got = p.demodulate(decodeBroadlink(commands[name].replace(/=+$/, "")));
    assert.equal(hex(got!), hex(p.build(state, "ybofb")), name);
  }
});
