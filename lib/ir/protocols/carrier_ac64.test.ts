import assert from "node:assert/strict";
import test from "node:test";
import { hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { roundTripFailures } from "./_roundtrip";
import { carrierAc64 as p } from "./carrier_ac64";
import { fixtureTest, loadData } from "../core/fixtures";

const captures: Record<string, number[]> = loadData("fixtures/irremoteesp8266-carrier_ac64.json").captures;
const base: ClimateState = { power: true, mode: "cool", temp: 28, fan: "auto", swingV: "auto", swingH: "off" };
/** 64-bit value as the little-endian bytes the protocol sends. */
const le = (v: bigint) => hex(Array.from({ length: 8 }, (_, i) => Number((v >> BigInt(8 * i)) & 0xffn)));

test("IRremoteESP8266 TestCarrierAc64Class.ChecksumAndSetGetRaw known states: reset (off) and on", () => {
  assert.equal(hex(p.build({ ...base, power: false })), le(0x109000002c2a5584n));
  assert.equal(hex(p.build(base)), le(0x109000102c2b5584n));
});

test("IRremoteESP8266 TestIRac.Carrier64: heat 21°C high, swing, sleep", () => {
  const s: ClimateState = { ...base, mode: "heat", temp: 21, fan: "high", sleep: true };
  const expected = { power: true, mode: "heat", temp: 21, fan: "high", swingV: "auto", sleep: true };
  assert.deepEqual(p.parse(p.build(s)), expected);
});

fixtureTest("IRremoteESP8266 TestDecodeCarrierAC64.RealExample capture and SyntheticExample output", () => {
  const b = p.demodulate(captures.RealExample)!;
  assert.equal(hex(b), le(0x404000102e5e5584n));
  assert.deepEqual(p.parse(b), { power: true, mode: "heat", temp: 30, fan: "low", swingV: "auto", sleep: false });
  assert.deepEqual(p.modulate(b), captures.SyntheticExample_sent);
});

test("corrupted checksum is rejected; modulate/demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "fan_only", temp: 17, fan: "medium", swingV: "off", sleep: true });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
  const bad = Uint8Array.from(b);
  bad[5] ^= 0x01;
  assert.equal(p.demodulate(p.modulate(bad)), null);
});

test("parse(build(s)) round-trips", () => {
  assert.deepEqual(roundTripFailures(p, base), []);
});
