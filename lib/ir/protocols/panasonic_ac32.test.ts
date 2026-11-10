import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { panasonicAc32 as p } from "./panasonic_ac32";
import { fixtureTest, loadData } from "../core/fixtures";

const captures: Record<string, number[]> = loadData("fixtures/irremoteesp8266-panasonic_ac32.json").captures;
const base: ClimateState = { power: true, mode: "cool", temp: 16, fan: "auto", swingV: "auto", swingH: "auto" };
const pulsesOf = (out: string) => out.replace(/^f\d+d\d+/, "").match(/\d+/g)!.map(Number);

test("IRremoteESP8266 kPanasonicAc32KnownGood 0x0AF136FC (cool, auto fan, 16°C)", () => {
  assert.equal(hex(p.build(base)), "FC 36 F1 0A");
  assert.equal(hex(p.build({ ...base, power: false })), "FC 36 F1 02");
});

test("IRremoteESP8266 TestDecodePanasonicAC32 SyntheticMessage 0x0DF236FC: modulate matches sendPanasonicAC32", () => {
  const out =
    "m3543s3450" +
    "m920s828m920s2575m920s828m920s828m920s2575m920s2575m920s2575m920s2575" +
    "m920s828m920s2575m920s828m920s828m920s2575m920s2575m920s2575m920s2575" +
    "m920s2575m920s828m920s2575m920s2575m920s828m920s828m920s828m920s828" +
    "m920s2575m920s828m920s2575m920s2575m920s828m920s828m920s828m920s828" +
    "m3543s3450" +
    "m920s828m920s2575m920s828m920s828m920s2575m920s2575m920s2575m920s2575" +
    "m920s828m920s2575m920s828m920s828m920s2575m920s2575m920s2575m920s2575" +
    "m920s2575m920s828m920s2575m920s2575m920s828m920s828m920s828m920s828" +
    "m920s2575m920s828m920s2575m920s2575m920s828m920s828m920s828m920s828" +
    "m3543s3450m920s13946" +
    "m3543s3450" +
    "m920s828m920s828m920s2575m920s2575m920s2575m920s2575m920s2575m920s2575" +
    "m920s828m920s828m920s2575m920s2575m920s2575m920s2575m920s2575m920s2575" +
    "m920s828m920s2575m920s2575m920s828m920s2575m920s2575m920s828m920s828" +
    "m920s828m920s2575m920s2575m920s828m920s2575m920s2575m920s828m920s828" +
    "m3543s3450" +
    "m920s828m920s828m920s2575m920s2575m920s2575m920s2575m920s2575m920s2575" +
    "m920s828m920s828m920s2575m920s2575m920s2575m920s2575m920s2575m920s2575" +
    "m920s828m920s2575m920s2575m920s828m920s2575m920s2575m920s828m920s828" +
    "m920s828m920s2575m920s2575m920s828m920s2575m920s2575m920s828m920s828" +
    "m3543s3450m920s13946";
  assert.deepEqual(p.modulate(fromHex("FC 36 F2 0D")), pulsesOf(out));
});

fixtureTest("IRremoteESP8266 TestDecodePanasonicAC32 RealMessage demodulates to 0x0DF236FC", () => {
  const got = p.demodulate(captures.RealMessage)!;
  assert.equal(hex(got), "FC 36 F2 0D");
  assert.equal(p.parse(got).temp, 17);
  assert.equal(p.parse(got).power, true);
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, power: false, mode: "heat", temp: 28, fan: "medium", swingV: "low", swingH: "off" });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
