import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { decodeBroadlink } from "../transports/broadlink";
import { roundTripFailures } from "./_roundtrip";
import { panasonicAc as p } from "./panasonic_ac";
import { fixtureTest, loadData } from "../core/fixtures";

const captures: Record<string, number[]> = loadData("fixtures/irremoteesp8266-panasonic_ac.json").captures;
const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "auto", swingH: "auto" };

test("IRremoteESP8266 TestIRPanasonicAcClass.toCommon swingVMiddle (RKR)", () => {
  const want = "02 20 E0 04 00 00 00 06 02 20 E0 04 00 39 32 80 73 00 00 0E E0 00 00 89 00 00 DB";
  const s: ClimateState = { ...base, temp: 25, fan: "max", swingV: "middle", swingH: "off" };
  assert.equal(hex(p.build(s, "rkr")), want);
  assert.deepEqual(p.parse(fromHex(want)), { ...s, swingH: undefined, quiet: false, turbo: false });
});

fixtureTest("IRremoteESP8266 real captures demodulate (TestDecodePanasonicAC RealExample, Issue540)", () => {
  assert.equal(
    hex(p.demodulate(captures.RealExample)!),
    "02 20 E0 04 00 00 00 06 02 20 E0 04 00 30 32 80 AF 00 00 06 60 00 00 80 00 06 83",
  );
  const issue540 = p.demodulate(captures.Issue540)!;
  assert.equal(hex(issue540), "02 20 E0 04 00 00 00 06 02 20 E0 04 00 39 34 80 AF 0D 00 0E E0 00 00 81 00 00 1E");
  assert.deepEqual(p.parse(issue540), { ...base, temp: 26, quiet: false, turbo: false });
});

test("IRremoteESP8266 TestIRac.Panasonic: NKE pins horizontal swing to middle, DKE keeps it", () => {
  const nke = p.parse(p.build({ ...base, mode: "heat", temp: 28, fan: "medium", swingH: "left", quiet: true }, "nke"));
  assert.deepEqual(nke, { ...base, mode: "heat", temp: 28, fan: "medium", swingH: "middle", quiet: true, turbo: false });
  const dke = p.build({ ...base, temp: 18, fan: "max", swingV: "high", swingH: "middle", turbo: true }, "dke");
  assert.deepEqual(p.parse(dke), { ...base, temp: 18, fan: "max", swingV: "high", swingH: "middle", quiet: false, turbo: true });
});

test("a corrupted checksum is rejected", () => {
  const pulses = p.modulate(p.build(base));
  const i = pulses.length - 3;
  pulses[i] = pulses[i] > 800 ? 432 : 1296;
  assert.equal(p.demodulate(pulses), null);
});

test("modulate and demodulate round-trip for every variant", () => {
  for (const v of p.variants!) {
    const b = p.build({ ...base, mode: "heat", fan: "high", swingV: "low", swingH: "left", turbo: true }, v.id);
    assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b), v.id);
  }
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base, "dke"), []);
  for (const v of ["jke", "ckp", "rkr"]) {
    for (const f of ["quiet", "turbo"] as const) assert.equal(p.parse(p.build({ ...base, [f]: true }, v))[f], true, v);
  }
});

fixtureTest("SmartIR 1021 (Panasonic CS-RE9GKE etc., Broadlink); 121/121 codes in the full file decode", () => {
  const { commands } = loadData("fixtures/smartir-1021-panasonic_ac.json");
  const want: Record<string, Partial<ClimateState>> = {
    "off": { power: false },
    "heat/auto/16": { power: true, mode: "heat", temp: 16, fan: "auto" },
    "cool/low/24": { power: true, mode: "cool", temp: 24, fan: "min" },
  };
  for (const [name, fields] of Object.entries(want)) {
    const b = p.demodulate(decodeBroadlink(commands[name].replace(/=+$/, "")));
    assert.ok(b, name);
    assert.deepEqual({ ...p.parse(b), ...fields }, p.parse(b), name);
  }
});
