import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BRANDS, trials } from "./brands";
import { defaultState, encodeState, getProtocol, identify, PROTOCOLS } from "./index";
import { buildSmartIr, flipperSamples } from "./smartir";
import { decodeBroadlink } from "./transports/broadlink";
import { decodeTuya } from "./transports/tuya";
import { fixtureTest, loadData } from "./core/fixtures";

for (const p of PROTOCOLS) {
  test(`${p.id}: default state survives modulate and identify`, () => {
    for (const variant of [undefined, ...(p.variants ?? []).map((v) => v.id)]) {
      const s = defaultState(p);
      const bytes = p.build(s, variant);
      const hits = identify(p.modulate(bytes));
      const hit = hits.find((h) => h.protocol.id === p.id);
      assert.ok(hit, `${p.id}/${variant} not identified (got ${hits.map((h) => h.protocol.id).join(", ") || "none"})`);
      assert.deepEqual([...hit.bytes], [...bytes]);
      const off = p.build({ ...s, power: false }, variant);
      const offHit = identify(p.modulate(off)).find((h) => h.protocol.id === p.id);
      assert.deepEqual([...(offHit?.bytes ?? [])], [...off], `${p.id}/${variant} off frame`);
    }
  });

  test(`${p.id}: Flipper samples fit the 1024-timing limit`, () => {
    for (const sig of flipperSamples(p, defaultState(p), p.variants?.[0]?.id)) {
      assert.ok(sig.pulses.length <= 1024, `${sig.name}: ${sig.pulses.length}`);
      assert.equal(sig.pulses.length % 2, 0, `${sig.name} should end on a space`);
    }
  });
}

test("888 Mr. Slim capture identifies as mitsubishi_ac, rebuilt by the mr_slim variant", () => {
  const book = JSON.parse(readFileSync(new URL("../../data/888.json", import.meta.url), "utf8"));
  const [hit] = identify(decodeBroadlink(book.commands.cool.auto.bottom["23"]));
  assert.equal(hit.protocol.id, "mitsubishi_ac");
  assert.equal(hit.variant, "mr_slim");
});

fixtureTest("UFO-R11 capture (SmartIR 1143, MSXY-FN18VE) identifies as mitsubishi_ac", () => {
  const book = loadData("fixtures/smartir-1143-ufor11-off.json");
  assert.deepEqual(identify(decodeTuya(book.off)).map((h) => h.protocol.id), ["mitsubishi_ac"]);
});

test("SmartIR file has the nesting and keys SmartIR validates", () => {
  const p = getProtocol("mitsubishi_ac");
  const file = buildSmartIr({
    protocol: p,
    variant: "mr_slim",
    manufacturer: "Mitsubishi Electric",
    models: ["JS Mr.Slim 1.5hp"],
    controller: "UFOR11",
    encoding: "Raw",
    codec: "tuya",
    modes: ["cool", "dry"],
    fans: ["quiet", "auto"],
    swingAxis: "v",
    swings: ["auto", "low"],
    minTemp: 21,
    maxTemp: 26,
    step: 1,
    base: defaultState(p),
  });
  assert.equal(file.supportedController, "UFOR11");
  assert.deepEqual(file.operationModes, ["cool", "dry"]);
  const c = file.commands as Record<string, Record<string, Record<string, Record<string, string>>>> & { off: string };
  assert.equal(typeof c.off, "string");
  assert.deepEqual(Object.keys(c.cool.quiet.low), ["21", "22", "23", "24", "25", "26"]);
  const pulses = decodeTuya(c.cool.quiet.low["23"]);
  assert.deepEqual(pulses, encodeState(p, { ...defaultState(p), temp: 23, fan: "quiet", swingV: "low" }, "mr_slim"));
});

test("every brand model resolves to at least one trial", () => {
  for (const b of BRANDS) for (const m of b.models) assert.ok(trials(m, PROTOCOLS).length, `${b.name} ${m.model}`);
});
