import assert from "node:assert/strict";
import test from "node:test";
import { fromHex, hex } from "../core/bits";
import type { ClimateState, Fan, Mode } from "../core/types";
import { decodeBroadlink } from "../transports/broadlink";
import { mitsubishiAc as p } from "./mitsubishi_ac";
import { loadData } from "../core/fixtures";

const base: ClimateState = { power: true, mode: "cool", temp: 24, fan: "auto", swingV: "auto", swingH: "middle" };

test("IRremoteESP8266 real capture: power off, cool 24°C, auto fan, vane auto", () => {
  const want = fromHex("23 CB 26 01 00 00 18 08 36 40 00 00 00 00 00 00 00 AB");
  assert.equal(hex(p.build({ ...base, power: false }, "mr_slim")), hex(want));
  assert.deepEqual(p.parse(want), { ...base, power: false });
});

test("IRremoteESP8266 real capture: cool 26°C, low fan, vane swing", () => {
  const want = fromHex("23 CB 26 01 00 00 18 0A 36 79 00 00 00 00 00 00 00 E6");
  assert.equal(hex(p.build({ ...base, power: false, temp: 26, fan: "low", swingV: "swing" })), hex(want));
});

test("the standard variant flags auto fan", () => {
  assert.equal(p.build(base, "standard")[9], 0xc0);
});

test("888 Mr. Slim: all 61 learned commands rebuild", () => {
  const book = loadData("888.json");
  const fans: Record<string, Fan> = { silent: "quiet", low: "low", medium: "medium", high: "high", auto: "auto" };
  const swings = { auto: "auto", bottom: "low" } as const;
  let n = 0;
  for (const [fanKey, bySwing] of Object.entries<Record<string, Record<string, string>>>(book.commands.cool)) {
    for (const [swingKey, byTemp] of Object.entries(bySwing)) {
      for (const [t, code] of Object.entries(byTemp)) {
        const got = p.demodulate(decodeBroadlink(code));
        assert.ok(got, `${fanKey}/${swingKey}/${t} did not demodulate`);
        const state = { ...base, temp: Number(t), fan: fans[fanKey], swingV: swings[swingKey as "auto"] };
        assert.equal(hex(p.build(state, "mr_slim")), hex(got));
        n++;
      }
    }
  }
  const off = p.demodulate(decodeBroadlink(book.commands.off))!;
  assert.equal(hex(p.build({ ...base, power: false, temp: 26, fan: "high", swingV: "low" }, "mr_slim")), hex(off));
  assert.equal(n + 1, 61);
});

test("MSXY-FP (SmartIR 1136): every command but the duplicated capture rebuilds", () => {
  const book = loadData("msxy-fp.json");
  const fans: Record<string, Fan> = { quiet: "quiet", auto: "auto", low: "low", mid: "medium", high: "high", highest: "max" };
  let same = 0;
  for (const mode of ["cool", "dry", "fan_only"] as Mode[]) {
    for (const [fanKey, byTemp] of Object.entries<Record<string, string>>(book.commands[mode])) {
      for (const [t, code] of Object.entries(byTemp)) {
        const got = p.demodulate(decodeBroadlink(code))!;
        const built = p.build({ ...base, mode, temp: Number(t), fan: fans[fanKey], swingV: "swing" }, "msxy");
        built[10] = got[10];
        built[17] = (built[17] + got[10]) & 0xff;
        if (hex(built) === hex(got)) same++;
      }
    }
  }
  assert.equal(same, 287);
});

test("modulate and demodulate round-trip", () => {
  const b = p.build({ ...base, mode: "heat", temp: 22.5, fan: "high", swingH: "wide" });
  assert.equal(hex(p.demodulate(p.modulate(b))!), hex(b));
  assert.equal(p.parse(b).temp, 22.5);
});
