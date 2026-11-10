import assert from "node:assert/strict";
import test from "node:test";
import { decodeAny } from "../formats";
import { decodeBroadlink, encodeBroadlink } from "./broadlink";
import { decodeEsphome, encodeEsphome } from "./esphome";
import { decodeFlipper, encodeFlipper } from "./flipper";
import { decodePronto, encodePronto } from "./pronto";
import { decodeTuya, encodeTuya } from "./tuya";
import { fixtureTest, loadData } from "../core/fixtures";

const pulses = [3400, 1750, ...Array.from({ length: 144 }, (_, i) => [450, i % 3 ? 420 : 1300]).flat(), 440, 15500];
const close = (a: number[], b: number[], slack: number) =>
  assert.ok(a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= slack), "timings drifted");

test("Broadlink round trip stays within one tick", () => close(decodeBroadlink(encodeBroadlink(pulses)), pulses, 31));

test("Tuya round trip is exact and compresses", () => {
  const code = encodeTuya(pulses);
  assert.deepEqual(decodeTuya(code), pulses);
  assert.ok(code.length < pulses.length * 2);
});

fixtureTest("Tuya decodes a SmartIR UFOR11 file", () => {
  const book = loadData("fixtures/smartir-1143-ufor11-off.json");
  const t = decodeTuya(book.off);
  assert.ok(t.length > 50);
  assert.equal(decodeAny(book.off).codec, "tuya");
});

test("Pronto round trip within one carrier cycle", () => close(decodePronto(encodePronto(pulses)).pulses, pulses, 27));

test("ESPHome round trip", () => assert.deepEqual(decodeEsphome(encodeEsphome(pulses)), pulses));

test("Flipper round trip", () => {
  const text = encodeFlipper([{ name: "Cool 24", pulses }]);
  assert.match(text, /^Filetype: IR signals file\nVersion: 1\n#\nname: Cool_24\ntype: raw/);
  assert.deepEqual(decodeFlipper(text)[0].pulses, pulses);
});
