import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { lg2 as p } from "./lg2";
import { fixtureTest, loadData } from "../core/fixtures";

const captures: Record<string, number[]> = loadData("fixtures/irremoteesp8266-lg2.json").captures;
const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "max", swingV: "off", swingH: "off" };
const pulsesOf = (out: string) => out.replace(/^f\d+d\d+/, "").match(/\d+/g)!.map(Number);

test("IRremoteESP8266 TestSendLG2 SendDataOnly: 0x880094D modulates like sendLG2", () => {
  const b = p.build(base);
  assert.equal(hex(b), "08 80 09 4D");
  const out =
    "m3200s9900" +
    "m480s1600m480s550m480s550m480s550m480s1600m480s550m480s550m480s550" +
    "m480s550m480s550m480s550m480s550m480s550m480s550m480s550m480s550" +
    "m480s1600m480s550m480s550m480s1600m480s550m480s1600m480s550m480s550" +
    "m480s1600m480s1600m480s550m480s1600" +
    "m480s57230";
  assert.deepEqual(p.modulate(b), pulsesOf(out));
});

fixtureTest("IRremoteESP8266 real captures: RealLG2Example 0x880094D, Issue1008 0x8800347", () => {
  assert.equal(hex(p.demodulate(captures.RealLG2Example)!), "08 80 09 4D");
  const issue1008 = p.demodulate(captures.Issue1008)!;
  assert.equal(hex(issue1008), "08 80 03 47");
  assert.deepEqual(p.parse(issue1008), { ...base, temp: 18, light: true });
});

test("IRremoteESP8266 TestIRac.LG2_AKB74955603: auto 16°C max + swing word 0x8813149", () => {
  const b = p.build({ ...base, mode: "auto", temp: 15, swingV: "auto" }, "akb74955603");
  assert.equal(hex(b), "08 80 31 48 08 81 31 49");
});

test("IRremoteESP8266 TestIRac.LG2_AKB73757604: four vane words then the horizontal swing word", () => {
  const b = p.build({ ...base, mode: "dry", temp: 27, fan: "low", swingV: "low", swingH: "auto" }, "akb73757604");
  assert.equal(hex(b), "08 80 1C 1E 08 81 32 5B 08 81 32 D3 08 81 33 5C 08 81 33 D4 08 81 31 6B");
  assert.deepEqual(p.parse(b), { ...base, mode: "dry", temp: 27, fan: "low", swingV: "low", swingH: "auto", light: true });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
});

test("IRremoteESP8266 TestIRLgAcClass.Light / SwingV (AKB74955603): light-off and swing words follow the state", () => {
  const s: ClimateState = { ...base, mode: "fan_only", temp: 18, fan: "low" };
  assert.equal(hex(p.build({ ...s, light: false }, "akb74955603")).slice(12), "08 8C 00 A6");
  assert.equal(hex(p.build({ ...s, swingV: "middle" }, "akb74955603")).slice(12), "08 81 30 6A");
  // The remote's own capture 0x880A396 also sets unused bit 15; parse ignores it.
  assert.deepEqual(p.parse(Uint8Array.from([0x08, 0x80, 0xa3, 0x96])), { ...s, light: true });
});

test("parse(build(s)) round-trips; the gaps are the documented per-model limits", () => {
  assert.deepEqual(roundTripFailures(p, base, "akb74955603"), ["swingH=auto parsed as off"]);
  assert.deepEqual(roundTripFailures(p, base, "akb73757604"), [
    "fan=high parsed as max",
    "swingV=off parsed as highest",
    "swingV=auto parsed as highest",
    "light=false parsed as true",
  ]);
});
