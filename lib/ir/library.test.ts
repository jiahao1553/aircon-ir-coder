import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BRANDS, trials } from "./brands";
import { defaultState, encodeState, getProtocol, identify, PROTOCOLS } from "./index";
import { CODECS, CONTROLLERS } from "./formats";
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
  assert.equal(file.supportedController, "MQTT");
  assert.equal(file.commandsEncoding, "Raw");
  assert.deepEqual(file.operationModes, ["cool", "dry"]);
  const c = file.commands as Record<string, Record<string, Record<string, Record<string, string>>>> & { off: string };
  assert.equal(typeof c.off, "string");
  const payload = (command: string) => (JSON.parse(command) as { ir_code_to_send: string }).ir_code_to_send;
  assert.equal(typeof payload(c.off), "string");
  assert.deepEqual(Object.keys(c.cool.quiet.low), ["21", "22", "23", "24", "25", "26"]);
  const pulses = decodeTuya(payload(c.cool.quiet.low["23"]));
  assert.deepEqual(pulses, encodeState(p, { ...defaultState(p), temp: 23, fan: "quiet", swingV: "low" }, "mr_slim"));
});

test("every SmartIR controller gets a climate file that controller can send", () => {
  const p = getProtocol("mitsubishi_ac");
  const base = defaultState(p);
  for (const ctrl of CONTROLLERS) {
    for (const opt of ctrl.options) {
      const file = buildSmartIr({
        protocol: p,
        variant: "mr_slim",
        manufacturer: "Mitsubishi Electric",
        models: ["MSXY-FP18VG"],
        controller: ctrl.id,
        encoding: opt.encoding,
        codec: opt.codec,
        modes: ["cool"],
        fans: ["auto"],
        swingAxis: null,
        swings: [],
        minTemp: 24,
        maxTemp: 24,
        step: 1,
        base,
      });
      assert.equal(file.supportedController, ctrl.id === "UFOR11" ? "MQTT" : ctrl.id, ctrl.id);
      assert.equal(file.commandsEncoding, opt.encoding, `${ctrl.id} ${opt.encoding}`);
      assert.equal(file.temperatureUnit, "C");
      assert.equal(file.precision, 1);
      assert.equal(file.minTemperature, 24);
      assert.equal(file.maxTemperature, 24);
      assert.deepEqual(file.operationModes, ["cool"]);
      assert.deepEqual(file.fanModes, ["auto"]);
      assert.equal("presetModes" in file, false);
      assert.equal("swingModes" in file, false);
      const commands = file.commands as { off: string; cool: { auto: Record<string, string> } };
      const stored = commands.cool.auto["24"];
      const code = ctrl.id === "UFOR11" ? (JSON.parse(stored) as { ir_code_to_send: string }).ir_code_to_send : stored;
      if (ctrl.id === "UFOR11") assert.deepEqual(Object.keys(JSON.parse(commands.off)), ["ir_code_to_send"]);
      else assert.equal(commands.off.includes("ir_code_to_send"), false);
      assert.ok(CODECS[opt.codec].decode(code).length > 8, `${ctrl.id} ${opt.encoding}`);
      if (opt.codec === "pronto") assert.match(code, /^0000( [0-9A-F]{4})+$/);
      if (opt.codec === "broadlinkHex") assert.match(code, /^26[0-9a-f]+$/);
      if (opt.codec === "esphome") {
        const values = JSON.parse(code) as number[];
        assert.ok(values[0] > 0 && values[1] < 0, "ESPHome marks are positive and spaces negative");
      }
    }
  }
});

test("a power-toggle remote stores the same code as on and off", () => {
  const p = getProtocol("kelon");
  const base = defaultState(p);
  const file = buildSmartIr({
    protocol: p,
    manufacturer: "Hisense",
    models: ["Kelon"],
    controller: "Broadlink",
    encoding: "Base64",
    codec: "broadlink",
    modes: [base.mode],
    fans: [base.fan],
    swingAxis: null,
    swings: [],
    minTemp: base.temp,
    maxTemp: base.temp,
    step: 1,
    base,
  });
  const commands = file.commands as { on: string; off: string };
  assert.equal(commands.on, commands.off);
});

test("every brand model resolves to at least one trial", () => {
  for (const b of BRANDS) for (const m of b.models) assert.ok(trials(m, PROTOCOLS).length, `${b.name} ${m.model}`);
});
