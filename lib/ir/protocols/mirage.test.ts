import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState } from "../core/types";
import { mirage as p } from "./mirage";
import { roundTripFailures } from "./_roundtrip";

const base: ClimateState = { power: true, mode: "cool", temp: 16, fan: "auto", swingV: "auto", swingH: "off" };

test("stateReset: cool 16°C, fan auto, swing auto", () => {
  const want = fromHex("56 6C 00 00 20 1A 00 00 0C 00 0C 00 00 00 42");
  assert.equal(hex(p.build(base, "kkg9ac1")), hex(want));
  assert.equal(p.parse(want).temp, 16);
  assert.equal(p.parse(want).swingV, "auto");
});

test("modulate and demodulate round-trip", () => {
  const kkg9 = p.build({ ...base, temp: 25, fan: "low", swingV: "middle", light: true, sleep: true }, "kkg9ac1");
  const kkg29 = p.build({ ...base, temp: 24, fan: "medium", swingV: "off", swingH: "auto", quiet: true }, "kkg29ac1");
  assert.equal(hex(p.demodulate(p.modulate(kkg9))!), hex(kkg9));
  assert.equal(hex(p.demodulate(p.modulate(kkg29))!), hex(kkg29));
  assert.equal(p.parse(kkg29).quiet, true);
  assert.equal(p.parse(kkg29).swingH, "auto");
});

test("parse(build) round-trips every capability", () => {
  assert.deepEqual(roundTripFailures(p, base, "kkg9ac1"), []);
});

test("TestDecodeMirage.RealExample raw", () => {
  const raw = [8360,4248,582,518,556,1582,586,1572,528,572,556,1590,526,572,554,1586,528,578,558,1582,556,542,558,1598,528,572,556,1590,528,1610,556,1600,554,546,556,544,558,542,558,542,676,400,606,492,582,542,556,544,556,542,558,544,556,542,556,544,558,542,556,544,530,570,586,516,584,514,558,542,558,542,558,542,554,546,558,542,558,1582,534,542,580,552,528,1610,556,544,554,546,554,544,556,544,556,544,558,542,558,552,558,542,558,542,558,542,556,544,558,542,558,542,554,544,584,516,558,542,528,572,588,512,556,544,532,568,560,542,558,542,560,540,560,538,530,570,558,542,558,542,560,540,558,542,558,542,530,568,558,542,558,542,532,570,530,570,558,542,558,542,558,542,530,570,530,568,560,540,560,540,532,568,558,542,558,542,532,568,560,542,532,568,532,568,530,570,532,570,530,570,558,540,560,540,558,534,558,542,556,1600,558,1592,558,542,560,1590,530,570,530,570,556,544,560,540,556,544,558,1582,556,544,558,1600,556,542,560,542,532,568,558,542,610,1538,504,1646,582,518,528,572,528,1612,556,544,528,580,554];
  assert.equal(hex(p.demodulate(raw)!), "56 75 00 00 20 01 00 00 00 00 00 00 16 14 26");
});
